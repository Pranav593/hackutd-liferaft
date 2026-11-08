"""Fail-closed boundaries for the standalone hardware diagnostic."""
import unittest

from scripts.pi_health import assess, temperature


class PiHealthTests(unittest.TestCase):
    def test_invalid_and_missing_sensor_values_fail_closed(self):
        for raw in (None, "", "NaN", "inf", "-127000", "0", "126000", "broken"):
            with self.subTest(raw=raw):
                self.assertIsNone(temperature(raw))
                self.assertTrue(assess("Raspberry Pi 5", "aarch64", temperature(raw), 0))

    def test_fanless_limit_and_power_flags(self):
        self.assertEqual(temperature("41700"), 41.7)
        self.assertEqual(assess("Raspberry Pi 5 Model B", "aarch64", 41.7, 0), [])
        for temp, flags in ((60, 0), (75, 0), (41.7, None), (41.7, 1), (41.7, 0x10000)):
            with self.subTest(temp=temp, flags=flags):
                self.assertTrue(assess("Raspberry Pi 5", "aarch64", temp, flags))

    def test_wrong_platform_cannot_report_ready(self):
        for model, arch in ((None, "aarch64"), ("Raspberry Pi 4", "aarch64"),
                            ("Raspberry Pi 5", "armv7l")):
            self.assertTrue(assess(model, arch, 41.7, 0))
