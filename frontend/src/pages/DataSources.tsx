import { useEffect, useState } from "react";
import { motion } from "motion/react";
import { RefreshCw } from "lucide-react";
import { api } from "@/services/api";
import { useAsync } from "@/hooks/useAsync";
import { Panel, IntegrationBadge, Empty } from "@/components/common/ui";
import { Button } from "@/components/ui/button";
import { Input, Label } from "@/components/ui/misc";
import { SIM_DEVICE } from "@/constants";

export function DataSources() {
  const ints = useAsync(() => api.integrations(), { pollMs: 0 });
  const [refreshing, setRefreshing] = useState(false);

  async function refresh() {
    setRefreshing(true);
    try {
      await api.refreshIntegrations();
      await ints.refresh();
    } finally {
      setRefreshing(false);
    }
  }

  return (
    <div className="space-y-5">
      <h1 className="font-display text-2xl font-bold">Data Sources &amp; Settings</h1>

      <Panel
        title="Integration status (live from backend)"
        right={<Button variant="ghost" size="sm" onClick={refresh} disabled={refreshing}>
          <RefreshCw size={13} className={refreshing ? "animate-spin" : ""} /> Refresh
        </Button>}
      >
        {ints.error && <Empty>Backend unreachable: {ints.error}</Empty>}
        <div className="grid gap-2 sm:grid-cols-2">
          {(ints.data?.providers ?? []).map((p, i) => (
            <motion.div key={p.provider} initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.03 }}
              className="rounded-xl border border-white/10 bg-navy/40 p-3">
              <div className="flex items-center justify-between">
                <span className="font-semibold">{p.provider}</span>
                <IntegrationBadge status={p.status} />
              </div>
              <div className="mt-1 text-xs text-mist/50">{p.capabilities.join(" · ") || "—"}</div>
              {p.last_error && <div className="mt-1 text-xs text-amber/80">{p.last_error}</div>}
              <div className="mt-1 flex flex-wrap gap-3 text-[11px] text-mist/30">
                <span>attempted: {p.last_attempted ? new Date(p.last_attempted).toLocaleTimeString() : "—"}</span>
                <span>succeeded: {p.last_succeeded ? new Date(p.last_succeeded).toLocaleTimeString() : "—"}</span>
                <span>latest obs: {p.latest_observation_at ? new Date(p.latest_observation_at).toLocaleDateString() : "—"}</span>
              </div>
            </motion.div>
          ))}
        </div>
      </Panel>

      <div className="grid gap-5 lg:grid-cols-2">
        <ThresholdSettings />
        <CalibrationWizard />
      </div>
    </div>
  );
}

function ThresholdSettings() {
  const cfg = useAsync(() => api.configuration(), { pollMs: 0 });
  const [form, setForm] = useState<Record<string, number>>({});
  const [msg, setMsg] = useState<string | null>(null);

  useEffect(() => {
    if (cfg.data) setForm(cfg.data);
  }, [cfg.data]);

  async function save() {
    setMsg(null);
    try {
      const updated = await api.patchConfiguration({
        escalate_index_delta: Number(form.escalate_index_delta),
        escalate_persist_seconds: Number(form.escalate_persist_seconds),
        recover_index_delta: Number(form.recover_index_delta),
        recover_persist_seconds: Number(form.recover_persist_seconds),
      });
      setForm(updated);
      setMsg("Saved — applies to new readings.");
    } catch (e) {
      setMsg(e instanceof Error ? e.message.replace(/^\d+ [^:]+: /, "") : String(e));
    }
  }

  const fields: [string, string, string][] = [
    ["escalate_index_delta", "Escalate Δ (index pts)", "+above baseline to raise concern"],
    ["escalate_persist_seconds", "Escalate persistence (s)", "must hold this long"],
    ["recover_index_delta", "Recover Δ (index pts)", "below this = recovering (hysteresis)"],
    ["recover_persist_seconds", "Recover persistence (s)", "sustained before resolve"],
  ];

  return (
    <Panel title="Detection thresholds (demo defaults)">
      <div className="grid grid-cols-2 gap-3">
        {fields.map(([k, label, hint]) => (
          <div key={k}>
            <Label>{label}</Label>
            <Input type="number" value={form[k] ?? ""} className="mt-1 stat-num"
              onChange={(e) => setForm((f) => ({ ...f, [k]: Number(e.target.value) }))} />
            <span className="text-[10px] text-mist/30">{hint}</span>
          </div>
        ))}
      </div>
      <Button className="mt-3" onClick={save}>Save thresholds</Button>
      {msg && <p className="mt-2 text-xs text-cyan/80">{msg}</p>}
      <p className="mt-2 text-[11px] text-mist/40">Demonstration defaults, not environmental regulatory standards.</p>
    </Panel>
  );
}

function CalibrationWizard() {
  const [vClear, setVClear] = useState(2500);
  const [vCloudy, setVCloudy] = useState(1000);
  const [msg, setMsg] = useState<string | null>(null);

  const index = (mv: number) => {
    const span = vClear - vCloudy;
    if (span <= 0) return "invalid";
    return Math.max(0, Math.min(100, (100 * (vClear - mv)) / span)).toFixed(0);
  };

  async function save() {
    setMsg(null);
    try {
      const res = await api.createCalibration(SIM_DEVICE, vClear, vCloudy);
      setMsg(`Saved ${res.calibration_id}.`);
    } catch (e) {
      setMsg(e instanceof Error ? e.message.replace(/^\d+ [^:]+: /, "") : String(e));
    }
  }

  return (
    <Panel title="Turbidity calibration (two-point)">
      <div className="grid grid-cols-2 gap-3">
        <div>
          <Label>V_clear (mV)</Label>
          <Input type="number" value={vClear} className="mt-1 stat-num" onChange={(e) => setVClear(Number(e.target.value))} />
        </div>
        <div>
          <Label>V_cloudy (mV)</Label>
          <Input type="number" value={vCloudy} className="mt-1 stat-num" onChange={(e) => setVCloudy(Number(e.target.value))} />
        </div>
      </div>
      <div className="mt-3 rounded-lg bg-navy/50 p-2 text-xs text-mist/60">
        index(V) = clamp(100·(V_clear − V)/(V_clear − V_cloudy), 0, 100) · at V_clear → {index(vClear)}, at V_cloudy → {index(vCloudy)}
      </div>
      <Button className="mt-3" onClick={save}>Save calibration</Button>
      {msg && <p className="mt-2 text-xs text-cyan/80">{msg}</p>}
      <p className="mt-2 text-[11px] text-mist/40">Sensor output falls as water clouds, so V_clear must exceed V_cloudy. Produces a 0–100 relative index, not NTU.</p>
    </Panel>
  );
}
