import { fireEvent, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { App } from "@/app/App";
import { AppProviders } from "@/app/AppProviders";
import { createQueryClient } from "@/app/queryClient";
import { resetAppStore, useAppStore } from "@/state/store";
import { readRepoFile } from "@/test/files";
import { PROVISION_NOTE } from "./note";

// The real MapHost loads the ArcGIS SDK (WebGL); the map side is covered by Playwright.
vi.mock("@/components/maps/MapHost", () => ({ default: () => <div data-testid="map-stub" /> }));

const manifestText = readRepoFile("public/data/manifest.json");
const files: Record<string, string> = {
  "config.json": readRepoFile("public/config.json"),
  "data/manifest.json": manifestText,
  ...Object.fromEntries(
    (JSON.parse(manifestText) as { datasets: { path: string }[] }).datasets
      .filter((d) => d.path.includes("/local/"))
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

const kpis = () => screen.getByRole("region", { name: /UK Food Access key figures/ });
const controls = () => screen.getByRole("complementary", { name: "UK Food Access controls" });
const insights = () => screen.getByRole("complementary", { name: "Insights" });

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

// Figures: GEOLYTIX v46 and ONS mid-2025 in snapshot 2026-10-24, recomputed in Python (stage 4 report).
describe("UK Food Access", { timeout: 30_000 }, () => {
  it("opens on supermarkets with UK provision, and always shows the provision note (SM-10)", async () => {
    renderAt("?m=access");
    expect(await within(kpis()).findByText("7,193", {}, { timeout: 15_000 })).toBeInTheDocument();
    expect(within(kpis()).getByText("1.03")).toBeInTheDocument(); // 7,171 ÷ 69,483,939 × 10,000
    expect(within(kpis()).getByText("0.03")).toBeInTheDocument(); // 7,171 ÷ 242,494 km²
    expect(
      within(kpis()).getByRole("article", { name: "Population beyond threshold (straight-line)" }),
    ).toHaveTextContent(/stage 5/);
    // On the map and in the insights panel.
    expect(screen.getAllByText(PROVISION_NOTE).length).toBeGreaterThanOrEqual(2);
    // Store type counts in the controls (filter counts = pipeline counts).
    expect(within(controls()).getByText("10,722")).toBeInTheDocument();
    expect(within(controls()).getByText("1,268")).toBeInTheDocument();
  });

  it("filters by store type and retailer, mirrored in the URL (SM-03)", async () => {
    const user = userEvent.setup();
    renderAt("?m=access");
    await within(kpis()).findByText("7,193", {}, { timeout: 15_000 });
    await user.click(within(controls()).getByRole("checkbox", { name: /Convenience stores/ }));
    expect(await within(kpis()).findByText("17,915")).toBeInTheDocument();
    expect(window.location.search).toBe("?m=access&sl=s%2Cc");
    await user.click(within(controls()).getByRole("checkbox", { name: /Convenience stores/ }));
    await user.click(within(controls()).getByRole("button", { name: "None" }));
    expect(await within(kpis()).findByText("0")).toBeInTheDocument();
    await user.click(within(controls()).getByRole("checkbox", { name: /^Aldi/ }));
    expect(await within(kpis()).findByText("1,084")).toBeInTheDocument();
    expect(window.location.search).toBe("?m=access&rt=Aldi");
    expect(useAppStore.getState().retailers).toEqual(["Aldi"]);
  });

  it("switches the council measure; the class legend and rates follow (SM-06)", async () => {
    const user = userEvent.setup();
    renderAt("?m=access");
    await within(kpis()).findByText("7,193", {}, { timeout: 15_000 });
    await user.click(within(controls()).getByRole("radio", { name: "Convenience" }));
    expect(await within(kpis()).findByText("1.53")).toBeInTheDocument(); // 10,622 ÷ 69,483,939 × 10,000
    expect(window.location.search).toBe("?m=access&cl=c");
    const legend = screen.getByText(/Legend · stores June 2026/).closest("details")!;
    expect(within(legend).getByText(/Convenience stores per 10,000 residents/)).toBeInTheDocument();
    expect(within(legend).getByText("1.60 to under 2.00")).toBeInTheDocument();
  });

  it("finds a store by postcode, shows its card and measures straight-line distance (SM-05, SM-07)", async () => {
    const user = userEvent.setup();
    renderAt("?m=access");
    await within(kpis()).findByText("7,193", {}, { timeout: 15_000 });
    await user.type(within(controls()).getByRole("searchbox"), "BT1 5BY");
    const results = await within(controls()).findByRole("list", { name: "Matching stores" });
    await user.click(within(results).getByRole("button", { name: /M&S Belfast/ }));
    expect(window.location.search).toBe("?m=access&st=1010001355");
    expect(useAppStore.getState().mapCommand).toMatchObject({ type: "goToPoint", zoom: 15 });
    const card = await within(insights()).findByRole("region", { name: /M&S Belfast/ });
    expect(within(card).getByText("Belfast")).toBeInTheDocument();
    expect(within(card).getByText(/GEOLYTIX Grocery Retail Points v46/)).toBeInTheDocument();
    await user.click(within(card).getByRole("button", { name: /Measure from here/ }));
    const nearby = await within(insights()).findByRole("region", { name: "Straight-line proximity" });
    expect(within(nearby).getByText(/straight-line distance of the point/)).toBeInTheDocument();
    const list = within(nearby).getByRole("list", { name: "Nearest 5 stores shown" });
    expect(within(list).getAllByRole("button")[0]).toHaveTextContent("M&S Belfast0.0 km");
    expect(within(nearby).getByText(/Irish Transverse Mercator/)).toBeInTheDocument();
  });

  it("opens a council from a deep link and compares it with its nation and the UK (SM-08, SM-09)", async () => {
    renderAt("?m=access&sl=s%2Cc%2Co&cl=a&lad=E08000003");
    expect(await within(kpis()).findByText("2.55", {}, { timeout: 15_000 })).toBeInTheDocument(); // 150 ÷ 588,256
    const card = await within(insights()).findByRole("region", { name: "Manchester" });
    expect(within(card).getByText("588,300")).toBeInTheDocument();
    const table = within(insights()).getByRole("table", { name: /with numerators and denominators/ });
    expect(within(table).getByRole("rowheader", { name: "Manchester" })).toBeInTheDocument();
    expect(within(table).getByRole("rowheader", { name: "United Kingdom" })).toBeInTheDocument();
    // Density table: choosing a council selects it everywhere and asks the map to fit it.
    const density = within(insights()).getByRole("table", { name: /by council/ });
    fireEvent.click(within(density).getAllByRole("button")[0]!);
    expect(useAppStore.getState().mapCommand).toMatchObject({ type: "focusCouncil" });
  });
});
