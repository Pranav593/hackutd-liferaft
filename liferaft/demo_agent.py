"""Outbound-only, bounded device runner for the live demo."""
import argparse
import os
import time
from uuid import uuid4

from .bridge import require_button_port, run_bridge
from .cloud import profile_client, run_cloud_worker
from .config import log
from .contracts import Identifier
from .pi import guarded_temperature
from pydantic import TypeAdapter

POLL_SECONDS = 3


def run_assignment(client, role, instance, job, port, capability):
    def report(stage, reason=None):
        client.call("demo_report", job, instance=instance, stage=stage, reason=reason)
        log("DEMO_DEVICE_STAGE", job_id=job, role=role, stage=stage, reason=reason)

    failure = "worker_stopped"
    try:
        if role == "gateway":
            failure = "checkpoint_wait_timeout"
            report("waiting_checkpoint")
            deadline = time.monotonic() + 120
            while time.monotonic() < deadline:
                if client.call("demo_button_ready", job):
                    break
                time.sleep(POLL_SECONDS)
            else:
                raise TimeoutError("No verified checkpoint and ready standby within 120 seconds")
            failure = "bridge_stopped"
            run_bridge(client, job, port, on_armed=lambda: report("armed"))
            report("triggered")
        else:
            report("training")
            run_cloud_worker(client, job, "primary" if role == "pi_primary" else "standby",
                             capability=capability)
            report("finished")
    except (OSError, RuntimeError, ValueError) as error:
        log("DEMO_DEVICE_ERROR", job_id=job, role=role, reason=str(error) or type(error).__name__)
        try:
            report("failed", failure)
        except (OSError, RuntimeError, ValueError):
            log("DEMO_DEVICE_REPORT_UNAVAILABLE", job_id=job, role=role)


def serve(role, port, minutes):
    client = profile_client(role)
    capability = client.call("doctor")
    if capability.get("role") != role or capability.get("live_demo") is not True:
        raise ValueError("check this device's scoped profile and enable the live demo on Render")
    if role != "gateway":
        from .workload import TrainingSession
        if role == "pi_primary":
            guarded_temperature()
        # Verify the installed CPU training runtime before advertising readiness.
        TrainingSession(1729).advance()
    if role == "gateway" and not port:
        raise ValueError("set the verified ESP32 native USB port with --port")
    instance = str(uuid4())
    deadline = time.monotonic() + minutes * 60
    seen = None
    previous_notice = None
    while time.monotonic() < deadline:
        notice = None
        try:
            if role == "gateway":
                require_button_port(port)
            if role == "pi_primary":
                guarded_temperature()
            ready = "ready"
        except (OSError, RuntimeError, ValueError) as error:
            ready, notice = "unavailable", str(error) or type(error).__name__
        try:
            result = client.call("demo_poll", instance=instance, readiness=ready)
            job = result["job"]
            if job and job != seen:
                seen = TypeAdapter(Identifier).validate_python(job)
                run_assignment(client, role, instance, seen, port, capability)
        except (OSError, RuntimeError, ValueError) as error:
            notice = str(error) or type(error).__name__
        if notice != previous_notice:
            log("DEMO_AGENT_STATUS", role=role, reason=notice)
            previous_notice = notice
        time.sleep(POLL_SECONDS)


def main():
    from .config import load_environment
    load_environment()
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("role", choices=("pi_primary", "standby", "gateway"))
    parser.add_argument("--port", default=os.environ.get("LIFERAFT_BUTTON_PORT"))
    parser.add_argument("--minutes", type=int, choices=range(1, 241), metavar="1..240", default=120)
    args = parser.parse_args()
    try:
        log("DEMO_AGENT_STARTING", role=args.role, minutes=args.minutes)
        serve(args.role, args.port, args.minutes)
    except KeyboardInterrupt:
        return 0
    except (OSError, RuntimeError, ValueError) as error:
        log("DEMO_AGENT_FAILED", role=args.role, reason=str(error) or type(error).__name__)
        return 2
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
