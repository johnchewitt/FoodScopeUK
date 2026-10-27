import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { App } from "@/app/App";
import { AppProviders } from "@/app/AppProviders";
import { createQueryClient } from "@/app/queryClient";
import { resetAppStore, useAppStore } from "@/state/store";
import { readRepoFile } from "@/test/files";
import { claimProblems } from "./content";
import { REPORTS_KEY, resetReportsForTests } from "./savedReports";

// The real MapHost loads the ArcGIS SDK (WebGL); the map side is covered by Playwright.
vi.mock("@/components/maps/MapHost", () => ({ default: () => <div data-testid="map-stub" /> }));

const manifestText = readRepoFile("public/data/manifest.json");
const files: Record<string, string> = {
  "config.json": readRepoFile("public/config.json"),
  "data/manifest.json": manifestText,
  ...Object.fromEntries(
    (JSON.parse(manifestText) as { datasets: { path: string }[] }).datasets.map((d) => [
      `data/${d.path}`,
      readRepoFile(`public/data/${d.path}`),
    ]),
  ),
};

function renderAt(search: string) {
  window.history.replaceState(null, "", `/FoodScopeUK/${search}`);
  return render(
    <AppProviders client={createQueryClient()}>
      <App />
    </AppProviders>,
  );
}

const MODULE = "ConsultingWhere Insights";
const kpis = () => screen.getByRole("region", { name: new RegExp(`${MODULE} key figures`) });
const controls = () => screen.getByRole("complementary", { name: `${MODULE} controls` });
const panel = () => screen.getByRole("complementary", { name: "Insights" });
const kpi = (name: string | RegExp) => within(kpis()).getByRole("article", { name });
const T = { timeout: 60_000 };

/** P9 and P14: "shortage" only negated; no claims of clients, credentials, budgets or procurement. */
function audit(text: string) {
  const hits = [...text.matchAll(/[^.]*\bshortages?\b[^.]*/gi)].map((m) => m[0]);
  for (const sentence of hits) expect(sentence, sentence).toMatch(/\bnot\b|\bnothing\b|\bnever\b/i);
  expect(claimProblems(text)).toEqual([]);
}

let downloads: { name: string; blob: Blob }[] = [];

beforeEach(() => {
  resetAppStore();
  resetReportsForTests();
  window.localStorage.clear();
  downloads = [];
  Object.defineProperty(window, "innerWidth", { configurable: true, value: 1920 });
  vi.stubGlobal(
    "fetch",
    vi.fn(async (url: string) => {
      const key = Object.keys(files).find((k) => url.endsWith(k));
      return key ? new Response(files[key], { status: 200 }) : new Response("not found", { status: 404 });
    }),
  );
  let last: Blob | null = null;
  vi.stubGlobal(
    "URL",
    Object.assign(URL, {
      createObjectURL: vi.fn((b: Blob) => {
        last = b;
        return "blob:test";
      }),
      revokeObjectURL: vi.fn(),
    }),
  );
  vi.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(function (this: HTMLAnchorElement) {
    if (this.download && last) downloads.push({ name: this.download, blob: last });
  });
});
afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

// Figures checked independently against the published files (insights.test.ts; Stage 5 report).
describe("ConsultingWhere Insights", { timeout: 120_000 }, () => {
  it("builds Manchester's assessment with key figures, work packages and their reasons (CI-02, CI-03)", async () => {
    renderAt("?m=insights&lad=E08000003");
    expect(await within(kpis()).findByText("588,300", {}, T)).toBeInTheDocument();
    expect(kpi("Supermarkets per 10,000 residents")).toHaveTextContent("0.93");
    expect(kpi(/Residents more than 1 km from a supermarket/)).toHaveTextContent("14.1 %");
    expect(kpi(/highest-priority PPFI deciles/)).toHaveTextContent("40.3 %");
    const p = panel();
    expect(
      await within(p).findByRole("heading", { name: "Local Authority Food Security Assessment" }, T),
    ).toBeVisible();
    expect(within(p).getByText(/not a commissioned food security audit/)).toBeInTheDocument();
    // National context is labelled as such (P6).
    expect(within(p).getByText(/Not the council's own retail supply chain/)).toBeInTheDocument();
    // Seven work packages; indicated ones first, each with its rule.
    const wps = within(p)
      .getAllByRole("listitem")
      .filter((li) => li.classList.contains("wp"));
    expect(wps).toHaveLength(7);
    expect(wps[0]).toHaveTextContent("Indicated by the figures");
    const why = within(wps[0]!).getByRole("button", { name: "Why am I seeing this?" });
    await userEvent.click(why);
    expect(why).toHaveAttribute("aria-expanded", "true");
    expect(wps[0]).toHaveTextContent(/—/);
    // The checksum appears once computed (EX-02).
    await waitFor(
      () => expect(within(p).getByText(/Report checksum/).textContent).toMatch(/[0-9a-f]{12}/),
      T,
    );
    audit(document.body.textContent ?? "");
  });

  it("switches assessment with the keyboard and keeps the type in the URL (CI-01)", async () => {
    renderAt("?m=insights");
    const group = await within(controls()).findByRole("radiogroup", { name: "Assessment" }, T);
    const authority = within(group).getByRole("radio", { name: /Local authority/ });
    expect(authority).toHaveAttribute("aria-checked", "true");
    authority.focus();
    await userEvent.keyboard("{ArrowDown}");
    expect(within(group).getByRole("radio", { name: /Commodity/ })).toHaveAttribute("aria-checked", "true");
    expect(window.location.search).toContain("ia=commodity");
    expect(useAppStore.getState().insightsKind).toBe("commodity");
    expect(await within(kpis()).findByText("391.1 kt", {}, T)).toBeInTheDocument();
    expect(kpi("Largest recorded import partner's share")).toHaveTextContent("43.8 %");
    expect(await within(panel()).findByRole("heading", { name: "Seasonal sourcing" }, T)).toBeInTheDocument();
    audit(document.body.textContent ?? "");
  });

  it("reports a Scenario Lab run with its sensitivity (brief §4)", async () => {
    renderAt("?m=insights&ia=scenario&c=tomatoes&p=ES&sy=2025&smo=1&sd=3");
    expect(await within(kpis()).findByText("6.8 kt", {}, T)).toBeInTheDocument();
    const p = panel();
    expect(
      await within(p).findByRole("heading", { name: "Food Supply Disruption Scenario Assessment" }, T),
    ).toBeVisible();
    const sens = within(p).getByRole("table", { name: /Sensitivity of the key results/ });
    expect(
      within(sens).getByRole("rowheader", { name: "Reduction 30 % (as set)" }).closest("tr"),
    ).toHaveTextContent("6.8 kt");
    expect(within(sens).getByRole("rowheader", { name: "Reduction 15 %" }).closest("tr")).toHaveTextContent(
      "3.4 kt",
    );
    expect(within(p).getByText(/not a forecast and not a confirmed operational impact/)).toBeInTheDocument();
    audit(document.body.textContent ?? "");
  });

  it("exports the CSV and saves the report configuration (brief §7)", async () => {
    renderAt("?m=insights&lad=N09000003");
    expect(await within(kpis()).findByText("351,900", {}, T)).toBeInTheDocument();
    const c = controls();
    await userEvent.click(within(c).getByRole("button", { name: /CSV data/ }));
    expect(downloads.map((d) => d.name)[0]).toMatch(/^foodscope-authority-belfast-\d{4}-\d{2}-\d{2}\.csv$/);
    const csv = await downloads[0]!.blob.text();
    expect(csv).toContain("profile.population");
    expect(csv).toContain("351,900");
    fireEvent.change(within(c).getByRole("textbox", { name: "Report name" }), {
      target: { value: "Belfast check" },
    });
    await userEvent.click(within(c).getByRole("button", { name: /Save configuration/ }));
    expect(within(c).getByRole("list", { name: "Saved reports" })).toHaveTextContent("Belfast check");
    const stored = JSON.parse(window.localStorage.getItem(REPORTS_KEY) ?? "[]") as { query: string }[];
    expect(stored[0]?.query).toBe("?m=insights&lad=N09000003");
  });

  it("lists the nine services and the generic About text (CI-04, P14)", async () => {
    renderAt("?m=insights");
    const p = panel();
    await userEvent.click(await within(p).findByRole("tab", { name: /Services/ }, T));
    const items = within(p).getAllByRole("heading", { level: 4 });
    expect(items).toHaveLength(9);
    expect(within(p).getByText(/awaiting ConsultingWhere approval/)).toBeInTheDocument();
    await userEvent.click(within(p).getByRole("tab", { name: /About/ }));
    expect(within(p).getByRole("heading", { name: "About ConsultingWhere" })).toBeInTheDocument();
    // D3: ConsultingWhere's own logo, with its tagline as the text alternative.
    expect(within(p).getByRole("img", { name: /^ConsultingWhere: maximising the value/ })).toHaveAttribute(
      "src",
      expect.stringContaining("consultingwhere-logo"),
    );
    audit(document.body.textContent ?? "");
  });
});
