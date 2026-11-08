"""One-shot USB bridge for the injected cooling drill."""
import time

from pydantic import ValidationError

from .config import log
from .contracts import ButtonEvent

MAX_FRAME_BYTES = 512
ARM_SECONDS = 120


def wait_for_button(connection, deadline):
    frame = bytearray()
    discard = False
    while time.monotonic() < deadline:
        # A serial timeout can return a partial frame. Never parse a suffix of an oversized line.
        chunk = connection.read_until(size=MAX_FRAME_BYTES + 1)
        if not discard:
            frame.extend(chunk)
            discard = len(frame) > MAX_FRAME_BYTES
        if not chunk.endswith(b"\n"):
            continue
        if not discard and time.monotonic() < deadline:
            try:
                return ButtonEvent.model_validate_json(frame)
            except ValidationError:
                pass  # Includes board-only banners and unrelated telemetry.
        frame.clear()
        discard = False
    raise TimeoutError("bridge disarmed without a valid button frame")


def run_bridge(client, job, port):
    try:
        from serial import Serial, SerialException
        from serial.tools.list_ports import comports
    except ImportError:
        raise RuntimeError("install pyserial==3.5 in the bridge Python environment") from None

    if not any(item.device == port and item.vid == 0x303A for item in comports()):
        raise ValueError("choose the enumerated Espressif native USB port")
    if client.call("doctor")["role"] != "gateway":
        raise ValueError("cloud token does not match the gateway role")

    connection = Serial(port=None, baudrate=115200, timeout=0.25)
    connection.dtr = True
    connection.rts = False
    connection.port = port
    try:
        connection.open()
        connection.reset_input_buffer()
        log("BUTTON_BRIDGE_ARMED", job_id=job, wait_seconds=ARM_SECONDS)
        button = wait_for_button(connection, time.monotonic() + ARM_SECONDS)
    except SerialException:
        raise RuntimeError("ESP32 USB serial connection unavailable") from None
    finally:
        connection.close()

    incident = client.call("button", job, **button.model_dump(mode="json"))
    log("BUTTON_REQUEST_RECORDED", source_type="injected", job_id=job, incident_id=incident)
