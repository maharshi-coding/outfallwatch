# Hardware

> Tabletop demonstration hardware only. **No field-deployment claims.** Keep all
> electronics dry and above water.

## Design as built

OutfallWatch uses a **DIY optical turbidity substitute** (LED + photoresistor) rather than a
commercial turbidity probe. An LED shines through the water sample; a photoresistor (LDR) on
the far side measures how much light survives the crossing. More suspended sediment → less
light → lower voltage at the ADC. This is a **relative** optical measurement and is even
further from certified NTU than a commercial probe — see CALIBRATION.md and LIMITATIONS.md.

```
  Battery/power bank ──► ESP32-S3 ──► LED ─┐
                             ▲             ├─ water gap ─┐
                             │             └─────────────┴──► Photoresistor ──► GPIO1 (ADC)
                             │
                     Turbine/flow sensor
```

## Bill of materials

| Item | Function | Notes |
| --- | --- | --- |
| Freenove ESP32-S3 dev board | controller, ADC, Wi-Fi, local detection | CAM variant **flash-verified** — see FREENOVE_INTEGRATION.md |
| LED (any visible or IR) | light source for the turbidity substitute | mount rigidly; IR rejects room light better |
| Photoresistor / LDR (e.g. GL5528) | light detector | pairs with a fixed resistor as a divider |
| ~150–220 Ω resistor | LED current limit at 3.3 V | size for your LED's forward voltage |
| ~10 kΩ resistor | LDR divider leg | tune to your LDR's mid-range for best sensitivity |
| Turbine / small DC motor **or** flow sensor | water flow rate input | **needs protection** — see WIRING.md |
| DS18B20 waterproof probe | water temperature | optional; code sends `null` when absent |
| 4.7 kΩ resistor | DS18B20 1-Wire pull-up | only if the breakout lacks one |
| 3× LED + current-limiting resistors, optional buzzer | green/amber/red indicator + alarm | local, network-independent |
| USB power bank or 5 V supply | untethered power | **verified working** without a cable to the host |
| Breadboard, jumpers, opaque enclosure/tube | build + light shielding | shielding is not optional (see below) |
| Transparent containers, clean water + a little clay/soil | storm-outlet mock | **no hazardous/unknown water** |

**Optional:** brackish-appropriate conductivity probe, rain button, SD logging, a real power
meter (for measured rather than estimated energy, see GREEN_AI.md).

## Electrical safety

- **No 5 V analog path any more.** The LED/LDR sensor runs entirely at **3.3 V**, so GPIO1 can
  never exceed the ADC's safe range and the old 10 kΩ/15 kΩ step-down divider is unnecessary.
- **A DC motor used as a generator is the one real hazard in this build.** Spun fast it can
  output well above 3.3 V, and spun *backwards* it outputs a **negative** voltage, which an
  ESP32 GPIO cannot tolerate. It must be scaled and clamped before touching a pin — WIRING.md.
- A commercial hall-effect flow sensor (e.g. YF-S201) is usually a **5 V** part with 5 V pulse
  output; that output also needs dividing down to 3.3 V.
- Only designated waterproof sections touch water. Board, breadboard, and connectors stay dry.
- No mains-powered pumps, no dangerous chemicals.

## Light shielding is the dominant practical factor

An LED/LDR pair measures *light*, and room light, a phone torch, or someone's shadow will swamp
the signal far more than the sediment does. The optical path must be **light-tight** — run it
inside an opaque tube or box, and keep the LED–LDR spacing mechanically fixed. Any change in
geometry invalidates the calibration, so calibrate *after* the rig is physically final.

## Power

A **USB power bank is the proven path** and is what the untethered run was verified on. Note
that many power banks cut out when current draw is low enough that they read it as "nothing
plugged in" — test yours for several minutes before relying on it.

Never feed a bare Li-ion cell (up to 4.2 V) into the 3V3 pin. Use a 5 V boost/charger board
into the board's 5 V input instead.

## Tabletop demo setup

1. Build the optical rig per WIRING.md, inside its light shield, with fixed geometry.
2. Calibrate against clear water and a lightly-clouded reference (CALIBRATION.md).
3. Place the rig in a clear container; stir in a pinch of clay to simulate a runoff plume and
   watch the index rise, the amber/red LED light, and the dashboard alert.

If no board/sensor is available, the **offline simulator** reproduces the full experience.
