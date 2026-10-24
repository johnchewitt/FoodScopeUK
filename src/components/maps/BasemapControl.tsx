import { Layers } from "lucide-react";
import { useEffect, useId, useRef, useState } from "react";
import { selectImageryAvailable, selectRequestedMapStyle, useAppStore } from "@/state/store";
import type { BasemapId } from "@/state/urlState";

const OPTIONS: { id: BasemapId; label: string; hint: string }[] = [
  { id: "dark", label: "Dark grey", hint: "Default" },
  { id: "light", label: "Light grey", hint: "For presentations, bright rooms and print" },
  { id: "imagery", label: "Imagery", hint: "With labels; at local scale only" },
];

/**
 * Curated basemap choice (SH-08, ADR-02): dark grey, light grey, and imagery at local scale in
 * the local modules. A bespoke map control, keyboard operable; the choice is in the URL (`bm`).
 * Hidden without an API key, when the offline outline map is used.
 */
export function BasemapControl() {
  const available = useAppStore((s) => s.basemapChoice);
  const basemap = useAppStore((s) => s.basemap);
  const setBasemap = useAppStore((s) => s.setBasemap);
  const requested = useAppStore(selectRequestedMapStyle);
  const imagery = useAppStore(selectImageryAvailable);
  const module = useAppStore((s) => s.module);
  const [open, setOpen] = useState(false);
  const panelId = useId();
  const root = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!open) return;
    const onDown = (e: PointerEvent) => {
      if (root.current && !root.current.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("pointerdown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("pointerdown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  if (!available) return null;
  const localModule = module === "access" || module === "profiles";
  const imageryNote = imagery
    ? null
    : basemap === "imagery"
      ? `Imagery is chosen: dark grey is shown until ${
          localModule ? "you zoom in to local scale" : "you open UK Food Access and zoom in to local scale"
        }.`
      : localModule
        ? "Zoom in to local scale (about 1:144,000) to choose imagery."
        : "Imagery is offered in UK Food Access at local scale.";
  return (
    <div className="basemap-control" ref={root}>
      <button
        type="button"
        className="map-ctl"
        aria-expanded={open}
        aria-controls={open ? panelId : undefined}
        aria-label={`Basemap: ${OPTIONS.find((o) => o.id === requested)?.label ?? "Dark grey"}. Change basemap`}
        title="Basemap"
        onClick={() => setOpen((v) => !v)}
      >
        <Layers size={17} aria-hidden="true" />
      </button>
      {open && (
        <fieldset id={panelId} className="basemap-control__panel glass">
          <legend className="basemap-control__title">Basemap</legend>
          {OPTIONS.map((o) => {
            const disabled = o.id === "imagery" && !imagery;
            return (
              <label key={o.id} className="basemap-option" data-disabled={disabled || undefined}>
                <input
                  type="radio"
                  name={`${panelId}-basemap`}
                  value={o.id}
                  checked={basemap === o.id}
                  disabled={disabled && basemap !== "imagery"}
                  onChange={() => setBasemap(o.id)}
                />
                <span
                  className={`basemap-option__swatch basemap-option__swatch--${o.id}`}
                  aria-hidden="true"
                />
                <span className="basemap-option__text">
                  <span>{o.label}</span>
                  <span className="basemap-option__hint">{o.hint}</span>
                </span>
              </label>
            );
          })}
          {imageryNote && <p className="basemap-control__note">{imageryNote}</p>}
        </fieldset>
      )}
    </div>
  );
}
