import { readFileSync } from "node:fs";
import { resolve } from "node:path";

/** Reads a committed repository file in tests (Vitest runs from the repository root). */
export function readRepoFile(relativePath: string): string {
  return readFileSync(resolve(process.cwd(), relativePath), "utf8");
}

export function readRepoJson<T = unknown>(relativePath: string): T {
  return JSON.parse(readRepoFile(relativePath)) as T;
}
