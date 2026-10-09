// OutfallWatch ESP32-S3 firmware.
//
// Mirrors the backend detection engine: median filter -> frozen baseline ->
// index-delta persistence state machine, so the device raises LOCAL physical alerts
// even with Wi-Fi down. Non-blocking millis() loop, adaptive sampling, event-aware
// telemetry, and a bounded offline buffer with retry/backoff.
//
// STATUS: source complete; NOT compiled/flashed in the build environment (no board /
// PlatformIO). Verify the exact Freenove ESP32-S3 variant and GPIOs before flashing.
// See docs/FREENOVE_INTEGRATION.md and docs/WIRING.md.

#include <Arduino.h>
#include <WiFi.h>
#include <HTTPClient.h>
#include <ArduinoJson.h>
#include <OneWire.h>
#include <DallasTemperature.h>
#include "config.h"

// ----------------------------------------------------------------- sensor state
static OneWire oneWire(DS18B20_PIN);
static DallasTemperature ds18b20(&oneWire);
static bool ds18b20Present = false;

static float medianBuf[MEDIAN_SAMPLES];
static uint32_t medianWrite = 0;   // monotonic write index so the window actually slides
static float baselineBuf[BASELINE_SAMPLES];
static int baselineCount = 0;
static bool baselineSet = false;
static float baselineValue = 0;

enum State { NORMAL, ELEVATED, ALERT, RECOVERING, SENSOR_FAULT };
static State state = NORMAL;
static uint32_t aboveSince = 0, belowSince = 0;

// adaptive scheduling + metrics
static uint32_t lastSampleMs = 0, lastBackoffMs = 0;
static uint16_t samplesSinceTx = 0;
static uint32_t msgCount = 0, byteCount = 0, sampleCount = 0;
static uint32_t readingSeq = 0;

// bounded offline buffer (ring)
static String offlineBuf[OFFLINE_BUFFER_MAX];
static int obHead = 0, obCount = 0;
static uint32_t wifiBackoffMs = 1000;

// ----------------------------------------------------------------- helpers
static float medianOf(float *arr, int n) {
  // sized to the LARGER caller (baseline window) — medianOf is used for both buffers
  constexpr int CAP = BASELINE_SAMPLES > MEDIAN_SAMPLES ? BASELINE_SAMPLES : MEDIAN_SAMPLES;
  float tmp[CAP];
  if (n > CAP) n = CAP;  // safety clamp — never overrun the scratch buffer
  for (int i = 0; i < n; i++) tmp[i] = arr[i];
  for (int i = 0; i < n; i++)
    for (int j = i + 1; j < n; j++)
      if (tmp[j] < tmp[i]) { float t = tmp[i]; tmp[i] = tmp[j]; tmp[j] = t; }
  return (n % 2) ? tmp[n / 2] : 0.5f * (tmp[n / 2 - 1] + tmp[n / 2]);
}

static float readTurbidityMv() {
  // Average several ADC reads for stability. analogReadMilliVolts handles attenuation cal.
  uint32_t acc = 0; const int N = 16;
  for (int i = 0; i < N; i++) acc += analogReadMilliVolts(TURBIDITY_ADC_PIN);
  return (float)acc / N;  // mV at the ADC pin (after the divider)
}

// clamp(100*(Vclear - V)/(Vclear - Vcloudy), 0, 100). Returns -1 on invalid calibration.
static float toIndex(float adcMv) {
  float span = V_CLEAR_MV - V_CLOUDY_MV;
  if (span <= 0) return -1;
  float idx = 100.0f * (V_CLEAR_MV - adcMv) / span;
  return idx < 0 ? 0 : (idx > 100 ? 100 : idx);
}

static void setIndicators(State s) {
  digitalWrite(LED_GREEN_PIN, s == NORMAL);
  digitalWrite(LED_AMBER_PIN, s == ELEVATED || s == RECOVERING);
  digitalWrite(LED_RED_PIN, s == ALERT || s == SENSOR_FAULT);
#if BUZZER_PIN >= 0
  digitalWrite(BUZZER_PIN, s == ALERT);  // physical alarm independent of network
#endif
}

// ----------------------------------------------------------------- detection (local)
// Returns true if the state changed or escalated this sample.
static bool updateState(float index, uint32_t now) {
  if (index < 0) { state = SENSOR_FAULT; aboveSince = belowSince = 0; return true; }

  // median smoothing — true sliding window (monotonic write index)
  medianBuf[medianWrite % MEDIAN_SAMPLES] = index;
  medianWrite++;
  int mcount = medianWrite < (uint32_t)MEDIAN_SAMPLES ? (int)medianWrite : MEDIAN_SAMPLES;
  float smoothed = medianOf(medianBuf, mcount);

  // establish + freeze baseline from the initial calm window
  if (state == NORMAL && !baselineSet) {
    baselineBuf[baselineCount++] = smoothed;
    if (baselineCount >= BASELINE_SAMPLES) {
      baselineValue = medianOf(baselineBuf, BASELINE_SAMPLES);
      baselineSet = true;
    }
  }
  if (!baselineSet) { state = NORMAL; return false; }

  float delta = smoothed - baselineValue;
  bool above = delta >= ESCALATE_INDEX_DELTA;
  bool below = delta <= RECOVER_INDEX_DELTA;
  if (above) { if (!aboveSince) aboveSince = now; } else aboveSince = 0;
  if (below) { if (!belowSince) belowSince = now; } else belowSince = 0;

  State prev = state;
  switch (state) {
    case NORMAL:
      if (aboveSince && now - aboveSince >= ESCALATE_PERSIST_MS) state = ELEVATED;
      break;
    case ELEVATED:
      if (aboveSince && now - aboveSince >= 2 * ESCALATE_PERSIST_MS) state = ALERT;
      else if (belowSince && now - belowSince >= RECOVER_PERSIST_MS) state = RECOVERING;
      break;
    case ALERT:
      if (belowSince && now - belowSince >= RECOVER_PERSIST_MS) state = RECOVERING;
      break;
    case RECOVERING:
      if (belowSince && now - belowSince >= RECOVER_PERSIST_MS) {
        state = NORMAL; baselineSet = false; baselineCount = 0;  // re-establish after resolve
      } else if (above) state = ALERT;
      break;
    case SENSOR_FAULT:
      state = NORMAL;  // recovered to a valid reading
      break;
  }
  return state != prev;
}

// ----------------------------------------------------------------- telemetry
static uint32_t currentIntervalMs() {
  return state == NORMAL ? NORMAL_INTERVAL_MS : EVENT_INTERVAL_MS;  // adaptive
}

static String buildPacket(float adcMv, float index, float tempC, bool stormBtn) {
  JsonDocument doc;
  char rid[48]; snprintf(rid, sizeof(rid), "%s-%lu", DEVICE_ID, (unsigned long)++readingSeq);
  doc["reading_id"] = rid;
  doc["device_id"] = DEVICE_ID;
  doc["observed_at"] = nullptr;         // no synced RTC: backend stamps receive time honestly
  doc["source"] = "HARDWARE";
  doc["turbidity_raw_mv"] = adcMv;
  if (index >= 0) doc["turbidity_index"] = index; else doc["turbidity_index"] = nullptr;
  if (!isnan(tempC)) doc["temperature_c"] = tempC; else doc["temperature_c"] = nullptr;
  doc["conductivity_us_cm"] = nullptr;  // not fitted by default
  doc["calibration_id"] = CAL_ID;
  doc["storm_active"] = stormBtn;
  doc["sample_interval_seconds"] = currentIntervalMs() / 1000.0;
  JsonArray flags = doc["quality_flags"].to<JsonArray>();
  if (index < 0) flags.add("SENSOR_FAULT");
  String out; serializeJson(doc, out); return out;
}

static bool postJson(const String &body) {
  if (WiFi.status() != WL_CONNECTED) return false;
  HTTPClient http; http.begin(SERVER_URL);
  http.addHeader("Content-Type", "application/json");
  http.addHeader("X-Device-Key", DEVICE_API_KEY);
  int code = http.POST(body);
  http.end();
  bool ok = code == 200;
  if (ok) { msgCount++; byteCount += body.length(); }
  return ok;
}

static void enqueueOffline(const String &body) {
  if (obCount == OFFLINE_BUFFER_MAX) { obHead = (obHead + 1) % OFFLINE_BUFFER_MAX; obCount--; }  // drop oldest
  offlineBuf[(obHead + obCount) % OFFLINE_BUFFER_MAX] = body;
  obCount++;
}

static void flushOffline() {
  while (obCount > 0 && WiFi.status() == WL_CONNECTED) {
    if (!postJson(offlineBuf[obHead])) break;
    obHead = (obHead + 1) % OFFLINE_BUFFER_MAX; obCount--;
  }
}

// ----------------------------------------------------------------- setup / loop
void setup() {
  Serial.begin(115200);
  pinMode(LED_GREEN_PIN, OUTPUT); pinMode(LED_AMBER_PIN, OUTPUT); pinMode(LED_RED_PIN, OUTPUT);
#if BUZZER_PIN >= 0
  pinMode(BUZZER_PIN, OUTPUT);
#endif
#if RAIN_BUTTON_PIN >= 0
  pinMode(RAIN_BUTTON_PIN, INPUT_PULLUP);
#endif
  analogReadResolution(12);
  analogSetPinAttenuation(TURBIDITY_ADC_PIN, ADC_11db);  // widen ADC range; VERIFY for your board
  ds18b20.begin();
  ds18b20Present = ds18b20.getDeviceCount() > 0;

  WiFi.mode(WIFI_STA);
  WiFi.begin(WIFI_SSID, WIFI_PASSWORD);  // non-blocking; loop handles reconnect/backoff
  setIndicators(NORMAL);
}

void loop() {
  uint32_t now = millis();

  // Wi-Fi reconnect with backoff (never block the detection loop)
  if (WiFi.status() != WL_CONNECTED && now - lastBackoffMs > wifiBackoffMs) {
    lastBackoffMs = now;
    WiFi.reconnect();
    wifiBackoffMs *= 2;                             // exponential backoff (Arduino min() is a macro)
    if (wifiBackoffMs > 30000) wifiBackoffMs = 30000;
  } else if (WiFi.status() == WL_CONNECTED) {
    wifiBackoffMs = 1000;
    flushOffline();
  }

  if (now - lastSampleMs < currentIntervalMs()) return;  // adaptive cadence
  lastSampleMs = now;
  sampleCount++;

  float adcMv = readTurbidityMv();
  float index = toIndex(adcMv);
  float tempC = NAN;  // NAN -> sent as null, never a bogus value
  if (ds18b20Present) {
    ds18b20.requestTemperatures();
    float t = ds18b20.getTempCByIndex(0);
    // reject DEVICE_DISCONNECTED_C (-127) and anything outside the backend's accepted band,
    // so one bad read can't 422-reject the whole packet
    if (t >= -5.0f && t <= 60.0f) tempC = t;
  }
#if RAIN_BUTTON_PIN >= 0
  bool stormBtn = digitalRead(RAIN_BUTTON_PIN) == LOW;
#else
  bool stormBtn = false;
#endif

  bool changed = updateState(index, now);
  setIndicators(state);  // LOCAL alarm fires regardless of connectivity

  // event-aware transmission: always send on state change/fault, else heartbeat
  samplesSinceTx++;
  bool urgent = changed || state == ALERT || state == SENSOR_FAULT;
  if (urgent || samplesSinceTx >= HEARTBEAT_EVERY) {
    samplesSinceTx = 0;
    String body = buildPacket(adcMv, index, tempC, stormBtn);
    if (!postJson(body)) enqueueOffline(body);  // bounded retry queue
  }

  Serial.printf("idx=%.1f base=%.1f state=%d msgs=%lu buf=%d\n",
                index, baselineValue, state, (unsigned long)msgCount, obCount);
}
