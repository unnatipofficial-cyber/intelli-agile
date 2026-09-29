import { animate, onScroll, stagger } from "animejs";
import { useEffect, useRef } from "react";
import type { CSSProperties, ReactNode, RefObject } from "react";

/**
 * ScrollReveal — anime.js staggered entrance for a group of elements.
 *
 * The wrapper's direct children (or elements matching `selector`) fade and
 * rise into place, either when the wrapper scrolls into view (`trigger="scroll"`)
 * or as soon as it mounts (`trigger="mount"`).
 *
 * Two safety nets keep the page legible no matter what: reduced-motion users
 * get the final state immediately, and a viewport watchdog restores content if
 * the scroll observer never runs.
 */
interface ScrollRevealProps {
  children: ReactNode;
  className?: string;
  style?: CSSProperties;
  /** Defaults to the wrapper's direct children. */
  selector?: string;
  trigger?: "scroll" | "mount";
  /** Gap between each child's start, in ms. */
  delay?: number;
  /** Vertical offset each child travels from — px or a transform-length string such as "110%". */
  y?: number | string;
  duration?: number;
  ease?: string;
  scaleFrom?: number;
  /** Element to render as the wrapper — use "span" inside a heading. */
  as?: "div" | "span" | "section";
}

export function ScrollReveal({
  children,
  className,
  style,
  selector,
  trigger = "scroll",
  delay = 90,
  y = 28,
  duration = 820,
  ease = "out(3)",
  scaleFrom,
  as = "div",
}: ScrollRevealProps) {
  const host = useRef<HTMLElement>(null);

  useEffect(() => {
    const hostEl = host.current;
    if (!hostEl) return;

    const targets: HTMLElement[] = selector
      ? Array.from(hostEl.querySelectorAll<HTMLElement>(selector))
      : (Array.from(hostEl.children) as HTMLElement[]);
    if (targets.length === 0) return;

    const settle = () => {
      targets.forEach((node) => {
        node.style.opacity = "1";
        node.style.transform = "none";
      });
    };

    if (window.matchMedia?.("(prefers-reduced-motion: reduce)").matches) {
      settle();
      return;
    }

    let animation: ReturnType<typeof animate> | null = null;
    try {
      animation = animate(targets, {
        opacity: { from: 0, to: 1 },
        translateY: { from: y, to: 0 },
        ...(scaleFrom === undefined ? {} : { scale: { from: scaleFrom, to: 1 } }),
        duration,
        ease,
        delay: stagger(delay),
        autoplay: trigger === "mount" ? true : onScroll({ target: hostEl, repeat: false }),
      });
    } catch (error) {
      console.warn("[landing] reveal failed, showing content", error);
      settle();
    }

    // Watchdog: if the host is on screen but nothing ever became visible, the
    // engine did not run — show the content rather than leave a blank section.
    let watchdog: IntersectionObserver | null = null;
    let watchdogTimer = 0;
    if (typeof IntersectionObserver !== "undefined") {
      watchdog = new IntersectionObserver(
        (entries) => {
          if (!entries.some((entry) => entry.isIntersecting)) return;
          watchdogTimer = window.setTimeout(() => {
            const allHidden = targets.every(
              (node) => Number.parseFloat(getComputedStyle(node).opacity) < 0.05,
            );
            if (allHidden) settle();
          }, 1300);
          watchdog?.disconnect();
        },
        { rootMargin: "0px" },
      );
      watchdog.observe(hostEl);
    }

    return () => {
      watchdog?.disconnect();
      window.clearTimeout(watchdogTimer);
      try {
        animation?.revert();
      } catch {
        /* ignore */
      }
    };
  }, [selector, trigger, delay, y, duration, ease, scaleFrom]);

  // Rendered as `as`, but typed as a div so the ref stays simple.
  const Tag = as as "div";
  return (
    <Tag ref={host as RefObject<HTMLDivElement>} className={className} style={style}>
      {children}
    </Tag>
  );
}
