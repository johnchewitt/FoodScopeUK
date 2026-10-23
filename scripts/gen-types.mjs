// Generates TypeScript types from the canonical JSON Schemas (ADR-06).
// Usage: npm run gen:types
import { readdir, readFile, writeFile, mkdir } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { compile } from "json-schema-to-typescript";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const schemaDir = path.join(root, "schemas");
const outDir = path.join(root, "src", "types", "generated");

await mkdir(outDir, { recursive: true });
const files = (await readdir(schemaDir)).filter((f) => f.endsWith(".schema.json")).sort();

for (const file of files) {
  const schema = JSON.parse(await readFile(path.join(schemaDir, file), "utf8"));
  const ts = await compile(schema, schema.title, {
    bannerComment: `/* Generated from schemas/${file} by scripts/gen-types.mjs — do not edit by hand. */`,
    additionalProperties: false,
    style: { printWidth: 110, singleQuote: false },
  });
  const outFile = path.join(outDir, file.replace(".schema.json", ".ts"));
  await writeFile(outFile, ts, "utf8");
  console.log(`generated ${path.relative(root, outFile)}`);
}
