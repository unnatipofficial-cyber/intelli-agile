import { motion, useScroll, useSpring } from "framer-motion";

/**
 * ScrollProgressBar — a thin gradient bar pinned to the top of the page that
 * tracks how far down the reader has scrolled.
 */
export function ScrollProgressBar() {
  const { scrollYProgress } = useScroll();
  const scaleX = useSpring(scrollYProgress, { stiffness: 140, damping: 24, mass: 0.24 });

  return (
    <motion.div
      aria-hidden="true"
      style={{ scaleX }}
      className="fixed inset-x-0 top-0 z-[60] h-[3px] origin-left aie-gradient"
    />
  );
}
