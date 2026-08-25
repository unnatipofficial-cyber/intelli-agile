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

export function getPriorityStyles(): Record<string, React.CSSProperties> {
  return {
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
}

// ── Task status badges ─────────────────────────────────────────────

export function getStatusStyles(): Record<string, React.CSSProperties> {
  return {
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
}

// ── Project status badges ──────────────────────────────────────────

export function getProjectStatusStyles(): Record<string, React.CSSProperties> {
  return {
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
}

// ── Sprint status badges ───────────────────────────────────────────

export function getSprintStatusStyles(): Record<string, React.CSSProperties> {
  return {
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
}

// ── Risk severity badges ───────────────────────────────────────────

export function getSeverityStyles(): Record<string, React.CSSProperties> {
  return {
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
}

// ── Priority border colors (for Sprint Board left-border) ──────────

export function getPriorityBorderColors(): Record<string, string> {
  return {
    low: cssVar("--muted-foreground"),
    medium: cssVar("--chart-1"),
    high: cssVar("--chart-2"),
    critical: cssVar("--destructive"),
  };
}

// ── Insight severity background/text ───────────────────────────────

export function getInsightSeverityStyles(): Record<string, { bg: string; text: string; border: string }> {
  return {
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
}

// ── Notification type icon backgrounds ─────────────────────────────

export function getNotifTypeStyles(): Record<string, React.CSSProperties> {
  return {
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
}

// ── Lazy-evaluated exports for backward compatibility ──────────────
// These are deprecated getter-based aliases. Prefer the function versions above.

let _priorityStyles: Record<string, React.CSSProperties> | null = null;
let _statusStyles: Record<string, React.CSSProperties> | null = null;
let _projectStatusStyles: Record<string, React.CSSProperties> | null = null;
let _sprintStatusStyles: Record<string, React.CSSProperties> | null = null;
let _severityStyles: Record<string, React.CSSProperties> | null = null;
let _priorityBorderColors: Record<string, string> | null = null;
let _insightSeverityStyles: Record<string, { bg: string; text: string; border: string }> | null = null;
let _notifTypeStyles: Record<string, React.CSSProperties> | null = null;

export const priorityStyles: Record<string, React.CSSProperties> = new Proxy({} as Record<string, React.CSSProperties>, {
  get(_target, prop: string) {
    if (!_priorityStyles) _priorityStyles = getPriorityStyles();
    return _priorityStyles[prop];
  },
});

export const statusStyles: Record<string, React.CSSProperties> = new Proxy({} as Record<string, React.CSSProperties>, {
  get(_target, prop: string) {
    if (!_statusStyles) _statusStyles = getStatusStyles();
    return _statusStyles[prop];
  },
});

export const projectStatusStyles: Record<string, React.CSSProperties> = new Proxy({} as Record<string, React.CSSProperties>, {
  get(_target, prop: string) {
    if (!_projectStatusStyles) _projectStatusStyles = getProjectStatusStyles();
    return _projectStatusStyles[prop];
  },
});

export const sprintStatusStyles: Record<string, React.CSSProperties> = new Proxy({} as Record<string, React.CSSProperties>, {
  get(_target, prop: string) {
    if (!_sprintStatusStyles) _sprintStatusStyles = getSprintStatusStyles();
    return _sprintStatusStyles[prop];
  },
});

export const severityStyles: Record<string, React.CSSProperties> = new Proxy({} as Record<string, React.CSSProperties>, {
  get(_target, prop: string) {
    if (!_severityStyles) _severityStyles = getSeverityStyles();
    return _severityStyles[prop];
  },
});

export const priorityBorderColors: Record<string, string> = new Proxy({} as Record<string, string>, {
  get(_target, prop: string) {
    if (!_priorityBorderColors) _priorityBorderColors = getPriorityBorderColors();
    return _priorityBorderColors[prop];
  },
});

export const insightSeverityStyles: Record<string, { bg: string; text: string; border: string }> = new Proxy({} as Record<string, { bg: string; text: string; border: string }>, {
  get(_target, prop: string) {
    if (!_insightSeverityStyles) _insightSeverityStyles = getInsightSeverityStyles();
    return _insightSeverityStyles[prop];
  },
});

export const notifTypeStyles: Record<string, React.CSSProperties> = new Proxy({} as Record<string, React.CSSProperties>, {
  get(_target, prop: string) {
    if (!_notifTypeStyles) _notifTypeStyles = getNotifTypeStyles();
    return _notifTypeStyles[prop];
  },
});
