"""Command-line entry points."""
import argparse

from . import cloud, doctor, evidence, nemotron, scenario
from .config import load_environment
from .training_cli import install_commands


def main() -> int:
    load_environment()
    parser = argparse.ArgumentParser(prog="liferaft")
    subcommands = parser.add_subparsers(dest="command", required=True)
    diagnostics = subcommands.add_parser("doctor", help="inspect the local host without changing hardware")
    diagnostics.add_argument("--json", action="store_true")
    diagnostics.add_argument("--redact", action="store_true", help="redaction is always enabled")
    diagnostics.add_argument("--network", action="store_true", help="try public HTTPS endpoints")
    diagnostics.add_argument("--training", action="store_true", help="require a working CPU PyTorch install")
    diagnostics.add_argument("--pi", action="store_true", help="require an identified 64-bit Pi 5")
    diagnostics.add_argument("--cloud", action="store_true", help="check hosted service readiness")
    diagnostics.add_argument("--hardware", action="store_true", help="include passive serial port detection")
    diagnostics.set_defaults(handler=doctor.run)
    install_commands(subcommands)
    scenario.install_commands(subcommands)
    cloud.install_commands(subcommands)
    nemotron.install_commands(subcommands)
    evidence.install_commands(subcommands)
    args = parser.parse_args()
    return args.handler(args)
