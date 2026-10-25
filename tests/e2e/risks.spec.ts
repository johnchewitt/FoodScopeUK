import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Page } from "@playwright/test";

/**
 * UK Food Resilience — Risk Explorer (Stage 6) against the committed snapshots: trade 2026-10-23,
 * risk and context 2026-10-25. Expected values were checked independently against the raw sources
 * (docs/stage-reports/stage-6.md, hand checks).
 */

/** Console errors, except label glyphs the sandbox cannot fetch from Esri's font server. */
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

/** A data attribute the map controllers set on the view's container (no ArcGIS state in React). */
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

/** Screen position (page px) of a WGS84 point. */
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

/** Which map layers are visible (structural types; the SDK is not imported here). */
async function visibleLayers(page: Page): Promise<string[]> {
  return page.locator("arcgis-map").evaluate((el: HTMLArcgisMapElement) =>
    el.view
      .map!.layers.filter((l) => l.visible)
      .map((l) => l.id)
      .toArray(),
  );
}

const MODULE = "UK Food Resilience — Risk Explorer";
const kpis = (page: Page) => page.getByRole("region", { name: new RegExp(`${MODULE} key figures`) });
const insights = (page: Page) => page.getByRole("complementary", { name: "Insights" });
const controls = (page: Page) => page.getByRole("complementary", { name: `${MODULE} controls` });

async function noSeriousViolations(page: Page) {
  const results = await new AxeBuilder({ page }).exclude("arcgis-map").analyze();
  const serious = results.violations.filter((v) => v.impact === "serious" || v.impact === "critical");
  expect(serious.map((v) => `${v.id}: ${v.help} (${v.nodes.length})`)).toEqual([]);
}

test.describe("UK Food Resilience — Risk Explorer", () => {
  test("supply view: water-stress fill, then click a partner for its estimated exposure (RK-02)", async ({
    page,
  }) => {
    const errors = trackConsoleErrors(page);
    await page.goto("./?m=risks&c=strawberries");
    await mapReady(page);
    await expect(kpis(page).getByText("2,640")).toBeVisible({ timeout: 30_000 });
    await expect(kpis(page).getByText("23.5 %")).toBeVisible();
    await expect.poll(() => viewData(page, "partnerFill"), { timeout: 20_000 }).toBe("share");
    await controls(page).getByRole("radio", { name: "Water stress" }).click();
    await expect(page).toHaveURL(/rf=stress/);
    await expect.poll(() => viewData(page, "partnerFill")).toBe("stress");
    await expect(page.getByText("Partners’ national water stress (FAO SDG 6.4.2)")).toBeVisible();

    // Spain on the map (Madrid): the partner is selected and its exposure shown.
    await settled(page);
    const spain = await toScreen(page, -3.7, 40.4);
    await page.mouse.click(spain.x, spain.y);
    await expect(page).toHaveURL(/p=ES/, { timeout: 15_000 });
    const exposure = insights(page).getByRole("group", { name: "Supplier disruption (estimated exposure)" });
    await expect(
      exposure.getByRole("figure", { name: "Spain: share of recorded imports by month" }),
    ).toBeVisible();
    // Spain supplied at least half of recorded strawberry imports in Mar, Apr and May 2026.
    await expect(exposure.getByText(/supplied at least half of recorded imports/)).toContainText("3");
    // The trade layers are visible; the logistics layers are not.
    const layers = await visibleLayers(page);
    expect(layers).toContain("origins-partners");
    expect(layers).not.toContain("risk-ports");
    expect(errors, `console errors:\n${errors.join("\n")}`).toEqual([]);
    await noSeriousViolations(page);
  });

  test("logistics view: ports, roads and farming regions; click a port (RK-03)", async ({ page }) => {
    const errors = trackConsoleErrors(page);
    await page.goto("./?m=risks&rv=logistics");
    await mapReady(page);
    await expect(kpis(page).getByText("237.5 Mt")).toBeVisible({ timeout: 30_000 });
    await expect.poll(() => viewData(page, "riskPorts"), { timeout: 20_000 }).toBe("51");
    expect(await viewData(page, "riskRoads")).toBe("on");
    expect(await viewData(page, "riskRegions")).toBe("outlines");
    const layers = await visibleLayers(page);
    expect(layers).toEqual(expect.arrayContaining(["risk-ports", "risk-roads", "risk-regions"]));
    expect(layers).not.toContain("origins-partners");

    await settled(page);
    const dover = await toScreen(page, 1.31748, 51.12309);
    await page.mouse.move(dover.x, dover.y);
    await expect(page.locator("[data-hover-port='GBDVR']")).toContainText("12.5 Mt", { timeout: 10_000 });
    await page.mouse.click(dover.x, dover.y);
    await expect(page).toHaveURL(/pt=GBDVR/);
    await expect.poll(() => viewData(page, "riskSelectedPort")).toBe("GBDVR");
    await expect(kpis(page).getByRole("article", { name: "Dover" })).toContainText("−2.2 % on 2024");

    await controls(page)
      .getByRole("combobox", { name: "Agricultural production regions" })
      .selectOption("sheep");
    await expect(page).toHaveURL(/fm=sheep/);
    await expect.poll(() => viewData(page, "riskRegions")).toBe("sheep");
    await controls(page).getByRole("switch", { name: "Strategic road corridors" }).click();
    await expect(page).toHaveURL(/rd=0/);
    await expect.poll(() => viewData(page, "riskRoads")).toBe("off");
    expect(errors, `console errors:\n${errors.join("\n")}`).toEqual([]);
    await noSeriousViolations(page);
  });

  test("community access view: councils shaded within nation, click one (RK-04)", async ({ page }) => {
    const errors = trackConsoleErrors(page);
    await page.goto("./?m=risks&rv=access&lad=S12000049");
    await mapReady(page);
    await expect(kpis(page).getByText("13.8 %")).toBeVisible({ timeout: 30_000 });
    await expect(kpis(page).getByText("18 of 32")).toBeVisible();
    await expect.poll(() => viewData(page, "accessCouncils"), { timeout: 20_000 }).toBe("fills");
    // No stores in this view: the stores layer is never created or shown.
    expect(await visibleLayers(page)).not.toContain("access-stores");
    await settled(page);
    // Highland: council hit tests on the councils GeoJSON layer are slow under SwiftShader.
    const highland = await toScreen(page, -4.9, 57.4);
    await page.mouse.click(highland.x, highland.y);
    await expect(page).toHaveURL(/lad=S12000017/, { timeout: 20_000 });
    await expect(kpis(page).getByText("20.8 %")).toBeVisible({ timeout: 10_000 }); // 65 of 312
    await expect(insights(page).getByText("Highland: priority places for food")).toBeVisible();
    // At local scale the councils stay filled (they are this view's subject; UK Food Access outlines them).
    await page
      .locator("arcgis-map")
      .evaluate((el: HTMLArcgisMapElement) => el.view.goTo({ zoom: 12.5 }, { animate: false }));
    await settled(page);
    await expect.poll(() => viewData(page, "accessCouncils")).toBe("fills");
    expect(errors, `console errors:\n${errors.join("\n")}`).toEqual([]);
    await noSeriousViolations(page);
  });

  test("switching views keeps one map and the selection; other modules still work", async ({ page }) => {
    const errors = trackConsoleErrors(page);
    await page.goto("./?m=risks&rv=access&lad=E08000003");
    await mapReady(page);
    await expect(kpis(page).getByText(/of 296/)).toBeVisible({ timeout: 30_000 });
    await controls(page).getByRole("radio", { name: "International supply" }).click();
    await expect(page).toHaveURL(/m=risks&lad=E08000003/);
    await expect.poll(async () => (await visibleLayers(page)).includes("access-councils")).toBe(false);
    await page.goBack();
    await expect(page).toHaveURL(/rv=access/);
    await expect(kpis(page).getByText(/of 296/)).toBeVisible({ timeout: 20_000 });
    const nav = page.getByRole("navigation", { name: "Modules" });
    await nav.getByRole("button", { name: /Profiles/ }).click();
    await expect(page).toHaveURL(/m=profiles.*lad=E08000003/);
    await expect(insights(page).getByRole("region", { name: "Manchester" })).toBeVisible({ timeout: 20_000 });
    expect(errors, `console errors:\n${errors.join("\n")}`).toEqual([]);
  });
});
