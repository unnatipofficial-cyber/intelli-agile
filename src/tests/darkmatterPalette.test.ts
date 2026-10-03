import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";

/**
 * Darkmatter vs Graphite, asserted against the stylesheet itself.
 *
 * These two themes drifted together once because both are "dark": swapping
 * tokens changed the accent while the background stayed the same black, so
 * the landing page looked identical under either. The fix is a palette
 * difference, so that is what is pinned here — Graphite's neutrality (which
 * must never be "fixed" by darkening it) and Darkmatter's blue-cast, near
 * black identity, plus the legibility floors that stop an atmospheric theme
 * from becoming an unreadable one.
 */

const css = readFileSync(new URL("../index.css", import.meta.url), "utf8");

/** Reads the custom properties declared inside a rule's block. */
function tokensFor(selector: string): Record<string, string> {
  const start = css.indexOf(selector);
  expect(start, `selector not found in index.css: ${selector}`).toBeGreaterThan(-1);
  const open = css.indexOf("{", start);
  const close = css.indexOf("}", open);
  const tokens: Record<string, string> = {};
  for (const match of css.slice(open + 1, close).matchAll(/--([a-z0-9-]+):\s*([^;]+);/g)) {
    tokens[match[1]] = match[2].trim();
  }
  return tokens;
}

const rgb = (hex: string) => {
  const value = parseInt(hex.trim().replace("#", ""), 16);
  return [(value >> 16) & 255, (value >> 8) & 255, value & 255] as const;
};

/** WCAG relative luminance. */
const luminance = (hex: string) => {
  const [r, g, b] = rgb(hex).map((channel) => {
    const c = channel / 255;
    return c <= 0.04045 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
  });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
};

/** Contrast ratio between two hex colours, 1..21. */
const contrast = (a: string, b: string) => {
  const [light, dark] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (light + 0.05) / (dark + 0.05);
};

/** Hue in degrees; -1 means achromatic (grey). */
const hue = (hex: string) => {
  const [r, g, b] = rgb(hex);
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const delta = max - min;
  if (delta === 0) return -1;
  let h: number;
  if (max === r) h = ((g - b) / delta) % 6;
  else if (max === g) h = (b - r) / delta + 2;
  else h = (r - g) / delta + 4;
  return ((h * 60) % 360 + 360) % 360;
};

const darkmatter = tokensFor('.dark[data-theme="darkmatter"]');
const graphite = tokensFor('.dark[data-theme="graphite"]');

describe("Graphite is left alone", () => {
  test("keeps its neutral, monochrome identity", () => {
    // A tempting "fix" for two similar dark themes is to darken one of them.
    // Graphite's restraint is the design, so its exact values are pinned.
    expect(graphite["background"]).toBe("#1a1a1a");
    expect(graphite["card"]).toBe("#202020");
    expect(graphite["aie-accent"]).toBe("#606060");
    expect(graphite["chart-1"]).toBe("#a0a0a0");
  });

  test("stays grey — every surface channel identical", () => {
    for (const token of ["background", "card", "muted", "border"]) {
      const [r, g, b] = rgb(graphite[token]);
      expect(Math.max(r, g, b) - Math.min(r, g, b)).toBe(0);
    }
  });

  test("has no atmospheric overrides of its own on the public sky", () => {
    const graphiteSkyRules = css.match(/\[data-theme="graphite"\][^{]*\.space-[a-z-]+/g) ?? [];
    expect(graphiteSkyRules).toHaveLength(0);
  });
});

describe("Darkmatter reads as its own night", () => {
  test("has a near-black base with a blue cast", () => {
    const [r, g, b] = rgb(darkmatter["background"]);
    expect(Math.max(r, g, b)).toBeLessThan(20); // near-black
    expect(b).toBeGreaterThan(r); // blue-black, not neutral
    expect(b).toBeGreaterThan(g);
    // Measurably not grey: the blue channel leads by a visible margin.
    expect(b - r).toBeGreaterThanOrEqual(4);
  });

  test("uses blue-black surfaces and cool borders, not greys", () => {
    for (const token of ["card", "muted", "accent", "border", "sidebar"]) {
      const [r, g, b] = rgb(darkmatter[token]);
      expect(b, `${token} should be blue-cast`).toBeGreaterThanOrEqual(r);
    }
  });

  test("keeps the warm amber that identifies the theme", () => {
    expect(darkmatter["primary"]).toBe("#f09050");
    expect(hue(darkmatter["primary"])).toBeGreaterThan(15);
    expect(hue(darkmatter["primary"])).toBeLessThan(45);
  });

  test("uses the reference status palette for charts and status", () => {
    // coral #F08090 · aqua #90E0E0 · peach #F0D0B0 · cream #E0E0C0
    const charts = [darkmatter["chart-1"], darkmatter["chart-2"], darkmatter["chart-3"], darkmatter["chart-4"], darkmatter["chart-5"]].map((c) =>
      c.toLowerCase(),
    );
    for (const reference of ["#f08090", "#90e0e0", "#f0d0b0", "#e0e0c0"]) {
      expect(charts).toContain(reference);
    }
    expect(darkmatter["destructive"].toLowerCase()).toBe("#f08090");
    expect(darkmatter["secondary"].toLowerCase()).toBe("#90e0e0");
  });

  test("owns the sky on the public pages, unlike Graphite", () => {
    for (const layer of ["space-backdrop", "space-nebula", "space-sunset-tint"]) {
      expect(css).toContain(`.dark[data-theme="darkmatter"] .${layer}`);
    }
  });

  test("takes over the guide's preview panels, which are authored as graphite", () => {
    // Left on the graphite constants, the eleven mock frames on the guide
    // would stay neutral grey under both dark themes — the surface half of
    // "the two themes look the same".
    expect(css).toContain('.dark[data-theme="darkmatter"] .aie-graphite-panel');
    expect(css).toContain('.dark[data-theme="darkmatter"] .aie-graphite-rule');
    const graphitePanelRules = css.match(/\[data-theme="graphite"\][^{]*\.aie-graphite-/g) ?? [];
    expect(graphitePanelRules).toHaveLength(0);
  });
});

describe("Darkmatter stays legible", () => {
  test("body text has strong contrast on the near-black base", () => {
    expect(contrast(darkmatter["foreground"], darkmatter["background"])).toBeGreaterThan(7);
  });

  test("secondary text clears the WCAG AA floor", () => {
    expect(contrast(darkmatter["muted-foreground"], darkmatter["background"])).toBeGreaterThan(4.5);
  });

  test("cards and borders separate from the background without shouting", () => {
    expect(luminance(darkmatter["card"])).toBeGreaterThan(luminance(darkmatter["background"]));
    // Visible, but still a hairline rather than a hard outline.
    expect(contrast(darkmatter["border"], darkmatter["background"])).toBeGreaterThan(1.3);
  });

  test("the amber accent is readable as text on the base", () => {
    expect(contrast(darkmatter["primary"], darkmatter["background"])).toBeGreaterThan(4.5);
  });
});