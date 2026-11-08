#include <Arduino.h>
#include <Wire.h>
#include <Adafruit_SSD1306.h>

// Standalone display bring-up. No button events, Wi-Fi, sensors or actuators.
constexpr uint8_t OLED_SDA = 8;
constexpr uint8_t OLED_SCL = 9;
Adafruit_SSD1306 screen(128, 64, &Wire, -1, 100000UL, 100000UL);
static uint8_t address = 0;
static bool initialized = false;
static uint32_t last_report = 0;
static const char *failure = "OLED_NOT_DETECTED";

static bool acknowledges(uint8_t target) {
  Wire.beginTransmission(target);
  return Wire.endTransmission() == 0;
}

void setup() {
  Serial.begin(115200);
  if (!Wire.begin(OLED_SDA, OLED_SCL, 100000)) {
    failure = "I2C_START_FAILED";
    return;
  }
  Wire.setTimeOut(50);
  const bool at_3c = acknowledges(0x3C);
  const bool at_3d = acknowledges(0x3D);
  if (at_3c == at_3d) {
    failure = at_3c ? "OLED_ADDRESS_AMBIGUOUS" : "OLED_NOT_DETECTED";
    return;
  }
  address = at_3c ? 0x3C : 0x3D;
  // Preserve the explicit ESP32 SDA/SCL pins; no peripheral re-initialization.
  if (!screen.begin(SSD1306_SWITCHCAPVCC, address, false, false)) {
    failure = "OLED_INIT_FAILED";
    return;
  }
  screen.clearDisplay();
  screen.setTextColor(SSD1306_WHITE);
  screen.setTextSize(2);
  screen.setCursor(0, 0);
  screen.print("LIFERAFT");
  screen.setCursor(0, 16);
  screen.print("Training");
  screen.setCursor(0, 32);
  screen.print("ID: #---");
  screen.setTextSize(1);
  screen.setCursor(0, 48);
  // Operator-requested static label, not a network connectivity assertion.
  screen.print("Cloud: Online");
  screen.display();
  initialized = true;
}

void loop() {
  const uint32_t now = millis();
  if (static_cast<uint32_t>(now - last_report) >= 2000) {
    last_report = now;
    const bool connected = initialized && acknowledges(address);
    Serial.printf(
        "{\"event_type\":\"%s\",\"source_type\":\"measured\","
        "\"uptime_ms\":%lu,\"address\":%u,\"mode\":\"local_display_test\","
        "\"cloud_connected\":false,\"ambient_valid\":false}\n",
        connected ? "OLED_TEST_READY" : (initialized ? "OLED_DISCONNECTED" : failure),
        static_cast<unsigned long>(now), address);
  }
  delay(10);
}
