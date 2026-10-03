import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  IconLayoutDashboard,
  IconFolder,
  IconChecklist,
  IconClipboardList,
  IconLayoutColumns,
  IconUsers,
  IconAlertTriangle,
  IconChartBar,
  IconFileText,
  IconSettings,
  IconMenu2,
} from "@tabler/icons-react";
import {
  AnimatePresence,
  motion,
  motionValue,
  useReducedMotion,
  useSpring,
  useTransform,
  MotionValue,
} from "framer-motion";
import { cn } from "@/lib/utils";
import { DURATION, SPRING } from "@/lib/motion";

export const dockNavItems = [
  { title: "Dashboard", path: "/dashboard", icon: "dashboard" },
  { title: "Projects", path: "/dashboard/projects", icon: "projects" },
  { title: "Tasks", path: "/dashboard/tasks", icon: "tasks" },
  { title: "Backlog", path: "/dashboard/backlog", icon: "backlog" },
  { title: "Sprint Board", path: "/dashboard/sprint-board", icon: "sprint-board" },
  { title: "Team", path: "/dashboard/team", icon: "team" },
  { title: "Risks", path: "/dashboard/risks", icon: "risks" },
  { title: "Analytics", path: "/dashboard/analytics", icon: "analytics" },
  { title: "Reports", path: "/dashboard/reports", icon: "reports" },
  { title: "Settings", path: "/dashboard/settings", icon: "settings" },
];

const iconMap: Record<string, React.FC<{ className?: string }>> = {
  dashboard: IconLayoutDashboard,
  projects: IconFolder,
  tasks: IconChecklist,
  backlog: IconClipboardList,
  "sprint-board": IconLayoutColumns,
  team: IconUsers,
  risks: IconAlertTriangle,
  analytics: IconChartBar,
  reports: IconFileText,
  settings: IconSettings,
};

export function getDockIcon(iconKey: string) {
  return iconMap[iconKey] || IconLayoutDashboard;
}

export interface DockItem {
  title: string;
  path: string;
  icon: string;
}

/**
 * A route is active when it matches exactly, or when the current path is nested
 * under it. `/dashboard` is the root of the tree so it only matches exactly —
 * otherwise every route would light up the Dashboard icon as well.
 */
function isRouteActive(activePath: string, path: string) {
  if (path === "/dashboard") return activePath === path;
  return activePath === path || activePath.startsWith(`${path}/`);
}

/* ── Sizing / motion constants ─────────────────────────────────── */

/** Resting and hovered diameter of a desktop dock cell, in px. */
const CELL_MIN = 44;
const CELL_MAX = 64;

/** Resting and hovered size of the icon inside the cell, in px. */
const ICON_MIN = 20;
const ICON_MAX = 30;

/** How far from a cell's centre the pointer still influences it, in px. */
const HOVER_RANGE = 130;

/**
 * Distance value meaning "the pointer is nowhere near this cell". Large rather
 * than Infinity: the transforms clamp to their end stops either way, and a
 * finite number keeps the springs numerically well-behaved.
 */
const IDLE_DISTANCE = 9999;

/**
 * Critically-damped-ish spring. The original values (mass 0.1 / stiffness 150 /
 * damping 12) give a damping ratio of ~0.42, so every cell visibly overshot and
 * wobbled as the pointer swept past — the main thing that read as "janky".
 * These land just above 1, so the cells glide and settle without bouncing.
 *
 * Only the mass is overridden: the dock's magnification is heavier than a
 * press, so it wants a little more inertia, but the stiffness/damping still
 * come from the shared preset so the dock cannot drift out of the system.
 */
const CELL_SPRING = { ...SPRING.snappy, mass: 0.4 } as const;

/* ── Mobile dock ──────────────────────────────────────────────── */
const FloatingDockMobile = ({
  items,
  className,
  activePath,
  onNavigate,
}: {
  items: DockItem[];
  className?: string;
  activePath: string;
  onNavigate: (path: string) => void;
}) => {
  const [open, setOpen] = useState(false);
  const reduced = useReducedMotion();

  // Escape closes the sheet — without it there was no keyboard way out, and no
  // way out at all on touch outside the (very narrow) panel.
  useEffect(() => {
    if (!open) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [open]);

  return (
    <div className={cn("relative block lg:hidden", className)}>
      <AnimatePresence>
        {open && (
          <>
            {/* Tap-anywhere scrim. `fixed` escapes the dock's own narrow box, so
                it covers the viewport while the dock stays above it (z-30
                stacking context, hence z-[-1] within it). */}
            <motion.button
              type="button"
              tabIndex={-1}
              aria-hidden="true"
              onClick={() => setOpen(false)}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.18 }}
              className="pointer-events-auto fixed inset-0 z-[-1] cursor-default bg-background/40 backdrop-blur-[2px]"
            />
            <motion.div
              variants={panelVariants}
              initial="hidden"
              animate="show"
              exit="exit"
              className="absolute inset-x-0 bottom-full mb-3 flex max-h-[68vh] flex-col items-center gap-2 overflow-y-auto overscroll-contain px-1 pb-1"
            >
              {items.map((item) => {
                const Icon = getDockIcon(item.icon);
                const isActive = isRouteActive(activePath, item.path);
                return (
                  <motion.button
                    key={item.path}
                    variants={reduced ? reducedItemVariants : itemVariants}
                    type="button"
                    onClick={() => {
                      onNavigate(item.path);
                      setOpen(false);
                    }}
                    aria-label={item.title}
                    aria-current={isActive ? "page" : undefined}
                    className={cn(
                      "group relative flex h-11 w-11 shrink-0 items-center justify-center rounded-full border shadow-lg backdrop-blur-lg transition-colors",
                      isActive
                        ? "border-primary/40 bg-primary/15"
                        : "border-glass-border bg-background/80 hover:bg-primary/10"
                    )}
                  >
                    <Icon
                      className={cn(
                        "h-5 w-5 transition-colors",
                        isActive
                          ? "text-primary"
                          : "text-muted-foreground group-hover:text-foreground"
                      )}
                    />
                    {isActive && (
                      <span className="absolute -bottom-0.5 left-1/2 h-1 w-1 -translate-x-1/2 rounded-full bg-primary" />
                    )}
                  </motion.button>
                );
              })}
            </motion.div>
          </>
        )}
      </AnimatePresence>

      <button
        type="button"
        onClick={() => setOpen(!open)}
        aria-expanded={open}
        aria-label={open ? "Close navigation" : "Open navigation"}
        className={cn(
          "flex h-12 w-12 items-center justify-center rounded-full border border-glass-border shadow-lg transition-all duration-200",
          open
            ? "rotate-45 bg-primary text-primary-foreground"
            : "bg-background/80 text-muted-foreground backdrop-blur-lg hover:text-foreground"
        )}
      >
        <IconMenu2 className="h-5 w-5" />
      </button>
    </div>
  );
};

/**
 * Container drives the stagger, children just declare their own states. The
 * previous version hand-rolled a per-item `delay` that was itself reversed by
 * `flex-col-reverse`, so the reveal order never matched the reading order.
 */
const panelVariants = {
  hidden: {},
  show: { transition: { staggerChildren: 0.028, delayChildren: 0.02 } },
  exit: { transition: { staggerChildren: 0.016, staggerDirection: -1 } },
};

const itemVariants = {
  hidden: { opacity: 0, y: 14, scale: 0.82 },
  show: {
    opacity: 1,
    y: 0,
    scale: 1,
    // `SPRING.snappy` rather than a local spring: the old `damping: 32` at this
    // stiffness gave a damping ratio of ~0.78, which visibly overshoots and
    // rings twice before settling. On a nav dock people tap dozens of times a
    // session, that reads as toy-like fast.
    transition: { type: "spring" as const, ...SPRING.snappy },
  },
  exit: { opacity: 0, y: 10, scale: 0.85, transition: { duration: DURATION.quick } },
};

const reducedItemVariants = {
  hidden: { opacity: 0 },
  show: { opacity: 1, transition: { duration: 0.12 } },
  exit: { opacity: 0, transition: { duration: 0.12 } },
};

/* ── Desktop dock ─────────────────────────────────────────────── */
const FloatingDockDesktop = ({
  items,
  className,
  activePath,
  onNavigate,
}: {
  items: DockItem[];
  className?: string;
  activePath: string;
  onNavigate: (path: string) => void;
}) => {
  const reduced = useReducedMotion();
  const cells = useRef<Array<HTMLDivElement | null>>([]);

  // One distance MotionValue per cell, created once. Each is fed by the parent
  // so a single batched measurement pass can drive all ten cells.
  const distances = useMemo(
    () => items.map(() => motionValue(IDLE_DISTANCE)),
    [items]
  );

  const frame = useRef(0);

  const handleMouseMove = useCallback(
    (event: React.MouseEvent<HTMLDivElement>) => {
      // Viewport coordinates: `getBoundingClientRect` is viewport-relative, so
      // the previous `pageX` drifted by scrollY and the proximity effect
      // stopped lining up with the icons as soon as the page was scrolled.
      const { clientX } = event;
      if (frame.current) return;

      frame.current = window.requestAnimationFrame(() => {
        frame.current = 0;
        // Read every rect first, then write every value. Measuring and setting
        // per cell instead cost ten layout flushes per pointer move, each
        // invalidated by the previous cell's write.
        const centres: number[] = [];
        for (const cell of cells.current) {
          if (!cell) {
            centres.push(0);
            continue;
          }
          const rect = cell.getBoundingClientRect();
          centres.push(rect.left + rect.width / 2);
        }
        for (let i = 0; i < centres.length; i += 1) {
          distances[i]?.set(clientX - centres[i]);
        }
      });
    },
    [distances]
  );

  const handlePointerLeave = useCallback(() => {
    if (frame.current) {
      window.cancelAnimationFrame(frame.current);
      frame.current = 0;
    }
    for (const distance of distances) distance.set(IDLE_DISTANCE);
  }, [distances]);

  useEffect(
    () => () => {
      if (frame.current) window.cancelAnimationFrame(frame.current);
    },
    []
  );

  return (
    <motion.div
      onMouseMove={handleMouseMove}
      onMouseLeave={handlePointerLeave}
      initial={reduced ? false : { opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, ease: "easeOut" }}
      className={cn(
        // `lg`, not `md`: at 768px ten cells at their hovered width (~64px)
        // plus gaps overflow the viewport, so the dock used to be clipped.
        "mx-auto hidden h-16 items-end gap-2 rounded-2xl border border-glass-border bg-background/70 px-4 pb-2.5 shadow-xl shadow-black/5 backdrop-blur-xl lg:flex",
        className
      )}
    >
      {items.map((item, index) => (
        <IconContainer
          key={item.path}
          cellRef={(node) => {
            cells.current[index] = node;
          }}
          distance={distances[index]}
          title={item.title}
          icon={getDockIcon(item.icon)}
          isActive={isRouteActive(activePath, item.path)}
          onClick={() => onNavigate(item.path)}
          reduced={!!reduced}
        />
      ))}
    </motion.div>
  );
};

/* ── Individual icon cell ─────────────────────────────────────── */
function IconContainer({
  cellRef,
  distance,
  title,
  icon: Icon,
  isActive,
  onClick,
  reduced,
}: {
  cellRef: (node: HTMLDivElement | null) => void;
  distance: MotionValue<number>;
  title: string;
  icon: React.FC<{ className?: string }>;
  isActive: boolean;
  onClick: () => void;
  reduced: boolean;
}) {
  const [hovered, setHovered] = useState(false);

  const sizeTransform = useTransform(
    distance,
    [-HOVER_RANGE, 0, HOVER_RANGE],
    [CELL_MIN, CELL_MAX, CELL_MIN]
  );
  const iconTransform = useTransform(
    distance,
    [-HOVER_RANGE, 0, HOVER_RANGE],
    [ICON_MIN, ICON_MAX, ICON_MIN]
  );

  // Width and height are always equal, so one spring drives both instead of
  // four independently-simulated ones.
  const cellSize = useSpring(sizeTransform, CELL_SPRING);
  const iconSize = useSpring(iconTransform, CELL_SPRING);

  return (
    <button
      type="button"
      onClick={onClick}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      onFocus={() => setHovered(true)}
      onBlur={() => setHovered(false)}
      aria-label={title}
      aria-current={isActive ? "page" : undefined}
      className="rounded-full outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
    >
      <motion.div
        ref={cellRef}
        style={
          reduced
            ? { width: CELL_MIN, height: CELL_MIN }
            : { width: cellSize, height: cellSize }
        }
        whileTap={reduced ? undefined : { scale: 0.92 }}
        className={cn(
          "relative flex aspect-square items-center justify-center rounded-full transition-colors duration-200 ease-out",
          isActive
            ? "bg-primary/15 text-primary"
            : "bg-muted/60 text-muted-foreground hover:text-foreground"
        )}
      >
        <AnimatePresence>
          {hovered && (
            <motion.div
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 4 }}
              transition={{ duration: 0.15, ease: "easeOut" }}
              className="absolute -top-9 left-1/2 z-50 w-fit whitespace-pre rounded-lg border border-glass-border bg-background/90 px-2.5 py-1 text-xs font-medium text-foreground shadow-md backdrop-blur-md"
              style={{ x: "-50%" }}
            >
              {title}
            </motion.div>
          )}
        </AnimatePresence>
        <motion.div
          style={
            reduced
              ? { width: ICON_MIN, height: ICON_MIN }
              : { width: iconSize, height: iconSize }
          }
          className="flex items-center justify-center"
        >
          <Icon className="h-full w-full" />
        </motion.div>
        {isActive && (
          <motion.span
            layoutId="dock-indicator"
            className="absolute -bottom-1 left-1/2 h-1 w-1 -translate-x-1/2 rounded-full bg-primary"
            transition={{ type: "spring", ...SPRING.snappy }}
          />
        )}
      </motion.div>
    </button>
  );
}

/* ── Exported compound component ──────────────────────────────── */
export const FloatingDock = ({
  items,
  activePath,
  onNavigate,
  mobileClassName,
  desktopClassName,
}: {
  items: DockItem[];
  activePath: string;
  onNavigate: (path: string) => void;
  mobileClassName?: string;
  desktopClassName?: string;
}) => {
  return (
    <>
      <FloatingDockDesktop
        items={items}
        className={desktopClassName}
        activePath={activePath}
        onNavigate={onNavigate}
      />
      <FloatingDockMobile
        items={items}
        className={mobileClassName}
        activePath={activePath}
        onNavigate={onNavigate}
      />
    </>
  );
};
