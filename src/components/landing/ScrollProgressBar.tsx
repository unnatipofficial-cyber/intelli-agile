import { motion, useScroll, useSpring } from "framer-motion";
import { SPRING } from "@/lib/motion";

/**
 * ScrollProgressBar — a thin gradient bar pinned to the top of the page that
 * tracks how far down the reader has scrolled.
 */
export function ScrollProgressBar() {
  const { scrollYProgress } = useScroll();
  // `SPRING.gentle` rather than a local spring. A progress bar is driven
  // continuously by scroll position, so it needs the settled preset to stay
  // glued to the reading position instead of trailing and catching up — the
  // old local values were very over-damped (ratio ~2.07), which made it feel
  // like it was lagging rather than smoothing.
  const scaleX = useSpring(scrollYProgress, SPRING.gentle);

  return (
    <motion.div
      aria-hidden="true"
      style={{ scaleX }}
      className="fixed inset-x-0 top-0 z-[60] h-[3px] origin-left aie-gradient"
    />
  );
}
