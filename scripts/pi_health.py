"""One read-only Pi health sample; no training, credentials, or cloud writes."""
import json
import math
import platform
import re
import shutil
import subprocess
from datetime import datetime, timezone
from pathlib import Path


def read_text(path):
    try:
        return Path(path).read_text().strip().strip("\0")
    except OSError:
        return None


def command(arguments):
    try:
        result = subprocess.run(arguments, capture_output=True, text=True, timeout=3)
        return result.stdout.strip() if result.returncode == 0 else None
    except (OSError, subprocess.TimeoutExpired):
        return None


def temperature(raw):
    try:
        value = float(raw) / 1000
        return value if math.isfinite(value) and 0 < value <= 125 else None
    except (TypeError, ValueError):
        return None


def assess(model, architecture, temp_c, throttled):
    reasons = []
    if not model or "Raspberry Pi 5" not in model or architecture != "aarch64":
        reasons.append("64-bit Raspberry Pi 5 not verified")
    if temp_c is None or not math.isfinite(temp_c) or not 0 < temp_c <= 125:
        reasons.append("CPU temperature unavailable or invalid")
    elif temp_c >= 60:
        reasons.append("conservative fanless setup limit reached (60 C)")
    if throttled is None:
        reasons.append("power/throttling status unavailable")
    elif throttled != 0:
        reasons.append("power/throttling flags present; inspect before further load")
    return reasons


def inspect():
    model = read_text("/proc/device-tree/model")
    architecture = platform.machine()
    temp_c = temperature(read_text("/sys/class/thermal/thermal_zone0/temp"))
    raw_flags = command(["vcgencmd", "get_throttled"])
    match = re.fullmatch(r"throttled=0x([0-9a-fA-F]+)", raw_flags or "")
    flags = int(match[1], 16) if match else None
    reasons = assess(model, architecture, temp_c, flags)
    return {
        "schema_version": 1,
        "source_type": "measured",
        "observed_at": datetime.now(timezone.utc).isoformat(),
        "model": model,
        "architecture": architecture,
        "python": platform.python_version(),
        "os_release": read_text("/etc/os-release"),
        "free_disk_bytes": shutil.disk_usage(Path("/")).free,
        "pi_cpu_temp_c": temp_c,
        "throttled_hex": hex(flags) if flags is not None else None,
        "status": "ATTENTION" if reasons else "LIGHT_SETUP_ONLY",
        "reasons": reasons,
        "training_authorized": False,
        "cloud_reporting": "not_implemented",
    }


if __name__ == "__main__":
    report = inspect()
    print(json.dumps(report, allow_nan=False))
    raise SystemExit(1 if report["reasons"] else 0)
