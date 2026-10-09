import type { ReactNode } from "react";
import { AnimatePresence, motion } from "motion/react";
import { Card, CardHeader } from "@/components/ui/card";
import { AnimatedNumber } from "./AnimatedNumber";

export function Panel({ title, icon, right, children, className = "" }: {
  title?: ReactNode;
  icon?: ReactNode;
  right?: ReactNode;
  children: ReactNode;
  className?: string;
}) {
  return (
    <Card className={className}>
      <CardHeader title={title} icon={icon} right={right} />
      {children}
    </Card>
  );
}

const STATE_STYLE: Record<string, string> = {
  NORMAL: "bg-teal/15 text-teal ring-1 ring-teal/30",
  ELEVATED: "bg-amber/15 text-amber ring-1 ring-amber/30",
  ALERT: "bg-coral/20 text-coral ring-1 ring-coral/40 animate-pulseRing",
  RECOVERING: "bg-cyan/15 text-cyan ring-1 ring-cyan/30",
  SENSOR_FAULT: "bg-fuchsia-400/15 text-fuchsia-300 ring-1 ring-fuchsia-400/30",
  STALE: "bg-slate-400/15 text-slate-300 ring-1 ring-slate-400/20",
  OFFLINE: "bg-slate-400/15 text-slate-300",
};

export function StateBadge({ state }: { state: string }) {
  return (
    <AnimatePresence mode="wait" initial={false}>
      <motion.span
        key={state}
        initial={{ opacity: 0, y: -4, scale: 0.9 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        exit={{ opacity: 0, y: 4, scale: 0.9 }}
        transition={{ duration: 0.25 }}
        className={`badge ${STATE_STYLE[state] ?? "bg-white/10 text-mist"}`}
      >
        {state === "ALERT" && <span className="mr-0.5 h-1.5 w-1.5 rounded-full bg-coral" />}
        {state}
      </motion.span>
    </AnimatePresence>
  );
}

const SOURCE_STYLE: Record<string, string> = {
  HARDWARE: "bg-cyan/15 text-cyan",
  SIMULATION: "bg-amber/15 text-amber",
  IMPORTED_OFFICIAL: "bg-teal/15 text-teal",
  TEST_FIXTURE: "bg-slate-400/15 text-slate-300",
};

export function SourceBadge({ source }: { source: string }) {
  const label = source === "IMPORTED_OFFICIAL" ? "OFFICIAL" : source === "TEST_FIXTURE" ? "FIXTURE" : source;
  return <span className={`badge ${SOURCE_STYLE[source] ?? "bg-white/10 text-mist"}`}>{label}</span>;
}

const INT_STYLE: Record<string, string> = {
  WORKING: "bg-teal/15 text-teal",
  PARTIAL: "bg-amber/15 text-amber",
  UNAVAILABLE: "bg-slate-400/15 text-slate-300",
  NOT_IMPLEMENTED: "bg-coral/15 text-coral",
};

export function IntegrationBadge({ status }: { status: string }) {
  return <span className={`badge ${INT_STYLE[status] ?? "bg-white/10 text-mist"}`}>{status.replace("_", " ")}</span>;
}

const TONE: Record<string, string> = {
  default: "text-mist",
  teal: "text-teal",
  amber: "text-amber",
  coral: "text-coral",
};

export function Stat({ label, value, unit, hint, tone = "default", decimals = 0, animate: doAnimate = true }: {
  label: string;
  value: number | string | null;
  unit?: string;
  hint?: ReactNode;
  tone?: "default" | "teal" | "amber" | "coral";
  decimals?: number;
  animate?: boolean;
}) {
  const numeric = typeof value === "number";
  return (
    <div className="group relative overflow-hidden rounded-xl border border-white/10 bg-navy/40 p-3 transition hover:border-white/20">
      <div className="absolute -right-6 -top-6 h-16 w-16 rounded-full bg-teal/5 blur-xl transition group-hover:bg-teal/10" />
      <div className="text-[11px] uppercase tracking-wide text-mist/50">{label}</div>
      <div className={`mt-1 text-2xl font-bold stat-num ${TONE[tone]}`}>
        {numeric && doAnimate ? (
          <AnimatedNumber value={value as number} decimals={decimals} />
        ) : (
          value ?? "—"
        )}
        {unit && <span className="ml-1 text-sm font-medium text-mist/50">{unit}</span>}
      </div>
      {hint && <div className="mt-0.5 text-[11px] text-mist/40">{hint}</div>}
    </div>
  );
}

export function Empty({ children }: { children: ReactNode }) {
  return <div className="rounded-xl border border-dashed border-white/10 p-6 text-center text-sm text-mist/40">{children}</div>;
}
