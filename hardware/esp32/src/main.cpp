#include <Arduino.h>

// Board-only USB test: no Wi-Fi, accessory GPIO, sensors, OLED, or actuators.
static uint32_t sequence = 0;
static uint32_t last_output = 0;

void setup() {
  Serial.begin(115200);
  delay(300);
}

void loop() {
  const uint32_t now = millis();
  if (static_cast<uint32_t>(now - last_output) >= 2000) {
    last_output = now;
    Serial.printf(
        "LIFERAFT_BOOT_OK seq=%lu uptime_ms=%lu mode=board_only "
        "source_type=measured accessories=not_tested cloud=not_connected\n",
        static_cast<unsigned long>(++sequence),
        static_cast<unsigned long>(now));
  }
  delay(10);
}
