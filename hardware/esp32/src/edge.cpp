#include <Arduino.h>
#include <Wire.h>
#include <OneWire.h>
#include <Adafruit_SSD1306.h>
#include <cstring>

constexpr uint8_t BUTTON_PIN = 5;
constexpr uint8_t AMBIENT_PIN = 4;
constexpr uint8_t OLED_SDA = 8;
constexpr uint8_t OLED_SCL = 9;
constexpr uint32_t FRAME_INTERVAL = 2000;
constexpr uint32_t DISPLAY_TIMEOUT = 7000;

OneWire ambient_bus(AMBIENT_PIN);
Adafruit_SSD1306 screen(128, 64, &Wire, -1, 100000UL, 100000UL);

static uint8_t sensor_id[8];
static uint8_t oled_address = 0;
static bool screen_ready = false;
static bool converting = false;
static bool ambient_valid = false;
static float ambient_c = 0;
static int16_t prior_raw = 0;
static uint8_t repeats = 0;
static uint32_t conversion_started = 0;
static uint32_t last_frame = 0;
static uint32_t sequence = 0;
static bool raw_pressed = false;
static bool stable_pressed = false;
static bool saw_release = false;
static uint32_t button_changed = 0;
static uint32_t last_button = 0;
static uint32_t last_status = 0;
static uint32_t last_draw = 0;
static const char *display_state = "OFFLINE";
static char training_id[4] = "---";

static bool acknowledges(uint8_t address) {
  Wire.beginTransmission(address);
  return Wire.endTransmission() == 0;
}

static void emit_frame(uint32_t now, bool pressed) {
  Serial.printf("{\"protocol_version\":1,\"device_id\":\"esp32-s3-01\","
                "\"seq\":%lu,\"uptime_ms\":%lu,\"ambient_temp_c\":",
                static_cast<unsigned long>(++sequence), static_cast<unsigned long>(now));
  // A button carries only the injected observation. Ambient has its own frame.
  if (!pressed && ambient_valid) {
    Serial.printf("%.4f,\"ambient_valid\":true,", ambient_c);
  } else {
    Serial.print("null,\"ambient_valid\":false,");
  }
  Serial.println(pressed
      ? "\"button_pressed\":true,\"event_type\":\"COOLING_FAILURE_TEST\",\"source_type\":\"injected\"}"
      : "\"button_pressed\":false,\"event_type\":\"TELEMETRY\",\"source_type\":\"measured\"}");
}

static void update_button(uint32_t now) {
  const bool pressed = digitalRead(BUTTON_PIN) == LOW;
  if (pressed != raw_pressed) {
    raw_pressed = pressed;
    button_changed = now;
  }
  if (now - button_changed < 75) return;
  if (!raw_pressed) saw_release = true;
  if (raw_pressed == stable_pressed) return;
  stable_pressed = raw_pressed;
  if (!stable_pressed || !saw_release) return;
  saw_release = false;
  if (last_button && now - last_button < 500) return;
  last_button = now;
  emit_frame(now, true);
}

static bool start_conversion() {
  uint8_t extra[8];
  ambient_bus.reset_search();
  if (!ambient_bus.search(sensor_id) || sensor_id[0] != 0x28
      || OneWire::crc8(sensor_id, 7) != sensor_id[7] || ambient_bus.search(extra)
      || !ambient_bus.reset()) return false;
  ambient_bus.select(sensor_id);
  ambient_bus.write(0xB4); // Read power supply. Require normal 3-wire supply.
  if (!ambient_bus.read_bit() || !ambient_bus.reset()) return false;
  ambient_bus.select(sensor_id);
  ambient_bus.write(0x44); // Start conversion without parasite-power pull-up.
  return true;
}

static void finish_conversion() {
  ambient_valid = false;
  if (!ambient_bus.reset()) return;
  ambient_bus.select(sensor_id);
  ambient_bus.write(0xBE);
  uint8_t scratch[9];
  for (auto &value : scratch) value = ambient_bus.read();
  if (OneWire::crc8(scratch, 8) != scratch[8]) return;
  const int16_t raw = static_cast<int16_t>((uint16_t(scratch[1]) << 8) | scratch[0]);
  if (raw < -55 * 16 || raw > 125 * 16 || raw == 85 * 16) return;
  if (raw != prior_raw) repeats = 0;
  if (repeats < 30) ++repeats;
  prior_raw = raw;
  ambient_c = raw / 16.0f;
  ambient_valid = repeats < 30;
}

static void receive_status(uint32_t now) {
  static char line[80];
  static size_t used = 0;
  static bool discard = false;
  const char *states[] = {"READY", "WAITING", "DISARMED", "TEST", "SAVING", "PENDING", "RECOVERED", "OFFLINE"};
  // Bound USB input work per loop so serial traffic cannot starve the sensor.
  for (int budget = 0; budget < 128 && Serial.available(); ++budget) {
    const char c = static_cast<char>(Serial.read());
    if (c != '\n') {
      if (!discard && c && used + 1 < sizeof(line)) line[used++] = c;
      else discard = true;
      continue;
    }
    line[used] = '\0';
    if (!discard) {
      // Display-only identifier: exactly three digits, never executable input.
      const char *prefix = "{\"type\":\"DISPLAY_TRAINING\",\"id\":\"";
      const size_t offset = strlen(prefix);
      if (strncmp(line, prefix, offset) == 0 && strlen(line) == offset + 5
          && strcmp(line + offset + 3, "\"}") == 0) {
        bool valid = true;
        for (size_t i = 0; i < 3; ++i)
          valid = valid && line[offset + i] >= '0' && line[offset + i] <= '9';
        valid = valid || strncmp(line + offset, "---", 3) == 0;
        if (valid) {
          memcpy(training_id, line + offset, 3);
          training_id[3] = '\0';
        }
      }
      for (const char *state : states) {
        char expected[80];
        snprintf(expected, sizeof(expected), "{\"type\":\"DISPLAY_STATUS\",\"state\":\"%s\"}", state);
        if (strcmp(line, expected) == 0) {
          display_state = state;
          last_status = now;
          break;
        }
      }
    }
    used = 0;
    discard = false;
  }
}

static void draw_status(uint32_t now) {
  if (!screen_ready || now - last_draw < 500) return;
  last_draw = now;
  if (!acknowledges(oled_address)) return;
  screen.clearDisplay();
  screen.setTextColor(SSD1306_WHITE);
  screen.setTextSize(2);
  screen.setCursor(0, 0);
  screen.print("LIFERAFT");
  screen.setCursor(0, 16);
  screen.print("Training");
  screen.setCursor(0, 32);
  screen.print("ID: #");
  screen.print(now - last_status >= DISPLAY_TIMEOUT ? "---" : training_id);
  screen.setTextSize(1);
  screen.setCursor(0, 48);
  const char *state = now - last_status >= DISPLAY_TIMEOUT ? "OFFLINE" : display_state;
  screen.print(strcmp(state, "OFFLINE") == 0 ? "Cloud: Offline" : "Cloud: Linked");
  screen.setCursor(0, 56);
  if (strcmp(state, "OFFLINE") == 0) screen.print("SAFE MODE");
  else if (strcmp(state, "READY") == 0) screen.print(ambient_valid ? "GATEWAY READY" : "SENSOR INVALID");
  else if (strcmp(state, "WAITING") == 0) screen.print("WAITING FOR JOB");
  else if (strcmp(state, "DISARMED") == 0) screen.print("DRILL DISARMED");
  else {
    screen.print("TEST / ");
    screen.print(state);
  }
  screen.display();
}

void setup() {
  pinMode(BUTTON_PIN, INPUT_PULLUP);
  raw_pressed = stable_pressed = digitalRead(BUTTON_PIN) == LOW;
  button_changed = millis();
  Serial.begin(115200);
  if (Wire.begin(OLED_SDA, OLED_SCL, 100000)) {
    Wire.setTimeOut(50);
    const bool first = acknowledges(0x3C), second = acknowledges(0x3D);
    if (first != second) {
      oled_address = first ? 0x3C : 0x3D;
      screen_ready = screen.begin(SSD1306_SWITCHCAPVCC, oled_address, false, false);
    }
  }
  Serial.println(screen_ready ? "LIFERAFT_EDGE_BOOT OLED_READY" : "LIFERAFT_EDGE_BOOT OLED_UNAVAILABLE");
}

void loop() {
  const uint32_t now = millis();
  update_button(now);
  receive_status(now);
  if (converting && now - conversion_started >= 750) {
    finish_conversion();
    converting = false;
  }
  if (now - last_frame >= FRAME_INTERVAL) {
    last_frame = now;
    converting = start_conversion();
    conversion_started = now;
    if (!converting) {
      ambient_valid = false;
      repeats = 0;
    }
    emit_frame(now, false);
  }
  draw_status(now);
  delay(5);
}
