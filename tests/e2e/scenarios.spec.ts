import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Page } from "@playwright/test";

/**
 * Scenario Lab (Stage 7) against the committed snapshots: trade and scenario 2026-10-26, context
 * 2026-10-26, risk 2026-10-25, local 2026-10-24. Expected values were recomputed independently
 * from the published files (docs/stage-reports/stage-7.md).
 */

function trackConsoleErrors(page: Page): string[] {
  const errors: string[] = [];
  page.on("console", (msg) => {
    if (msg.type() !== "error") return;
    if (msg.location().url.startsWith("https://static.arcgis.com/fonts/")) return;
    errors.push(msg.text());
  });
  page.on("pageerror", (err) => errors.push(err.message));
  return errors;
}

async function viewData(page: Page, key: string): Promise<string | null> {
  return page
    .locator("arcgis-map")
    .evaluate((el: HTMLArcgisMapElement, k) => el.view.container?.dataset[k] ?? null, key);
}

async function mapReady(page: Page) {
  await expect(page.locator(".map-host[data-map-state]")).toHaveAttribute("data-map-state", "ready", {
    timeout: 45_000,
  });
}

async function settled(page: Page) {
  await page.locator("arcgis-map").evaluate(
    (el: HTMLArcgisMapElement) =>
      new Promise<void>((resolve) => {
        const check = () => (el.view.stationary && !el.view.updating ? resolve() : setTimeout(check, 100));
        check();
      }),
  );
}

async function toScreen(page: Page, lon: number, lat: number) {
  return page.locator("arcgis-map").evaluate(
    (el: HTMLArcgisMapElement, [x, y]: [number, number]) => {
      const p = el.view.center.clone();
      p.longitude = x;
      p.latitude = y;
      const s = el.view.toScreen(p)!;
      const box = el.getBoundingClientRect();
      return { x: box.left + s.x, y: box.top + s.y };
    },
    [lon, lat] as [number, number],
  );
}

async function visibleLayers(page: Page): Promise<string[]> {
  return page.locator("arcgis-map").evaluate((el: HTMLArcgisMapElement) =>
    el.view
      .map!.layers.filter((l) => l.visible)
      .map((l) => l.id)
      .toArray(),
  );
}

const MODULE = "Scenario Lab";
const kpis = (page: Page) => page.getByRole("region", { name: new RegExp(`${MODULE} key figures`) });
const insights = (page: Page) => page.getByRole("complementary", { name: "Insights" });
const controls = (page: Page) => page.getByRole("complementary", { name: `${MODULE} controls` });

async function noSeriousViolations(page: Page) {
  const results = await new AxeBuilder({ page }).exclude("arcgis-map").analyze();
  const serious = results.violations.filter((v) => v.impact === "serious" || v.impact === "critical");
  expect(serious.map((v) => `${v.id}: ${v.help} (${v.nodes.length})`)).toEqual([]);
}

/** P9: "shortage" only ever negated on screen; no forecast language. */
async function wordingAudit(page: Page) {
  const text = await page.locator("body").innerText();
  for (const m of text.matchAll(/[^.\n]*\bshortages?\b[^.\n]*/gi))
    expect(m[0]).toMatch(/\bnot\b|\bnothing\b/i);
  expect(text).not.toMatch(/forecast(ed)? shortages?/i);
}

test.describe("Scenario Lab", () => {
  test("A: Spanish tomatoes, map connection narrows; reset and reload keep the URL (SC-A/E, SC-05)", async ({
    page,
  }) => {
    const errors = trackConsoleErrors(page);
    await page.goto("./?m=scenarios");
    await mapReady(page);
    await controls(page)
      .getByRole("button", { name: /Preset: Spanish tomatoes/ })
      .click({ timeout: 30_000 });
    await expect(page).toHaveURL(/p=ES/);
    await expect(kpis(page).getByText("6.8 kt")).toBeVisible({ timeout: 30_000 });
    await expect(kpis(page).getByRole("article", { name: "Partner concentration (HHI)" })).toContainText(
      "2,660",
    );
    expect(await visibleLayers(page)).toContain("origins-flows");
    await expect(insights(page).getByRole("region", { name: "Scenario modelled" })).toContainText(
      "not a forecast, and not a shortage",
    );
    // Baseline view on the map, then back.
    await controls(page).getByRole("radio", { name: "Baseline" }).click();
    await expect(page).toHaveURL(/sv=baseline/);
    await controls(page).getByRole("radio", { name: "Scenario" }).click();
    await controls(page)
      .getByRole("button", { name: /Reset to baseline/ })
      .click();
    await expect(
      kpis(page).getByRole("article", { name: "Recorded imports affected", exact: true }),
    ).toContainText("0 t");
    await page.reload();
    await mapReady(page);
    await expect(
      kpis(page).getByRole("article", { name: "Recorded imports affected", exact: true }),
    ).toContainText("0 t", {
      timeout: 30_000,
    });
    await wordingAudit(page);
    expect(errors, `console errors:\n${errors.join("\n")}`).toEqual([]);
    await noSeriousViolations(page);
  });

  test("B: pick a supermarket on the map, see the affected areas and their new nearest store (SC-D)", async ({
    page,
  }) => {
    const errors = trackConsoleErrors(page);
    await page.goto("./?m=scenarios&sk=closure");
    await mapReady(page);
    await controls(page)
      .getByRole("button", { name: /Preset: Manchester/ })
      .click({ timeout: 45_000 });
    await expect(kpis(page).getByText("26,730")).toBeVisible({ timeout: 30_000 });
    await expect.poll(() => viewData(page, "scenarioAreas"), { timeout: 20_000 }).toBe("17");
    await expect.poll(() => viewData(page, "accessCouncils")).toBe("outlines");
    const layers = await visibleLayers(page);
    expect(layers).toEqual(expect.arrayContaining(["scenario-closure", "access-stores", "access-councils"]));
    expect(layers).not.toContain("origins-flows");
    await settled(page);
    await controls(page).getByRole("radio", { name: "Baseline" }).click();
    await expect.poll(() => viewData(page, "scenarioView")).toBe("baseline");
    await controls(page).getByRole("radio", { name: "Scenario" }).click();
    await expect.poll(() => viewData(page, "scenarioView")).toBe("scenario");
    // Click another supermarket on the map (Co-op Whalley Range, 1.5 km away): it becomes the closed one.
    const coop = await toScreen(page, -2.257301, 53.451916);
    await page.mouse.move(coop.x, coop.y);
    await expect(page.locator("[data-hover-store='1010010367']")).toContainText("Co-op Whalley Range", {
      timeout: 15_000,
    });
    await page.mouse.click(coop.x, coop.y);
    await expect(page).toHaveURL(/st=1010010367/, { timeout: 20_000 });
    await expect.poll(() => viewData(page, "scenarioClosed"), { timeout: 20_000 }).toBe("1010010367");
    await wordingAudit(page);
    expect(errors, `console errors:\n${errors.join("\n")}`).toEqual([]);
    await noSeriousViolations(page);
  });

  test("C and D: production shock and port disruption; save and compare (brief §7)", async ({ page }) => {
    const errors = trackConsoleErrors(page);
    await page.goto("./?m=scenarios&sk=port&pt=GBDVR");
    await mapReady(page);
    await expect(kpis(page).getByText("521.4 kt")).toBeVisible({ timeout: 30_000 });
    await expect.poll(() => viewData(page, "riskSelectedPort"), { timeout: 20_000 }).toBe("GBDVR");
    await controls(page).getByRole("textbox", { name: "Scenario name" }).fill("Dover half capacity");
    await controls(page).getByRole("button", { name: "Save" }).click();
    await controls(page)
      .getByRole("radio", { name: /Domestic production shock/ })
      .click();
    await controls(page)
      .getByRole("button", { name: /Preset: UK wheat/ })
      .click();
    await expect(kpis(page).getByText("1.8 Mt")).toBeVisible({ timeout: 30_000 });
    expect(await visibleLayers(page)).not.toContain("risk-ports");
    await insights(page).getByRole("checkbox").first().check();
    const table = insights(page).getByRole("table", { name: "Saved scenarios compared" });
    await expect(table).toContainText("521.4 kt", { timeout: 20_000 });
    await expect(table).toContainText("1.8 Mt");
    const download = page.waitForEvent("download");
    await insights(page)
      .getByRole("button", { name: /Export summary \(CSV\)/ })
      .click();
    expect((await download).suggestedFilename()).toBe("foodscope-scenarios.csv");
    await wordingAudit(page);
    expect(errors, `console errors:\n${errors.join("\n")}`).toEqual([]);
    await noSeriousViolations(page);
  });
});
