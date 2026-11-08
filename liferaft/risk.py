"""Deterministic, advisory risk and bounded checkpoint scheduling."""
from dataclasses import dataclass

FRESH_S = 8
MIN_INTERVAL = 5
COOLDOWN_S = 12
MAX_OVERHEAD_FRACTION = 0.20


@dataclass(frozen=True)
class RiskDecision:
    interval: int
    score: int
    reasons: tuple[str, ...]


def decide(*, normal, active, cpu, previous_cpu, ambient, heartbeat_gap, standby_ready,
           lease_valid, checkpoint_age, checkpoint_ms, step_wall_ms, injected):
    reasons = []
    score = 0
    if cpu is None:
        reasons.append("pi_cpu_unavailable")
    else:
        hot = cpu >= (52 if active else 55)
        rising = previous_cpu is not None and cpu >= 50 and cpu - previous_cpu >= 2
        if hot or rising:
            reasons.append("pi_cpu_elevated" if hot else "pi_cpu_rising")
            score += 50
    if ambient is None:
        reasons.append("ambient_unavailable")
    elif ambient >= 35:
        reasons.append("ambient_elevated")
        score += 10
    if heartbeat_gap is not None and heartbeat_gap >= 4:
        reasons.append("heartbeat_delayed")
        score += 15
    if checkpoint_age is None or checkpoint_age >= 10:
        reasons.append("checkpoint_missing_or_aging")
        score += 15
    if injected:
        reasons.append("injected_drill")
        score += 50
    if not standby_ready:
        reasons.append("standby_unavailable")
        score += 20
    if not lease_valid:
        reasons.append("lease_inactive")
        score += 20
    affordable = (checkpoint_ms is not None and step_wall_ms is not None and step_wall_ms > 0
                  and checkpoint_ms <= MIN_INTERVAL * step_wall_ms * MAX_OVERHEAD_FRACTION)
    if not affordable:
        reasons.append("checkpoint_cost_unknown_or_high")
    credible = score >= 50 and ("pi_cpu_elevated" in reasons or "pi_cpu_rising" in reasons)
    interval = MIN_INTERVAL if credible and standby_ready and lease_valid and affordable else normal
    return RiskDecision(min(normal, interval), min(100, score), tuple(reasons))


def lifeboat_score(*, checkpoint_age, standby_ready, lease_valid, telemetry_fresh, recent_drill):
    if not telemetry_fresh or not lease_valid:
        return None
    freshness = 0 if checkpoint_age is None else round(35 * max(0, 1 - checkpoint_age / 30))
    return freshness + 25 * standby_ready + 20 + 10 * lease_valid + 10 * recent_drill
