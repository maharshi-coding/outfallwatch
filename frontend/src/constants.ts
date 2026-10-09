export const SIM_DEVICE = "outfallwatch-sim-01";

export const SCENARIOS: { id: string; label: string; expect: string }[] = [
  { id: "A", label: "A · Normal", expect: "Stays NORMAL, no alert." },
  { id: "B", label: "B · Sediment runoff", expect: "ELEVATED → ALERT, one event." },
  { id: "C", label: "C · Transient spike", expect: "Brief spike suppressed, no alert." },
  { id: "D", label: "D · Recovery", expect: "Alert then RECOVERING → NORMAL resolve." },
  { id: "E", label: "E · Sensor disconnect", expect: "SENSOR_FAULT, no invented value." },
  { id: "F", label: "F · Network interruption", expect: "Dashboard goes stale; local logic intact." },
];
