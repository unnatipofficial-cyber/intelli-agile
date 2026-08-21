import { createContext, useContext, useEffect, useState, useCallback } from "react";
import type { ReactNode } from "react";

export type ThemeMode = "light" | "dark";
export type AppTheme = "graphite" | "modern-minimal";

interface ThemeContextValue {
  /** Light or dark mode */
  theme: ThemeMode;
  toggleTheme: () => void;

  /** Visual theme variant */
  appTheme: AppTheme;
  setAppTheme: (t: AppTheme) => void;
}

const ThemeContext = createContext<ThemeContextValue>({
  theme: "light",
  toggleTheme: () => {},
  appTheme: "graphite",
  setAppTheme: () => {},
});

export function ThemeProvider({ children }: { children: ReactNode }) {
  /* ── Light / Dark ─────────────────────────────────────────── */
  const [theme, setTheme] = useState<ThemeMode>(() => {
    if (typeof window !== "undefined") {
      const stored = localStorage.getItem("aie-mode");
      if (stored === "dark" || stored === "light") return stored;
    }
    return "light";
  });

  /* ── App theme variant ────────────────────────────────────── */
  const [appTheme, setAppThemeState] = useState<AppTheme>(() => {
    if (typeof window !== "undefined") {
      const stored = localStorage.getItem("aie-app-theme");
      if (stored === "graphite" || stored === "modern-minimal") return stored;
    }
    return "graphite";
  });

  /* ── Sync to DOM ──────────────────────────────────────────── */
  useEffect(() => {
    const root = document.documentElement;
    root.classList.remove("light", "dark");
    root.classList.add(theme);
    root.setAttribute("data-theme", appTheme);
    localStorage.setItem("aie-mode", theme);
    localStorage.setItem("aie-app-theme", appTheme);
  }, [theme, appTheme]);

  const toggleTheme = () => setTheme((t) => (t === "light" ? "dark" : "light"));
  const setAppTheme = useCallback((t: AppTheme) => setAppThemeState(t), []);

  return (
    <ThemeContext.Provider value={{ theme, toggleTheme, appTheme, setAppTheme }}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  return useContext(ThemeContext);
}
