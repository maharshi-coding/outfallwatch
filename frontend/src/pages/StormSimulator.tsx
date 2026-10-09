import { useState } from "react";
import { motion } from "motion/react";
import { Play, RotateCcw, Square } from "lucide-react";
import { api } from "@/services/api";
import { useAsync } from "@/hooks/useAsync";
import { useLive } from "@/stores/useLive";
import { Panel, StateBadge, Empty } from "@/components/common/ui";
import { Button } from "@/components/ui/button";
import { Slider } from "@/components/ui/slider";
import { Progress } from "@/components/ui/misc";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { TelemetryChart } from "@/components/charts/TelemetryChart";
import { Gauge } from "@/components/charts/Gauge";
import { SCENARIOS, SIM_DEVICE } from "@/constants";

export function StormSimulator() {
  const sim = useAsync(() => api.simStatus(), { pollMs: 1500 });
  const series = useAsync(() => api.timeseries(SIM_DEVICE, 180), { pollMs: 2000 });
  const last = useLive((s) => s.readings[s.readings.length - 1]);
  const [scenario, setScenario] = useState("B");
  const [intensity, setIntensity] = useState(1.0);
  const [speed, setSpeed] = useState(4);
  const [busy, setBusy] = useState(false);

  const running = sim.data?.running ?? false;
  const progress = sim.data && sim.data.length_s ? Math.min(100, (sim.data.virtual_t / sim.data.length_s) * 100) : 0;
  const points = series.data?.points ?? [];
  const mode = last?.mode ?? "NORMAL";

  async function act(fn: () => Promise<unknown>) {
    setBusy(true);
    try {
      await fn();
      await sim.refresh();
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <h1 className="font-display text-2xl font-bold">Storm Simulation Studio</h1>
        <StateBadge state={mode} />
      </div>

      <Panel title="Scenario controls">
        <div className="grid gap-5 lg:grid-cols-[1fr_200px]">
          <div className="space-y-4">
            <div>
              <label className="mb-1.5 block text-xs uppercase tracking-wide text-mist/50">Scenario</label>
              <Select value={scenario} onValueChange={setScenario} disabled={running}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {SCENARIOS.map((s) => <SelectItem key={s.id} value={s.id}>{s.label}</SelectItem>)}
                </SelectContent>
              </Select>
              <p className="mt-1.5 text-xs text-mist/50">Expected: {SCENARIOS.find((s) => s.id === scenario)?.expect}</p>
            </div>
            <div className="grid grid-cols-2 gap-5">
              <div>
                <label className="mb-1 block text-xs uppercase tracking-wide text-mist/50">Storm intensity ×{intensity.toFixed(1)}</label>
                <Slider min={0.3} max={2.5} step={0.1} value={[intensity]} onValueChange={(v) => setIntensity(v[0])} disabled={running} />
              </div>
              <div>
                <label className="mb-1 block text-xs uppercase tracking-wide text-mist/50">Playback speed ×{speed}</label>
                <Slider min={1} max={12} step={1} value={[speed]} onValueChange={(v) => setSpeed(v[0])} disabled={running} />
              </div>
            </div>
          </div>
          <div className="flex flex-col gap-2">
            <Button variant="primary" disabled={busy || running} onClick={() => act(() => api.simStart(scenario, intensity, speed))}><Play size={16} /> Start</Button>
            <Button variant="ghost" disabled={busy || !running} onClick={() => act(() => api.simStop())}><Square size={16} /> Stop</Button>
            <Button variant="ghost" disabled={busy} onClick={() => act(() => api.simReset())}><RotateCcw size={16} /> Reset</Button>
          </div>
        </div>

        <div className="mt-5" aria-live="polite">
          <div className="mb-1.5 flex justify-between text-xs text-mist/50">
            <span>{running ? "Running" : sim.data?.virtual_t ? "Complete / stopped" : "Idle"}</span>
            <span className="stat-num">{sim.data ? `${sim.data.virtual_t}s / ${sim.data.length_s}s` : ""}</span>
          </div>
          <Progress value={progress} />
          {sim.data?.scenario === "F" && running && (
            <p className="mt-2 text-xs text-amber">Scenario F injects a telemetry outage 140–170 s — the dashboard will visibly go stale.</p>
          )}
        </div>
      </Panel>

      <div className="grid gap-5 lg:grid-cols-[1fr_300px]">
        <Panel title="Live telemetry">
          {points.length ? <TelemetryChart points={points} baseline={last?.baseline ?? null} height={340} /> : <Empty>Press Start to stream deterministic, seeded telemetry through the real backend pipeline.</Empty>}
        </Panel>
        <Panel title="Index">
          <Gauge value={last?.turbidity_index ?? null} state={mode} height={220} />
          <motion.p key={mode} initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="text-center text-xs text-mist/50">
            State: <span className="font-semibold">{mode}</span>
          </motion.p>
        </Panel>
      </div>

      <p className="text-xs text-mist/40">
        Every reading, event, and chart point is labelled <span className="text-amber">SIMULATION</span>. The virtual
        device uses the identical telemetry schema and backend state machine as real hardware, and runs fully offline
        with a fixed seed.
      </p>
    </div>
  );
}
