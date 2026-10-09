# Wiring

> GPIO numbers below are **defaults in `firmware/include/config.example.h`** for a generic
> ESP32-S3 DevKit. **Verify against your exact Freenove variant** (FREENOVE_INTEGRATION.md)
> and change `config.h` to match. Measure every voltage with a multimeter before connecting.

## Turbidity sensor (5 V) → ESP32-S3 ADC via divider

The sensor output can reach ~4.5 V. The ESP32-S3 ADC must not see more than ~3.3 V (and is
most linear below that). A 10 kΩ / 15 kΩ divider scales it:

```
SEN0189 OUT ──[10kΩ]──┬──► ESP32-S3 GPIO1 (ADC1-capable)
                      │
                   [15kΩ]
                      │
                     GND
SEN0189 GND ──────────┴──► ESP32-S3 GND
SEN0189 VCC ───────────────► 5 V
```

`V_adc = V_out × 15/(10+15) = 0.6 × V_out` → 4.5 V becomes **2.7 V**. This is *not* a
substitute for confirming your board's safe ADC range. The firmware reconstructs the
sensor's own voltage from `DIVIDER_R_TOP/BOTTOM` and reads mV via `analogReadMilliVolts`
(ADC attenuation `ADC_11db` — verify for your board).

**Polarity:** sensor output typically **falls** as water gets cloudier, so calibration
requires `V_clear > V_cloudy` (CALIBRATION.md).

## DS18B20 temperature (optional)

```
DS18B20 VDD  ──► 3V3
DS18B20 GND  ──► GND
DS18B20 DATA ──┬──► ESP32-S3 GPIO21
               │
            [4.7kΩ]
               │
              3V3      (omit if the breakout already has a pull-up)
```
Match **physical wire colours to the probe's own datasheet**, not assumed colours.

## Indicators

| Signal | Default pin | Meaning |
| --- | --- | --- |
| Green LED | GPIO42 | NORMAL |
| Amber LED | GPIO41 | ELEVATED / RECOVERING |
| Red LED | GPIO40 | ALERT / SENSOR_FAULT |
| Buzzer (optional) | GPIO47 | ALERT alarm (local, network-independent) |

> **Freenove CAM board:** pins above avoid the OV2640 camera block (GPIO 4–18 range) and
> flash/PSRAM (33–37), native USB (19/20), UART0 serial (43/44), and strapping pins
> (0/45/46). All are broken out on the GPIO extension board.
| Rain button (optional) | — (set in config) | manual `storm_active` toggle |

Each LED needs a current-limiting resistor sized for the pin's safe drive current. The
indicators are driven by the **local** state machine, so they work even with Wi-Fi down.

## Build & flash

```bash
cd firmware
cp include/config.example.h include/config.h   # fill in Wi-Fi, server, pins, calibration
pio run                                         # compile
pio run -t upload                               # flash
pio device monitor                              # serial logs
```
PlatformIO was **not available in this build environment**, so the firmware is not
flash-verified — see IMPLEMENTATION_STATUS.md.
