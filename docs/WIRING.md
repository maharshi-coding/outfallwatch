# Wiring

> GPIO numbers below are the defaults in `firmware/include/config.example.h`, **flash-verified
> on a Freenove ESP32-S3-WROOM (CAM variant)**. Measure every voltage with a multimeter before
> connecting anything to a pin.

## Turbidity substitute: LED + photoresistor → GPIO1

The LED and the LDR sit on opposite sides of the water gap. The LDR forms a divider with a
fixed resistor, and the ESP32 reads the midpoint on GPIO1 (ADC1_CH0).

```
3V3 ──[150–220Ω]──►|LED  ── ( water gap ) ──  LDR
                                               │
3V3 ───────────────────────────[LDR]───────────┴──┬──► ESP32-S3 GPIO1 (ADC1_CH0)
                                                  │
                                              [10kΩ]
                                                  │
                                                 GND
```

**Wire the LDR on the HIGH side (3V3 → LDR → node) and the fixed resistor to GND.** That
orientation gives the polarity the firmware already expects:

| Water | Light on LDR | LDR resistance | Voltage at GPIO1 |
| --- | --- | --- | --- |
| Clear | high | **low** | **high** → this is `V_CLEAR_MV` |
| Cloudy | low | **high** | **low** → this is `V_CLOUDY_MV` |

So `V_CLEAR_MV > V_CLOUDY_MV`, which is exactly what `toIndex()` and the calibration validator
require — **no firmware change needed**. If you swap the legs (fixed resistor on top, LDR to
GND) the polarity inverts, `span` goes negative, and the firmware will report `SENSOR_FAULT`
forever. Wire it this way round and the problem never arises.

Pick the fixed resistor near your LDR's mid-range resistance for the best sensitivity; 10 kΩ is
a sane starting point for a GL5528. There is **no 5 V anywhere in this path**, so the old
10 kΩ/15 kΩ step-down divider is gone and `DIVIDER_R_TOP`/`DIVIDER_R_BOTTOM` in `config.h` are
unused by the code.

### Drive the LED from GPIO38 (implemented)

`SENSOR_LED_PIN` lights the LED **only while a measurement is taken**, then switches it off.
That removes the largest standing current in the sensor (a real Green AI win) and enables
**ambient-light subtraction**: the firmware reads the LDR dark, switches the LED on, reads it
lit, and uses `lit - dark`. Stray room light cancels out, which is the dominant error source
for an open optical path.

```
GPIO38 ──[150–220Ω]──▶|LED  ── ( water gap ) ──  LDR ──► divider ──► GPIO1
```

> **This changes what you calibrate against.** `V_CLEAR_MV`/`V_CLOUDY_MV` must be the
> **dark-corrected** value the firmware reports, not a raw multimeter reading. Use the
> dashboard calibration wizard, which captures exactly what the firmware sends. See
> CALIBRATION.md.

Set `SENSOR_LED_PIN -1` to keep the LED permanently wired on and skip the subtraction.

## Flow sensor (turbine / DC motor) → GPIO2

GPIO2 is free, safe on the CAM board, and **ADC1-capable**, so it works for either a motor used
as an analog generator or a pulse-output flow sensor. ADC1 matters: ADC2 does not work while
Wi-Fi is on.

**A DC motor used as a generator must be scaled and clamped.** It can exceed 3.3 V when spun
fast and goes *negative* when spun in reverse:

```
motor + ──[10kΩ]──┬──┬──► ESP32-S3 GPIO2
                  │  │
              [10kΩ] └─►|  Schottky to 3V3   (clamps over-voltage)
                  │   ◄|─  Schottky to GND   (clamps negative)
                 GND
motor − ──────────┴──────► ESP32-S3 GND
```

For a 5 V hall-effect flow sensor (e.g. YF-S201) the open-collector pulse output instead needs
a plain divider to 3.3 V, or a pull-up to 3V3 if you run the sensor's output open-drain.

### The flow gate (implemented)

With `FLOW_ADC_PIN` set, the turbine reading gates the whole optical subsystem:

| Turbine reading | Behaviour |
| --- | --- |
| `>= FLOW_TRIGGER_MV` | water is moving → pulse the LED, measure, classify, report |
| `< FLOW_TRIGGER_MV` | idle → LED off, indicators off, null index, `NO_FLOW` heartbeat |

The backend reads `NO_FLOW` as health **IDLE**, which is explicitly *not* a sensor fault and
*not* a clean reading. Both pins default to `-1` (**disabled**), which keeps the original
always-on continuous sampling, so an unwired board still works — set them when the hardware
is physically present.

`FLOW_TRIGGER_MV` must be measured on your own rig: spin the turbine by hand at the slowest
flow you care about and read the serial `flow=` value.

## Indicators

| Signal | Default pin | Meaning |
| --- | --- | --- |
| Green LED | GPIO42 | NORMAL |
| Amber LED | GPIO41 | ELEVATED / RECOVERING |
| Red LED | GPIO40 | ALERT / SENSOR_FAULT |
| Buzzer (optional) | GPIO47 | ALERT alarm (local, network-independent) |
| Rain button (optional) | — (set in config) | manual `storm_active` toggle |

Each LED needs a current-limiting resistor sized for the pin's safe drive current. The
indicators are driven by the **local** state machine, so they work even with Wi-Fi down.

## Pin map summary

| GPIO | Use | Status |
| --- | --- | --- |
| 1 | turbidity substitute (LDR divider), ADC1_CH0 | in firmware |
| 2 | flow sensor (turbine/motor), ADC1_CH1 | in firmware, `FLOW_ADC_PIN` (default -1 = off) |
| 38 | measurement LED drive | in firmware, `SENSOR_LED_PIN` (default -1 = off) |
| 40 / 41 / 42 | red / amber / green indicator LEDs | in firmware |
| 47 | buzzer | in firmware |

> No temperature sensor is fitted, so **GPIO21 is free**. The firmware omits
> `temperature_c` entirely and the dashboard shows "Unavailable" rather than a fabricated 0.

> **Freenove CAM board:** these avoid the OV2640 camera block (GPIO 4–18), flash/PSRAM (33–37),
> native USB (19/20), UART0 serial (43/44), and strapping pins (0/45/46). All are broken out on
> the GPIO extension board.

## Build & flash

```bash
cd firmware
cp include/config.example.h include/config.h   # fill in Wi-Fi, server, pins, calibration
pio run                                         # compile
pio run -t upload                               # flash
pio device monitor                              # serial logs
```

Verified on this hardware: compiles clean, uploads over the CH343 UART bridge, boots, and
streams HARDWARE telemetry over Wi-Fi. See IMPLEMENTATION_STATUS.md.
