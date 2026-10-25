import { useEffect, useRef, useState, type RefObject } from "react";
import type * as EChartsCore from "echarts/core";
import type { EChartsCoreOption, EChartsType } from "echarts/core";

/**
 * Thin ECharts hook (architecture §2). ECharts is imported lazily and only the chart types and
 * components FOODSCOPE uses are registered, keeping the main bundle small.
 */
export async function loadECharts(): Promise<typeof EChartsCore> {
  const [core, charts, components, renderers] = await Promise.all([
    import("echarts/core"),
    import("echarts/charts"),
    import("echarts/components"),
    import("echarts/renderers"),
  ]);
  core.use([
    charts.LineChart,
    charts.BarChart,
    charts.HeatmapChart,
    charts.PieChart,
    components.GridComponent,
    components.TooltipComponent,
    components.VisualMapComponent,
    components.DatasetComponent,
    components.AriaComponent,
    components.MarkLineComponent,
    components.MarkAreaComponent,
    components.GraphicComponent,
    renderers.SVGRenderer,
    renderers.CanvasRenderer,
  ]);
  return core;
}

export interface UseEChartResult {
  ref: RefObject<HTMLDivElement | null>;
  status: "idle" | "loading" | "ready" | "error";
  error: string | null;
}

/** Chart event parameters used by FOODSCOPE (subset of ECharts' ECElementEvent). */
export interface ChartEventParams {
  name?: string;
  value?: unknown;
  dataIndex?: number;
  seriesName?: string;
  data?: unknown;
}
export type ChartEventHandlers = Partial<Record<"click", (params: ChartEventParams) => void>>;

/**
 * Initialises a chart when `option` is non-null; updates without recreating; disposes on unmount.
 * `merge` keeps series with stable ids and animates the change (≤ 300 ms, SS-02) instead of
 * redrawing from scratch; series missing from the new option are removed (`replaceMerge`).
 */
export function useEChart(
  option: EChartsCoreOption | null,
  opts: { reducedMotion?: boolean; onEvents?: ChartEventHandlers; merge?: boolean } = {},
): UseEChartResult {
  const ref = useRef<HTMLDivElement | null>(null);
  const chartRef = useRef<EChartsType | null>(null);
  // Handlers are read through a ref so a new callback never re-initialises the chart.
  const handlersRef = useRef<ChartEventHandlers | undefined>(opts.onEvents);
  useEffect(() => {
    handlersRef.current = opts.onEvents;
  });
  const [status, setStatus] = useState<UseEChartResult["status"]>("idle");
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!option || !ref.current) return;
    let cancelled = false;
    const el = ref.current;
    const apply = (chart: EChartsType) =>
      chart.setOption(
        {
          animation: !opts.reducedMotion,
          animationDurationUpdate: 300,
          animationEasingUpdate: "cubicOut",
          aria: { enabled: true },
          ...option,
        },
        opts.merge ? { replaceMerge: ["series", "xAxis", "yAxis", "grid"] } : { notMerge: true },
      );

    if (chartRef.current) {
      apply(chartRef.current);
      return;
    }
    setStatus("loading");
    loadECharts()
      .then((echarts) => {
        if (cancelled) return;
        const chart = echarts.init(el, undefined, { renderer: "svg" });
        chartRef.current = chart;
        chart.on("click", (params) => handlersRef.current?.click?.(params as ChartEventParams));
        apply(chart);
        setStatus("ready");
      })
      .catch((err: unknown) => {
        if (cancelled) return;
        setError(err instanceof Error ? err.message : "Chart failed to load");
        setStatus("error");
      });
    return () => {
      cancelled = true;
    };
  }, [option, opts.reducedMotion, opts.merge]);

  useEffect(() => {
    const el = ref.current;
    if (!el || typeof ResizeObserver === "undefined") return;
    const ro = new ResizeObserver(() => chartRef.current?.resize());
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  useEffect(
    () => () => {
      chartRef.current?.dispose();
      chartRef.current = null;
    },
    [],
  );

  return { ref, status, error };
}
