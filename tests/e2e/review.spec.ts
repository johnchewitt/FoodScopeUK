import { expect, test, type Page } from "@playwright/test";

/**
 * The five review improvements (docs/reviews/2026-10-review.md): map framing, legend-true share
 * colours with highlight-based hover, comparability cautions, data-first loading and KPI cards
 * that are never hidden. Real committed snapshot 2026-10-26; label points from Natural Earth.
 */

const POINTS = {
  GB: [-2.1163, 54.4027],
  MA: [-7.1873, 31.6507],
  NL: [5.6114, 52.4222],
  TR: [34.5083, 39.3454],
  CO: [-73.1743, 3.3731],
  EC: [-78.1884, -1.2591],
} as const;
type Key = keyof typeof POINTS;

/** Same values as src/styles/palette.ts (opaque --fs-seq-* tokens). */
const SHARE_CLASS_HEX = ["#1e7877", "#268e8a", "#2ea39c", "#37baaf", "#3fd1c3", "#49ead8"];

async function ready(page: Page) {
  await expect(page.locator(".map-host[data-map-state]")).toHaveAttribute("data-map-state", "ready", {
    timeout: 45_000,
  });
  await expect(page.locator(".kpi-card").first()).toHaveAttribute("data-state", "ready", { timeout: 20_000 });
}

/** Screen positions (page px) of label points, from the ArcGIS view itself. */
async function onScreen(page: Page, keys: Key[]) {
  return page.locator("arcgis-map").evaluate(
    (el: HTMLArcgisMapElement, pts: [string, number, number][]) => {
      const view = el.view;
      const box = el.getBoundingClientRect();
      return Object.fromEntries(
        pts.map(([k, lon, lat]) => {
          const p = view.center.clone();
          p.longitude = lon;
          p.latitude = lat;
          const s = view.toScreen(p)!;
          return [k, { x: box.left + s.x, y: box.top + s.y }];
        }),
      );
    },
    keys.map((k) => [k, POINTS[k][0], POINTS[k][1]] as [string, number, number]),
  );
}

/** The part of the map not covered by panels, KPI cards, the timeline or (desktop) the legend. */
async function freeArea(page: Page) {
  return page.evaluate(() => {
    const r = (sel: string) => document.querySelector(sel)?.getBoundingClientRect() ?? null;
    const filter = r("#filter-panel");
    const insights = r("#insights-panel");
    const legend = r(".map-legend[open]");
    const kpi = r(".kpi-card");
    const timeline = r(".timeline");
    return {
      left: Math.max(filter?.right ?? 0, legend?.right ?? 0),
      right: insights?.left ?? window.innerWidth,
      top: kpi?.bottom ?? 0,
      bottom: timeline?.top ?? window.innerHeight,
    };
  });
}

const zoomOf = (page: Page) =>
  page.locator("arcgis-map").evaluate((el: HTMLArcgisMapElement) => el.view.zoom);
/** Zoom once the view has stopped moving. */
const settledZoom = async (page: Page) => {
  await page.waitForFunction(() => {
    const el = document.querySelector("arcgis-map") as HTMLArcgisMapElement | null;
    return !!el?.view && el.view.stationary;
  });
  return zoomOf(page);
};

test.describe("Map framing", () => {
  test("opens framed on the UK and its recorded partners, clear of panels and legend", async ({ page }) => {
    await page.goto("./");
    await ready(page);
    await expect.poll(() => zoomOf(page)).toBeGreaterThan(3.5); // was the whole world (zoom 2)
    const area = await freeArea(page);
    const pts = await onScreen(page, ["GB", "MA", "NL", "TR"]);
    for (const [k, p] of Object.entries(pts)) {
      expect(p.x, `${k} x`).toBeGreaterThan(area.left);
      expect(p.x, `${k} x`).toBeLessThan(area.right);
      expect(p.y, `${k} y`).toBeGreaterThan(area.top);
      expect(p.y, `${k} y`).toBeLessThan(area.bottom);
    }
  });

  test("keeps the view on month changes, reframes on a new commodity and on request", async ({ page }) => {
    await page.goto("./?pm=m&y=2025&mo=1");
    await ready(page);
    await expect.poll(() => zoomOf(page)).toBeGreaterThan(3.5);
    const framed = await settledZoom(page);
    // A user zoom is not undone by moving through the months.
    await page.getByRole("button", { name: "Zoom in" }).click();
    await expect.poll(() => zoomOf(page)).toBeGreaterThan(framed + 0.2);
    const zoomed = await settledZoom(page);
    await page
      .getByRole("region", { name: "Timeline" })
      .getByRole("button", { name: "Jul", exact: true })
      .click();
    await expect(page).toHaveURL(/mo=7/);
    await page.waitForTimeout(800);
    expect(await settledZoom(page)).toBeCloseTo(zoomed, 5);
    // The fit control (and F) restores the frame.
    await page
      .getByRole("button", { name: "Fit the map to the UK and its recorded import partners" })
      .click();
    await expect.poll(() => zoomOf(page), { timeout: 10_000 }).toBeLessThan(zoomed - 0.2);
    // It fits what is drawn now (July's connections), so it need not equal January's frame.
    expect(await settledZoom(page)).toBeGreaterThan(3.5);
    // A new commodity is framed: bananas reach Latin America.
    await page.getByRole("radio", { name: /Bananas/ }).click();
    await expect.poll(() => zoomOf(page), { timeout: 10_000 }).toBeLessThan(4);
    await page.waitForTimeout(2000); // the flight (1.6 s) settles
    const area = await freeArea(page);
    const pts = await onScreen(page, ["GB", "CO", "EC"]);
    for (const [k, p] of Object.entries(pts)) {
      expect(p.x, `${k} x`).toBeGreaterThan(area.left);
      expect(p.x, `${k} x`).toBeLessThan(area.right);
    }
    await page.getByRole("button", { name: "Show the world" }).click();
    await expect.poll(() => zoomOf(page)).toBeLessThan(2.6);
    await page.locator("body").press("f");
    await expect.poll(() => zoomOf(page), { timeout: 10_000 }).toBeGreaterThan(2.8);
  });
});

test.describe("Share colours", () => {
  test("map fills and legend swatches are the same opaque colours", async ({ page }) => {
    await page.goto("./");
    await ready(page);
    const fill = () =>
      page.locator("arcgis-map").evaluate((el: HTMLArcgisMapElement) => {
        const layer = el.view.map!.layers.find((l) => l.id === "origins-partners") as unknown as {
          renderer?: {
            uniqueValueInfos: {
              value: string;
              symbol: { color: { r: number; g: number; b: number; a: number } };
            }[];
          };
        };
        return Object.fromEntries(
          (layer.renderer?.uniqueValueInfos ?? []).map((i) => {
            const c = i.symbol.color;
            return [
              i.value,
              `#${[c.r, c.g, c.b].map((v) => v.toString(16).padStart(2, "0")).join("")}@${c.a}`,
            ];
          }),
        );
      });
    await expect.poll(async () => (await fill()).NL).toBe(`${SHARE_CLASS_HEX[4]}@1`); // 43.8 % → 25–50 %
    expect((await fill()).ES).toBe(`${SHARE_CLASS_HEX[3]}@1`); // 11.0 % → 10–25 %
    expect((await fill()).TR).toBe(`${SHARE_CLASS_HEX[0]}@1`); // 0.2 % → below 1 %
    // The browser resolves color-mix(in oklab, …) itself; read the painted sRGB value via a canvas.
    const swatches = await page.locator(".map-legend .swatch[data-class]").evaluateAll((els) => {
      const ctx = document.createElement("canvas").getContext("2d")!;
      return els.map((e) => {
        ctx.clearRect(0, 0, 1, 1);
        ctx.fillStyle = getComputedStyle(e).backgroundColor;
        ctx.fillRect(0, 0, 1, 1);
        const [r, g, b] = ctx.getImageData(0, 0, 1, 1).data;
        return `#${[r, g, b].map((v) => v!.toString(16).padStart(2, "0")).join("")}`;
      });
    });
    // Within one 8-bit step per channel of the TypeScript mirror (browser rounding).
    swatches.forEach((hex, i) => {
      const a = [1, 3, 5].map((j) => parseInt(hex.slice(j, j + 2), 16));
      const b = [1, 3, 5].map((j) => parseInt(SHARE_CLASS_HEX[i]!.slice(j, j + 2), 16));
      a.forEach((v, j) => expect(Math.abs(v - b[j]!), `class ${i}: ${hex}`).toBeLessThanOrEqual(1));
    });
  });

  test("hovering highlights a partner without rebuilding the renderer", async ({ page }) => {
    // Page errors are recorded so a failure here says why. B29 (25 Oct 2026): this test failed
    // intermittently because the map's hit test on the country fills (a GeoJSON layer) took up to
    // 12 s under software rendering; hover now tests the label points and connections first.
    const pageErrors: string[] = [];
    page.on("pageerror", (err) => pageErrors.push(err.message));
    page.on("console", (msg) => {
      if (msg.type() === "error") pageErrors.push(msg.text());
    });
    await page.goto("./");
    await ready(page);
    const builds = () =>
      page
        .locator("arcgis-map")
        .evaluate((el: HTMLArcgisMapElement) =>
          Number(el.view.container?.dataset.partnerRendererBuilds ?? 0),
        );
    await expect.poll(builds).toBeGreaterThan(0);
    await page.waitForTimeout(1500);
    const before = await builds();
    // Label points where each partner's own connection ends (other connections cross some countries).
    const pts = await onScreen(page, ["TR", "MA"]);
    // Diagnostics: DOM pointer moves reaching the page, unhandled rejections, and the map's hover
    // counts (moves:started:settled:applied:stale:failed:key:duration) before and after the jump.
    await page.evaluate(() => {
      const w = window as unknown as { __domMoves: number };
      w.__domMoves = 0;
      window.addEventListener("pointermove", () => (w.__domMoves += 1), { capture: true });
      const r = window as unknown as { __rejections: string[] };
      r.__rejections = [];
      window.addEventListener("unhandledrejection", (e) => r.__rejections.push(String(e.reason)));
    });
    const hoverStats = () =>
      page.evaluate(() => ({
        dom: (window as unknown as { __domMoves: number }).__domMoves,
        map: (document.querySelector("arcgis-map") as HTMLArcgisMapElement).view.container?.dataset
          .hoverStats,
        tooltip: (() => {
          const t = document.querySelector(".map-tooltip") as HTMLElement | null;
          return t
            ? `${t.style.cssText} ${JSON.stringify(t.dataset)} ${t.innerText.replace(/\s+/g, " ")}`
            : null;
        })(),
        rejections: (window as unknown as { __rejections?: string[] }).__rejections ?? [],
      }));
    await page.mouse.move(pts.TR!.x, pts.TR!.y);
    await expect(page.locator(".map-tooltip")).toContainText("Turkey", { timeout: 10_000 });
    const statsAtTurkey = await hoverStats();
    await page.mouse.move(pts.MA!.x, pts.MA!.y);
    try {
      await expect(page.locator(".map-tooltip")).toContainText("Morocco", { timeout: 10_000 });
    } catch (err) {
      // What the map sees at Morocco's point: the camera, the element on top and the hit test.
      const after = await onScreen(page, ["TR", "MA"]);
      const probe = await page
        .locator("arcgis-map")
        .evaluate(async (el: HTMLArcgisMapElement, p: { x: number; y: number }) => {
          const box = el.getBoundingClientRect();
          const top = document.elementFromPoint(p.x, p.y);
          const hits = await el.view.hitTest({ x: p.x - box.left, y: p.y - box.top });
          return {
            zoom: el.view.zoom,
            center: [el.view.center.longitude, el.view.center.latitude],
            stationary: el.view.stationary,
            top: top ? `${top.tagName}.${String(top.className)}` : null,
            hits: hits.results.map((r) => {
              const g = (r as { graphic?: { layer?: { id?: string }; attributes?: Record<string, unknown> } })
                .graphic;
              return `${g?.layer?.id ?? "?"}:${String(g?.attributes?.key ?? g?.attributes?.iso_a2 ?? "")}`;
            }),
          };
        }, pts.MA!);
      throw new Error(
        `${(err as Error).message}\n\nDiagnostics: points before ${JSON.stringify(pts)}, after ${JSON.stringify(
          after,
        )}; map ${JSON.stringify(probe)}; hover at Turkey ${JSON.stringify(statsAtTurkey)}, now ${JSON.stringify(
          await hoverStats(),
        )}; page errors ${JSON.stringify(pageErrors)}`,
        { cause: err },
      );
    }
    expect(await builds()).toBe(before);
  });
});

test.describe("Comparability cautions", () => {
  test("2022 vs 2021 crosses the January 2022 series break and says so", async ({ page }) => {
    await page.goto("./?pm=y&y=2022");
    await ready(page);
    const imports = page.getByRole("article", { name: "Recorded imports" });
    await expect(imports).toHaveAttribute("data-caution", "true");
    await expect(imports).toContainText("vs 2021 · series break");
    await expect(
      imports.getByRole("img", { name: /Caution: Comparison crosses the HMRC series break in Jan 2022/ }),
    ).toBeVisible();
    await expect(page.getByRole("article", { name: "Partner concentration (HHI)" })).toHaveAttribute(
      "data-caution",
      "true",
    );
    await expect(page.locator("#insights-panel .notice--warn").first()).toContainText(
      "series break in Jan 2022 (GB imports from the EU from customs declarations)",
    );
    await expect(page.locator(".partner-table th[data-caution='true']")).toHaveCount(1);
    // The latest 12 months compare like with like: no caution.
    await page.goto("./");
    await ready(page);
    await expect(page.getByRole("article", { name: "Recorded imports" })).not.toHaveAttribute(
      "data-caution",
      "true",
    );
  });

  test("value comparisons are labelled as current prices", async ({ page }) => {
    await page.goto("./?ms=value");
    await ready(page);
    await expect(page.locator("#insights-panel")).toContainText("not adjusted for inflation");
  });
});

test.describe("Data before the map", () => {
  test("the commodity snapshot is requested before the map SDK's assets", async ({ page }) => {
    const order: string[] = [];
    page.on("request", (r) => {
      const u = r.url();
      if (/trade\/tomatoes\.json$/.test(u)) order.push("snapshot");
      else if (/\/arcgis\/core\/assets\//.test(u) || /js\.arcgis\.com/.test(u)) order.push("sdk-asset");
      else if (/data\/manifest\.json$/.test(u)) order.push("manifest");
    });
    await page.goto("./");
    await ready(page);
    expect(order[0]).toBe("manifest");
    expect(order.indexOf("snapshot")).toBeGreaterThan(-1);
    const firstAsset = order.indexOf("sdk-asset");
    if (firstAsset !== -1) expect(order.indexOf("snapshot")).toBeLessThan(firstAsset);
    expect(order.filter((o) => o === "manifest")).toHaveLength(1); // the preload is reused
  });
});

test.describe("Key figures are never hidden", () => {
  test("at 1366 px all four cards exist and the strip scrolls to the hidden ones", async ({ page }) => {
    await page.setViewportSize({ width: 1366, height: 768 });
    await page.goto("./");
    await ready(page);
    const strip = page.locator(".kpi-strip");
    const hhi = page.getByRole("article", { name: "Partner concentration (HHI)" });
    await expect(page.locator(".kpi-card")).toHaveCount(4);
    await expect(hhi).toContainText("2,990");
    await expect(strip).toHaveAttribute("data-overflow-end", "true");
    await expect(strip).toHaveAttribute("tabindex", "0");
    await strip.focus();
    await page.keyboard.press("ArrowRight", { delay: 20 });
    for (let i = 0; i < 12; i++) await page.keyboard.press("ArrowRight");
    await expect(strip).toHaveAttribute("data-overflow-start", "true");
    const [s, c] = await Promise.all([strip.boundingBox(), hhi.boundingBox()]);
    expect(c!.x + c!.width).toBeLessThanOrEqual(s!.x + s!.width - 15); // fully inside (strip has 16 px padding)
  });

  test("at 1920 px all cards fit without scrolling", async ({ page }) => {
    await page.goto("./");
    await ready(page);
    const strip = page.locator(".kpi-strip");
    await expect(strip).not.toHaveAttribute("data-overflow-end", "true");
    await expect(strip).not.toHaveAttribute("tabindex", "0");
  });
});
