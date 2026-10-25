import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
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

const kpis = () => screen.getByRole("region", { name: "Seasonal Supply key figures" });
const slider = () => screen.getByRole("slider", { name: /^Month, \d{4}$/ });

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
});
afterEach(() => vi.unstubAllGlobals());

// Figures: HMRC snapshot 2026-10-23, checked independently in Python (stage 3 report).
describe("Seasonal Supply explorer", { timeout: 20_000 }, () => {
  it("shows the selected month from real records: tomatoes, January 2025", async () => {
    renderAt("?m=seasonal&y=2025&mo=1");
    expect(await within(kpis()).findByText("33.1 kt", {}, { timeout: 8000 })).toBeInTheDocument();
    expect(within(kpis()).getByText("−9.0 %")).toBeInTheDocument();
    expect(within(kpis()).getByText("42.5 %")).toBeInTheDocument();
    expect(within(kpis()).getByText("2,740")).toBeInTheDocument();
    expect(within(kpis()).getByText("Jan 2024: 36.3 kt")).toBeInTheDocument();
    expect(await screen.findByRole("slider", { name: "Month, 2025" })).toHaveAttribute(
      "aria-valuetext",
      "January 2025: 33.1 kt recorded imports",
    );
    const heatmap = await screen.findByRole("table", {
      name: /Tomatoes recorded import partners by month, 2025/,
    });
    expect(within(heatmap).getByRole("button", { name: "Netherlands" })).toBeInTheDocument();
    expect(
      within(heatmap).getByText("Morocco, January 2025: 14.1 kt, 42.5 % of the month"),
    ).toBeInTheDocument();
  });

  it("moving the slider updates every figure; Page Up/Down change the year", async () => {
    renderAt("?m=seasonal&y=2025&mo=1");
    await within(kpis()).findByText("33.1 kt", {}, { timeout: 8000 });
    fireEvent.change(slider(), { target: { value: "7" } });
    expect(window.location.search).toBe("?m=seasonal&y=2025&mo=7");
    expect(await within(kpis()).findByText("33.2 kt")).toBeInTheDocument();
    expect(within(kpis()).getByText("+2.2 %")).toBeInTheDocument();
    expect(within(kpis()).getByText("63.8 %")).toBeInTheDocument();
    expect(within(kpis()).getByText("4,680")).toBeInTheDocument();
    fireEvent.keyDown(slider(), { key: "PageDown" });
    expect(useAppStore.getState()).toMatchObject({ year: 2024, month: 7 });
  });

  it("plays through the published months, stops at the latest, and restarts from January", async () => {
    renderAt("?m=seasonal&y=2026&mo=7");
    await screen.findByRole("slider", { name: "Month, 2026" }, { timeout: 8000 });
    await userEvent.click(screen.getByRole("radio", { name: /2× speed/ }));
    await userEvent.click(screen.getByRole("button", { name: "Play through 2026" }));
    expect(useAppStore.getState().playing).toBe(true);
    // 0.6 s per month at 2×: Aug 2026 is the latest published month, so playback stops there.
    await waitFor(() => expect(useAppStore.getState().month).toBe(8), { timeout: 3000 });
    await waitFor(() => expect(useAppStore.getState().playing).toBe(false), { timeout: 3000 });
    await userEvent.click(screen.getByRole("button", { name: "Play through 2026" }));
    expect(useAppStore.getState()).toMatchObject({ month: 1, playing: true });
    // Any change the user makes to the month stops playback (SS-03).
    fireEvent.change(slider(), { target: { value: "5" } });
    expect(useAppStore.getState()).toMatchObject({ month: 5, playing: false });
  });

  it("an unpublished month shows no figures and says why", async () => {
    renderAt("?m=seasonal&y=2026&mo=10");
    await screen.findByRole("slider", { name: "Month, 2026" }, { timeout: 8000 });
    // The map is explained, not left blank; the Insights panel says the same.
    const banner = document.querySelector(".map-banner")!;
    expect(banner).toHaveTextContent(
      "Oct 2026 is not yet published by HMRC (latest: Aug 2026). Nothing is drawn or estimated for this month.",
    );
    expect(within(kpis()).getAllByText("Not published")).toHaveLength(4);
    expect(slider()).toHaveAttribute("aria-valuetext", "October 2026: not yet published by HMRC");
    expect(useAppStore.getState().originsMap?.partners).toEqual([]);
  });

  it("answers SS-08: tomatoes, January vs July", async () => {
    renderAt("?m=seasonal&c=wheat&y=2023");
    const example = await screen.findByRole(
      "button",
      { name: /Example: how does tomato supply change/ },
      { timeout: 8000 },
    );
    await userEvent.click(example);
    expect(window.location.search).toBe("?m=seasonal&y=2025&mo=1&cm=7");
    const heading = await screen.findByRole("heading", { name: "Compare months · Jan vs Jul 2025" });
    const section = heading.closest("section")!;
    expect(within(section).getByText("Morocco 42.5 %")).toBeInTheDocument();
    expect(within(section).getByText("Netherlands 63.8 %")).toBeInTheDocument();
  });

  it("states that UK seasonal production is not published monthly and shows none", async () => {
    renderAt("?m=seasonal");
    expect(
      await screen.findByText(
        "UK seasonal production: not published monthly, not shown.",
        {},
        { timeout: 8000 },
      ),
    ).toBeInTheDocument();
    expect(screen.getByRole("radio", { name: "UK production" })).toHaveAttribute("aria-disabled", "true");
    expect(screen.getByRole("radio", { name: "Combined" })).toHaveAttribute("aria-disabled", "true");
  });

  it("switches the heatmap to change vs the comparison year, with fixed classes", async () => {
    renderAt("?m=seasonal&y=2025&mo=7");
    await userEvent.click(await screen.findByRole("radio", { name: "Change vs 2024" }, { timeout: 8000 }));
    expect(window.location.search).toContain("hm=change");
    const legend = screen.getByRole("list", { name: "Heatmap legend" });
    expect(within(legend).getByText("−1 to +1 pp")).toBeInTheDocument();
    expect(within(legend).getByText("≥ +5 pp")).toBeInTheDocument();
  });

  it("explains the tomato code change and keeps Food Origins working", async () => {
    renderAt("?m=seasonal&y=2025&mo=3");
    expect(
      await screen.findByText(
        /Commodity codes changed in Jan 2025: 07020000 has no records after Dec 2024/,
        {},
        { timeout: 8000 },
      ),
    ).toBeInTheDocument();
    await userEvent.click(
      within(screen.getByRole("navigation", { name: "Modules" })).getByRole("button", { name: /Origins/ }),
    );
    expect(await screen.findByRole("heading", { level: 1, name: "Food Origins" })).toBeInTheDocument();
    expect(useAppStore.getState().playing).toBe(false);
  });
});
