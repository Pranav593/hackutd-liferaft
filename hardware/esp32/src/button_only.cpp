#include <Arduino.h>

// External normally-open button from GPIO5 to GND. No supply wire required.
// No sensor/OLED/Wi-Fi/actuator code; missing ambient data is explicitly invalid.
constexpr uint8_t BUTTON_PIN = 5;
constexpr uint32_t DEBOUNCE_MS = 75;
constexpr uint32_t MIN_EVENT_GAP_MS = 500;
static bool raw_pressed = false;
static bool stable_pressed = false;
static bool saw_release = false;
static uint32_t changed_at = 0;
static uint32_t last_event_at = 0;
static uint32_t sequence = 0;
static uint32_t last_ready_at = 0;

void setup() {
  pinMode(BUTTON_PIN, INPUT_PULLUP);
  Serial.begin(115200);
  raw_pressed = digitalRead(BUTTON_PIN) == LOW;
  stable_pressed = raw_pressed;
  changed_at = millis();
  // Even an initially released button must remain stable before arming.
  saw_release = false;
}

void loop() {
  const uint32_t now = millis();
  const bool pressed = digitalRead(BUTTON_PIN) == LOW;
  if (pressed != raw_pressed) {
    raw_pressed = pressed;
    changed_at = now;
  }
  if (static_cast<uint32_t>(now - changed_at) >= DEBOUNCE_MS) {
    if (!raw_pressed) {
      saw_release = true;
    }
    if (stable_pressed != raw_pressed) {
      stable_pressed = raw_pressed;
      if (stable_pressed && saw_release) {
        saw_release = false; // Holding the button can never repeat an event.
        if (sequence == 0 || static_cast<uint32_t>(now - last_event_at) >= MIN_EVENT_GAP_MS) {
          last_event_at = now;
          ++sequence;
          Serial.printf(
              "{\"protocol_version\":1,\"device_id\":\"esp32-s3-01\","
              "\"seq\":%lu,\"uptime_ms\":%lu,\"ambient_temp_c\":null,"
              "\"ambient_valid\":false,\"button_pressed\":true,"
              "\"event_type\":\"COOLING_FAILURE_TEST\",\"source_type\":\"injected\"}\n",
              static_cast<unsigned long>(sequence), static_cast<unsigned long>(now));
        }
      }
    }
  }
  if (static_cast<uint32_t>(now - last_ready_at) >= 2000) {
    last_ready_at = now;
    // A plain readiness banner is deliberately NOT a valid rescue frame.
    Serial.println("LIFERAFT_BUTTON_READY gpio=5 source_type=derived sensor=not_attached");
  }
  delay(5);
}
