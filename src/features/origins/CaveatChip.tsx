import { Info } from "lucide-react";
import { useAppStore } from "@/state/store";

export const CAVEAT_TEXT =
  "Partner = country of dispatch recorded by HMRC; may differ from where the food was grown. Lines are symbolic, not shipping routes.";

/** Persistent caveat (FO-10, P3, P4). Opens the Evidence page. */
export function CaveatChip() {
  const openOverlay = useAppStore((s) => s.openOverlay);
  return (
    <button type="button" className="caveat-chip" onClick={() => openOverlay("evidence")}>
      <Info size={14} aria-hidden="true" />
      <span>{CAVEAT_TEXT}</span>
    </button>
  );
}
