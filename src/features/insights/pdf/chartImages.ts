/**
 * Report charts as images for the PDF (EX-04): the same chart model as the panel, drawn light on
 * white with ECharts' canvas renderer off screen at 2.5× pixel ratio and exported as PNG.
 */
import { loadECharts } from "@/components/charts/useEChart";
import { reportChartOption } from "../charts";
import type { ReportChart } from "../report";
import type { PdfImage } from "./document";

const WIDTH = 760;
const PIXEL_RATIO = 2.5;

/** Chart height in CSS pixels at the PDF width (rows for horizontal bars, fixed for columns). */
export function pdfChartHeight(c: ReportChart): number {
  const legend = c.series.length > 1 ? 24 : 0;
  if (c.kind === "bar" || c.kind === "pairedBar") {
    const rows = c.categories.length * (c.kind === "pairedBar" ? 1.7 : 1);
    return Math.round(Math.max(110, 24 + rows * 26 + legend));
  }
  return 280 + legend;
}

export async function renderChartImages(charts: readonly ReportChart[]): Promise<Record<string, PdfImage>> {
  const echarts = await loadECharts();
  const { LegendComponent } = await import("echarts/components");
  echarts.use([LegendComponent]);
  const out: Record<string, PdfImage> = {};
  for (const c of charts) {
    const height = pdfChartHeight(c);
    const el = document.createElement("div");
    el.style.cssText = `position:fixed;left:-10000px;top:0;width:${WIDTH}px;height:${height}px;`;
    document.body.append(el);
    const chart = echarts.init(el, null, {
      renderer: "canvas",
      width: WIDTH,
      height,
      devicePixelRatio: PIXEL_RATIO,
    });
    try {
      chart.setOption(reportChartOption(c, "light", { animation: false, legend: true }));
      out[c.id] = {
        dataUrl: chart.getDataURL({ type: "png", pixelRatio: PIXEL_RATIO, backgroundColor: "#ffffff" }),
        widthPx: WIDTH * PIXEL_RATIO,
        heightPx: height * PIXEL_RATIO,
      };
    } finally {
      chart.dispose();
      el.remove();
    }
  }
  return out;
}
