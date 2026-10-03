import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { useLocation } from "react-router";
import type { ReactNode } from "react";
import { pageVariants } from "@/lib/motion-variants";

/**
 * PageTransition — the seam between one view and the next.
 *
 * Navigation in a workspace tool is frequent, so this is the single most
 * important piece of motion in the app: it is what makes moving between
 * screens feel like one continuous surface rather than a page reload.
 *
 * Two decisions worth stating:
 *
 *  - The travel is 6px and the duration 420ms. Both are near the ceiling for
 *    something that fires on every click. A route transition is not an
 *    opportunity to show off; the user's next task should be visible almost
 *    immediately.
 *
 *  - It is keyed on `pathname` only, never on search or hash. Those change
 *    while someone is clicking filters, and re-animating on every filter
 *    change would make a page feel like it is reloading constantly. The
 *    content re-renders without the entrance, which is correct: the layout
 *    updated in place, it did not arrive.
 *
 * `mode="wait"` holds the outgoing view until the incoming one starts, so
 * the two never overlap into a smeared double-image.
 */
export function PageTransition({ children }: { children: ReactNode }) {
  const location = useLocation();
  const reducedMotion = useReducedMotion();

  return (
    <AnimatePresence mode="wait" initial={false}>
      <motion.div
        key={location.pathname}
        variants={pageVariants}
        initial="initial"
        animate="animate"
        exit="exit"
        // Framer's own reduced-motion support would skip the whole subtree;
        // we instead rely on `pageVariants`, which has already had its travel
        // stripped and keeps the opacity change. See resolveMotion.
        style={reducedMotion ? undefined : { willChange: "transform, opacity" }}
      >
        {children}
      </motion.div>
    </AnimatePresence>
  );
}