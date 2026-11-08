"""Explainable bounded-window thermal forecast, without recovery authority."""
import math

from ..upscale_contracts import FailureForecast, ThermalSample


def forecast_failure(samples: list[ThermalSample], *, now_s: float,
                     threshold_c: float = 80.0) -> FailureForecast:
    def unavailable(reason):
        return FailureForecast(threshold_c=threshold_c, reason=reason)

    if not math.isfinite(now_s) or not math.isfinite(threshold_c) or not 40 <= threshold_c <= 100:
        raise ValueError("invalid forecast clock or threshold")
    if len(samples) < 6:
        return unavailable("need six fresh readings")
    window = samples[-20:]
    if len({s.source_type for s in window}) != 1:
        return unavailable("mixed measurement and injection sources")
    if not 0 <= now_s - window[-1].elapsed_s <= 3:
        return unavailable("telemetry is stale or from the future")
    gaps = [b.elapsed_s - a.elapsed_s for a, b in zip(window, window[1:])]
    if any(not 0 < gap <= 3 for gap in gaps) or window[-1].elapsed_s - window[0].elapsed_s < 4:
        return unavailable("unordered readings or insufficient time span")
    xs = [s.elapsed_s for s in window]
    ys = [s.cpu_c for s in window]
    mx, my = sum(xs) / len(xs), sum(ys) / len(ys)
    slope = sum((x - mx) * (y - my) for x, y in zip(xs, ys)) / sum((x - mx)**2 for x in xs)
    total = sum((y - my)**2 for y in ys)
    residual = sum((y - (my + slope * (x - mx)))**2 for x, y in zip(xs, ys))
    fit = max(0.0, min(1.0, 1 - residual / total)) if total else 0.0
    # Fit quality is R², explicitly not the probability of a physical failure.
    eta = max(0.0, (threshold_c - ys[-1]) / slope) if slope > 0.01 else None
    eligible = eta is not None and eta <= 90 and fit >= 0.8
    return FailureForecast(seconds_to_limit=eta, slope_c_per_s=slope, fit_quality=fit,
                           threshold_c=threshold_c, eligible=eligible,
                           reason="rising trend crosses threshold" if eligible else "no imminent reliable crossing")
