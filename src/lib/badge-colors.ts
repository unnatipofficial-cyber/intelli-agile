/**
 * Theme-aware badge color helpers.
 * Returns inline styles that read CSS custom properties at render time,
 * so every theme (Graphite, Modern Minimal, Darkmatter) gets its own palette.
 */

function cssVar(name: string): string {
  if (typeof document === "undefined") return "#888";
  return getComputedStyle(document.documentElement).getPropertyValue(name).trim() || "#888";
}

function mix(base: string, alpha: number): string {
  return `color-mix(in srgb, ${base} ${Math.round(alpha * 100)}%, transparent)`;
}

// ── Priority badges ────────────────────────────────────────────────

export const priorityStyles: Record<string, React.CSSProperties> = {
  low: {
    backgroundColor: mix(cssVar("--muted"), 0.8),
    color: cssVar("--muted-foreground"),
  },
  medium: {
    backgroundColor: mix(cssVar("--chart-1"), 0.15),
    color: cssVar("--chart-1"),
  },
  high: {
    backgroundColor: mix(cssVar("--chart-2"), 0.15),
    color: cssVar("--chart-2"),
  },
  critical: {
    backgroundColor: mix(cssVar("--destructive"), 0.15),
    color: cssVar("--destructive"),
  },
};

// ── Task status badges ─────────────────────────────────────────────

export const statusStyles: Record<string, React.CSSProperties> = {
  todo: {
    backgroundColor: mix(cssVar("--muted"), 0.8),
    color: cssVar("--muted-foreground"),
  },
  "in-progress": {
    backgroundColor: mix(cssVar("--chart-1"), 0.15),
    color: cssVar("--chart-1"),
  },
  review: {
    backgroundColor: mix(cssVar("--chart-3"), 0.15),
    color: cssVar("--chart-3"),
  },
  done: {
    backgroundColor: mix(cssVar("--chart-4"), 0.15),
    color: cssVar("--chart-4"),
  },
};

// ── Project status badges ──────────────────────────────────────────

export const projectStatusStyles: Record<string, React.CSSProperties> = {
  active: {
    backgroundColor: mix(cssVar("--chart-1"), 0.15),
    color: cssVar("--chart-1"),
  },
  completed: {
    backgroundColor: mix(cssVar("--chart-4"), 0.15),
    color: cssVar("--chart-4"),
  },
  "on-hold": {
    backgroundColor: mix(cssVar("--chart-3"), 0.15),
    color: cssVar("--chart-3"),
  },
  planning: {
    backgroundColor: mix(cssVar("--chart-5"), 0.15),
    color: cssVar("--chart-5"),
  },
};

// ── Sprint status badges ───────────────────────────────────────────

export const sprintStatusStyles: Record<string, React.CSSProperties> = {
  active: {
    backgroundColor: mix(cssVar("--chart-1"), 0.15),
    color: cssVar("--chart-1"),
  },
  completed: {
    backgroundColor: mix(cssVar("--chart-4"), 0.15),
    color: cssVar("--chart-4"),
  },
  planning: {
    backgroundColor: mix(cssVar("--muted"), 0.8),
    color: cssVar("--muted-foreground"),
  },
};

// ── Risk severity badges ───────────────────────────────────────────

export const severityStyles: Record<string, React.CSSProperties> = {
  critical: {
    backgroundColor: mix(cssVar("--destructive"), 0.15),
    color: cssVar("--destructive"),
  },
  high: {
    backgroundColor: mix(cssVar("--chart-2"), 0.15),
    color: cssVar("--chart-2"),
  },
  medium: {
    backgroundColor: mix(cssVar("--chart-3"), 0.15),
    color: cssVar("--chart-3"),
  },
  low: {
    backgroundColor: mix(cssVar("--chart-1"), 0.15),
    color: cssVar("--chart-1"),
  },
};

// ── Priority border colors (for Sprint Board left-border) ──────────

export const priorityBorderColors: Record<string, string> = {
  low: cssVar("--muted-foreground"),
  medium: cssVar("--chart-1"),
  high: cssVar("--chart-2"),
  critical: cssVar("--destructive"),
};

// ── Insight severity background/text ───────────────────────────────

export const insightSeverityStyles: Record<string, { bg: string; text: string; border: string }> = {
  critical: {
    bg: mix(cssVar("--destructive"), 0.08),
    text: cssVar("--destructive"),
    border: mix(cssVar("--destructive"), 0.2),
  },
  high: {
    bg: mix(cssVar("--chart-2"), 0.08),
    text: cssVar("--chart-2"),
    border: mix(cssVar("--chart-2"), 0.2),
  },
  medium: {
    bg: mix(cssVar("--chart-3"), 0.08),
    text: cssVar("--chart-3"),
    border: mix(cssVar("--chart-3"), 0.2),
  },
  low: {
    bg: mix(cssVar("--chart-1"), 0.08),
    text: cssVar("--chart-1"),
    border: mix(cssVar("--chart-1"), 0.2),
  },
};

// ── Notification type icon backgrounds ─────────────────────────────

export const notifTypeStyles: Record<string, React.CSSProperties> = {
  task: {
    backgroundColor: mix(cssVar("--chart-1"), 0.15),
    color: cssVar("--chart-1"),
  },
  sprint: {
    backgroundColor: mix(cssVar("--chart-3"), 0.15),
    color: cssVar("--chart-3"),
  },
  risk: {
    backgroundColor: mix(cssVar("--destructive"), 0.15),
    color: cssVar("--destructive"),
  },
  project: {
    backgroundColor: mix(cssVar("--chart-2"), 0.15),
    color: cssVar("--chart-2"),
  },
  team: {
    backgroundColor: mix(cssVar("--chart-4"), 0.15),
    color: cssVar("--chart-4"),
  },
};
