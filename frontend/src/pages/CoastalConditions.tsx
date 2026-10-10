import { useMemo, useState } from "react";
import type { EChartsCoreOption } from "echarts/core";
import { motion } from "motion/react";
import {
  ArrowUpDown, ChevronDown, Clock, Droplets, Leaf, MapPin, RefreshCw,
  Thermometer, TrendingDown, TrendingUp, Waves, Wind,
} from "lucide-react";
import { api } from "@/services/api";
import { useAsync } from "@/hooks/useAsync";
import { Panel, SourceBadge, Empty, IntegrationBadge } from "@/components/common/ui";
import { AnimatedNumber } from "@/components/common/AnimatedNumber";
import { Button } from "@/components/ui/button";
import { EChart, OCEAN } from "@/components/charts/EChart";
import type { ExternalObservation, IntStatus } from "@/types";

export function CoastalConditions() {
  const obs = useAsync(() => api.externalObservations(), { pollMs: 0 });
  const ints = useAsync(() => api.integrations(), { pollMs: 0 });
  const [refreshing, setRefreshing] = useState(false);

  const byProvider = (obs.data ?? []).reduce<Record<string, ExternalObservation[]>>((acc, o) => {
    (acc[o.provider] ??= []).push(o);
    return acc;
  }, {});
  const statusOf = (p: string): IntStatus => ints.data?.providers.find((x) => x.provider === p)?.status ?? "UNAVAILABLE";

  async function refresh() {
    setRefreshing(true);
    try {
      await api.refreshIntegrations();
      await Promise.all([obs.refresh(), ints.refresh()]);
    } finally {
      setRefreshing(false);
    }
  }

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="font-display text-2xl font-bold">Official Coastal Conditions</h1>
          <p className="text-sm text-mist/50">
            Live NOAA &amp; GCOOS observations — source, time and units preserved, kept
            <b> separate</b> from the prototype's own sensor.
          </p>
        </div>
        <Button variant="ghost" size="sm" onClick={refresh} disabled={refreshing}>
          <RefreshCw size={13} className={refreshing ? "animate-spin" : ""} /> {refreshing ? "Fetching…" : "Refresh live data"}
        </Button>
      </div>

      <NoaaPanel rows={byProvider["NOAA"] ?? []} status={statusOf("NOAA")} />
      <GcoosPanel rows={byProvider["GCOOS"] ?? []} status={statusOf("GCOOS")} />

      <p className="text-xs text-mist/40">
        Official data is regional <b>context</b> — not a measurement of the demo outfall, and never shown as a live
        prototype sensor value.
      </p>
    </div>
  );
}

// ------------------------------------------------------------------ NOAA (tide chart)
function NoaaPanel({ rows, status }: { rows: ExternalObservation[]; status: IntStatus }) {
  const series = useMemo(() => {
    const pts = rows
      .filter((r) => r.value_numeric != null && r.observed_at)
      .map((r) => ({ t: new Date(r.observed_at!).getTime(), v: r.value_numeric as number }))
      .sort((a, b) => a.t - b.t);
    // de-dupe identical timestamps (real-time point can overlap the newest historical point)
    const seen = new Set<number>();
    return pts.filter((p) => (seen.has(p.t) ? false : (seen.add(p.t), true)));
  }, [rows]);

  const current = series[series.length - 1]?.v ?? null;
  const prev = series[series.length - 2]?.v ?? null;
  const rising = current != null && prev != null ? current >= prev : null;
  const unit = rows[0]?.unit ?? "ft";
  const station = rows[0]?.station_or_dataset?.split(" · ")[0] ?? "NOAA station";
  const observedAt = series.length ? new Date(series[series.length - 1].t) : null;

  const option = useMemo<EChartsCoreOption>(() => ({
    backgroundColor: "transparent",
    grid: { top: 14, right: 14, bottom: 24, left: 40 },
    tooltip: { trigger: "axis", backgroundColor: OCEAN.tooltipBg, borderColor: "rgba(255,255,255,0.12)",
      textStyle: { color: "#e8f1f5", fontSize: 12 },
      formatter: (p: any) => `${p[0].axisValueLabel}<br/>${p[0].data[1].toFixed(2)} ${unit}` },
    xAxis: { type: "time", axisLine: { lineStyle: { color: OCEAN.grid } },
      axisLabel: { color: OCEAN.axis, fontSize: 11, hideOverlap: true } },
    yAxis: { type: "value", scale: true, name: unit, nameTextStyle: { color: OCEAN.axis, fontSize: 10 },
      splitLine: { lineStyle: { color: OCEAN.grid } }, axisLabel: { color: OCEAN.axis, fontSize: 11 } },
    series: [{
      type: "line", smooth: true, symbol: "none", data: series.map((p) => [p.t, p.v]),
      lineStyle: { width: 2.5, color: OCEAN.cyan },
      areaStyle: { color: { type: "linear", x: 0, y: 0, x2: 0, y2: 1, colorStops: [
        { offset: 0, color: "rgba(94,220,229,0.35)" }, { offset: 1, color: "rgba(94,220,229,0)" }] } },
      markPoint: series.length ? { symbol: "circle", symbolSize: 8, data: [{ coord: [series[series.length - 1].t, series[series.length - 1].v], itemStyle: { color: OCEAN.cyan } }] } : undefined,
    }],
    animationDuration: 500,
  }), [series, unit, current]);

  return (
    <Panel title={<span className="flex items-center gap-2">NOAA Tides &amp; Currents — Water Levels <IntegrationBadge status={status} /></span>}>
      {series.length ? (
        <div className="grid gap-4 lg:grid-cols-[220px_1fr]">
          <div className="flex flex-col justify-center rounded-xl border border-white/10 bg-navy/40 p-4">
            <div className="text-[11px] uppercase tracking-wide text-mist/50">Current water level</div>
            <div className="mt-1 flex items-baseline gap-2">
              <AnimatedNumber value={current} decimals={2} className="stat-num text-4xl font-bold text-cyan" />
              <span className="text-sm text-mist/50">{unit}</span>
            </div>
            {rising != null && (
              <div className={`mt-1 flex items-center gap-1 text-xs ${rising ? "text-teal" : "text-amber"}`}>
                {rising ? <TrendingUp size={13} /> : <TrendingDown size={13} />} {rising ? "rising" : "falling"}
              </div>
            )}
            <div className="mt-3 space-y-1 text-[11px] text-mist/40">
              <div className="flex items-center gap-1"><MapPin size={11} /> {station}</div>
              <div className="flex items-center gap-1"><Clock size={11} /> {observedAt?.toLocaleString() ?? "—"}</div>
              <SourceBadge source={rows[0]?.data_kind ?? "IMPORTED_OFFICIAL"} />
            </div>
          </div>
          <div className="rounded-xl border border-white/10 bg-navy/30 p-2">
            <EChart option={option} height={240} />
            <div className="px-2 pb-1 text-[11px] text-mist/40">Real-time + last 24 h (hourly). {rows[0]?.source_url && (
              <a href={rows[0].source_url} target="_blank" rel="noreferrer" className="text-cyan/70 underline">source ↗</a>)}</div>
          </div>
        </div>
      ) : (
        <Empty>{status === "UNAVAILABLE" ? "NOAA not integrated — see Data Sources." : "No water-level data loaded — hit Refresh."}</Empty>
      )}
      <RawTable rows={rows} />
    </Panel>
  );
}

// ------------------------------------------------------------------ GCOOS (metric cards)
const GCOOS_META: Record<string, { label: string; Icon: typeof Thermometer; accent: string; ring: string }> = {
  water_temperature: { label: "Water Temp", Icon: Thermometer, accent: "text-amber", ring: "ring-amber/25" },
  salinity: { label: "Salinity", Icon: Droplets, accent: "text-cyan", ring: "ring-cyan/25" },
  dissolved_oxygen: { label: "Dissolved O₂", Icon: Wind, accent: "text-teal", ring: "ring-teal/25" },
  chlorophyll: { label: "Chlorophyll", Icon: Leaf, accent: "text-green-400", ring: "ring-green-400/25" },
  turbidity: { label: "Turbidity", Icon: Waves, accent: "text-amber", ring: "ring-amber/25" },
  water_level: { label: "Water Level", Icon: ArrowUpDown, accent: "text-cyan", ring: "ring-cyan/25" },
};

function GcoosPanel({ rows, status }: { rows: ExternalObservation[]; status: IntStatus }) {
  const station = rows[0]?.station_or_dataset ?? "GCOOS station";
  return (
    <Panel title={<span className="flex items-center gap-2">GCOOS — Oceanographic &amp; Water Quality <IntegrationBadge status={status} /></span>}>
      {rows.length ? (
        <>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
            {rows.map((o, i) => {
              const meta = GCOOS_META[o.parameter] ?? { label: o.parameter, Icon: Waves, accent: "text-mist", ring: "ring-white/10" };
              return (
                <motion.div key={i} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.05 }}
                  className={`group relative overflow-hidden rounded-xl border border-white/10 bg-navy/40 p-3 ring-1 ${meta.ring} transition hover:border-white/20`}>
                  <div className="absolute -right-5 -top-5 h-16 w-16 rounded-full bg-white/[0.03] blur-xl" />
                  <div className="flex items-center justify-between">
                    <span className="text-[11px] uppercase tracking-wide text-mist/50">{meta.label}</span>
                    <meta.Icon size={15} className={meta.accent} />
                  </div>
                  <div className={`mt-1 text-2xl font-bold stat-num ${meta.accent}`}>
                    <AnimatedNumber value={o.value_numeric} decimals={1} />
                    <span className="ml-1 text-xs font-medium text-mist/40">{o.unit}</span>
                  </div>
                  <div className="mt-1 flex items-center gap-1 text-[10px] text-mist/35">
                    <Clock size={10} /> {o.observed_at ? new Date(o.observed_at).toLocaleDateString() : "—"}
                    <span className="ml-auto"><SourceBadge source={o.data_kind} /></span>
                  </div>
                </motion.div>
              );
            })}
          </div>
          <div className="mt-3 flex items-center gap-2 text-[11px] text-mist/40">
            <MapPin size={11} /> {station}
            {rows[0]?.source_url && <a href={rows[0].source_url} target="_blank" rel="noreferrer" className="text-cyan/70 underline">source ↗</a>}
          </div>
        </>
      ) : (
        <Empty>{status === "UNAVAILABLE" ? "GCOOS not integrated — see Data Sources." : "No GCOOS metrics loaded — hit Refresh."}</Empty>
      )}
      <RawTable rows={rows} />
    </Panel>
  );
}

// ------------------------------------------------------------------ collapsible provenance
function RawTable({ rows }: { rows: ExternalObservation[] }) {
  const [open, setOpen] = useState(false);
  if (!rows.length) return null;
  return (
    <div className="mt-3 border-t border-white/5 pt-2">
      <button onClick={() => setOpen((o) => !o)} className="flex items-center gap-1 text-xs text-mist/50 hover:text-mist">
        <ChevronDown size={13} className={`transition ${open ? "rotate-180" : ""}`} /> {open ? "Hide" : "Show"} raw observations ({rows.length})
      </button>
      {open && (
        <div className="mt-2 max-h-56 overflow-auto rounded-lg border border-white/10">
          <table className="w-full text-left text-xs">
            <thead className="sticky top-0 bg-marine/60 text-[10px] uppercase text-mist/40">
              <tr><th className="p-1.5">Parameter</th><th className="p-1.5">Value</th><th className="p-1.5">Observed</th><th className="p-1.5">Label</th></tr>
            </thead>
            <tbody>
              {rows.map((o, i) => (
                <tr key={i} className="border-t border-white/5">
                  <td className="p-1.5 text-mist/70">{o.parameter}</td>
                  <td className="p-1.5 stat-num">{o.value_numeric ?? o.value_text ?? "—"} {o.unit ?? ""}</td>
                  <td className="p-1.5 text-mist/50">{o.observed_at ? new Date(o.observed_at).toLocaleString() : "—"}</td>
                  <td className="p-1.5"><SourceBadge source={o.data_kind} /></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
