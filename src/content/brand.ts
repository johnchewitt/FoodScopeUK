/**
 * ConsultingWhere's logo (decision D3), supplied by John Hewitt on 27 October 2026 for this
 * demonstrator. It is ConsultingWhere's trademark and is not covered by the repository's licence.
 *
 * The file is the supplied PNG cropped to its artwork (transparent margins removed) with the image
 * editor's metadata left out; the pixels are unchanged. It is drawn only on a white plate (its
 * tagline is dark navy) and never recoloured, stretched or redrawn.
 */
import logoUrl from "@/assets/brand/consultingwhere-logo.png";

export const CONSULTINGWHERE_LOGO = {
  url: logoUrl,
  widthPx: 772,
  heightPx: 168,
  alt: "ConsultingWhere: maximising the value of location information",
} as const;
