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

const files: Record<string, string> = {
  "config.json": readRepoFile("public/config.json"),
  "data/manifest.json": readRepoFile("public/data/manifest.json"),
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
    expect(screen.getByRole("region", { name: "Food Origins key figures" })).toBeInTheDocument();
    expect(screen.getAllByText("No data loaded")).toHaveLength(4);
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
    window.history.replaceState(null, "", "/FoodScopeUK/?m=profiles&mo=7&lad=N09000003");
    renderApp();
    expect(
      await screen.findByRole("heading", { level: 1, name: "Local Authority Profiles" }),
    ).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Jul" })).toHaveAttribute("aria-pressed", "true");
    expect(screen.getByText("N09000003")).toBeInTheDocument();
  });

  it("selects months and mirrors them to the URL", async () => {
    renderApp();
    await userEvent.click(screen.getByRole("button", { name: "Mar" }));
    expect(useAppStore.getState().month).toBe(3);
    expect(window.location.search).toBe("?mo=3");
    await userEvent.click(screen.getByRole("button", { name: "Next month" }));
    expect(window.location.search).toBe("?mo=4");
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

  it("shows data status from the real manifest", async () => {
    renderApp();
    const insights = document.getElementById("insights-panel")!;
    expect(await within(insights).findByText("Country outlines")).toBeInTheDocument();
    expect(within(insights).getByText(/Natural Earth v4.1.0, 1:110m, 177 countries/)).toBeInTheDocument();
    expect(
      await screen.findByRole("button", { name: /Data freshness: No statistics loaded/ }),
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
    expect(screen.getByText("No statistics have been published yet")).toBeInTheDocument();
  });

  it("marks planned tools as unavailable rather than hiding them", () => {
    renderApp();
    expect(screen.getByRole("button", { name: /Export \(not available yet/ })).toHaveAttribute(
      "aria-disabled",
      "true",
    );
    expect(screen.getByRole("button", { name: /Search \(not available yet/ })).toHaveAttribute(
      "aria-disabled",
      "true",
    );
  });
});
