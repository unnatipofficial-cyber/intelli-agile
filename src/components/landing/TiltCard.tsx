import { useRef } from "react";
import type { CSSProperties, PointerEvent as ReactPointerEvent, ReactNode } from "react";
import { cn } from "@/lib/utils";

/**
 * TiltCard — an interactive card that tilts toward the cursor.
 *
 * The pointer position is written straight to CSS custom properties on the
 * element (`--nx`, `--ny`, `--glow-x`, `--glow-y`) so the tilt, the glow and the
 * content parallax all animate in CSS. No React re-renders happen while the
 * mouse moves, and only `transform`/`opacity` change, so it stays on the
 * compositor.
 *
 * Depth: children can opt in with `.aie-layer-mid` / `.aie-layer-near` to drift
 * at their own rate, which is what makes the content read as layered rather than
 * painted on. The built-in surface uses its own `.aie-surface` style (same theme
 * tokens as `.glass-card`) to avoid fighting glass-card's own hover transform.
 */
interface TiltCardProps {
  children: ReactNode;
  className?: string;
  style?: CSSProperties;
  /** Max rotation in degrees. Keep it subtle (3–7). */
  intensity?: number;
  /** How far the card lifts toward the viewer on hover, in px. */
  lift?: number;
  /** Render the cursor-following glow layer. */
  glow?: boolean;
  /** Render the glass surface layer. */
  surface?: boolean;
  /** Disable interaction entirely (touch devices, reduced motion). */
  interactive?: boolean;
  /** Element to render as — defaults to a div. */
  as?: "div" | "article" | "li";
  /** Cursor label shown by the custom cursor while hovering. */
  cursorLabel?: string;
}

export function TiltCard({
  children,
  className,
  style,
  intensity = 5,
  lift = 6,
  glow = true,
  surface = true,
  interactive = true,
  as = "div",
  cursorLabel,
}: TiltCardProps) {
  const host = useRef<HTMLElement>(null);

  const handlePointerMove = (event: ReactPointerEvent<HTMLElement>) => {
    if (!interactive) return;
    const element = host.current;
    if (!element) return;

    const rect = element.getBoundingClientRect();
    if (rect.width === 0 || rect.height === 0) return;

    const nx = ((event.clientX - rect.left) / rect.width) * 2 - 1;
    const ny = ((event.clientY - rect.top) / rect.height) * 2 - 1;

    element.style.setProperty("--nx", nx.toFixed(3));
    element.style.setProperty("--ny", ny.toFixed(3));
    element.style.setProperty("--glow-x", `${(((nx + 1) / 2) * 100).toFixed(1)}%`);
    element.style.setProperty("--glow-y", `${(((ny + 1) / 2) * 100).toFixed(1)}%`);
  };

  const handlePointerEnter = () => {
    if (!interactive) return;
    const element = host.current;
    if (!element) return;
    element.style.setProperty("--lift", `${lift}px`);
    element.dataset.tilting = "true";
  };

  const handlePointerLeave = () => {
    const element = host.current;
    if (!element) return;
    element.style.setProperty("--lift", "0px");
    element.style.setProperty("--nx", "0");
    element.style.setProperty("--ny", "0");
    delete element.dataset.tilting;
  };

  // Rendered as `as`, but typed as a div so the ref stays simple.
  const Tag = as as "div";

  return (
    <Tag
      ref={host as React.RefObject<HTMLDivElement>}
      className={cn("aie-tilt", className)}
      style={{ ...style, ["--tilt-max" as string]: `${intensity}deg` }}
      onPointerMove={interactive ? handlePointerMove : undefined}
      onPointerEnter={interactive ? handlePointerEnter : undefined}
      onPointerLeave={interactive ? handlePointerLeave : undefined}
      data-cursor={cursorLabel ? "label" : undefined}
      data-cursor-label={cursorLabel}
    >
      {surface ? <span aria-hidden="true" className="aie-tilt-surface" /> : null}
      {glow ? <span aria-hidden="true" className="aie-tilt-glow" /> : null}
      <div className="aie-tilt-content">{children}</div>
    </Tag>
  );
}
