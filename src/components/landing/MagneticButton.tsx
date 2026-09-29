import { useRef } from "react";
import type { PointerEvent as ReactPointerEvent, ReactNode } from "react";
import { cn } from "@/lib/utils";

/**
 * MagneticButton — a wrapper that makes its child drift toward the cursor.
 *
 * The outer element absorbs most of the movement while the inner content moves
 * a fraction of the distance, which sells the "pull" without the label ever
 * appearing to detach from the button. Positions are written directly to
 * `style.transform` so nothing re-renders while the pointer moves.
 *
 * Inert when disabled (touch devices / reduced motion), where it renders a
 * plain inline wrapper.
 */
interface MagneticButtonProps {
  children: ReactNode;
  className?: string;
  /** Max displacement in px. Keep it small — 4–10 reads as premium. */
  strength?: number;
  enabled?: boolean;
}

export function MagneticButton({ children, className, strength = 7, enabled = true }: MagneticButtonProps) {
  const host = useRef<HTMLSpanElement>(null);
  const inner = useRef<HTMLSpanElement>(null);

  const reset = () => {
    if (host.current) host.current.style.transform = "translate3d(0, 0, 0)";
    if (inner.current) inner.current.style.transform = "translate3d(0, 0, 0)";
  };

  const handleMove = (event: ReactPointerEvent<HTMLSpanElement>) => {
    if (!enabled) return;
    const element = host.current;
    const content = inner.current;
    if (!element || !content) return;

    const rect = element.getBoundingClientRect();
    if (rect.width === 0 || rect.height === 0) return;

    // -1 .. 1 from the element's centre.
    const dx = (event.clientX - (rect.left + rect.width / 2)) / (rect.width / 2);
    const dy = (event.clientY - (rect.top + rect.height / 2)) / (rect.height / 2);

    element.style.transform = `translate3d(${(dx * strength).toFixed(2)}px, ${(dy * strength).toFixed(2)}px, 0)`;
    content.style.transform = `translate3d(${(dx * strength * 0.32).toFixed(2)}px, ${(dy * strength * 0.32).toFixed(2)}px, 0)`;
  };

  if (!enabled) {
    return <span className={cn("inline-block", className)}>{children}</span>;
  }

  return (
    <span
      ref={host}
      className={cn("aie-magnetic inline-block", className)}
      onPointerMove={handleMove}
      onPointerLeave={reset}
    >
      <span ref={inner} className="aie-magnetic-inner inline-block">
        {children}
      </span>
    </span>
  );
}
