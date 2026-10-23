// Fails if source code uses APIs that CLAUDE.md / ADR-02 forbid.
// Belt-and-braces alongside the ESLint rule (also catches CSS/HTML and string references).
import { readdir, readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const RULES = [
  { re: /@arcgis\/map-components-react/, why: "React wrapper not used (ADR-02)" },
  { re: /@arcgis\/core\/widgets\//, why: "widgets deprecated in SDK 5.0 (ADR-02)" },
  { re: /\b__esri\./, why: "__esri namespace deprecated in 5.0" },
  { re: /\brequire\(\s*\[/, why: "AMD require deprecated in 5.0" },
];

async function* walk(dir) {
  for (const entry of await readdir(dir, { withFileTypes: true })) {
    const p = path.join(dir, entry.name);
    if (entry.isDirectory()) yield* walk(p);
    else if (/\.(tsx?|css|html)$/.test(entry.name)) yield p;
  }
}

let failures = 0;
for await (const file of walk(path.join(root, "src"))) {
  const text = await readFile(file, "utf8");
  for (const { re, why } of RULES) {
    if (re.test(text)) {
      console.error(`${path.relative(root, file)}: ${re} — ${why}`);
      failures++;
    }
  }
}
if (failures) process.exit(1);
console.log("check-banned-imports: OK");
