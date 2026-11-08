import json
from pathlib import Path
import unittest

from pydantic import TypeAdapter, ValidationError

from liferaft.agent import execute_tool, select_planner
from liferaft.forecast import forecast_failure
from liferaft.notify import MockTransport
from liferaft.upscale_contracts import FailureForecast, RehearsalMessage, ThermalSample, ToolResult


class UpscaleTests(unittest.TestCase):
    def samples(self, slope=0.35):
        return [ThermalSample(elapsed_s=float(i), cpu_c=60 + i * slope, source_type="injected") for i in range(6)]

    def test_explainable_crossing(self):
        prediction = forecast_failure(self.samples(), now_s=5)
        self.assertTrue(prediction.eligible)
        self.assertAlmostEqual(prediction.seconds_to_limit, (80 - 61.75) / .35)
        self.assertAlmostEqual(prediction.fit_quality, 1)

    def test_stale_flat_cooling_short_and_reordered_fail_closed(self):
        for samples, now in [(self.samples(), 12), (self.samples(0), 5),
                             (self.samples(-.35), 5), (self.samples()[:4], 3),
                             (list(reversed(self.samples())), 5)]:
            self.assertFalse(forecast_failure(samples, now_s=now).eligible)

    def test_mixed_sources_and_invalid_values(self):
        samples = self.samples()
        samples[-1] = samples[-1].model_copy(update={"source_type": "measured"})
        self.assertFalse(forecast_failure(samples, now_s=5).eligible)
        for value in (float("nan"), -127, 200):
            with self.assertRaises(ValidationError):
                ThermalSample(elapsed_s=1, cpu_c=value, source_type="measured")

    def test_noisy_fit_is_not_imminent(self):
        samples = [ThermalSample(elapsed_s=float(i), cpu_c=t, source_type="injected")
                   for i, t in enumerate([60., 75., 50., 79., 54., 74.])]
        self.assertFalse(forecast_failure(samples, now_s=5).eligible)

    def test_mutating_model_tools_rejected(self):
        for name in ("bash", "fence_old_primary", "migrate_and_resume", "gpio"):
            with self.assertRaises(ValueError):
                execute_tool(name, {}, lambda: self.fail("operation executed"))

    def test_provider_failure_falls_back(self):
        def failed():
            raise TimeoutError("provider unavailable")
        self.assertEqual(select_planner(failed), "deterministic_fallback")

    def test_mock_reply_boundaries(self):
        transport = MockTransport()
        self.assertEqual(transport.send("test").delivery, "simulated")
        self.assertIn("held", transport.reply("HOLD").text)
        self.assertIn("Refused", transport.reply("ROLLBACK").text)
        self.assertIn("cannot undo", transport.reply("HOLD", recovered=True).text)

    def test_additive_schema_snapshot(self):
        schema = TypeAdapter(ThermalSample | FailureForecast | ToolResult | RehearsalMessage).json_schema()
        self.assertEqual(schema, json.loads(Path("contracts/upscale.schema.json").read_text()))


if __name__ == "__main__":
    unittest.main()
