# Hardware

> Tabletop demonstration hardware only. **No field-deployment claims.** Keep all
> electronics dry and above water; USB-power the board.

## Bill of materials

| Item | Function | Notes |
| --- | --- | --- |
| Freenove ESP32-S3 dev board | controller, ADC, Wi-Fi, local detection | **verify exact variant** — see FREENOVE_INTEGRATION.md |
| DFRobot SEN0189 (or equiv.) turbidity module | relative sediment/cloudiness | likely a separate purchase; not assumed in the kit |
| DS18B20 waterproof probe | water temperature | optional; code supports absence |
| 10 kΩ + 15 kΩ resistors | analog voltage divider | confirm values with a meter |
| 4.7 kΩ resistor | DS18B20 1-Wire pull-up | only if the breakout lacks one |
| 3× LED + current-limiting resistors, optional buzzer | green/amber/red indicator + alarm | confirm safe drive current per pin |
| Breadboard, jumpers, USB cable, computer | build + runtime | — |
| Transparent containers, funnel/tube, clean water + a little clay/soil | storm-outlet mock | **no hazardous/unknown water** |

**Optional:** brackish-appropriate conductivity probe, rain button, SD logging, enclosure,
battery + a real power meter (for measured energy, see GREEN_AI.md).

## Electrical safety

- The SEN0189 runs at **5 V** and its analog output can approach **4.5 V**. **Never** wire a
  5 V analog output straight to an ESP32-S3 ADC pin — use the divider (WIRING.md) and
  **measure with a multimeter before connecting**.
- Only the designated waterproof probe sections touch water. The board, breadboard, and
  connectors stay dry.
- No mains-powered pumps, no dangerous chemicals.

## Tabletop demo setup

1. Build the circuit per WIRING.md; verify voltages with a meter.
2. Calibrate against clear water and a lightly-clouded reference (CALIBRATION.md).
3. Place the probe in a clear container; stir in a pinch of clay to simulate a runoff
   plume and watch the index rise, the amber/red LED light, and the dashboard alert.

If no board/sensor is available, the **offline simulator** reproduces the full experience.
