import { api } from "@/services/api";
import { useAsync } from "@/hooks/useAsync";
import { Panel, SourceBadge, Empty, IntegrationBadge } from "@/components/common/ui";
import type { ExternalObservation, IntStatus } from "@/types";

const PROVIDERS: { id: string; label: string }[] = [
  { id: "NOAA", label: "NOAA Tides & Currents — Water Levels" },
  { id: "GCOOS", label: "GCOOS — Oceanographic & Water Quality" },
];

export function CoastalConditions() {
  const obs = useAsync(() => api.externalObservations(), { pollMs: 0 });
  const ints = useAsync(() => api.integrations(), { pollMs: 0 });

  const byProvider = (obs.data ?? []).reduce<Record<string, ExternalObservation[]>>((acc, o) => {
    (acc[o.provider] ??= []).push(o);
    return acc;
  }, {});
  const statusOf = (p: string): IntStatus => ints.data?.providers.find((x) => x.provider === p)?.status ?? "UNAVAILABLE";

  return (
    <div className="space-y-5">
      <div>
        <h1 className="font-display text-2xl font-bold">Official Coastal Conditions &amp; Regional Water Quality</h1>
        <p className="text-sm text-mist/50">
          Authentic official observations, shown with their source, time, and units — kept
          <b> visually separate</b> from the prototype's own sensor readings.
        </p>
      </div>

      <section className="panel panel-pad border-teal/20">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-teal">Powered by Official Coastal Data</h2>
        <p className="mt-1 text-xs text-mist/60">
          NOAA water levels and GCOOS (Conrad Blucher Institute) oceanographic data below are context from official
          networks. They are <b>not</b> a measurement of the demo outfall, and official records are never presented as
          live prototype sensor values.
        </p>
      </section>

      {PROVIDERS.map((p) => <ProviderTable key={p.id} label={p.label} status={statusOf(p.id)} rows={byProvider[p.id] ?? []} />)}
    </div>
  );
}

const MAX_ROWS = 14;

function ProviderTable({ label, status, rows }: {
  label: string;
  status: IntStatus;
  rows: ExternalObservation[];
}) {
  const shown = rows.slice(0, MAX_ROWS);
  return (
    <Panel title={<span className="flex items-center gap-2">{label} <IntegrationBadge status={status} /></span>}>
      {rows.length ? (
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="text-xs uppercase text-mist/40">
              <tr>
                <th className="py-1 pr-3">Station / dataset</th>
                <th className="py-1 pr-3">Parameter</th>
                <th className="py-1 pr-3">Value</th>
                <th className="py-1 pr-3">Observed</th>
                <th className="py-1 pr-3">Label</th>
              </tr>
            </thead>
            <tbody>
              {shown.map((o, i) => (
                <tr key={i} className="border-t border-white/5">
                  <td className="py-1.5 pr-3 text-mist/70">{o.station_or_dataset}</td>
                  <td className="py-1.5 pr-3">{o.parameter}</td>
                  <td className="py-1.5 pr-3 stat-num">{o.value_numeric ?? o.value_text ?? "—"} {o.unit ?? ""}</td>
                  <td className="py-1.5 pr-3 text-mist/50">{o.observed_at ? new Date(o.observed_at).toLocaleString() : "—"}</td>
                  <td className="py-1.5 pr-3"><SourceBadge source={o.data_kind} /></td>
                </tr>
              ))}
            </tbody>
          </table>
          <div className="mt-2 flex items-center gap-3">
            {rows[0]?.source_url && (
              <a href={rows[0].source_url} target="_blank" rel="noreferrer" className="text-xs text-cyan/70 underline">source ↗</a>
            )}
            {rows.length > MAX_ROWS && <span className="text-xs text-mist/40">+{rows.length - MAX_ROWS} more observations</span>}
          </div>
        </div>
      ) : (
        <Empty>
          {status === "UNAVAILABLE"
            ? `${label} not integrated — see Data Sources for the exact barrier.`
            : "No observations loaded. Refresh integrations in Data Sources."}
        </Empty>
      )}
    </Panel>
  );
}
