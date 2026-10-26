import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { App } from "@/app/App";
import { AppProviders } from "@/app/AppProviders";
import { createQueryClient } from "@/app/queryClient";
import { resetAppStore, useAppStore } from "@/state/store";
import { readRepoFile } from "@/test/files";
import { SAVED_KEY } from "./saved";
import { resetSavedForTests } from "./useSaved";

// The real MapHost loads the ArcGIS SDK (WebGL); the map side is covered by Playwright.
vi.mock("@/components/maps/MapHost", () => ({ default: () => <div data-testid="map-stub" /> }));

const manifestText = readRepoFile("public/data/manifest.json");
const files: Record<string, string> = {
  "config.json": readRepoFile("public/config.json"),
  "data/manifest.json": manifestText,
  ...Object.fromEntries(
    (JSON.parse(manifestText) as { datasets: { path: string }[] }).datasets
      .filter((d) => !d.path.includes("/areas/"))
      .map((d) => [`data/${d.path}`, readRepoFile(`public/data/${d.path}`)]),
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

const MODULE = "Scenario Lab";
const kpis = () => screen.getByRole("region", { name: new RegExp(`${MODULE} key figures`) });
const controls = () => screen.getByRole("complementary", { name: `${MODULE} controls` });
const insights = () => screen.getByRole("complementary", { name: "Insights" });
const kpi = (name: string | RegExp) => within(kpis()).getByRole("article", { name });
const T = { timeout: 30_000 };

/** P9 wording audit: "shortage" appears only negated ("not a shortage", "not … shortages"). */
function auditWording(text: string) {
  const hits = [...text.matchAll(/[^.]*\bshortages?\b[^.]*/gi)].map((m) => m[0]);
  for (const sentence of hits) expect(sentence, sentence).toMatch(/\bnot\b|\bnothing\b|\bnever\b/i);
  expect(text).not.toMatch(/forecast(ed)? shortages?/i);
  expect(text).not.toMatch(/empty shelves will|supply will fail/i);
}

beforeEach(() => {
  resetAppStore();
  resetSavedForTests();
  window.localStorage.clear();
  Object.defineProperty(window, "innerWidth", { configurable: true, value: 1920 });
  vi.stubGlobal(
    "fetch",
    vi.fn(async (url: string) => {
      const key = Object.keys(files).find((k) => url.endsWith(k));
      return key ? new Response(files[key], { status: 200 }) : new Response("not found", { status: 404 });
    }),
  );
  vi.stubGlobal("URL", Object.assign(URL, { createObjectURL: vi.fn(() => "blob:supermarkets") }));
});
afterEach(() => vi.unstubAllGlobals());

// Figures checked independently against the published files (stage 7 report).
describe("Scenario Lab", { timeout: 90_000 }, () => {
  it("A: opens a supply disruption from a link and recomputes it as the sliders move (SC-A/E, SC-05)", async () => {
    renderAt("?m=scenarios&c=tomatoes&p=ES&sy=2025&smo=1&sd=3");
    expect(await within(kpis()).findByText("6.8 kt", {}, T)).toBeInTheDocument();
    expect(kpi("Share of recorded imports affected")).toHaveTextContent("6.7 %");
    expect(kpi("Recorded imports remaining")).toHaveTextContent("94.1 kt");
    expect(kpi("Partner concentration (HHI)")).toHaveTextContent("2,660");
    expect(kpi("Partner concentration (HHI)")).toHaveTextContent("Baseline 2,570");
    // Results with baseline and scenario, the Scenario-modelled banner and the methodology.
    const panel = insights();
    expect(await within(panel).findByRole("region", { name: "Scenario modelled" }, T)).toHaveTextContent(
      /If recorded imports of tomatoes from Spain fell by 30 %/,
    );
    const results = within(panel).getByRole("table", { name: /Results of the Tomatoes supply disruption/ });
    expect(
      within(results)
        .getByRole("rowheader", { name: /Recorded imports from Spain/ })
        .closest("tr"),
    ).toHaveTextContent("22.6 kt15.8 kt−6.8 kt−30.0 %");
    expect(within(panel).getByText("Explain the model")).toBeInTheDocument();
    expect(within(panel).getByText(/HHI after = Σ \(100 × share\)²/)).toBeInTheDocument();
    // The map: Spain's connection narrows, its baseline width dashed behind it.
    const es = useAppStore.getState().originsMap?.partners.find((p) => p.key === "ES");
    expect(es?.ghostWidth).toBeGreaterThan(es?.flowWidth ?? Infinity);
    // A slider recomputes everything; the URL follows (SC-05).
    fireEvent.change(within(controls()).getByRole("slider", { name: /Reduction in recorded imports/ }), {
      target: { value: "100" },
    });
    expect(await within(kpis()).findByText("22.6 kt", {}, T)).toBeInTheDocument();
    expect(window.location.search).toContain("sr=100");
    // Review (WCAG 4.1.3): the new result is announced once the setting rests, not on first display.
    const status = within(kpis()).getByRole("status");
    expect(status).toBeEmptyDOMElement();
    await waitFor(
      () =>
        expect(status).toHaveTextContent(
          /^Scenario A updated\. Recorded imports affected: 22\.6 kt; Share of recorded imports affected: 22\.4 %\.$/,
        ),
      T,
    );
    auditWording(document.body.textContent ?? "");
  });

  it("resets to the baseline and restores the defaults (SC-03)", async () => {
    const user = userEvent.setup();
    renderAt("?m=scenarios&c=tomatoes&p=ES&sy=2025&smo=1&sd=3&sr=40");
    await within(kpis()).findByText("9.0 kt", {}, T);
    await user.click(within(controls()).getByRole("button", { name: /Reset to baseline/ }));
    expect(await within(kpis()).findByText("0 t", {}, T)).toBeInTheDocument();
    expect(kpi("Share of recorded imports affected")).toHaveTextContent("0.0 %");
    expect(window.location.search).toContain("sr=0");
    expect(window.location.search).toContain("p=ES");
    await user.click(within(controls()).getByRole("button", { name: /Restore defaults/ }));
    expect(useAppStore.getState().scenarioReduction).toBe(30);
    expect(useAppStore.getState().scenarioDuration).toBe(1);
  });

  it("B: closes a supermarket from a preset and shows whose nearest one changes (SC-D)", async () => {
    const user = userEvent.setup();
    renderAt("?m=scenarios");
    // The scenario cards are one radio group; arrows move between them.
    const cards = within(controls()).getByRole("radiogroup", { name: "Scenario" });
    within(cards)
      .getByRole("radio", { name: /International supply disruption/ })
      .focus();
    await user.keyboard("{ArrowDown}");
    expect(within(cards).getByRole("radio", { name: /Supermarket closure/ })).toHaveAttribute(
      "aria-checked",
      "true",
    );
    expect(kpi("Residents whose nearest supermarket changes")).toBeInTheDocument();
    await user.click(await within(controls()).findByRole("button", { name: /Preset: Manchester/ }, T));
    expect(await within(kpis()).findByText("26,730", {}, T)).toBeInTheDocument();
    expect(kpi("Average extra distance (straight-line)")).toHaveTextContent("0.8 km");
    expect(kpi("Supermarkets within 2 km")).toHaveTextContent("2");
    expect(kpi(/Residents > 2 km/)).toHaveTextContent("4,560");
    // Review: cards show short labels; the full label stays each card's accessible name.
    expect(kpi("Supermarkets within 2 km")).toHaveTextContent("Supermarkets ≤ 2 km");
    expect(kpi(/Residents > 2 km/)).toHaveTextContent("Manchester · 0 before · straight-line");
    // The compact picker describes the active scenario under its tiles.
    expect(cards).toHaveAccessibleDescription(/B · Supermarket closure\. One supermarket closes/);
    expect(window.location.search).toContain("st=1010002389");
    // The map: affected areas (closure layer) and the supermarkets and councils (Access layers).
    const s = useAppStore.getState();
    expect(s.scenarioMap?.areas).toHaveLength(17);
    expect(s.accessMap?.mode).toBe("scenario");
    expect(s.accessMap?.selectedCouncil).toBe("E08000003");
    const panel = insights();
    expect(
      within(panel).getByRole("table", { name: "Small areas whose nearest supermarket changes" }),
    ).toBeInTheDocument();
    expect(
      within(panel).getByText(/Straight-line distance is not walking or driving time/),
    ).toBeInTheDocument();
    // Search finds a supermarket by name.
    await user.type(within(controls()).getByRole("searchbox"), "sainsburys newry");
    expect(await within(controls()).findByRole("button", { name: /Sainsburys Newry/ })).toBeInTheDocument();
    auditWording(document.body.textContent ?? "");
  });

  it("C: shocks Defra's wheat balance, and says where no balance exists", async () => {
    const user = userEvent.setup();
    renderAt("?m=scenarios&sk=production&c=wheat&spr=15");
    expect(await within(kpis()).findByText("1.8 Mt", {}, T)).toBeInTheDocument();
    expect(kpi("Production share of supply")).toHaveTextContent("80.5 %");
    expect(kpi("Total supply in the scenario")).toHaveTextContent("12.6 Mt");
    expect(
      within(insights()).getByText(/Not in this balance, so not shown or estimated/),
    ).toBeInTheDocument();
    await user.selectOptions(
      within(controls()).getByRole("combobox", { name: /Commodity \(Defra UK supply balance\)/ }),
      "oranges",
    );
    expect(
      await within(insights()).findByText(/No UK supply balance for oranges/, {}, T),
    ).toBeInTheDocument();
    expect(kpi("UK production removed")).toHaveTextContent("Not computed");
  });

  it("D: disrupts Dover's freight without inventing food routing", async () => {
    renderAt("?m=scenarios&sk=port&pt=GBDVR");
    expect(await within(kpis()).findByText("521.4 kt", {}, T)).toBeInTheDocument();
    expect(kpi("Share of UK major-port inwards")).toHaveTextContent("2.6 %");
    expect(kpi("Food, feed and drink entry share")).toHaveTextContent("Not applicable");
    // Review: Dover's zero is agricultural dry bulk only, beside its Ro-Ro and container share.
    expect(kpi("Agricultural dry bulk affected")).toHaveTextContent(
      /97\.6 % Ro-Ro or containers · contents not recorded/,
    );
    expect(within(insights()).getAllByText(/includes the Channel Tunnel/).length).toBeGreaterThan(0);
    const dover = useAppStore.getState().riskMap?.ports.find((p) => p.locode === "GBDVR");
    expect(dover?.scenarioRadius).toBeLessThan(dover?.radius ?? 0);
    auditWording(document.body.textContent ?? "");
  });

  it("saves, compares and keeps named scenarios in this browser (brief §7)", async () => {
    const user = userEvent.setup();
    renderAt("?m=scenarios&sk=port&pt=GBDVR");
    await within(kpis()).findByText("521.4 kt", {}, T);
    await user.type(
      within(controls()).getByRole("textbox", { name: "Scenario name" }),
      "Dover half capacity",
    );
    await user.click(within(controls()).getByRole("button", { name: "Save" }));
    expect(within(controls()).getByText(/Saved "Dover half capacity" in this browser/)).toBeInTheDocument();
    const stored = JSON.parse(window.localStorage.getItem(SAVED_KEY) ?? "[]") as { name: string }[];
    expect(stored.map((s) => s.name)).toEqual(["Dover half capacity"]);
    // Change the scenario, then compare with the saved one.
    fireEvent.change(within(controls()).getByRole("slider", { name: /Capacity reduction/ }), {
      target: { value: "20" },
    });
    const saved = within(insights()).getByRole("list", { name: "Saved scenarios" });
    await user.click(within(saved).getByRole("checkbox"));
    const table = await within(insights()).findByRole("table", { name: "Saved scenarios compared" }, T);
    expect(table).toHaveTextContent("521.4 kt");
    expect(table).toHaveTextContent("208.5 kt");
    // Open the saved scenario again.
    await user.click(within(saved).getByRole("button", { name: "Open Dover half capacity" }));
    expect(useAppStore.getState().portReduction).toBe(50);
  });
});
