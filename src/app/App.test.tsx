import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { resetAppStore, useAppStore } from "@/state/store";
import { readRepoFile } from "@/test/files";
import { App } from "./App";
import { AppProviders } from "./AppProviders";
import { createQueryClient } from "./queryClient";
import { MODULES } from "./modules";

// The real MapHost loads the ArcGIS SDK, which needs WebGL; it is covered by Playwright.
vi.mock("@/components/maps/MapHost", () => ({
  default: () => <div data-testid="map-stub" />,
}));

const manifestText = readRepoFile("public/data/manifest.json");
const files: Record<string, string> = {
  "config.json": readRepoFile("public/config.json"),
  "data/manifest.json": manifestText,
  // Every dataset the manifest lists (real committed data: HMRC snapshot, Natural Earth).
  ...Object.fromEntries(
    (JSON.parse(manifestText) as { datasets: { path: string }[] }).datasets.map((d) => [
      `data/${d.path}`,
      readRepoFile(`public/data/${d.path}`),
    ]),
  ),
};

function stubFetch(overrides: Record<string, Response> = {}) {
  vi.stubGlobal(
    "fetch",
    vi.fn(async (url: string) => {
      const key = Object.keys(files).find((k) => url.endsWith(k));
      if (key && overrides[key]) return overrides[key];
      if (key) return new Response(files[key], { status: 200 });
      return new Response("not found", { status: 404 });
    }),
  );
}

function renderApp() {
  return render(
    <AppProviders client={createQueryClient()}>
      <App />
    </AppProviders>,
  );
}

beforeEach(() => {
  resetAppStore();
  window.history.replaceState(null, "", "/FoodScopeUK/");
  Object.defineProperty(window, "innerWidth", { configurable: true, value: 1920 });
  stubFetch();
});
afterEach(() => vi.unstubAllGlobals());

describe("App shell", () => {
  it("renders header, navigation, panels, KPI cards and timeline", async () => {
    renderApp();
    expect(screen.getByText("Food Security & Supply Chain Intelligence")).toBeInTheDocument();
    expect(screen.getByRole("heading", { level: 1, name: "Food Origins" })).toBeInTheDocument();
    const nav = screen.getByRole("navigation", { name: "Modules" });
    for (const m of MODULES)
      expect(within(nav).getByRole("button", { name: new RegExp(m.railLabel) })).toBeInTheDocument();
    const kpis = screen.getByRole("region", { name: "Food Origins key figures" });
    // Real HMRC figures: tomatoes, 12 months to Aug 2026 (see src/analysis/trade.test.ts).
    expect(await within(kpis).findByText("391.1 kt")).toBeInTheDocument();
    expect(within(kpis).getByText("43.8 %")).toBeInTheDocument();
    expect(within(kpis).getByText("Netherlands · top 3: 84.5 %")).toBeInTheDocument();
    expect(screen.getByRole("region", { name: "Timeline" })).toBeInTheDocument();
    expect(await screen.findByTestId("map-stub")).toBeInTheDocument();
  });

  it("switches module, updates the URL and hides the timeline where unused", async () => {
    renderApp();
    await userEvent.click(screen.getByRole("button", { name: /Scenarios/ }));
    expect(screen.getByRole("heading", { level: 1, name: "Scenario Lab" })).toBeInTheDocument();
    expect(window.location.search).toBe("?m=scenarios");
    expect(screen.queryByRole("region", { name: "Timeline" })).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Scenarios/ })).toHaveAttribute("aria-current", "page");
  });

  it("hydrates from a deep link", async () => {
    window.history.replaceState(null, "", "/FoodScopeUK/?m=profiles&lad=N09000003&am=no-car&cmp=E08000003");
    renderApp();
    expect(
      await screen.findByRole("heading", { level: 1, name: "Local Authority Profiles" }),
    ).toBeInTheDocument();
    const state = useAppStore.getState();
    expect([state.lad, state.areaMeasure, state.compare]).toEqual(["N09000003", "no-car", ["E08000003"]]);
    // Local Authority Profiles has no timeline (LP: no time dimension in a council profile).
    expect(screen.queryByRole("region", { name: "Timeline" })).not.toBeInTheDocument();
  });

  it("selects months and mirrors them to the URL", async () => {
    renderApp();
    await userEvent.click(await screen.findByRole("button", { name: "Mar" }));
    expect(useAppStore.getState().month).toBe(3);
    expect(window.location.search).toBe("?y=2026&mo=3");
    await userEvent.click(screen.getByRole("button", { name: "Next month" }));
    expect(window.location.search).toBe("?y=2026&mo=4");
    // Unpublished months are disabled and ignored.
    const oct = screen.getByRole("button", { name: "Oct" });
    expect(oct).toHaveAttribute("aria-disabled", "true");
    await userEvent.click(oct);
    expect(useAppStore.getState().month).toBe(4);
  });

  it("keeps a month in the link while a module without a timeline is open", async () => {
    window.history.replaceState(null, "", "/FoodScopeUK/?m=profiles&mo=3");
    renderApp();
    expect(
      await screen.findByRole("heading", { level: 1, name: "Local Authority Profiles" }),
    ).toBeInTheDocument();
    expect(useAppStore.getState().month).toBe(3);
    expect(window.location.search).toBe("?m=profiles&mo=3");
  });

  it("collapses and reopens panels with buttons and keyboard shortcuts", async () => {
    renderApp();
    const filter = document.getElementById("filter-panel")!;
    expect(filter).toHaveAttribute("data-open", "true");
    await userEvent.click(within(filter).getByRole("button", { name: "Hide controls" }));
    expect(filter).toHaveAttribute("data-open", "false");
    await userEvent.keyboard("[[");
    expect(filter).toHaveAttribute("data-open", "true");
    await userEvent.keyboard("]");
    expect(document.getElementById("insights-panel")).toHaveAttribute("data-open", "false");
  });

  it("closes a dialog opened from a deep link with Escape, before focus moves into it", async () => {
    window.history.replaceState(null, "", "/FoodScopeUK/?view=evidence");
    renderApp();
    expect(useAppStore.getState().overlay).toBe("evidence");
    await userEvent.keyboard("{Escape}");
    expect(useAppStore.getState().overlay).toBe("none");
    expect(window.location.search).toBe("");
  });

  it("shows data status from the real manifest", async () => {
    renderApp();
    const insights = document.getElementById("insights-panel")!;
    expect(await within(insights).findByText("Country outlines")).toBeInTheDocument();
    expect(within(insights).getByText(/Natural Earth v5.1.2, 1:110m, 176 countries/)).toBeInTheDocument();
    expect(within(insights).getByText("Trade snapshot 2026-10-26")).toBeInTheDocument();
    expect(within(insights).getByText("Stores and population snapshot 2026-10-24")).toBeInTheDocument();
    expect(within(insights).getByText("Small areas snapshot 2026-10-25")).toBeInTheDocument();
    expect(
      await screen.findByRole("button", {
        name: /Data freshness: Data 2026-10-24 to 2026-10-26/,
      }),
    ).toBeInTheDocument();
  });

  it("reports a partial failure when the data index cannot load", async () => {
    stubFetch({ "data/manifest.json": new Response("boom", { status: 500 }) });
    renderApp();
    expect(
      await screen.findByText(/Some information is unavailable: data index/, {}, { timeout: 5000 }),
    ).toBeInTheDocument();
    await waitFor(() =>
      expect(
        screen.getByRole("button", { name: /Data freshness: Data index unavailable/ }),
      ).toBeInTheDocument(),
    );
  });

  it("opens Evidence from the rail and lists the published dataset", async () => {
    renderApp();
    await userEvent.click(
      within(screen.getByRole("navigation", { name: "Modules" })).getByRole("button", { name: "Evidence" }),
    );
    expect(useAppStore.getState().overlay).toBe("evidence");
    expect(window.location.search).toBe("?view=evidence");
    expect(await screen.findByText("World country outlines (Natural Earth 1:110m)")).toBeInTheDocument();
    expect(screen.getByText("Recorded UK imports: tomatoes (HS 0702)")).toBeInTheDocument();
    expect(
      screen.getByText("Reading the trade figures (Food Origins and Seasonal Supply)"),
    ).toBeInTheDocument();
    expect(screen.queryByText("No statistics have been published yet")).not.toBeInTheDocument();
  });

  it("offers Search and Export (Stage 8) and keeps the 3D globe marked as planned", async () => {
    renderApp();
    await userEvent.click(screen.getByRole("button", { name: /^Search councils, commodities and modules/ }));
    expect(useAppStore.getState().overlay).toBe("search");
    await userEvent.click(
      screen.getByRole("button", { name: /^Export: open the matching ConsultingWhere Insights/ }),
    );
    expect(useAppStore.getState().module).toBe("insights");
    expect(useAppStore.getState().insightsKind).toBe("commodity");
    expect(screen.getByRole("button", { name: "3D" })).toHaveAttribute("aria-disabled", "true");
  });
});
