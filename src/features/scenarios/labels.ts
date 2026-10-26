import { INCREASE_BREAKS_M } from "@/analysis/scenario";

const km = (m: number) => `${m >= 1000 ? `${m / 1000} km` : `${m} m`}`;
/** Classes of the extra straight-line distance on the closure map and legend. */
export const INCREASE_LABELS = [
  `Under ${km(INCREASE_BREAKS_M[0])}`,
  `${km(INCREASE_BREAKS_M[0])} – ${km(INCREASE_BREAKS_M[1])}`,
  `${km(INCREASE_BREAKS_M[1])} – ${km(INCREASE_BREAKS_M[2])}`,
  `${km(INCREASE_BREAKS_M[2])} – ${km(INCREASE_BREAKS_M[3])}`,
  `${km(INCREASE_BREAKS_M[3])} and over`,
];
