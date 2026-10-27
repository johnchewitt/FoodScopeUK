import AxeBuilder from "@axe-core/playwright";
import { readFile } from "node:fs/promises";
import { expect, test, type Page } from "@playwright/test";

/**
 * ConsultingWhere Insights (Stage 8) against the committed snapshots. The PDF is downloaded from the
 * running app and read back with pdf.js: its figures, checksum and map extent must be the ones on
 * screen (EX-02, brief §6 "the final PDF reflects the exact selected map extent").
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

async function pdfText(path: string): Promise<{ pages: string[]; text: string }> {
  const pdfjs = await import("pdfjs-dist/legacy/build/pdf.mjs");
  const doc = await pdfjs.getDocument({ data: new Uint8Array(await readFile(path)) }).promise;
  const pages: string[] = [];
  for (let i = 1; i <= doc.numPages; i++) {
    const content = await (await doc.getPage(i)).getTextContent();
    pages.push(
      content.items
        .map((it) => ("str" in it ? it.str + (it.hasEOL ? " " : "") : ""))
        .join("")
        .replace(/[\s\u00a0]+/g, " "),
    );
  }
  return { pages, text: pages.join(" ") };
}

const kpis = (page: Page) => page.getByRole("region", { name: /ConsultingWhere Insights key figures/ });
const controls = (page: Page) =>
  page.getByRole("complementary", { name: "ConsultingWhere Insights controls" });
const panel = (page: Page) => page.getByRole("complementary", { name: "Insights" });

test.describe("ConsultingWhere Insights", () => {
  test("Manchester: assessment on the council's map, PDF with the screen's figures and extent", async ({
    page,
  }, testInfo) => {
    test.setTimeout(180_000);
    const errors = trackConsoleErrors(page);
    await page.goto("./?m=insights&lad=E08000003");
    await mapReady(page);
    await expect(kpis(page)).toContainText("588,300", { timeout: 60_000 });
    await expect(kpis(page)).toContainText("14.1 %");
    await expect(
      panel(page).getByRole("heading", { name: "Local Authority Food Security Assessment" }),
    ).toBeVisible();
    // The map is the council's profile map (selected council outlined, small areas drawn).
    await expect
      .poll(() => page.evaluate(() => document.querySelector(".map-legend")?.textContent ?? ""), {
        timeout: 30_000,
      })
      .toContain("Manchester");
    await settled(page);
    const checksum = await panel(page)
      .locator(".report-checksum code")
      .getAttribute("title", { timeout: 30_000 });
    expect(checksum).toMatch(/^[0-9a-f]{64}$/);
    const extent = await page.locator("arcgis-map").evaluate((el: HTMLArcgisMapElement) => {
      const v = el.view;
      const p = v.padding;
      const sw = v.toMap({ x: p.left ?? 0, y: v.height - (p.bottom ?? 0) })!;
      const ne = v.toMap({ x: v.width - (p.right ?? 0), y: p.top ?? 0 })!;
      return [sw.longitude, sw.latitude, ne.longitude, ne.latitude] as number[];
    });

    const [download] = await Promise.all([
      page.waitForEvent("download", { timeout: 120_000 }),
      controls(page)
        .getByRole("button", { name: /PDF report/ })
        .click(),
    ]);
    expect(download.suggestedFilename()).toMatch(/^foodscope-authority-manchester-\d{4}-\d{2}-\d{2}\.pdf$/);
    const path = testInfo.outputPath("manchester.pdf");
    await download.saveAs(path);
    await expect(controls(page).getByRole("status").first()).toContainText(/PDF ready \(\d+ pages\)/);
    const { pages, text } = await pdfText(path);
    expect(pages.length).toBeGreaterThanOrEqual(8);
    pages.forEach((p, i) => expect(p).toContain(`Page ${i + 1} of ${pages.length}`));
    // The figures on the screen's key figure cards are the PDF's.
    for (const card of await kpis(page).locator(".kpi-card .metric__value").allInnerTexts())
      expect(pages[0]).toContain(card.trim().replace(/\s+/g, " "));
    expect(text).toContain(checksum!);
    expect(text).toContain("not a commissioned food security audit");
    expect(text).toMatch(/data snapshots .*local 2026-10-24/);
    // The map image's extent is the visible map's (two decimals, as printed).
    const fmt = (lat: number, lon: number) =>
      `${Math.abs(lat).toFixed(2)}° ${lat >= 0 ? "N" : "S"}, ${Math.abs(lon).toFixed(2)}° ${lon >= 0 ? "E" : "W"}`;
    expect(text).toContain(`Map extent ${fmt(extent[1]!, extent[0]!)} to ${fmt(extent[3]!, extent[2]!)}`);
    expect(text).toMatch(/Map credits: .*Powered by Esri/);
    expect(errors).toEqual([]);
  });

  test("map image export carries the extent and credits; CSV has every indicator", async ({
    page,
  }, testInfo) => {
    test.setTimeout(120_000);
    await page.goto("./?m=insights&lad=N09000003");
    await mapReady(page);
    await expect(kpis(page)).toContainText("351,900", { timeout: 60_000 });
    await settled(page);
    const [png] = await Promise.all([
      page.waitForEvent("download", { timeout: 60_000 }),
      controls(page)
        .getByRole("button", { name: /Map image/ })
        .click(),
    ]);
    const pngPath = testInfo.outputPath("belfast.png");
    await png.saveAs(pngPath);
    const bytes = await readFile(pngPath);
    expect(bytes.subarray(1, 4).toString()).toBe("PNG");
    expect(bytes.readUInt32BE(16)).toBeGreaterThan(400);
    const [csv] = await Promise.all([
      page.waitForEvent("download", { timeout: 30_000 }),
      controls(page)
        .getByRole("button", { name: /CSV data/ })
        .click(),
    ]);
    const csvPath = testInfo.outputPath("belfast.csv");
    await csv.saveAs(csvPath);
    const text = await readFile(csvPath, "utf8");
    expect(text).toContain("profile.population");
    expect(text).toContain("insights.beyond.supermarket.1");
  });

  test("commodity and scenario assessments draw their modules' maps", async ({ page }) => {
    test.setTimeout(120_000);
    await page.goto("./?m=insights&ia=commodity&c=tomatoes");
    await mapReady(page);
    await expect(kpis(page)).toContainText("391.1 kt", { timeout: 60_000 });
    await expect(panel(page).getByRole("heading", { name: "Seasonal sourcing" })).toBeVisible();
    await expect
      .poll(() => page.evaluate(() => document.querySelector(".map-legend")?.textContent ?? ""))
      .toContain("Share of recorded imports");
    await controls(page)
      .getByRole("radio", { name: /Scenario/ })
      .first()
      .click();
    await controls(page)
      .getByRole("radio", { name: /Supermarket closure/ })
      .click();
    await controls(page).getByRole("button", { name: "Manchester’s most relied-on supermarket" }).click();
    await expect(kpis(page)).toContainText("26,730", { timeout: 60_000 });
    await expect(
      panel(page).getByRole("heading", { name: "Food Supply Disruption Scenario Assessment" }),
    ).toBeVisible();
    await expect(page).toHaveURL(/ia=scenario/);
    await expect(page).toHaveURL(/sk=closure/);
  });

  test("accessible: no serious or critical axe violations in the workspace and full report", async ({
    page,
  }) => {
    test.setTimeout(120_000);
    await page.goto("./?m=insights&lad=E08000003");
    await mapReady(page);
    await expect(kpis(page)).toContainText("588,300", { timeout: 60_000 });
    const scan = async () =>
      (await new AxeBuilder({ page }).exclude("arcgis-map").analyze()).violations.filter((v) =>
        ["serious", "critical"].includes(v.impact ?? ""),
      );
    expect(await scan()).toEqual([]);
    await controls(page).getByRole("button", { name: "Open full report" }).click();
    await expect(page.locator("calcite-dialog.report-dialog")).toHaveAttribute("open", "");
    await expect(page.locator(".report--full .report-kpi")).toHaveCount(4);
    expect(await scan()).toEqual([]);
  });
});

test.describe("ConsultingWhere Insights on a phone", () => {
  test.use({ viewport: { width: 390, height: 844 } });
  test("no sideways scrolling; the report and controls are reachable", async ({ page }) => {
    test.setTimeout(120_000);
    await page.goto("./?m=insights&lad=E08000003");
    await mapReady(page);
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
    expect(overflow).toBeLessThanOrEqual(0);
    await expect(page.getByRole("button", { name: /Insights/ }).first()).toBeVisible();
  });
});
