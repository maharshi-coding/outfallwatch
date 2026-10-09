# Freenove ESP32-S3 integration

Organizer-linked kit repo: <https://github.com/Freenove/Freenove_Ultimate_Starter_Kit>
(also relevant: Freenove's ESP32-S3 board-specific repos — confirm which matches your
exact board).

## Verification status — BE HONEST

| Item | Status | Notes |
| --- | --- | --- |
| Exact board variant | **VERIFIED (from photo)** | **Freenove ESP32-S3-WROOM CAM** (ESP32-S3-WROOM-1 module, OV2640 camera, dual USB-C). Firmware target `esp32-s3-devkitc-1` is module-compatible and compiles clean. |
| GPIO pin map | **RECONCILED** | `config.example.h` pins moved off the camera block (see below). |
| Camera pin conflict | **⚠️ CRITICAL** | The OV2640 hard-wires GPIO 4,5,6,7,8,9,10,11,12,13,15,16,17,18. Do **not** use these for sensors/LEDs even though the firmware never starts the camera. |
| ADC pin / attenuation | **OK** | `GPIO1` = ADC1_CH0, free on this board, `ADC_11db`. |
| Turbidity sensor in kit | **NOT ASSUMED** | SEN0189-class turbidity probes are typically a separate purchase. |
| DS18B20 in kit | **CHECK** | Some Freenove kits include it; verify. |
| LEDs / resistors / breadboard | **LIKELY PRESENT** | Standard starter-kit parts; still verify. |
| Compilation | **VERIFIED** | Compiles clean for `esp32-s3-devkitc-1` via PlatformIO — zero warnings/errors, `firmware.bin` 874 KB (RAM 14.7%, Flash 26.8%). Change `board` for your exact variant. |
| Flash / on-water test | **NOT PERFORMED** | Requires hardware. |

## Before you flash

1. Identify your exact board (silkscreen / Freenove order). Set `board` in `platformio.ini`.
2. Open the matching Freenove schematic/pinout; reconcile every pin in `config.h` with it,
   especially an **ADC1-capable** GPIO for turbidity (ADC2 is unusable while Wi-Fi is on).
3. Confirm the ADC attenuation / full-scale range for your board; adjust
   `analogSetPinAttenuation` if needed.
4. Wire per WIRING.md and **measure voltages with a multimeter** before connecting the ADC.
5. `cp include/config.example.h include/config.h`, fill in credentials/pins/calibration,
   then `pio run` / `pio run -t upload`.

## Examples to cross-reference in the Freenove repo

- ADC / analog read example → confirm your ADC API + pin.
- DS18B20 / OneWire example → confirm wiring + library.
- Wi-Fi station + HTTP example → confirm core version and `WiFi`/`HTTPClient` usage.

Record here, after you verify on real hardware, which components and pins you **confirmed**
versus assumed. Do not mark anything verified from source inspection alone.
