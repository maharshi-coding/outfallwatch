export type Source = "HARDWARE" | "SIMULATION" | "IMPORTED_OFFICIAL" | "TEST_FIXTURE";
export type MonState = "NORMAL" | "ELEVATED" | "ALERT" | "RECOVERING";
export type IntStatus = "WORKING" | "PARTIAL" | "UNAVAILABLE" | "NOT_IMPLEMENTED";

export interface Device {
  device_id: string;
  name: string;
  source: Source;
  location_label: string;
  latitude: number | null;
  longitude: number | null;
  coordinates_verified: boolean;
  mode: MonState;
  connection_status: string;
  last_seen: string | null;
  firmware: string;
  stale?: boolean;
}

export interface ReadingPoint {
  observed_at: string;
  turbidity_index: number | null;
  turbidity_raw_mv: number | null;
  temperature_c: number | null;
  conductivity_us_cm: number | null;
  mode: MonState;
  storm_active: boolean;
  quality_flags: string[];
}

export interface MonitoringEvent {
  event_id: string;
  device_id: string;
  source: Source;
  severity: "ELEVATED" | "ALERT";
  state: "ACTIVE" | "ACKNOWLEDGED" | "RESOLVED";
  started_at: string;
  updated_at: string;
  resolved_at: string | null;
  explanation: string;
  recommendation: string;
  acknowledged: boolean;
  reading_ids: string[];
}

export interface SimStatus {
  running: boolean;
  scenario: string;
  intensity: number;
  speed: number;
  virtual_t: number;
  length_s: number;
  started_at: string | null;
  device_id: string;
}

export interface IntegrationProvider {
  provider: string;
  enabled: boolean;
  status: IntStatus;
  capabilities: string[];
  last_attempted: string | null;
  last_succeeded: string | null;
  latest_observation_at: string | null;
  last_error: string | null;
}

export interface ExternalObservation {
  provider: string;
  station_or_dataset: string;
  parameter: string;
  value_numeric: number | null;
  value_text: string | null;
  unit: string | null;
  observed_at: string | null;
  ingested_at: string;
  quality_flags: string[];
  source_url: string | null;
  source_id: string | null;
  data_kind: Source;
}

export interface EnergyStrategy {
  strategy: string;
  samples: number;
  messages: number;
  bytes_tx: number;
  processing_ms: number;
  alert_latency_seconds: number | null;
  missed_anomalies: number;
  energy_mwh_estimated: number;
  energy_kind: string;
}

export interface EnergyCompare {
  scenario: string;
  seed: number;
  intensity: number;
  true_anomaly_onset_s: number | null;
  fixed: EnergyStrategy;
  adaptive: EnergyStrategy;
  reductions_pct: { messages: number; bytes: number; energy_estimated: number };
  energy_model: {
    kind: string;
    formula: string;
    constants_mwh: Record<string, number>;
    assumptions: string[];
    disclaimer: string;
  };
}
