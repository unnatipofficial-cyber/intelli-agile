/**
 * AIE motion system.
 *
 * One vocabulary for how things move, so the product feels like one product.
 *
 * Two rules shape everything here, and both come from this being a tool people
 * work in all day rather than a page they visit once:
 *
 *  1. Duration is a function of distance and importance, not taste. A tooltip
 *     fades in faster than a dialog, and both are faster than a route change.
 *     Fixed 300ms-everything is the single clearest tell of an amateur UI.
 *
 *  2. Motion is mostly *consistency*. Below ~400ms nobody consciously notices
 *     an animation; they notice when two things that should feel identical
 *     don't. So the tokens below are deliberately few.
 *
 * Deliberately absent: springs with overshoot on structural UI. Bounce on
 * something you interact with daily reads as toy-like within an hour. Springs
 * stay for direct-manipulation surfaces where momentum is physically honest
 * (the dock's magnification follows a finger), and even there they are
 * critically damped — see SPRINGS.
 *
 * Every consumer should reach for `resolveMotion` so reduced-motion support is
 * a property of the token rather than a responsibility of each call site.
 */

/** Seconds. Named by what the motion *is*, not how long it is. */
export const DURATION = {
  /** Hover, focus rings, colour and opacity changes on an existing element. */
  instant: 0.12,
  /** Small state swaps: a button press, a checkbox, a row selection. */
  quick: 0.18,
  /** Things appearing in place: dropdowns, tooltips, popovers, toasts. */
  enter: 0.24,
  /** Elements entering a layout that reflows around them: dialogs, sheets. */
  reveal: 0.32,
  /** A whole view or panel changing: route transitions, page-level reveals. */
  transition: 0.42,
  /** Ambient loops. Slow enough to never pull focus while work happens. */
  ambient: 0.9,
} as const;

/**
 * Cubic-bezier control points.
 *
 * `standard` is the workhorse: a fast start that settles without overshoot. It
 * reads as "immediate" on press and "considered" on arrival, which is exactly
 * the professional register. `emphasised` is for larger surfaces that earn a
 * little more travel. `exit` front-loads its motion so a dismissal feels
 * finished rather than lingering.
 *
 * Note there is no `back`/`elastic`/`bounce` curve. See the file header.
 */
export const EASING = {
  standard: [0.2, 0, 0, 1],
  emphasised: [0.32, 0.72, 0, 1],
  exit: [0.4, 0, 1, 1],
} as const;

/**
 * Framer Motion spring presets, in `stiffness / damping` pairs.
 *
 * All are critically damped or just under (`damping ≈ 2·√stiffness`), so they
 * arrive without ringing. `snappy` is the default for anything the pointer is
 * driving directly; `gentle` is for a large panel settling after a route
 * change, where a little more travel is warranted.
 */
export const SPRING = {
  snappy: { stiffness: 420, damping: 35, mass: 0.7 },
  gentle: { stiffness: 220, damping: 29, mass: 0.9 },
} as const;

/**
 * Stagger for lists and grids.
 *
 * `step` is the gap between siblings and `cap` bounds how far the cascade can
 * run. Without a cap, a 60-row table starts its last row ~700ms after the first
 * and the page appears to load progressively — a classic amateur artefact.
 * Capping means rows past the cap simply appear together, which reads as "the
 * rest arrived at once" instead of "something is still coming".
 */
export const STAGGER = {
  step: 0.035,
  cap: 8,
} as const;

/**
 * The transition for the `index`th item of a hand-rolled stagger.
 *
 * Several pages stagger their cards inline with `transition={{ delay: n }}`,
 * which silently leaves Framer's default duration and easing in place and
 * invites hand-picked delays like 0.1 / 0.2 / 0.3. Those accumulate: a fifth
 * card was arriving ~800ms after the page did, which is what makes a dashboard
 * feel sluggish rather than crafted. This pairs the capped, uniform delay
 * with the real duration and curve.
 */
export function staggeredEnter(index: number) {
  return {
    duration: DURATION.enter,
    ease: EASING.standard,
    delay: staggerDelay(index),
  } as const;
}

/**
 * The delay for the item at `index` in a staggered group.
 *
 * Clamped at both ends: the upper bound caps the cascade so a long list
 * resolves in one beat, and the lower bound keeps a nonsense index (a `map`
 * over an undefined-shaped array, an off-by-one) from producing a *negative*
 * delay, which would start the child mid-animation and pop it into place.
 */
export function staggerDelay(index: number): number {
  const safeIndex = Number.isFinite(index) ? index : 0;
  return Math.max(0, Math.min(safeIndex, STAGGER.cap)) * STAGGER.step;
}

/* ── Reduced motion ──────────────────────────────────────────────── */

/**
 * Read the OS motion preference.
 *
 * Ssr-safe: returns false where `matchMedia` does not exist, so a server render
 * never disagrees with the client about which variant to use.
 */
export function prefersReducedMotion(): boolean {
  if (typeof window === "undefined" || typeof window.matchMedia !== "function") {
    return false;
  }
  try {
    return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  } catch {
    return false;
  }
}

/**
 * The whole point of this module: one branch that every animation honours.
 *
 * Under reduced motion we keep the *state change* and drop the *travel* —
 * elements still swap, fade and appear, they just stop moving through space.
 * Snapping straight to the final frame would be worse: it breaks the visual
 * link between an action and its result, and for a layout change it looks like
 * a glitch rather than a decision.
 */
export function resolveMotion<T extends Record<string, unknown>>(
  variants: T,
  reduced = prefersReducedMotion(),
): T {
  if (!reduced) return variants;
  return Object.fromEntries(
    Object.entries(variants).map(([key, value]) => {
      if (!value || typeof value !== "object") return [key, value];
      const v = value as Record<string, unknown>;
      // Drop displacement, keep opacity. Also drop any custom transition so a
      // caller cannot reintroduce travel through its own transition block.
      const next: Record<string, unknown> = {};
      for (const [prop, val] of Object.entries(v)) {
        if (prop === "x" || prop === "y" || prop === "scale" || prop === "rotate") continue;
        if (prop === "transition") continue;
        next[prop] = val;
      }
      return [key, next];
    }),
  ) as T;
}