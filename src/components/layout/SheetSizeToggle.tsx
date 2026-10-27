import { ChevronDown, ChevronUp } from "lucide-react";
import { useAppStore } from "@/state/store";

/**
 * Phones (B61): the panels are bottom sheets over the map. This button lowers the sheet to a short
 * strip so the map is visible while the controls stay open, and raises it again. Shown on phones only.
 */
export function SheetSizeToggle() {
  const peek = useAppStore((s) => s.sheetPeek);
  const setPeek = useAppStore((s) => s.setSheetPeek);
  return (
    <button
      type="button"
      className="tool-btn only-compact"
      aria-pressed={peek}
      aria-label={peek ? "Raise the panel" : "Lower the panel to show the map"}
      title={peek ? "Raise the panel" : "Show the map"}
      onClick={() => setPeek(!peek)}
    >
      {peek ? <ChevronUp size={17} aria-hidden="true" /> : <ChevronDown size={17} aria-hidden="true" />}
    </button>
  );
}
