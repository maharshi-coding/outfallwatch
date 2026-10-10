import type {
  CodeCarbonResult,
  Device,
  EnergyCompare,
  ExternalObservation,
  IntegrationProvider,
  MonitoringEvent,
  ReadingPoint,
  SimStatus,
} from "../types";

const BASE = "/api";

async function j<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${BASE}${path}`, {
    headers: { "content-type": "application/json" },
    ...init,
  });
  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(`${res.status} ${res.statusText}: ${body}`);
  }
  return res.json() as Promise<T>;
}

export interface Overview {
  devices: (Device & { stale: boolean })[];
  active_alerts: MonitoringEvent[];
  recent_events: MonitoringEvent[];
  simulation: SimStatus;
  green_ai_latest: { strategy: string; messages: number; bytes_tx: number; energy_mwh_estimated: number; energy_kind: string }[];
}

export const api = {
  health: () => j<{ status: string }>("/health"),
  overview: () => j<Overview>("/monitoring/overview"),
  devices: () => j<Device[]>("/devices"),
  timeseries: (deviceId: string, minutes = 60) =>
    j<{ device_id: string; points: ReadingPoint[] }>(
      `/monitoring/timeseries?device_id=${encodeURIComponent(deviceId)}&minutes=${minutes}`,
    ),
  alerts: () => j<MonitoringEvent[]>("/alerts"),
  acknowledge: (id: string) => j<MonitoringEvent>(`/alerts/${id}/acknowledge`, { method: "POST" }),
  simStatus: () => j<SimStatus>("/simulation/status"),
  simStart: (scenario: string, intensity: number, speed: number) =>
    j<SimStatus>("/simulation/start", {
      method: "POST",
      body: JSON.stringify({ scenario, intensity, speed }),
    }),
  simStop: () => j<SimStatus>("/simulation/stop", { method: "POST" }),
  simReset: () => j<SimStatus>("/simulation/reset", { method: "POST" }),
  integrations: () => j<{ providers: IntegrationProvider[] }>("/integrations/status"),
  refreshIntegrations: () => j<{ providers: IntegrationProvider[] }>("/integrations/refresh", { method: "POST" }),
  externalObservations: (provider?: string) =>
    j<ExternalObservation[]>(`/external-observations${provider ? `?provider=${provider}` : ""}`),
  energyCompare: (scenario: string, seed = 42, intensity = 1.0) =>
    j<EnergyCompare>("/energy/compare", {
      method: "POST",
      body: JSON.stringify({ scenario, seed, intensity }),
    }),
  codecarbon: () => j<CodeCarbonResult>("/energy/codecarbon"),
  configuration: () => j<Record<string, number>>("/configuration"),
  patchConfiguration: (patch: Record<string, number>) =>
    j<Record<string, number>>("/configuration", { method: "PATCH", body: JSON.stringify(patch) }),
  createCalibration: (device_id: string, v_clear_mv: number, v_cloudy_mv: number) =>
    j<{ calibration_id: string }>("/calibrations", {
      method: "POST",
      body: JSON.stringify({ device_id, v_clear_mv, v_cloudy_mv }),
    }),
};

export type StreamEvent = {
  type: string;
  ts?: string;
  data?: Record<string, unknown>;
};

/** Subscribe to the backend SSE stream. Returns an unsubscribe fn. */
export function subscribeEvents(onEvent: (e: StreamEvent) => void, onState?: (connected: boolean) => void): () => void {
  const es = new EventSource(`${BASE}/events/stream`);
  es.onopen = () => onState?.(true);
  es.onerror = () => onState?.(false);
  es.onmessage = (msg) => {
    try {
      onEvent(JSON.parse(msg.data) as StreamEvent);
    } catch {
      /* ignore malformed frames */
    }
  };
  return () => es.close();
}
