/**
 * Read a CSS custom property from :root at runtime.
 * Returns the raw value (e.g. "#3b82f6") so chart libraries can consume it.
 */
export function cssVar(name: string): string {
  if (typeof window === "undefined") return "#888888";
  return getComputedStyle(document.documentElement).getPropertyValue(name).trim() || "#888888";
}

/** Convenience: read several variables at once. */
export function cssVars(...names: string[]): string[] {
  return names.map(cssVar);
}
