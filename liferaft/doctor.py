"""Read-only host and outbound HTTPS diagnostics."""
import glob
import importlib.metadata
import json
import os
import platform
import shutil
import sqlite3
import ssl
import subprocess
import sys
import urllib.error
import urllib.request
from pathlib import Path

from .cloud import CloudClient
from .config import redact

PUBLIC_TARGETS = {"pypi": "https://pypi.org/", "mongodb": "https://www.mongodb.com/"}


class HttpsOnly(urllib.request.HTTPRedirectHandler):
    def redirect_request(self, req, fp, code, msg, headers, newurl):
        if not newurl.startswith("https://"):
            raise ValueError("redirect must use HTTPS")
        return super().redirect_request(req, fp, code, msg, headers, newurl)


def https_probe(url: str) -> str:
    if not url.startswith("https://"):
        raise ValueError("probe requires HTTPS")
    handler = urllib.request.HTTPSHandler(context=ssl.create_default_context())
    opener = urllib.request.build_opener(handler, HttpsOnly())
    try:
        with opener.open(urllib.request.Request(url, method="HEAD"), timeout=3) as response:
            return f"HTTP {response.status}"
    except urllib.error.HTTPError as error:
        return f"HTTP {error.code}"
    except (OSError, ValueError):
        return "unreachable"


def version(distribution: str) -> str | None:
    try:
        return importlib.metadata.version(distribution)
    except importlib.metadata.PackageNotFoundError:
        return None


def tool_version(executable: str) -> str | None:
    try:
        result = subprocess.run([executable, "--version"], capture_output=True, text=True, timeout=3)
        return result.stdout.strip() if result.returncode == 0 else None
    except (OSError, subprocess.TimeoutExpired):
        return None


def pi_model() -> str | None:
    try:
        return Path("/proc/device-tree/model").read_text().strip("\0")
    except OSError:
        return None


def inspect(*, network: bool, require_pi: bool = False, require_cloud: bool = False,
            require_training: bool = False) -> dict:
    architecture = platform.machine()
    system = platform.system()
    free = shutil.disk_usage(Path.cwd()).free
    python_supported = (3, 11) <= sys.version_info[:2] < (3, 14)
    torch_version = version("torch")
    cpu_verified = False
    if torch_version:
        try:
            check = subprocess.run(
                [sys.executable, "-c", "import torch; assert (torch.ones(1, device='cpu') + 1).item() == 2"],
                capture_output=True, timeout=12,
            )
            cpu_verified = check.returncode == 0
        except (OSError, subprocess.TimeoutExpired):
            pass
    model = pi_model()
    supported_platform = (
        (system == "Darwin" and architecture == "arm64")
        or (system == "Linux" and architecture in {"aarch64", "x86_64"})
        or (system == "Windows" and architecture.upper() == "AMD64")
    )
    if system == "Darwin":
        ports = sorted(set(glob.glob("/dev/cu.usb*") + glob.glob("/dev/cu.SLAB*")))
    elif system == "Linux":
        ports = sorted(glob.glob("/dev/ttyUSB*") + glob.glob("/dev/ttyACM*"))
    else:
        ports = []
        if system == "Windows":
            import winreg
            try:
                with winreg.OpenKey(winreg.HKEY_LOCAL_MACHINE, r"HARDWARE\DEVICEMAP\SERIALCOMM") as key:
                    ports = [winreg.EnumValue(key, index)[1] for index in range(winreg.QueryInfoKey(key)[1])]
            except OSError:
                pass
    failures = []
    if not python_supported:
        failures.append("Python 3.11–3.13 required")
    if free < 100 * 1024**2:
        failures.append("less than 100 MiB free")
    if require_pi and not (model and "Raspberry Pi 5" in model and architecture == "aarch64"):
        failures.append("64-bit Raspberry Pi 5 not detected")
    if require_training and not cpu_verified:
        failures.append("PyTorch CPU smoke test did not pass")
    cloud = "not_requested"
    if require_cloud:
        try:
            client = CloudClient(os.getenv("LIFERAFT_CLOUD_URL", ""), os.getenv("LIFERAFT_CLOUD_TOKEN", ""))
            cloud = client.call("doctor")
            if not (cloud.get("auth") is True and cloud.get("database") is True):
                failures.append("hosted auth or database check failed")
        except (ValueError, RuntimeError):
            cloud = "unavailable"
            failures.append("hosted auth or database check unavailable")
    probes = {name: https_probe(url) for name, url in PUBLIC_TARGETS.items()} if network else {}
    return {
        "mode": "local",
        "os": system, "os_version": platform.release(), "architecture": architecture,
        "python": platform.python_version(), "sqlite": sqlite3.sqlite_version,
        "node": tool_version("node"), "npm": tool_version("npm"), "free_bytes": free,
        "torch": {"version": torch_version, "cpu_verified": cpu_verified,
                  "wheel_platform_candidate": python_supported and supported_platform,
                  "installability": "cpu_smoke_passed" if cpu_verified else "installation_not_verified"},
        "hardware": {"pi_model": model, "serial_ports": ports, "status": "detected_only" if ports else "not_detected"},
        "https_egress": probes or "not_requested",
        "cloud": cloud,
        "configured": {key: bool(os.getenv(key)) for key in
                       ("LIFERAFT_CLOUD_URL", "LIFERAFT_CLOUD_TOKEN", "NVIDIA_API_KEY", "PHOTON_API_KEY")},
        "critical_failures": failures,
    }


def run(args) -> int:
    report = inspect(network=args.network or args.cloud, require_pi=args.pi,
                     require_cloud=args.cloud, require_training=args.training)
    configured = report.pop("configured")
    report = redact(report)
    report["configured"] = configured
    if args.json:
        print(json.dumps(report, indent=2))
    else:
        for key, value in report.items():
            print(f"{key.replace('_', ' ')}  {value}")
    return 1 if report["critical_failures"] else 0
