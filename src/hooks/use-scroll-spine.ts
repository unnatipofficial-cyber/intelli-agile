import { animate, onScroll } from "animejs";
import { useEffect, useRef } from "react";

/**
 * useScrollSpine — a scroll-scrubbed progress line.
 *
 * Unlike a tween that plays on enter, this one is *driven* by scroll position:
 * anime.js' ScrollObserver runs in `linear` sync mode, so the fill grows in
 * lockstep with the reader's thumb. Attach `host` to the tall section and
 * `fill` to the line that should grow inside it.
 */
export function useScrollSpine<T extends HTMLElement = HTMLDivElement>() {
  const host = useRef<T>(null);
  const fill = useRef<HTMLSpanElement>(null);

  useEffect(() => {
    const hostEl = host.current;
    const fillEl = fill.current;
    if (!hostEl || !fillEl) return;

    const showFull = () => {
      fillEl.style.transform = "scaleY(1)";
    };

    if (window.matchMedia?.("(prefers-reduced-motion: reduce)").matches) {
      showFull();
      return;
    }

    let animation: ReturnType<typeof animate> | null = null;
    try {
      animation = animate(fillEl, {
        scaleY: { from: 0, to: 1 },
        duration: 1000,
        ease: "linear",
        autoplay: onScroll({
          target: hostEl,
          enter: "start start",
          leave: "end end",
          sync: "linear",
        }),
      });
    } catch (error) {
      console.warn("[landing] scroll spine failed", error);
      showFull();
    }

    // If the scrub never engaged, don't leave a decorative line stuck at zero.
    const track = fillEl.parentElement;
    const safety = window.setTimeout(() => {
      const box = hostEl.getBoundingClientRect();
      const onScreen = box.top < window.innerHeight && box.bottom > 0;
      if (!onScreen) return;
      const trackHeight = (track ?? hostEl).getBoundingClientRect().height;
      const fillHeight = fillEl.getBoundingClientRect().height;
      if (trackHeight > 0 && fillHeight < trackHeight * 0.02) {
        showFull();
      }
    }, 2600);

    return () => {
      window.clearTimeout(safety);
      try {
        animation?.revert();
      } catch {
        /* ignore */
      }
    };
  }, []);

  return { host, fill };
}
