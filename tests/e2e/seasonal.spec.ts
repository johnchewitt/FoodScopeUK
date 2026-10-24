import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Page } from "@playwright/test";

/**
 * Seasonal Supply explorer (Stage 3) against the real committed HMRC snapshot 2026-10-23.
 * Expected values were computed independently from the snapshot in Python (stage 3 report).
 */

function trackConsoleErrors(page: Page): string[] {
  const errors: string[] = [];
  page.on("console", (msg) => {
    if (msg.type() === "error") errors.push(msg.text());
  });
  page.on("pageerror", (err) => errors.push(err.message));
  return errors;
}

/** What the trade layers draw right now, read from the ArcGIS view (not from React). */
async function mapInfo(page: Page) {
  return page.locator("arcgis-map").evaluate((el: HTMLArcgisMapElement) => {
    const layers = el.view.map!.layers;
    const partners = layers.find((l) => l.id === "origins-partners") as unknown as {
      visible: boolean;
      renderer: {
        uniqueValueInfos: {
          value: string;
          symbol: { color: { r: number; g: number; b: number; a: number } };
        }[];
      };
    };
    const flows = layers.find((l) => l.id === "origins-flows") as unknown as {
      graphics: {
        length: number;
        toArray(): {
          attributes: { key: string; targetWidth?: number };
          symbol: { data?: { symbol: { symbolLayers: { width: number }[] } } };
        }[];
      };
    };
    const canvas = el.view.container?.querySelector<HTMLCanvasElement>("canvas.flow-particles");
    const infos = partners?.renderer?.uniqueValueInfos ?? [];
    const graphics = flows?.graphics?.toArray() ?? [];
    return {
      visible: partners?.visible ?? false,
      /** Fill colour per partner as #rrggbb plus its opacity. */
      fill: Object.fromEntries(
        infos.map((i) => {
          const c = i.symbol.color;
          const hex = `#${[c.r, c.g, c.b].map((v) => v.toString(16).padStart(2, "0")).join("")}`;
          return [i.value, c.a === 1 ? hex : `${hex}@${c.a}`];
        }),
      ),
      rendererBuilds: Number(el.view.container?.dataset.partnerRendererBuilds ?? 0),
      flows: graphics.length,
      width: Object.fromEntries(
        graphics
          .filter((g) => g.attributes.key !== "__uk")
          .map((g) => [g.attributes.key, g.symbol.data?.symbol.symbolLayers[0]?.width ?? null]),
      ),
      target: Object.fromEntries(
        graphics
          .filter((g) => g.attributes.key !== "__uk")
          .map((g) => [g.attributes.key, g.attributes.targetWidth]),
      ),
      particles: canvas && !canvas.hidden ? Number(canvas.dataset.particles ?? 0) : 0,
      /** Width transitions started by the map controller, and whether one is running. */
      transitions: Number(el.view.container?.dataset.flowTransitions ?? 0),
      transition: el.view.container?.dataset.flowTransition ?? "idle",
    };
  });
}

async function waitForSeasonal(page: Page) {
  await expect(page.locator(".map-host[data-map-state]")).toHaveAttribute("data-map-state", "ready", {
    timeout: 45_000,
  });
  await expect(page.locator(".kpi-card").first()).toHaveAttribute("data-state", "ready", { timeout: 20_000 });
  await expect(page.getByRole("slider", { name: /^Month, \d{4}$/ })).toBeVisible();
}

const kpi = (page: Page, label: string | RegExp) => page.getByRole("article", { name: label });
/**
 * Share-class fills: the opaque --fs-seq-* tokens (src/styles/palette.ts), identical to the legend
 * swatches and the heatmap cells.
 */
const SHARE_CLASS_HEX = ["#1e7877", "#268e8a", "#2ea39c", "#37baaf", "#3fd1c3", "#49ead8"];
const fillFor = (cls: number) => SHARE_CLASS_HEX[cls];
/** Fixed width scale: 12 px = 24,806.216 t (Netherlands, Jul 2026), linear from 1.5 px. */
const widthFor = (tonnes: number) => 1.5 + (10.5 * tonnes) / 24_806.216;

async function clickMonth(page: Page, month: number) {
  const box = await page
    .locator(".season-tl__col")
    .nth(month - 1)
    .boundingBox();
  await page.mouse.click(box!.x + box!.width / 2, box!.y + box!.height / 2);
}

test.describe("Seasonal Supply explorer", () => {
  test("January 2025: real figures on cards, timeline, heatmap and map", async ({ page }) => {
    const errors = trackConsoleErrors(page);
    await page.goto("./?m=seasonal&y=2025&mo=1");
    await waitForSeasonal(page);
    await expect(kpi(page, "Recorded imports · Jan 2025")).toContainText("33.1 kt");
    await expect(kpi(page, "Change vs Jan 2024")).toContainText("−9.0 %");
    await expect(kpi(page, "Top recorded partner")).toContainText("42.5 %");
    await expect(kpi(page, "Top recorded partner")).toContainText("Morocco");
    await expect(kpi(page, "Monthly concentration (HHI)")).toContainText("2,740");
    await expect(page.getByRole("slider", { name: "Month, 2025" })).toHaveAttribute(
      "aria-valuetext",
      "January 2025: 33.1 kt recorded imports",
    );
    await expect(
      page.getByRole("table", { name: /Tomatoes recorded import partners by month, 2025/ }),
    ).toBeVisible();

    await expect.poll(() => mapInfo(page).then((i) => i.flows), { timeout: 20_000 }).toBe(13);
    const info = await mapInfo(page);
    expect(info.visible).toBe(true);
    expect(info.fill.MA).toBe(fillFor(4)); // Morocco 42.5 % → 25–50 %
    expect(info.fill.NL).toBe(fillFor(3)); // Netherlands 20.4 % → 10–25 %
    // At rest every connection is drawn at exactly its model width (fixed scale).
    expect(info.width.MA).toBeCloseTo(widthFor(14_056.585), 4);
    for (const [k, w] of Object.entries(info.width)) expect(w, k).toBeCloseTo(info.target[k]!, 6);
    await expect.poll(() => mapInfo(page).then((i) => i.particles)).toBeGreaterThanOrEqual(12);
    expect(errors, `console errors:\n${errors.join("\n")}`).toEqual([]);
  });

  test("moving the slider updates map symbology, connection widths, cards and charts", async ({ page }) => {
    await page.goto("./?m=seasonal&y=2025&mo=1");
    await waitForSeasonal(page);
    await expect.poll(() => mapInfo(page).then((i) => i.flows), { timeout: 20_000 }).toBe(13);
    const before = (await mapInfo(page)).width.NL!;

    const started = (await mapInfo(page)).transitions;
    await clickMonth(page, 7);
    // The widths ease from January's to July's values (≤ 0.35 s) and end exactly at July's.
    await expect.poll(() => mapInfo(page).then((i) => i.transitions)).toBe(started + 1);
    await expect.poll(() => mapInfo(page).then((i) => i.transition)).toBe("idle");
    const after = widthFor(21_163.862);
    expect(after).toBeGreaterThan(before + 1);
    const settled = await mapInfo(page);
    expect(settled.width.NL).toBeCloseTo(after, 4);
    for (const [k, w] of Object.entries(settled.width)) expect(w, k).toBeCloseTo(settled.target[k]!, 6);

    await expect(page).toHaveURL(/\?m=seasonal&y=2025&mo=7$/);
    await expect(kpi(page, "Recorded imports · Jul 2025")).toContainText("33.2 kt");
    await expect(kpi(page, "Change vs Jul 2024")).toContainText("+2.2 %");
    await expect(kpi(page, "Top recorded partner")).toContainText("Netherlands");
    await expect(kpi(page, "Top recorded partner")).toContainText("63.8 %");
    await expect(kpi(page, "Monthly concentration (HHI)")).toContainText("4,680");
    expect((await mapInfo(page)).fill.NL).toBe(fillFor(5)); // 63.8 % → ≥ 50 %
    await expect(
      page.locator("#insights-panel").getByRole("heading", { name: "Tomatoes · Jul 2025" }),
    ).toBeVisible();
    await expect(page.locator(".partner-table tbody tr").first()).toContainText("Netherlands");
  });

  test("keyboard: arrows move the month, Page Up/Down the year, Space plays", async ({ page }) => {
    await page.goto("./?m=seasonal&y=2025&mo=1");
    await waitForSeasonal(page);
    const slider = page.getByRole("slider", { name: "Month, 2025" });
    await slider.focus();
    await page.keyboard.press("ArrowRight");
    await expect(page).toHaveURL(/mo=2/);
    await page.keyboard.press("End");
    await expect(page).toHaveURL(/mo=12/);
    await page.keyboard.press("PageDown");
    await expect(page).toHaveURL(/y=2024&mo=12/);
    await page.keyboard.press("Home");
    await page.getByRole("slider", { name: "Month, 2024" }).press(" ");
    await expect(page.getByRole("button", { name: "Pause" })).toBeVisible();
    await expect(page).toHaveURL(/y=2024&mo=2/, { timeout: 5_000 });
    await page.getByRole("button", { name: "Pause" }).click();
    const url = page.url();
    await page.waitForTimeout(1_600);
    expect(page.url()).toBe(url);
  });

  test("play/pause and speed: plays to the latest published month and stops; restarts in January", async ({
    page,
  }) => {
    await page.goto("./?m=seasonal&y=2026&mo=6");
    await waitForSeasonal(page);
    await page.getByRole("radio", { name: /2× speed/ }).click();
    await page.getByRole("button", { name: "Play through 2026" }).click();
    await expect(page).toHaveURL(/mo=7/, { timeout: 3_000 });
    await expect(page).toHaveURL(/mo=8/, { timeout: 3_000 });
    // August 2026 is the latest month HMRC has published: playback stops there.
    await expect(page.getByRole("button", { name: "Play through 2026" })).toBeVisible({ timeout: 3_000 });
    await page.waitForTimeout(1_000);
    await expect(page).toHaveURL(/mo=8/);
    await page.getByRole("button", { name: "Play through 2026" }).click();
    await expect(page).toHaveURL(/mo=1/);
    // A user change to the month stops playback (SS-03).
    await clickMonth(page, 4);
    await expect(page.getByRole("button", { name: "Play through 2026" })).toBeVisible();
    await expect(page).toHaveURL(/mo=4/);
  });

  test("an unpublished month draws nothing, says why, and is hatched", async ({ page }) => {
    await page.goto("./?m=seasonal&y=2026&mo=10");
    await expect(page.locator(".map-host[data-map-state]")).toHaveAttribute("data-map-state", "ready", {
      timeout: 45_000,
    });
    await expect(page.locator(".map-banner")).toContainText(
      "Oct 2026 is not yet published by HMRC (latest: Aug 2026).",
    );
    for (const card of await page.locator(".kpi-card").all())
      await expect(card).toContainText("Not published");
    await expect.poll(() => mapInfo(page).then((i) => i.flows), { timeout: 20_000 }).toBe(1); // UK point only
    const info = await mapInfo(page);
    expect(Object.keys(info.fill)).toEqual([]);
    expect(info.particles).toBe(0);
    await expect(page.locator('.season-tl__col[data-state="not_yet_published"]')).toHaveCount(4);
    await expect(page.locator('.heatmap__cell[data-kind="gap"]').first()).toBeVisible();
  });

  test("reduced motion: widths change instantly and no markers move", async ({ page }) => {
    await page.emulateMedia({ reducedMotion: "reduce" });
    await page.goto("./?m=seasonal&y=2025&mo=1");
    await waitForSeasonal(page);
    await expect.poll(() => mapInfo(page).then((i) => i.flows), { timeout: 20_000 }).toBe(13);
    await clickMonth(page, 7);
    await expect(page).toHaveURL(/mo=7/);
    await expect.poll(() => mapInfo(page).then((i) => i.width.NL)).toBeCloseTo(widthFor(21_163.862), 4);
    const info = await mapInfo(page);
    expect(info.transitions).toBe(0); // widths jump straight to the new month
    expect(info.particles).toBe(0);
  });

  test("heatmap: change view, cell click moves the month; comparison months", async ({ page }) => {
    await page.goto("./?m=seasonal&y=2025&mo=7");
    await waitForSeasonal(page);
    await page.getByRole("radio", { name: "Change vs 2024" }).click();
    await expect(page).toHaveURL(/hm=change/);
    await expect(page.getByRole("list", { name: "Heatmap legend" })).toContainText("−1 to +1 pp");
    const row = page.locator(".heatmap__table tbody tr").filter({ hasText: "Morocco" });
    await row.locator("td").nth(2).click(); // March
    await expect(page).toHaveURL(/mo=3/);
    await page.getByLabel("Compare month").selectOption("7");
    await expect(page).toHaveURL(/cm=7/);
    await expect(page.locator('.season-tl__col[data-compare="true"]')).toHaveCount(1);
    await expect(page.getByRole("heading", { name: "Compare months · Mar vs Jul 2025" })).toBeVisible();
  });

  test("no serious or critical accessibility violations", async ({ page }) => {
    await page.goto("./?m=seasonal&y=2025&mo=1&cm=7");
    await waitForSeasonal(page);
    const results = await new AxeBuilder({ page }).exclude("arcgis-map").analyze();
    const serious = results.violations.filter((v) => v.impact === "serious" || v.impact === "critical");
    expect(serious.map((v) => `${v.id}: ${v.help} (${v.nodes.length})`)).toEqual([]);
  });
});

test.describe("Seasonal Supply on mobile (390 × 844)", () => {
  test.use({ viewport: { width: 390, height: 844 }, hasTouch: true });

  test("timeline, cards and panels work without horizontal scrolling", async ({ page }, info) => {
    await page.goto("./?m=seasonal&y=2025&mo=1");
    await waitForSeasonal(page);
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
    expect(overflow).toBeLessThanOrEqual(0);
    await expect(page.getByRole("button", { name: "Play through 2025" })).toBeVisible();
    const tl = await page.locator(".timeline--seasonal").boundingBox();
    expect(tl!.x).toBeGreaterThanOrEqual(0);
    expect(tl!.x + tl!.width).toBeLessThanOrEqual(390);
    // Tap a month on the track.
    const box = await page.locator(".season-tl__col").nth(6).boundingBox();
    await page.touchscreen.tap(box!.x + box!.width / 2, box!.y + box!.height / 2);
    await expect(page).toHaveURL(/mo=7/);
    await expect(kpi(page, "Recorded imports · Jul 2025")).toContainText("33.2 kt");
    await page.screenshot({ path: info.outputPath("seasonal-mobile-390.png") });

    // Insights bottom sheet with the heatmap, then the controls sheet.
    await page
      .getByRole("button", { name: /Insights/ })
      .first()
      .click();
    await expect(page.locator("#insights-panel")).toHaveAttribute("data-open", "true");
    await expect(page.getByRole("table", { name: /recorded import partners by month/ })).toBeVisible();
    const sheet = await page.locator("#insights-panel").boundingBox();
    expect(sheet!.width).toBeLessThanOrEqual(390);
    await page.screenshot({ path: info.outputPath("seasonal-mobile-390-insights.png") });
    await page
      .getByRole("button", { name: /Controls/ })
      .first()
      .click();
    await expect(page.locator("#filter-panel")).toHaveAttribute("data-open", "true");
    await expect(page.getByLabel("Compare month")).toBeVisible();
    const overflowAfter = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
    expect(overflowAfter).toBeLessThanOrEqual(0);
  });
});
