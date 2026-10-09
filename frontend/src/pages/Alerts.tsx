import type { ReactNode } from "react";
import { AnimatePresence, motion } from "motion/react";
import { CheckCircle2, Clock, Waves } from "lucide-react";
import { api } from "@/services/api";
import { useAsync } from "@/hooks/useAsync";
import { useLive } from "@/stores/useLive";
import { Panel, StateBadge, SourceBadge, Empty } from "@/components/common/ui";
import { Button } from "@/components/ui/button";
import type { MonitoringEvent } from "@/types";

const DOT: Record<string, string> = {
  ACTIVE: "bg-coral",
  ACKNOWLEDGED: "bg-amber",
  RESOLVED: "bg-teal",
};

export function Alerts() {
  const { alertTick } = useLive();
  const alerts = useAsync(() => api.alerts(), { pollMs: 5000, deps: [alertTick] });
  const rows = alerts.data ?? [];

  async function ack(id: string) {
    await api.acknowledge(id);
    alerts.refresh();
  }

  return (
    <div className="space-y-5">
      <h1 className="font-display text-2xl font-bold">Alerts &amp; Incidents</h1>

      {rows.length === 0 ? (
        <Empty>No incidents recorded yet. Run the storm demo to generate one.</Empty>
      ) : (
        <Panel title="Incident timeline">
          <ol className="relative space-y-4 pl-6">
            <span className="absolute bottom-2 left-[7px] top-2 w-px bg-white/10" />
            <AnimatePresence initial={false}>
              {rows.map((a) => (
                <motion.li
                  key={a.event_id}
                  layout
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="relative"
                >
                  <span className={`absolute -left-[22px] top-1.5 h-3.5 w-3.5 rounded-full ring-4 ring-navy ${DOT[a.state] ?? "bg-mist"}`} />
                  <IncidentCard a={a} onAck={ack} />
                </motion.li>
              ))}
            </AnimatePresence>
          </ol>
        </Panel>
      )}

      <p className="text-xs text-mist/40">
        Alerts describe <span className="text-cyan">change</span> only. They never state that water is toxic, clean,
        or safe, and never attribute a cause.
      </p>
    </div>
  );
}

function IncidentCard({ a, onAck }: { a: MonitoringEvent; onAck: (id: string) => void }) {
  return (
    <article className="rounded-xl border border-white/10 bg-navy/40 p-4 transition hover:border-white/20">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <StateBadge state={a.severity} />
          <SourceBadge source={a.source} />
          <span className="text-xs text-mist/40">{a.event_id}</span>
        </div>
        {a.state === "ACTIVE" ? (
          <Button variant="ghost" size="sm" onClick={() => onAck(a.event_id)}><CheckCircle2 size={14} /> Acknowledge</Button>
        ) : (
          <span className="badge bg-white/5 text-mist/50">{a.state}</span>
        )}
      </div>
      <p className="mt-2 text-sm text-mist/80">{a.explanation}</p>
      {a.recommendation && <p className="mt-1 text-xs text-cyan/80">→ {a.recommendation}</p>}
      <div className="mt-2 grid grid-cols-2 gap-x-6 gap-y-1 text-xs text-mist/50 sm:grid-cols-4">
        <Meta icon={<Clock size={11} />} k="Started" v={new Date(a.started_at).toLocaleTimeString()} />
        <Meta icon={<Clock size={11} />} k="Updated" v={new Date(a.updated_at).toLocaleTimeString()} />
        <Meta icon={<CheckCircle2 size={11} />} k="Resolved" v={a.resolved_at ? new Date(a.resolved_at).toLocaleTimeString() : "—"} />
        <Meta icon={<Waves size={11} />} k="Readings" v={String(a.reading_ids.length)} />
      </div>
    </article>
  );
}

function Meta({ icon, k, v }: { icon: ReactNode; k: string; v: string }) {
  return (
    <div className="flex items-center gap-1">
      <span className="text-mist/30">{icon}</span>
      <span className="text-mist/30">{k}:</span>
      <span className="stat-num">{v}</span>
    </div>
  );
}
