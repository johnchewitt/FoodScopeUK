/**
 * Characters the embedded PDF font (IBM Plex Sans, Latin subset) does not have, replaced with
 * equivalents it has, so no glyph renders as a blank box (EX-03). The test checks every character
 * of every generated report against the font's character map.
 */
const REPLACEMENTS: [RegExp, string][] = [
  [/≤/g, "<="],
  [/≥/g, ">="],
  [/→/g, "->"],
  [/←/g, "<-"],
  [/≈/g, "~"],
  [/Σ/g, "sum of "],
  [/\u202f/g, "\u00a0"],
  [/\u2009/g, " "],
  [/[\u200b-\u200d\ufeff]/g, ""],
];

export function pdfText(s: string): string {
  let out = s;
  for (const [re, to] of REPLACEMENTS) out = out.replace(re, to);
  return out;
}
