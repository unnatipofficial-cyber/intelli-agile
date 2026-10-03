import { describe, expect, test } from "bun:test";
import {
  DURATION,
  EASING,
  SPRING,
  STAGGER,
  prefersReducedMotion,
  resolveMotion,
  staggerDelay,
} from "../lib/motion";

/**
 * The motion tokens are the product's character. These tests pin the properties
 * that keep it professional: durations ordered by importance, easings that
 * cannot overshoot, and a stagger that caps so long lists don't trickle.
 */
describe("DURATION", () => {
  test("is ordered by how much attention the motion deserves", () => {
    // Inversion here would mean a tooltip animating slower than a route change.
    expect(DURATION.instant).toBeLessThan(DURATION.quick);
    expect(DURATION.quick).toBeLessThan(DURATION.enter);
    expect(DURATION.enter).toBeLessThan(DURATION.reveal);
    expect(DURATION.reveal).toBeLessThan(DURATION.transition);
    expect(DURATION.transition).toBeLessThan(DURATION.ambient);
  });

  test("keeps every interactive motion under half a second", () => {
    // Above ~500ms an interface feels sluggish on repeat use. `ambient` is
    // excluded deliberately: it loops, so its duration is a rhythm, not a wait.
    const interactive = [
      DURATION.instant,
      DURATION.quick,
      DURATION.enter,
      DURATION.reveal,
      DURATION.transition,
    ];
    for (const d of interactive) {
      expect(d).toBeLessThan(0.5);
      expect(d).toBeGreaterThan(0);
    }
  });

  test("has no zero-duration value, which would render as an instant jump", () => {
    for (const d of Object.values(DURATION)) {
      expect(d).toBeGreaterThan(0);
    }
  });
});

describe("EASING", () => {
  test("every curve has two interior control points", () => {
    // CSS cubic-bezier(x1,y1,x2,y2) control points are interior: the curve
    // always starts at (0,0) and ends at (1,1) implicitly. Asserting
    // curve[0] === 0 would be wrong — it is x1, not the start point.
    for (const curve of Object.values(EASING)) {
      expect(curve).toHaveLength(4);
    }
  });

  test("every curve ends its interior control on y = 1", () => {
    // x2 = 1 means the curve arrives at full value exactly at the end. A
    // trailing y2 below 1 would leave the element permanently short of its
    // final position — a genuinely common authoring slip.
    for (const curve of Object.values(EASING)) {
      expect(curve[3]).toBe(1);
    }
  });

  test("the exit curve starts moving immediately", () => {
    // A dismissal should front-load its motion, so x1 is above 0: it begins
    // travelling at once rather than sitting still then jumping.
    expect(EASING.exit[0]).toBeGreaterThan(0);
  });

  test("every control point stays in the 0..1 unit square", () => {
    // Values outside it cause the browser to extrapolate, which is where
    // springy overshoot creeps back in from an "easing" curve.
    for (const curve of Object.values(EASING)) {
      for (const point of curve) {
        expect(point).toBeGreaterThanOrEqual(0);
        expect(point).toBeLessThanOrEqual(1);
      }
    }
  });

  test("has no overshoot curve", () => {
    // The whole point of the system: no bounce. Asserted explicitly so adding
    // one is a deliberate act that breaks this test rather than a silent change.
    const names = Object.keys(EASING);
    for (const forbidden of ["back", "elastic", "bounce"]) {
      expect(names).not.toContain(forbidden);
    }
  });
});

describe("SPRING", () => {
  /** dampingRatio = damping / (2 * sqrt(stiffness * mass)) */
  const ratio = (s: { stiffness: number; damping: number; mass?: number }) =>
    s.damping / (2 * Math.sqrt(s.stiffness * (s.mass ?? 1)));

  test("springs are damped enough not to ring", () => {
    // >= 1 means no overshoot; anything meaningfully below reads as bounce on
    // daily use.
    for (const s of Object.values(SPRING)) {
      expect(ratio(s)).toBeGreaterThanOrEqual(1);
    }
  });

  test("springs are not over-damped into a visible lag", () => {
    // The opposite failure is easy to introduce when tuning by feel: a ratio
    // of 2+ is so stiff-looking it appears to trail the thing it is tracking.
    // This is the range that glides and still settles.
    for (const s of Object.values(SPRING)) {
      expect(ratio(s)).toBeLessThan(1.5);
    }
  });

  test("snappy settles faster than gentle", () => {
    // Both are exposed as named presets, so their relative character is part
    // of the contract rather than an accident.
    expect(SPRING.snappy.stiffness).toBeGreaterThan(SPRING.gentle.stiffness);
  });
});

describe("staggerDelay", () => {
  test("increases with the index", () => {
    expect(staggerDelay(0)).toBe(0);
    expect(staggerDelay(1)).toBeGreaterThan(staggerDelay(0));
    expect(staggerDelay(4)).toBeGreaterThan(staggerDelay(1));
  });

  test("caps so a long list does not trickle", () => {
    // Without the cap, item 60 starts ~2s after item 0 and the page appears to
    // load progressively — the classic tell of an unconsidered stagger.
    expect(staggerDelay(1000)).toBe(staggerDelay(STAGGER.cap));
    expect(staggerDelay(1000)).toBeLessThan(0.5);
  });

  test("never returns a negative delay for a nonsense index", () => {
    expect(staggerDelay(-5)).toBeGreaterThanOrEqual(0);
  });
});

describe("prefersReducedMotion", () => {
  test("is false where matchMedia does not exist", () => {
    // Ssr-safe: a server render must not disagree with the client.
    expect(prefersReducedMotion()).toBe(false);
  });
});

describe("resolveMotion", () => {
  const variants = {
    initial: { opacity: 0, y: 12, scale: 0.9, rotate: 4 },
    animate: {
      opacity: 1,
      y: 0,
      scale: 1,
      transition: { duration: 0.42, ease: EASING.standard },
    },
  };

  test("passes variants through untouched when motion is allowed", () => {
    expect(resolveMotion(variants, false)).toEqual(variants);
  });

  test("strips travel but keeps opacity", () => {
    // The design decision: a reduced-motion user still sees elements appear
    // and disappear. Snapping straight to the final frame breaks the visual
    // link between an action and its result.
    const out = resolveMotion(variants, true) as Record<string, Record<string, unknown>>;
    expect(out.initial).toEqual({ opacity: 0 });
    expect(out.animate).toEqual({ opacity: 1 });
  });

  test("removes x, y, scale and rotate specifically", () => {
    const out = resolveMotion(variants, true) as Record<string, Record<string, unknown>>;
    for (const key of ["x", "y", "scale", "rotate"]) {
      expect(out.initial).not.toHaveProperty(key);
      expect(out.animate).not.toHaveProperty(key);
    }
  });

  test("drops the transition so a caller cannot reintroduce travel", () => {
    const out = resolveMotion(variants, true) as Record<string, Record<string, unknown>>;
    expect(out.animate).not.toHaveProperty("transition");
  });

  test("preserves non-object entries such as custom", () => {
    const withCustom = { initial: { opacity: 0, y: 4 }, custom: 7 };
    const out = resolveMotion(withCustom, true) as Record<string, unknown>;
    expect(out.custom).toBe(7);
    expect(out.initial).toEqual({ opacity: 0 });
  });

  test("does not mutate the input", () => {
    const input = { initial: { opacity: 0, y: 12 } };
    const snapshot = JSON.stringify(input);
    resolveMotion(input, true);
    expect(JSON.stringify(input)).toBe(snapshot);
  });

  test("keeps colour and blur properties", () => {
    // Only spatial travel is removed; visual properties are not motion.
    const out = resolveMotion(
      { animate: { backgroundColor: "#fff", filter: "blur(4px)", x: 20 } },
      true,
    ) as Record<string, Record<string, unknown>>;
    expect(out.animate).toEqual({ backgroundColor: "#fff", filter: "blur(4px)" });
  });
});