import { BookOpenCheck, CircleCheck, CircleDashed, PanelRightClose, TriangleAlert } from "lucide-react";
import type { ReactNode } from "react";
import { getModule } from "@/app/modules";
import { ChartFrame } from "@/components/charts/ChartFrame";
import { EmptyState } from "@/components/states/EmptyState";
import { PartialNotice } from "@/components/states/Notice";
import { SkeletonLines } from "@/components/states/Skeleton";
import { principlesById } from "@/content/principles";
import { OriginsInsights } from "@/features/origins/OriginsInsights";
import { SeasonalInsightsLazy } from "@/features/seasonal/lazy";
import { BASEMAP_STATUS_ID, REFERENCE_DATASET_ID, REFERENCE_LAYER_ID } from "@/map/layerIds";
import { basemapMode, readArcgisEnv } from "@/services/arcgis/env";
import { describeDataError } from "@/services/data/errors";
import { findDataset, useAppConfig, useManifest } from "@/services/data/queries";
import { ErrorBoundary } from "@/app/ErrorBoundary";
import { useAppStore } from "@/state/store";

const KEY_GUIDE_URL = "https://github.com/johnchewitt/FoodScopeUK/blob/main/docs/setup/arcgis-api-key.md";

type Tone = "ok" | "warn" | "pending";

function StatusItem({ tone, title, detail }: { tone: Tone; title: string; detail?: ReactNode }) {
  const Icon = tone === "ok" ? CircleCheck : tone === "warn" ? TriangleAlert : CircleDashed;
  return (
    <li>
      <Icon size={16} className="status-list__icon" data-tone={tone} aria-hidden="true" />
      <span>
        <span className="status-list__title">{title}</span>
        {detail && <span className="status-list__detail">{detail}</span>}
      </span>
    </li>
  );
}

/** Right-hand insights panel: what this view will show, what data is loaded, and the rules it follows. */
export function InsightsPanel() {
  const module = useAppStore((s) => s.module);
  const open = useAppStore((s) => s.insightsOpen);
  const toggle = useAppStore((s) => s.toggleInsights);
  const openOverlay = useAppStore((s) => s.openOverlay);
  const mapStatus = useAppStore((s) => s.mapStatus);
  const referenceLayer = useAppStore((s) => s.layerStatus[REFERENCE_LAYER_ID]);
  const basemapLayer = useAppStore((s) => s.layerStatus[BASEMAP_STATUS_ID]);
  const manifest = useManifest();
  const config = useAppConfig();
  const mod = getModule(module);
  const mode = basemapMode(readArcgisEnv().apiKey);
  const reference = findDataset(manifest.data, REFERENCE_DATASET_ID);
  const statistical = manifest.data?.datasets.filter((d) => d.role === "statistical") ?? [];
  const tradeDatasets = statistical.filter((d) => d.id.startsWith("trade.") && d.id !== "trade.index");

  const failed: string[] = [];
  if (config.isError) failed.push("app configuration (defaults used)");
  if (manifest.isError) failed.push("data index");

  return (
    <aside
      id="insights-panel"
      className="panel insights-panel glass"
      data-open={open}
      aria-label="Insights"
      aria-hidden={!open}
      inert={!open}
    >
      <div className="panel__header">
        <div className="panel__heading">
          <h2 className="panel__title">Insights</h2>
          <p className="panel__subtitle">{mod.label}</p>
        </div>
        <button type="button" className="tool-btn" onClick={() => toggle(false)} aria-label="Hide insights">
          <PanelRightClose size={17} aria-hidden="true" />
        </button>
      </div>

      <div className="panel__body scroll-area">
        {module === "origins" ? (
          <ErrorBoundary region="Food Origins insights">
            <OriginsInsights />
          </ErrorBoundary>
        ) : module === "seasonal" ? (
          <ErrorBoundary region="Seasonal Supply insights">
            <SeasonalInsightsLazy />
          </ErrorBoundary>
        ) : (
          <section className="panel-section" aria-labelledby="about-heading">
            <h3 id="about-heading" className="panel-section__title">
              What this view will show
            </h3>
            <p>{mod.summary}</p>
            <p>
              {mod.release > 1 ? `Planned for Release ${mod.release}` : `Built in stage ${mod.buildStage}`}.
              Requirements <code>{mod.requirementIds}</code>.
            </p>
          </section>
        )}

        <section className="panel-section" aria-labelledby="status-heading">
          <h3 id="status-heading" className="panel-section__title">
            Data loaded now
          </h3>
          {failed.length > 0 && <PartialNotice failed={failed} />}
          {manifest.isPending ? (
            <SkeletonLines label="Loading data status" />
          ) : (
            <ul className="status-list" style={{ marginTop: failed.length ? 12 : 0 }}>
              {manifest.data?.snapshotId && tradeDatasets.length > 0 ? (
                <StatusItem
                  tone="ok"
                  title={`Trade snapshot ${manifest.data.snapshotId}`}
                  detail={`HMRC Overseas Trade Statistics for ${tradeDatasets.length} commodities, ${tradeDatasets[0]?.referencePeriod ?? ""}. Used by Food Origins and Seasonal Supply.`}
                />
              ) : (
                <StatusItem
                  tone="pending"
                  title="No statistics loaded"
                  detail="Trade, retail and population data arrive from build stage 2 onward. Nothing on screen is a statistic yet."
                />
              )}
              {manifest.isError ? (
                <StatusItem
                  tone="warn"
                  title="Data index unavailable"
                  detail={describeDataError(manifest.error)}
                />
              ) : reference ? (
                <StatusItem
                  tone={
                    referenceLayer?.status === "error"
                      ? "warn"
                      : referenceLayer?.status === "ready"
                        ? "ok"
                        : "pending"
                  }
                  title="Country outlines"
                  detail={
                    referenceLayer?.status === "error"
                      ? `Failed to draw: ${referenceLayer.message ?? "unknown error"}`
                      : `${reference.referencePeriod}, 1:110m, ${reference.featureCount ?? "?"} countries and territories. Reference geometry only.`
                  }
                />
              ) : null}
              <StatusItem
                tone={
                  mode === "esri-dark-gray"
                    ? basemapLayer?.status === "ready"
                      ? "ok"
                      : basemapLayer?.status === "error"
                        ? "warn"
                        : "pending"
                    : "pending"
                }
                title={mode === "esri-dark-gray" ? "Esri dark grey basemap" : "Offline outline map"}
                detail={
                  mode === "esri-dark-gray" ? (
                    basemapLayer?.status === "error" ? (
                      (basemapLayer.message ?? "The Esri basemap could not be loaded.")
                    ) : basemapLayer?.status === "ready" ? (
                      "Basemap styles service, authorised by the site's API key."
                    ) : (
                      "Loading the basemap styles service."
                    )
                  ) : (
                    <>
                      No ArcGIS API key is configured for this build, so the map uses country outlines only.{" "}
                      <a href={KEY_GUIDE_URL} target="_blank" rel="noreferrer">
                        How to add a key
                      </a>
                    </>
                  )
                }
              />
            </ul>
          )}
        </section>

        {module !== "origins" && module !== "seasonal" && (
          <section className="panel-section">
            <ChartFrame
              title="Trend"
              option={null}
              emptyTitle="No chart yet"
              emptyBody={
                mod.release > 1
                  ? `Charts for this module are planned for Release ${mod.release}.`
                  : `Charts are drawn from real data once it is added in build stage ${mod.buildStage}.`
              }
            />
          </section>
        )}

        <section className="panel-section" aria-labelledby="principles-heading">
          <h3 id="principles-heading" className="panel-section__title">
            How to read this view
          </h3>
          <ul className="principles">
            {principlesById(mod.principles).map((p) => (
              <li key={p.id}>
                <span className="principles__id">{p.id}</span>
                <span className="principles__text">
                  <strong>{p.title}</strong>
                  <span>{p.detail}</span>
                </span>
              </li>
            ))}
          </ul>
          <div style={{ marginTop: 14 }}>
            <button type="button" className="text-btn" onClick={() => openOverlay("evidence")}>
              <BookOpenCheck size={16} aria-hidden="true" /> Evidence and limitations
            </button>
          </div>
        </section>

        {mapStatus === "error" && (
          <section className="panel-section">
            <EmptyState
              title="The map is unavailable"
              body="Panels still work. Reload the page to try the map again."
            />
          </section>
        )}
      </div>
    </aside>
  );
}
