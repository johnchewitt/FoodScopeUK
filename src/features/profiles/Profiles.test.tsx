import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { App } from "@/app/App";
import { AppProviders } from "@/app/AppProviders";
import { createQueryClient } from "@/app/queryClient";
import { resetAppStore, useAppStore } from "@/state/store";
import { readRepoFile } from "@/test/files";

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

const kpis = () => screen.getByRole("region", { name: /Local Authority Profiles key figures/ });
const controls = () => screen.getByRole("complementary", { name: "Local Authority Profiles controls" });
const insights = () => screen.getByRole("complementary", { name: "Insights" });
const kpi = (name: string) => within(kpis()).getByRole("article", { name });

beforeEach(() => {
  resetAppStore();
  Object.defineProperty(window, "innerWidth", { configurable: true, value: 1920 });
  vi.stubGlobal(
    "fetch",
    vi.fn(async (url: string) => {
      const key = Object.keys(files).find((k) => url.endsWith(k));
      return key ? new Response(files[key], { status: 200 }) : new Response("not found", { status: 404 });
    }),
  );
  vi.stubGlobal("URL", Object.assign(URL, { createObjectURL: vi.fn(() => "blob:stores") }));
});
afterEach(() => vi.unstubAllGlobals());

// Figures from the published snapshots, checked against the raw sources (stage 5 report, hand checks).
describe("Local Authority Profiles", { timeout: 40_000 }, () => {
  it("opens Belfast from a link: key figures, header, national context labelled (LP-01, LP-02, LP-08)", async () => {
    renderAt("?m=profiles&lad=N09000003");
    expect(await within(kpis()).findByText("351,900", {}, { timeout: 20_000 })).toBeInTheDocument();
    expect(kpi("Mapped grocery stores")).toHaveTextContent("140");
    expect(kpi("Supermarkets per 10,000 residents")).toHaveTextContent("1.11"); // 39 ÷ 351,927
    expect(await within(kpis()).findByText("32.2 %", {}, { timeout: 20_000 })).toBeInTheDocument();
    expect(kpi("Households with no car or van")).toHaveTextContent("33.9 %"); // 50,594 ÷ 149,207
    const header = within(insights()).getByRole("region", { name: "Belfast" });
    expect(within(header).getByText("N09000003")).toBeInTheDocument();
    expect(within(header).getByText("Northern Ireland")).toBeInTheDocument();
    // NI has no council-level urban/rural class: shown as unavailable, never guessed.
    expect(within(insights()).getAllByText(/Data unavailable/).length).toBeGreaterThan(0);
    expect(within(insights()).getAllByText("National context").length).toBeGreaterThan(0);
    expect(
      within(insights()).getByText(/These figures are for the whole United Kingdom/),
    ).toBeInTheDocument();
  });

  it("finds a council by name and selects it everywhere (LP-01)", async () => {
    const user = userEvent.setup();
    renderAt("?m=profiles");
    await within(controls()).findByRole("searchbox", { name: "Council name or code" }, { timeout: 20_000 });
    expect(kpi("Residents")).toHaveTextContent("No council chosen");
    await user.type(within(controls()).getByRole("searchbox", { name: "Council name or code" }), "manch");
    const results = await within(controls()).findByRole("list", { name: /Council name or code: matches/ });
    await user.click(within(results).getByRole("button", { name: /Manchester.*E08000003/ }));
    expect(window.location.search).toBe("?m=profiles&lad=E08000003");
    expect(await within(kpis()).findByText("588,300", {}, { timeout: 20_000 })).toBeInTheDocument();
    expect(kpi("Mapped grocery stores")).toHaveTextContent("150");
    expect(await within(kpis()).findByText("14.1 %", {}, { timeout: 20_000 })).toBeInTheDocument();
    expect(useAppStore.getState().accessMap?.frame?.key).toBe("profile:E08000003");
    expect(useAppStore.getState().accessMap?.selectedCouncil).toBe("E08000003");
    // Search by GSS code too.
    await user.type(within(controls()).getByRole("searchbox", { name: "Council name or code" }), "N09000003");
    expect(
      within(
        await within(controls()).findByRole("list", { name: /Council name or code: matches/ }),
      ).getByRole("button", {
        name: /Belfast/,
      }),
    ).toBeInTheDocument();
  });

  it("outlines a chart's class on the map, by keyboard as well as by click (LP-06)", async () => {
    const user = userEvent.setup();
    renderAt("?m=profiles&lad=N09000003");
    await within(kpis()).findByText("32.2 %", {}, { timeout: 20_000 });
    const groups = await within(insights()).findAllByRole("group", { name: "Outline on the map" });
    // Distance chart, PPFI chart, deprivation chart.
    expect(groups).toHaveLength(3);
    await user.click(within(groups[1]!).getByRole("button", { name: /Deciles 1–2: outline 6 areas/ }));
    expect(within(insights()).getByRole("status")).toHaveTextContent(
      "Outlined on the map: Priority Places for Food Index (combined): deciles 1–2 (6 areas)",
    );
    const s = useAppStore.getState();
    expect(s.areaMeasure).toBe("ppfi");
    expect(s.profileMap?.highlighted).toHaveLength(6);
    expect(s.profileMap?.areas).toHaveLength(174); // PPFI is drawn on the 2011 SOAs
    // The deprivation chart switches the map measure (and replaces the outline).
    await user.click(within(groups[2]!).getByRole("button", { name: /Deciles 1–2: outline/ }));
    expect(useAppStore.getState().areaMeasure).toBe("deprivation");
    expect(useAppStore.getState().profileMap?.highlighted.length).toBeGreaterThan(6);
    await user.click(within(insights()).getByRole("button", { name: "Clear the outline" }));
    expect(useAppStore.getState().areaHighlight).toBeNull();
  });

  it("selects a small area from the underserved table and shows its card (LP-04)", async () => {
    const user = userEvent.setup();
    renderAt("?m=profiles&lad=N09000003&am=distance");
    const table = await within(insights()).findByRole(
      "table",
      { name: /Potentially underserved by proximity/ },
      { timeout: 20_000 },
    );
    const first = within(table).getAllByRole("button")[0]!;
    const name = first.textContent!;
    await user.click(first);
    expect(window.location.search).toMatch(/^\?m=profiles&am=distance&lad=N09000003&sa=N20\d{6}$/);
    expect(within(insights()).getByRole("region", { name })).toBeInTheDocument();
    expect(useAppStore.getState().profileMap?.selected).toBe(useAppStore.getState().area);
  });

  it("compares Belfast and Manchester side by side, never ranked, with the nation warning (LP-07)", async () => {
    renderAt("?m=profiles&lad=N09000003&cmp=E08000003&view=compare");
    const banner = await screen.findByText(
      /These councils are in different nations/,
      {},
      { timeout: 20_000 },
    );
    expect(banner).toHaveTextContent("(Northern Ireland, England)");
    const table = screen.getByRole("table", { name: "Council comparison" });
    const cols = within(table).getAllByRole("columnheader");
    expect(cols.map((c) => c.textContent)).toEqual([
      "Indicator",
      "BelfastNorthern Ireland · N09000003",
      "ManchesterEngland · E08000003",
    ]);
    const row = (label: RegExp) => within(table).getByRole("row", { name: label });
    expect(row(/^Residents \(mid-2025\)/)).toHaveTextContent(/351,900.*588,300/);
    expect(row(/^Supermarkets per 10,000 residents/)).toHaveTextContent(/1\.11.*0\.93/);
    expect(await within(table).findByText("40.3 %", {}, { timeout: 20_000 })).toBeInTheDocument();
    const ppfi = row(/^Small areas in PPFI deciles 1–2/);
    expect(ppfi).toHaveTextContent(/3\.4 %.*40\.3 %/);
    expect(ppfi).toHaveTextContent(/never compared across nations/);
    expect(ppfi).toHaveAttribute("data-comparability", "within-nation");
    expect(row(/^Urban\/rural class/)).toHaveAttribute("data-comparability", "nation-specific");
    expect(screen.getByText(/listed in the order you chose them, never ranked/)).toBeInTheDocument();
  });

  it("a council without a deep profile says what is unavailable, never zero (LP-10)", async () => {
    renderAt("?m=profiles&lad=W06000015");
    expect(await within(kpis()).findByText("381,500", {}, { timeout: 20_000 })).toBeInTheDocument();
    expect(kpi("Residents > 1 km from a supermarket (straight-line)")).toHaveTextContent("Data unavailable");
    expect(kpi("Residents > 1 km from a supermarket (straight-line)")).toHaveTextContent(
      /deep profiles only/,
    );
    expect(
      within(insights()).getByText(/small-area accessibility and vulnerability for Cardiff/),
    ).toBeInTheDocument();
    expect(useAppStore.getState().profileMap).toBeNull();
  });

  it("Scotland: car availability is unavailable, with the reason", async () => {
    renderAt("?m=profiles&lad=S12000036");
    expect(await within(kpis()).findByText("531,400", {}, { timeout: 20_000 })).toBeInTheDocument();
    const car = kpi("Households with no car or van");
    expect(car).toHaveTextContent("Data unavailable");
    expect(car).toHaveTextContent("Scotland's census (2022) is not included");
  });
});
