import { BookOpenCheck, Focus, GitCompareArrows, Info, Lightbulb, TriangleAlert, X } from "lucide-react";
import { useMemo, useState, type ReactNode } from "react";
import { formatCount, formatKm, formatPopulation, formatShare } from "@/analysis/format";
import {
  breakClass,
  breakLabels,
  decileClass,
  density,
  DISTANCE_BREAKS_KM,
  DISTANCE_THRESHOLDS_KM,
  noCarShare,
  retailerSlices,
} from "@/analysis/profile";
import { FORMAT_LABELS, STORE_LAYER_LABELS, STORE_LAYERS } from "@/analysis/retail";
import { ChartFrame } from "@/components/charts/ChartFrame";
import { Metric } from "@/components/dashboard/Metric";
import { ProvenanceBadge } from "@/components/dashboard/ProvenanceBadge";
import { EmptyState } from "@/components/states/EmptyState";
import { ErrorState } from "@/components/states/ErrorState";
import { SkeletonLines } from "@/components/states/Skeleton";
import { StoreSymbol } from "@/features/access/AccessMapExtras";
import { comparisonOption, comparisonRows } from "@/features/access/charts";
import { rateIndicator } from "@/features/access/indicators";
import { describeDataError } from "@/services/data/errors";
import { useAppStore } from "@/state/store";
import type { AreaMeasure } from "@/state/urlState";
import type { Indicator } from "@/types/indicator";
import { decileBarsOption, distanceClassesOption, retailerDonutOption, sliceColour } from "./charts";
import { opportunities, RULES } from "./consulting";
import {
  areaClassIndicator,
  areaDistanceIndicator,
  areaNoCarIndicator,
  areaResidentsIndicator,
  beyondIndicator,
  concentrationIndicator,
  decileShareIndicator,
  densityIndicator,
  hhiIndicator,
  landAreaIndicator,
  nationalTopShareIndicator,
  noCarIndicator,
  populationIndicator,
  productionShareIndicator,
  retailersIndicator,
  storesIndicator,
  urbanRuralIndicator,
} from "./indicators";
import {
  codesInDecileClass,
  deprivationDistribution,
  PPFI_DOMAINS,
  ppfiDecile,
  ppfiDistribution,
  underserved,
  type CouncilRow,
  type DeepProfile,
} from "./model";
import { useNationalContext, useProfile, type ProfileData } from "./useProfile";

/** Label + provenance-complete value (the only way a number reaches the screen, P1). */
function Row({
  label,
  indicator,
  hint,
}: {
  label: string;
  indicator: Indicator<number | string>;
  hint?: ReactNode;
}) {
  return (
    <div className="profile-row">
      <dt>{label}</dt>
      <dd>
        <Metric indicator={indicator} />
        {hint && <span className="profile-row__hint">{hint}</span>}
      </dd>
    </div>
  );
}

function Section({
  id,
  title,
  children,
  badge,
  open = true,
}: {
  id: string;
  title: string;
  children: ReactNode;
  badge?: ReactNode;
  open?: boolean;
}) {
  return (
    <details className="panel-section profile-section" open={open} aria-labelledby={`${id}-heading`}>
      <summary>
        <h3 id={`${id}-heading`} className="panel-section__title">
          {title}
        </h3>
        {badge}
      </summary>
      <div className="profile-section__body">{children}</div>
    </details>
  );
}

function NationalBanner({ children }: { children: ReactNode }) {
  return (
    <p className="national-banner" role="note">
      <span className="chip chip--amber">National context</span>
      <span>{children}</span>
    </p>
  );
}

function Unavailable({ what, why }: { what: string; why: string }) {
  return (
    <p className="unavailable" data-unavailable={what}>
      <strong>Data unavailable:</strong> {what}. {why}
    </p>
  );
}

// ---------------------------------------------------------------------------------------------

function Header({ p, c }: { p: ProfileData; c: CouncilRow }) {
  const issue = useAppStore((s) => s.issueMapCommand);
  const openOverlay = useAppStore((s) => s.openOverlay);
  const setLad = useAppStore((s) => s.setLad);
  const compare = useAppStore((s) => s.compare);
  return (
    <section className="panel-section profile-header" aria-labelledby="profile-title" aria-live="polite">
      <div className="selected-partner__head">
        <h3 id="profile-title" className="profile-header__title">
          {c.name}
        </h3>
        <button
          type="button"
          className="tool-btn"
          onClick={() => setLad(null)}
          aria-label="Close this profile"
        >
          <X size={16} aria-hidden="true" />
        </button>
      </div>
      <p className="profile-header__meta">
        <span className="chip">{c.nation}</span>
        <span className="chip" title="GSS code (ONS)">
          {c.code}
        </span>
        {c.deep ? (
          <span className="chip chip--cyan">Deep profile</span>
        ) : (
          <span className="chip">Council profile</span>
        )}
      </p>
      <p className="freshness-badges" aria-label="Data dates">
        <span className="chip" title="GEOLYTIX Grocery Retail Points v46">
          Stores Jun 2026
        </span>
        <span className="chip" title="ONS mid-year estimates">
          Population mid-2025
        </span>
        <span className="chip" title="Census 2021 (England, Wales, Northern Ireland)">
          Census 2021
        </span>
        {c.deep && (
          <span className="chip" title="Priority Places for Food Index v2.1 (July 2024)">
            PPFI v2.1
          </span>
        )}
        <span className="chip" title="Snapshot of the stores and population data">
          Data {p.sources.localSnapshot ?? "—"}
        </span>
      </p>
      <div className="button-row">
        <button
          type="button"
          className="chip-btn"
          onClick={() => issue({ type: "focusCouncil", code: c.code })}
        >
          <Focus size={15} aria-hidden="true" /> Zoom to council
        </button>
        <button
          type="button"
          className="chip-btn"
          disabled={compare.length === 0}
          onClick={() => openOverlay("compare")}
          title={compare.length === 0 ? "Add a council to compare in the controls panel" : undefined}
        >
          <GitCompareArrows size={15} aria-hidden="true" /> Compare
        </button>
      </div>
    </section>
  );
}

function Overview({ c }: { c: CouncilRow }) {
  const ur = c.context?.urbanRural ?? null;
  return (
    <Section id="overview" title="Area overview">
      <dl className="profile-rows">
        <Row label="Residents" indicator={populationIndicator(c)} />
        <Row label="Land area" indicator={landAreaIndicator(c)} />
        <Row
          label="Population density"
          indicator={densityIndicator(c, density(c.population, c.landAreaKm2))}
        />
        <Row
          label="Urban/rural"
          indicator={urbanRuralIndicator(c)}
          hint={
            ur
              ? "ONS 2021 classification (England and Wales). Classifications differ by nation and are not compared."
              : c.nation === "Northern Ireland"
                ? "NISRA publishes no council-level class; its 2015 class is shown for small areas in the deep profile."
                : "The Scottish Government classification is published for Data Zones, not councils; not yet included."
          }
        />
        <Row label="Households with no car or van" indicator={noCarIndicator(c)} />
      </dl>
      {c.note && <p className="control-hint">{c.note}</p>}
    </Section>
  );
}

function Network({ p, c }: { p: ProfileData; c: CouncilRow }) {
  const setRetailers = useAppStore((s) => s.setRetailers);
  const retailers = useAppStore((s) => s.retailers);
  const n = p.network!;
  const slices = useMemo(() => retailerSlices(n.retailers), [n]);
  const donut = useMemo(() => retailerDonutOption(slices, n.total), [slices, n.total]);
  const detail = p.access.council;
  // Always supermarkets, whatever council shading UK Food Access last used (its totals follow `cl`).
  const rows = useMemo(
    () =>
      p.totals && detail
        ? comparisonRows(p.totals.supermarkets, detail, "supermarkets").filter(
            (r) => r.kind !== "nation" || r.key === c.nation,
          )
        : [],
    [p.totals, detail, c.nation],
  );
  const chart = useMemo(
    () => comparisonOption(rows, c.nation, "supermarkets per 10,000 residents"),
    [rows, c.nation],
  );
  const [showStores, setShowStores] = useState(false);
  const stores = useMemo(
    () =>
      [...(p.councilStores ?? [])].sort(
        (a, b) =>
          STORE_LAYERS.indexOf(a.layer) - STORE_LAYERS.indexOf(b.layer) ||
          a.retailer.localeCompare(b.retailer) ||
          a.name.localeCompare(b.name),
      ),
    [p.councilStores],
  );
  const sup = p.rates.supermarkets;
  const all = p.rates.all;
  const ni = c.nation === "Northern Ireland";
  return (
    <Section id="network" title="Supermarket network">
      {ni && (
        <p className="provision-callout" role="note">
          <Info size={15} aria-hidden="true" />
          <span>
            In Northern Ireland GEOLYTIX maps ten retailers, mostly as convenience stores (Spar, Centra and
            others). Symbol groups it does not carry (SuperValu, Mace, Vivo, Costcutter, Nisa, Premier) and
            independent grocers are on the optional FSA register layer, which is never counted here.
          </span>
        </p>
      )}
      <dl className="profile-rows">
        <Row label="Mapped grocery stores" indicator={storesIndicator(c, n.total)} />
        {sup && (
          <Row
            label="Supermarkets per 10,000 residents"
            indicator={rateIndicator(
              "supermarkets",
              sup.per10k,
              sup.stores,
              sup.population,
              `${c.name} (${c.nation})`,
            )}
          />
        )}
        {all && (
          <Row
            label="All grocery stores per 10,000 residents"
            indicator={rateIndicator(
              "all",
              all.per10k,
              all.stores,
              all.population,
              `${c.name} (${c.nation})`,
            )}
          />
        )}
        <Row label="Retailers represented" indicator={retailersIndicator(c, n.retailers.length)} />
        <Row
          label="Largest retailer (supermarkets)"
          indicator={concentrationIndicator(c, n.supermarketConcentration)}
          hint={n.supermarketConcentration.topRetailer ?? undefined}
        />
        <Row
          label="Retailer concentration (supermarkets)"
          indicator={hhiIndicator(c, n.supermarketConcentration)}
        />
      </dl>
      <dl className="stat-grid">
        {STORE_LAYERS.map((l) => (
          <div key={l}>
            <dt>
              <StoreSymbol layer={l} size={11} /> {STORE_LAYER_LABELS[l].label}
            </dt>
            <dd>{formatCount(n.byLayer[l])}</dd>
          </div>
        ))}
      </dl>
      <ChartFrame
        title="Stores by retailer"
        option={donut?.option ?? null}
        description={donut?.description}
        height={190}
        meta={<ProvenanceBadge cls="measured" showLabel={false} />}
        onEvents={{
          click: (e) => {
            const s = slices[e.dataIndex ?? -1];
            if (s) setRetailers(s.members);
          },
        }}
      >
        <div className="table-scroll">
          <table className="data-table data-table--compact retailer-table">
            <caption className="visually-hidden">
              Mapped stores in {c.name} by retailer and type, June 2026
            </caption>
            <thead>
              <tr>
                <th scope="col">Retailer</th>
                <th scope="col" className="num" title="Supermarkets">
                  Super.
                </th>
                <th scope="col" className="num" title="Convenience stores">
                  Conv.
                </th>
                <th scope="col" className="num" title="Forecourt, travel and hospital">
                  Other
                </th>
                <th scope="col" className="num">
                  All
                </th>
              </tr>
            </thead>
            <tbody>
              {n.retailers.map((r) => {
                const slice = slices.find((s) => s.members.includes(r.retailer));
                return (
                  <tr key={r.retailer} data-selected={retailers?.includes(r.retailer) || undefined}>
                    <th scope="row">
                      <button type="button" className="row-btn" onClick={() => setRetailers([r.retailer])}>
                        <span
                          className="legend-dot"
                          style={{ background: sliceColour(slice?.slot ?? null) }}
                          aria-hidden="true"
                        />
                        {r.retailer}
                      </button>
                    </th>
                    <td className="num">{formatCount(r.byLayer.supermarket)}</td>
                    <td className="num">{formatCount(r.byLayer.convenience)}</td>
                    <td className="num">{formatCount(r.byLayer.other)}</td>
                    <td className="num">{formatCount(r.total)}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        <p className="control-hint">
          Click a retailer (or a slice) to show only its stores on the map
          {retailers !== null && (
            <>
              {" · "}
              <button type="button" className="link-btn" onClick={() => setRetailers(null)}>
                show every retailer
              </button>
            </>
          )}
          . Colours stay with the retailer in every council; retailers outside the UK&rsquo;s eight largest
          are grouped as &ldquo;Other retailers&rdquo; in the chart.
        </p>
      </ChartFrame>
      <ChartFrame
        title={`Supermarkets per 10,000 residents: ${c.name}, ${c.nation} and the UK`}
        option={chart?.option ?? null}
        description={chart?.description}
        height={104}
        meta={<ProvenanceBadge cls="derived" showLabel={false} />}
      />
      <button
        type="button"
        className="text-btn"
        onClick={() => setShowStores((v) => !v)}
        aria-expanded={showStores}
      >
        {showStores
          ? "Hide the store list"
          : `List the ${formatCount(stores.length)} stores by type and retailer`}
      </button>
      {showStores && <StoreList stores={stores} />}
      <p className="control-hint">
        Store presence is retail provision, not access, affordability or choice (P7). Counts are stores
        assigned to the council (full-extent May 2025 boundary).
      </p>
    </Section>
  );
}

function StoreList({ stores }: { stores: NonNullable<ProfileData["councilStores"]> }) {
  const selectStore = useAppStore((s) => s.selectStore);
  return (
    <div className="table-scroll store-list">
      <table className="data-table data-table--compact">
        <caption className="visually-hidden">Mapped stores by type and retailer</caption>
        <thead>
          <tr>
            <th scope="col">Store</th>
            <th scope="col">Type</th>
            <th scope="col">Postcode</th>
          </tr>
        </thead>
        <tbody>
          {stores.map((s) => (
            <tr key={s.id}>
              <th scope="row">
                <button type="button" className="row-btn" onClick={() => selectStore(s.id)}>
                  <StoreSymbol layer={s.layer} size={11} /> {s.name}
                </button>
              </th>
              <td>
                {STORE_LAYER_LABELS[s.layer].label}
                {s.format !== "standard" ? ` · ${FORMAT_LABELS[s.format]}` : ""}
              </td>
              <td>{s.postcode ?? "—"}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

// ---------------------------------------------------------------------------------------------
// Deep profile sections (LP-04, LP-06)

const distanceHighlight = (label: string) => `${label} from a supermarket (straight-line)`;

function Accessibility({ c, d }: { c: CouncilRow; d: DeepProfile }) {
  const setHighlight = useAppStore((s) => s.setAreaHighlight);
  const selectArea = useAppStore((s) => s.selectArea);
  const setMeasure = useAppStore((s) => s.setAreaMeasure);
  const [km, setKm] = useState<number>(1);
  const classes = useMemo(() => {
    const labels = breakLabels(DISTANCE_BREAKS_KM, (v) => formatKm(v));
    return labels.map((label, i) => {
      const inClass = d.areas.filter(
        (a) => breakClass(a.toSupermarket === null ? null : a.toSupermarket / 1000, DISTANCE_BREAKS_KM) === i,
      );
      return {
        label,
        classIndex: i,
        areas: inClass.length,
        population: inClass.reduce((s, a) => s + a.population, 0),
        codes: inClass.map((a) => a.code),
      };
    });
  }, [d]);
  const chart = useMemo(() => distanceClassesOption(classes), [classes]);
  const pickDistance = (row: (typeof classes)[number]) => {
    setMeasure("distance");
    setHighlight({ label: distanceHighlight(row.label), codes: row.codes });
  };
  const list = useMemo(() => underserved(d, km), [d, km]);
  const accessibilityDomain = d.profile.ppfi.domainsWithoutData.includes("supermarket_accessibility");
  return (
    <Section id="accessibility" title="Food accessibility">
      <dl className="profile-rows">
        {d.beyondSupermarket.map((b) => (
          <Row
            key={b.thresholdKm}
            label={`More than ${formatKm(b.thresholdKm)} from a supermarket (straight-line)`}
            indicator={beyondIndicator(c, b, "supermarket")}
            hint={`${formatPopulation(b.population, "small_area")} residents in ${formatCount(b.areas)} areas`}
          />
        ))}
        <Row
          label="More than 1.0 km from any grocery store (straight-line)"
          indicator={beyondIndicator(c, d.beyondAnyStore[0]!, "store")}
        />
      </dl>
      <ChartFrame
        title="Residents by straight-line distance to the nearest supermarket"
        option={chart?.option ?? null}
        description={chart?.description}
        height={150}
        meta={<ProvenanceBadge cls="derived" showLabel={false} />}
        onEvents={{
          click: (e) => {
            const row = classes[e.dataIndex ?? -1];
            if (row) pickDistance(row);
          },
        }}
      >
        <OutlineButtons
          options={classes.map((row) => ({
            key: String(row.classIndex),
            label: row.label,
            highlight: distanceHighlight(row.label),
            count: row.areas,
            onPick: () => pickDistance(row),
          }))}
        />
      </ChartFrame>
      <div className="field-row">
        <span>Neighbourhoods beyond</span>
        <div className="segmented" role="radiogroup" aria-label="Straight-line threshold">
          {DISTANCE_THRESHOLDS_KM.map((t) => (
            <button key={t} type="button" role="radio" aria-checked={km === t} onClick={() => setKm(t)}>
              {formatKm(t)}
            </button>
          ))}
        </div>
      </div>
      {list.length === 0 ? (
        <p className="empty-line">
          No small area&rsquo;s population-weighted centroid is more than {formatKm(km)} straight-line from a
          supermarket.
        </p>
      ) : (
        <div className="table-scroll">
          <table className="data-table data-table--compact">
            <caption>
              Potentially underserved by proximity: {formatCount(list.length)} small areas more than{" "}
              {formatKm(km)} straight-line from a supermarket, farthest first
            </caption>
            <thead>
              <tr>
                <th scope="col">Area</th>
                <th scope="col" className="num">
                  Km
                </th>
                <th scope="col" className="num">
                  Residents
                </th>
                <th scope="col" className="num" title="Households with no car or van">
                  No car
                </th>
              </tr>
            </thead>
            <tbody>
              {list.slice(0, 15).map((a) => (
                <tr key={a.code}>
                  <th scope="row">
                    <button type="button" className="row-btn" onClick={() => selectArea(a.code)}>
                      {a.name}
                    </button>
                  </th>
                  <td className="num">{formatKm(a.metres / 1000).replace(" km", "")}</td>
                  <td className="num">{formatPopulation(a.population, "small_area")}</td>
                  <td className="num">{a.noCar === null ? "—" : formatShare(a.noCar)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      <p className="control-hint">
        <ProvenanceBadge cls="derived" /> Straight-line distance from each small area&rsquo;s Census 2021
        population-weighted centroid to the nearest GEOLYTIX supermarket (280 m² and over), in the{" "}
        {c.nation === "Northern Ireland" ? "Irish Transverse Mercator" : "British National Grid"} grid.
        Proximity only: not road-network or public transport time, and not affordability. Car availability is
        shown beside it, never combined into a score.
      </p>
      {accessibilityDomain ? (
        <Unavailable
          what="public transport and drive-time accessibility"
          why="The PPFI accessibility domain has no Northern Ireland data, and FOODSCOPE does not route on the network until Release 3."
        />
      ) : (
        <p className="control-hint">
          Public transport and drive times are represented by the PPFI domain &ldquo;Accessibility to
          supermarket retail facilities&rdquo; (see Community vulnerability). FOODSCOPE itself routes on the
          network only from Release 3.
        </p>
      )}
    </Section>
  );
}

/**
 * Keyboard alternative to clicking a chart bar (LP-06, AX-06): one button per map class outlines
 * those areas on the map, exactly as a click on the bar does.
 */
function OutlineButtons({
  options,
}: {
  options: { key: string; label: string; highlight: string; count: number; onPick: () => void }[];
}) {
  const current = useAppStore((s) => s.areaHighlight?.label ?? null);
  return (
    <div className="outline-buttons" role="group" aria-label="Outline on the map">
      <span className="outline-buttons__label" aria-hidden="true">
        Outline on the map:
      </span>
      {options.map((o) => (
        <button
          key={o.key}
          type="button"
          className="chip-btn chip-btn--small"
          aria-pressed={current === o.highlight}
          aria-label={`${o.label}: outline ${formatCount(o.count)} areas on the map`}
          disabled={o.count === 0}
          onClick={o.onPick}
        >
          {o.label}
          <span className="outline-buttons__count">{formatCount(o.count)}</span>
        </button>
      ))}
    </div>
  );
}

function DecileChart({
  title,
  items,
  rows,
  by,
  measure,
}: {
  title: string;
  items: { code: string; decile: number | null }[];
  rows: ReturnType<typeof ppfiDistribution>["rows"];
  by: "areas" | "population";
  measure: AreaMeasure;
}) {
  const setHighlight = useAppStore((s) => s.setAreaHighlight);
  const setMeasure = useAppStore((s) => s.setAreaMeasure);
  const axisName = measure === "deprivation" ? "Decile (1 = most deprived)" : "Decile (1 = highest priority)";
  const chart = useMemo(() => decileBarsOption(rows, title, by, axisName), [rows, title, by, axisName]);
  // Map classes 4..0 are deciles 1–2 .. 9–10 (decileClass).
  const classes = useMemo(
    () =>
      [4, 3, 2, 1, 0].map((cls) => {
        const first = 2 * (4 - cls) + 1;
        const label = `${first}–${first + 1}`;
        return { cls, label, highlight: `${title}: deciles ${label}`, codes: codesInDecileClass(items, cls) };
      }),
    [items, title],
  );
  const pick = (cls: number) => {
    const c = classes.find((x) => x.cls === cls);
    if (!c) return;
    setMeasure(measure);
    setHighlight({ label: c.highlight, codes: c.codes });
  };
  return (
    <ChartFrame
      title={title}
      option={chart?.option ?? null}
      description={chart?.description}
      height={150}
      meta={<ProvenanceBadge cls="measured" showLabel={false} />}
      onEvents={{
        click: (e) => {
          const row = rows[e.dataIndex ?? -1];
          if (!row) return;
          pick(decileClass(row.decile)!);
        },
      }}
    >
      <OutlineButtons
        options={classes.map((c) => ({
          key: String(c.cls),
          label: `Deciles ${c.label}`,
          highlight: c.highlight,
          count: c.codes.length,
          onPick: () => pick(c.cls),
        }))}
      />
    </ChartFrame>
  );
}

function Vulnerability({ c, d }: { c: CouncilRow; d: DeepProfile }) {
  const ppfi = useMemo(() => ppfiDistribution(d, "combined"), [d]);
  const dep = useMemo(() => deprivationDistribution(d), [d]);
  const by = d.ppfi.every((p) => p.population !== null) ? "population" : "areas";
  const share12 = (count: number) => (d.ppfi.length ? count / d.ppfi.length : null);
  const top2 = d.ppfi.filter((p) => p.ppfi.decile <= 2).length;
  const geo = d.ppfiGeography === "soa2011" ? "Super Output Areas (2011)" : d.profile.geography.label;
  const missing = new Set<string>(d.profile.ppfi.domainsWithoutData);
  return (
    <Section id="vulnerability" title="Community vulnerability">
      <p className="control-hint">
        Priority Places for Food Index v2.1 on {geo}, ranked within {d.profile.ppfi.within} (
        {formatCount(d.profile.ppfi.ranked)} areas). Decile 1 = highest priority. The publisher does not state
        the direction; FOODSCOPE checked it against the deprivation indices. Never compared across nations.
      </p>
      <dl className="profile-rows">
        <Row
          label="Small areas in the highest-priority 20 % (PPFI deciles 1–2)"
          indicator={decileShareIndicator(
            c,
            "profile.ppfi.top2",
            "PPFI deciles 1–2",
            share12(top2),
            "S13",
            `${formatCount(top2)} of ${formatCount(d.ppfi.length)} ${geo} in deciles 1–2 of the combined index within ${d.profile.ppfi.within}; 20 % of areas across ${d.profile.ppfi.within} are, by construction.`,
            d.profile.ppfi.within,
            d.profile.ppfi.referencePeriod,
          )}
        />
      </dl>
      <DecileChart
        title="Priority Places for Food Index (combined)"
        items={d.ppfi.map((p) => ({ code: p.code, decile: p.ppfi.decile }))}
        rows={ppfi.rows}
        by={by}
        measure="ppfi"
      />
      <div className="table-scroll">
        <table className="data-table data-table--compact">
          <caption>
            PPFI domains: share of {geo} in deciles 1–2 within {d.profile.ppfi.within}
          </caption>
          <thead>
            <tr>
              <th scope="col">Domain</th>
              <th scope="col" className="num">
                Deciles 1–2
              </th>
            </tr>
          </thead>
          <tbody>
            {PPFI_DOMAINS.map((dom) => {
              const values = d.ppfi.map((p) => ppfiDecile(p.ppfi, dom.key));
              const known = values.filter((v): v is number => v !== null);
              return (
                <tr key={dom.key}>
                  <th scope="row">
                    {dom.label}
                    <span className="table-sub">
                      {dom.group === "access" ? "Access to food" : "Barriers to food"}
                    </span>
                  </th>
                  <td className="num">
                    {missing.has(dom.key) || known.length === 0 ? (
                      <span
                        className="unavailable-cell"
                        title="The PPFI publishes no data for this domain in Northern Ireland"
                      >
                        Data unavailable
                      </span>
                    ) : (
                      formatShare(known.filter((v) => v <= 2).length / known.length)
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      <p className="control-hint">
        <ProvenanceBadge cls="derived" /> Shares of areas from the published deciles (S13). &ldquo;Family food
        support&rdquo; and &ldquo;Socio-economic barriers&rdquo; are PPFI domains; no other family
        food-support statistic is included in this release.
      </p>
      <DecileChart
        title={`${d.profile.deprivation.index} (${d.profile.deprivation.measure})`}
        items={d.deprivation.map((x) => ({ code: x.code, decile: x.decile }))}
        rows={dep.rows}
        by={d.deprivation.every((x) => x.population !== null) ? "population" : "areas"}
        measure="deprivation"
      />
      <p className="control-hint">
        Ranked within {d.profile.deprivation.within} ({formatCount(d.profile.deprivation.ranked)} areas;{" "}
        {d.profile.deprivation.referencePeriod}). Deciles: {d.profile.deprivation.decile}. Deprivation ranks
        are never compared across nations (P11).
        {d.deprivationGeography === "soa2011"
          ? " NIMDM is published on the 2011 Super Output Areas, which predate the 2015 councils: Belfast's SOAs and Data Zones differ slightly at the edge (John's decision: shown on their own areas, never reallocated)."
          : ""}
      </p>
    </Section>
  );
}

function AreaCard({ d }: { d: DeepProfile }) {
  const area = useAppStore((s) => s.area);
  const selectArea = useAppStore((s) => s.selectArea);
  if (!area) return null;
  const census = d.areas.find((a) => a.code === area);
  const ppfi = d.ppfi.find((x) => x.code === area);
  const dep = d.deprivation.find((x) => x.code === area);
  if (!census && !ppfi && !dep) return null;
  const name = census?.name ?? ppfi?.name ?? dep?.name ?? area;
  const nc = census ? noCarShare(census.households, census.noCarHouseholds) : null;
  return (
    <section className="panel-section selected-partner" aria-labelledby="area-heading" aria-live="polite">
      <div className="selected-partner__head">
        <h3 id="area-heading" className="selected-partner__title">
          {name}
        </h3>
        <button
          type="button"
          className="tool-btn"
          onClick={() => selectArea(null)}
          aria-label="Clear the small area"
        >
          <X size={16} aria-hidden="true" />
        </button>
      </div>
      <p className="control-hint">
        {area} ·{" "}
        {census
          ? d.profile.geography.label
          : "Super Output Area (2011): the geography of NIMDM 2017 and the PPFI in Northern Ireland"}
        {census?.wardName ? ` · ward ${census.wardName}` : ""}
      </p>
      <dl className="stat-grid">
        {census && (
          <>
            <div>
              <dt>Residents (Census 2021)</dt>
              <dd>
                <Metric compact indicator={areaResidentsIndicator(census.code, name, census.population)} />
              </dd>
            </div>
            <div>
              <dt>No car or van</dt>
              <dd>
                <Metric
                  compact
                  indicator={areaNoCarIndicator(
                    census.code,
                    name,
                    census.households,
                    census.noCarHouseholds,
                    nc,
                  )}
                />
              </dd>
            </div>
            <div>
              <dt>Nearest supermarket (straight-line)</dt>
              <dd>
                <Metric compact indicator={areaDistanceIndicator(census.code, name, census.toSupermarket)} />
              </dd>
            </div>
            {!census.code.startsWith("N20") && (
              <div>
                <dt>Urban/rural (ONS 2021)</dt>
                <dd>
                  <Metric
                    compact
                    indicator={areaClassIndicator(
                      census.code,
                      name,
                      "Urban/rural (ONS 2021)",
                      census.urbanRural?.name ?? null,
                      "S21",
                      d.profile.urbanRural?.referencePeriod ?? "2021 classification",
                      "ONS 2021 Rural Urban Classification of LSOAs (England and Wales).",
                    )}
                  />
                </dd>
              </div>
            )}
          </>
        )}
        {ppfi && (
          <div>
            <dt>PPFI decile (combined)</dt>
            <dd>
              <Metric
                compact
                indicator={areaClassIndicator(
                  ppfi.code,
                  name,
                  "PPFI decile (combined)",
                  `${ppfi.ppfi.decile} of 10`,
                  "S13",
                  d.profile.ppfi.referencePeriod,
                  `Published decile of the combined index within ${d.profile.ppfi.within}; 1 = highest priority.`,
                  "measured",
                  d.profile.ppfi.within,
                )}
              />
            </dd>
          </div>
        )}
        {dep && (
          <div>
            <dt>Deprivation decile</dt>
            <dd>
              <Metric
                compact
                indicator={areaClassIndicator(
                  dep.code,
                  name,
                  "Deprivation decile",
                  `${dep.decile} of 10`,
                  "S19",
                  d.profile.deprivation.referencePeriod,
                  `${d.profile.deprivation.index}, ${d.profile.deprivation.measure}, within ${d.profile.deprivation.within}; 1 = most deprived. Deciles: ${d.profile.deprivation.decile}.`,
                  d.profile.deprivation.decile === "published" ? "measured" : "derived",
                  d.profile.deprivation.within,
                )}
              />
            </dd>
          </div>
        )}
        {dep?.urbanRural2015 && (
          <div>
            <dt>Urban/rural (NISRA 2015)</dt>
            <dd>
              <Metric
                compact
                indicator={areaClassIndicator(
                  dep.code,
                  name,
                  "Urban/rural (NISRA 2015)",
                  dep.urbanRural2015,
                  "S21",
                  d.profile.urbanRural?.referencePeriod ?? "2015",
                  "NISRA 2015 default urban/rural class of the SOA, as in the NIMDM 2017 file.",
                )}
              />
            </dd>
          </div>
        )}
      </dl>
      {ppfi && (
        <ul className="notes-list">
          {PPFI_DOMAINS.map((dom) => {
            const dec = ppfiDecile(ppfi.ppfi, dom.key);
            return (
              <li key={dom.key}>
                {dom.label}: {dec === null ? "data unavailable" : `decile ${dec}`}
              </li>
            );
          })}
        </ul>
      )}
      <p className="control-hint">
        Deciles within {d.profile.ppfi.within}; 1 = highest priority (PPFI) or most deprived. Census counts
        are perturbed for confidentiality.
      </p>
    </section>
  );
}

function HighlightChip() {
  const h = useAppStore((s) => s.areaHighlight);
  const clear = useAppStore((s) => s.setAreaHighlight);
  if (!h) return null;
  return (
    <section className="panel-section">
      <p className="highlight-chip" role="status">
        <span>
          Outlined on the map: <strong>{h.label}</strong> ({formatCount(h.codes.length)} areas)
        </span>
        <button type="button" className="tool-btn" onClick={() => clear(null)} aria-label="Clear the outline">
          <X size={14} aria-hidden="true" />
        </button>
      </p>
    </section>
  );
}

function NotDeep({ c }: { c: CouncilRow }) {
  return (
    <Section id="neighbourhoods" title="Neighbourhood analysis">
      <Unavailable
        what={`small-area accessibility and vulnerability for ${c.name}`}
        why="In this release small areas are published for the two deep profiles (Belfast and Manchester); deep profiles for every council follow in Release 2. The council figures above use the same sources for every council."
      />
    </Section>
  );
}

// ---------------------------------------------------------------------------------------------
// National context (LP-05) and consulting (LP-08, provisional)

function National() {
  const n = useNationalContext();
  // When every basket's 12 months include provisional ones (the usual case), say it once below the table.
  const allProvisional = Boolean(n.rows && n.rows.length > 0 && n.rows.every((r) => r.imports?.provisional));
  return (
    <Section
      id="national"
      title="National food supply context"
      badge={<span className="chip chip--amber">National</span>}
    >
      <NationalBanner>
        These figures are for the whole United Kingdom and are the same for every council. HMRC records the
        country goods were dispatched from, not where they were grown, and says nothing about this
        council&rsquo;s own retailers or supply chains.
      </NationalBanner>
      {n.status === "error" ? (
        <ErrorState title="National context could not be loaded" body={describeDataError(n.error)} />
      ) : !n.rows ? (
        <SkeletonLines label="Loading national context" />
      ) : (
        <div className="table-scroll">
          <table className="data-table data-table--compact national-table">
            <caption className="visually-hidden">
              UK recorded imports over the latest 12 months and Defra UK production share, by commodity
            </caption>
            <thead>
              <tr>
                <th scope="col">Commodity</th>
                <th scope="col">Largest recorded import partner (12 months, net mass)</th>
                <th scope="col">UK production share of supply (Defra)</th>
              </tr>
            </thead>
            <tbody>
              {n.rows.map((r) => {
                const prod = r.production?.status === "published" ? r.production : null;
                const share = prod?.measures.find((m) => m.key === "productionShare") ?? null;
                return (
                  <tr key={r.basket}>
                    <th scope="row">{r.label}</th>
                    <td>
                      <Metric
                        compact
                        indicator={nationalTopShareIndicator(
                          r.label,
                          r.imports?.topShare ?? null,
                          r.imports?.topPartner ?? null,
                          r.imports?.periodLabel ?? "Latest 12 months",
                        )}
                      />
                      <span className="table-sub">
                        {r.imports?.topPartner ?? "—"} ·{" "}
                        {r.imports ? `${formatCount(r.imports.partners)} partners` : ""}
                        {r.imports?.provisional && !allProvisional ? " · includes provisional months" : ""}
                      </span>
                    </td>
                    <td>
                      {prod && share ? (
                        <>
                          <Metric
                            compact
                            indicator={productionShareIndicator(
                              r.label,
                              share.value / 100,
                              prod.sourceId,
                              `${prod.year}${prod.provisional ? " (provisional)" : ""}`,
                              share.label,
                              prod.scope,
                            )}
                          />
                          <span className="table-sub">
                            {prod.year}
                            {prod.provisional ? ", provisional" : ""} · {prod.sourceId}
                            {prod.scope ? ` · ${prod.scope}` : ""}
                          </span>
                        </>
                      ) : (
                        <span
                          className="unavailable-cell"
                          title={r.production?.status === "not_published" ? r.production.note : undefined}
                        >
                          Data unavailable
                          <span className="table-sub">
                            {r.production?.status === "not_published"
                              ? r.production.note
                              : "Not in the context data."}
                          </span>
                        </span>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
      <p className="control-hint">
        Recorded imports: HMRC (S01) snapshot {n.tradeSnapshot ?? "—"}, the Food Origins baskets
        {allProvisional ? "; every commodity's 12 months include provisional months" : ""}. Production: Defra
        Horticulture statistics 2025 (S09) and Agriculture in the UK 2025 (S10), annual, with Defra&rsquo;s
        own product definitions; never combined with monthly trade. &ldquo;Not grown commercially in the
        UK&rdquo; follows Defra&rsquo;s trade codes (S05). Food prices, Short Straits dependence and climate
        risks are not yet included.
      </p>
    </Section>
  );
}

function Consulting({ p, c }: { p: ProfileData; c: CouncilRow }) {
  const n = useNationalContext();
  const [why, setWhy] = useState(false);
  const nationNoCar = useMemo(() => {
    const rows = (p.councils ?? []).filter((x) => x.nation === c.nation && x.context?.carAvailability);
    const hh = rows.reduce((s, x) => s + x.context!.carAvailability!.households, 0);
    const none = rows.reduce((s, x) => s + x.context!.carAvailability!.noCar, 0);
    return hh > 0 ? none / hh : null;
  }, [p.councils, c.nation]);
  const list = useMemo(
    () =>
      opportunities({
        council: c,
        network: p.network,
        deep: p.deep.deep,
        nationNoCarShare: nationNoCar,
        national: n.rows,
      }),
    [c, p.network, p.deep.deep, nationNoCar, n.rows],
  );
  return (
    <Section
      id="consulting"
      title="Consulting opportunities"
      badge={<span className="chip">Provisional</span>}
      open={false}
    >
      <p className="provision-callout" role="note">
        <Lightbulb size={15} aria-hidden="true" />
        <span>
          Possible lines of further analysis suggested by the figures above, linked to ConsultingWhere
          workstreams. Not a statement that {c.name} has a requirement, budget or procurement. Expanded in the
          Consulting Insights module (build stage 8).
        </span>
      </p>
      {list.length === 0 ? (
        <p className="empty-line">No rule is triggered by this profile&rsquo;s figures.</p>
      ) : (
        <ol className="opportunity-list">
          {list.map((o) => (
            <li key={o.id}>
              <h4>
                {o.workstream}
                {o.scope === "national_context" && <span className="chip chip--amber">National context</span>}
              </h4>
              <p>
                <strong>Evidence.</strong> {o.evidence}
              </p>
              <p>
                <strong>Further analysis.</strong> {o.analysis}
              </p>
              <p>
                <strong>Data needed.</strong> {o.data}
              </p>
            </li>
          ))}
        </ol>
      )}
      <button type="button" className="text-btn" onClick={() => setWhy((v) => !v)} aria-expanded={why}>
        Why am I seeing this?
      </button>
      {why && (
        <ul className="notes-list">
          <li>
            Accessibility review: residents more than {formatKm(RULES.beyondKm)} straight-line from a
            supermarket (deep profiles), or a higher share of households without a car than the nation.
          </li>
          <li>
            Monitoring: {formatShare(RULES.ppfiTopTwoDecilesShare)} or more of small areas in PPFI deciles 1–2
            within the nation.
          </li>
          <li>
            Catchment analysis: one retailer with {formatShare(RULES.topRetailerShare)} or more of the
            council&rsquo;s mapped supermarkets.
          </li>
          <li>
            Supply chain (national): a commodity whose largest recorded import partner has{" "}
            {formatShare(RULES.nationalTopPartnerShare)} or more of UK imports over 12 months.
          </li>
        </ul>
      )}
    </Section>
  );
}

function Evidence({ p, c }: { p: ProfileData; c: CouncilRow }) {
  const openOverlay = useAppStore((s) => s.openOverlay);
  const d = p.deep.deep;
  return (
    <Section id="evidence" title="Evidence and methods" open={false}>
      <ul className="notes-list">
        <li>
          <ProvenanceBadge cls="measured" /> Stores: GEOLYTIX Grocery Retail Points v46, June 2026 (S11),
          assigned to May 2025 council boundaries (ONS, S14). Snapshot {p.sources.localSnapshot ?? "—"}.
        </li>
        <li>
          <ProvenanceBadge cls="official_estimate" /> Population and land area: ONS mid-2025 estimates (S18),
          the same year for all four nations.
        </li>
        <li>
          <ProvenanceBadge cls="measured" /> Census 2021 households and car availability (S20): ONS for
          England and Wales, NISRA for Northern Ireland; Scotland&rsquo;s census (2022) not included. Context
          snapshot {p.sources.contextSnapshot ?? "—"}.
        </li>
        <li>
          <ProvenanceBadge cls="measured" /> Urban/rural: ONS 2021 Rural Urban Classification (S21) for
          England and Wales; NISRA 2015 class for Northern Ireland small areas; none for Scottish councils
          yet.
        </li>
        {d && (
          <>
            <li>
              <ProvenanceBadge cls="measured" /> Small areas ({d.profile.geography.label}) and
              population-weighted centroids: {c.nation === "Northern Ireland" ? "NISRA (S16)" : "ONS (S15)"}.
              Areas snapshot {p.sources.areasSnapshot ?? "—"}.
            </li>
            <li>
              <ProvenanceBadge cls="measured" /> {d.profile.ppfi.index} (S13) and{" "}
              {d.profile.deprivation.index} (S19), each within its nation.
            </li>
            <li>
              <ProvenanceBadge cls="derived" /> Distances: straight-line in the national grid; population
              beyond a threshold sums the Census 2021 population of small areas whose centroid is beyond it.
            </li>
          </>
        )}
        <li>
          Not included: road-network and public transport travel times (Release 3), affordability, food
          prices, council-level PPFI for councils without a deep profile, and Scotland&rsquo;s small areas
          (Release 2).
        </li>
      </ul>
      <button type="button" className="text-btn" onClick={() => openOverlay("evidence")}>
        <BookOpenCheck size={16} aria-hidden="true" /> Evidence and limitations
      </button>
    </Section>
  );
}

function ChooseCouncil({ p }: { p: ProfileData }) {
  const setLad = useAppStore((s) => s.setLad);
  const deep = (p.councils ?? []).filter((c) => c.deep);
  return (
    <section className="panel-section">
      <EmptyState
        title="Choose a council"
        body="Search or pick a council in the controls panel, or click one on the map, to open its food security profile."
      />
      <div className="button-row" style={{ marginTop: 10 }}>
        {deep.map((c) => (
          <button key={c.code} type="button" className="chip-btn" onClick={() => setLad(c.code)}>
            Open {c.name}
          </button>
        ))}
      </div>
    </section>
  );
}

/** Local Authority Profiles dashboard (LP-01 – LP-08). */
export function ProfileInsights() {
  const p = useProfile();
  const lad = useAppStore((s) => s.lad);
  if (p.status === "error")
    return (
      <section className="panel-section">
        <ErrorState title="Profile data could not be loaded" body={describeDataError(p.error)} />
      </section>
    );
  if (p.status !== "ready")
    return (
      <section className="panel-section">
        <SkeletonLines label="Loading the profile" />
      </section>
    );
  const c = p.council;
  if (!c) {
    return (
      <>
        {lad && (
          <section className="panel-section">
            <p className="notice notice--warn" role="alert">
              <TriangleAlert size={16} aria-hidden="true" />
              <span>
                The link names council <code>{lad}</code>, which is not one of the May 2025 councils.
              </span>
            </p>
          </section>
        )}
        <ChooseCouncil p={p} />
      </>
    );
  }
  return (
    <>
      <Header p={p} c={c} />
      <HighlightChip />
      {p.deep.deep && <AreaCard d={p.deep.deep} />}
      <Overview c={c} />
      {p.network && <Network p={p} c={c} />}
      {c.deep ? (
        p.deep.status === "error" ? (
          <section className="panel-section">
            <ErrorState title="Small-area data could not be loaded" body={describeDataError(p.deep.error)} />
          </section>
        ) : !p.deep.deep ? (
          <section className="panel-section">
            <SkeletonLines label="Loading small areas" />
          </section>
        ) : (
          <>
            <Accessibility c={c} d={p.deep.deep} />
            <Vulnerability c={c} d={p.deep.deep} />
          </>
        )
      ) : (
        <NotDeep c={c} />
      )}
      <National />
      <Consulting p={p} c={c} />
      <Evidence p={p} c={c} />
    </>
  );
}
