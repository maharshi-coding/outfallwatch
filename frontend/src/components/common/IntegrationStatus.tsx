import { useState } from "react";
import { motion } from "motion/react";
import { RefreshCw } from "lucide-react";
import { api } from "@/services/api";
import { useAsync } from "@/hooks/useAsync";
import { Panel, IntegrationBadge, Empty } from "@/components/common/ui";
import { Button } from "@/components/ui/button";

/**
 * Live provider status straight from `GET /api/integrations/status`. Required provenance:
 * the statuses are whatever the backend actually reports, never a hardcoded green tick.
 */
export function IntegrationStatus() {
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
  );
}
