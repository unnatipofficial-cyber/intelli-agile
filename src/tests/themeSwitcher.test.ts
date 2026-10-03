import { describe, expect, test } from "bun:test";
import {
  APP_THEME_STORAGE_KEY,
  DEFAULT_APP_THEME,
  isDarkSurfaceRoute,
  readStoredAppTheme,
} from "../hooks/use-theme";
import { THEME_OPTIONS } from "../components/ThemeSwitcher";

/**
 * Two promises live in this file.
 *
 * 1. A first-time visitor gets Darkmatter, and a visitor who already chose a
 *    theme keeps it — the default must never overwrite a saved preference.
 * 2. The traffic-light control shows the three theme identities in the right
 *    colours: charcoal / blue / amber. Never the macOS red-yellow-green, which
 *    would be an instant "this is a window control" misread.
 */

/** Minimal stand-in for the one Storage method the reader uses. */
function storageWith(value: string | null): Pick<Storage, "getItem"> {
  return { getItem: () => value };
}

describe("default theme", () => {
  test("a visitor with no saved preference gets Darkmatter", () => {
    expect(DEFAULT_APP_THEME).toBe("darkmatter");
    expect(readStoredAppTheme(storageWith(null))).toBeNull();
  });

  test("a saved preference always wins over the default", () => {
    for (const stored of ["graphite", "modern-minimal", "darkmatter"] as const) {
      expect(readStoredAppTheme(storageWith(stored))).toBe(stored);
    }
  });

  test("an unrecognised saved value falls back to the default, not a broken theme", () => {
    expect(readStoredAppTheme(storageWith("solarized"))).toBeNull();
    expect(readStoredAppTheme(storageWith(""))).toBeNull();
  });

  test("is safe without a DOM (server render)", () => {
    expect(readStoredAppTheme(null)).toBeNull();
  });

  test("keeps using the existing storage key rather than adding another", () => {
    expect(APP_THEME_STORAGE_KEY).toBe("aie-app-theme");
  });
});

describe("dark surface routes", () => {
  test("the public pages render the dark variant of the active theme", () => {
    expect(isDarkSurfaceRoute("/")).toBe(true);
    expect(isDarkSurfaceRoute("/guide")).toBe(true);
    expect(isDarkSurfaceRoute("/auth")).toBe(true);
  });

  test("the workspace keeps honouring the visitor's light/dark preference", () => {
    expect(isDarkSurfaceRoute("/dashboard")).toBe(false);
    expect(isDarkSurfaceRoute("/dashboard/settings")).toBe(false);
  });
});

describe("theme switcher options", () => {
  const rgb = (hex: string) => {
    const value = parseInt(hex.slice(1), 16);
    return [(value >> 16) & 255, (value >> 8) & 255, value & 255] as const;
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

  test("exposes exactly the three themes, in order", () => {
    expect(THEME_OPTIONS.map((option) => option.id)).toEqual([
      "graphite",
      "modern-minimal",
      "darkmatter",
    ]);
    for (const option of THEME_OPTIONS) {
      expect(option.name.length).toBeGreaterThan(0);
      expect(option.hint.length).toBeGreaterThan(0);
    }
  });

  test("Graphite reads as dark charcoal — neutral, and dark enough to stay visible", () => {
    const graphite = THEME_OPTIONS[0].swatch;
    const [r, g, b] = rgb(graphite);
    // Dark: every channel low, so the dot does not vanish into the night-sky
    // navbar it sits on.
    expect(Math.max(r, g, b)).toBeLessThan(80);
    // Neutral: the channels are within a hair of each other. Asserted as a
    // spread rather than a hue — at this brightness a hue angle is noise
    // (a 10-point spread still reports ~210°), while saturation is the thing
    // that actually reads as "grey" to the eye.
    const spread = Math.max(r, g, b) - Math.min(r, g, b);
    expect(spread).toBeLessThanOrEqual(16);
    expect(spread / Math.max(r, g, b)).toBeLessThan(0.3);
  });

  test("Modern Minimal reads blue", () => {
    expect(hue(THEME_OPTIONS[1].swatch)).toBeGreaterThan(200);
    expect(hue(THEME_OPTIONS[1].swatch)).toBeLessThan(250);
  });

  test("Darkmatter reads warm amber", () => {
    expect(hue(THEME_OPTIONS[2].swatch)).toBeGreaterThan(15);
    expect(hue(THEME_OPTIONS[2].swatch)).toBeLessThan(45);
  });

  test("never uses the macOS red / yellow / green the reference image shows", () => {
    // Shape is borrowed from the window controls; colour is not. If someone
    // "fixes" the dots to the system palette, this fails.
    const forbidden = ["#ff5f57", "#febc2e", "#28c840", "red", "yellow", "green"];
    for (const option of THEME_OPTIONS) {
      expect(forbidden).not.toContain(option.swatch);
      expect(option.swatch.startsWith("#")).toBe(true);
    }
  });
});