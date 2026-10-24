import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Page } from "@playwright/test";

/**
 * UK Food Access (Stage 4) against the real committed local snapshot 2026-10-24 (GEOLYTIX v46,
 * ONS mid-2025, May 2025 councils). Expected values are the reconciled figures used in
 * src/features/access/model.test.ts and recomputed in Python for the stage report.
 */

const NOTE =
  "Store counts and distances describe physical provision only; they do not measure affordability, choice or nutritional access.";

/** Dark grey colour set (src/styles/palette.ts). */
const SEQ_DARK = ["#1e7877", "#268e8a", "#2ea39c", "#37baaf", "#3fd1c3", "#49ead8"];

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

async function ready(page: Page) {
  await expect(page.locator(".map-host[data-map-state]")).toHaveAttribute("data-map-state", "ready", {
    timeout: 45_000,
  });
  await expect(page.locator(".kpi-card").first()).toHaveAttribute("data-state", "ready", { timeout: 30_000 });
  await expect.poll(() => viewData(page, "accessCouncils"), { timeout: 30_000 }).toMatch(/fills|outlines/);
}

/** The parts of the access layers the tests read (structural types; the SDK is not imported here). */
interface InspectedLayers {
  definitionExpression?: string | null;
  queryFeatureCount(q: { where: string }): Promise<number>;
  featureReduction?: { type: string; maxScale: number } | null;
  renderer?: {
    uniqueValueInfos: {
      value: string;
      symbol: { style: string; color: { r: number; g: number; b: number } };
    }[];
  };
  graphics: { toArray(): { attributes: { kind: string } }[] };
}

async function mapLayers(page: Page) {
  return page.locator("arcgis-map").evaluate(async (el: HTMLArcgisMapElement) => {
    const view = el.view;
    const find = (id: string) =>
      view.map!.layers.find((l) => l.id === id) as unknown as InspectedLayers | undefined;
    const stores = find("access-stores");
    const councils = find("access-councils");
    const overlay = find("access-overlay");
    const fills: Record<string, string> = {};
    for (const i of councils?.renderer?.uniqueValueInfos ?? []) {
      const c = i.symbol.color;
      fills[i.value] =
        `#${[c.r, c.g, c.b].map((v) => v.toString(16).padStart(2, "0")).join("")}` +
        (i.symbol.style === "solid" ? "" : `/${i.symbol.style}`);
    }
    const where = stores?.definitionExpression ?? null;
    return {
      where,
      shown: stores ? await stores.queryFeatureCount({ where: where ?? "1=1" }) : null,
      cluster: stores?.featureReduction
        ? { type: stores.featureReduction.type, maxScale: stores.featureReduction.maxScale }
        : null,
      fills,
      overlay: overlay ? overlay.graphics.toArray().map((g) => g.attributes.kind) : [],
      zoom: view.zoom,
    };
  });
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

async function goTo(page: Page, lon: number, lat: number, zoom: number) {
  await page
    .locator("arcgis-map")
    .evaluate(
      (el: HTMLArcgisMapElement, [x, y, z]: [number, number, number]) =>
        el.view.goTo({ center: [x, y], zoom: z }, { animate: false }),
      [lon, lat, zoom] as [number, number, number],
    );
  await page.locator("arcgis-map").evaluate(
    (el: HTMLArcgisMapElement) =>
      new Promise<void>((resolve) => {
        const check = () => (el.view.stationary && !el.view.updating ? resolve() : setTimeout(check, 100));
        check();
      }),
  );
}

test.describe("UK Food Access", () => {
  test("opens on supermarkets: counts, clusters and choropleth classes match the data", async ({ page }) => {
    const errors = trackConsoleErrors(page);
    await page.goto("./?m=access");
    await ready(page);
    const kpis = page.getByRole("region", { name: /UK Food Access key figures/ });
    await expect(kpis.getByText("7,193")).toBeVisible();
    await expect(kpis.getByText("1.03")).toBeVisible();
    // SM-10 on the map and in the panel.
    await expect(page.locator(".provision-note")).toHaveText(NOTE);
    await expect(page.getByRole("complementary", { name: "Insights" }).getByText(NOTE)).toBeVisible();

    // Opens framed on the mapped stores, not the world view: Shetland, Jersey and Belfast in view.
    await expect.poll(async () => (await mapLayers(page)).zoom, { timeout: 15_000 }).toBeGreaterThan(4);
    const size = page.viewportSize()!;
    for (const [lon, lat] of [
      [-1.145, 60.155], // Lerwick
      [-2.105, 49.185], // St Helier
      [-5.93, 54.597], // Belfast
    ] as [number, number][]) {
      const p = await toScreen(page, lon, lat);
      expect(p.x).toBeGreaterThan(0);
      expect(p.x).toBeLessThan(size.width);
      expect(p.y).toBeGreaterThan(0);
      expect(p.y).toBeLessThan(size.height);
    }

    const m = await mapLayers(page);
    expect(m.where).toBe("layer IN ('supermarket')");
    expect(m.shown).toBe(7_193); // the layer itself holds what the card says
    expect(m.cluster?.type).toBe("cluster");
    expect(m.cluster?.maxScale).toBeGreaterThan(144_000); // individual from local scale (zoom 12)
    // Hand-computed classes (model.test.ts): Hartlepool 1.20 → class 4; Manchester and Belfast.
    expect(m.fills.E06000001).toBe(SEQ_DARK[4]);
    expect(m.fills.E08000003).toBe(SEQ_DARK[await classOf(page, "E08000003")]);
    expect(m.fills.N09000003).toBe(SEQ_DARK[await classOf(page, "N09000003")]);
    expect(Object.keys(m.fills)).toHaveLength(361);
    expect(errors, `console errors:\n${errors.join("\n")}`).toEqual([]);
  });

  test("filters change the map's where clause; the layer's counts match the cards (SM-03)", async ({
    page,
  }) => {
    await page.goto("./?m=access");
    await ready(page);
    const controls = page.getByRole("complementary", { name: "UK Food Access controls" });
    const kpis = page.getByRole("region", { name: /UK Food Access key figures/ });
    await controls.getByRole("checkbox", { name: /Convenience stores/ }).check();
    await expect(kpis.getByText("17,915")).toBeVisible();
    await expect
      .poll(async () => (await mapLayers(page)).where)
      .toBe("layer IN ('convenience', 'supermarket')");
    expect((await mapLayers(page)).shown).toBe(17_915);
    await controls.getByRole("button", { name: "None" }).click();
    await expect.poll(async () => (await mapLayers(page)).where).toBe("1=0");
    await controls.getByRole("checkbox", { name: /^Aldi/ }).check();
    await expect(page).toHaveURL(/rt=Aldi/);
    await expect
      .poll(async () => (await mapLayers(page)).where)
      .toBe("layer IN ('convenience', 'supermarket') AND retailer IN ('Aldi')");
    expect((await mapLayers(page)).shown).toBe(1_085); // 1,084 supermarkets + 1 convenience
    await expect(kpis.getByText("1,085")).toBeVisible();
  });

  test("councils are shaded nationally and outlined at local scale, where stores are individual", async ({
    page,
  }) => {
    await page.goto("./?m=access");
    await ready(page);
    await goTo(page, -2.2426, 53.4808, 13);
    await expect.poll(() => viewData(page, "accessCouncils")).toBe("outlines");
    await goTo(page, -2.5, 54, 6);
    await expect.poll(() => viewData(page, "accessCouncils")).toBe("fills");
    await page.getByRole("radio", { name: "Off" }).click();
    await expect(page).toHaveURL(/cl=off/);
    await expect.poll(() => viewData(page, "accessCouncils")).toBe("outlines");
  });

  test("click a store for its card; choose a point for straight-line proximity (SM-05, SM-07)", async ({
    page,
  }) => {
    await page.goto("./?m=access");
    await ready(page);
    // Dunnes Belfast - Cornmarket (GEOLYTIX id 1010016062).
    const [lon, lat] = await storeLonLat(page, 1010016062);
    await goTo(page, lon, lat, 17);
    const p = await toScreen(page, lon, lat);
    await page.mouse.click(p.x, p.y);
    await expect(page).toHaveURL(/st=1010016062/);
    const card = page.getByRole("region", { name: /Dunnes Belfast - Cornmarket/ });
    await expect(card).toBeVisible();
    await expect(card.getByText("Belfast", { exact: true })).toBeVisible();
    await expect.poll(async () => (await mapLayers(page)).overlay).toEqual(["selected-store"]);

    await page.getByRole("button", { name: "Choose a point" }).click();
    await expect(page.locator(".map-host arcgis-map")).toBeVisible();
    const q = await toScreen(page, lon + 0.002, lat + 0.001);
    await page.mouse.click(q.x, q.y);
    const nearby = page
      .getByRole("complementary", { name: "Insights" })
      .getByRole("region", { name: "Straight-line proximity" });
    await expect(nearby.getByText(/straight-line distance of the point/)).toBeVisible();
    await expect(
      nearby.getByRole("list", { name: "Nearest 5 stores shown" }).getByRole("button"),
    ).toHaveCount(5);
    await expect(nearby.getByText(/Irish Transverse Mercator/)).toBeVisible();
    await expect
      .poll(async () => (await mapLayers(page)).overlay)
      .toEqual([
        "proximity-ring",
        "proximity-line",
        "proximity-line",
        "proximity-line",
        "proximity-line",
        "proximity-line",
        "proximity-point",
        "selected-store",
      ]);
    // The store click did not also select (picking ends after one point).
    await expect(page).toHaveURL(/st=1010016062/);
  });

  test("density table selects and fits a council (SM-08, SM-09)", async ({ page }) => {
    await page.goto("./?m=access&cl=a");
    await ready(page);
    const insights = page.getByRole("complementary", { name: "Insights" });
    await insights.getByLabel("Nation").selectOption("Northern Ireland");
    await insights.getByRole("button", { name: "Belfast", exact: true }).click();
    await expect(page).toHaveURL(/lad=N09000003/);
    await expect(insights.getByRole("region", { name: "Belfast" })).toBeVisible();
    await expect(insights.getByRole("rowheader", { name: "Belfast" }).first()).toBeVisible();
    await expect.poll(async () => (await mapLayers(page)).zoom, { timeout: 15_000 }).toBeGreaterThan(9);
  });

  test("no basemap control without a key; no serious or critical accessibility violations", async ({
    page,
  }) => {
    await page.goto("./?m=access&lad=E08000003");
    await ready(page);
    await expect(page.locator(".basemap-control")).toHaveCount(0);
    const results = await new AxeBuilder({ page }).exclude("arcgis-map").analyze();
    const serious = results.violations.filter((v) => v.impact === "serious" || v.impact === "critical");
    expect(serious.map((v) => `${v.id}: ${v.help} (${v.nodes.length})`)).toEqual([]);
  });
});

test.describe("UK Food Access on mobile (390 × 844)", () => {
  test.use({ viewport: { width: 390, height: 844 }, hasTouch: true });

  test("the provision note stays visible and nothing scrolls sideways", async ({ page }) => {
    await page.goto("./?m=access");
    await expect(page.locator(".map-host[data-map-state]")).toHaveAttribute("data-map-state", "ready", {
      timeout: 45_000,
    });
    await expect(page.locator(".provision-note")).toBeVisible();
    await expect(page.locator(".provision-note")).toBeInViewport();
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
    expect(overflow).toBeLessThanOrEqual(0);
  });
});

/** The class the app assigned a council (from its own legend data), for the colour check. */
async function classOf(page: Page, code: string): Promise<number> {
  return page.evaluate(async (c) => {
    const base = document.querySelector("base")?.href ?? location.href;
    const doc = await (
      await fetch(new URL("data/snapshots/2026-10-24/local/lad-indicators.json", base))
    ).json();
    const council = doc.councils.find((x: { code: string }) => x.code === c);
    const groups = doc.stores.groups as { sizeBand: string; format: string }[];
    const bands = new Map(
      (doc.stores.sizeBands as { id: string; storeClass: string }[]).map((b) => [b.id, b.storeClass]),
    );
    const n = (council.stores as number[]).reduce(
      (a, v, i) =>
        a + (bands.get(groups[i]!.sizeBand) === "supermarket" && groups[i]!.format === "standard" ? v : 0),
      0,
    );
    const rate = (n / council.population) * 10_000;
    return [0.7, 0.85, 1, 1.15, 1.3].filter((b) => rate >= b).length;
  }, code);
}

async function storeLonLat(page: Page, id: number): Promise<[number, number]> {
  return page.evaluate(async (storeId) => {
    const url = new URL("data/snapshots/2026-10-24/local/stores.geojson", location.href.replace(/\?.*$/, ""));
    const fc = await (await fetch(url)).json();
    const f = fc.features.find((x: { id: number }) => x.id === storeId);
    return f.geometry.coordinates as [number, number];
  }, id);
}

test.describe("UK Food Access loading order", () => {
  test("draws the layers when the stores arrive after the map is ready", async ({ page }) => {
    await page.route("**/data/snapshots/*/local/stores.geojson", async (route) => {
      await new Promise((r) => setTimeout(r, 6_000));
      await route.continue();
    });
    const errors = trackConsoleErrors(page);
    await page.goto("./?m=access&lad=E08000003");
    await expect(page.locator(".map-host[data-map-state]")).toHaveAttribute("data-map-state", "ready", {
      timeout: 45_000,
    });
    await ready(page);
    await expect(page.locator(".provision-note")).toBeVisible();
    await expect(page.getByText(/stopped working/)).toHaveCount(0);
    expect((await mapLayers(page)).shown).toBe(7_193);
    expect(errors, `console errors:\n${errors.join("\n")}`).toEqual([]);
  });
});
