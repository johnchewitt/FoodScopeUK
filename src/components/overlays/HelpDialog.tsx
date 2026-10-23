import { useAppStore } from "@/state/store";

const SHORTCUTS: [string, string][] = [
  ["[", "Show or hide the controls panel"],
  ["]", "Show or hide the insights panel"],
  ["← →", "Previous or next month (when the timeline has focus)"],
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
              This is the application foundation: navigation, layout, the map and the evidence framework. It
              does not yet load trade, retail or population statistics, so no figures are shown. Each panel
              says which build stage adds its data.
            </p>
          </section>
        </div>
      )}
    </calcite-dialog>
  );
}
