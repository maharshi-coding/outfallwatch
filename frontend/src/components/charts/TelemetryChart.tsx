import { useMemo } from "react";
import type { EChartsCoreOption } from "echarts/core";
import { EChart, OCEAN } from "./EChart";
import type { ReadingPoint } from "@/types";

function hhmm(iso: string): string {
  return new Date(iso).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" });
}

/** Turbidity index (area) + water temperature (line), storm windows shaded, baseline markLine. */
export function TelemetryChart({ points, baseline, height = 300, showTemp = true }: {
  points: ReadingPoint[];
  baseline?: number | null;
  height?: number;
  showTemp?: boolean;
}) {
  const option = useMemo<EChartsCoreOption>(() => {
    const times = points.map((p) => hhmm(p.observed_at));
    const turb = points.map((p) => p.turbidity_index);
    const temp = points.map((p) => p.temperature_c);

    // storm shaded bands (contiguous storm_active runs)
    const bands: { xAxis: string }[][] = [];
    let start: number | null = null;
    points.forEach((p, i) => {
      if (p.storm_active && start === null) start = i;
      if ((!p.storm_active || i === points.length - 1) && start !== null) {
        bands.push([{ xAxis: times[start] }, { xAxis: times[Math.max(start, i - (p.storm_active ? 0 : 1))] }]);
        start = null;
      }
    });

    return {
      backgroundColor: "transparent",
      grid: { top: 16, right: showTemp ? 44 : 16, bottom: 28, left: 40 },
      tooltip: {
        trigger: "axis",
        backgroundColor: OCEAN.tooltipBg,
        borderColor: "rgba(255,255,255,0.12)",
        textStyle: { color: "#e8f1f5", fontSize: 12 },
      },
      xAxis: {
        type: "category", data: times, boundaryGap: false,
        axisLine: { lineStyle: { color: OCEAN.grid } },
        axisLabel: { color: OCEAN.axis, fontSize: 11, hideOverlap: true },
      },
      yAxis: [
        {
          type: "value", min: 0, max: 100, name: "index",
          nameTextStyle: { color: OCEAN.axis, fontSize: 10 },
          splitLine: { lineStyle: { color: OCEAN.grid } },
          axisLabel: { color: OCEAN.axis, fontSize: 11 },
        },
        ...(showTemp ? [{
          type: "value" as const, min: 15, max: 35, position: "right" as const, name: "°C",
          nameTextStyle: { color: OCEAN.axis, fontSize: 10 },
          splitLine: { show: false },
          axisLabel: { color: OCEAN.axis, fontSize: 11 },
        }] : []),
      ],
      series: [
        {
          name: "Turbidity index", type: "line", smooth: true, symbol: "none", yAxisIndex: 0,
          data: turb, connectNulls: false,
          lineStyle: { width: 2.5, color: OCEAN.cyan },
          areaStyle: {
            color: {
              type: "linear", x: 0, y: 0, x2: 0, y2: 1,
              colorStops: [
                { offset: 0, color: "rgba(94,220,229,0.38)" },
                { offset: 1, color: "rgba(94,220,229,0)" },
              ],
            },
          },
          markLine: baseline != null ? {
            silent: true, symbol: "none",
            lineStyle: { color: OCEAN.axis, type: "dashed", width: 1 },
            label: { formatter: "baseline", color: OCEAN.axis, fontSize: 10, position: "insideStartTop" },
            data: [{ yAxis: baseline }],
          } : undefined,
          markArea: bands.length ? {
            silent: true,
            itemStyle: { color: "rgba(245,181,68,0.08)" },
            data: bands,
          } : undefined,
        },
        ...(showTemp ? [{
          name: "Temp °C", type: "line" as const, smooth: true, symbol: "none", yAxisIndex: 1,
          data: temp, connectNulls: true, lineStyle: { width: 1.6, color: OCEAN.teal },
        }] : []),
      ],
      animationDuration: 500,
    };
  }, [points, baseline, showTemp]);

  return <EChart option={option} height={height} />;
}
