"""Bounded native-USB board-only proof; prints only expected test banners."""
import argparse
import json
import re
import time
from datetime import datetime, timezone

import serial
from serial.tools.list_ports import comports

BANNER = re.compile(
    r"LIFERAFT_BOOT_OK seq=(\d+) uptime_ms=(\d+) mode=board_only "
    r"source_type=measured accessories=not_tested cloud=not_connected"
)


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--port", required=True)
    args = parser.parse_args()
    candidates = [port for port in comports() if port.device == args.port]
    if len(candidates) != 1 or candidates[0].vid != 0x303A:
        parser.error("choose the freshly enumerated Espressif native USB port")
    samples = []
    deadline = time.monotonic() + 15
    # Set control lines before opening; no RTS pulse, GPIO command or reset.
    connection = serial.Serial(port=None, baudrate=115200, timeout=0.25)
    connection.dtr = True
    connection.rts = False
    connection.port = args.port
    try:
        connection.open()
        while time.monotonic() < deadline and len(samples) < 3:
            raw = connection.readline(513)
            if len(raw) > 512:
                continue
            match = BANNER.fullmatch(raw.decode("ascii", errors="replace").strip())
            if not match:
                continue
            sample = {"seq": int(match[1]), "uptime_ms": int(match[2])}
            if samples and (sample["seq"] <= samples[-1]["seq"] or
                            sample["uptime_ms"] <= samples[-1]["uptime_ms"]):
                continue
            samples.append(sample)
    except serial.SerialException:
        print(json.dumps({"board_only_verified": False, "reason": "serial connection unavailable"}))
        return 1
    finally:
        connection.close()
    verified = len(samples) == 3
    print(json.dumps({
        "observed_at": datetime.now(timezone.utc).isoformat(),
        "source_type": "measured", "board_only_verified": verified,
        "samples": samples, "accessories": "not_tested", "cloud": "not_connected",
    }))
    return 0 if verified else 1


if __name__ == "__main__":
    raise SystemExit(main())
