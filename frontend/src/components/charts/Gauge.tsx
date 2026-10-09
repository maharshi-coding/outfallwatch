import { useMemo } from "react";
import type { EChartsCoreOption } from "echarts/core";
import { EChart } from "./EChart";

/** Turbidity-index gauge, colour-zoned by monitoring severity. 0-100 relative index. */
export function Gauge({ value, state = "NORMAL", height = 200 }: {
  value: number | null;
  state?: string;
  height?: number;
}) {
  const option = useMemo<EChartsCoreOption>(() => ({
    backgroundColor: "transparent",
    series: [
      {
        type: "gauge",
        startAngle: 210, endAngle: -30, min: 0, max: 100, radius: "96%", center: ["50%", "58%"],
        progress: { show: true, width: 10, roundCap: true },
        axisLine: {
          roundCap: true,
          lineStyle: {
            width: 10,
            color: [
              [0.3, "rgba(0,191,166,0.55)"],
              [0.6, "rgba(245,181,68,0.6)"],
              [1, "rgba(239,100,97,0.7)"],
            ],
          },
        },
        pointer: { icon: "path://M2,0 L-2,0 L0,-55 Z", length: "60%", width: 6, offsetCenter: [0, 0], itemStyle: { color: "#5EDCE5" } },
        anchor: { show: true, size: 10, itemStyle: { color: "#5EDCE5" } },
        axisTick: { distance: -14, splitNumber: 5, lineStyle: { color: "rgba(159,179,189,0.4)" } },
        splitLine: { distance: -16, length: 8, lineStyle: { color: "rgba(159,179,189,0.5)" } },
        axisLabel: { distance: -4, color: "rgba(159,179,189,0.6)", fontSize: 9 },
        detail: {
          valueAnimation: true, offsetCenter: [0, "38%"], fontSize: 26, fontWeight: 700,
          fontFamily: "'JetBrains Mono', monospace",
          color: state === "ALERT" ? "#EF6461" : state === "ELEVATED" ? "#F5B544" : "#5EDCE5",
          formatter: value == null ? "—" : "{value}",
        },
        title: { show: false },
        data: [{ value: value == null ? 0 : Math.round(value) }],
      },
    ],
  }), [value, state]);

  return <EChart option={option} height={height} />;
}
