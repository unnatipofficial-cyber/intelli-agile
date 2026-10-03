import { createContext, useContext, useEffect, useState, useCallback } from "react";
import type { ReactNode } from "react";

export type ThemeMode = "light" | "dark";
export type AppTheme = "graphite" | "modern-minimal" | "darkmatter";

interface ThemeContextValue {
  /** Light or dark mode — the mode actually applied to <html>. */
  theme: ThemeMode;
  toggleTheme: () => void;

  /** Visual theme variant */
  appTheme: AppTheme;
  setAppTheme: (t: AppTheme) => void;

  /**
   * True while a page has pinned the app to dark (see `useDarkSurface`).
   * The stored light/dark preference is left untouched.
   */
  darkOnly: boolean;
  setDarkOnly: (value: boolean) => void;
}

const ThemeContext = createContext<ThemeContextValue>({
  theme: "light",
  toggleTheme: () => {},
  appTheme: "graphite",
  setAppTheme: () => {},
  darkOnly: false,
  setDarkOnly: () => {},
});

/**
 * Routes that are dark-only by design: the landing page and the sign-in flows.
 *
 * `ThemeProvider` sits above the router (so it has no access to route hooks),
 * which is why this reads `window.location` — it is only used for the very
 * first render, before any page has mounted, so the dark surface is already in
 * place on first paint instead of flashing light. Everything after that is
 * driven by `useDarkSurface` on the page itself.
 */
export function isDarkSurfaceRoute(pathname: string): boolean {
  return pathname === "/" || pathname.startsWith("/auth");
}

export function ThemeProvider({ children }: { children: ReactNode }) {
  /* ── Light / Dark ─────────────────────────────────────────── */
  const [theme, setTheme] = useState<ThemeMode>(() => {
    if (typeof window !== "undefined") {
      const stored = localStorage.getItem("aie-mode");
      if (stored === "dark" || stored === "light") return stored;
    }
    return "light";
  });

  /* ── Dark-only pages ──────────────────────────────────────── */
  const [darkOnly, setDarkOnlyState] = useState(() => {
    if (typeof window === "undefined") return false;
    return isDarkSurfaceRoute(window.location.pathname);
  });

  /* ── App theme variant ────────────────────────────────────── */
  const [appTheme, setAppThemeState] = useState<AppTheme>(() => {
    if (typeof window !== "undefined") {
      const stored = localStorage.getItem("aie-app-theme");
      if (stored === "graphite" || stored === "modern-minimal" || stored === "darkmatter") return stored;
    }
    return "graphite";
  });

  /* ── Sync to DOM ──────────────────────────────────────────── */
  useEffect(() => {
    const root = document.documentElement;
    const applied: ThemeMode = darkOnly ? "dark" : theme;
    root.classList.remove("light", "dark");
    root.classList.add(applied);
    root.setAttribute("data-theme", appTheme);
    // Only the user's own choice is persisted; the dark-only pin is transient.
    localStorage.setItem("aie-mode", theme);
    localStorage.setItem("aie-app-theme", appTheme);
  }, [theme, appTheme, darkOnly]);

  const toggleTheme = () => setTheme((t) => (t === "light" ? "dark" : "light"));
  const setAppTheme = useCallback((t: AppTheme) => setAppThemeState(t), []);
  const setDarkOnly = useCallback((value: boolean) => setDarkOnlyState(value), []);

  return (
    <ThemeContext.Provider
      value={{
        theme: darkOnly ? "dark" : theme,
        toggleTheme,
        appTheme,
        setAppTheme,
        darkOnly,
        setDarkOnly,
      }}
    >
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  return useContext(ThemeContext);
}  /**
   * Pins the app to the dark surface for as long as the calling page is mounted.
   *
   * Used by the public pages (landing, sign in) which are dark-only in every
   * appearance theme. The user's stored `aie-mode` is never modified, so the
   * dashboard and every other page keep working with light, dark or either
   * appearance theme exactly as before.
   */
export function useDarkSurface() {
  const { setDarkOnly } = useTheme();

  useEffect(() => {
    setDarkOnly(true);
    return () => setDarkOnly(false);
  }, [setDarkOnly]);
}

/**
 * Pins the app to the dark **graphite** surface for as long as the calling page
 * is mounted — the landing page's cinematic Earth sequence is authored against
 * the graphite palette specifically, so the whole page is always graphite on the
 * public pages, regardless of whatever the user may have saved on their device.
 *
 * The transient pin touches neither the stored `aie-mode` nor the stored
 * `aie-app-theme`: the dashboard and every other page keep behaving exactly as
 * before once this page unmounts.
 */
export function useGraphiteSurface() {
  const { appTheme, setDarkOnly, setAppTheme } = useTheme();

  useEffect(() => {
    // Captured on mount so the visitor's own appearance theme survives the
    // landing page instead of being flattened to graphite for good.
    const restoreTo = appTheme;
    setDarkOnly(true);
    // Always graphite for the duration of this page. The hook is only ever
    // called from the public marketing pages (landing and the product guide),
    // which share the graphite starfield chrome.
    setAppTheme("graphite");
    return () => {
      setDarkOnly(false);
      setAppTheme(restoreTo);
    };
    // appTheme is deliberately not a dependency: it is the value to restore,
    // read once when the page mounts.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [setDarkOnly, setAppTheme]);
}
