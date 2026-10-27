/**
 * Map image export (brief §7): the captured map with a strip under it carrying the title, what the
 * image shows (extent, scale, basemap) and the credits of every layer, so the image never travels
 * without its attribution (Esri terms; dataset licences). Browser only (canvas).
 */
import { captureCaption, type MapCapture } from "@/map/capture";

const STRIP_FONT = "IBM Plex Sans, system-ui, sans-serif";

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error("the captured map could not be read"));
    img.src = src;
  });
}

/** Breaks text into lines that fit `width` at the context's font. */
export function wrapLines(measure: (s: string) => number, text: string, width: number): string[] {
  const words = text.split(/\s+/).filter(Boolean);
  const lines: string[] = [];
  let line = "";
  for (const w of words) {
    const next = line ? `${line} ${w}` : w;
    if (measure(next) <= width || !line) line = next;
    else {
      lines.push(line);
      line = w;
    }
  }
  if (line) lines.push(line);
  return lines;
}

/** The map with title, extent caption and credits drawn under it, as PNG bytes. */
export async function composeMapImage(capture: MapCapture, title: string): Promise<Blob> {
  const img = await loadImage(capture.dataUrl);
  const pad = 24;
  const w = img.width;
  const canvas = document.createElement("canvas");
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("this browser cannot draw the image");
  ctx.font = `14px ${STRIP_FONT}`;
  const caption = wrapLines((s) => ctx.measureText(s).width, captureCaption(capture), w - 2 * pad);
  const credits = wrapLines(
    (s) => ctx.measureText(s).width,
    `Credits: ${capture.attribution || "—"}`,
    w - 2 * pad,
  );
  const strip = pad + 22 + (caption.length + credits.length) * 19 + 26 + pad;
  canvas.width = w;
  canvas.height = img.height + strip;
  ctx.fillStyle = "#071923";
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.drawImage(img, 0, 0);
  let y = img.height + pad + 16;
  ctx.fillStyle = "#edf7f5";
  ctx.font = `600 17px ${STRIP_FONT}`;
  ctx.fillText(title, pad, y);
  y += 24;
  ctx.font = `14px ${STRIP_FONT}`;
  ctx.fillStyle = "#c7d8d8";
  for (const l of [...caption, ...credits]) {
    ctx.fillText(l, pad, y);
    y += 19;
  }
  ctx.fillStyle = "#8eadae";
  ctx.fillText(
    "FOODSCOPE UK · ConsultingWhere · exploratory geospatial assessment from published open data",
    pad,
    y + 6,
  );
  return new Promise((resolve, reject) =>
    canvas.toBlob((b) => (b ? resolve(b) : reject(new Error("the image could not be encoded"))), "image/png"),
  );
}
