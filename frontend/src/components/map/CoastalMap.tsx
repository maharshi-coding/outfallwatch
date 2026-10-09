import type { Device } from "../../types";

/**
 * Offline-safe SVG schematic of the Corpus Christi bay system. This is the DEFAULT map
 * so the demo never depends on a tile server (judging may be offline). It is a stylised
 * schematic, NOT a survey-accurate chart. MapLibre GL JS with real tiles is the online
 * upgrade path (see docs/LIMITATIONS.md). Pins are clearly labelled; a simulated site is
 * never shown as a known industrial outfall.
 */
export function CoastalMap({ device, stations = [] }: {
  device?: Device | null;
  stations?: { label: string; x: number; y: number; official?: boolean }[];
}) {
  const state = device?.mode ?? "NORMAL";
  const pinColor = state === "ALERT" ? "#EF6461" : state === "ELEVATED" ? "#F5B544" : "#00BFA6";

  return (
    <div className="relative overflow-hidden rounded-xl border border-white/10">
      <svg viewBox="0 0 600 340" className="h-full w-full" role="img"
        aria-label="Schematic map of the Corpus Christi bay system with monitoring pins">
        <rect width="600" height="340" fill="#0a2236" />
        {/* water */}
        <g className="animate-tide" opacity="0.5">
          <path d="M0 210 Q150 190 300 210 T600 210 V340 H0 Z" fill="#0B3954" />
          <path d="M0 235 Q150 215 300 235 T600 235 V340 H0 Z" fill="#0d4668" opacity="0.6" />
        </g>
        {/* land masses (stylised) */}
        <path d="M0 0 H600 V150 Q430 120 300 150 Q150 180 0 150 Z" fill="#0e2d20" opacity="0.85" />
        <path d="M430 150 Q520 200 600 190 V340 H470 Q440 240 430 150 Z" fill="#0e2d20" opacity="0.7" />
        <text x="120" y="60" fill="#5EDCE5" fontSize="13" opacity="0.6">Corpus Christi</text>
        <text x="300" y="300" fill="#5EDCE5" fontSize="12" opacity="0.45">Corpus Christi Bay</text>
        <text x="20" y="120" fill="#5EDCE5" fontSize="11" opacity="0.4">Nueces Bay</text>

        {/* official station pins */}
        {stations.map((s, i) => (
          <g key={i} transform={`translate(${s.x} ${s.y})`}>
            <circle r="6" fill={s.official ? "#00BFA6" : "#9fb3bd"} stroke="#071B2C" strokeWidth="2" />
            <text x="10" y="4" fill="#cfe6ec" fontSize="10">{s.label}</text>
          </g>
        ))}

        {/* the simulated demo outfall pin */}
        <g transform="translate(320 225)">
          <circle r="16" fill={pinColor} opacity="0.18">
            <animate attributeName="r" values="12;20;12" dur="2.4s" repeatCount="indefinite" />
          </circle>
          <circle r="7" fill={pinColor} stroke="#071B2C" strokeWidth="2" />
          <text x="12" y="-8" fill="#fff" fontSize="11" fontWeight="600">Demo Outfall (SIMULATED)</text>
          <text x="12" y="6" fill="#cfe6ec" fontSize="9" opacity="0.7">Hypothetical demonstration site</text>
        </g>
      </svg>
      <div className="absolute bottom-2 right-2 rounded-md bg-navy/70 px-2 py-1 text-[10px] text-mist/60">
        Offline schematic · not to scale
      </div>
    </div>
  );
}
