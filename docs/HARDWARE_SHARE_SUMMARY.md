We prepared LIFERAFT’s Raspberry Pi and ESP32 hardware foundation while keeping the ongoing cloud implementation separate.

The Raspberry Pi 5 successfully boots its 64-bit operating system, connects through Raspberry Pi Connect, reaches PyPI over HTTPS, and has an isolated Python environment. Its observed CPU temperature was 41.7°C with no reported undervoltage or throttling flags. Because it has no cooler, training remains disabled. We added a read-only health diagnostic, safety tests, and optional startup templates that have not been installed or enabled.

The ESP32 was identified as an ESP32-S3 with 16 MB flash and 8 MB PSRAM. We saved its original flash, built and uploaded minimal USB test firmware, verified the uploaded data, and confirmed three real serial messages with increasing counters. The firmware does not control accessories, connect to Wi-Fi, or operate power hardware.

We also added isolated Windows hardware tools, reproducible instructions, bounded serial verification, and detailed progress records. The tracker preserves the software team’s cloud recovery evidence and remaining failures.

Next, we must identify and individually test the external button, OLED, and temperature sensor before combining them. These accessories are not yet wired or verified. The relay remains disconnected. Cloud integration and complete physical-button recovery are still pending.
