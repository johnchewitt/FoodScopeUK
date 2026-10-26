import { Search } from "lucide-react";
import type { KeyboardEvent } from "react";
import { useId, useMemo, useRef, useState } from "react";
import { Notice } from "@/components/states/Notice";
import { useAppStore } from "@/state/store";
import type { TradeIndex } from "@/types/generated/trade-index";
import { CommodityIcon } from "./CommodityIcon";
import { bestMatch, commoditySections, filterSections, normaliseQuery } from "./commodityGroups";
import { resolveCommodity } from "./useOrigins";

/** From this many baskets, the picker offers a search box and compact, grouped columns (B11). */
export const COMMODITY_SEARCH_FROM = 8;

/**
 * Commodity selector (FO-01): one radio group with icons and HS scope; arrow keys, Home and End
 * move the selection through the options shown. With many baskets the options are grouped (the
 * snapshot's groups: SITC divisions as Defra uses them) and a search box filters them by name,
 * group, what it includes or commodity code; Enter picks the best match (a name first), Escape clears.
 * Shared by Food Origins, Seasonal Supply and the Risk Explorer (the commodity is shared state).
 */
export function CommodityPicker({
  index,
  unknownCommodity,
}: {
  index: TradeIndex;
  unknownCommodity: boolean;
}) {
  const commodity = useAppStore((s) => s.commodity);
  const setCommodity = useAppStore((s) => s.setCommodity);
  const [query, setQuery] = useState("");
  const listRef = useRef<HTMLDivElement | null>(null);
  const baseId = useId();
  const listId = `${baseId}-list`;
  const active = resolveCommodity(index, commodity);
  const many = index.commodities.length >= COMMODITY_SEARCH_FROM;
  const sections = useMemo(() => commoditySections(index), [index]);
  const visible = useMemo(() => (many ? filterSections(sections, query) : sections), [many, sections, query]);
  const ids = visible.flatMap((s) => s.items.map((c) => c.id));
  // Roving focus: the selected option, or the best match shown when the search hides it.
  const tabStop = active && ids.includes(active.id) ? active.id : (bestMatch(visible, query) ?? ids[0]);
  const activeHidden = Boolean(active && !ids.includes(active.id));

  // Ids match ^[a-z][a-z0-9-]*$ (URL pattern), so they need no escaping in a selector.
  const focusOption = (id: string) =>
    listRef.current?.querySelector<HTMLButtonElement>(`[role=radio][data-id="${id}"]`)?.focus();

  const onListKey = (e: KeyboardEvent<HTMLDivElement>) => {
    if (ids.length === 0) return;
    const i = ids.indexOf(tabStop ?? "");
    let next = -1;
    if (e.key === "ArrowDown" || e.key === "ArrowRight") next = (i + 1) % ids.length;
    else if (e.key === "ArrowUp" || e.key === "ArrowLeft") next = (i - 1 + ids.length) % ids.length;
    else if (e.key === "Home") next = 0;
    else if (e.key === "End") next = ids.length - 1;
    if (next < 0) return;
    e.preventDefault();
    setCommodity(ids[next]!);
    focusOption(ids[next]!);
  };

  const onSearchKey = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter") {
      // Only a search picks: Enter in an empty box changes nothing.
      const best = bestMatch(visible, query);
      if (best) {
        e.preventDefault();
        setCommodity(best);
      }
    } else if (e.key === "Escape" && query !== "") {
      e.preventDefault();
      setQuery("");
    } else if (e.key === "ArrowDown" && tabStop) {
      e.preventDefault();
      focusOption(tabStop);
    }
  };

  return (
    <section className="panel-section" aria-labelledby="commodity-heading">
      <h3 id="commodity-heading" className="panel-section__title">
        Commodity
      </h3>
      {unknownCommodity && (
        <Notice tone="warn">
          The commodity in this link is not in the snapshot, so {active?.label} is shown.
        </Notice>
      )}
      {many && (
        <label className="search-field commodity-search">
          <Search size={15} aria-hidden="true" />
          <span className="visually-hidden">Find a commodity by name or commodity code</span>
          <input
            type="search"
            className="search-field__input"
            placeholder="Name or code, e.g. dairy, 0406"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={onSearchKey}
            aria-controls={listId}
            autoComplete="off"
          />
        </label>
      )}
      {many && (
        // Always mounted, so screen readers hear the first change as well as later ones.
        <p className="visually-hidden" aria-live="polite">
          {normaliseQuery(query) === ""
            ? ""
            : ids.length === 0
              ? "No commodity matches."
              : `${ids.length} of ${index.commodities.length} commodities shown.`}
        </p>
      )}
      <div
        ref={listRef}
        id={listId}
        className={many ? "commodity-list commodity-list--compact" : "commodity-list"}
        role="radiogroup"
        aria-labelledby="commodity-heading"
        onKeyDown={onListKey}
      >
        {visible.map((s) => {
          const groupId = s.id ? `${baseId}-group-${s.id}` : undefined;
          return (
            <div key={s.id ?? "all"} className="commodity-group">
              {s.label && (
                <div id={groupId} className="commodity-group__title">
                  {s.label}
                </div>
              )}
              <div className="commodity-group__items">
                {s.items.map((c) => {
                  const checked = c.id === active?.id;
                  return (
                    <button
                      key={c.id}
                      type="button"
                      role="radio"
                      data-id={c.id}
                      aria-checked={checked}
                      aria-describedby={groupId}
                      tabIndex={c.id === tabStop ? 0 : -1}
                      className="commodity-option"
                      onClick={() => setCommodity(c.id)}
                    >
                      <span className="commodity-option__icon">
                        <CommodityIcon id={c.id} size={many ? 18 : 20} />
                      </span>
                      <span className="commodity-option__text">
                        <span className="commodity-option__label">{c.label}</span>
                        <span className="commodity-option__scope">{c.hsScope}</span>
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>
      {ids.length === 0 && <p className="empty-line">No commodity matches “{query.trim()}”.</p>}
      {activeHidden && active && (
        <p className="control-hint">
          Showing {active.label}; the search hides it.{" "}
          <span className="visually-hidden">Clear the search to see it.</span>
        </p>
      )}
      {active && <p className="control-hint">{active.definition}</p>}
    </section>
  );
}
