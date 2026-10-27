import { execSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

describe("third-party notices", () => {
  it("lists every production dependency the build redistributes (rerun scripts/third-party-notices.mjs)", () => {
    const tree = JSON.parse(execSync("npm ls --omit=dev --all --json", { maxBuffer: 1e9 }).toString());
    const notices = readFileSync("public/licenses/THIRD-PARTY-NOTICES.txt", "utf8");
    const missing = [];
    const walk = (deps) => {
      for (const [name, d] of Object.entries(deps ?? {})) {
        if (!d.version) continue;
        if (!notices.includes(`\n${name} ${d.version}\n`)) missing.push(`${name} ${d.version}`);
        walk(d.dependencies);
      }
    };
    walk(tree.dependencies);
    expect([...new Set(missing)]).toEqual([]);
  }, 30_000);
});
