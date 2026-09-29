import Lenis from "lenis";
import { useCallback, useEffect, useMemo, useRef } from "react";
import { prefersReducedMotion } from "@/lib/motion-prefs";

/**
 * Cinematic smooth scrolling for the landing page.
 *
 * Lenis animates the *real* scroll position rather than transforming a wrapper
 * element. That matters here: the page's scroll reveals (anime.js
 * ScrollObserver) and parallax (Framer Motion `useScroll`) both read the native
 * scroll offset, so they keep working untouched.
 *
 * Lenis honours `prefers-reduced-motion` on its own (`respectReducedMotion`
 * defaults to true, which forces 1:1 tracking), and leaves touch scrolling
 * native (`syncTouch: false`), so no per-device branching is needed.
 *
 * The instance is scoped to the landing page: it is created on mount and
 * destroyed on unmount, so the dashboard and auth pages keep native scrolling.
 */
export interface SmoothScrollApi {
  /** Smoothly scrolls to an element id or node, accounting for the sticky nav. */
  scrollTo: (target: string | HTMLElement, offset?: number) => void;
}

/** Height of the sticky nav, so anchored sections do not slide under it. */
const NAV_OFFSET = -76;

export function useSmoothScroll(enabled = true): SmoothScrollApi {
  const lenis = useRef<Lenis | null>(null);

  useEffect(() => {
    if (!enabled || typeof window === "undefined") return;

    let instance: Lenis;
    try {
      instance = new Lenis({
        duration: 1.05,
        // Exponential ease-out — quick to respond, gently decelerating.
        easing: (t: number) => Math.min(1, 1.001 - Math.pow(2, -10 * t)),
        smoothWheel: true,
        syncTouch: false,
        wheelMultiplier: 1,
        touchMultiplier: 1.5,
      });
    } catch (error) {
      // Native scrolling stays in place; nothing else on the page depends on this.
      console.warn("[landing] smooth scrolling unavailable, using native scroll", error);
      return;
    }

    lenis.current = instance;
    let frame = window.requestAnimationFrame(function raf(time: number) {
      instance.raf(time);
      frame = window.requestAnimationFrame(raf);
    });

    return () => {
      window.cancelAnimationFrame(frame);
      lenis.current = null;
      instance.destroy();
    };
  }, [enabled]);

  const scrollTo = useCallback((target: string | HTMLElement, offset: number = NAV_OFFSET) => {
    const element = typeof target === "string" ? document.getElementById(target) : target;
    if (!element) return;

    const instance = lenis.current;
    if (instance) {
      instance.scrollTo(element, { offset, duration: 1.15 });
      return;
    }
    element.scrollIntoView({
      behavior: prefersReducedMotion() ? "auto" : "smooth",
      block: "start",
    });
  }, []);

  return useMemo(() => ({ scrollTo }), [scrollTo]);
}
