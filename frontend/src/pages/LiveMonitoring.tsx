import { api } from "@/services/api";
import { useAsync } from "@/hooks/useAsync";
import { Panel, Stat, StateBadge, SourceBadge, Empty } from "@/components/common/ui";
import { DeviceSelector, useSelectedDevice } from "@/components/common/DeviceSelector";
import { TelemetryChart } from "@/components/charts/TelemetryChart";
import { Gauge } from "@/components/charts/Gauge";

// Plain-language labels for the flow-gated optical subsystem's verdict. "Clear" is
// deliberately not claimed for an empty gap or a dry sensor.
const WATER_LABEL: Record<string, string> = {
  CLEAN: "Clear \u2014 low light attenuation",
  MURKY: "Murky \u2014 high light attenuation",
  AIR_GAP: "No water in gap (air) \u2014 not a water reading",
  NO_FLOW: "No flow \u2014 subsystem idle, nothing measured",
};

export function LiveMonitoring() {
  const { effectiveId, device, lastReading: last } = useSelectedDevice();
  const series = useAsync(() => api.timeseries(effectiveId, 180), { pollMs: 2500, deps: [effectiveId] });
  const points = series.data?.points ?? [];
  const latest = points[points.length - 1];

  const index = last?.turbidity_index ?? latest?.turbidity_index ?? null;
  const raw = latest?.turbidity_raw_mv ?? null;
  const temp = last?.temperature_c ?? latest?.temperature_c ?? null;
  const cond = last?.conductivity_us_cm ?? latest?.conductivity_us_cm ?? null;
  const mode = last?.mode ?? latest?.mode ?? "NORMAL";
  const health = last?.health ?? "OK";
  const flags = latest?.quality_flags ?? [];
  // Water condition reported by the flow-gated optical subsystem. AIR_GAP and NO_FLOW
  // are deliberately NOT "clean" — an empty gap passes more light than clean water.
  const water = flags.find((f) => ["CLEAN", "MURKY", "AIR_GAP", "NO_FLOW"].includes(f)) ?? null;

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="font-display text-2xl font-bold">Live Sensor Monitoring</h1>
          <p className="flex items-center gap-2 text-sm text-mist/50">
            {effectiveId} {device && <SourceBadge source={device.source} />}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <DeviceSelector />
          <StateBadge state={mode} />
          {health === "SENSOR_FAULT" && <StateBadge state="SENSOR_FAULT" />}
          {health === "IDLE" && <StateBadge state="IDLE" />}
          {water && <StateBadge state={water} />}
        </div>
      </div>

      <div className="grid gap-5 lg:grid-cols-[1fr_320px]">
        <Panel title="Turbidity index &amp; water temperature">
          {points.length ? <TelemetryChart points={points} baseline={last?.baseline ?? null} height={340} /> : <Empty>No readings yet — start a simulation.</Empty>}
        </Panel>
        <Panel title="Index gauge">
          <Gauge value={index} state={mode} height={220} />
          <div className="mt-2 grid grid-cols-2 gap-3">
            <Stat label="Raw analog" value={raw} unit="mV" decimals={0} hint="reconstructed" />
            <Stat label="Baseline" value={last?.baseline ?? null} unit="/100" />
          </div>
        </Panel>
      </div>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Stat label="Relative index" value={index} unit="/100" decimals={1} hint="not NTU" tone={mode === "ALERT" ? "coral" : mode === "ELEVATED" ? "amber" : "teal"} />
        <Stat label="Water temp (DS18B20)" value={temp} unit={temp != null ? "°C" : ""} decimals={1} hint={temp == null ? "Unavailable" : undefined} />
        <Stat label="Conductivity" value={cond} unit={cond != null ? "µS/cm" : ""} decimals={0} hint={cond == null ? "Unavailable · optional" : undefined} />
        <Stat label="Sensor health" value={health} tone={health === "SENSOR_FAULT" ? "coral" : "default"} animate={false} />
      </div>

      <div className="grid gap-5 sm:grid-cols-2">
        <Panel title="Sample metadata">
          <dl className="space-y-2 text-sm">
            <Row k="Last observation" v={latest ? new Date(latest.observed_at).toLocaleString() : "—"} />
            <Row k="Sampling" v="adaptive (10 s normal / 2 s event)" />
            <Row k="Sensor health" v={health} />
            <Row k="Water condition" v={water ? WATER_LABEL[water] : "\u2014"} />
            <Row k="Captured at" v={latest ? new Date(latest.observed_at).toLocaleTimeString() : "\u2014"} />
            <Row k="Quality flags" v={flags.length ? flags.join(", ") : "none"} />
          </dl>
        </Panel>
        <Panel title="Reading the numbers">
          <ul className="list-disc space-y-1.5 pl-5 text-sm text-mist/60">
            <li>The index is a <span className="text-cyan">0–100 relative demonstration value</span>, two-point calibrated — not a certified NTU measurement.</li>
            <li>Missing optional sensors read <span className="text-mist">Unavailable</span>, never a fabricated 0.</li>
            <li>A sensor fault is flagged distinctly from a healthy NORMAL state.</li>
          </ul>
        </Panel>
      </div>
    </div>
  );
}

function Row({ k, v }: { k: string; v: string }) {
  return (
    <div className="flex justify-between gap-4 border-b border-white/5 pb-1">
      <dt className="text-mist/50">{k}</dt>
      <dd className="text-right stat-num">{v}</dd>
    </div>
  );
}
