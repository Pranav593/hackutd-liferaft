"""Read-only Raspberry Pi detection and a conservative worker admission guard."""
from pathlib import Path
import platform
import re
import subprocess

PI_PRIMARY = "pi-primary"
# The fanless bring-up limit also applies to this small demo worker.
CPU_LIMIT_C = 60.0


def read_text(path):
    try:
        return Path(path).read_text().strip().strip("\0")
    except (OSError, UnicodeError):
        return None


def is_pi5():
    return (platform.system() == "Linux" and platform.machine() == "aarch64"
            and "Raspberry Pi 5" in (read_text("/proc/device-tree/model") or ""))


def cpu_temperature():
    raw = read_text("/sys/class/thermal/thermal_zone0/temp")
    try:
        value = int(raw) / 1000
    except (ValueError, TypeError):
        return None
    return value if 0 < value <= 110 else None


def guarded_temperature():
    if not is_pi5():
        raise RuntimeError("Pi worker requires a verified 64-bit Raspberry Pi 5")
    temp = cpu_temperature()
    if temp is None or temp >= CPU_LIMIT_C:
        raise RuntimeError("Pi worker stopped at the CPU telemetry or temperature guard")
    try:
        result = subprocess.run(["vcgencmd", "get_throttled"], check=True,
                                capture_output=True, text=True, timeout=0.5)
    except (OSError, subprocess.SubprocessError):
        raise RuntimeError("Pi worker could not verify power and throttling status") from None
    match = re.fullmatch(r"throttled=0x([0-9a-fA-F]+)", result.stdout.strip())
    if not match or int(match[1], 16):
        raise RuntimeError("Pi worker stopped at the power or throttling guard")
    return temp
