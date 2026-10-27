import { Building2, Globe2, Lightbulb, Search } from "lucide-react";
import { useEffect, useId, useMemo, useRef, useState, type KeyboardEvent } from "react";
import { validateLadIndicators } from "@/features/access/validate";
import { useTradeIndex } from "@/features/origins/useOrigins";
import { LOCAL_INDICATORS_DATASET_ID } from "@/map/layerIds";
import { useValidatedDataset } from "@/services/data/useDataset";
import { useAppStore } from "@/state/store";
import { searchAll, type SearchHit } from "./model";

/** One action of a hit: where it takes the user. */
interface Action {
  label: string;
  run: () => void;
}

/**
 * Search across FOODSCOPE UK (top bar, "/" key): councils open their profile or assessment,
 * commodities open Food Origins or their assessment, modules open the module. Results are a list of
 * buttons; arrow keys move between them from the search box.
 */
export function SearchDialog() {
  const open = useAppStore((s) => s.overlay === "search");
  const close = useAppStore((s) => s.closeOverlay);
  const [query, setQuery] = useState("");
  const input = useRef<HTMLInputElement | null>(null);
  const list = useRef<HTMLUListElement | null>(null);
  const listId = useId();
  const councilsDoc = useValidatedDataset(open ? LOCAL_INDICATORS_DATASET_ID : null, validateLadIndicators);
  const index = useTradeIndex();
  const s = useAppStore.getState;

  // Mounted only while open (lazy.tsx), so the query starts empty each time.
  useEffect(() => {
    if (!open) return;
    const t = window.setTimeout(() => input.current?.focus(), 50);
    return () => window.clearTimeout(t);
  }, [open]);

  const groups = useMemo(() => new Map((index.data?.groups ?? []).map((g) => [g.id, g.label])), [index.data]);
  const hits = useMemo(
    () =>
      searchAll(query, councilsDoc.data?.councils ?? [], index.data?.commodities ?? [], (id) =>
        id ? (groups.get(id) ?? null) : null,
      ),
    [query, councilsDoc.data, index.data, groups],
  );

  const go = (fn: () => void) => {
    fn();
    close();
  };
  const actionsOf = (h: SearchHit): Action[] => {
    switch (h.kind) {
      case "council":
        return [
          { label: "Profile", run: () => go(() => (s().setModule("profiles"), s().setLad(h.code))) },
          {
            label: "Assessment",
            run: () =>
              go(() => (s().setLad(h.code), s().setInsightsKind("authority"), s().setModule("insights"))),
          },
        ];
      case "commodity":
        return [
          { label: "Food Origins", run: () => go(() => (s().setCommodity(h.id), s().setModule("origins"))) },
          {
            label: "Assessment",
            run: () =>
              go(() => (s().setCommodity(h.id), s().setInsightsKind("commodity"), s().setModule("insights"))),
          },
        ];
      case "module":
        return [{ label: "Open", run: () => go(() => s().setModule(h.id)) }];
    }
  };

  const onKey = (e: KeyboardEvent<HTMLElement>) => {
    if (e.key !== "ArrowDown" && e.key !== "ArrowUp") return;
    const buttons = [...(list.current?.querySelectorAll<HTMLButtonElement>("button") ?? [])];
    if (buttons.length === 0) return;
    e.preventDefault();
    const i = buttons.indexOf(document.activeElement as HTMLButtonElement);
    const next = e.key === "ArrowDown" ? (i + 1) % buttons.length : i <= 0 ? -1 : i - 1;
    if (next < 0) input.current?.focus();
    else buttons[next]?.focus();
  };

  const total = hits.councils.length + hits.commodities.length + hits.modules.length;
  const section = (title: string, icon: typeof Search, items: SearchHit[]) => {
    if (items.length === 0) return null;
    const Icon = icon;
    return (
      <li className="search-group">
        <p className="search-group__title">
          <Icon size={14} aria-hidden="true" /> {title}
        </p>
        <ul>
          {items.map((h) => {
            const name = h.kind === "council" ? h.name : h.label;
            const meta =
              h.kind === "council"
                ? `${h.nation} · ${h.code}`
                : h.kind === "commodity"
                  ? `${h.hsScope}${h.group ? ` · ${h.group}` : ""}`
                  : h.question;
            return (
              <li key={`${h.kind}-${name}`} className="search-hit">
                <span className="search-hit__text">
                  <span className="search-hit__name">{name}</span>
                  <span className="search-hit__meta">{meta}</span>
                </span>
                <span className="search-hit__actions">
                  {actionsOf(h).map((a) => (
                    <button
                      key={a.label}
                      type="button"
                      className="chip-btn chip-btn--small"
                      onClick={a.run}
                      aria-label={`${a.label}: ${name}`}
                    >
                      {a.label}
                    </button>
                  ))}
                </span>
              </li>
            );
          })}
        </ul>
      </li>
    );
  };

  return (
    <calcite-dialog
      open={open}
      modal
      heading="Search FOODSCOPE UK"
      description="Councils, commodities and modules"
      widthScale="m"
      oncalciteDialogClose={() => close()}
    >
      {open && (
        <div className="dialog-body search-dialog" onKeyDown={onKey}>
          <label className="search-field">
            <Search size={15} aria-hidden="true" />
            <span className="visually-hidden">Search councils, commodities and modules</span>
            <input
              ref={input}
              type="search"
              className="search-field__input"
              placeholder="e.g. Belfast, coffee, Scenario Lab"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              aria-controls={listId}
              autoComplete="off"
            />
          </label>
          <p className="control-hint" role="status" aria-live="polite">
            {query.trim() === ""
              ? "Type a council name or code, a commodity or HS code, or a module."
              : total === 0
                ? `Nothing matches “${query.trim()}”.`
                : `${total} result${total === 1 ? "" : "s"}.`}
          </p>
          <ul id={listId} ref={list} className="search-groups" aria-label="Search results">
            {section("Councils", Building2, hits.councils)}
            {section("Commodities", Globe2, hits.commodities)}
            {section("Modules", Lightbulb, hits.modules)}
          </ul>
        </div>
      )}
    </calcite-dialog>
  );
}
