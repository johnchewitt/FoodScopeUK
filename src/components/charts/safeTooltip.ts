/**
 * Chart tooltips are HTML (ECharts sets them with innerHTML). The text in them comes from published
 * files (partner, retailer, council and small-area names), so as a defence in depth every tooltip
 * keeps only the plain line-break and bold tags our formatters use; any other tag, with its
 * attributes, is removed before ECharts sees it (Stage 8 security review).
 */
const ALLOWED = /^<\/?(?:br|b|strong)\s*\/?>$/i;

export function safeTooltipHtml(html: string): string {
  // A tag starts with "<" and a letter, "/" or "!" (a bare "<" as in "5 < 6" is text).
  return html.replace(/<[/!a-zA-Z][^>]*>?/g, (tag) => (ALLOWED.test(tag) ? tag : ""));
}

type Formatter = (...args: unknown[]) => unknown;

function wrap(tooltip: unknown): unknown {
  if (!tooltip || typeof tooltip !== "object") return tooltip;
  const t = tooltip as { formatter?: unknown };
  if (typeof t.formatter !== "function") return tooltip;
  const f = t.formatter as Formatter;
  return {
    ...t,
    formatter: (...args: unknown[]) => {
      const out = f(...args);
      return typeof out === "string" ? safeTooltipHtml(out) : out;
    },
  };
}

/** The option with every tooltip formatter's output sanitised (top level and per series). */
export function withSafeTooltips<T extends object>(option: T): T {
  const o = option as { tooltip?: unknown; series?: unknown };
  const out: Record<string, unknown> = { ...(option as Record<string, unknown>) };
  if (o.tooltip !== undefined) out.tooltip = Array.isArray(o.tooltip) ? o.tooltip.map(wrap) : wrap(o.tooltip);
  if (Array.isArray(o.series))
    out.series = o.series.map((s: unknown) =>
      s && typeof s === "object" && "tooltip" in s
        ? { ...(s as object), tooltip: wrap((s as { tooltip: unknown }).tooltip) }
        : s,
    );
  return out as T;
}
