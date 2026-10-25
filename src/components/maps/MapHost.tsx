import "@arcgis/map-components/components/arcgis-map";
import EsriMap from "@arcgis/core/Map";
import SpatialReference from "@arcgis/core/geometry/SpatialReference";
import TileInfo from "@arcgis/core/layers/support/TileInfo";
import MapViewConstraints from "@arcgis/core/views/2d/MapViewConstraints";
import ColorBackground from "@arcgis/core/webmap/background/ColorBackground";
import { useEffect, useMemo } from "react";
import { ErrorState } from "@/components/states/ErrorState";
import { MapController } from "@/map/MapController";
import { BASEMAP_STATUS_ID, REFERENCE_DATASET_ID } from "@/map/layerIds";
import { AccessLayersController } from "@/map/layers/access";
import { BasemapStatusController } from "@/map/layers/basemapStatus";
import { OriginsLayersController } from "@/map/layers/origins";
import { ReferenceOutlinesController } from "@/map/layers/referenceOutlines";
import { ViewStateController } from "@/map/layers/viewState";
import { GO_TO_TARGETS, type ViewLike } from "@/map/types";
import { createBasemap } from "@/services/arcgis/basemap";
import { readArcgisEnv } from "@/services/arcgis/env";
import { detectWebGL2 } from "@/services/arcgis/webgl";
import { datasetUrl, findDataset, useManifest } from "@/services/data/queries";
import {
  selectMapColourStyle,
  selectReducedMotion,
  selectRequestedMapStyle,
  useAppStore,
} from "@/state/store";

const MAP_LOAD_TIMEOUT_MS = 30_000;
const NAVY = "#071923";

/**
 * The single <arcgis-map> for the whole app (CLAUDE.md: mounted once, never re-mounted).
 * React passes configuration in; the MapController takes the view out (ADR-03).
 * Default export so App can load this module (and the SDK) lazily.
 */
export default function MapHost() {
  const status = useAppStore((s) => s.mapStatus);
  const error = useAppStore((s) => s.mapError);
  const setMapStatus = useAppStore((s) => s.setMapStatus);
  const basemapStatus = useAppStore((s) => s.layerStatus[BASEMAP_STATUS_ID]?.status);
  const reducedMotion = useAppStore(selectReducedMotion);
  const colourStyle = useAppStore(selectMapColourStyle);
  const setBasemapChoice = useAppStore((s) => s.setBasemapChoice);
  const manifest = useManifest();

  const env = useMemo(() => readArcgisEnv(), []);
  const webgl = useMemo(() => detectWebGL2(), []);
  // The first style comes from the URL (bm); imagery waits until the map is at local scale (SH-08).
  const initialStyle = useMemo(
    () => selectRequestedMapStyle({ ...useAppStore.getState(), basemapChoice: env.apiKey !== null }),
    [env.apiKey],
  );
  const basemap = useMemo(() => createBasemap(env.apiKey, initialStyle), [env.apiKey, initialStyle]);
  const map = useMemo(() => new EsriMap(basemap ? { basemap } : {}), [basemap]);
  const referenceLayer = useMemo(() => new ReferenceOutlinesController(basemap !== null), [basemap]);
  const basemapWatcher = useMemo(
    () =>
      new BasemapStatusController((style) => createBasemap(env.apiKey, style), {
        style: initialStyle,
        basemap,
      }),
    [env.apiKey, initialStyle, basemap],
  );
  const viewState = useMemo(
    () => new ViewStateController((rest) => useAppStore.getState().setMapView(rest)),
    [],
  );
  const accessLayers = useMemo(
    () =>
      new AccessLayersController({
        selectStore: (id) => useAppStore.getState().selectStore(id),
        selectCouncil: (code) => useAppStore.getState().selectCouncil(code),
        pickCouncil: (code) => useAppStore.getState().setLad(code),
        selectArea: (code) => useAppStore.getState().selectArea(code),
        setHoverAccess: (hover) => useAppStore.getState().setHoverAccess(hover),
        setHoverArea: (hover) => useAppStore.getState().setHoverArea(hover),
        setProximityPoint: (point) => useAppStore.getState().setProximityPoint(point),
      }),
    [],
  );
  const originsLayers = useMemo(
    () =>
      new OriginsLayersController({
        selectPartner: (key) => useAppStore.getState().selectPartner(key),
        setHoverPartner: (hover) => useAppStore.getState().setHoverPartner(hover),
      }),
    [],
  );
  const controller = useMemo(
    () =>
      new MapController(useAppStore, [
        referenceLayer,
        originsLayers,
        accessLayers,
        basemapWatcher,
        viewState,
      ]),
    [referenceLayer, originsLayers, accessLayers, basemapWatcher, viewState],
  );

  // The basemap choice exists only with an API key (SH-08); without one the outline map is used.
  useEffect(() => setBasemapChoice(env.apiKey !== null), [env.apiKey, setBasemapChoice]);
  const spatialReference = useMemo(() => SpatialReference.WebMercator, []);
  const background = useMemo(() => new ColorBackground({ color: NAVY }), []);
  // Without a basemap the view has no tiling scheme, so zoom levels must be supplied explicitly
  // (MapViewConstraints docs: set lods when the map has no basemap). Web Mercator LODs match
  // the Esri basemap used when a key is configured.
  const constraints = useMemo(
    () =>
      new MapViewConstraints({
        lods: TileInfo.create({ spatialReference: SpatialReference.WebMercator, numLODs: 20 }).lods,
        minZoom: 2,
        maxZoom: 18,
        rotationEnabled: false,
        snapToZoom: false,
      }),
    [],
  );

  // Feed the reference layer from the data manifest (real, checksummed data — not a hard-coded URL).
  useEffect(() => {
    if (manifest.isError) {
      referenceLayer.setSource(null, "Data index unavailable");
      return;
    }
    if (!manifest.data) return;
    const ds = findDataset(manifest.data, REFERENCE_DATASET_ID);
    if (ds) {
      referenceLayer.setSource(datasetUrl(ds));
      originsLayers.setSource(datasetUrl(ds));
    } else referenceLayer.setSource(null, "Country outlines are not listed in the data index");
  }, [manifest.data, manifest.isError, referenceLayer, originsLayers]);

  // Loading state with a timeout so a stalled map becomes an actionable error.
  useEffect(() => {
    if (!webgl) {
      setMapStatus("error", "This browser cannot display the map because WebGL2 is unavailable or disabled.");
      return;
    }
    if (useAppStore.getState().mapStatus !== "ready") setMapStatus("loading");
    const timer = window.setTimeout(() => {
      if (useAppStore.getState().mapStatus === "loading") {
        setMapStatus(
          "error",
          "The map did not finish loading within 30 seconds. Check your connection and reload.",
        );
      }
    }, MAP_LOAD_TIMEOUT_MS);
    return () => window.clearTimeout(timer);
  }, [webgl, setMapStatus]);

  useEffect(() => () => controller.detach(), [controller]);

  const handleReadyChange = (event: Event) => {
    const el = event.target as HTMLArcgisMapElement;
    if (!el.ready || controller.attached) return;
    controller.attach(el.view as unknown as ViewLike);
    setMapStatus("ready");
  };

  const handleReadyError = () => {
    setMapStatus("error", "The map could not be created. Reload the page to try again.");
  };

  return (
    <div
      className="map-host"
      data-map-state={status}
      data-basemap={basemap ? "esri" : "offline"}
      data-basemap-status={basemap ? (basemapStatus ?? "loading") : "none"}
      data-map-style={colourStyle}
    >
      {webgl && (
        <arcgis-map
          map={map}
          center={GO_TO_TARGETS.world.center}
          zoom={2}
          spatialReference={spatialReference}
          constraints={constraints}
          background={background}
          attributionMode={colourStyle === "light" ? "light" : "dark"}
          animationsDisabled={reducedMotion}
          popupDisabled
          onarcgisViewReadyChange={handleReadyChange}
          onarcgisViewReadyError={handleReadyError}
          aria-label="Map of the world. Use the map controls or the panels to navigate."
        />
      )}

      {status === "loading" && (
        <div className="map-overlay" aria-live="polite">
          <div className="map-overlay__card glass">
            <calcite-loader label="Loading map" scale="m" />
            <p>Loading map</p>
          </div>
        </div>
      )}
      {status === "error" && (
        <div className="map-overlay">
          <div style={{ maxWidth: 440 }}>
            <ErrorState
              title="The map could not be shown"
              body={error ?? "Unknown error."}
              actionLabel="Reload"
              onAction={() => window.location.reload()}
            />
          </div>
        </div>
      )}
    </div>
  );
}
