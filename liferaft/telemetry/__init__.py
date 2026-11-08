"""Safe fault injection. Measured Pi collection remains in liferaft.pi."""
from ..upscale_contracts import ThermalSample


def cooling_sample(elapsed_s: float) -> ThermalSample:
    return ThermalSample(elapsed_s=elapsed_s, cpu_c=60.0 + min(elapsed_s, 60) * 0.35,
                         source_type="injected")
