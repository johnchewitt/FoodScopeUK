import { useEffect } from "react";
import { breakpointForWidth } from "@/map/layoutMetrics";
import { canFramePartners, selectUrlState, useAppStore } from "./store";
import { historyModeFor, parseUrlState, serializeUrlState } from "./urlState";

/** Mirrors navigation state to the query string and back (ADR-13). */
export function useUrlSync(): void {
  useEffect(() => {
    const store = useAppStore;
    store.getState().hydrateFromUrl(parseUrlState(window.location.search));

    const unsubscribe = store.subscribe((state, prev) => {
      const next = selectUrlState(state);
      const before = selectUrlState(prev);
      const qs = serializeUrlState(next);
      if (qs === window.location.search || (qs === "" && window.location.search === "")) return;
      const url = `${window.location.pathname}${qs}${window.location.hash}`;
      if (historyModeFor(before, next) === "push") window.history.pushState(null, "", url);
      else window.history.replaceState(null, "", url);
    });

    const onPopState = () => store.getState().hydrateFromUrl(parseUrlState(window.location.search));
    window.addEventListener("popstate", onPopState);
    return () => {
      unsubscribe();
      window.removeEventListener("popstate", onPopState);
    };
  }, []);
}

/** Tracks the layout breakpoint from the viewport width. */
export function useBreakpoint(): void {
  useEffect(() => {
    const update = () => useAppStore.getState().setBreakpoint(breakpointForWidth(window.innerWidth));
    update();
    window.addEventListener("resize", update);
    return () => window.removeEventListener("resize", update);
  }, []);
}

/** Tracks the OS reduced-motion preference. */
export function useSystemReducedMotion(): void {
  useEffect(() => {
    if (typeof window.matchMedia !== "function") return;
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    const update = () => useAppStore.getState().setSystemPrefersReducedMotion(mq.matches);
    update();
    mq.addEventListener("change", update);
    return () => mq.removeEventListener("change", update);
  }, []);
}

/** Restores and persists the in-app motion setting (per-viewer convenience; storage may be unavailable). */
export function useMotionPreferencePersistence(): void {
  useEffect(() => {
    const KEY = "foodscope.motion";
    try {
      const saved = window.localStorage.getItem(KEY);
      if (saved === "reduced" || saved === "system") useAppStore.getState().setMotionPreference(saved);
    } catch {
      /* storage unavailable (private mode, blocked) — keep default */
    }
    return useAppStore.subscribe((s, prev) => {
      if (s.motionPreference === prev.motionPreference) return;
      try {
        window.localStorage.setItem(KEY, s.motionPreference);
      } catch {
        /* ignore */
      }
    });
  }, []);
}

/** Global keyboard shortcuts (documented in the Help dialog). */
export function useKeyboardShortcuts(): void {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.defaultPrevented || e.altKey || e.ctrlKey || e.metaKey) return;
      const target = e.target as HTMLElement | null;
      if (target && (target.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(target.tagName))) return;
      const s = useAppStore.getState();
      if (s.overlay !== "none") {
        // Escape closes an open dialog even before focus has moved into it (e.g. a dialog
        // opened from a deep link on page load).
        if (e.key === "Escape") {
          s.closeOverlay();
          e.preventDefault();
        }
        return;
      }
      switch (e.key) {
        case "[":
          s.toggleFilterPanel();
          break;
        case "]":
          s.toggleInsights();
          break;
        case "?":
          s.openOverlay("help");
          break;
        case "/":
          s.openOverlay("search");
          break;
        case "f":
        case "F":
          if (!canFramePartners(s)) return;
          s.issueMapCommand({ type: "goTo", target: "partners" });
          break;
        default:
          return;
      }
      e.preventDefault();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);
}
