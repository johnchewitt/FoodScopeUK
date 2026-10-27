import { OriginsLegend, OriginsMapSync, OriginsTooltip } from "@/features/origins/OriginsMapExtras";
import { ProfileLegend, ProfileMapSync, ProfileTooltip } from "@/features/profiles/ProfileMapExtras";
import { ScenarioLegend, ScenarioMapSync, ScenarioTooltip } from "@/features/scenarios/ScenarioMapExtras";
import { useAppStore } from "@/state/store";
import { ReportDialog } from "./ReportDialog";
import { InsightsSync } from "./InsightsSync";

/**
 * The map of the selected assessment: the module it draws on publishes its map model, legend and
 * tooltip (authority: the council's profile map; commodity: the trade map; scenario: the Scenario
 * Lab's map), so the assessment and the map always show the same selection. Also mounts the
 * assessment sync and the full-report dialog.
 */
export function InsightsMapExtras() {
  const kind = useAppStore((s) => s.insightsKind);
  return (
    <>
      <InsightsSync />
      {kind === "authority" ? (
        <>
          <ProfileMapSync />
          <ProfileLegend />
          <ProfileTooltip />
        </>
      ) : kind === "commodity" ? (
        <>
          <OriginsMapSync />
          <OriginsLegend />
          <OriginsTooltip />
        </>
      ) : (
        <>
          <ScenarioMapSync />
          <ScenarioLegend />
          <ScenarioTooltip />
        </>
      )}
      <ReportDialog />
    </>
  );
}
