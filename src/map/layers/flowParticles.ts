import Point from "@arcgis/core/geometry/Point";
import SpatialReference from "@arcgis/core/geometry/SpatialReference";
import { cumulativeLengths, particleFractions, pointAlong, toMercator, type LonLat } from "@/analysis/arcs";
import { hexToRgb } from "@/analysis/colour";
import { MAP_COLOURS, type MapStyle } from "@/styles/palette";

/**
 * Moving markers along the Food Origins connections (FO-04), drawn on a 2D canvas over the map.
 *
 * SDK 5.1's CIM symbol animations (including the beta MoveAlongLine) did not render in our view in
 * headless Chromium (SwiftShader) or in desktop Chromium on an Intel UHD 630 GPU, so the markers are
 * drawn here instead (ADR-0015). The static connection lines stay ArcGIS graphics; this overlay only
 * adds the motion, so if it fails nothing else is lost. It stops entirely under reduced motion.
 */

export interface ParticleFlow {
  key: string;
  path: LonLat[];
  widthPx: number;
  emphasis: "normal" | "selected" | "dimmed";
}

/** The parts of MapView the overlay uses. */
export interface ParticleView {
  container?: HTMLElement | null;
  resolution?: number;
  toScreen?(point: Point): { x: number; y: number } | null;
}

interface Prepared extends ParticleFlow {
  merc: [number, number][];
  cumulative: number[];
}

/** "r, g, b" for canvas colours. */
function rgbText(hex: string): string {
  return hexToRgb(hex).join(", ");
}

export class FlowParticles {
  private canvas: HTMLCanvasElement | null = null;
  private ctx: CanvasRenderingContext2D | null = null;
  private flows: Prepared[] = [];
  private frame = 0;
  private start = 0;
  private resize: ResizeObserver | null = null;
  private readonly point = new Point({ x: 0, y: 0, spatialReference: SpatialReference.WebMercator });
  /** Marker colours for the basemap style (connection colour; selection colour). */
  private colours = {
    base: rgbText(MAP_COLOURS.dark.connection),
    selected: rgbText(MAP_COLOURS.dark.selection),
  };

  /** Recolours the markers for a basemap style (SH-08). */
  setStyle(style: MapStyle): void {
    const c = MAP_COLOURS[style];
    this.colours = { base: rgbText(c.connection), selected: rgbText(c.selection) };
  }

  constructor(private readonly view: ParticleView) {}

  /** Number of moving markers drawn in the last frame (exposed for tests via data attribute). */
  private drawn = 0;

  setFlows(flows: ParticleFlow[], animate: boolean): void {
    this.flows = flows.map((f) => {
      const merc = f.path.map(toMercator);
      return { ...f, merc, cumulative: cumulativeLengths(merc) };
    });
    if (animate && this.flows.length > 0) this.play();
    else this.stop();
  }

  destroy(): void {
    this.stop();
    this.resize?.disconnect();
    this.resize = null;
    this.canvas?.remove();
    this.canvas = null;
    this.ctx = null;
  }

  private ensureCanvas(): boolean {
    if (this.canvas) return true;
    const container = this.view.container;
    if (!container || typeof document === "undefined") return false;
    const canvas = document.createElement("canvas");
    canvas.className = "flow-particles";
    canvas.setAttribute("aria-hidden", "true");
    canvas.dataset.particles = "0";
    // Last child of the view container (it lives in the map component's shadow root): covers the
    // map exactly and never intercepts pointer input.
    Object.assign(canvas.style, { position: "absolute", left: "0", top: "0", pointerEvents: "none" });
    container.appendChild(canvas);
    const ctx = canvas.getContext("2d");
    if (!ctx) {
      canvas.remove();
      return false;
    }
    this.canvas = canvas;
    this.ctx = ctx;
    const fit = () => {
      const dpr = Math.min(2, window.devicePixelRatio || 1);
      const w = container.clientWidth;
      const h = container.clientHeight;
      canvas.width = Math.round(w * dpr);
      canvas.height = Math.round(h * dpr);
      canvas.style.width = `${w}px`;
      canvas.style.height = `${h}px`;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    };
    fit();
    if (typeof ResizeObserver !== "undefined") {
      this.resize = new ResizeObserver(fit);
      this.resize.observe(container);
    }
    return true;
  }

  private play(): void {
    if (this.frame || !this.ensureCanvas()) return;
    if (this.canvas) this.canvas.hidden = false;
    this.start = performance.now();
    const tick = (now: number) => {
      this.draw((now - this.start) / 1000);
      this.frame = requestAnimationFrame(tick);
    };
    this.frame = requestAnimationFrame(tick);
  }

  private stop(): void {
    if (this.frame) cancelAnimationFrame(this.frame);
    this.frame = 0;
    if (this.ctx && this.canvas) {
      this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
      this.canvas.hidden = true;
      this.canvas.dataset.particles = "0";
    }
    this.drawn = 0;
  }

  private draw(seconds: number): void {
    const ctx = this.ctx;
    const canvas = this.canvas;
    const res = this.view.resolution;
    if (!ctx || !canvas || !this.view.toScreen || !res) return;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    let drawn = 0;
    for (const f of this.flows) {
      const total = f.cumulative[f.cumulative.length - 1] ?? 0;
      const screenLength = total / res;
      const radius = Math.max(1.6, Math.min(4, 1.2 + f.widthPx * 0.22));
      const rgb = f.emphasis === "selected" ? this.colours.selected : this.colours.base;
      const alpha = f.emphasis === "dimmed" ? 0.35 : 0.95;
      ctx.fillStyle = `rgba(${rgb}, ${alpha})`;
      ctx.shadowColor = `rgba(${rgb}, ${f.emphasis === "dimmed" ? 0.2 : 0.8})`;
      ctx.shadowBlur = f.emphasis === "dimmed" ? 0 : 8;
      for (const t of particleFractions(screenLength, seconds)) {
        const [x, y] = pointAlong(f.merc, f.cumulative, t);
        this.point.x = x;
        this.point.y = y;
        const s = this.view.toScreen(this.point);
        if (!s) continue;
        ctx.beginPath();
        ctx.arc(s.x, s.y, radius, 0, Math.PI * 2);
        ctx.fill();
        drawn += 1;
      }
    }
    if (drawn !== this.drawn) {
      this.drawn = drawn;
      canvas.dataset.particles = String(drawn);
    }
  }
}
