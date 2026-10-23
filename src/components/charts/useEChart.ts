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
    components.GridComponent,
    components.TooltipComponent,
    components.VisualMapComponent,
    components.DatasetComponent,
    components.AriaComponent,
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

/** Initialises a chart when `option` is non-null; updates without recreating; disposes on unmount. */
export function useEChart(
  option: EChartsCoreOption | null,
  opts: { reducedMotion?: boolean } = {},
): UseEChartResult {
  const ref = useRef<HTMLDivElement | null>(null);
  const chartRef = useRef<EChartsType | null>(null);
  const [status, setStatus] = useState<UseEChartResult["status"]>("idle");
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!option || !ref.current) return;
    let cancelled = false;
    const el = ref.current;
    const apply = (chart: EChartsType) =>
      chart.setOption(
        { animation: !opts.reducedMotion, aria: { enabled: true }, ...option },
        { notMerge: true },
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
  }, [option, opts.reducedMotion]);

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
