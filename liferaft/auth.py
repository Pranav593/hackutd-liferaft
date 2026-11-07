"""Scoped local identity boundary for operator mutations."""
import hmac


def require_operator(expected: str, supplied: str) -> None:
    if not expected or not hmac.compare_digest(expected.encode(), supplied.encode()):
        raise PermissionError("operator authorization required")
