import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Page } from "@playwright/test";

/**
 * Local Authority Profiles (Stage 5) against the committed snapshots: local 2026-10-24 (GEOLYTIX v46,
 * ONS mid-2025, May 2025 councils), areas and context 2026-10-25. Expected values were checked
 * independently against the raw sources (docs/stage-reports/stage-5.md, hand checks).
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

const zoom = (page: Page) => page.locator("arcgis-map").evaluate((el: HTMLArcgisMapElement) => el.view.zoom);

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

/** The profile layers the tests read (structural types; the SDK is not imported here). */
interface Inspected {
  renderer?: { uniqueValueInfos: { value: string; symbol: { outline?: { style?: string } } }[] };
  graphics?: { length: number };
  minScale?: number;
}

async function profileLayers(page: Page) {
  return page.locator("arcgis-map").evaluate((el: HTMLArcgisMapElement) => {
    const find = (id: string) =>
      el.view.map!.layers.find((l) => l.id === id) as unknown as Inspected | undefined;
    const councils = find("access-councils");
    const infos = councils?.renderer?.uniqueValueInfos ?? [];
    return {
      councilStyles: Object.fromEntries(infos.map((i) => [i.value, i.symbol.outline?.style ?? "solid"])),
      areas: find("profile-small-areas")?.graphics?.length ?? 0,
      grocersMinScale: find("access-ni-grocers")?.minScale ?? null,
      referenceMaxScale:
        (el.view.map!.layers.find((l) => l.id === "reference-outlines") as unknown as { maxScale: number })
          ?.maxScale ?? null,
    };
  });
}

const kpis = (page: Page) => page.getByRole("region", { name: /Local Authority Profiles key figures/ });
const insights = (page: Page) => page.getByRole("complementary", { name: "Insights" });
const controls = (page: Page) =>
  page.getByRole("complementary", { name: "Local Authority Profiles controls" });

test.describe("Local Authority Profiles", () => {
  test("search for Belfast: fly-to, highlighted boundary, profile and small areas (LP-01, LP-02, LP-06)", async ({
    page,
  }) => {
    const errors = trackConsoleErrors(page);
    await page.goto("./?m=profiles");
    await mapReady(page);
    await expect(kpis(page).getByText("No council chosen").first()).toBeVisible({ timeout: 30_000 });
    await controls(page).getByRole("searchbox", { name: "Council name or code" }).fill("belf");
    await controls(page)
      .getByRole("button", { name: /Belfast.*N09000003/ })
      .click();
    await expect(page).toHaveURL(/\?m=profiles&lad=N09000003$/);
    await expect(kpis(page).getByText("351,900")).toBeVisible();
    await expect(kpis(page).getByText("32.2 %")).toBeVisible({ timeout: 20_000 });
    await expect(insights(page).getByRole("region", { name: "Belfast" })).toBeVisible();

    // Flies to the council (about zoom 11–12), never past the profile cap.
    await expect.poll(() => zoom(page), { timeout: 15_000 }).toBeGreaterThan(10);
    expect(await zoom(page)).toBeLessThanOrEqual(13);
    const centre = await toScreen(page, -5.93, 54.597);
    const box = await page.locator("arcgis-map").boundingBox();
    expect(centre.x).toBeGreaterThan(box!.x);
    expect(centre.x).toBeLessThan(box!.x + box!.width);

    // Councils outlined, Belfast emphasised; 174 SOAs shaded by PPFI; 110m outlines hidden here.
    await expect.poll(() => viewData(page, "accessCouncils")).toBe("outlines");
    await expect.poll(() => viewData(page, "profileAreas")).toBe("N09000003:ppfi:174");
    const layers = await profileLayers(page);
    expect(layers.councilStyles.N09000003).toBe("solid");
    expect(layers.areas).toBe(174);
    expect(layers.referenceMaxScale).toBeGreaterThan(0);
    expect(errors, `console errors:\n${errors.join("\n")}`).toEqual([]);
  });

  test("Manchester: click a small area on the map for its card; the measure is in the URL (LP-04, LP-06)", async ({
    page,
  }) => {
    await page.goto("./?m=profiles&lad=E08000003&am=distance");
    await mapReady(page);
    await expect
      .poll(() => viewData(page, "profileAreas"), { timeout: 30_000 })
      .toBe("E08000003:distance:295");
    await expect(kpis(page).getByText("14.1 %")).toBeVisible({ timeout: 20_000 });
    await settled(page);
    // Manchester 018A (Ardwick): its population-weighted centroid, 1.36 km straight-line from a supermarket.
    const p = await toScreen(page, -2.207258, 53.468649);
    await page.mouse.click(p.x, p.y);
    await expect(page).toHaveURL(/sa=E01005061/);
    const card = insights(page).getByRole("region", { name: "Manchester 018A" });
    await expect(card).toBeVisible();
    await expect(card.getByText(/1\.4 km/).first()).toBeVisible();
    await expect.poll(() => viewData(page, "profileSelectedArea")).toBe("E01005061");
  });

  test("click a chart bar to outline its areas on the map (LP-06)", async ({ page }) => {
    await page.goto("./?m=profiles&lad=E08000003");
    await mapReady(page);
    await expect.poll(() => viewData(page, "profileAreas"), { timeout: 30_000 }).toBe("E08000003:ppfi:295");
    const figure = insights(page).locator("figure", {
      has: page.getByText("Priority Places for Food Index (combined)", { exact: true }),
    });
    const canvas = figure.locator(".chart-frame__canvas");
    await canvas.scrollIntoViewIfNeeded();
    await expect(canvas).toBeVisible();
    // Find the decile 1 bar: scan along the bottom of the plot until ECharts shows a pointer.
    const b = (await canvas.boundingBox())!;
    let hit: { x: number; y: number } | null = null;
    for (let x = b.x + 20; x < b.x + b.width / 4 && !hit; x += 3) {
      const y = b.y + b.height - 34;
      await page.mouse.move(x, y);
      const cursor = await canvas.evaluate((el) => getComputedStyle(el.firstElementChild as Element).cursor);
      if (cursor === "pointer") hit = { x, y };
    }
    expect(hit, "no clickable bar found").not.toBeNull();
    await page.mouse.click(hit!.x, hit!.y);
    await expect(insights(page).getByRole("status")).toContainText(
      "Outlined on the map: Priority Places for Food Index (combined): deciles 1–2",
    );
    await expect.poll(() => viewData(page, "profileHighlighted")).toBe("119");
    // The keyboard alternative does the same.
    await insights(page)
      .getByRole("group", { name: "Outline on the map" })
      .nth(1)
      .getByRole("button", { name: /Deciles 3–4/ })
      .click();
    await expect(insights(page).getByRole("status")).toContainText("deciles 3–4");
  });

  test("compare Belfast and Manchester: nation warning, never ranked, comparison dashed (LP-07)", async ({
    page,
  }) => {
    await page.goto("./?m=profiles&lad=N09000003");
    await mapReady(page);
    await controls(page).getByRole("searchbox", { name: "Add a council to compare" }).fill("Manchester");
    await controls(page)
      .getByRole("button", { name: /Manchester.*E08000003/ })
      .click();
    await expect(page).toHaveURL(/cmp=E08000003/);
    await expect
      .poll(async () => (await profileLayers(page)).councilStyles.E08000003, { timeout: 15_000 })
      .toBe("dash");
    await controls(page).getByRole("button", { name: "Open comparison" }).click();
    await expect(page).toHaveURL(/view=compare/);
    await expect(
      page.getByText(/These councils are in different nations \(Northern Ireland, England\)/),
    ).toBeVisible();
    const table = page.getByRole("table", { name: "Council comparison" });
    await expect(table.getByRole("row", { name: /^Small areas in PPFI deciles 1–2/ })).toContainText(
      "40.3 %",
      {
        timeout: 20_000,
      },
    );
    await expect(page.getByText(/never ranked/).first()).toBeVisible();
    const results = await new AxeBuilder({ page }).include("calcite-dialog").analyze();
    const serious = results.violations.filter((v) => v.impact === "serious" || v.impact === "critical");
    expect(serious.map((v) => `${v.id}: ${v.help} (${v.nodes.length})`)).toEqual([]);
    await page.keyboard.press("Escape");
    await expect(page).not.toHaveURL(/view=compare/);
  });

  test("the council stays selected across modules; previous modules still work (LP-01)", async ({ page }) => {
    const errors = trackConsoleErrors(page);
    await page.goto("./?m=profiles&lad=E08000003");
    await mapReady(page);
    await expect(kpis(page).getByText("588,300")).toBeVisible({ timeout: 30_000 });
    const nav = page.getByRole("navigation", { name: "Modules" });
    await nav.getByRole("button", { name: /Access/ }).click();
    await expect(page).toHaveURL(/m=access/);
    await expect(page).toHaveURL(/lad=E08000003/);
    await expect(insights(page).getByRole("region", { name: "Manchester" })).toBeVisible({ timeout: 20_000 });
    await expect.poll(() => viewData(page, "profileAreas")).toBeNull();
    await nav.getByRole("button", { name: /Origins/ }).click();
    await expect(page.getByRole("heading", { level: 1, name: "Food Origins" })).toBeVisible();
    await expect(page.locator(".kpi-card").first()).toHaveAttribute("data-state", "ready", {
      timeout: 30_000,
    });
    await page.goBack();
    await page.goBack();
    await expect(page).toHaveURL(/m=profiles/);
    await expect(insights(page).getByRole("region", { name: "Manchester" })).toBeVisible({ timeout: 20_000 });
    expect(errors, `console errors:\n${errors.join("\n")}`).toEqual([]);
  });

  test("no serious or critical accessibility violations in a profile", async ({ page }) => {
    await page.goto("./?m=profiles&lad=N09000003");
    await mapReady(page);
    await expect(kpis(page).getByText("32.2 %")).toBeVisible({ timeout: 30_000 });
    const results = await new AxeBuilder({ page }).exclude("arcgis-map").analyze();
    const serious = results.violations.filter((v) => v.impact === "serious" || v.impact === "critical");
    expect(serious.map((v) => `${v.id}: ${v.help} (${v.nodes.length})`)).toEqual([]);
  });
});

test.describe("NI grocers from the FSA register (SM-10, John's request)", () => {
  test("shown on request, from regional scale, never counted", async ({ page }) => {
    await page.goto("./?m=access&lad=N09000003");
    await mapReady(page);
    const note = insights(page).getByRole("heading", { name: "Northern Ireland coverage" });
    await expect(note).toBeVisible({ timeout: 30_000 });
    const before = await page.getByRole("region", { name: /UK Food Access key figures/ }).innerText();
    await insights(page)
      .getByRole("button", { name: /Show other NI grocers/ })
      .click();
    await expect(page).toHaveURL(/ng=1/);
    await expect.poll(() => viewData(page, "accessGrocers"), { timeout: 15_000 }).toBe("285");
    const layers = await profileLayers(page);
    expect(layers.grocersMinScale).toBeGreaterThan(2_000_000); // drawn from about zoom 7.5
    expect(layers.grocersMinScale).toBeLessThan(5_000_000);
    // Never part of a count or rate.
    expect(await page.getByRole("region", { name: /UK Food Access key figures/ }).innerText()).toBe(before);
  });
});

test.describe("Local Authority Profiles on mobile (390 × 844)", () => {
  test.use({ viewport: { width: 390, height: 844 }, hasTouch: true });

  test("the profile opens without sideways scrolling", async ({ page }) => {
    await page.goto("./?m=profiles&lad=N09000003");
    await mapReady(page);
    await expect(page.locator(".kpi-card").first()).toHaveAttribute("data-state", "ready", {
      timeout: 30_000,
    });
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
    expect(overflow).toBeLessThanOrEqual(0);
  });
});
