import { useEffect, useState } from "react";
import { NavLink, Outlet, useLocation } from "react-router-dom";
import { motion } from "motion/react";
import {
  Activity,
  AlertTriangle,
  Gauge as GaugeIcon,
  LayoutDashboard,
  Leaf,
  Map as MapIcon,
  Radio,
  Waves,
} from "lucide-react";
import { TooltipProvider } from "@/components/ui/misc";
import { useLive } from "@/stores/useLive";

const NAV = [
  { to: "/", label: "Mission Control", icon: LayoutDashboard, end: true },
  { to: "/live", label: "Live Monitoring", icon: Activity },
  { to: "/simulator", label: "Storm Simulator", icon: Waves },
  { to: "/alerts", label: "Alerts & Incidents", icon: AlertTriangle },
  { to: "/green-ai", label: "Green AI Lab", icon: Leaf },
  { to: "/coastal", label: "Coastal Conditions", icon: MapIcon },
];

export function Layout() {
  const { connected, start, stop } = useLive();
  const [open, setOpen] = useState(false);
  const loc = useLocation();

  useEffect(() => {
    start();
    return () => stop();
  }, [start, stop]);

  return (
    <TooltipProvider>
      <div className="min-h-screen lg:grid lg:grid-cols-[256px_1fr]">
        <aside
          className={`fixed inset-y-0 left-0 z-30 flex w-64 flex-col border-r border-white/10 bg-navy/95 p-4 backdrop-blur-xl transition-transform lg:static lg:translate-x-0 ${
            open ? "translate-x-0" : "-translate-x-full"
          }`}
        >
          <div className="mb-6 flex items-center gap-3">
            <div className="relative grid h-10 w-10 place-items-center rounded-xl bg-gradient-to-br from-teal/30 to-cyan/10 text-teal shadow-glow">
              <GaugeIcon size={20} />
              <span className="absolute -right-0.5 -top-0.5 h-2 w-2 animate-pulse rounded-full bg-teal" />
            </div>
            <div>
              <div className="font-display text-sm font-bold tracking-tight">OUTFALLWATCH</div>
              <div className="text-[10px] text-mist/50">Detect Change. Protect the Coast.</div>
            </div>
          </div>

          <nav className="space-y-1">
            {NAV.map(({ to, label, icon: Icon, end }) => (
              <NavLink
                key={to}
                to={to}
                end={end}
                onClick={() => setOpen(false)}
                className={({ isActive }) =>
                  `group relative flex items-center gap-3 rounded-xl px-3 py-2 text-sm font-medium transition ${
                    isActive ? "text-teal" : "text-mist/70 hover:bg-white/5 hover:text-mist"
                  }`
                }
              >
                {({ isActive }) => (
                  <>
                    {isActive && (
                      <motion.span
                        layoutId="nav-active"
                        className="absolute inset-0 rounded-xl bg-teal/15 ring-1 ring-teal/25"
                        transition={{ type: "spring", stiffness: 400, damping: 32 }}
                      />
                    )}
                    <Icon size={17} className="relative z-10" />
                    <span className="relative z-10">{label}</span>
                  </>
                )}
              </NavLink>
            ))}
          </nav>

          <div className="mt-auto space-y-3 pt-4">
            <div className="flex items-center gap-2 rounded-xl border border-white/10 bg-marine/30 px-3 py-2 text-xs">
              <Radio size={14} className={connected ? "text-teal" : "text-coral"} />
              <span className={connected ? "text-teal" : "text-coral"}>
                {connected ? "Live telemetry" : "Stream offline"}
              </span>
              <span className={`ml-auto h-2 w-2 rounded-full ${connected ? "bg-teal animate-pulse" : "bg-coral"}`} />
            </div>
            <div className="rounded-xl border border-white/10 bg-marine/20 p-3 text-[11px] leading-relaxed text-mist/50">
              Detects <span className="text-cyan">change</span> in water conditions. Does not identify
              pollutants, bacteria, or safety.
            </div>
          </div>
        </aside>

        <div className="flex min-h-screen flex-col">
          <header className="sticky top-0 z-20 flex items-center justify-between gap-3 border-b border-white/10 bg-navy/70 px-4 py-3 backdrop-blur-xl">
            <button className="rounded-lg border border-white/15 px-3 py-1.5 text-mist lg:hidden" onClick={() => setOpen((o) => !o)} aria-label="Toggle menu">
              ☰
            </button>
            <div className="hidden items-center gap-2 text-xs text-mist/50 sm:flex">
              <span className="h-1.5 w-1.5 rounded-full bg-cyan/60" />
              IslanderHack · Corpus Christi · Green AI &amp; Resource Efficiency
            </div>
            <div className="flex items-center gap-2 rounded-full border border-white/10 bg-marine/30 px-3 py-1">
              <span className={`h-2 w-2 rounded-full ${connected ? "bg-teal animate-pulse" : "bg-coral"}`} />
              <span className="text-xs text-mist/60">{connected ? "Connected" : "Offline"}</span>
            </div>
          </header>

          <motion.main
            key={loc.pathname}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.3 }}
            className="mx-auto w-full max-w-[1440px] flex-1 p-4 sm:p-6"
          >
            <Outlet />
          </motion.main>
        </div>
        {open && <div className="fixed inset-0 z-20 bg-black/50 lg:hidden" onClick={() => setOpen(false)} />}
      </div>
    </TooltipProvider>
  );
}
