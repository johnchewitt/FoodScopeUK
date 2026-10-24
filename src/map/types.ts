import type { AppState, MapCommand } from "@/state/store";
import type { ViewPadding } from "./layoutMetrics";

/**
 * The subset of MapView that controllers use. Keeping it narrow lets controllers be unit
 * tested with a fake view, without loading the SDK in jsdom (architecture §7).
 */
export interface ViewLike {
  padding: ViewPadding;
  zoom: number;
  /** View size in px (MapView width/height). Absent in some unit-test fakes. */
  width?: number;
  height?: number;
  goTo(target: unknown, options?: { animate?: boolean; duration?: number }): Promise<unknown>;
  whenLayerView(layer: unknown): Promise<unknown>;
  map: { add(layer: unknown, index?: number): void; remove(layer: unknown): void } | null | undefined;
  /** MapView event registration (click, pointer-move, pointer-leave). Absent in unit-test fakes. */
  on?(name: string, handler: (event: ViewPointerEvent) => void): { remove(): void };
  /** MapView hit test. Absent in unit-test fakes. */
  hitTest?(event: ViewPointerEvent, options?: { include?: unknown[] }): Promise<{ results: HitResult[] }>;
}

export interface ViewPointerEvent {
  x: number;
  y: number;
  stopPropagation?(): void;
}

export interface HitResult {
  type: string;
  graphic?: { attributes?: Record<string, unknown> | null; layer?: unknown } | null;
}

/** Layer controllers own their layers end to end (ADR-03). */
export interface LayerController {
  readonly id: string;
  activate(view: ViewLike, report: LayerStatusReporter): void;
  /** Called on every store change; must be idempotent. */
  update?(state: AppState): void;
  /** Handles a map command the controller cannot (e.g. fit a council); returns true if handled. */
  handleCommand?(command: MapCommand, context: { reducedMotion: boolean }): boolean;
  deactivate(view: ViewLike): void;
}

export type LayerStatusReporter = (status: "loading" | "ready" | "error", message?: string) => void;

export const GO_TO_TARGETS = {
  world: { center: [8, 30] as [number, number], zoom: 2.4 },
  uk: { center: [-3.4, 55.2] as [number, number], zoom: 5.2 },
} as const;

export const FLIGHT_DURATION_MS = 1600;
