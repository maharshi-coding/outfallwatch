import { useEffect, useRef, useState } from "react";
import * as maplibregl from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";
import type { Device } from "@/types";
import { CoastalMap } from "./CoastalMap";

const OUTFALL: [number, number] = [-97.21, 27.62]; // simulated demo site
const NOAA: [number, number] = [-97.2167, 27.5801]; // Bob Hall Pier 8775870

// ESRI Dark Gray Canvas — keyless raster basemap (note {z}/{y}/{x} order). Needs network;
// we fall back to the offline SVG schematic when offline or on tile error.
const DARK_STYLE: maplibregl.StyleSpecification = {
  version: 8,
  sources: {
    esriDark: {
      type: "raster",
      tiles: [
        "https://server.arcgisonline.com/ArcGIS/rest/services/Canvas/World_Dark_Gray_Base/MapServer/tile/{z}/{y}/{x}",
      ],
      tileSize: 256,
      attribution: "© Esri",
    },
  },
  layers: [{ id: "esriDark", type: "raster", source: "esriDark" }],
};

function injectKeyframesOnce() {
  if (document.getElementById("ow-map-kf")) return;
  const s = document.createElement("style");
  s.id = "ow-map-kf";
  s.textContent =
    "@keyframes owpulse{0%{transform:scale(1);opacity:.7}70%{transform:scale(2.6);opacity:0}100%{opacity:0}}";
  document.head.appendChild(s);
}

function stateColor(state?: string): string {
  return state === "ALERT" ? "#EF6461" : state === "ELEVATED" ? "#F5B544" : state === "RECOVERING" ? "#5EDCE5" : "#00BFA6";
}

function makeMarkerEl(color: string, pulsing: boolean): HTMLDivElement {
  const el = document.createElement("div");
  el.style.cssText = "position:relative;width:16px;height:16px;";
  const dot = document.createElement("div");
  dot.style.cssText = `position:absolute;inset:0;border-radius:9999px;background:${color};border:2px solid #071B2C;box-shadow:0 0 14px ${color};`;
  if (pulsing) {
    const ring = document.createElement("div");
    ring.style.cssText = `position:absolute;inset:0;border-radius:9999px;background:${color};animation:owpulse 2s infinite;`;
    el.appendChild(ring);
  }
  el.appendChild(dot);
  return el;
}

export function MapLibreMap({ device, height = 300 }: { device?: Device | null; height?: number }) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<maplibregl.Map | null>(null);
  const outfallMarker = useRef<maplibregl.Marker | null>(null);
  const [fallback, setFallback] = useState(!navigator.onLine);
  const state = device?.mode ?? "NORMAL";

  useEffect(() => {
    if (fallback || !containerRef.current) return;
    injectKeyframesOnce();
    let map: maplibregl.Map;
    try {
      map = new maplibregl.Map({
        container: containerRef.current,
        style: DARK_STYLE,
        center: [-97.23, 27.7],
        zoom: 9.5,
        attributionControl: { compact: true },
      });
    } catch {
      setFallback(true);
      return;
    }
    mapRef.current = map;
    map.addControl(new maplibregl.NavigationControl({ showCompass: false }), "top-right");

    let tileFailures = 0;
    map.on("error", (e: maplibregl.ErrorEvent) => {
      // a handful of tile errors => assume offline/blocked, show schematic
      if (String(e?.error?.message ?? "").includes("tile") || !navigator.onLine) {
        if (++tileFailures > 3) setFallback(true);
      }
    });

    map.on("load", () => {
      // alert-zone circle around the outfall
      map.addSource("alertzone", { type: "geojson", data: { type: "Feature", properties: {}, geometry: { type: "Point", coordinates: OUTFALL } } });
      map.addLayer({
        id: "alertzone", type: "circle", source: "alertzone",
        paint: { "circle-radius": 46, "circle-color": stateColor(state), "circle-opacity": 0.12, "circle-stroke-color": stateColor(state), "circle-stroke-width": 1, "circle-stroke-opacity": 0.4 },
      });
      // NOAA official station marker
      new maplibregl.Marker({ element: makeMarkerEl("#5EDCE5", false) })
        .setLngLat(NOAA)
        .setPopup(new maplibregl.Popup({ offset: 16 }).setHTML('<div style="font:12px Inter;color:#0B3954"><b>NOAA 8775870</b><br/>Bob Hall Pier (official)</div>'))
        .addTo(map);
      // simulated demo outfall marker (animated, state-coloured)
      outfallMarker.current = new maplibregl.Marker({ element: makeMarkerEl(stateColor(state), true) })
        .setLngLat(OUTFALL)
        .setPopup(new maplibregl.Popup({ offset: 16 }).setHTML('<div style="font:12px Inter;color:#0B3954"><b>Demo Outfall (SIMULATED)</b><br/>Hypothetical demonstration site</div>'))
        .addTo(map);
    });

    return () => map.remove();
  }, [fallback]); // eslint-disable-line react-hooks/exhaustive-deps

  // recolor marker + alert zone as the monitoring state changes
  useEffect(() => {
    const map = mapRef.current;
    if (fallback || !map) return;
    const color = stateColor(state);
    if (outfallMarker.current) {
      const fresh = makeMarkerEl(color, true);
      outfallMarker.current.getElement().replaceChildren(...Array.from(fresh.childNodes));
    }
    if (map.getLayer?.("alertzone")) {
      map.setPaintProperty("alertzone", "circle-color", color);
      map.setPaintProperty("alertzone", "circle-stroke-color", color);
      map.setPaintProperty("alertzone", "circle-opacity", state === "ALERT" ? 0.22 : 0.12);
    }
  }, [state, fallback]);

  if (fallback) {
    return (
      <div className="relative" style={{ height }}>
        <CoastalMap device={device} stations={[{ label: "NOAA 8775870", x: 455, y: 240, official: true }]} />
        <div className="absolute left-2 top-2 rounded-md bg-navy/70 px-2 py-1 text-[10px] text-amber/80">
          Offline — schematic view
        </div>
      </div>
    );
  }

  return (
    <div className="relative overflow-hidden rounded-xl border border-white/10" style={{ height }}>
      <div ref={containerRef} className="h-full w-full" />
    </div>
  );
}
