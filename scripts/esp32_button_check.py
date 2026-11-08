"""Validate one physical USB button frame locally; never contact the coordinator."""
import argparse
import json
import time

from serial import Serial, SerialException
from serial.tools.list_ports import comports

from liferaft.bridge import wait_for_button


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--port", required=True)
    args = parser.parse_args()
    if not any(item.device == args.port and item.vid == 0x303A for item in comports()):
        parser.error("choose the freshly enumerated Espressif native USB port")
    connection = Serial(port=None, baudrate=115200, timeout=0.25)
    connection.dtr = True
    connection.rts = False
    connection.port = args.port
    try:
        connection.open()
        connection.reset_input_buffer()
        print(json.dumps({"event_type": "BUTTON_CHECK_ARMED", "wait_seconds": 45,
                          "cloud_request": False}), flush=True)
        frame = wait_for_button(connection, time.monotonic() + 45)
        print(json.dumps({"event_type": "BUTTON_CHECK_PASSED", "cloud_request": False,
                          "frame": frame.model_dump(mode="json")}), flush=True)
        return 0
    except (SerialException, TimeoutError):
        print(json.dumps({"event_type": "BUTTON_CHECK_FAILED", "cloud_request": False}), flush=True)
        return 1
    finally:
        connection.close()  # Release the port before the real one-shot bridge.


if __name__ == "__main__":
    raise SystemExit(main())
