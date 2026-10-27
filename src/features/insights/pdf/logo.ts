/**
 * ConsultingWhere's logo for the PDF cover (D3), fetched from the build's assets once per page and
 * handed to pdfmake as a data URL (it fetches nothing itself). When it cannot be loaded the cover
 * falls back to a text wordmark, so a report is never lost to a missing image.
 */
import { CONSULTINGWHERE_LOGO } from "@/content/brand";
import type { PdfImage } from "./document";

function toBase64(bytes: Uint8Array): string {
  let binary = "";
  const step = 0x8000;
  for (let i = 0; i < bytes.length; i += step) binary += String.fromCharCode(...bytes.subarray(i, i + step));
  return btoa(binary);
}

let cache: Promise<PdfImage | null> | null = null;

export function loadPdfLogo(): Promise<PdfImage | null> {
  cache ??= fetch(CONSULTINGWHERE_LOGO.url)
    .then(async (res) => {
      if (!res.ok) return null;
      const bytes = new Uint8Array(await res.arrayBuffer());
      return {
        dataUrl: `data:image/png;base64,${toBase64(bytes)}`,
        widthPx: CONSULTINGWHERE_LOGO.widthPx,
        heightPx: CONSULTINGWHERE_LOGO.heightPx,
      };
    })
    .catch(() => null)
    .then((logo) => {
      if (!logo) cache = null; // try again next time
      return logo;
    });
  return cache;
}
