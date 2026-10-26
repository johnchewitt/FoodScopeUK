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

const MODULE = "UK Food Resilience — Risk Explorer";
const kpis = () => screen.getByRole("region", { name: new RegExp(`${MODULE} key figures`) });
const controls = () => screen.getByRole("complementary", { name: `${MODULE} controls` });
const insights = () => screen.getByRole("complementary", { name: "Insights" });
const kpi = (name: string | RegExp) => within(kpis()).getByRole("article", { name });
const T = { timeout: 20_000 };

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

// Figures from the published snapshots, checked against the raw sources (stage 6 report, hand checks).
describe("UK Food Resilience — Risk Explorer", { timeout: 60_000 }, () => {
  it("opens the supply view from a link: concentration, water stress and a partner's exposure (RK-02)", async () => {
    renderAt("?m=risks&c=tomatoes&p=ES");
    expect(await within(kpis()).findByText("391.1 kt", {}, T)).toBeInTheDocument();
    expect(kpi("Recorded import partners")).toHaveTextContent("25");
    expect(kpi("Top supplier share")).toHaveTextContent("43.8 %");
    expect(kpi("Partner concentration (HHI)")).toHaveTextContent("2,990");
    expect(kpi("From high or critical water stress")).toHaveTextContent("0.1 %");
    // Explanation: observed evidence with provenance, then a labelled interpretation.
    const explain = await within(insights()).findByRole("group", { name: "Explain this risk" }, T);
    expect(within(explain).getByText("Tomatoes: recorded import partners")).toBeInTheDocument();
    expect(within(explain).getByText("Estimated exposure: Spain")).toBeInTheDocument();
    expect(within(explain).getByText("Interpretation (not a forecast)")).toBeInTheDocument();
    expect(within(explain).getByText(/not a prediction that supply will fail/)).toBeInTheDocument();
    // The trade map is shared with Food Origins, with the partner selected.
    const map = useAppStore.getState().originsMap;
    expect(map?.fill).toBe("share");
    expect(useAppStore.getState().partner).toBe("ES");
    expect(map?.partners.find((x) => x.key === "ES")?.flow).toBe(true);
  });

  it("colours partners by water stress, with a no-data class (RK-02, S30)", async () => {
    const user = userEvent.setup();
    renderAt("?m=risks&c=strawberries");
    await within(kpis()).findByText("22", {}, T);
    expect(kpi("From high or critical water stress")).toHaveTextContent("23.5 %");
    await user.click(within(controls()).getByRole("radio", { name: "Water stress" }));
    expect(window.location.search).toContain("rf=stress");
    expect(useAppStore.getState().originsMap?.fill).toBe("stress");
    const legend = await screen.findByText(/Partners’ national water stress/, {}, T);
    expect(legend.closest("details")).toHaveTextContent(/Critical \(above 100 %\)/);
    expect(legend.closest("details")).toHaveTextContent(/No data/);
  });

  it("switches to logistics and selects a port (RK-03)", async () => {
    const user = userEvent.setup();
    renderAt("?m=risks&c=tomatoes");
    await within(kpis()).findByText("391.1 kt", {}, T);
    await user.click(within(controls()).getByRole("radio", { name: "Logistics" }));
    expect(window.location.search).toBe("?m=risks&rv=logistics"); // tomatoes is the default commodity
    expect(await within(kpis()).findByText("237.5 Mt", {}, T)).toBeInTheDocument();
    expect(kpi("Largest port")).toHaveTextContent("16.1 %");
    expect(kpi("Short Straits share of food imports")).toHaveTextContent("17.9 %");
    expect(kpi("Road delay (England)")).toHaveTextContent("10.5 s");
    // The trade map is cleared; the logistics layers are published instead.
    expect(useAppStore.getState().riskMap?.ports).toHaveLength(51);

    await user.selectOptions(within(controls()).getByRole("combobox", { name: "Port" }), "GBDVR");
    expect(window.location.search).toContain("pt=GBDVR");
    expect(await within(kpis()).findByText("12.5 Mt", {}, T)).toBeInTheDocument();
    expect(kpi("Dover")).toHaveTextContent("−2.2 % on 2024");
    expect(useAppStore.getState().riskMap?.selectedPort).toBe("GBDVR");
    const explain = within(insights()).getByRole("group", { name: "Explain this risk" });
    expect(within(explain).getByText("Dover: port freight")).toBeInTheDocument();
    // The explanation can switch to the road corridors.
    await user.click(within(explain).getByRole("radio", { name: "Roads and rail" }));
    expect(within(explain).getByText("Road and rail corridors")).toBeInTheDocument();
    expect(within(explain).getByText(/Northern Ireland's roads come from OpenStreetMap/)).toBeInTheDocument();
    expect(
      within(explain).getByText(/Railway lines are shown for Northern Ireland only/),
    ).toBeInTheDocument();
    expect(useAppStore.getState().riskMap?.rail?.url).toMatch(/risk\/rail\.geojson$/);
    expect(useAppStore.getState().riskMap?.roadsNi?.url).toMatch(/risk\/roads-ni\.geojson$/);
  });

  it("maps a farming measure by region (RK-03, S31)", async () => {
    const user = userEvent.setup();
    renderAt("?m=risks&rv=logistics");
    await within(kpis()).findByText("237.5 Mt", {}, T);
    await user.selectOptions(
      within(controls()).getByRole("combobox", { name: "Agricultural production regions" }),
      "sheep",
    );
    expect(window.location.search).toContain("fm=sheep");
    const regions = useAppStore.getState().riskMap?.regions;
    expect(regions?.measure).toBe("sheep");
    expect(Object.keys(regions?.classOf ?? {})).toHaveLength(11);
    expect(await screen.findByText(/Sheep: sheep per km², June 2025/, {}, T)).toBeInTheDocument();
  });

  it("ranks a council within its own nation and shows missing data (RK-04)", async () => {
    const user = userEvent.setup();
    renderAt("?m=risks&rv=access&lad=S12000049");
    expect(await within(kpis()).findByText("13.8 %", {}, T)).toBeInTheDocument();
    expect(kpi("Rank within nation")).toHaveTextContent("18 of 32");
    expect(kpi("Scotland's share")).toHaveTextContent("20.0 %");
    const map = useAppStore.getState().accessMap;
    expect(map?.mode).toBe("risk");
    expect(map?.selectedCouncil).toBe("S12000049");
    expect(map?.storeWhere).toBe("1=0");

    // Belfast, fuel poverty: no data in Northern Ireland, never a zero.
    await user.selectOptions(within(controls()).getByRole("combobox", { name: "Council" }), "N09000003");
    await user.selectOptions(within(controls()).getByRole("combobox", { name: "Measure" }), "fuel_poverty");
    expect(window.location.search).toContain("pf=fuel_poverty");
    expect(await within(kpis()).findByText("Data unavailable in this nation", {}, T)).toBeInTheDocument();
    expect(kpi("Rank within nation")).toHaveTextContent("Not ranked (no data)");
    expect(kpi("Northern Ireland's share")).toHaveTextContent("No data for this measure");
  });

  it("keeps the three views apart: no combined score anywhere", async () => {
    renderAt("?m=risks");
    await within(kpis()).findByText("391.1 kt", {}, T);
    expect(within(controls()).getByText(/no score combines them/)).toBeInTheDocument();
    expect(document.body).not.toHaveTextContent(/resilience score|overall risk|risk index|composite/i);
    // The heatmaps draw (ECharts needs a visualMap for them).
    expect(within(insights()).queryByText("Chart could not be drawn")).toBeNull();
  });

  it("explains how to read the risk figures on the Evidence page", async () => {
    renderAt("?m=risks&view=evidence");
    expect(await screen.findByRole("heading", { name: /Reading the risk figures/ }, T)).toBeInTheDocument();
    expect(screen.getByText(/no score combines them, and no weighting is applied/)).toBeInTheDocument();
    expect(screen.getByText(/not a forecast of a shortage/)).toBeInTheDocument();
  });
});
