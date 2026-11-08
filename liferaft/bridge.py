"""Bounded USB bridge. Ambient telemetry has no rescue authority."""
import json
import re
import time
from uuid import uuid4

from pydantic import ValidationError

from .config import log
from .contracts import AmbientFrame, ButtonEvent

MAX_FRAME_BYTES = 512
ARM_SECONDS = 120
MONITOR_SECONDS = 240


class FrameReader:
    def __init__(self):
        self.frame = bytearray()
        self.discard = False

    def read(self, connection, models):
        chunk = connection.read_until(size=MAX_FRAME_BYTES + 1)
        if not self.discard:
            self.frame.extend(chunk)
            self.discard = len(self.frame) > MAX_FRAME_BYTES
        if not chunk.endswith(b"\n"):
            return None
        raw = bytes(self.frame) if not self.discard else b""
        self.frame.clear()
        self.discard = False
        for model in models:
            try:
                return model.model_validate_json(raw)
            except ValidationError:
                continue
        return None


def wait_for_button(connection, deadline):
    reader = FrameReader()
    while time.monotonic() < deadline:
        button = reader.read(connection, (ButtonEvent,))
        if button is not None and time.monotonic() < deadline:
            return button
    raise TimeoutError("bridge disarmed without a valid button frame")


def display_state(status, incident):
    if incident is None:
        return "READY" if status.get("state") == "PRIMARY_RUNNING" else "WAITING"
    if status.get("incident_id") != incident:
        return "PENDING"
    if status.get("resume_step") is not None and status["state"] in {"VERIFIED_RESUMED", "COMPLETED"}:
        return "RECOVERED"
    if status.get("block_reason") or status["state"] == "FAILED":
        return "PENDING"
    if status["state"] == "PREEMPTING":
        return "SAVING"
    return "TEST" if status["state"] == "RESCUE_REQUESTED" else "PENDING"


def monitor(client, job, connection, *, clock=time.monotonic):
    reader = FrameReader()
    session = str(uuid4())
    started = clock()
    next_status = next_ambient = started
    last_seq = last_uptime = -1
    incident = None
    button_attempted = False

    def display(state):
        # Show the job's numeric suffix; never invent a training number.
        suffix = re.search(r"(?:^|[^0-9])([0-9]{1,3})$", job)
        connection.write((json.dumps({"type": "DISPLAY_TRAINING",
                                      "id": suffix.group(1).zfill(3) if suffix else "---"},
                                     separators=(",", ":")) + "\n").encode())
        connection.write((json.dumps({"type": "DISPLAY_STATUS", "state": state},
                                     separators=(",", ":")) + "\n").encode())

    while clock() < started + MONITOR_SECONDS:
        frame = reader.read(connection, (ButtonEvent, AmbientFrame))
        now = clock()
        try:
            if frame and frame.seq > last_seq and frame.uptime_ms >= last_uptime:
                last_seq, last_uptime = frame.seq, frame.uptime_ms
                if isinstance(frame, ButtonEvent) and not button_attempted and now < started + ARM_SECONDS:
                    button_attempted = True
                    incident = client.call("button", job, **frame.model_dump(mode="json"))
                    log("BUTTON_REQUEST_RECORDED", source_type="injected", job_id=job, incident_id=incident)
                elif isinstance(frame, AmbientFrame) and now >= next_ambient:
                    next_ambient = now + 2
                    client.call("ambient", job, session=session, **frame.model_dump(mode="json"))
            if now >= next_status:
                next_status = now + 2
                status = client.call("edge_status", job)
                state = display_state(status, incident)
                if state == "READY" and (button_attempted or now >= started + ARM_SECONDS):
                    state = "DISARMED"
                display(state)
        except (ValueError, RuntimeError):
            display("OFFLINE")
            next_status = now + 2
            log("EDGE_COORDINATOR_UNAVAILABLE", job_id=job)
    display("OFFLINE")


def require_button_port(port):
    try:
        from serial.tools.list_ports import comports
    except ImportError:
        raise RuntimeError("install pyserial==3.5 in the bridge Python environment") from None
    if not any(item.device == port and item.vid == 0x303A for item in comports()):
        raise ValueError("choose the enumerated Espressif native USB port")


def run_bridge(client, job, port, *, continuous=False, on_armed=None):
    require_button_port(port)
    from serial import Serial, SerialException

    doctor = client.call("doctor")
    if doctor["role"] != "gateway":
        raise ValueError("cloud token does not match the gateway role")
    if continuous and doctor.get("edge_protocol") != "v1":
        raise ValueError("coordinator has not deployed the edge protocol")

    connection = Serial(port=None, baudrate=115200, timeout=0.25, write_timeout=0.25)
    connection.dtr = True
    connection.rts = False
    connection.port = port
    try:
        connection.open()
        connection.reset_input_buffer()
        log("BUTTON_BRIDGE_ARMED", job_id=job, wait_seconds=ARM_SECONDS)
        if on_armed is not None:
            on_armed()
        if continuous:
            monitor(client, job, connection)
            return
        button = wait_for_button(connection, time.monotonic() + ARM_SECONDS)
    except SerialException:
        raise RuntimeError("ESP32 USB serial connection unavailable; restart to re-arm") from None
    finally:
        connection.close()

    incident = client.call("button", job, **button.model_dump(mode="json"))
    log("BUTTON_REQUEST_RECORDED", source_type="injected", job_id=job, incident_id=incident)
