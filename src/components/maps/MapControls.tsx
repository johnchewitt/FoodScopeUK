import { Focus, Globe, Map as MapIcon, Minus, Plus } from "lucide-react";
import { canFramePartners, useAppStore } from "@/state/store";
import { BasemapControl } from "./BasemapControl";

/** Bespoke map controls (map components' widget-style UI is not used; ADR-02). */
export function MapControls() {
  const issue = useAppStore((s) => s.issueMapCommand);
  const ready = useAppStore((s) => s.mapStatus === "ready");
  const canFrame = useAppStore(canFramePartners);
  if (!ready) return null;
  return (
    <div
      className="map-controls glass"
      role="toolbar"
      aria-label="Map navigation"
      aria-orientation="vertical"
    >
      <button
        type="button"
        className="map-ctl"
        onClick={() => issue({ type: "zoom", direction: "in" })}
        aria-label="Zoom in"
      >
        <Plus size={17} aria-hidden="true" />
      </button>
      <button
        type="button"
        className="map-ctl"
        onClick={() => issue({ type: "zoom", direction: "out" })}
        aria-label="Zoom out"
      >
        <Minus size={17} aria-hidden="true" />
      </button>
      <span className="map-ctl-sep" aria-hidden="true" />
      {canFrame && (
        <button
          type="button"
          className="map-ctl"
          onClick={() => issue({ type: "goTo", target: "partners" })}
          aria-label="Fit the map to the UK and its recorded import partners"
          title="Fit to recorded partners (F)"
        >
          <Focus size={17} aria-hidden="true" />
        </button>
      )}
      <button
        type="button"
        className="map-ctl"
        onClick={() => issue({ type: "goTo", target: "world" })}
        aria-label="Show the world"
      >
        <Globe size={17} aria-hidden="true" />
      </button>
      <button
        type="button"
        className="map-ctl"
        onClick={() => issue({ type: "goTo", target: "uk" })}
        aria-label="Show the United Kingdom"
      >
        <MapIcon size={17} aria-hidden="true" />
      </button>
      <BasemapControl />
    </div>
  );
}
