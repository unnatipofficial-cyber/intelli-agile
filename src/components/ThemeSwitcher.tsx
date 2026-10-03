import { useTheme } from "@/hooks/use-theme";
import type { AppTheme } from "@/hooks/use-theme";
import { cn } from "@/lib/utils";

/**
 * ThemeSwitcher — the macOS traffic-light control, recoloured.
 *
 * The shape, size, spacing and compactness are borrowed from the window
 * controls everyone already knows; the colours are not. Each dot wears the
 * accent that identifies its theme — charcoal for Graphite, blue for Modern
 * Minimal, amber for Darkmatter — so the control reads as "these are the three
 * looks of this product" rather than "close / minimise / maximise".
 *
 * It is a view onto the one existing theme system: `useTheme()` is global and
 * `setAppTheme` persists the choice, so the landing page, the guide and the
 * dashboard can never disagree about which theme is active.
 */

export interface ThemeOption {
  id: AppTheme;
  name: string;
  /** One-line description, shown in the tooltip. */
  hint: string;
  /** The dot's colour — the theme's own accent, never a macOS system colour. */
  swatch: string;
}

export const THEME_OPTIONS: ThemeOption[] = [
  {
    id: "graphite",
    name: "Graphite",
    hint: "Monochromatic cool-gray. Sharp and restrained.",
    swatch: "#2f3439",
  },
  {
    id: "modern-minimal",
    name: "Modern Minimal",
    hint: "Stark black & white with a blue accent. Ultra-clean.",
    swatch: "#3b82f6",
  },
  {
    id: "darkmatter",
    name: "Darkmatter",
    hint: "Ultra-dark near-black with a warm amber accent. Intensely atmospheric.",
    swatch: "#f09050",
  },
];

export function ThemeSwitcher({ className }: { className?: string }) {
  const { appTheme, setAppTheme } = useTheme();

  return (
    <div
      role="group"
      aria-label="Appearance theme"
      data-cursor="hover"
      className={cn(
        "flex items-center gap-0.5 rounded-full border border-border/50 bg-background/40 px-1.5 py-1 backdrop-blur-sm",
        className,
      )}
    >
      {THEME_OPTIONS.map((option) => {
        const active = appTheme === option.id;
        return (
          <button
            key={option.id}
            type="button"
            onClick={() => setAppTheme(option.id)}
            aria-label={`${option.name} theme`}
            aria-pressed={active}
            className={cn(
              "group relative flex h-5 w-5 items-center justify-center rounded-full sm:h-6 sm:w-6",
              // A transparent 8px halo: keeps the dot macOS-small but gives a
              // finger something comfortable to hit on a phone.
              "before:absolute before:-inset-1 before:content-['']",
              "transition-transform duration-200 ease-[cubic-bezier(0.2,0,0,1)] hover:scale-110",
              "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background",
              "motion-reduce:hover:scale-100",
            )}
          >
            {/* Tooltip. Revealed on hover and on keyboard focus; `aria-label`
                above carries the accessible name, so this is decoration. */}
            <span
              aria-hidden="true"
              className={cn(
                "pointer-events-none absolute bottom-full left-1/2 mb-2 -translate-x-1/2 whitespace-nowrap rounded-md border border-border/60 bg-background/95 px-2 py-1 text-[10px] font-medium text-foreground shadow-lg",
                "opacity-0 transition-opacity duration-150 group-hover:opacity-100 group-focus-visible:opacity-100",
              )}
            >
              {option.name}
            </span>

            <span
              aria-hidden="true"
              className={cn(
                "h-2.5 w-2.5 rounded-full border border-white/20 sm:h-3 sm:w-3",
                "transition-[box-shadow,filter] duration-200 hover:brightness-125",
                // Active state: a thin ring around the dot plus a touch of
                // scale. Deliberately quiet — no checkmark, no size jump.
                active && "scale-110 ring-2 ring-foreground/60",
              )}
              style={{ backgroundColor: option.swatch }}
            />
          </button>
        );
      })}
    </div>
  );
}