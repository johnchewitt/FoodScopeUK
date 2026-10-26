import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Page } from "@playwright/test";
import { STUB_ATTRIBUTION, stubBasemapStyles } from "./support/basemapStub";

/**
 * Curated basemap choice (SH-08, ADR-0022), run against a build with a placeholder key
 * (`npm run build:e2e-basemap`, project "basemap") and a stubbed Esri styles service. What the
 * real styles look like, and their attribution, are checked on the live site (stage report).
 */

/** Colour sets (src/styles/palette.ts). */
const SEQ = {
  dark: ["#1e7877", "#268e8a", "#2ea39c", "#37baaf", "#3fd1c3", "#49ead8"],
  light: ["#3b9ca7", "#1e8691", "#00717c", "#005d68", "#004954", "#003641"],
};

function trackConsoleErrors(page: Page): string[] {
  const errors: string[] = [];
  page.on("console", (msg) => {
    if (msg.type() !== "error") return;
    // Label glyphs come from Esri's font server, which the CI sandbox may not reach.
    if (msg.location().url.startsWith("https://static.arcgis.com/fonts/")) return;
    errors.push(msg.text());
  });
  page.on("pageerror", (err) => errors.push(err.message));
  return errors;
}

async function ready(page: Page, status: "ready" | "error" = "ready") {
  const host = page.locator(".map-host");
  await expect(host).toHaveAttribute("data-map-state", "ready", { timeout: 45_000 });
  await expect(host).toHaveAttribute("data-basemap-status", status, { timeout: 30_000 });
}

/** The style the basemap controller loaded (`data-basemap-style` on the view's container). */
const styleOnView = (page: Page) =>
  page
    .locator("arcgis-map")
    .evaluate((el: HTMLArcgisMapElement) => el.view.container?.dataset.basemapStyle ?? null);
/** The attribution line (rendered by the map component, inside its shadow root). */
const attribution = (page: Page) => page.locator(".esri-attribution__sources").first();

/** Painted sRGB of the legend swatches (the browser resolves the tokens). */
async function swatches(page: Page): Promise<string[]> {
  return page.locator(".map-legend .swatch[data-class]").evaluateAll((els) => {
    const ctx = document.createElement("canvas").getContext("2d")!;
    return els.map((e) => {
      ctx.clearRect(0, 0, 1, 1);
      ctx.fillStyle = getComputedStyle(e).backgroundColor;
      ctx.fillRect(0, 0, 1, 1);
      const [r, g, b] = ctx.getImageData(0, 0, 1, 1).data;
      return `#${[r, g, b].map((v) => v!.toString(16).padStart(2, "0")).join("")}`;
    });
  });
}

async function partnerFill(page: Page, iso2: string): Promise<string | null> {
  return page.locator("arcgis-map").evaluate((el: HTMLArcgisMapElement, key) => {
    const layer = el.view.map!.layers.find((l) => l.id === "origins-partners") as unknown as {
      renderer?: {
        uniqueValueInfos: { value: string; symbol: { color: { r: number; g: number; b: number } } }[];
      };
    };
    const info = layer.renderer?.uniqueValueInfos.find((i) => i.value === key);
    if (!info) return null;
    const c = info.symbol.color;
    return `#${[c.r, c.g, c.b].map((v) => v.toString(16).padStart(2, "0")).join("")}`;
  }, iso2);
}

async function zoomTo(page: Page, lon: number, lat: number, zoom: number) {
  await page
    .locator("arcgis-map")
    .evaluate(
      (el: HTMLArcgisMapElement, [x, y, z]: [number, number, number]) =>
        el.view.goTo({ center: [x, y], zoom: z }, { animate: false }),
      [lon, lat, zoom] as [number, number, number],
    );
}

/** Styles in the order they were requested, repeats of the same style collapsed (the SDK may retry). */
const runs = (list: string[]) => list.filter((s, i) => s !== list[i - 1]);

const control = (page: Page) => page.getByRole("button", { name: /^Basemap: .*Change basemap$/ });

test.describe("Basemap choice", () => {
  test("switching to light grey changes the basemap, its attribution, the legend and the data colours", async ({
    page,
  }) => {
    const errors = trackConsoleErrors(page);
    const requested = await stubBasemapStyles(page);
    await page.goto("./");
    await ready(page);
    await expect.poll(() => partnerFill(page, "NL")).toBe(SEQ.dark[4]); // tomatoes: 43.8 % → 25–50 %
    await expect.poll(() => styleOnView(page)).toBe("dark");
    await expect(attribution(page)).toContainText(STUB_ATTRIBUTION("dark-gray"));

    await control(page).click();
    await page.getByRole("radio", { name: /Light grey/ }).check();
    await expect(page).toHaveURL(/bm=light/);
    await ready(page);
    await expect.poll(() => styleOnView(page)).toBe("light");
    expect(runs(requested)).toEqual(["dark-gray", "light-gray"]);
    await expect(page.locator(".app")).toHaveAttribute("data-map-style", "light");
    await expect(attribution(page)).toContainText(STUB_ATTRIBUTION("light-gray"));
    await expect(attribution(page)).not.toContainText(STUB_ATTRIBUTION("dark-gray"));
    await expect.poll(() => partnerFill(page, "NL")).toBe(SEQ.light[4]);
    expect(await partnerFill(page, "TR")).toBe(SEQ.light[0]);
    const painted = await swatches(page);
    painted.forEach((hex, i) => {
      const a = [1, 3, 5].map((j) => parseInt(hex.slice(j, j + 2), 16));
      const b = [1, 3, 5].map((j) => parseInt(SEQ.light[i]!.slice(j, j + 2), 16));
      a.forEach((v, j) => expect(Math.abs(v - b[j]!), `class ${i}: ${hex}`).toBeLessThanOrEqual(1));
    });
    // Kept across module changes.
    await page
      .getByRole("navigation", { name: "Modules" })
      .getByRole("button", { name: /Seasonal/ })
      .click();
    await expect(page).toHaveURL(/m=seasonal.*bm=light|bm=light.*m=seasonal/);
    await expect.poll(() => styleOnView(page)).toBe("light");
    expect(errors, `console errors:\n${errors.join("\n")}`).toEqual([]);
  });

  test("a deep link with bm=light restores the style", async ({ page }) => {
    const requested = await stubBasemapStyles(page);
    await page.goto("./?m=access&bm=light");
    await ready(page);
    await expect.poll(() => styleOnView(page)).toBe("light");
    expect(runs(requested)).toEqual(["light-gray"]);
    await expect(page.locator(".map-host")).toHaveAttribute("data-map-style", "light");
    await expect(attribution(page)).toContainText(STUB_ATTRIBUTION("light-gray"));
  });

  test("imagery is offered only at local scale in UK Food Access", async ({ page }) => {
    const requested = await stubBasemapStyles(page);
    await page.goto("./");
    await ready(page);
    await control(page).click();
    await expect(page.getByRole("radio", { name: /Imagery/ })).toBeDisabled();
    await expect(page.getByText("Imagery is offered in UK Food Access at local scale.")).toBeVisible();

    await page.goto("./?m=access");
    await ready(page);
    await control(page).click();
    await expect(page.getByRole("radio", { name: /Imagery/ })).toBeDisabled();
    await zoomTo(page, -2.2426, 53.4808, 13);
    await expect(page.getByRole("radio", { name: /Imagery/ })).toBeEnabled();
    await page.getByRole("radio", { name: /Imagery/ }).check();
    await expect(page).toHaveURL(/bm=imagery/);
    await expect.poll(() => styleOnView(page)).toBe("imagery");
    await ready(page);
    await expect(attribution(page)).toContainText(STUB_ATTRIBUTION("imagery"));
    // Zooming out keeps the choice but shows dark grey until local scale again.
    await zoomTo(page, -2.5, 54, 6);
    await expect.poll(() => styleOnView(page)).toBe("dark");
    await expect(page).toHaveURL(/bm=imagery/);
    const beforeZoomIn = requested.length;
    await zoomTo(page, -2.2426, 53.4808, 13);
    await expect.poll(() => styleOnView(page)).toBe("imagery");
    // Up to the zoom back in: two page loads on dark grey, then imagery, then dark grey when zoomed
    // out (never imagery while zoomed out).
    expect(runs(requested.slice(0, beforeZoomIn))).toEqual(["dark-gray", "imagery", "dark-gray"]);
    // Back at local scale the view shows imagery (asserted above). It may reuse the imagery style it
    // already loaded, so a new request is not guaranteed (B49), but no other style is requested.
    expect(requested.slice(beforeZoomIn).every((s) => s === "imagery")).toBe(true);
  });

  test("a style that fails falls back to the outline map and the dark colour set", async ({ page }) => {
    await stubBasemapStyles(page, { fail: ["light-gray"] });
    await page.goto("./?bm=light");
    await ready(page, "error");
    await expect(page.locator(".app")).toHaveAttribute("data-map-style", "dark");
    await expect.poll(() => partnerFill(page, "NL")).toBe(SEQ.dark[4]);
    await expect(
      page.getByRole("complementary", { name: "Insights" }).getByText(/basemap could not be loaded/),
    ).toBeVisible();
  });

  for (const bm of ["dark", "light"] as const)
    test(`no serious or critical accessibility violations on ${bm} grey`, async ({ page }) => {
      await stubBasemapStyles(page);
      await page.goto(`./?m=access&lad=E08000003${bm === "light" ? "&bm=light" : ""}`);
      await ready(page);
      await expect(page.locator(".kpi-card").first()).toHaveAttribute("data-state", "ready", {
        timeout: 30_000,
      });
      const results = await new AxeBuilder({ page }).exclude("arcgis-map").analyze();
      const serious = results.violations.filter((v) => v.impact === "serious" || v.impact === "critical");
      expect(serious.map((v) => `${v.id}: ${v.help} (${v.nodes.length})`)).toEqual([]);
    });
});
