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

/**
 * Publishes full-page scroll progress as `--scroll-progress` on the root
 * element. Every scroll-reactive CSS effect on the landing page (the warming
 * background, the tightening letterbox, the nav darkening) reads this one
 * custom property, so they all stay in sync and cost one style write a frame.
 */
function publishScrollProgress(): void {
  if (typeof document === "undefined") return;
  const root = document.documentElement;
  const max = root.scrollHeight - window.innerHeight;
  const y = window.scrollY;
  const progress = max > 0 ? Math.min(Math.max(y / max, 0), 1) : 0;
  root.style.setProperty("--scroll-progress", progress.toFixed(4));
  root.style.setProperty("--scroll-y", `${y}`);
}

export function useSmoothScroll(enabled = true): SmoothScrollApi {
  const lenis = useRef<Lenis | null>(null);

  useEffect(() => {
    if (typeof window === "undefined") return;

    if (!enabled) {
      // The hook is switched off on some routes; make sure no stale value from
      // a previous mount is left behind on the root element.
      document.documentElement.style.removeProperty("--scroll-progress");
      document.documentElement.style.removeProperty("--scroll-y");
      return;
    }

    publishScrollProgress();

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
      // Still publish progress from a plain scroll listener so the CSS effects
      // keep working without Lenis.
      const onScroll = () => publishScrollProgress();
      window.addEventListener("scroll", onScroll, { passive: true });
      window.addEventListener("resize", onScroll, { passive: true });
      return () => {
        window.removeEventListener("scroll", onScroll);
        window.removeEventListener("resize", onScroll);
        document.documentElement.style.removeProperty("--scroll-progress");
        document.documentElement.style.removeProperty("--scroll-y");
      };
    }

    lenis.current = instance;
    let frame = window.requestAnimationFrame(function raf(time: number) {
      instance.raf(time);
      publishScrollProgress();
      frame = window.requestAnimationFrame(raf);
    });

    return () => {
      window.cancelAnimationFrame(frame);
      lenis.current = null;
      instance.destroy();
      document.documentElement.style.removeProperty("--scroll-progress");
      document.documentElement.style.removeProperty("--scroll-y");
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
