import { BookOpenCheck, CircleCheck, CircleDashed, PanelRightClose, TriangleAlert } from "lucide-react";
import type { ReactNode } from "react";
import { getModule } from "@/app/modules";
import { ChartFrame } from "@/components/charts/ChartFrame";
import { EmptyState } from "@/components/states/EmptyState";
import { PartialNotice } from "@/components/states/Notice";
import { SkeletonLines } from "@/components/states/Skeleton";
import { principlesById } from "@/content/principles";
import { OriginsInsights } from "@/features/origins/OriginsInsights";
import { AccessInsightsLazy } from "@/features/access/lazy";
import { ProfileInsightsLazy } from "@/features/profiles/lazy";
import { RiskInsightsLazy } from "@/features/risks/lazy";
import { SeasonalInsightsLazy } from "@/features/seasonal/lazy";
import { BASEMAP_STATUS_ID, REFERENCE_DATASET_ID, REFERENCE_LAYER_ID } from "@/map/layerIds";
import { basemapMode, readArcgisEnv } from "@/services/arcgis/env";
import { describeDataError } from "@/services/data/errors";
import { familySnapshot, findDataset, useAppConfig, useManifest } from "@/services/data/queries";
import { ErrorBoundary } from "@/app/ErrorBoundary";
import { selectRequestedMapStyle, useAppStore } from "@/state/store";
import type { MapStyle } from "@/styles/palette";

const BASEMAP_TITLES: Record<MapStyle, string> = {
  dark: "Esri dark grey basemap",
  light: "Esri light grey basemap",
  imagery: "Esri imagery with labels",
};

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
  const requestedStyle = useAppStore(selectRequestedMapStyle);
  const reference = findDataset(manifest.data, REFERENCE_DATASET_ID);
  const statistical = manifest.data?.datasets.filter((d) => d.role === "statistical") ?? [];
  const tradeDatasets = statistical.filter((d) => d.id.startsWith("trade.") && d.id !== "trade.index");
  const localDatasets = statistical.filter((d) => d.id.startsWith("local."));
  const tradeSnapshot = familySnapshot(manifest.data, "trade");
  const localSnapshot = familySnapshot(manifest.data, "local");
  const areasSnapshot = familySnapshot(manifest.data, "areas");
  const contextSnapshot = familySnapshot(manifest.data, "context");
  const registerSnapshot = familySnapshot(manifest.data, "register");
  const riskSnapshot = familySnapshot(manifest.data, "risk");

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
        ) : module === "access" ? (
          <ErrorBoundary region="UK Food Access insights">
            <AccessInsightsLazy />
          </ErrorBoundary>
        ) : module === "profiles" ? (
          <ErrorBoundary region="Local Authority Profile">
            <ProfileInsightsLazy />
          </ErrorBoundary>
        ) : module === "risks" ? (
          <ErrorBoundary region="Risk Explorer">
            <RiskInsightsLazy />
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
              {tradeSnapshot && tradeDatasets.length > 0 ? (
                <StatusItem
                  tone="ok"
                  title={`Trade snapshot ${tradeSnapshot}`}
                  detail={`HMRC Overseas Trade Statistics for ${tradeDatasets.length} commodities, ${tradeDatasets[0]?.referencePeriod ?? ""}. Used by Food Origins and Seasonal Supply.`}
                />
              ) : (
                <StatusItem
                  tone="pending"
                  title="No statistics loaded"
                  detail="Trade, retail and population data arrive from build stage 2 onward. Nothing on screen is a statistic yet."
                />
              )}
              {localSnapshot && localDatasets.length > 0 && (
                <StatusItem
                  tone="ok"
                  title={`Stores and population snapshot ${localSnapshot}`}
                  detail="GEOLYTIX grocery stores (June 2026), ONS mid-2025 population and May 2025 council boundaries. Used by UK Food Access and Local Authority Profiles."
                />
              )}
              {contextSnapshot && (
                <StatusItem
                  tone="ok"
                  title={`Council context snapshot ${contextSnapshot}`}
                  detail="Urban/rural class (ONS 2021), Census 2021 car availability per council, and Defra UK production (2025). Used by Local Authority Profiles."
                />
              )}
              {areasSnapshot && (
                <StatusItem
                  tone="ok"
                  title={`Small areas snapshot ${areasSnapshot}`}
                  detail="Census 2021 small areas, deprivation and the Priority Places for Food Index for the deep profiles (Belfast, Manchester), one council at a time."
                />
              )}
              {registerSnapshot && (
                <StatusItem
                  tone="ok"
                  title={`NI food register snapshot ${registerSnapshot}`}
                  detail="Northern Ireland grocers from the FSA register that GEOLYTIX does not map: an optional layer, never counted in rates."
                />
              )}
              {riskSnapshot && (
                <StatusItem
                  tone="ok"
                  title={`Risk evidence snapshot ${riskSnapshot}`}
                  detail="FAO water stress (World Bank), DfT major ports 2015–2025, UKFSR 2024 port and road evidence, OS Open Roads, Defra June survey 2025 by region and the Priority Places for Food Index by council. Used by the Risk Explorer."
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
                title={mode === "esri-dark-gray" ? BASEMAP_TITLES[requestedStyle] : "Offline outline map"}
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

        {module !== "origins" &&
          module !== "seasonal" &&
          module !== "access" &&
          module !== "profiles" &&
          module !== "risks" && (
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
