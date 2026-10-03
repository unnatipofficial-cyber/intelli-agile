import { motion } from "framer-motion";
import type { ReactNode } from "react";
import type { Variants } from "framer-motion";
import { AnimatedCounter } from "@/components/landing/AnimatedCounter";
import { Check, Search } from "lucide-react";
import { DURATION, EASING, STAGGER, prefersReducedMotion } from "@/lib/motion";
import { cn } from "@/lib/utils";

/**
 * GuideMocks — animated "screenshots" of every AIE section.
 *
 * Each mock is real DOM built from theme tokens rather than a static image, so
 * it stays crisp at any size, follows the active theme, and can *demonstrate*
 * the section: bars grow, counters count up, the matrix plots itself. They all
 * animate once when scrolled into view (`whileInView`, `once`), which is what
 * gives the guide its scroll-driven feel without any global animation state.
 *
 * Reduced motion is handled by `MotionConfig reducedMotion="user"` on the
 * Guide page: transform travel is dropped while opacity still resolves, so the
 * mocks always end up fully visible.
 */

const VIEWPORT = { once: true, amount: 0.2 } as const;

/* ── Shared variant vocabulary ─────────────────────────────────── */

/** Container: hands each child a slot in the cascade. */
const group: Variants = {
  hidden: {},
  show: { transition: { staggerChildren: STAGGER.step, delayChildren: 0.05 } },
};

/** A row/card fading up into place. */
const rise: Variants = {
  hidden: { opacity: 0, y: 12 },
  show: { opacity: 1, y: 0, transition: { duration: DURATION.enter, ease: EASING.standard } },
};

/** A bar growing from its start edge. Pair with `origin-*` utilities. */
const growX: Variants = {
  hidden: { opacity: 0, scaleX: 0 },
  show: { opacity: 1, scaleX: 1, transition: { duration: DURATION.reveal, ease: EASING.emphasised } },
};

/** A column growing upward from the baseline. */
const growY: Variants = {
  hidden: { opacity: 0, scaleY: 0 },
  show: { opacity: 1, scaleY: 1, transition: { duration: DURATION.reveal, ease: EASING.emphasised } },
};

/** A dot/marker popping in. */
const pop: Variants = {
  hidden: { opacity: 0, scale: 0.5 },
  show: { opacity: 1, scale: 1, transition: { duration: DURATION.enter, ease: EASING.standard } },
};

/** A stroked path drawing itself (charts). */
const draw: Variants = {
  hidden: { pathLength: 0, opacity: 0 },
  show: { pathLength: 1, opacity: 1, transition: { duration: DURATION.transition, ease: EASING.standard } },
};

/* ── Frame + atoms ─────────────────────────────────────────────── */

export function MockFrame({
  url,
  children,
  className,
}: {
  /** Fake address bar text — tells the reader which page they are looking at. */
  url: string;
  children: ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("aie-graphite-panel overflow-hidden rounded-2xl", className)}>
      <div className="flex items-center gap-1.5 border-b border-border/60 bg-muted/30 px-3 py-2.5 sm:px-4">
        <span aria-hidden="true" className="h-2.5 w-2.5 rounded-full bg-destructive/70" />
        <span aria-hidden="true" className="h-2.5 w-2.5 rounded-full bg-chart-3/70" />
        <span aria-hidden="true" className="h-2.5 w-2.5 rounded-full bg-chart-1/70" />
        <span className="ml-2 flex-1 truncate rounded-md bg-background/50 px-3 py-1 text-center font-mono text-[10px] text-muted-foreground">
          {url}
        </span>
      </div>
      <div className="bg-background/40 p-3 sm:p-4">{children}</div>
    </div>
  );
}

function Chip({
  children,
  tone = "neutral",
  className,
}: {
  children: ReactNode;
  tone?: "neutral" | "primary" | "destructive" | "warning" | "success";
  className?: string;
}) {
  const tones = {
    neutral: "border-border bg-muted/50 text-muted-foreground",
    primary: "border-primary/30 bg-primary/10 text-primary",
    destructive: "border-destructive/30 bg-destructive/10 text-destructive",
    warning: "border-chart-3/40 bg-chart-3/15 text-chart-3",
    success: "border-chart-1/40 bg-chart-1/15 text-chart-1",
  } as const;
  return (
    <span className={cn("inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] font-semibold", tones[tone], className)}>
      {children}
    </span>
  );
}

function Avatar({ initials, className }: { initials: string; className?: string }) {
  return (
    <span
      className={cn(
        "flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-primary/15 text-[9px] font-bold text-primary ring-2 ring-background",
        className,
      )}
    >
      {initials}
    </span>
  );
}

/** Small labelled metric tile with a scroll-triggered count-up. */
function Tile({ label, value, suffix }: { label: string; value: number; suffix?: string }) {
  return (
    <motion.div variants={rise} className="rounded-xl border border-border/60 bg-card/60 p-2.5 sm:p-3">
      <p className="text-[9px] font-semibold uppercase tracking-wider text-muted-foreground">{label}</p>
      <p className="mt-1 text-lg font-bold tracking-tight sm:text-xl">
        <AnimatedCounter to={value} suffix={suffix ?? ""} />
      </p>
    </motion.div>
  );
}

/* ── 1. Dashboard ──────────────────────────────────────────────── */

const activityRows = [
  { who: "SK", text: "moved “Webhook retries” → Review", when: "4m" },
  { who: "AP", text: "completed “Saved cards checkout” (8 SP)", when: "22m" },
  { who: "AI", text: "flagged a capacity overload on Ada", when: "1h" },
  { who: "JR", text: "logged a risk: payment provider migration", when: "2h" },
];

export function DashboardMock() {
  return (
    <motion.div variants={group} initial="hidden" whileInView="show" viewport={VIEWPORT} className="space-y-3">
      <motion.div variants={rise} className="flex items-center justify-between gap-2">
        <div>
          <p className="text-sm font-bold">Welcome back, Ada</p>
          <p className="text-[10px] text-muted-foreground">Sprint 15 · day 6 of 10</p>
        </div>
        <Chip tone="success">● On track</Chip>
      </motion.div>

      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        <Tile label="Projects" value={6} />
        <Tile label="Completed" value={42} suffix=" SP" />
        <Tile label="Pending" value={11} />
        <Tile label="Open risks" value={3} />
      </div>

      <motion.div variants={rise} className="rounded-xl border border-border/60 bg-card/60 p-3">
        <div className="flex items-center justify-between">
          <p className="text-xs font-bold">Sprint burndown</p>
          <p className="text-[10px] font-medium text-destructive">18% under plan</p>
        </div>
        <svg viewBox="0 0 300 84" className="mt-2 h-20 w-full" aria-hidden="true">
          {[14, 42, 70].map((y) => (
            <line key={y} x1="0" y1={y} x2="300" y2={y} stroke="currentColor" className="text-border/50" strokeWidth="1" />
          ))}
          <path d="M4 6 L296 78" fill="none" stroke="currentColor" className="text-muted-foreground/50" strokeWidth="1.5" strokeDasharray="4 5" />
          <motion.path
            variants={draw}
            d="M4 6 C 70 20, 110 26, 160 44 S 250 66, 296 74"
            fill="none"
            stroke="currentColor"
            className="text-primary"
            strokeWidth="2.5"
            strokeLinecap="round"
          />
        </svg>
      </motion.div>

      <div className="space-y-1.5">
        <p className="text-[9px] font-semibold uppercase tracking-wider text-muted-foreground">Recent activity</p>
        {activityRows.map((row) => (
          <motion.div
            key={row.text}
            variants={rise}
            className="flex items-center gap-2 rounded-lg border border-border/50 bg-card/40 px-2.5 py-1.5"
          >
            <Avatar initials={row.who} />
            <p className="min-w-0 flex-1 truncate text-[11px] text-muted-foreground">
              <span className="font-semibold text-foreground">{row.who}</span> {row.text}
            </p>
            <span className="text-[10px] text-muted-foreground/70">{row.when}</span>
          </motion.div>
        ))}
      </div>
    </motion.div>
  );
}

/* ── 2. Projects ───────────────────────────────────────────────── */

const projectCards = [
  { name: "Payments revamp", key: "PAY", progress: 72, health: "Good", tone: "success" as const, meta: "2 sprints · 5 members" },
  { name: "Mobile checkout", key: "MOB", progress: 46, health: "At risk", tone: "warning" as const, meta: "1 sprint · 3 members" },
  { name: "Search relevance", key: "SRC", progress: 88, health: "Good", tone: "success" as const, meta: "3 sprints · 4 members" },
  { name: "Onboarding flow", key: "ONB", progress: 24, health: "Behind", tone: "destructive" as const, meta: "1 sprint · 2 members" },
];

export function ProjectsMock() {
  return (
    <motion.div variants={group} initial="hidden" whileInView="show" viewport={VIEWPORT} className="space-y-3">
      <motion.div variants={rise} className="flex items-center justify-between">
        <p className="text-sm font-bold">Projects</p>
        <Chip tone="primary">+ New project</Chip>
      </motion.div>
      <div className="grid gap-2.5 sm:grid-cols-2">
        {projectCards.map((project) => (
          <motion.div
            key={project.key}
            variants={rise}
            className="group rounded-xl border border-border/60 bg-card/60 p-3 transition-colors hover:border-primary/40"
          >
            <div className="flex items-center justify-between gap-2">
              <div className="flex min-w-0 items-center gap-2">
                <span className="rounded-md bg-primary/10 px-1.5 py-0.5 font-mono text-[9px] font-bold text-primary">
                  {project.key}
                </span>
                <p className="truncate text-xs font-bold">{project.name}</p>
              </div>
              <Chip tone={project.tone}>{project.health}</Chip>
            </div>
            <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-muted/60">
              <motion.div
                variants={growX}
                className={cn(
                  "h-full origin-left rounded-full",
                  project.tone === "success" ? "bg-chart-1" : project.tone === "warning" ? "bg-chart-3" : "bg-destructive",
                )}
                style={{ width: `${project.progress}%` }}
              />
            </div>
            <div className="mt-2 flex items-center justify-between text-[10px] text-muted-foreground">
              <span>{project.meta}</span>
              <span className="font-semibold">{project.progress}%</span>
            </div>
          </motion.div>
        ))}
      </div>
    </motion.div>
  );
}

/* ── 3. Backlog ────────────────────────────────────────────────── */

const backlogRows = [
  { indent: 0, type: "Epic", title: "Payments revamp", meta: "EXP-24 · 34 SP", tone: "primary" as const, points: "34" },
  { indent: 1, type: "Story", title: "Checkout with saved cards", meta: "SP-101 · In progress", tone: "success" as const, points: "8" },
  { indent: 1, type: "Story", title: "Refund from the dashboard", meta: "SP-102 · To do", tone: "neutral" as const, points: "5" },
  { indent: 1, type: "Bug", title: "Webhook retries drop events", meta: "BUG-57 · Review", tone: "destructive" as const, points: "3" },
  { indent: 0, type: "Epic", title: "Search relevance", meta: "EXP-25 · 21 SP", tone: "primary" as const, points: "21" },
  { indent: 1, type: "Story", title: "Synonym dictionary editor", meta: "SP-118 · To do", tone: "neutral" as const, points: "8" },
];

export function BacklogMock() {
  return (
    <motion.div variants={group} initial="hidden" whileInView="show" viewport={VIEWPORT} className="space-y-3">
      <motion.div variants={rise} className="flex flex-wrap items-center gap-2">
        <Chip tone="neutral">All</Chip>
        <Chip tone="neutral">Stories</Chip>
        <Chip tone="neutral">Bugs</Chip>
        <Chip tone="neutral">Unassigned</Chip>
        <span className="ml-auto">
          <Chip tone="primary">+ Add work item</Chip>
        </span>
      </motion.div>

      <div className="space-y-1.5">
        {backlogRows.map((row) => (
          <motion.div
            key={row.title}
            variants={rise}
            style={{ marginLeft: row.indent * 18 }}
            className={cn(
              "flex items-center gap-2 rounded-lg border px-2.5 py-2",
              row.indent === 0
                ? "border-primary/25 bg-primary/5"
                : "border-border/50 bg-card/50",
            )}
          >
            <span
              aria-hidden="true"
              className={cn(
                "h-1.5 w-1.5 shrink-0 rounded-full",
                row.tone === "destructive"
                  ? "bg-destructive"
                  : row.tone === "primary"
                    ? "bg-primary"
                    : row.tone === "success"
                      ? "bg-chart-1"
                      : "bg-muted-foreground/60",
              )}
            />
            <div className="min-w-0 flex-1">
              <p className={cn("truncate text-[11px]", row.indent === 0 ? "font-bold" : "font-medium")}>{row.title}</p>
              <p className="truncate text-[10px] text-muted-foreground">{row.meta}</p>
            </div>
            <Chip tone={row.tone}>{row.type}</Chip>
            <span className="w-7 shrink-0 rounded-md bg-muted/60 px-1 py-0.5 text-center text-[9px] font-bold text-muted-foreground">
              {row.points}
            </span>
          </motion.div>
        ))}
      </div>
    </motion.div>
  );
}

/* ── 4. Sprint board ───────────────────────────────────────────── */

const boardColumns = [
  {
    name: "To Do",
    dot: "bg-muted-foreground",
    cards: [
      { title: "Refund from the dashboard", who: "AP", pts: 5, priority: "high" },
      { title: "Synonym dictionary editor", who: "JR", pts: 8, priority: "med" },
    ],
  },
  {
    name: "In Progress",
    dot: "bg-chart-1",
    cards: [
      { title: "Saved cards checkout", who: "SK", pts: 8, priority: "high" },
      { title: "Webhook retries", who: "SK", pts: 3, priority: "crit" },
    ],
  },
  {
    name: "Review",
    dot: "bg-chart-3",
    cards: [{ title: "Risk owner notifications", who: "MP", pts: 3, priority: "med" }],
  },
  {
    name: "Done",
    dot: "bg-chart-1/60",
    cards: [
      { title: "Card vault migration", who: "SK", pts: 8, priority: "low" },
      { title: "3-D Secure fallback", who: "JR", pts: 5, priority: "low" },
    ],
  },
] as const;

const priorityDot = {
  crit: "bg-destructive",
  high: "bg-chart-3",
  med: "bg-chart-1",
  low: "bg-muted-foreground/60",
} as const;

export function BoardMock() {
  return (
    <motion.div variants={group} initial="hidden" whileInView="show" viewport={VIEWPORT} className="space-y-3">
      <motion.div variants={rise} className="flex items-center justify-between gap-2">
        <div className="min-w-0">
          <p className="truncate text-sm font-bold">Sprint 15 — Ship the payment flow</p>
          <p className="text-[10px] text-muted-foreground">Day 6 · 42 / 58 SP completed</p>
        </div>
        <Chip tone="primary">Sprint active</Chip>
      </motion.div>

      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        {boardColumns.map((column) => (
          <motion.div
            key={column.name}
            variants={rise}
            className={cn(
              "min-w-0 rounded-xl border p-2",
              column.name === "In Progress" ? "border-primary/40 bg-primary/5" : "border-border/50 bg-muted/20",
            )}
          >
            <div className="mb-2 flex items-center gap-1.5 px-0.5">
              <span className={cn("h-1.5 w-1.5 rounded-full", column.dot)} />
              <p className="truncate text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
                {column.name}
              </p>
              <span className="ml-auto text-[9px] font-semibold text-muted-foreground">{column.cards.length}</span>
            </div>
            <div className="space-y-1.5">
              {column.cards.map((card, cardIndex) => (
                <motion.div
                  key={card.title}
                  variants={rise}
                  className={cn(
                    "rounded-lg border border-border/60 bg-card p-2",
                    column.name === "Done" && "opacity-60",
                  )}
                >
                  <div className="flex items-start gap-1.5">
                    <span className={cn("mt-1 h-1.5 w-1.5 shrink-0 rounded-full", priorityDot[card.priority])} />
                    <p className="min-w-0 flex-1 text-[10px] font-medium leading-snug">{card.title}</p>
                  </div>
                  <div className="mt-2 flex items-center justify-between">
                    <Avatar initials={card.who} className="h-5 w-5 text-[8px]" />
                    <span className="rounded bg-muted/70 px-1 py-0.5 text-[9px] font-bold text-muted-foreground">
                      {card.pts} SP
                    </span>
                  </div>
                </motion.div>
              ))}
            </div>
          </motion.div>
        ))}
      </div>
    </motion.div>
  );
}

/* ── 5. Tasks ──────────────────────────────────────────────────── */

const taskRows = [
  { title: "Saved cards checkout", type: "Story", who: "AP", pts: 8, status: "In progress", tone: "primary" as const, done: false },
  { title: "Webhook retries drop events", type: "Bug", who: "SK", pts: 3, status: "Review", tone: "warning" as const, done: false },
  { title: "Risk owner notifications", type: "Task", who: "MP", pts: 3, status: "Review", tone: "warning" as const, done: false },
  { title: "Card vault migration", type: "Story", who: "SK", pts: 8, status: "Done", tone: "success" as const, done: true },
  { title: "Synonym dictionary editor", type: "Story", who: "JR", pts: 5, status: "To do", tone: "neutral" as const, done: false },
];

export function TasksMock() {
  return (
    <motion.div variants={group} initial="hidden" whileInView="show" viewport={VIEWPORT} className="space-y-3">
      <motion.div variants={rise} className="flex items-center gap-2">
        <div className="flex min-w-0 flex-1 items-center gap-2 rounded-lg border border-border/60 bg-background/60 px-2.5 py-1.5">
          <Search className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
          <span className="truncate text-[11px] text-muted-foreground">Search tasks, labels, people…</span>
        </div>
        <Chip tone="neutral">All sprints</Chip>
        <Chip tone="neutral" className="hidden sm:inline-flex">Priority</Chip>
      </motion.div>

      <div className="overflow-hidden rounded-xl border border-border/60">
        {taskRows.map((row, index) => (
          <motion.div
            key={row.title}
            variants={rise}
            className={cn(
              "flex items-center gap-2.5 px-2.5 py-2",
              index % 2 === 0 ? "bg-card/60" : "bg-card/30",
              index > 0 && "border-t border-border/40",
            )}
          >
            <span
              className={cn(
                "flex h-4 w-4 shrink-0 items-center justify-center rounded border transition-colors",
                row.done ? "border-primary bg-primary text-primary-foreground" : "border-muted-foreground/40",
              )}
            >
              {row.done ? <Check className="h-3 w-3" strokeWidth={3} /> : null}
            </span>
            <p className={cn("min-w-0 flex-1 truncate text-[11px]", row.done ? "text-muted-foreground line-through" : "font-medium")}>
              {row.title}
            </p>
            <Chip tone={row.tone} className="hidden sm:inline-flex">{row.type}</Chip>
            <Avatar initials={row.who} className="h-5 w-5 text-[8px]" />
            <span className="w-6 text-right text-[10px] font-bold text-muted-foreground">{row.pts}</span>
            <Chip tone={row.tone}>{row.status}</Chip>
          </motion.div>
        ))}
      </div>
    </motion.div>
  );
}

/* ── 6. Team workload ──────────────────────────────────────────── */

const members = [
  { name: "Ada L.", role: "Tech lead", load: 96, done: 34, state: "Overloaded" },
  { name: "Sam K.", role: "Backend", load: 78, done: 28, state: "Balanced" },
  { name: "Mira P.", role: "Design", load: 54, done: 21, state: "Balanced" },
  { name: "Jonah R.", role: "Frontend", load: 34, done: 17, state: "Available" },
  { name: "Wei Z.", role: "QA", load: 62, done: 24, state: "Balanced" },
];

function loadTone(load: number): { bar: string; chip: "destructive" | "primary" | "success" } {
  if (load >= 90) return { bar: "bg-destructive", chip: "destructive" };
  if (load >= 55) return { bar: "bg-chart-1", chip: "primary" };
  return { bar: "bg-chart-1/50", chip: "success" };
}

export function TeamMock() {
  return (
    <motion.div variants={group} initial="hidden" whileInView="show" viewport={VIEWPORT} className="space-y-3">
      <motion.div variants={rise} className="flex items-center justify-between">
        <p className="text-sm font-bold">Team workload</p>
        <Chip tone="neutral">Sprint 15 · 5 members</Chip>
      </motion.div>

      <div className="space-y-2">
        {members.map((member) => {
          const tone = loadTone(member.load);
          return (
            <motion.div
              key={member.name}
              variants={rise}
              className="rounded-xl border border-border/60 bg-card/60 p-2.5 sm:p-3"
            >
              <div className="flex items-center gap-2.5">
                <Avatar initials={member.name.split(" ").map((part) => part[0]).join("")} className="h-7 w-7 text-[10px]" />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-[11px] font-bold">{member.name}</p>
                  <p className="truncate text-[10px] text-muted-foreground">{member.role}</p>
                </div>
                <Chip tone={tone.chip}>{member.state}</Chip>
                <span className="w-9 text-right text-[11px] font-bold">{member.load}%</span>
              </div>
              <div className="mt-2 flex items-center gap-2">
                <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-muted/60">
                  <motion.div
                    variants={growX}
                    className={cn("h-full origin-left rounded-full", tone.bar)}
                    style={{ width: `${member.load}%` }}
                  />
                </div>
                <span className="text-[9px] font-medium text-muted-foreground">{member.done} SP done</span>
              </div>
            </motion.div>
          );
        })}
      </div>
    </motion.div>
  );
}

/* ── 7. Risk matrix ────────────────────────────────────────────── */

interface MatrixRisk {
  id: string;
  label: string;
  p: number;
  i: number;
  critical?: boolean;
}

const matrixRisks: MatrixRisk[] = [
  { id: "r1", label: "Payment provider migration", p: 4, i: 5, critical: true },
  { id: "r2", label: "Single-owner dependency", p: 3, i: 4 },
  { id: "r3", label: "Scope creep in search", p: 2, i: 3 },
  { id: "r4", label: "Flaky e2e suite", p: 3, i: 2 },
  { id: "r5", label: "Hiring delay", p: 1, i: 2 },
];

function cellTone(p: number, i: number): string {
  const score = p + i;
  if (score >= 9) return "border-destructive/30 bg-destructive/20";
  if (score >= 7) return "border-chart-3/30 bg-chart-3/15";
  if (score >= 5) return "border-chart-3/20 bg-chart-3/10";
  return "border-chart-1/20 bg-chart-1/10";
}

export function RiskMatrixMock() {
  return (
    <motion.div variants={group} initial="hidden" whileInView="show" viewport={VIEWPORT} className="space-y-3">
      <motion.div variants={rise} className="flex items-center justify-between">
        <p className="text-sm font-bold">Risk matrix</p>
        <Chip tone="destructive">1 critical open</Chip>
      </motion.div>

      <motion.div variants={rise} className="rounded-xl border border-border/60 bg-card/60 p-3">
        <div className="flex items-end justify-between">
          <p className="text-[9px] font-semibold uppercase tracking-wider text-muted-foreground">Impact ↑</p>
          <p className="text-[9px] font-medium text-muted-foreground/70">5 levels</p>
        </div>
        <div className="mt-1.5 grid grid-cols-5 gap-1">
          {Array.from({ length: 25 }, (_, index) => {
            const row = Math.floor(index / 5);
            const col = index % 5;
            const impact = 5 - row;
            const probability = col + 1;
            const inCell = matrixRisks.filter((risk) => risk.p === probability && risk.i === impact);
            return (
              <div
                key={index}
                className={cn(
                  "relative flex min-h-9 items-center justify-center rounded-md border sm:min-h-11",
                  cellTone(probability, impact),
                )}
              >
                {inCell.map((risk) => (
                  <motion.span
                    key={risk.id}
                    variants={pop}
                    title={risk.label}
                    className={cn(
                      "relative flex h-3 w-3 items-center justify-center rounded-full ring-2 ring-background",
                      risk.critical ? "bg-destructive" : "bg-foreground/70",
                    )}
                  >
                    {risk.critical ? (
                      <span aria-hidden="true" className="absolute -inset-1 animate-ping rounded-full bg-destructive/40" />
                    ) : null}
                  </motion.span>
                ))}
              </div>
            );
          })}
        </div>
        <div className="mt-1.5 flex items-center justify-between">
          <p className="text-[9px] font-medium text-muted-foreground/70">Rare</p>
          <p className="text-[9px] font-semibold uppercase tracking-wider text-muted-foreground">Probability →</p>
          <p className="text-[9px] font-medium text-muted-foreground/70">Likely</p>
        </div>
      </motion.div>

      <motion.div variants={rise} className="flex flex-wrap items-center gap-2">
        <Chip tone="success">● Low</Chip>
        <Chip tone="warning">● Medium</Chip>
        <Chip tone="warning">● High</Chip>
        <Chip tone="destructive">● Critical</Chip>
        <span className="ml-auto text-[10px] text-muted-foreground">Owner + mitigation on every dot</span>
      </motion.div>
    </motion.div>
  );
}

/* ── 8. Analytics & reports ────────────────────────────────────── */

const velocity = [
  { sprint: "S10", v: 34 },
  { sprint: "S11", v: 41 },
  { sprint: "S12", v: 38 },
  { sprint: "S13", v: 47 },
  { sprint: "S14", v: 44 },
  { sprint: "S15", v: 52 },
];
const VELOCITY_MAX = 58;

export function AnalyticsMock() {
  return (
    <motion.div variants={group} initial="hidden" whileInView="show" viewport={VIEWPORT} className="space-y-3">
      <motion.div variants={rise} className="flex flex-wrap items-center gap-2">
        <Chip tone="primary">Velocity</Chip>
        <Chip tone="neutral">Burndown</Chip>
        <Chip tone="neutral">Completion</Chip>
        <Chip tone="neutral">Priority</Chip>
        <Chip tone="neutral">Workload</Chip>
        <Chip tone="neutral">Risk</Chip>
      </motion.div>

      <div className="grid gap-2.5 sm:grid-cols-[1.5fr_1fr]">
        <motion.div variants={rise} className="rounded-xl border border-border/60 bg-card/60 p-3">
          <div className="flex items-center justify-between">
            <p className="text-xs font-bold">Velocity</p>
            <p className="text-[10px] font-medium text-chart-1">+12% vs S14</p>
          </div>
          <div className="mt-3 flex h-28 items-end gap-1.5 sm:h-32">
            {velocity.map((point) => (
              <div key={point.sprint} className="flex h-full flex-1 flex-col items-center justify-end gap-1">
                <span className="text-[8px] font-bold text-muted-foreground">{point.v}</span>
                <motion.div
                  variants={growY}
                  className="w-full origin-bottom rounded-t-md bg-gradient-to-t from-chart-2 to-chart-1"
                  style={{ height: `${(point.v / VELOCITY_MAX) * 100}%` }}
                />
                <span className="text-[8px] text-muted-foreground">{point.sprint}</span>
              </div>
            ))}
          </div>
        </motion.div>

        <motion.div variants={rise} className="relative flex items-center justify-center rounded-xl border border-border/60 bg-card/60 p-3">
          <svg viewBox="0 0 80 80" className="h-24 w-24 -rotate-90 sm:h-28 sm:w-28" aria-hidden="true">
            <circle cx="40" cy="40" r="33" fill="none" stroke="currentColor" className="text-muted/60" strokeWidth="9" />
            <motion.circle
              cx="40"
              cy="40"
              r="33"
              fill="none"
              stroke="currentColor"
              className="text-chart-1"
              strokeWidth="9"
              strokeLinecap="round"
              variants={{
                hidden: { pathLength: 0 },
                show: { pathLength: 0.68, transition: { duration: DURATION.transition, ease: EASING.emphasised } },
              }}
            />
          </svg>
          <div className="absolute inset-0 flex flex-col items-center justify-center pt-1">
            <span className="text-lg font-bold">
              <AnimatedCounter to={68} suffix="%" />
            </span>
            <span className="text-[9px] text-muted-foreground">Sprint complete</span>
          </div>
        </motion.div>
      </div>

      <motion.div variants={rise} className="flex items-center justify-between rounded-xl border border-border/60 bg-card/40 px-3 py-2">
        <p className="text-[10px] text-muted-foreground">Reports package this into a shareable project summary</p>
        <Chip tone="primary">Export ↗</Chip>
      </motion.div>
    </motion.div>
  );
}

/* ── 9. AI intelligence ────────────────────────────────────────── */

/**
 * The typing bubble fades in, holds, then hands over to the reply — one
 * variant with keyframes so the three beats cannot drift apart.
 */
const typingBubble: Variants = {
  hidden: { opacity: 0, y: 8 },
  show: {
    opacity: [0, 1, 1, 0],
    y: [8, 0, 0, 0],
    transition: { duration: 1.5, ease: "linear", times: [0, 0.14, 0.68, 1] },
  },
};

const reply: Variants = {
  hidden: { opacity: 0, y: 10 },
  show: { opacity: 1, y: 0, transition: { duration: DURATION.enter, ease: EASING.standard, delay: 1.3 } },
};

export function IntelligenceMock() {
  // The looping dots are the only infinite animation in the guide; a
  // reduced-motion visitor gets three static dots instead.
  const reduced = prefersReducedMotion();
  return (
    <div className="space-y-3">
      <motion.div
        initial="hidden"
        whileInView="show"
        viewport={VIEWPORT}
        variants={{ hidden: {}, show: {} }}
        className="flex justify-end"
      >
        <motion.p
          variants={{
            hidden: { opacity: 0, y: 8 },
            show: { opacity: 1, y: 0, transition: { duration: DURATION.enter, ease: EASING.standard } },
          }}
          className="max-w-[85%] rounded-2xl rounded-br-md border border-primary/30 bg-primary/10 px-3.5 py-2 text-[11px] leading-relaxed"
        >
          What’s at risk across my projects this sprint?
        </motion.p>
      </motion.div>

      <div className="flex justify-start">
        <motion.div
          initial="hidden"
          whileInView="show"
          viewport={VIEWPORT}
          variants={{ hidden: {}, show: {} }}
          className="rounded-2xl rounded-bl-md border border-border/60 bg-card/70 px-3.5 py-2.5"
        >
          <motion.span variants={typingBubble} className="flex items-center gap-1">
            {[0, 1, 2].map((dot) => (
              <motion.span
                key={dot}
                className="h-1.5 w-1.5 rounded-full bg-muted-foreground"
                animate={{ opacity: reduced ? 1 : [0.3, 1, 0.3] }}
                transition={{ duration: 0.9, repeat: reduced ? 0 : Infinity, delay: dot * 0.15 }}
              />
            ))}
          </motion.span>
        </motion.div>
      </div>

      <motion.div
        initial="hidden"
        whileInView="show"
        viewport={VIEWPORT}
        variants={{ hidden: {}, show: {} }}
        className="flex justify-start"
      >
        <motion.div
          variants={reply}
          className="max-w-full rounded-2xl rounded-bl-md border border-border/60 bg-card/70 p-3 sm:max-w-[92%]"
        >
          <div className="flex items-center gap-2">
            <span className="flex h-6 w-6 items-center justify-center rounded-md aie-gradient text-[9px] font-bold text-white">
              AI
            </span>
            <p className="text-[11px] font-bold">Sprint 15 · risk briefing</p>
            <Chip tone="neutral">from your board</Chip>
          </div>
          <ul className="mt-2.5 space-y-1.5">
            {[
              "Payment provider migration is critical and still ownerless",
              "Ada is at 96% capacity — two stories should move",
              "Sprint 15 is trending 18% under planned velocity",
            ].map((line) => (
              <li key={line} className="flex items-start gap-2 text-[11px] leading-relaxed text-muted-foreground">
                <span className="mt-1.5 h-1 w-1 shrink-0 rounded-full bg-primary" />
                {line}
              </li>
            ))}
          </ul>
          <div className="mt-2.5 flex flex-wrap gap-1.5 border-t border-border/50 pt-2.5">
            <Chip tone="destructive">Payment provider · Critical</Chip>
            <Chip tone="warning">Single-owner · High</Chip>
            <Chip tone="neutral">Scope creep · Medium</Chip>
          </div>
        </motion.div>
      </motion.div>
    </div>
  );
}

/* ── 10. Settings ──────────────────────────────────────────────── */

const settingsMenu = [
  { label: "Profile", active: false },
  { label: "Appearance", active: true },
  { label: "Members", active: false },
  { label: "Invitations", active: false },
  { label: "Audit log", active: false },
];

const themeSwatches = [
  { name: "Graphite", colors: ["#0b0d0f", "#606060", "#f1f1ef"], active: true },
  { name: "Modern Minimal", colors: ["#171717", "#3b82f6", "#e5e5e5"], active: false },
  { name: "Darkmatter", colors: ["#0d0b14", "#f09050", "#d4cde5"], active: false },
];

export function SettingsMock() {
  return (
    <motion.div variants={group} initial="hidden" whileInView="show" viewport={VIEWPORT} className="space-y-3">
      <div className="grid gap-2.5 sm:grid-cols-[130px_1fr]">
        <motion.div variants={rise} className="hidden rounded-xl border border-border/50 bg-muted/20 p-1.5 sm:block">
          {settingsMenu.map((item) => (
            <p
              key={item.label}
              className={cn(
                "rounded-lg px-2.5 py-1.5 text-[11px]",
                item.active ? "bg-primary/10 font-bold text-primary" : "text-muted-foreground",
              )}
            >
              {item.label}
            </p>
          ))}
        </motion.div>

        <div className="space-y-2.5">
          <motion.div variants={rise} className="rounded-xl border border-border/60 bg-card/60 p-3">
            <p className="text-xs font-bold">Appearance</p>
            <p className="mt-0.5 text-[10px] text-muted-foreground">Three themes, light and dark each</p>
            <div className="mt-2.5 grid grid-cols-3 gap-2">
              {themeSwatches.map((theme) => (
                <div
                  key={theme.name}
                  className={cn(
                    "rounded-lg border p-2 transition-colors",
                    theme.active ? "border-primary/50 bg-primary/5" : "border-border/50 bg-background/40",
                  )}
                >
                  <div className="flex gap-1">
                    {theme.colors.map((color) => (
                      <span key={color} className="h-3.5 w-3.5 rounded-full ring-1 ring-white/10" style={{ backgroundColor: color }} />
                    ))}
                  </div>
                  <p className="mt-1.5 truncate text-[9px] font-bold">{theme.name}</p>
                  {theme.active ? (
                    <p className="text-[9px] font-semibold text-primary">Active ✓</p>
                  ) : (
                    <p className="text-[9px] text-muted-foreground">Available</p>
                  )}
                </div>
              ))}
            </div>
          </motion.div>

          <motion.div variants={rise} className="flex items-center justify-between rounded-xl border border-border/60 bg-card/60 px-3 py-2.5">
            <div>
              <p className="text-[11px] font-bold">Dark appearance</p>
              <p className="text-[10px] text-muted-foreground">Applies across every page instantly</p>
            </div>
            <span className="relative h-5 w-9 rounded-full bg-primary/80">
              <span className="absolute right-0.5 top-0.5 h-4 w-4 rounded-full bg-white shadow" />
            </span>
          </motion.div>

          <motion.div variants={rise} className="rounded-xl border border-border/60 bg-card/60 p-3">
            <div className="flex items-center justify-between">
              <p className="text-[11px] font-bold">Members & roles</p>
              <Chip tone="primary">Invite by link</Chip>
            </div>
            <div className="mt-2 space-y-1.5">
              {[
                { name: "Ada L.", role: "Admin", tone: "primary" as const },
                { name: "Sam K.", role: "Member", tone: "neutral" as const },
              ].map((member) => (
                <div key={member.name} className="flex items-center gap-2 rounded-lg bg-background/40 px-2.5 py-1.5">
                  <Avatar initials={member.name.split(" ").map((part) => part[0]).join("")} className="h-5 w-5 text-[8px]" />
                  <p className="flex-1 text-[11px] font-medium">{member.name}</p>
                  <Chip tone={member.tone}>{member.role}</Chip>
                </div>
              ))}
            </div>
          </motion.div>
        </div>
      </div>
    </motion.div>
  );
}
