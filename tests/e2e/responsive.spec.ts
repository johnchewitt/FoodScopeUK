import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "@playwright/test";

const VIEWPORTS = [
  { name: "desktop-1920", width: 1920, height: 1080 },
  { name: "laptop-1366", width: 1366, height: 768 },
  { name: "tablet-1024", width: 1024, height: 768 },
  { name: "tablet-portrait-820", width: 820, height: 1180 },
  { name: "tablet-portrait-800", width: 800, height: 1086 },
  { name: "mobile-390", width: 390, height: 844 },
];

for (const vp of VIEWPORTS) {
  test(`layout at ${vp.name}`, async ({ page }, info) => {
    await page.setViewportSize({ width: vp.width, height: vp.height });
    await page.goto("./");
    await expect(page.locator(".map-host[data-map-state]")).toHaveAttribute("data-map-state", "ready", {
      timeout: 45_000,
    });
    // Let the outlines finish drawing (software WebGL in CI is slow) before the screenshot.
    await page.waitForFunction(
      () => {
        const el = document.querySelector("arcgis-map") as HTMLArcgisMapElement | null;
        return !!el?.view && !el.view.updating && el.view.allLayerViews.length > 0;
      },
      null,
      { timeout: 30_000 },
    );
    await page.waitForTimeout(1000);

    // Header parts never overlap (the subtitle once ran into Search at about 800 px).
    const header = await page.evaluate(() => {
      const box = (sel: string) => {
        const b = document.querySelector(sel)?.getBoundingClientRect();
        return b && b.width > 0 ? { left: b.left, right: b.right } : null;
      };
      return {
        name: box(".brand__name"),
        sub: box(".brand__sub"),
        module: box(".topbar__module"),
        tools: box(".topbar__tools"),
      };
    });
    for (const part of [header.name, header.sub, header.module])
      if (part) expect(part.right).toBeLessThanOrEqual(header.tools!.left + 0.5);
    if (header.module)
      for (const part of [header.name, header.sub])
        if (part) expect(part.right).toBeLessThanOrEqual(header.module.left + 0.5);

    // No horizontal page scroll at any size.
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
    expect(overflow).toBeLessThanOrEqual(0);

    // At 1920×1080 with both side panels open, at least 60 % of the viewport width shows
    // unobstructed map between the panels (spec §4.1).
    if (vp.width === 1920) {
      const visible = await page.evaluate(() => {
        const left = document.getElementById("filter-panel")!.getBoundingClientRect().right;
        const right = document.getElementById("insights-panel")!.getBoundingClientRect().left;
        return (right - left) / window.innerWidth;
      });
      expect(visible).toBeGreaterThanOrEqual(0.6);
    }

    await page.screenshot({ path: info.outputPath(`${vp.name}.png`) });
  });
}

test("mobile navigation drawer opens and switches module", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("./");
  await page.getByRole("button", { name: "Open navigation" }).click();
  const nav = page.getByRole("navigation", { name: "Modules" });
  await expect(nav).toHaveAttribute("data-mobile-open", "true");
  await nav.getByRole("button", { name: /Profiles/ }).click();
  await expect(nav).toHaveAttribute("data-mobile-open", "false");
  await expect(page).toHaveURL(/m=profiles/);
});

test("no serious or critical accessibility violations in the shell", async ({ page }) => {
  await page.goto("./");
  await expect(page.locator(".map-host[data-map-state]")).toHaveAttribute("data-map-state", "ready", {
    timeout: 45_000,
  });
  const results = await new AxeBuilder({ page })
    .exclude("arcgis-map") // SDK-rendered canvas; covered by Esri's own accessibility work
    .analyze();
  const serious = results.violations.filter((v) => v.impact === "serious" || v.impact === "critical");
  expect(serious.map((v) => `${v.id}: ${v.help} (${v.nodes.length})`)).toEqual([]);
});

test("reduced motion setting is honoured", async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto("./");
  await expect(page.locator(".app")).toHaveAttribute("data-motion", "reduced");
  await expect(page.locator(".map-host[data-map-state]")).toHaveAttribute("data-map-state", "ready", {
    timeout: 45_000,
  });
  expect(await page.locator("arcgis-map").evaluate((el: HTMLArcgisMapElement) => el.animationsDisabled)).toBe(
    true,
  );
});
