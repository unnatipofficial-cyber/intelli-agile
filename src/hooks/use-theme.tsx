import { createContext, useContext, useEffect, useState, useCallback } from "react";
import type { ReactNode } from "react";

export type ThemeMode = "light" | "dark";
export type AppTheme = "graphite" | "modern-minimal" | "darkmatter";

/** Where the chosen visual theme is persisted between visits. */
export const APP_THEME_STORAGE_KEY = "aie-app-theme";

/**
 * The theme a first-time visitor gets.
 *
 * Only ever used when `aie-app-theme` holds nothing usable: a stored
 * preference always wins, so switching themes and coming back keeps the
 * choice rather than snapping to the default again.
 */
export const DEFAULT_APP_THEME: AppTheme = "darkmatter";

/**
 * Reads a previously saved theme preference.
 *
 * Returns `null` when there is nothing usable stored — no key, an
 * unrecognised value, or no DOM (server render). The caller then decides what
 * the fallback is, which keeps "no saved preference" a single, explicit branch
 * rather than a hard-coded default buried in three places.
 */
export function readStoredAppTheme(
  storage: Pick<Storage, "getItem"> | null = typeof window === "undefined" ? null : window.localStorage,
): AppTheme | null {
  if (!storage) return null;
  const stored = storage.getItem(APP_THEME_STORAGE_KEY);
  if (stored === "graphite" || stored === "modern-minimal" || stored === "darkmatter") return stored;
  return null;
}

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
  appTheme: DEFAULT_APP_THEME,
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
  return pathname === "/" || pathname === "/guide" || pathname.startsWith("/auth");
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
  const [appTheme, setAppThemeState] = useState<AppTheme>(
    () => readStoredAppTheme() ?? DEFAULT_APP_THEME,
  );

  /* ── Sync to DOM ──────────────────────────────────────────── */
  useEffect(() => {
    const root = document.documentElement;
    const applied: ThemeMode = darkOnly ? "dark" : theme;
    root.classList.remove("light", "dark");
    root.classList.add(applied);
    root.setAttribute("data-theme", appTheme);
    // Only the user's own choice is persisted; the dark-only pin is transient.
    localStorage.setItem("aie-mode", theme);
    localStorage.setItem(APP_THEME_STORAGE_KEY, appTheme);
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
}/**
 * Pins the app to the dark surface for as long as the calling page is mounted.
 *
 * Used by the public pages (landing, guide, sign in), which are authored
 * against a night sky and therefore render the dark variant of whatever visual
 * theme is active. The palette itself is *not* pinned — that is what lets the
 * theme selector stay in sync with the rest of the app — and the user's stored
 * `aie-mode` is never modified, so the dashboard keeps working with light,
 * dark or either appearance exactly as before.
 */
export function useDarkSurface() {
  const { setDarkOnly } = useTheme();

  useEffect(() => {
    setDarkOnly(true);
    return () => setDarkOnly(false);
  }, [setDarkOnly]);
}
