import { lazy, Suspense, useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { motion } from "motion/react";
import { Activity, Leaf, MapPin, Radio, Thermometer, Waves } from "lucide-react";
import { api } from "@/services/api";
import { useAsync } from "@/hooks/useAsync";
import { useLive } from "@/stores/useLive";
import { Panel, Stat, StateBadge, SourceBadge, Empty } from "@/components/common/ui";
import { DeviceSelector, useSelectedDevice } from "@/components/common/DeviceSelector";
import { Button } from "@/components/ui/button";
import { TelemetryChart } from "@/components/charts/TelemetryChart";
import { Gauge } from "@/components/charts/Gauge";

// MapLibre is ~290 KB gzip — stream it in after the hero paints.
const MapLibreMap = lazy(() => import("@/components/map/MapLibreMap").then((m) => ({ default: m.MapLibreMap })));

const HEADLINE: Record<string, string> = {
  NORMAL: "Conditions nominal",
  ELEVATED: "Monitoring concern developing",
  ALERT: "Elevated turbidity — investigate the site",
  RECOVERING: "Conditions recovering toward baseline",
};

export function Overview() {
  const nav = useNavigate();
  const { alertTick, readings } = useLive();
  const { effectiveId, lastReading: last } = useSelectedDevice();
  const overview = useAsync(() => api.overview(), { pollMs: 4000, deps: [alertTick] });
  const series = useAsync(() => api.timeseries(effectiveId, 120), { pollMs: 2500, deps: [effectiveId] });
  const [starting, setStarting] = useState(false);

  const device = overview.data?.devices.find((d) => d.device_id === effectiveId) ?? overview.data?.devices[0];
  const points = series.data?.points ?? [];
  const latestPoint = points[points.length - 1];

  const mode = last?.mode ?? device?.mode ?? "NORMAL";
  const baseline = last?.baseline ?? null;
  const turbidity = last?.turbidity_index ?? latestPoint?.turbidity_index ?? null;
  const temp = last?.temperature_c ?? latestPoint?.temperature_c ?? null;
  const activeAlerts = overview.data?.active_alerts ?? [];
  const green = overview.data?.green_ai_latest ?? [];

  useEffect(() => {
    if (readings.length) series.refresh();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [alertTick]);

  async function launchDemo() {
    setStarting(true);
    try {
      await api.simStart("B", 1.0, 6);
    } finally {
      setStarting(false);
    }
  }

  const tone = mode === "ALERT" ? "coral" : mode === "ELEVATED" ? "amber" : "teal";

  return (
    <div className="space-y-5">
      {/* hero */}
      <section className="panel relative overflow-hidden p-5 sm:p-6">
        <div className="techgrid pointer-events-none absolute inset-0 opacity-40" />
        <div className="pointer-events-none absolute -right-20 -top-24 h-72 w-72 rounded-full bg-teal/10 blur-3xl" />
        <div className="relative grid gap-6 lg:grid-cols-[1fr_auto]">
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <StateBadge state={mode} />
              {device && <SourceBadge source={device.source} />}
              {device?.stale && <StateBadge state="STALE" />}
            </div>
            <motion.h1
              key={mode}
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              className="mt-3 font-display text-3xl font-bold tracking-tight sm:text-4xl"
            >
              {HEADLINE[mode] ?? "Monitoring"}
            </motion.h1>
            <p className="mt-1 max-w-xl text-sm text-mist/60">
              {device?.location_label ?? "Simulated Corpus Christi Outfall — Demo Site"} ·{" "}
              {last ? "updated just now (live)" : latestPoint ? `last point ${new Date(latestPoint.observed_at).toLocaleTimeString()}` : "awaiting telemetry"}
            </p>

            <div className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-4">
              <Stat label="Turbidity index" value={turbidity} unit="/100" tone={tone} decimals={0} hint="0–100 relative · not NTU" />
              <Stat label="Baseline" value={baseline} unit="/100" hint="learned, frozen in event" />
              <Stat label="Water temp" value={temp} unit={temp != null ? "°C" : ""} decimals={1} hint={temp == null ? "unavailable" : undefined} />
              <Stat label="Active alerts" value={activeAlerts.length} tone={activeAlerts.length ? "coral" : "default"} />
            </div>

            <div className="mt-5 flex flex-wrap items-center gap-2">
              <Button variant="primary" size="lg" onClick={launchDemo} disabled={starting}>
                <Waves size={18} /> {starting ? "Starting…" : "Launch Storm Demo"}
              </Button>
              <Button variant="ghost" onClick={() => nav("/simulator")}>Open Simulator Studio →</Button>
              <DeviceSelector className="ml-auto" />
            </div>
          </div>

          <div className="flex flex-col items-center justify-center rounded-2xl border border-white/10 bg-navy/40 p-2">
            <Gauge value={turbidity} state={mode} height={200} />
            <div className="pb-2 text-[11px] uppercase tracking-wide text-mist/40">relative turbidity index</div>
          </div>
        </div>
      </section>

      <div className="grid gap-5 lg:grid-cols-3">
        <Panel icon={<Activity size={14} />} title="Turbidity &amp; temperature trend" className="lg:col-span-2">
          {points.length ? <TelemetryChart points={points} baseline={baseline} /> : <Empty>Launch the storm demo to see live telemetry.</Empty>}
        </Panel>
        <Panel icon={<MapPin size={14} />} title="Monitoring site">
          <Suspense fallback={<div className="h-[240px] animate-pulse rounded-xl border border-white/10 bg-navy/40" />}>
            <MapLibreMap device={device} height={240} />
          </Suspense>
          <div className="mt-3 grid grid-cols-2 gap-2 text-xs">
            <div className="flex items-center gap-2 text-mist/60"><Radio size={13} /> {device?.connection_status ?? "—"}</div>
            <div className="flex items-center gap-2 text-mist/60"><Thermometer size={13} /> {device?.firmware ?? "n/a"}</div>
          </div>
        </Panel>
      </div>

      <div className="grid gap-5 lg:grid-cols-3">
        <Panel icon={<Activity size={14} />} title="Active alert" className="lg:col-span-2">
          {activeAlerts.length ? (
            <div className="space-y-2">
              {activeAlerts.map((a) => (
                <motion.div key={a.event_id} initial={{ opacity: 0, x: -8 }} animate={{ opacity: 1, x: 0 }}
                  className="rounded-xl border border-coral/30 bg-coral/5 p-3">
                  <div className="flex items-center gap-2"><StateBadge state={a.severity} /><SourceBadge source={a.source} /></div>
                  <p className="mt-2 text-sm text-mist/80">{a.explanation}</p>
                </motion.div>
              ))}
            </div>
          ) : <Empty>No active alerts. The system is watching for sustained change.</Empty>}
        </Panel>
        <Panel icon={<Leaf size={14} />} title="Green AI (latest run)">
          {green.length ? (
            <div className="space-y-2">
              {green.map((g) => (
                <div key={g.strategy} className="flex items-center justify-between rounded-lg border border-white/10 px-3 py-2 text-sm">
                  <span className="capitalize text-mist/70">{g.strategy}</span>
                  <span className="stat-num">{g.messages} msgs · {g.energy_mwh_estimated} mWh <span className="text-[10px] text-mist/40">EST</span></span>
                </div>
              ))}
            </div>
          ) : <Empty>Run a comparison in the Green AI Lab.</Empty>}
        </Panel>
      </div>
    </div>
  );
}
