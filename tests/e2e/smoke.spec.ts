import { expect, test, type Page } from "@playwright/test";

/** Collects console errors, ignoring the expected "no basemap key" warnings. */
function trackConsoleErrors(page: Page): string[] {
  const errors: string[] = [];
  page.on("console", (msg) => {
    if (msg.type() === "error") errors.push(msg.text());
  });
  page.on("pageerror", (err) => errors.push(err.message));
  return errors;
}

async function waitForMap(page: Page) {
  await expect(page.locator(".map-host[data-map-state]")).toHaveAttribute("data-map-state", "ready", {
    timeout: 45_000,
  });
}

test.describe("Stage 1 shell", () => {
  test("loads the shell and a ready ArcGIS map", async ({ page }) => {
    const errors = trackConsoleErrors(page);
    await page.goto("./");
    await expect(page.getByRole("heading", { level: 1, name: "Food Origins" })).toBeVisible();
    await waitForMap(page);

    // The SDK created a view with a canvas and the reference outlines drew.
    const map = page.locator("arcgis-map");
    await expect(map).toHaveCount(1);
    expect(await map.evaluate((el: HTMLArcgisMapElement) => el.ready)).toBe(true);
    await expect(map.locator("canvas").first()).toBeAttached();
    await expect(page.getByText("Country outlines", { exact: true })).toBeVisible();
    await expect
      .poll(async () =>
        map.evaluate((el: HTMLArcgisMapElement) => el.view.map?.layers.map((l) => l.id).toArray()),
      )
      .toContain("reference-outlines");

    // With a key (the deployed site), the Esri basemap must actually load: a view becomes
    // ready even when its basemap fails. Without a key there is no basemap to check.
    const host = page.locator(".map-host");
    if ((await host.getAttribute("data-basemap")) === "esri") {
      await expect(host).toHaveAttribute("data-basemap-status", "ready", { timeout: 30_000 });
    } else {
      await expect(host).toHaveAttribute("data-basemap-status", "none");
    }
    // Visitors are never asked to sign in to ArcGIS (ADR-11).
    await expect(page.getByText(/sign in to access/i)).toHaveCount(0);

    expect(errors, `console errors:\n${errors.join("\n")}`).toEqual([]);
  });

  test("navigation updates the module, the URL and survives reload", async ({ page }) => {
    await page.goto("./");
    await waitForMap(page);
    await page
      .getByRole("navigation", { name: "Modules" })
      .getByRole("button", { name: "Scenarios" })
      .click();
    await expect(page.getByRole("heading", { level: 1, name: "Scenario Lab" })).toBeVisible();
    await expect(page).toHaveURL(/\?m=scenarios$/);
    await expect(page.getByRole("region", { name: "Timeline" })).toHaveCount(0);

    await page.reload();
    await expect(page.getByRole("heading", { level: 1, name: "Scenario Lab" })).toBeVisible();
    await page.goBack();
    await expect(page.getByRole("heading", { level: 1, name: "Food Origins" })).toBeVisible();
  });

  test("deep link restores module, month and authority", async ({ page }) => {
    await page.goto("./?m=profiles&mo=7&lad=N09000003");
    await expect(page.getByRole("heading", { level: 1, name: "Local Authority Profiles" })).toBeVisible();
    // Profiles has no timeline (Stage 5); the authority opens its profile.
    await expect(page.locator("#insights-panel").getByText("N09000003")).toBeVisible({ timeout: 30_000 });
    // The month is kept for the timeline modules.
    await page
      .getByRole("navigation", { name: "Modules" })
      .getByRole("button", { name: /Seasonal/ })
      .click();
    await expect(page.getByRole("button", { name: "Jul", exact: true })).toHaveAttribute(
      "aria-pressed",
      "true",
    );
    await expect(page).toHaveURL(/mo=7/);
    await expect(page).toHaveURL(/lad=N09000003/);
  });

  test("invalid URL values fall back safely", async ({ page }) => {
    await page.goto("./?m=nonsense&mo=13&lad=XYZ");
    await expect(page.getByRole("heading", { level: 1, name: "Food Origins" })).toBeVisible();
    await expect(page).toHaveURL(/FoodScopeUK\/$/);
  });

  test("panels collapse and the map padding follows React state", async ({ page }) => {
    await page.goto("./");
    await waitForMap(page);
    const map = page.locator("arcgis-map");
    const paddingLeft = () => map.evaluate((el: HTMLArcgisMapElement) => el.view.padding.left);
    const openLeft = await paddingLeft();

    await page.keyboard.press("[");
    await expect(page.locator("#filter-panel")).toHaveAttribute("data-open", "false");
    await expect.poll(paddingLeft).toBeLessThan(openLeft);

    await page.getByRole("button", { name: "Insights panel" }).click();
    await expect(page.locator("#insights-panel")).toHaveAttribute("data-open", "false");
    await expect.poll(() => map.evaluate((el: HTMLArcgisMapElement) => el.view.padding.right)).toBe(0);
  });

  test("map controls drive the view through the store", async ({ page }) => {
    await page.goto("./");
    await waitForMap(page);
    const map = page.locator("arcgis-map");
    const zoom = () => map.evaluate((el: HTMLArcgisMapElement) => el.view.zoom);
    await page.getByRole("button", { name: "Show the world" }).click();
    await expect.poll(zoom, { timeout: 10_000 }).toBeLessThan(2.6);
    const world = await zoom();
    await page.getByRole("button", { name: "Show the United Kingdom" }).click();
    await expect.poll(zoom, { timeout: 10_000 }).toBeGreaterThan(world + 2);
    await page.getByRole("button", { name: "Show the world" }).click();
    await expect.poll(zoom, { timeout: 10_000 }).toBeLessThan(world + 1);
  });

  test("evidence and help dialogs open from the URL and close", async ({ page }) => {
    await page.goto("./?view=evidence");
    await expect(
      page.getByText(/Statistical snapshots trade 2026-10-23, stores and population 2026-10-24/),
    ).toBeVisible();
    await expect(page.getByRole("cell", { name: /World country outlines/ })).toBeVisible();
    await expect(page.getByRole("cell", { name: /Recorded UK imports: tomatoes/ })).toBeVisible();
    await page.keyboard.press("Escape");
    await expect(page).toHaveURL(/FoodScopeUK\/$/);
    await page.keyboard.press("?");
    await expect(page.getByText("Keyboard shortcuts")).toBeVisible();
  });

  test("timeline month selection is keyboard operable", async ({ page }) => {
    await page.goto("./");
    await expect(page.locator(".kpi-card").first()).toHaveAttribute("data-state", "ready", {
      timeout: 30_000,
    });
    await page.getByRole("button", { name: "Mar", exact: true }).click();
    await expect(page).toHaveURL(/mo=3/);
    await page.keyboard.press("ArrowRight");
    await expect(page.getByRole("button", { name: "Apr", exact: true })).toHaveAttribute(
      "aria-pressed",
      "true",
    );
    await expect(page).toHaveURL(/mo=4/);
  });

  test("modules without data show no numbers on KPI cards", async ({ page }) => {
    await page.goto("./?m=scenarios");
    const cards = page.locator(".kpi-card");
    await expect(cards).toHaveCount(3);
    for (const text of await cards.allInnerTexts()) {
      expect(text).toContain("No data loaded");
      expect(text.replace(/stage \d+/i, "")).not.toMatch(/\d/);
    }
  });
});

test.describe("error states", () => {
  test("data index failure shows a partial-failure notice, map still loads", async ({ page }) => {
    await page.route("**/data/manifest.json", (route) => route.fulfill({ status: 500, body: "boom" }));
    await page.goto("./");
    await waitForMap(page);
    await expect(page.getByText("Some information is unavailable: data index")).toBeVisible();
    await expect(page.getByRole("button", { name: /Data freshness: Data index unavailable/ })).toBeVisible();
  });

  test("invalid manifest is rejected by schema validation", async ({ page }) => {
    await page.route("**/data/manifest.json", (route) =>
      route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ schemaVersion: 2 }),
      }),
    );
    await page.goto("./?view=evidence");
    await expect(page.getByText(/does not match its published schema/).first()).toBeVisible();
  });
});
