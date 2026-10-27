import { Layers } from "lucide-react";
import { useEffect, useId, useLayoutEffect, useRef, useState } from "react";
import { selectMapShadesAreas, selectRequestedMapStyle, useAppStore } from "@/state/store";
import type { BasemapId } from "@/state/urlState";
import { DETAILED_STYLES } from "@/styles/palette";

interface Option {
  id: BasemapId;
  label: string;
  hint: string;
}

/** Offered under any map (SH-08). */
const ANYWHERE: Option[] = [
  { id: "dark", label: "Dark grey", hint: "Default" },
  { id: "light", label: "Light grey", hint: "Presentations, bright rooms, print" },
  { id: "human", label: "Human Geography", hint: "Light; quiet places and boundaries" },
  { id: "human-dark", label: "Human Geography dark", hint: "Dark; quiet places and boundaries" },
  { id: "imagery", label: "Imagery", hint: "Satellite and aerial, with labels" },
];

/** Detailed reference maps: offered only where the map draws lines and points (DETAILED_STYLES). */
const DETAILED: Option[] = [
  { id: "terrain", label: "Terrain", hint: "Shaded relief" },
  { id: "topographic", label: "Topographic", hint: "Detailed reference map" },
  { id: "natgeo", label: "National Geographic", hint: "Esri's National Geographic style" },
  { id: "osm", label: "OpenStreetMap", hint: "OpenStreetMap data, Esri's style" },
];

const LABELS = new Map([...ANYWHERE, ...DETAILED].map((o) => [o.id, o.label]));

/**
 * Curated basemap choice (SH-08, ADR-0022): five styles under any map, and four detailed
 * reference maps where the map draws only lines and points (roads, ports, stores, outlines). A
 * bespoke map control, keyboard operable; the choice is in the URL (`bm`) and kept while a
 * detailed style waits for a view without shaded areas. Hidden without an API key, when the
 * offline outline map is used.
 */
export function BasemapControl() {
  const available = useAppStore((s) => s.basemapChoice);
  const basemap = useAppStore((s) => s.basemap);
  const setBasemap = useAppStore((s) => s.setBasemap);
  const requested = useAppStore(selectRequestedMapStyle);
  const shades = useAppStore(selectMapShadesAreas);
  const [open, setOpen] = useState(false);
  const panelId = useId();
  const detailedId = useId();
  const root = useRef<HTMLDivElement | null>(null);
  // The panel opens down from the button; on short screens it scrolls within the space left
  // above the attribution bar rather than running off the map.
  const [maxHeight, setMaxHeight] = useState<number | undefined>(undefined);
  useLayoutEffect(() => {
    if (!open || !root.current) return;
    const top = root.current.getBoundingClientRect().top;
    setMaxHeight(Math.max(220, Math.round(window.innerHeight - top - 40)));
  }, [open]);

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
  const waiting = DETAILED_STYLES.includes(basemap) && requested !== basemap;
  const note = waiting
    ? `${LABELS.get(basemap)} is chosen: light grey is shown while the map shades areas, and ${LABELS.get(basemap)} returns where it draws only lines and points.`
    : shades
      ? "These are offered where the map draws only lines and points, such as roads, ports, stores and outlines, not shaded areas."
      : null;

  const option = (o: Option, offered: boolean) => (
    <label key={o.id} className="basemap-option" data-disabled={!offered || undefined}>
      <input
        type="radio"
        name={`${panelId}-basemap`}
        value={o.id}
        checked={basemap === o.id}
        disabled={!offered && basemap !== o.id}
        onChange={() => setBasemap(o.id)}
      />
      <span className={`basemap-option__swatch basemap-option__swatch--${o.id}`} aria-hidden="true" />
      <span className="basemap-option__text">
        <span>{o.label}</span> <span className="basemap-option__hint">{o.hint}</span>
      </span>
    </label>
  );

  return (
    <div className="basemap-control" ref={root}>
      <button
        type="button"
        className="map-ctl"
        aria-expanded={open}
        aria-controls={open ? panelId : undefined}
        aria-label={`Basemap: ${LABELS.get(requested) ?? "Dark grey"}. Change basemap`}
        title="Basemap"
        onClick={() => setOpen((v) => !v)}
      >
        <Layers size={17} aria-hidden="true" />
      </button>
      {open && (
        <fieldset id={panelId} className="basemap-control__panel glass" style={{ maxHeight }}>
          <legend className="basemap-control__title">Basemap</legend>
          {ANYWHERE.map((o) => option(o, true))}
          <div role="group" aria-labelledby={detailedId} className="basemap-control__group">
            <p id={detailedId} className="basemap-control__group-title">
              Lines and points only
            </p>
            {DETAILED.map((o) => option(o, !shades))}
            {note && <p className="basemap-control__note">{note}</p>}
          </div>
        </fieldset>
      )}
    </div>
  );
}
