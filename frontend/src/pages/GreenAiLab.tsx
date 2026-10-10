import { useState } from "react";
import { motion } from "motion/react";
import { Leaf } from "lucide-react";
import { api } from "@/services/api";
import { useAsync } from "@/hooks/useAsync";
import { Panel, Stat, Empty } from "@/components/common/ui";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ComparisonChart } from "@/components/charts/ComparisonChart";
import { SCENARIOS } from "@/constants";
import type { EnergyCompare } from "@/types";

export function GreenAiLab() {
  const [scenario, setScenario] = useState("B");
  const [result, setResult] = useState<EnergyCompare | null>(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const cc = useAsync(() => api.codecarbon(), { pollMs: 0 });

  async function run() {
    setBusy(true);
    setErr(null);
    try {
      setResult(await api.energyCompare(scenario, 42, 1.0));
    } catch (e) {
      setErr(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="flex items-center gap-2 font-display text-2xl font-bold"><Leaf size={22} className="text-teal" /> Green AI Lab</h1>
          <p className="text-sm text-mist/50">Fixed-rate vs adaptive sensing on the <b>same seeded replay</b>.</p>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-44">
            <Select value={scenario} onValueChange={setScenario}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>{SCENARIOS.map((s) => <SelectItem key={s.id} value={s.id}>{s.label}</SelectItem>)}</SelectContent>
            </Select>
          </div>
          <Button onClick={run} disabled={busy}>{busy ? "Running…" : "Run comparison"}</Button>
        </div>
      </div>

      {err && <div className="rounded-xl border border-coral/40 bg-coral/10 p-3 text-sm text-coral">{err}</div>}
      {!result && !err && <Empty>Pick a scenario and run the reproducible comparison.</Empty>}

      {result && (
        <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="space-y-5">
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <Stat label="Messages saved" value={result.reductions_pct.messages} unit="%" decimals={1} tone="teal" hint={`${result.fixed.messages} → ${result.adaptive.messages}`} />
            <Stat label="Bytes saved" value={result.reductions_pct.bytes} unit="%" decimals={1} tone="teal" hint="transmitted payload" />
            <Stat label="Energy saved" value={result.reductions_pct.energy_estimated} unit="%" decimals={1} tone="teal" hint="ESTIMATED model" />
            <Stat label="Missed anomalies" value={result.adaptive.missed_anomalies} tone={result.adaptive.missed_anomalies ? "coral" : "default"}
              hint={result.adaptive.alert_latency_seconds != null ? `alert +${result.adaptive.alert_latency_seconds}s after onset` : "no true onset"} />
          </div>

          <div className="grid gap-5 lg:grid-cols-2">
            <Panel title="Fixed vs adaptive (same-scale counts)">
              <ComparisonChart
                metrics={["Messages", "Samples"]}
                fixed={[result.fixed.messages, result.fixed.samples]}
                adaptive={[result.adaptive.messages, result.adaptive.samples]}
              />
              <p className="mt-1 text-[11px] text-mist/40">Bytes shown in the stat tiles above (different magnitude).</p>
            </Panel>

            <Panel title="Energy methodology">
              <div className="space-y-2 text-sm">
                <div className="rounded-lg bg-navy/50 p-2 font-mono text-xs text-cyan">{result.energy_model.formula}</div>
                <div className="grid grid-cols-3 gap-2 text-xs">
                  {Object.entries(result.energy_model.constants_mwh).map(([k, v]) => (
                    <div key={k} className="rounded-lg border border-white/10 p-2">
                      <div className="text-mist/40">{k}</div>
                      <div className="stat-num">{v} mWh</div>
                    </div>
                  ))}
                </div>
                <ul className="list-disc space-y-1 pl-5 text-xs text-mist/60">
                  {result.energy_model.assumptions.map((a, i) => <li key={i}>{a}</li>)}
                </ul>
                <div className="rounded-lg border border-amber/30 bg-amber/10 p-2 text-xs text-amber">{result.energy_model.disclaimer}</div>
              </div>
            </Panel>
          </div>

          <Panel title="CodeCarbon · on-device TinyML">
            <div className="grid gap-3 text-sm text-mist/60 sm:grid-cols-2">
              {/* CodeCarbon — real measured host footprint */}
              {cc.data?.ran ? (
                <div className="rounded-lg border border-teal/25 bg-teal/5 p-3">
                  <div className="flex items-center gap-2">
                    <span className="badge bg-teal/15 text-teal">MEASURED · HOST</span>
                    <span className="badge bg-white/10 text-mist/60">{cc.data.kind}</span>
                  </div>
                  <p className="mt-2">CodeCarbon host footprint of running the Green-AI replay
                    {" "}<b>{cc.data.iterations?.toLocaleString()}×</b> ({cc.data.duration_s}s) on {cc.data.cpu_model}:</p>
                  <div className="mt-2 grid grid-cols-2 gap-2">
                    <Stat label="Host energy" value={(cc.data.energy_kwh ?? 0) * 1e6} unit="mWh" decimals={1} tone="teal" />
                    <Stat label="Host CO₂" value={(cc.data.co2_kg ?? 0) * 1e6} unit="mg" decimals={1} tone="teal" />
                  </div>
                  <p className="mt-2 text-xs text-amber/80">⚠ This is the <b>host computer's</b> footprint — <b>not</b> the ESP32's current draw (that needs a hardware power meter).</p>
                  <p className="mt-1 text-[11px] text-mist/40">measured {cc.data.measured_at ? new Date(cc.data.measured_at).toLocaleDateString() : "—"} · re-run via <span className="font-mono">scripts/benchmark_codecarbon.py</span></p>
                </div>
              ) : (
                <div className="rounded-lg border border-white/10 p-3">
                  <div className="badge bg-coral/15 text-coral">NOT RUN</div>
                  <p className="mt-2">CodeCarbon benchmark not present. It measures the <b>host</b> computer's footprint, never the ESP32's current. Run <span className="font-mono text-cyan">scripts/benchmark_codecarbon.py</span>.</p>
                </div>
              )}

              {/* On-device TinyML — deliberate, honest design decision (not a failure) */}
              <div className="rounded-lg border border-cyan/20 bg-cyan/5 p-3">
                <div className="badge bg-cyan/15 text-cyan">DESIGN DECISION</div>
                <p className="mt-2">We deliberately ship a <b>transparent deterministic rule engine</b> at the edge instead of a neural net — labelling thresholds as "neural AI" would be dishonest. The genuine Green-AI win is <b>adaptive edge processing</b> (measured above). On-device TFLM/ESP-NN is a documented future step.</p>
              </div>
            </div>
          </Panel>
        </motion.div>
      )}
    </div>
  );
}
