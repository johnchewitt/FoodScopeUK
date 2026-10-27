/**
 * IBM Plex Sans for the PDF (EX-03: embedded fonts; SIL Open Font License 1.1). The Latin WOFF
 * files of @fontsource/ibm-plex-sans (the app's own font) are fetched from the build's assets and
 * handed to pdfmake's virtual file system; pdfkit embeds the subset each PDF uses.
 */
import regular from "@fontsource/ibm-plex-sans/files/ibm-plex-sans-latin-400-normal.woff?url";
import italic from "@fontsource/ibm-plex-sans/files/ibm-plex-sans-latin-400-italic.woff?url";
import semibold from "@fontsource/ibm-plex-sans/files/ibm-plex-sans-latin-600-normal.woff?url";
import semiboldItalic from "@fontsource/ibm-plex-sans/files/ibm-plex-sans-latin-600-italic.woff?url";

export const PDF_FONT_FILES = {
  normal: "IBMPlexSans-Regular.woff",
  bold: "IBMPlexSans-SemiBold.woff",
  italics: "IBMPlexSans-Italic.woff",
  bolditalics: "IBMPlexSans-SemiBoldItalic.woff",
} as const;

const URLS: Record<keyof typeof PDF_FONT_FILES, string> = {
  normal: regular,
  bold: semibold,
  italics: italic,
  bolditalics: semiboldItalic,
};

function toBase64(bytes: Uint8Array): string {
  let binary = "";
  const step = 0x8000;
  for (let i = 0; i < bytes.length; i += step) binary += String.fromCharCode(...bytes.subarray(i, i + step));
  return btoa(binary);
}

let cache: Promise<Record<string, string>> | null = null;

/** The font files as pdfmake's virtual file system (base64), fetched once per page. */
export function loadPdfFonts(): Promise<Record<string, string>> {
  cache ??= Promise.all(
    (Object.keys(URLS) as (keyof typeof URLS)[]).map(async (k) => {
      const res = await fetch(URLS[k]);
      if (!res.ok) throw new Error(`the report font could not be loaded (${res.status})`);
      return [PDF_FONT_FILES[k], toBase64(new Uint8Array(await res.arrayBuffer()))] as const;
    }),
  ).then((entries) => Object.fromEntries(entries));
  cache.catch(() => {
    cache = null;
  });
  return cache;
}
