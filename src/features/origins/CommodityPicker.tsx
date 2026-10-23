import type { KeyboardEvent } from "react";
import { useRef } from "react";
import { Notice } from "@/components/states/Notice";
import { useAppStore } from "@/state/store";
import type { TradeIndex } from "@/types/generated/trade-index";
import { CommodityIcon } from "./CommodityIcon";
import { resolveCommodity } from "./useOrigins";

/**
 * Commodity selector (FO-01): a radio group with icons and HS scope; arrow keys, Home and End move
 * the selection. Shared by Food Origins and Seasonal Supply (the commodity is shared state).
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
  const listRef = useRef<HTMLDivElement | null>(null);
  const active = resolveCommodity(index, commodity);
  const ids = index.commodities.map((c) => c.id);

  const onListKey = (e: KeyboardEvent<HTMLDivElement>) => {
    const i = ids.indexOf(active?.id ?? "");
    let next = -1;
    if (e.key === "ArrowDown" || e.key === "ArrowRight") next = (i + 1) % ids.length;
    else if (e.key === "ArrowUp" || e.key === "ArrowLeft") next = (i - 1 + ids.length) % ids.length;
    else if (e.key === "Home") next = 0;
    else if (e.key === "End") next = ids.length - 1;
    if (next < 0) return;
    e.preventDefault();
    setCommodity(ids[next]!);
    listRef.current?.querySelectorAll<HTMLButtonElement>("[role=radio]")[next]?.focus();
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
      <div
        ref={listRef}
        className="commodity-list"
        role="radiogroup"
        aria-labelledby="commodity-heading"
        onKeyDown={onListKey}
      >
        {index.commodities.map((c) => {
          const checked = c.id === active?.id;
          return (
            <button
              key={c.id}
              type="button"
              role="radio"
              aria-checked={checked}
              tabIndex={checked ? 0 : -1}
              className="commodity-option"
              onClick={() => setCommodity(c.id)}
            >
              <span className="commodity-option__icon">
                <CommodityIcon id={c.id} />
              </span>
              <span className="commodity-option__text">
                <span className="commodity-option__label">{c.label}</span>
                <span className="commodity-option__scope">{c.hsScope}</span>
              </span>
            </button>
          );
        })}
      </div>
      {active && <p className="control-hint">{active.definition}</p>}
    </section>
  );
}
