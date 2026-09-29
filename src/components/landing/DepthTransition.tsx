import { motion, useScroll, useTransform } from "framer-motion";
import { useRef } from "react";

/**
 * DepthTransition — the seam between two sections.
 *
 * A perspective plane rotates from receding to flat to receding again as it
 * passes through the viewport, so consecutive sections feel like they occupy
 * different depths instead of being stacked flat. The label rides the same
 * scroll progress at a different rate, which reinforces the parallax.
 *
 * Everything animates on `transform`/`opacity`. When `animated` is false the
 * plane renders flat and static, so reduced-motion users still get the seam.
 */
interface DepthTransitionProps {
  /** Short caption revealed in the middle of the transition. */
  label?: string;
  /** Disable scroll-driven motion (reduced motion). */
  animated?: boolean;
}

export function DepthTransition({ label, animated = true }: DepthTransitionProps) {
  const ref = useRef<HTMLDivElement>(null);
  const { scrollYProgress } = useScroll({
    target: ref,
    offset: ["start end", "end start"],
  });

  const rotateX = useTransform(scrollYProgress, [0, 0.5, 1], [58, 0, -58]);
  const scale = useTransform(scrollYProgress, [0, 0.5, 1], [0.74, 1, 0.74]);
  const planeOpacity = useTransform(scrollYProgress, [0, 0.25, 0.75, 1], [0, 1, 1, 0]);
  const spineScale = useTransform(scrollYProgress, [0, 1], [0.15, 1]);
  const labelY = useTransform(scrollYProgress, [0, 1], [34, -34]);
  const labelOpacity = useTransform(scrollYProgress, [0, 0.3, 0.7, 1], [0, 1, 1, 0]);

  return (
    <div ref={ref} aria-hidden="true" className="aie-depth-band">
      <motion.div
        className="aie-depth-plane"
        style={animated ? { rotateX, scale, opacity: planeOpacity } : undefined}
      />

      <motion.span
        className="aie-depth-spine"
        style={animated ? { scaleY: spineScale, opacity: planeOpacity } : undefined}
      />

      {label ? (
        <motion.p
          className="aie-depth-label"
          style={animated ? { y: labelY, opacity: labelOpacity } : undefined}
        >
          {label}
        </motion.p>
      ) : null}
    </div>
  );
}
