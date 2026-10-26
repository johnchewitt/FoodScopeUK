import { ArrowUpRight } from "lucide-react";
import { useMemo, useState, type ReactNode } from "react";
import { formatGbp, formatShare, formatTonnes } from "@/analysis/format";
import { FARM_MEASURES, FARM_UNITS, STRESS_LABELS, type FarmMeasure } from "@/analysis/risk";
import { formatMonth, SERIES_BREAKS } from "@/analysis/trade";
import { ChartFrame } from "@/components/charts/ChartFrame";
import { Metric } from "@/components/dashboard/Metric";
import { EmptyState } from "@/components/states/EmptyState";
import { ErrorState } from "@/components/states/ErrorState";
import { Notice } from "@/components/states/Notice";
import { SkeletonLines } from "@/components/states/Skeleton";
import { describeDataError } from "@/services/data/errors";
import { useAppStore } from "@/state/store";
import type { Indicator } from "@/types/indicator";
import {
  councilRankingOption,
  decileOption,
  disruptionOption,
  domainsOption,
  entryOption,
  HHI_CLASS_LABELS,
  matrixOption,
  monthlyHeatmapOption,
  portRegionsOption,
  portTrendOption,
  rankingOption,
  shortStraitsOption,
  srnOption,
  stressOption,
  trendOption,
  urbanRuralOption,
} from "./charts";
import {
  explainCommodity,
  explainCouncil,
  explainPort,
  explainPorts,
  explainRegion,
  explainRoads,
} from "./explain";
import { ExplainPanel } from "./ExplainPanel";
import { farmingIndicator, portIndicator, waterStressIndicator } from "./indicators";
import { changeText, PORT_MEASURE_LABELS, PRIORITY_CLASS_LABELS } from "./model";
import { FARM_LABELS, PPFI_LABELS } from "./labels";
import { useRiskAccess, useRiskLogistics, useRiskSupply } from "./useRisk";

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
    <details
      className="panel-section profile-section"
      open={open}
      aria-labelledby={`${id}-heading`}
      data-section={id}
    >
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

function Row({ label, indicator }: { label: string; indicator: Indicator<number | string> }) {
  return (
    <div className="profile-row">
      <dt>{label}</dt>
      <dd>
        <Metric indicator={indicator} />
      </dd>
    </div>
  );
}

function Loading({ label }: { label: string }) {
  return (
    <section className="panel-section">
      <SkeletonLines label={label} />
    </section>
  );
}

function Failed({ title, error }: { title: string; error: Error | null }) {
  return (
    <section className="panel-section">
      <ErrorState title={title} body={describeDataError(error)} />
    </section>
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

// ---------------------------------------------------------------------------------------------
// International supply

function SupplyInsights() {
  const { status, error, model, production, productionError } = useRiskSupply();
  const setCommodity = useAppStore((s) => s.setCommodity);
  const selectPartner = useAppStore((s) => s.selectPartner);
  const explanation = useMemo(() => (model ? explainCommodity(model) : null), [model]);
  if (status === "error") return <Failed title="Supply data could not be loaded" error={error} />;
  if (!model || !explanation) return <Loading label="Loading the supply exposure" />;
  const o = model.origins;
  const measureLabel = o.measure === "mass" ? "net mass" : "value";
  const fmt = (v: number) => (o.measure === "mass" ? formatTonnes(v) : formatGbp(v));
  const ranking = rankingOption(model.ranking, o.commodity.id);
  const heat = monthlyHeatmapOption(model.monthly);
  const trend = trendOption(model.annual, measureLabel, fmt);
  const matrix = matrixOption(model.matrix);
  const stress = stressOption(model.stress);
  const disruption =
    model.disruption && o.selected ? disruptionOption(model.disruption, o.selected.name) : null;
  const topRows = o.rows.slice(0, 10);

  return (
    <>
      {o.status.noData && (
        <section className="panel-section">
          <EmptyState
            title="No recorded imports in this period"
            body={o.status.unavailableText ?? undefined}
          />
        </section>
      )}
      <ExplainPanel explanation={explanation} />

      <Section id="risk-ranking" title="Concentration by commodity">
        <ChartFrame
          title={`Partner concentration (HHI), ${o.periodText}`}
          option={ranking?.option ?? null}
          description={ranking?.description}
          height={Math.max(150, 20 * model.ranking.length + 16)}
          onEvents={{
            click: (p) => p.dataIndex !== undefined && setCommodity(model.ranking[p.dataIndex]!.id),
          }}
        />
        <p className="control-hint">
          HHI = Σ(100 × share)² over recorded partners: 10,000 means one partner. Click a bar to explore that
          commodity. Colours use fixed classes of 1,000.
        </p>
      </Section>

      <Section id="risk-monthly" title="Monthly concentration">
        <ChartFrame
          title="HHI by month (recorded partners)"
          option={heat?.option ?? null}
          description={heat?.description}
          height={Math.max(150, 24 * new Set(model.monthly.map((m) => m.month.slice(0, 4))).size + 30)}
        />
        <ul className="map-legend__classes" aria-label="HHI classes">
          {HHI_CLASS_LABELS.map((l, i) => (
            <li key={l}>
              <span className="swatch" data-risk-panel={i} aria-hidden="true" />
              {l}
            </li>
          ))}
        </ul>
        <p className="control-hint">
          Dashed cells are provisional months; empty cells had no recorded imports.
        </p>
      </Section>

      <Section id="risk-disruption" title="Supplier disruption (estimated exposure)">
        {o.selected && model.disruption ? (
          <>
            <ChartFrame
              title={`${o.selected.name}: share of recorded imports by month`}
              option={disruption?.option ?? null}
              description={disruption?.description}
              emptyTitle="No recorded imports from this partner in the period"
              height={160}
            />
            <dl className="profile-rows">
              <Row
                label="Water stress (national)"
                indicator={waterStressIndicator(o.selected.name, model.stressOf.get(o.selected.key) ?? null)}
              />
            </dl>
            <p className="control-hint">
              Months in which {o.selected.name} supplied at least half of recorded imports:{" "}
              <strong>{model.disruption.monthsAtLeastHalf}</strong> of {model.disruption.monthsWithShare}.
              This is the part of recorded supply exposed if its exports to the UK stopped — not a shortage.
            </p>
            <button type="button" className="text-btn" onClick={() => selectPartner(null)}>
              Clear partner
            </button>
          </>
        ) : (
          <p className="control-hint">
            Select a recorded partner on the map or in the controls to see its share of recorded imports month
            by month.
          </p>
        )}
      </Section>

      <Section id="risk-stress" title="Partners' water stress">
        <ChartFrame
          title="Recorded imports by partners' water-stress class"
          option={stress.option}
          description={stress.description}
          height={170}
        />
        <div className="table-scroll">
          <table className="data-table data-table--compact">
            <caption className="visually-hidden">
              Largest recorded partners and their national water stress
            </caption>
            <thead>
              <tr>
                <th scope="col">Partner</th>
                <th scope="col" className="num">
                  Share
                </th>
                <th scope="col">Water stress (year)</th>
              </tr>
            </thead>
            <tbody>
              {topRows.map((r) => {
                const s = model.stressOf.get(r.key) ?? null;
                return (
                  <tr key={r.key} aria-selected={r.key === o.selected?.key}>
                    <td>
                      <button type="button" className="row-btn" onClick={() => selectPartner(r.key)}>
                        {r.name}
                      </button>
                    </td>
                    <td className="num">{formatShare(r.share)}</td>
                    <td>
                      {s ? (
                        <>
                          <span
                            className="swatch swatch--inline"
                            data-risk-panel={
                              ["none", "low", "medium", "high", "critical"].indexOf(s.class) + 1
                            }
                            aria-hidden="true"
                          />{" "}
                          {STRESS_LABELS[s.class].split(" (")[0]} · {formatShare(s.value / 100)} ({s.year})
                        </>
                      ) : (
                        <span className="unavailable-cell">No data</span>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        <p className="control-hint">
          FAO AQUASTAT (SDG 6.4.2): freshwater withdrawal as a share of available resources, for the whole
          country. It does not describe the growing region, the season or irrigation of these imports.
        </p>
      </Section>

      <Section id="risk-trend" title="Import trend" open={false}>
        <ChartFrame
          title={`Recorded imports by year (${measureLabel})`}
          option={trend?.option ?? null}
          description={trend?.description}
          height={160}
        />
        <p className="control-hint">
          * Partial year (months published so far). Values are recorded imports, all partners.
        </p>
      </Section>

      <Section id="risk-matrix" title="Commodity–country exposure" open={false}>
        <ChartFrame
          title={`${model.matrixGroup ? `${model.matrixGroup.label}: share` : "Share"} of each commodity's recorded imports, ${o.periodText}`}
          option={matrix?.option ?? null}
          description={matrix?.description}
          height={Math.max(160, 18 * model.matrix.partners.length + 30)}
        />
        <p className="control-hint">
          {model.matrixGroup
            ? `The commodities in ${o.commodity.label.toLowerCase()}'s group, ${model.matrixGroup.label.toLowerCase()}; pick a commodity in another group to compare that group. `
            : ""}
          Each commodity&rsquo;s top five partners; &ndash; = none recorded. Partner = country of dispatch.
        </p>
      </Section>

      <Section id="risk-production" title="UK production (national context)" open={false}>
        <NationalBanner>
          Defra&rsquo;s annual supply balance for the UK; never combined with monthly imports.
        </NationalBanner>
        {productionError ? (
          <Notice tone="warn">Defra production figures could not be loaded.</Notice>
        ) : !production ? (
          <SkeletonLines label="Loading UK production" />
        ) : production.status === "not_published" ? (
          <p className="unavailable">
            <strong>Data unavailable:</strong> {production.note}
          </p>
        ) : (
          <dl className="profile-rows">
            <Row
              label={`UK production as % of supply (${production.year}${production.provisional ? ", provisional" : ""})`}
              indicator={{
                id: "risk.supply.production_share",
                label: "UK production as a share of total supply",
                value: (production.measures.find((m) => m.key === "productionShare")?.value ?? NaN) / 100,
                unit: "share",
                provenance: "official_estimate",
                sourceIds: [production.sourceId],
                referencePeriod: String(production.year),
                coverage: `United Kingdom${production.scope ? `; ${production.scope}` : ""}`,
                method: `${production.table}: ${production.measures.find((m) => m.key === "productionShare")?.label ?? "production share"}, as published.`,
                scope: "national_context",
              }}
            />
          </dl>
        )}
        {production?.status === "published" && (
          <p className="control-hint">
            {production.scope ? `${production.scope}. ` : ""}
            {production.notes.join(" ")}
          </p>
        )}
      </Section>

      <Section id="risk-notes" title="Data notes" open={false}>
        <ul className="notes-list">
          <li>
            Recorded partner = HMRC&rsquo;s country of dispatch, which may not be where the food was grown.
          </li>
          {model.provisionalMonths > 0 && (
            <li>{model.provisionalMonths} months of the period are provisional and may be revised.</li>
          )}
          {o.status.seriesBreaks.length > 0 && (
            <li>
              The comparison crosses series breaks:{" "}
              {o.status.seriesBreaks.map((b) => `${formatMonth(b.month)} (${b.label})`).join("; ")}.
            </li>
          )}
          {o.status.seriesBreaks.length === 0 && (
            <li>
              GB–EU figures have series breaks in{" "}
              {SERIES_BREAKS.map((b) => formatMonth(b.month)).join(" and ")}.
            </li>
          )}
          {(model.codeChanges ?? []).map((c) => (
            <li key={c.month}>
              Commodity code change in {formatMonth(c.month)}: {c.ended.join(", ")} replaced by{" "}
              {c.started.join(", ")}; the basket covers all of them, so totals continue.
            </li>
          ))}
          {o.nonCountry.length > 0 && (
            <li>
              Recorded imports without a partner country (
              {o.nonCountry.map((n) => `${n.label} ${formatShare(n.shareOfTotal)}`).join(", ")}) are excluded
              from shares and HHI and never redistributed.
            </li>
          )}
          <li>
            Water stress: latest year per country (mostly 2022); countries without a value are shown as no
            data.
          </li>
        </ul>
      </Section>
    </>
  );
}

// ---------------------------------------------------------------------------------------------
// Logistics

function LogisticsInsights() {
  const { status, error, model, farmingError } = useRiskLogistics();
  const selectPort = useAppStore((s) => s.selectPort);
  const [regionId, setRegionId] = useState<string | null>(null);
  const [topic, setTopic] = useState<string>("ports");
  const farm = model?.farmingMeasure ?? null;
  const year = model?.farmingYear ?? null;
  const region =
    model && farm ? (model.regions.find((r) => r.id === regionId) ?? model.regions[0] ?? null) : null;
  const topics = useMemo(
    () => [
      { id: "ports", label: model?.selected ? model.selected.name : "Ports" },
      { id: "roads", label: "Roads and rail" },
      ...(farm && region && year ? [{ id: "region", label: "Farming" }] : []),
    ],
    [model, farm, region, year],
  );
  const active = topics.some((t) => t.id === topic) ? topic : "ports";
  const explanation = useMemo(() => {
    if (!model) return null;
    if (active === "region" && farm && region && year) return explainRegion(region, farm, year);
    if (active === "roads") return explainRoads(model);
    return model.selected ? explainPort(model.selected, model) : explainPorts(model);
  }, [model, farm, region, year, active]);
  if (status === "error") return <Failed title="Port data could not be loaded" error={error} />;
  if (!model || !explanation) return <Loading label="Loading ports and corridors" />;
  const sel = model.selected;
  const trend = portTrendOption(
    model.years,
    sel ? sel.series[model.measure] : model.totals,
    `${sel ? sel.name : "All major ports"}: ${PORT_MEASURE_LABELS[model.measure].short.toLowerCase()}`,
  );
  const entry = entryOption(model.entry, model.selected?.locode ?? null);
  const straits = shortStraitsOption(model.entry);
  const srn = srnOption(model.entry);
  const regions = sel
    ? sel.regionsLatest[model.measure === "agricultural" ? "agricultural" : "international"]
    : [];
  const regionChart = sel
    ? portRegionsOption(
        regions,
        `${sel.name}: ${model.measure === "agricultural" ? "agricultural products" : "freight"} inwards, ${model.latestYear}`,
      )
    : null;

  return (
    <>
      <ExplainPanel explanation={explanation} topics={topics} topic={active} onTopic={setTopic} />

      {sel && (
        <Section id="risk-port" title={sel.name} badge={<span className="chip">{sel.nation}</span>}>
          <dl className="profile-rows">
            <Row label={PORT_MEASURE_LABELS[model.measure].short} indicator={portIndicator(sel, model)} />
          </dl>
          <p className="control-hint">
            {changeText(sel.latest, sel.previous, model.latestYear - 1)} · {formatShare(sel.shareOfTotal)} of
            all major ports · located by {sel.location.source === "dft" ? "DfT" : "EMODnet"}
            {sel.foodEntry.length ? ` · UKFSR food entry point (${sel.foodEntry.join(", ")})` : ""}
          </p>
          <ChartFrame
            title="By year"
            option={trend?.option ?? null}
            description={trend?.description}
            height={150}
            emptyTitle="No tonnage for this measure"
          />
          {model.measure !== "roro" && (
            <ChartFrame
              title="By region of loading"
              option={regionChart?.option ?? null}
              description={regionChart?.description}
              height={150}
              emptyTitle="None recorded from abroad"
            />
          )}
          <button type="button" className="text-btn" onClick={() => selectPort(null)}>
            Clear port
          </button>
        </Section>
      )}

      <Section id="risk-ports" title="Major ports">
        {!sel && (
          <ChartFrame
            title="All major ports by year"
            option={trend?.option ?? null}
            description={trend?.description}
            height={140}
          />
        )}
        <div className="table-scroll">
          <table className="data-table data-table--compact">
            <caption className="visually-hidden">
              Major ports by {PORT_MEASURE_LABELS[model.measure].short.toLowerCase()}, {model.latestYear}
            </caption>
            <thead>
              <tr>
                <th scope="col">Port</th>
                <th scope="col" className="num">
                  {model.latestYear}
                </th>
                <th scope="col" className="num">
                  Share
                </th>
              </tr>
            </thead>
            <tbody>
              {model.ports.slice(0, 15).map((p) => (
                <tr key={p.locode} aria-selected={p.locode === sel?.locode}>
                  <td>
                    <button type="button" className="row-btn" onClick={() => selectPort(p.locode)}>
                      {p.name}
                    </button>
                    {p.foodEntry.length > 0 && (
                      <span
                        className="chip chip--risk"
                        title="Named by UKFSR as an entry point for food, feed and drink imports"
                      >
                        food entry
                      </span>
                    )}
                  </td>
                  <td className="num">{formatTonnes(p.latest === null ? null : p.latest * 1000)}</td>
                  <td className="num">{formatShare(p.shareOfTotal)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="control-hint">
          DfT tonnage of all cargo ({model.ports.length} major ports). Only agricultural products are food or
          feed; containers and roll-on/roll-off lorries carry most fresh food, with no commodity recorded.
        </p>
      </Section>

      <Section id="risk-entry" title="Food imports by port of entry">
        <NationalBanner>
          UK Food Security Report 2024: the only published food-specific port evidence.
        </NationalBanner>
        <ChartFrame
          title={`Share of food, feed and drink import volume, ${model.entry.portOfEntry.years.at(-1)}`}
          option={entry.option}
          description={entry.description}
          height={250}
          onEvents={{
            click: (p) => {
              const g = model.entry.portOfEntry.groups[p.dataIndex ?? -1];
              // Select only (never toggle off): two UKFSR groups share London's port.
              if (g?.locodes[0] && g.locodes[0] !== model.selected?.locode) selectPort(g.locodes[0]);
            },
          }}
        />
        <p className="control-hint">{model.entry.portOfEntry.note}</p>
      </Section>

      <Section id="risk-straits" title="Short Straits dependence by food group" open={false}>
        <ChartFrame
          title={`Share entering via Dover, Folkestone or the Channel Tunnel, ${model.entry.shortStraits.years.at(-1)}`}
          option={straits.option}
          description={straits.description}
          height={230}
        />
      </Section>

      <Section id="risk-roads" title="Road network" open={false}>
        <ChartFrame
          title="Average delay on England's Strategic Road Network"
          option={srn.option}
          description={srn.description}
          height={150}
        />
        <p className="control-hint">
          Seconds per vehicle per mile, all traffic (UKFSR 2024). The map&rsquo;s road corridors come from OS
          Open Roads (Great Britain) and OpenStreetMap (Northern Ireland), and its railway lines from
          Translink&rsquo;s NIR network (Northern Ireland only, 2015).
        </p>
      </Section>

      <Section id="risk-farming" title="Agricultural production regions" open={Boolean(farm)}>
        {farmingError ? (
          <Notice tone="warn">Farming statistics could not be loaded.</Notice>
        ) : (
          <>
            {farm && (
              <label className="field-row">
                <span>Explain region</span>
                <select
                  className="select select--small"
                  value={region?.id ?? ""}
                  onChange={(e) => {
                    setRegionId(e.target.value);
                    setTopic("region");
                  }}
                >
                  {model.regions.map((r) => (
                    <option key={r.id} value={r.id}>
                      {r.name}
                    </option>
                  ))}
                </select>
              </label>
            )}
            <div className="table-scroll">
              <table className="data-table data-table--compact">
                <caption className="visually-hidden">
                  Farming statistics by region{year ? `, June ${year}` : ""}
                </caption>
                <thead>
                  <tr>
                    <th scope="col">Region</th>
                    <th scope="col" className="num">
                      {farm ? FARM_UNITS[farm] : "Wheat (ha)"}
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {model.regions.map((r) => (
                    <tr key={r.id}>
                      <th scope="row">{r.name}</th>
                      <td className="num">
                        {farm && r.density === null ? (
                          "No data"
                        ) : farm && r.density !== null ? (
                          <>
                            <span
                              className="swatch swatch--inline"
                              data-class={1 + (r.cls ?? 0)}
                              aria-hidden="true"
                            />{" "}
                            {farm === "wheat"
                              ? formatShare(r.density / 100)
                              : Math.round(r.density).toLocaleString("en-GB")}
                          </>
                        ) : r.values.wheat === undefined ? (
                          "No data"
                        ) : (
                          r.values.wheat.toLocaleString("en-GB")
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <p className="control-hint">
              Defra June survey{year ? ` ${year}` : ""} (England: commercial holdings, by Defra region; London
              with the South East).
              {farm ? "" : " Choose a measure in the controls to map it."} Measures:{" "}
              {FARM_MEASURES.map((m: FarmMeasure) => FARM_LABELS[m]).join(", ")}.
            </p>
            {farm && region && year && (
              <dl className="profile-rows">
                <Row label={region.name} indicator={farmingIndicator(region, farm, year)} />
              </dl>
            )}
          </>
        )}
      </Section>
    </>
  );
}

// ---------------------------------------------------------------------------------------------
// Community access

function AccessInsights() {
  const { status, error, model, contextError, mapError } = useRiskAccess();
  const setLad = useAppStore((s) => s.setLad);
  const setModule = useAppStore((s) => s.setModule);
  const explanation = useMemo(
    () => (model?.selected ? explainCouncil(model.selected, model) : null),
    [model],
  );
  if (status === "error") return <Failed title="Priority places data could not be loaded" error={error} />;
  if (!model) return <Loading label="Loading councils" />;
  const label = PPFI_LABELS[model.measure];
  const sel = model.selected;
  const ranking = councilRankingOption(model.ranking, sel?.code ?? null, model.nationShare);
  const deciles = sel ? decileOption(model.deciles.get(sel.code) ?? [], sel.nation) : null;
  const domains = sel
    ? domainsOption(model.selectedDomains.map((d) => ({ label: d.label, share: d.share })))
    : null;
  // One nation at a time: the shares are set within each nation and are never compared across them.
  const urbanNation = model.urbanRural.find((u) => u.nation === model.nation) ?? null;
  const urban = urbanNation ? urbanRuralOption([urbanNation]) : null;

  return (
    <>
      {mapError && (
        <section className="panel-section">
          <Notice tone="warn">
            The council boundaries are missing from the data index, so the map cannot be drawn; the figures
            below are unaffected.
          </Notice>
        </section>
      )}
      {explanation ? (
        <ExplainPanel explanation={explanation} />
      ) : (
        <section className="panel-section">
          <h3 className="panel-section__title">Explain this risk</h3>
          <p className="control-hint">
            Select a council on the map or in the controls to explain its priority places.
          </p>
        </section>
      )}

      {sel && (
        <Section id="risk-council" title={sel.name} badge={<span className="chip">{sel.nation}</span>}>
          {sel.fewAreas && (
            <Notice tone="warn">
              {sel.name} has only {sel.areas} small areas: one area moves its share by{" "}
              {formatShare(1 / sel.areas)}.
            </Notice>
          )}
          <ChartFrame
            title="Share in deciles 1–2, by measure"
            option={domains?.option ?? null}
            description={domains?.description}
            height={200}
          />
          <ChartFrame
            title="Small areas by decile (combined index)"
            option={deciles?.option ?? null}
            description={deciles?.description}
            height={150}
          />
          <button
            type="button"
            className="text-btn"
            onClick={() => {
              setLad(sel.code);
              setModule("profiles");
            }}
          >
            Open the council profile <ArrowUpRight size={14} aria-hidden="true" />
          </button>
        </Section>
      )}

      <Section
        id="risk-council-ranking"
        title={`Councils in ${model.nation}`}
        badge={<span className="chip">{label}</span>}
      >
        {model.measureMissing ? (
          <p className="unavailable">
            <strong>Data unavailable:</strong> the index has no data for {label.toLowerCase()} in{" "}
            {model.nation}.
          </p>
        ) : (
          <ChartFrame
            title={`Share of small areas in ${model.nation}'s deciles 1–2`}
            option={ranking?.option ?? null}
            description={ranking?.description}
            height={Math.min(340, 22 * Math.min(13, model.ranking.length) + 20)}
            onEvents={{
              click: (p) => {
                const name = String(p.name ?? "").replace(/^\d+=?\.\s/, "");
                const row = model.ranking.find((r) => r.name === name);
                if (row) setLad(row.code);
              },
            }}
          />
        )}
        <p className="control-hint">
          Highest share first; the dashed line is the nation as a whole (about 20 % by construction). Ranks
          are within {model.nation} only.
        </p>
        <ul className="map-legend__classes" aria-label="Classes">
          {PRIORITY_CLASS_LABELS.map((l, i) => (
            <li key={l}>
              <span className="swatch" data-risk-panel={i} aria-hidden="true" />
              {l}
            </li>
          ))}
        </ul>
      </Section>

      <Section id="risk-urban-rural" title="Urban and rural councils" open={false}>
        {contextError ? (
          <Notice tone="warn">The urban/rural classification could not be loaded.</Notice>
        ) : urbanNation ? (
          <ChartFrame
            title={`${model.nation}: median council share, by urban/rural flag`}
            option={urban?.option ?? null}
            description={urban?.description}
            height={110}
          />
        ) : (
          <p className="unavailable">
            <strong>Data unavailable:</strong> {model.nation} has no council-level urban/rural class in this
            build.
          </p>
        )}
        <p className="control-hint">
          ONS 2021 Rural Urban Classification of councils (England and Wales), shown for the ranking nation
          only: the shares are set within each nation, so nations are never compared.
        </p>
      </Section>

      <Section id="risk-access-notes" title="Data notes" open={false}>
        <ul className="notes-list">
          <li>{model.index.orientation}</li>
          <li>{model.index.measure}</li>
          <li>{model.index.comparability}</li>
          {model.index.domainsWithoutDataNote && <li>{model.index.domainsWithoutDataNote}</li>}
          {model.nations.map((n) => (
            <li key={n.nation}>
              {n.nation}: {n.areas.toLocaleString("en-GB")} {n.areaType} areas in {n.councils} councils (
              {n.assignment}).
            </li>
          ))}
        </ul>
      </Section>
    </>
  );
}

/** Right-hand panel for the active Risk Explorer view. */
export function RiskInsights() {
  const view = useAppStore((s) => s.riskView);
  return view === "supply" ? (
    <SupplyInsights />
  ) : view === "logistics" ? (
    <LogisticsInsights />
  ) : (
    <AccessInsights />
  );
}
