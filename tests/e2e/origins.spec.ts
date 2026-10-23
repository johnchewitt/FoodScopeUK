import { expect, test, type Page } from "@playwright/test";

/**
 * Food Origins explorer (Stage 2) against the real committed HMRC snapshot 2026-10-23.
 * Expected values are the same reconciled figures used in src/analysis/trade.test.ts.
 */

function trackConsoleErrors(page: Page): string[] {
  const errors: string[] = [];
  page.on("console", (msg) => {
    if (msg.type() === "error") errors.push(msg.text());
  });
  page.on("pageerror", (err) => errors.push(err.message));
  return errors;
}

async function waitForOrigins(page: Page) {
  await expect(page.locator(".map-host[data-map-state]")).toHaveAttribute("data-map-state", "ready", {
    timeout: 45_000,
  });
  await expect(page.locator(".kpi-card").first()).toHaveAttribute("data-state", "ready", { timeout: 20_000 });
  // The map layers have been drawn from the store's view model.
  await expect.poll(() => mapInfo(page).then((i) => i.flows), { timeout: 20_000 }).toBeGreaterThan(1);
}

/** What the Origins layers currently draw (read from the ArcGIS view, not from React). */
async function mapInfo(page: Page) {
  return page.locator("arcgis-map").evaluate((el: HTMLArcgisMapElement) => {
    const layers = el.view.map!.layers;
    const byId = (id: string) =>
      layers.find((l) => l.id === id) as unknown as
        | {
            graphics?: { length: number; toArray(): { attributes: { key: string } }[] };
            renderer?: unknown;
            visible: boolean;
          }
        | undefined;
    const partners = byId("origins-partners") as unknown as {
      renderer: { uniqueValueInfos: { value: string; symbol: { outline: { width: number } } }[] };
      visible: boolean;
    };
    const flows = byId("origins-flows");
    const canvas = el.view.container?.querySelector<HTMLCanvasElement>("canvas.flow-particles");
    const infos = partners?.renderer?.uniqueValueInfos ?? [];
    return {
      visible: partners?.visible ?? false,
      shaded: infos.map((i) => i.value),
      selectedOutline: Object.fromEntries(infos.map((i) => [i.value, i.symbol.outline.width])),
      flows: flows?.graphics?.length ?? 0,
      flowKeys: flows?.graphics?.toArray().map((g) => g.attributes.key) ?? [],
      particles: canvas && !canvas.hidden ? Number(canvas.dataset.particles ?? 0) : 0,
    };
  });
}

const kpi = (page: Page, label: string) => page.getByRole("article", { name: label });

test.describe("Food Origins explorer", () => {
  test("default view: tomatoes, 12 months to Aug 2026, real figures everywhere", async ({ page }) => {
    const errors = trackConsoleErrors(page);
    await page.goto("./");
    await waitForOrigins(page);

    await expect(kpi(page, "Recorded imports")).toContainText("391.1 kt");
    await expect(kpi(page, "Recorded imports")).toContainText("£679.5m");
    await expect(kpi(page, "Recorded import partners")).toContainText("25");
    await expect(kpi(page, "Top recorded partner")).toContainText("43.8 %");
    await expect(kpi(page, "Top recorded partner")).toContainText("Netherlands");
    await expect(kpi(page, "Partner concentration (HHI)")).toContainText("2,990");

    const insights = page.locator("#insights-panel");
    await expect(insights.getByRole("heading", { name: "Tomatoes · Sep 2025 – Aug 2026" })).toBeVisible();
    await expect(insights.locator(".partner-table tbody tr").first()).toContainText("Netherlands");
    await expect(page.getByText(/Partner = country of dispatch recorded by HMRC/).first()).toBeVisible();
    await expect(
      page.getByText("Lines are symbolic links to a single UK point, not shipping routes.", { exact: false }),
    ).toBeVisible();

    const info = await mapInfo(page);
    expect(info.visible).toBe(true);
    expect(info.shaded).toEqual(expect.arrayContaining(["NL", "MA", "ES", "BE"]));
    expect(info.flows).toBe(13); // 12 connections + the UK anchor
    expect(info.flowKeys.slice(0, 3)).toEqual(["NL", "MA", "ES"]); // widest first
    // Moving markers (FO-04): drawn on the overlay canvas and actually moving between frames.
    await expect.poll(() => mapInfo(page).then((i) => i.particles)).toBeGreaterThanOrEqual(12);
    const canvas = page.locator("canvas.flow-particles");
    const a = await canvas.screenshot();
    await page.waitForTimeout(400);
    const b = await canvas.screenshot();
    expect(a.equals(b)).toBe(false);
    expect(errors, `console errors:\n${errors.join("\n")}`).toEqual([]);
  });

  test("changing commodity updates map, cards, table and URL", async ({ page }) => {
    await page.goto("./");
    await waitForOrigins(page);
    await page.getByRole("radio", { name: /Bananas/ }).click();
    await expect(page).toHaveURL(/\?c=bananas$/);
    await expect(kpi(page, "Top recorded partner")).toContainText("Colombia");
    await expect(kpi(page, "Top recorded partner")).toContainText("30.1 %");
    await expect(page.locator(".partner-table tbody tr").first()).toContainText("Colombia");
    await expect.poll(() => mapInfo(page).then((i) => i.flowKeys[0])).toBe("CO");
    // Keyboard navigation in the commodity list (FO-01).
    await page.getByRole("radio", { name: /Bananas/ }).press("ArrowDown");
    await expect(page).toHaveURL(/c=potatoes/);
    await expect(page.getByRole("radio", { name: /Potatoes/ })).toBeFocused();
  });

  test("selecting a partner in the table highlights it on the map and in the charts", async ({ page }) => {
    await page.goto("./");
    await waitForOrigins(page);
    await page.locator(".partner-table").getByRole("button", { name: "Morocco" }).click();
    await expect(page).toHaveURL(/p=MA/);
    await expect(page.locator(".selected-partner")).toContainText("Morocco");
    await expect(page.locator(".selected-partner")).toContainText("29.6 %");
    await expect.poll(() => mapInfo(page).then((i) => i.selectedOutline.MA)).toBe(2);
    // Selecting again clears it.
    await page.locator(".partner-table").getByRole("button", { name: "Morocco" }).click();
    await expect(page).not.toHaveURL(/p=MA/);
    await expect(page.locator(".selected-partner")).toHaveCount(0);
  });

  test("clicking a partner on the map selects it everywhere", async ({ page }) => {
    await page.goto("./");
    await waitForOrigins(page);
    // Spain's interior, converted to screen coordinates by the view itself.
    const pt = await page.locator("arcgis-map").evaluate(async (el: HTMLArcgisMapElement) => {
      const view = el.view;
      await view.goTo({ center: [-3.7, 40.2], zoom: 4 }, { animate: false });
      await new Promise((r) => setTimeout(r, 1500));
      const spain = view.center.clone(); // a Point in the view's spatial reference
      spain.longitude = -3.7;
      spain.latitude = 40.2;
      const s = view.toScreen(spain)!;
      const box = el.getBoundingClientRect();
      return { x: box.left + s.x, y: box.top + s.y };
    });
    await page.mouse.click(pt.x, pt.y);
    await expect(page).toHaveURL(/p=ES/);
    await expect(page.locator(".selected-partner")).toContainText("Spain");
    await expect(page.locator(".partner-table tr[data-selected='true']")).toContainText("Spain");
  });

  test("timeline, period and measure controls stay in sync", async ({ page }) => {
    await page.goto("./");
    await waitForOrigins(page);
    await page.getByRole("radio", { name: "Month", exact: true }).click();
    const timeline = page.getByRole("region", { name: "Timeline" });
    await timeline.getByRole("button", { name: "Jan", exact: true }).click();
    await expect(page).toHaveURL(/pm=m&y=2026&mo=1/);
    await expect(
      page.locator("#insights-panel").getByRole("heading", { name: "Tomatoes · Jan 2026" }),
    ).toBeVisible();
    await page.keyboard.press("ArrowLeft"); // crosses into the previous year
    await expect(page).toHaveURL(/y=2025&mo=12/);
    await expect(timeline.getByRole("button", { name: "Dec", exact: true })).toHaveAttribute(
      "aria-pressed",
      "true",
    );
    await expect(timeline.getByRole("button", { name: "Sep", exact: true })).not.toHaveAttribute(
      "aria-disabled",
      "true",
    );

    await page.getByRole("radio", { name: "Value (£)" }).click();
    await expect(page).toHaveURL(/ms=value/);
    await expect(kpi(page, "Recorded imports")).toContainText("£");

    await page.getByRole("radio", { name: "Year", exact: true }).click();
    await page.getByLabel("Year").selectOption("2026");
    await expect(page.getByText("Sep–Dec 2026 not yet published by HMRC (latest: Aug 2026)")).toBeVisible();
  });

  test("deep link restores commodity, period, measure and partner", async ({ page }) => {
    await page.goto("./?c=wheat&pm=y&y=2024&ms=value&p=CA");
    await waitForOrigins(page);
    await expect(page.getByRole("radio", { name: /Wheat/ })).toHaveAttribute("aria-checked", "true");
    await expect(
      page.locator("#insights-panel").getByRole("heading", { name: "Wheat · Jan–Dec 2024" }),
    ).toBeVisible();
    await expect(page.locator(".selected-partner")).toContainText("Canada");
    await expect(page.getByRole("radio", { name: "Value (£)" })).toHaveAttribute("aria-checked", "true");
  });

  test("an unknown commodity in the URL falls back and says so", async ({ page }) => {
    await page.goto("./?c=caviar");
    await waitForOrigins(page);
    await expect(page.getByText(/The commodity in this link is not in the snapshot/)).toBeVisible();
    await expect(page.getByRole("radio", { name: /Tomatoes/ })).toHaveAttribute("aria-checked", "true");
  });

  test("reduced motion draws static connections without moving markers", async ({ page }) => {
    await page.emulateMedia({ reducedMotion: "reduce" });
    await page.goto("./");
    await waitForOrigins(page);
    const info = await mapInfo(page);
    expect(info.flows).toBe(13);
    expect(info.particles).toBe(0);
  });

  test("the in-app motion switch stops and restarts the moving markers", async ({ page }) => {
    await page.goto("./");
    await waitForOrigins(page);
    await expect.poll(() => mapInfo(page).then((i) => i.particles)).toBeGreaterThan(0);
    await page.locator("#filter-panel calcite-switch").click();
    await expect.poll(() => mapInfo(page).then((i) => i.particles)).toBe(0);
    await page.locator("#filter-panel calcite-switch").click();
    await expect.poll(() => mapInfo(page).then((i) => i.particles)).toBeGreaterThan(0);
  });

  test("other modules hide the Origins layers", async ({ page }) => {
    await page.goto("./");
    await waitForOrigins(page);
    await page
      .getByRole("navigation", { name: "Modules" })
      .getByRole("button", { name: /Profiles/ })
      .click();
    await expect.poll(() => mapInfo(page).then((i) => i.visible)).toBe(false);
    const cards = page.locator(".kpi-card");
    for (const text of await cards.allInnerTexts()) expect(text).toContain("No data loaded");
  });
});
