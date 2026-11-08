"""Read-only evidence tools. The model cannot execute coordinator mutations."""
from ..upscale_contracts import ToolResult


TOOLS = {
    "read_telemetry", "forecast_failure", "rank_workers", "choose_checkpoint_policy",
    "verify_checkpoint", "verify_continuity", "write_handoff_brief",
}


def execute_tool(name: str, arguments: dict, operation) -> ToolResult:
    if name not in TOOLS:
        raise ValueError("tool is not in the read-only registry")
    return ToolResult(tool=name, arguments=arguments, result=operation())


def select_planner(provider=None) -> str:
    """Provider failures never block recovery; no unvalidated plan gets authority."""
    if provider is not None:
        try:
            provider()
        except (RuntimeError, TimeoutError, ValueError):
            pass
    return "deterministic_fallback"
