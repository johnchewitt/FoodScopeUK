import { lazy, Suspense } from "react";
import { useAppStore } from "@/state/store";

/** The search dialog and its council validator load only when search is opened. */
const Dialog = lazy(() => import("./SearchDialog").then((m) => ({ default: m.SearchDialog })));

export function SearchDialogLazy() {
  const open = useAppStore((s) => s.overlay === "search");
  if (!open) return null;
  return (
    <Suspense fallback={null}>
      <Dialog />
    </Suspense>
  );
}
