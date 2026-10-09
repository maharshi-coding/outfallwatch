import { useMemo } from "react";
import type { EChartsCoreOption } from "echarts/core";
import { EChart, OCEAN } from "./EChart";

/** Grouped bars comparing fixed vs adaptive on same-scale metrics (bytes shown as stats). */
export function ComparisonChart({ metrics, fixed, adaptive, height = 260 }: {
  metrics: string[];
  fixed: number[];
  adaptive: number[];
  height?: number;
}) {
  const option = useMemo<EChartsCoreOption>(() => ({
    backgroundColor: "transparent",
    grid: { top: 28, right: 12, bottom: 24, left: 36 },
    legend: { data: ["Fixed-rate", "Adaptive"], textStyle: { color: OCEAN.axis, fontSize: 11 }, top: 0, icon: "roundRect" },
    tooltip: { trigger: "axis", backgroundColor: OCEAN.tooltipBg, borderColor: "rgba(255,255,255,0.12)", textStyle: { color: "#e8f1f5", fontSize: 12 } },
    xAxis: { type: "category", data: metrics, axisLine: { lineStyle: { color: OCEAN.grid } }, axisLabel: { color: OCEAN.axis, fontSize: 11 } },
    yAxis: { type: "value", splitLine: { lineStyle: { color: OCEAN.grid } }, axisLabel: { color: OCEAN.axis, fontSize: 11 } },
    series: [
      { name: "Fixed-rate", type: "bar", data: fixed, itemStyle: { color: OCEAN.coral, borderRadius: [4, 4, 0, 0] }, barWidth: "28%" },
      { name: "Adaptive", type: "bar", data: adaptive, itemStyle: { color: OCEAN.teal, borderRadius: [4, 4, 0, 0] }, barWidth: "28%" },
    ],
    animationDuration: 600,
  }), [metrics, fixed, adaptive]);

  return <EChart option={option} height={height} />;
}
