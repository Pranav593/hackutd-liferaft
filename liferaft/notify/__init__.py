"""Offline on-call transport; live signed messaging stays in liferaft.photon."""
from ..upscale_contracts import RehearsalMessage


class MockTransport:
    def send(self, text: str) -> RehearsalMessage:
        return RehearsalMessage(direction="outbound", text=text)

    def reply(self, command: str, *, recovered: bool = False) -> RehearsalMessage:
        responses = {
            "APPROVE": "Rehearsal approval recorded. Only coordinator policy may transfer ownership.",
            "HOLD": "Rehearsal held. No new migration requested; the current lease remains authoritative.",
            "ROLLBACK": "Refused: restoring the old epoch is unsafe. A new verified recovery is required.",
        }
        if command not in responses:
            raise ValueError("unknown rehearsal reply")
        text = responses[command]
        if command == "HOLD" and recovered:
            text = "Recovery already completed. HOLD cannot undo a committed epoch."
        return RehearsalMessage(direction="inbound", text=text)
