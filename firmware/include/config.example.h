// Copy to config.h and fill in. config.h is gitignored — DO NOT commit real credentials.
#pragma once

// ---- Wi-Fi + backend ----
#define WIFI_SSID        "your-ssid"
#define WIFI_PASSWORD    "your-password"
#define SERVER_URL       "http://192.168.1.100:8000/api/telemetry"
#define DEVICE_API_KEY   "demo-device-key"     // must match backend DEVICE_API_KEY
#define DEVICE_ID        "outfallwatch-esp32-01"

// ---- Pins — mapped for the Freenove ESP32-S3-WROOM *CAM* board ----
// The onboard camera hard-wires GPIO 4,5,6,7,8,9,10,11,12,13,15,16,17,18, so those are
// AVOIDED here even though the firmware never starts the camera. Also avoided: 0/45/46
// (strapping), 19/20 (native USB), 43/44 (UART0 = serial monitor), 33-37 (flash/PSRAM).
// All pins below are broken out on the GPIO extension board and free.
#define TURBIDITY_ADC_PIN   1     // ADC1_CH0, free, ADC1-capable; fed via the 10k/15k divider
#define DS18B20_PIN         21    // 1-Wire data, 4.7k pull-up to 3V3
#define LED_GREEN_PIN       42
#define LED_AMBER_PIN       41
#define LED_RED_PIN         40
#define BUZZER_PIN          47    // optional; set to -1 to disable
#define RAIN_BUTTON_PIN     -1    // optional manual "storm" button; -1 = disabled

// ---- Two-point turbidity calibration (mV at the ADC pin AFTER the divider) ----
// Measure with a multimeter. Sensor output FALLS as water clouds, so V_CLEAR > V_CLOUDY.
#define CAL_ID           "cal-esp-01"
#define V_CLEAR_MV       2700.0f
#define V_CLOUDY_MV      1100.0f

// ---- Divider ratio (UNUSED by the code; kept for documentation only) ----
// The build uses a DIY LED + photoresistor rig running entirely at 3.3 V, so there is no
// 5 V step-down divider any more. toIndex() works directly on mV at the ADC pin, so these
// values do not affect behaviour. Wire the LDR on the HIGH side (3V3 -> LDR -> GPIO1,
// fixed resistor to GND) so voltage FALLS as water clouds and V_CLEAR > V_CLOUDY holds.
#define DIVIDER_R_TOP    10000.0f
#define DIVIDER_R_BOTTOM 15000.0f

// ---- Detection (keep in sync with backend demo defaults) ----
#define ESCALATE_INDEX_DELTA     30.0f
#define ESCALATE_PERSIST_MS      15000UL
#define RECOVER_INDEX_DELTA      15.0f
#define RECOVER_PERSIST_MS       12000UL
#define BASELINE_SAMPLES         12
#define MEDIAN_SAMPLES           5

// ---- Sampling / telemetry policy (demo defaults, not field-validated) ----
#define NORMAL_INTERVAL_MS       10000UL
#define EVENT_INTERVAL_MS        2000UL
#define HEARTBEAT_EVERY          6         // send at least every N samples when stable
#define OFFLINE_BUFFER_MAX       120       // bounded queue; oldest dropped on overflow
