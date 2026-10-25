import { TriangleAlert } from "lucide-react";
import { useMemo, type ReactNode } from "react";
import { formatCount, formatShare } from "@/analysis/format";
import { councilNetwork, density, retailerSlices, type CouncilNetwork } from "@/analysis/profile";
import { Metric } from "@/components/dashboard/Metric";
import { SkeletonLines } from "@/components/states/Skeleton";
import { rateIndicator } from "@/features/access/indicators";
import { useAppStore } from "@/state/store";
import type { Indicator } from "@/types/indicator";
import { sliceColour } from "./charts";
import {
  beyondIndicator,
  concentrationIndicator,
  decileShareIndicator,
  densityIndicator,
  landAreaIndicator,
  noCarIndicator,
  populationIndicator,
  retailersIndicator,
  storesIndicator,
  urbanRuralIndicator,
} from "./indicators";
import type { CouncilRow, DeepProfile } from "./model";
import { useDeepProfile, useProfile } from "./useProfile";

interface Column {
  c: CouncilRow;
  network: CouncilNetwork | null;
  deep: DeepProfile | null;
  deepStatus: ReturnType<typeof useDeepProfile>["status"];
}

type Comparability = "uk" | "within-nation" | "nation-specific" | "census";

/** One comparison row: a value per council, and how far the councils can be compared (P11). */
function CompareRow({
  label,
  cells,
  comparability,
}: {
  label: string;
  cells: (Indicator<number | string> | ReactNode)[];
  comparability: Comparability;
}) {
  const note: Record<Comparability, string | null> = {
    uk: null,
    census:
      "Census 2021 (England, Wales, Northern Ireland); Scotland's census was in 2022 and is not included.",
    "within-nation": "Ranked within each nation: shown side by side, never compared across nations.",
    "nation-specific": "Each nation's own classification: not comparable across nations.",
  };
  return (
    <tr data-comparability={comparability}>
      <th scope="row">
        {label}
        {note[comparability] && <span className="table-sub">{note[comparability]}</span>}
      </th>
      {cells.map((cell, i) => (
        <td key={i}>
          {cell && typeof cell === "object" && "provenance" in (cell as object) ? (
            <Metric compact indicator={cell as Indicator<number | string>} />
          ) : (
            (cell as ReactNode)
          )}
        </td>
      ))}
    </tr>
  );
}

function deepOnly(col: Column, make: (d: DeepProfile) => Indicator<number>): Indicator<number> | ReactNode {
  if (col.deep) return make(col.deep);
  if (col.deepStatus === "loading") return <span className="table-sub">Loading…</span>;
  return <span className="unavailable-cell">Data unavailable</span>;
}

function RetailerMix({ network }: { network: CouncilNetwork | null }) {
  if (!network || network.total === 0) return <span className="unavailable-cell">No mapped stores</span>;
  const slices = retailerSlices(network.retailers);
  return (
    <div className="mix">
      <div
        className="mix__bar"
        role="img"
        aria-label={slices.map((s) => `${s.retailer} ${formatShare(s.stores / network.total)}`).join(", ")}
      >
        {slices.map((s) => (
          <span
            key={s.retailer}
            className="mix__seg"
            style={{ width: `${(100 * s.stores) / network.total}%`, background: sliceColour(s.slot) }}
            title={`${s.retailer}: ${formatCount(s.stores)} stores`}
          />
        ))}
      </div>
      <span className="table-sub">
        {slices
          .slice()
          .sort((a, b) => b.stores - a.stores)
          .slice(0, 3)
          .map((s) => `${s.retailer} ${formatShare(s.stores / network.total)}`)
          .join(" · ")}
      </span>
    </div>
  );
}

function useColumns(): Column[] | null {
  const p = useProfile();
  const lad = useAppStore((s) => s.lad);
  const compare = useAppStore((s) => s.compare);
  const codes = useMemo(() => (lad ? [lad, ...compare] : []), [lad, compare]);
  // A fixed number of hook calls (the selected council and up to three others).
  const d0 = useDeepProfile(codes[0] ?? null);
  const d1 = useDeepProfile(codes[1] ?? null);
  const d2 = useDeepProfile(codes[2] ?? null);
  const d3 = useDeepProfile(codes[3] ?? null);
  const deeps = [d0, d1, d2, d3];
  const stores = p.access.stores;
  return useMemo(() => {
    if (!p.councils || !stores) return null;
    return codes
      .map((code, i) => {
        const c = p.councils!.find((x) => x.code === code);
        if (!c) return null;
        const col: Column = {
          c,
          network: councilNetwork(stores, code),
          deep: deeps[i]!.deep,
          deepStatus: deeps[i]!.status,
        };
        return col;
      })
      .filter((x): x is Column => x !== null);
    // deeps entries are memoised per council inside useDeepProfile.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    p.councils,
    stores,
    codes,
    d0.deep,
    d1.deep,
    d2.deep,
    d3.deep,
    d0.status,
    d1.status,
    d2.status,
    d3.status,
  ]);
}

function CompareBody() {
  const p = useProfile();
  const cols = useColumns();
  if (!cols || !p.access.doc) return <SkeletonLines label="Loading the comparison" />;
  if (cols.length < 2)
    return <p>Choose a council and add at least one more in the controls panel (Compare councils).</p>;
  const nations = [...new Set(cols.map((x) => x.c.nation))];
  const provision = (col: Column, measure: "supermarkets" | "all"): Indicator<number> => {
    const layers =
      measure === "supermarkets"
        ? (["supermarket"] as const)
        : (["supermarket", "convenience", "other"] as const);
    const stores = col.network ? layers.reduce((s, l) => s + col.network!.byLayer[l], 0) : 0;
    const per10k = col.c.population ? (stores / col.c.population) * 10_000 : null;
    return rateIndicator(measure, per10k, stores, col.c.population, `${col.c.name} (${col.c.nation})`);
  };
  return (
    <div className="dialog-body compare">
      {nations.length > 1 && (
        <p className="notice notice--warn" role="note">
          <TriangleAlert size={16} aria-hidden="true" />
          <span>
            These councils are in different nations ({nations.join(", ")}). Deprivation indices and PPFI
            deciles rank areas within each nation, and urban/rural classifications differ by nation, so those
            rows are shown side by side but not compared or ranked. Population, store, rate and straight-line
            distance measures use the same definitions across the UK.
          </span>
        </p>
      )}
      <p className="control-hint">
        Councils are listed in the order you chose them, never ranked. Rates are per 10,000 residents (ONS
        mid-2025), shares are of households or small areas.
      </p>
      <div className="table-scroll">
        <table className="data-table compare-table">
          <caption className="visually-hidden">Council comparison</caption>
          <thead>
            <tr>
              <th scope="col">Indicator</th>
              {cols.map((col) => (
                <th scope="col" key={col.c.code}>
                  {col.c.name}
                  <span className="table-sub">
                    {col.c.nation} · {col.c.code}
                  </span>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            <tr className="compare-table__group">
              <th scope="rowgroup" colSpan={cols.length + 1}>
                Population characteristics
              </th>
            </tr>
            <CompareRow
              label="Residents (mid-2025)"
              comparability="uk"
              cells={cols.map((x) => populationIndicator(x.c))}
            />
            <CompareRow
              label="Land area"
              comparability="uk"
              cells={cols.map((x) => landAreaIndicator(x.c))}
            />
            <CompareRow
              label="Population density"
              comparability="uk"
              cells={cols.map((x) => densityIndicator(x.c, density(x.c.population, x.c.landAreaKm2)))}
            />
            <CompareRow
              label="Households with no car or van"
              comparability="census"
              cells={cols.map((x) => noCarIndicator(x.c))}
            />
            <CompareRow
              label="Urban/rural class"
              comparability="nation-specific"
              cells={cols.map((x) => urbanRuralIndicator(x.c))}
            />
            <tr className="compare-table__group">
              <th scope="rowgroup" colSpan={cols.length + 1}>
                Supermarket provision (GEOLYTIX, June 2026)
              </th>
            </tr>
            <CompareRow
              label="Mapped grocery stores"
              comparability="uk"
              cells={cols.map((x) => storesIndicator(x.c, x.network?.total ?? 0))}
            />
            <CompareRow
              label="Supermarkets per 10,000 residents"
              comparability="uk"
              cells={cols.map((x) => provision(x, "supermarkets"))}
            />
            <CompareRow
              label="All grocery stores per 10,000 residents"
              comparability="uk"
              cells={cols.map((x) => provision(x, "all"))}
            />
            <CompareRow
              label="Retailers represented"
              comparability="uk"
              cells={cols.map((x) => retailersIndicator(x.c, x.network?.retailers.length ?? 0))}
            />
            <CompareRow
              label="Largest retailer's share of supermarkets"
              comparability="uk"
              cells={cols.map((x) =>
                x.network ? concentrationIndicator(x.c, x.network.supermarketConcentration) : null,
              )}
            />
            <CompareRow
              label="Retailer mix (all stores)"
              comparability="uk"
              cells={cols.map((x) => (
                <RetailerMix network={x.network} />
              ))}
            />
            <tr className="compare-table__group">
              <th scope="rowgroup" colSpan={cols.length + 1}>
                Accessibility and vulnerability (deep profiles only)
              </th>
            </tr>
            <CompareRow
              label="Residents more than 1 km from a supermarket (straight-line)"
              comparability="uk"
              cells={cols.map((x) =>
                deepOnly(x, (d) => beyondIndicator(x.c, d.beyondSupermarket[0]!, "supermarket")),
              )}
            />
            <CompareRow
              label="Small areas in PPFI deciles 1–2"
              comparability="within-nation"
              cells={cols.map((x) =>
                deepOnly(x, (d) =>
                  decileShareIndicator(
                    x.c,
                    "compare.ppfi.top2",
                    "PPFI deciles 1–2",
                    d.ppfi.length ? d.ppfi.filter((q) => q.ppfi.decile <= 2).length / d.ppfi.length : null,
                    "S13",
                    `Share of the council's ${d.ppfiGeography === "soa2011" ? "SOAs (2011)" : "LSOAs"} in PPFI deciles 1–2 within ${d.profile.ppfi.within}.`,
                    d.profile.ppfi.within,
                    d.profile.ppfi.referencePeriod,
                  ),
                ),
              )}
            />
            <CompareRow
              label="Small areas in the most deprived 10 % (own nation's index)"
              comparability="within-nation"
              cells={cols.map((x) =>
                deepOnly(x, (d) =>
                  decileShareIndicator(
                    x.c,
                    "compare.deprivation.d1",
                    "Deprivation decile 1",
                    d.deprivation.length
                      ? d.deprivation.filter((q) => q.decile === 1).length / d.deprivation.length
                      : null,
                    "S19",
                    `${d.profile.deprivation.index}: share of the council's small areas in decile 1 within ${d.profile.deprivation.within}.`,
                    d.profile.deprivation.within,
                    d.profile.deprivation.referencePeriod,
                  ),
                ),
              )}
            />
          </tbody>
        </table>
      </div>
      <p className="control-hint">
        &ldquo;Data unavailable&rdquo; marks figures not published for that council in this release (small
        areas are published for Belfast and Manchester), never a zero. Retail colours stay with the retailer
        in every column.
      </p>
    </div>
  );
}

/** Council comparison (LP-07), opened from the profile; deep-linkable (view=compare). */
export function CompareDialog() {
  const open = useAppStore((s) => s.overlay === "compare");
  const close = useAppStore((s) => s.closeOverlay);
  return (
    <calcite-dialog
      open={open}
      modal
      heading="Compare councils"
      description="Side by side, with comparability warnings; never ranked"
      widthScale="l"
      oncalciteDialogClose={() => close()}
    >
      {open && <CompareBody />}
    </calcite-dialog>
  );
}
