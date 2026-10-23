import { formatShare } from "@/analysis/format";
import { SHARE_BREAKS } from "@/analysis/trade";

/** Labels for the fixed share classes on the map (spec §7.4), e.g. "1 % – 5 %". */
export const CLASS_LABELS = [
  `< ${formatShare(SHARE_BREAKS[0]!)}`,
  ...SHARE_BREAKS.slice(0, -1).map((b, i) => `${formatShare(b)} – ${formatShare(SHARE_BREAKS[i + 1]!)}`),
  `≥ ${formatShare(SHARE_BREAKS[SHARE_BREAKS.length - 1]!)}`,
].map((s) => s.replace(/\.0 %/g, " %"));
