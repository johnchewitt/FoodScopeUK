import { ProvenanceBadge } from "@/components/dashboard/ProvenanceBadge";
import { EmptyState } from "@/components/states/EmptyState";
import { ErrorState } from "@/components/states/ErrorState";
import { SkeletonLines } from "@/components/states/Skeleton";
import { PRINCIPLES } from "@/content/principles";
import { describeDataError } from "@/services/data/errors";
import { familySnapshots, useManifest } from "@/services/data/queries";
import { useAppStore } from "@/state/store";
import { PROVENANCE_CLASSES, PROVENANCE_DESCRIPTIONS } from "@/types/indicator";

const STATUS_LABEL = {
  verified: "Verified",
  partly_verified: "Partly verified",
  to_verify: "To verify",
  gap: "Gap",
} as const;

/** Long API queries are shown as their host and path, with the full URL behind the link. */
function RetrievalSource({ source }: { source: string }) {
  const match = /^(https?:\/\/[^\s?]+)(\?\S*)?/.exec(source);
  if (!match) return <>{source}</>;
  const [, base, query] = match;
  const rest = source.slice(match[0].length);
  return (
    <>
      <a href={match[0]} target="_blank" rel="noreferrer" title={match[0]} className="evidence-url">
        {base!.replace(/^https?:\/\//, "")}
      </a>
      {query ? " (query recorded)" : ""}
      {rest}
    </>
  );
}

const TRADE_CAVEATS = [
  "Partner = the country of dispatch recorded by HMRC (the last country goods were shipped from), which may differ from the country where the food was grown. The Netherlands, for example, re-exports produce grown elsewhere (S02).",
  "Connections on the map are symbolic links from a partner's label point to a single UK point. They are not shipping routes and do not show ports of entry.",
  "Imports are valued at cost, insurance and freight to the UK border (statistical value); EU trade collected through Intrastat uses invoice value. About a third of Intrastat goods need no weight declaration, so HMRC estimates their net mass.",
  "Data is provisional for up to 18 months after publication and is revised by HMRC; recent months are marked provisional.",
  "Series breaks: the end of the EU exit transition period (January 2021) and GB imports from the EU compiled from customs declarations from January 2022. Comparisons across these dates should be read with care.",
  "Suppressed trade, and trade HMRC records without a partner country, is listed separately in the Insights panel and never redistributed across partners.",
  "Import dependence is not food insecurity (P8); recorded imports describe trade, not consumption or supply.",
  "Seasonal Supply: months HMRC has not yet published are shown hatched and are never estimated or interpolated. Partial years are compared like for like, and annual figures need all 12 months.",
  "Seasonal Supply: connection widths use one fixed scale for every month and year (12 px = the largest monthly value from one partner), and heatmap classes are the same for every year, so months and years compare directly.",
  "Commodity codes change over time (e.g. tomatoes split into three codes from January 2025). Each basket includes every current and discontinued code, so its totals are continuous; the Seasonal panel lists when each code was recorded.",
  "UK seasonal production is not shown: Defra publishes production of these commodities once a year, not monthly (S09, S10). Imports are never used to estimate domestic production.",
];

const LOCAL_CAVEATS = [
  "Stores are GEOLYTIX Grocery Retail Points (June 2026). Each store is counted in the council it falls in on the ONS May 2025 full-resolution boundaries; a coastal store just outside every boundary goes to the nearest council within 50 m. Stores in the Crown Dependencies are mapped but belong to no council.",
  "Store counts and distances describe physical provision only; they do not measure affordability, choice or nutritional access.",
  "Distances are straight-line, from each small area's Census 2021 population-weighted centroid to the nearest store in the same national grid (British National Grid; Irish Transverse Mercator in Northern Ireland). They are not road-network, walking or public transport times. 'Residents beyond 1 km' adds up whole small areas whose centroid is beyond 1 km.",
  "Rates per 10,000 residents use ONS mid-2025 population; small-area shares use Census 2021 counts. The two are never combined in one figure.",
  "Priority Places for Food Index v2.1: decile 1 = highest priority, ranked within each nation. The publisher does not state the direction; FOODSCOPE checked it against the deprivation indices. Northern Ireland is published on the 2011 Super Output Areas and three of its seven domains have no Northern Ireland data.",
  "Deprivation: English Indices of Deprivation 2025 (LSOAs) and the Northern Ireland Multiple Deprivation Measure 2017 (SOAs). Each ranks areas within its own nation and they are never compared or combined across nations.",
  "Urban/rural: the ONS 2021 classification covers England and Wales; Northern Ireland's 2015 class is shown for small areas only; Scotland's classification is not included in this release.",
  "Car or van availability is from Census 2021 (England, Wales and Northern Ireland). Scotland's census was held in 2022 and is not included.",
  "In Northern Ireland GEOLYTIX maps ten retailers. Other grocers from the Food Standards Agency register are an optional map layer, never counted in a rate or distance.",
  "Local Authority Profiles: national supply context (recorded imports, UK production) is the same for every council and is labelled as national; it says nothing about a council's own supply chains. Small-area figures are published for Belfast and Manchester only in this release.",
];

/** Evidence & Limitations (SH-06, EV-03), generated from the data manifest. */
export function EvidenceDialog() {
  const open = useAppStore((s) => s.overlay === "evidence");
  const close = useAppStore((s) => s.closeOverlay);
  const manifest = useManifest();

  return (
    <calcite-dialog
      open={open}
      modal
      heading="Evidence and limitations"
      description="What the data is, where it comes from and how to read it"
      widthScale="l"
      oncalciteDialogClose={() => close()}
    >
      {open && (
        <div className="dialog-body">
          <section>
            <h3>How to read the numbers</h3>
            <p>Every figure in FOODSCOPE UK carries one of five provenance labels.</p>
            <div className="prov-legend" style={{ marginTop: 10 }}>
              {PROVENANCE_CLASSES.map((cls) => (
                <div className="prov-legend__item" key={cls}>
                  <ProvenanceBadge cls={cls} />
                  <span>{PROVENANCE_DESCRIPTIONS[cls]}</span>
                </div>
              ))}
            </div>
          </section>

          <section>
            <h3>Data in use</h3>
            {manifest.isPending && <SkeletonLines />}
            {manifest.isError && (
              <ErrorState
                title="The data index could not be loaded"
                body={describeDataError(manifest.error)}
              />
            )}
            {manifest.data && (
              <>
                {manifest.data.snapshotId ? (
                  <p>
                    Statistical snapshots{" "}
                    {familySnapshots(manifest.data).map((f, i, all) => (
                      <span key={f.family}>
                        {f.label.toLowerCase()} <strong>{f.id}</strong>
                        {i < all.length - 1 ? ", " : ""}
                      </span>
                    ))}
                    : every figure on screen comes from the datasets below, which the data pipeline retrieved,
                    checksummed and validated. Each kind of data comes from its own latest snapshot, so trade
                    and stores refresh on their own schedules.
                  </p>
                ) : (
                  <EmptyState
                    title="No statistics have been published yet"
                    body="This build shows reference map geometry only. The verified source inventory is kept in docs/03-DATA-SOURCES.md and dated statistical snapshots are added from build stage 2."
                  />
                )}
                <table className="data-table" style={{ marginTop: 12 }}>
                  <thead>
                    <tr>
                      <th scope="col">Dataset</th>
                      <th scope="col">Source</th>
                      <th scope="col">Period</th>
                      <th scope="col">Licence and attribution</th>
                    </tr>
                  </thead>
                  <tbody>
                    {manifest.data.datasets.map((d) => (
                      <tr key={d.id}>
                        <td>
                          {d.title}
                          <br />
                          <ProvenanceBadge cls={d.provenance} />{" "}
                          <code title={`SHA-256 ${d.sha256}`}>{d.sha256.slice(0, 12)}</code>
                        </td>
                        <td>
                          <code>{d.sourceIds.join(", ")}</code>
                          <br />
                          <RetrievalSource source={d.retrieval.source} />
                        </td>
                        <td>{d.referencePeriod}</td>
                        <td>
                          {d.licence}
                          <br />
                          {d.attribution}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </>
            )}
          </section>

          {manifest.data?.datasets.some((d) => d.id.startsWith("trade.")) && (
            <section>
              <h3>Reading the trade figures (Food Origins and Seasonal Supply)</h3>
              <ul className="evidence-caveats">
                {TRADE_CAVEATS.map((c) => (
                  <li key={c}>{c}</li>
                ))}
              </ul>
            </section>
          )}

          {manifest.data?.datasets.some((d) => d.id.startsWith("local.")) && (
            <section>
              <h3>Reading the local figures (UK Food Access and Local Authority Profiles)</h3>
              <ul className="evidence-caveats">
                {LOCAL_CAVEATS.map((c) => (
                  <li key={c}>{c}</li>
                ))}
              </ul>
            </section>
          )}

          {manifest.data && (
            <section>
              <h3>Source catalogue (sources used by this build)</h3>
              <table className="data-table">
                <thead>
                  <tr>
                    <th scope="col">ID</th>
                    <th scope="col">Source</th>
                    <th scope="col">Status</th>
                    <th scope="col">Notes</th>
                  </tr>
                </thead>
                <tbody>
                  {manifest.data.catalogue.map((c) => (
                    <tr key={c.id}>
                      <td>
                        <code>{c.id}</code>
                      </td>
                      <td>
                        <a href={c.url} target="_blank" rel="noreferrer">
                          {c.title}
                        </a>
                        <br />
                        {c.publisher}. {c.licence}
                      </td>
                      <td>{STATUS_LABEL[c.status]}</td>
                      <td>{c.notes}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </section>
          )}

          <section>
            <h3>Integrity principles</h3>
            <ul className="principles">
              {PRINCIPLES.map((p) => (
                <li key={p.id}>
                  <span className="principles__id">{p.id}</span>
                  <span className="principles__text">
                    <strong>{p.title}</strong>
                    <span>{p.detail}</span>
                  </span>
                </li>
              ))}
            </ul>
          </section>
        </div>
      )}
    </calcite-dialog>
  );
}
