import { useEffect, useState } from "react";

/**
 * The subset of theme CSS variables the 3D scene needs.
 *
 * These are read straight from `document.documentElement` so the WebGL scene
 * always matches the active theme (Graphite / Modern Minimal / Darkmatter and
 * light / dark mode) without duplicating the palette in JavaScript.
 */
export interface ThemePalette {
  accent: string;
  accentLight: string;
  accentDark: string;
  glow: string;
  foreground: string;
  muted: string;
}

const FALLBACK: ThemePalette = {
  accent: "#606060",
  accentLight: "#707070",
  accentDark: "#505050",
  glow: "#a0a0a0",
  foreground: "#333333",
  muted: "#666666",
};

const HEX = /^#(?:[0-9a-f]{3}|[0-9a-f]{6})$/i;

function readPalette(): ThemePalette {
  if (typeof window === "undefined" || typeof document === "undefined") {
    return FALLBACK;
  }
  const styles = getComputedStyle(document.documentElement);
  const pick = (name: string, fallback: string): string => {
    const value = styles.getPropertyValue(name).trim();
    // three.js `Color` needs a CSS colour it can parse; the template themes
    // are all hex, but guard anyway so a bad token can never break the scene.
    return HEX.test(value) ? value : fallback;
  };
  return {
    accent: pick("--aie-accent", FALLBACK.accent),
    accentLight: pick("--aie-accent-light", FALLBACK.accentLight),
    accentDark: pick("--aie-accent-dark", FALLBACK.accentDark),
    glow: pick("--aie-glow-color", FALLBACK.glow),
    foreground: pick("--foreground", FALLBACK.foreground),
    muted: pick("--muted-foreground", FALLBACK.muted),
  };
}

/**
 * Reactive view of the theme palette.
 *
 * `ThemeProvider` writes `class` / `data-theme` on <html> from an effect, so a
 * render-time read can be one frame stale. A MutationObserver keeps the palette
 * in sync regardless of effect ordering.
 */
export function useThemePalette(): ThemePalette {
  const [palette, setPalette] = useState<ThemePalette>(readPalette);

  useEffect(() => {
    if (typeof window === "undefined" || typeof MutationObserver === "undefined") {
      return;
    }
    const refresh = () => setPalette(readPalette());
    refresh();
    const observer = new MutationObserver(refresh);
    observer.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ["class", "data-theme", "style"],
    });
    return () => observer.disconnect();
  }, []);

  return palette;
}
