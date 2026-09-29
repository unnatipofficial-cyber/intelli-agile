import { animate, onScroll } from "animejs";
import { useLayoutEffect, useRef } from "react";

/**
 * AnimatedCounter — an anime.js count-up that starts when scrolled into view.
 *
 * The tween drives a plain object and writes straight to the DOM node, so the
 * count-up never triggers a React re-render. The starting value is applied in a
 * layout effect (before paint) so the final number never flashes first.
 */
interface AnimatedCounterProps {
  to: number;
  prefix?: string;
  suffix?: string;
  decimals?: number;
  duration?: number;
  className?: string;
}

function format(value: number, decimals: number): string {
  return value.toFixed(decimals);
}

export function AnimatedCounter({
  to,
  prefix = "",
  suffix = "",
  decimals = 0,
  duration = 1600,
  className,
}: AnimatedCounterProps) {
  const node = useRef<HTMLSpanElement>(null);
  const tween = useRef({ amount: 0 });

  const finalText = `${prefix}${format(to, decimals)}${suffix}`;

  useLayoutEffect(() => {
    const element = node.current;
    if (!element) return;

    const paint = (value: number) => {
      element.textContent = `${prefix}${format(value, decimals)}${suffix}`;
    };

    if (window.matchMedia?.("(prefers-reduced-motion: reduce)").matches) {
      paint(to);
      return;
    }

    // Show the start value immediately, before the browser paints.
    tween.current.amount = 0;
    paint(0);

    let animation: ReturnType<typeof animate> | null = null;
    try {
      animation = animate(tween.current, {
        amount: { from: 0, to },
        duration,
        ease: "out(3)",
        autoplay: onScroll({ target: element, repeat: false }),
        onUpdate: () => paint(tween.current.amount),
      });
    } catch (error) {
      console.warn("[landing] counter failed, showing value", error);
      paint(to);
    }

    // If the observer never fires, make sure the real number is displayed.
    const safety = window.setTimeout(() => {
      const box = element.getBoundingClientRect();
      if (box.top >= window.innerHeight || box.bottom <= 0) return;
      if (tween.current.amount === 0) {
        tween.current.amount = to;
        paint(to);
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
  }, [to, prefix, suffix, decimals, duration]);

  return (
    <span className={className} aria-label={finalText}>
      <span ref={node} aria-hidden="true">
        {finalText}
      </span>
    </span>
  );
}
