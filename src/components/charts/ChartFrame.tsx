import type { EChartsCoreOption } from "echarts/core";
import { useMemo, type ReactNode } from "react";
import { EmptyState } from "@/components/states/EmptyState";
import { ErrorState } from "@/components/states/ErrorState";
import { Skeleton } from "@/components/states/Skeleton";
import { useAppStore, selectReducedMotion } from "@/state/store";
import { useEChart, type ChartEventHandlers } from "./useEChart";

interface Props {
  title: string;
  /** Null renders the empty state — charts never draw without data (P14). */
  option: EChartsCoreOption | null;
  emptyTitle?: string;
  emptyBody?: ReactNode;
  /** Text alternative describing the chart's data (AX-06). */
  description?: string;
  onEvents?: ChartEventHandlers;
  height?: number;
  /** Extra content under the chart, e.g. a data table (AX-06) or a legend. */
  children?: ReactNode;
  /** Small heading-side content (provenance badge, chips). */
  meta?: ReactNode;
}

export function ChartFrame({
  title,
  option,
  emptyTitle = "No data to chart yet",
  emptyBody,
  description,
  onEvents,
  height = 180,
  children,
  meta,
}: Props) {
  const reducedMotion = useAppStore(selectReducedMotion);
  // ECharts' aria component writes the container's accessible name; supply our description
  // when given, otherwise ECharts generates one from the data (AX-06).
  const fullOption = useMemo(
    () =>
      option
        ? { ...option, aria: { enabled: true, ...(description ? { label: { description } } : {}) } }
        : null,
    [option, description],
  );
  const { ref, status, error } = useEChart(fullOption, { reducedMotion, onEvents });

  return (
    <figure className="chart-frame" style={{ margin: 0 }}>
      <figcaption className="chart-frame__caption">
        <span className="panel-section__title">{title}</span>
        {meta}
      </figcaption>
      {!option && <EmptyState title={emptyTitle} body={emptyBody} />}
      {option && status === "loading" && <Skeleton height={height} label={`Loading ${title}`} />}
      {option && status === "error" && (
        <ErrorState title="Chart could not be drawn" body={error ?? undefined} />
      )}
      {option && (
        <div
          ref={ref}
          className="chart-frame__canvas"
          role="img"
          aria-label={description ?? title}
          hidden={status !== "ready"}
          style={{ height }}
        />
      )}
      {option && children}
    </figure>
  );
}
