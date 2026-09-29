import { useEffect, useRef } from "react";

/**
 * CustomCursor — a precise dot plus a trailing ring.
 *
 * The dot tracks the pointer 1:1 so aiming stays exact, while the ring lerps
 * behind it for a sense of weight. Ring state comes from a single delegated
 * `pointermove` listener rather than per-element handlers: mark anything
 * interactive with `data-cursor` (and optionally `data-cursor-label`) and the
 * ring grows or shows that label when the pointer arrives.
 *
 * Renders nothing on touch devices or when reduced motion is requested, so the
 * native pointer is never replaced in those cases.
 */
interface CustomCursorProps {
  enabled: boolean;
}

export function CustomCursor({ enabled }: CustomCursorProps) {
  const dot = useRef<HTMLSpanElement>(null);
  const ring = useRef<HTMLSpanElement>(null);
  const label = useRef<HTMLSpanElement>(null);

  useEffect(() => {
    if (!enabled) return;
    const dotEl = dot.current;
    const ringEl = ring.current;
    const labelEl = label.current;
    if (!dotEl || !ringEl || !labelEl) return;

    const pointer = { x: window.innerWidth / 2, y: window.innerHeight / 2 };
    const trailing = { x: pointer.x, y: pointer.y };
    let scale = 1;
    let targetScale = 1;
    let visible = false;
    let variant = "default";
    let frame = 0;

    const applyVariant = (next: string, text: string) => {
      if (variant !== next) {
        variant = next;
        ringEl.dataset.variant = next;
      }
      if (labelEl.textContent !== text) labelEl.textContent = text;
    };

    const show = (next: boolean) => {
      if (visible === next) return;
      visible = next;
      const opacity = next ? "1" : "0";
      dotEl.style.opacity = opacity;
      ringEl.style.opacity = opacity;
    };

    const onPointerMove = (event: PointerEvent) => {
      pointer.x = event.clientX;
      pointer.y = event.clientY;

      const target = event.target;
      const marker =
        target instanceof Element ? target.closest<HTMLElement>("[data-cursor]") : null;

      if (marker) {
        applyVariant(marker.dataset.cursor || "hover", marker.dataset.cursorLabel || "");
      } else {
        applyVariant("default", "");
      }
      show(true);
    };

    const onPointerDown = () => {
      targetScale = 0.82;
    };
    const onPointerUp = () => {
      targetScale = 1;
    };
    const onPointerLeave = () => show(false);
    const onScroll = () => {
      // A wheel/touch scroll can leave the ring stranded; re-sync on next move.
      targetScale = 1;
    };

    const render = () => {
      frame = window.requestAnimationFrame(render);
      trailing.x += (pointer.x - trailing.x) * 0.18;
      trailing.y += (pointer.y - trailing.y) * 0.18;
      scale += (targetScale - scale) * 0.2;

      dotEl.style.transform = `translate3d(${pointer.x}px, ${pointer.y}px, 0) translate(-50%, -50%)`;
      ringEl.style.transform = `translate3d(${trailing.x}px, ${trailing.y}px, 0) translate(-50%, -50%) scale(${scale.toFixed(3)})`;
    };
    frame = window.requestAnimationFrame(render);

    window.addEventListener("pointermove", onPointerMove, { passive: true });
    window.addEventListener("pointerdown", onPointerDown, { passive: true });
    window.addEventListener("pointerup", onPointerUp, { passive: true });
    window.addEventListener("scroll", onScroll, { passive: true });
    document.addEventListener("pointerleave", onPointerLeave);

    return () => {
      window.cancelAnimationFrame(frame);
      window.removeEventListener("pointermove", onPointerMove);
      window.removeEventListener("pointerdown", onPointerDown);
      window.removeEventListener("pointerup", onPointerUp);
      window.removeEventListener("scroll", onScroll);
      document.removeEventListener("pointerleave", onPointerLeave);
    };
  }, [enabled]);

  if (!enabled) return null;

  return (
    <>
      <span ref={dot} aria-hidden="true" className="aie-cursor-dot" style={{ opacity: 0 }} />
      <span ref={ring} aria-hidden="true" className="aie-cursor-ring" data-variant="default" style={{ opacity: 0 }}>
        <span ref={label} className="aie-cursor-label" />
      </span>
    </>
  );
}
