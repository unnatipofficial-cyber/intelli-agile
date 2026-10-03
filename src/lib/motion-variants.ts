import type { Transition, Variants } from "framer-motion";
import {
  DURATION,
  EASING,
  SPRING,
  STAGGER,
  resolveMotion,
  staggerDelay,
} from "@/lib/motion";

/**
 * Ready-made variants, so a page gets AIE's motion character by importing
 * rather than by remembering numbers.
 *
 * Every export goes through `resolveMotion`, which is what guarantees a
 * reduced-motion user never sees travel regardless of whether the call site
 * remembered to check.
 */

const fade = DURATION.enter;

/**
 * A whole page arriving.
 *
 * Short travel and a fast settle: on a route change the user wants to be
 * working, not watching. `y: 6` is deliberately tiny — enough to read as
 * arrival rather than a static frame, small enough that it never delays the
 * content behind it.
 */
export const pageVariants: Variants = resolveMotion({
  initial: { opacity: 0, y: 6 },
  animate: {
    opacity: 1,
    y: 0,
    transition: { duration: DURATION.transition, ease: EASING.standard },
  },
  exit: { opacity: 0, y: -4, transition: { duration: DURATION.quick, ease: EASING.exit } },
});

/**
 * A container that hands each child its own slot in the cascade.
 *
 * `delayChildren` gives the group a beat to establish itself before the first
 * item moves, which reads as "here is the section" rather than "here are some
 * things that happened to appear".
 */
export const listContainerVariants: Variants = resolveMotion({
  initial: {},
  animate: {
    transition: {
      staggerChildren: STAGGER.step,
      delayChildren: 0.04,
    },
  },
});

/**
 * One item inside a `listContainerVariants` group.
 *
 * `custom` is the child's index; pass it as `custom={index}` on each child.
 * The delay is capped by `staggerDelay`, so a long list resolves in one beat
 * rather than trickling for a second and a half.
 */
export const listItemVariants: Variants = {
  initial: { opacity: 0, y: 8 },
  animate: (index: number = 0) => ({
    opacity: 1,
    y: 0,
    transition: {
      duration: DURATION.enter,
      ease: EASING.standard,
      delay: staggerDelay(index),
    },
  }),
};

/**
 * A panel that appears where it already lives — a card, a metric tile, a
 * section header. No `initial` offset beyond a few pixels, because these do not
 * usually replace anything; they just need to register as new.
 */
export const cardVariants: Variants = resolveMotion({
  initial: { opacity: 0, y: 10 },
  animate: {
    opacity: 1,
    y: 0,
    transition: { duration: DURATION.reveal, ease: EASING.standard },
  },
});

/**
 * Overlays: dialogs, popovers, command palette.
 *
 * The backdrop fades on its own clock while the panel takes a little longer,
 * so the two do not move as one flat sheet. Scale stays within 2% — beyond that
 * it starts to read as a zoom effect.
 */
export const overlayVariants: Variants = resolveMotion({
  initial: { opacity: 0, scale: 0.98 },
  animate: {
    opacity: 1,
    scale: 1,
    transition: { duration: DURATION.reveal, ease: EASING.emphasised },
  },
  exit: {
    opacity: 0,
    scale: 0.99,
    transition: { duration: DURATION.quick, ease: EASING.exit },
  },
});

/** Dropdowns and tooltips: appear in place, no travel. */
export const popoverVariants: Variants = resolveMotion({
  initial: { opacity: 0 },
  animate: {
    opacity: 1,
    transition: { duration: fade, ease: EASING.standard },
  },
  exit: { opacity: 0, transition: { duration: DURATION.instant, ease: EASING.exit } },
});

/**
 * Press feedback for a control the pointer is directly on.
 *
 * A 1.5% scale-down is the whole gesture. Anything larger turns a button into
 * a toy; this is just enough to feel mechanically responsive. Springs here are
 * safe precisely because the pointer is driving them — the motion is a
 * consequence of input, not decoration.
 */
export const pressableVariants: Variants = {
  rest: { scale: 1 },
  hover: { scale: 1.015 },
  tap: { scale: 0.985 },
};

/** Transition that pairs with `pressableVariants`. */
export const pressTransition: Transition = {
  type: "spring",
  ...SPRING.snappy,
};

/**
 * An expanding region — a detail sheet, a collapsible section.
 *
 * `height: auto` animation is delegated to Framer, which measures the element;
 * that is more reliable than guessing a pixel height in JS.
 */
export const expandVariants: Variants = resolveMotion({
  collapsed: { opacity: 0, height: 0 },
  expanded: {
    opacity: 1,
    height: "auto",
    transition: { duration: DURATION.reveal, ease: EASING.standard },
  },
});

/**
 * A number that changes in place. Not for count-up flourishes — this is for
 * keeping a metric visually connected to the value it just took.
 */
export const valueSwapVariants: Variants = resolveMotion({
  initial: { opacity: 0, y: -6 },
  animate: { opacity: 1, y: 0, transition: { duration: DURATION.quick } },
  exit: { opacity: 0, y: 6, transition: { duration: DURATION.instant } },
});