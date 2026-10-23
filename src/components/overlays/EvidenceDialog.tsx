import { ProvenanceBadge } from "@/components/dashboard/ProvenanceBadge";
import { EmptyState } from "@/components/states/EmptyState";
import { ErrorState } from "@/components/states/ErrorState";
import { SkeletonLines } from "@/components/states/Skeleton";
import { PRINCIPLES } from "@/content/principles";
import { describeDataError } from "@/services/data/errors";
import { useManifest } from "@/services/data/queries";
import { useAppStore } from "@/state/store";
import { PROVENANCE_CLASSES, PROVENANCE_DESCRIPTIONS } from "@/types/indicator";

const STATUS_LABEL = {
  verified: "Verified",
  partly_verified: "Partly verified",
  to_verify: "To verify",
  gap: "Gap",
} as const;

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
                {!manifest.data.snapshotId && (
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
                          {d.retrieval.source}
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
