import { useAppStore } from "@/state/store";

const SHORTCUTS: [string, string][] = [
  ["[", "Show or hide the controls panel"],
  ["]", "Show or hide the insights panel"],
  ["← →", "Previous or next month (when the timeline has focus)"],
  ["Home End", "First or last month of the year (timeline)"],
  ["PgUp PgDn", "Next or previous year (Seasonal Supply timeline)"],
  ["Space", "Play or pause the months (Seasonal Supply timeline)"],
  ["F", "Fit the map to the UK and its recorded import partners (Food Origins, Seasonal Supply)"],
  [
    "Arrows",
    "Pan the map (when it has focus); then “Map centre” measures straight-line distances from there",
  ],
  ["?", "Open this help"],
  ["Esc", "Close a dialog"],
];

export function HelpDialog() {
  const open = useAppStore((s) => s.overlay === "help");
  const close = useAppStore((s) => s.closeOverlay);

  return (
    <calcite-dialog
      open={open}
      modal
      heading="Using FOODSCOPE UK"
      description="Navigation, shortcuts and what this build contains"
      widthScale="m"
      oncalciteDialogClose={() => close()}
    >
      {open && (
        <div className="dialog-body">
          <section>
            <h3>Getting around</h3>
            <p>
              Choose a view from the left-hand bar. The map stays in place while you switch. Links copied from
              the address bar reopen the same view, month and authority.
            </p>
          </section>
          <section>
            <h3>Keyboard shortcuts</h3>
            <table className="data-table">
              <tbody>
                {SHORTCUTS.map(([key, action]) => (
                  <tr key={key}>
                    <td style={{ width: 90 }}>
                      <span className="kbd">{key}</span>
                    </td>
                    <td>{action}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </section>
          <section>
            <h3>What this build contains</h3>
            <p>
              Food Origins and Seasonal Supply show recorded UK imports from HMRC for tomatoes, strawberries,
              bananas, potatoes and wheat (monthly from January 2019). UK Food Access maps GEOLYTIX grocery
              stores (June 2026) with stores per 10,000 residents by council (ONS mid-2025) and straight-line
              distances from a point you choose. The other views do not load statistics yet: each panel says
              which build stage adds its data, and no placeholder figures are shown.
            </p>
          </section>
        </div>
      )}
    </calcite-dialog>
  );
}
