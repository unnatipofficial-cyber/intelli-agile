import React, { useRef, useState } from "react";
import {
  IconLayoutDashboard,
  IconFolder,
  IconClipboardList,
  IconChecklist,
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
  useMotionValue,
  useSpring,
  useTransform,
  MotionValue,
} from "framer-motion";
import { cn } from "@/lib/utils";

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

/* ── Mobile dock ──────────────────────────────────────────────── */
const FloatingDockMobile = ({
  items,
  className,
  activePath,
  onNavigate,
}: {
  items: { title: string; path: string; icon: string }[];
  className?: string;
  activePath: string;
  onNavigate: (path: string) => void;
}) => {
  const [open, setOpen] = useState(false);

  return (
    <div className={`relative block md:hidden ${className}`}>
      <AnimatePresence>
        {open && (
          <motion.div
            layoutId="nav"
            className="absolute inset-x-0 bottom-full mb-3 flex flex-col-reverse items-center gap-2"
          >
            {items.map((item, idx) => {
              const Icon = getDockIcon(item.icon);
              const isActive = activePath === item.path ||
                (item.path !== "/dashboard" && activePath.startsWith(item.path));
              return (
                <motion.div
                  key={item.path}
                  initial={{ opacity: 0, y: 20, scale: 0.8 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  exit={{ opacity: 0, y: 20, scale: 0.8, transition: { delay: idx * 0.03 } }}
                  transition={{ delay: (items.length - 1 - idx) * 0.04, type: "spring", damping: 20, stiffness: 300 }}
                >
                  <button
                    onClick={() => { onNavigate(item.path); setOpen(false); }}
                    className="group relative flex h-11 w-11 items-center justify-center rounded-full bg-background/80 backdrop-blur-lg border border-glass-border shadow-lg transition-colors hover:bg-primary/10"
                    title={item.title}
                  >
                    <Icon className={cn("h-5 w-5 transition-colors", isActive ? "text-primary" : "text-muted-foreground group-hover:text-foreground")} />
                    {isActive && (
                      <span className="absolute -bottom-1 left-1/2 -translate-x-1/2 h-1 w-1 rounded-full bg-primary" />
                    )}
                  </button>
                </motion.div>
              );
            })}
          </motion.div>
        )}
      </AnimatePresence>
      <button
        onClick={() => setOpen(!open)}
        className={cn(
          "flex h-12 w-12 items-center justify-center rounded-full border border-glass-border shadow-lg transition-all duration-200",
          open ? "bg-primary text-primary-foreground rotate-45" : "bg-background/80 backdrop-blur-lg text-muted-foreground hover:text-foreground"
        )}
      >
        <IconMenu2 className="h-5 w-5 transition-transform duration-200" />
      </button>
    </div>
  );
};

/* ── Desktop dock ─────────────────────────────────────────────── */
const FloatingDockDesktop = ({
  items,
  className,
  activePath,
  onNavigate,
}: {
  items: { title: string; path: string; icon: string }[];
  className?: string;
  activePath: string;
  onNavigate: (path: string) => void;
}) => {
  const mouseX = useMotionValue(Infinity);

  return (
    <motion.div
      onMouseMove={(e) => mouseX.set(e.pageX)}
      onMouseLeave={() => mouseX.set(Infinity)}
      className={cn(
        "mx-auto hidden md:flex h-16 items-end gap-3 rounded-2xl bg-background/70 backdrop-blur-xl border border-glass-border px-4 pb-2.5 shadow-xl shadow-black/5",
        className
      )}
    >
      {items.map((item) => (
        <IconContainer
          key={item.path}
          mouseX={mouseX}
          title={item.title}
          icon={getDockIcon(item.icon)}
          isActive={activePath === item.path ||
            (item.path !== "/dashboard" && activePath.startsWith(item.path))}
          onClick={() => onNavigate(item.path)}
        />
      ))}
    </motion.div>
  );
};

/* ── Individual icon cell ─────────────────────────────────────── */
function IconContainer({
  mouseX,
  title,
  icon: Icon,
  isActive,
  onClick,
}: {
  mouseX: MotionValue;
  title: string;
  icon: React.FC<{ className?: string }>;
  isActive: boolean;
  onClick: () => void;
}) {
  const ref = useRef<HTMLDivElement>(null);

  const distance = useTransform(mouseX, (val) => {
    const bounds = ref.current?.getBoundingClientRect() ?? { x: 0, width: 0 };
    return val - bounds.x - bounds.width / 2;
  });

  const widthTransform = useTransform(distance, [-150, 0, 150], [44, 72, 44]);
  const heightTransform = useTransform(distance, [-150, 0, 150], [44, 72, 44]);
  const widthTransformIcon = useTransform(distance, [-150, 0, 150], [20, 32, 20]);
  const heightTransformIcon = useTransform(distance, [-150, 0, 150], [20, 32, 20]);

  const width = useSpring(widthTransform, { mass: 0.1, stiffness: 150, damping: 12 });
  const height = useSpring(heightTransform, { mass: 0.1, stiffness: 150, damping: 12 });
  const widthIcon = useSpring(widthTransformIcon, { mass: 0.1, stiffness: 150, damping: 12 });
  const heightIcon = useSpring(heightTransformIcon, { mass: 0.1, stiffness: 150, damping: 12 });

  const [hovered, setHovered] = useState(false);

  return (
    <button onClick={onClick}>
      <motion.div
        ref={ref}
        style={{ width, height }}
        onMouseEnter={() => setHovered(true)}
        onMouseLeave={() => setHovered(false)}
        className={cn(
          "relative flex aspect-square items-center justify-center rounded-full transition-colors duration-150",
          isActive
            ? "bg-primary/15 text-primary"
            : "bg-muted/60 text-muted-foreground hover:text-foreground"
        )}
      >
        <AnimatePresence>
          {hovered && (
            <motion.div
              initial={{ opacity: 0, y: 10, x: "-50%" }}
              animate={{ opacity: 1, y: 0, x: "-50%" }}
              exit={{ opacity: 0, y: 2, x: "-50%" }}
              className="absolute -top-9 left-1/2 z-50 w-fit rounded-lg border border-glass-border bg-background/90 backdrop-blur-md px-2.5 py-1 text-xs font-medium whitespace-pre text-foreground shadow-md"
            >
              {title}
            </motion.div>
          )}
        </AnimatePresence>
        <motion.div
          style={{ width: widthIcon, height: heightIcon }}
          className="flex items-center justify-center"
        >
          <Icon className={cn("h-full w-full", isActive && "text-primary")} />
        </motion.div>
        {isActive && (
          <motion.span
            layoutId="dock-indicator"
            className="absolute -bottom-1 left-1/2 -translate-x-1/2 h-1 w-1 rounded-full bg-primary"
            transition={{ type: "spring", damping: 20, stiffness: 300 }}
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
  items: { title: string; path: string; icon: string }[];
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

