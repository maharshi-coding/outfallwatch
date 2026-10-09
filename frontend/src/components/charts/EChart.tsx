import { useEffect, useRef } from "react";
import * as echarts from "echarts/core";
import { BarChart, GaugeChart, LineChart } from "echarts/charts";
import {
  GridComponent,
  LegendComponent,
  MarkAreaComponent,
  MarkLineComponent,
  TooltipComponent,
} from "echarts/components";
import { CanvasRenderer } from "echarts/renderers";

echarts.use([
  LineChart, BarChart, GaugeChart,
  GridComponent, TooltipComponent, MarkLineComponent, MarkAreaComponent, LegendComponent,
  CanvasRenderer,
]);

/** Thin React wrapper over ECharts core. Replaces options on change, auto-resizes. */
export function EChart({ option, height = 280, className }: {
  option: echarts.EChartsCoreOption;
  height?: number;
  className?: string;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const chart = useRef<echarts.ECharts | null>(null);

  useEffect(() => {
    if (!ref.current) return;
    chart.current = echarts.init(ref.current, undefined, { renderer: "canvas" });
    const ro = new ResizeObserver(() => chart.current?.resize());
    ro.observe(ref.current);
    return () => {
      ro.disconnect();
      chart.current?.dispose();
      chart.current = null;
    };
  }, []);

  useEffect(() => {
    chart.current?.setOption(option, true);
  }, [option]);

  return <div ref={ref} className={className} style={{ height, width: "100%" }} />;
}

export const OCEAN = {
  teal: "#00BFA6",
  cyan: "#5EDCE5",
  amber: "#F5B544",
  coral: "#EF6461",
  grid: "rgba(159,179,189,0.12)",
  axis: "#9fb3bd",
  tooltipBg: "#0B3954",
};
