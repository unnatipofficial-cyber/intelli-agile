import { useEffect, useMemo, useState } from "react";
import type { ComponentType } from "react";
import { useQuery } from "convex/react";
import { motion } from "framer-motion";
import { useNavigate } from "react-router";
import {
  ArrowRight,
  CheckCircle2,
  Clock,
  MessageSquare,
  Sparkles,
  ThumbsUp,
  Timer,
  TrendingUp,
  Zap,
} from "lucide-react";
import { api } from "../convex/_generated/api";
import { AnimatedCounter } from "@/components/landing/AnimatedCounter";
import RetrospectiveBoard from "@/components/RetrospectiveBoard";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { DURATION, EASING, STAGGER } from "@/lib/motion";
import { cn } from "@/lib/utils";

/**
 * Retro — the step that was missing from the sprint loop.
 *
 * A retrospective answers two questions and, without them, the next sprint is
 * just a guess: what actually happened (points committed vs. delivered, time
 * spent and by whom) and what the team wants to change. Both halves are read
 * from data the board already produces, so the conversation starts from
 * evidence rather than from whoever remembers the loudest Tuesday.
 *
 * Scoped to one sprint throughout. The project-wide time summary would look
 * impressive and be wrong — a retro is about the sprint that just ended.
 */

/** Minutes → "3h 20m". Shared with the time panel so units never drift. */
function formatMinutes(minutes: number): string {
  if (!minutes) return "0m";
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  if (h === 0) return `${m}m`;
  if (m === 0) return `${h}h`;
  return `${h}h ${m}m`;
}

function formatDate(timestamp?: number): string {
  if (!timestamp) return "No dates set";
  return new Date(timestamp).toLocaleDateString(undefined, {
    day: "numeric",
    month: "short",
  });
}

/** Sorts sprints newest-first: by start date, falling back to creation order. */
interface SprintLike {
  _id: string;
  startDate?: number;
  _creationTime: number;
}

function byNewest(a: SprintLike, b: SprintLike) {
  return (b.startDate ?? b._creationTime) - (a.startDate ?? a._creationTime);
}

export default function Retro() {
  const navigate = useNavigate();
  const projects = useQuery(api.projects.list);
  const [projectId, setProjectId] = useState<string | null>(null);
  const [sprintId, setSprintId] = useState<string | null>(null);

  // Default to the first project, then to its most recent sprint. Both are
  // "derive from what just loaded" decisions, so they live in an effect
  // rather than being set during render.
  useEffect(() => {
    if (!projectId && projects && projects.length > 0) setProjectId(projects[0]._id);
  }, [projects, projectId]);

  const sprints = useQuery(
    api.sprints.list,
    projectId ? { projectId: projectId as any } : "skip",
  );

  const orderedSprints = useMemo(
    () => (sprints ? [...sprints].sort(byNewest) : []),
    [sprints],
  );

  useEffect(() => {
    if (!orderedSprints.length) {
      setSprintId(null);
      return;
    }
    // Keep the current selection if it is still valid after a project switch.
    if (!sprintId || !orderedSprints.some((s) => s._id === sprintId)) {
      setSprintId(orderedSprints[0]._id);
    }
  }, [orderedSprints, sprintId]);

  const selectedSprint = orderedSprints.find((s) => s._id === sprintId) ?? null;
  const selectedProject = projects?.find((p) => p._id === projectId) ?? null;

  const retro = useQuery(
    api.retrospectives.getBySprint,
    sprintId ? { sprintId: sprintId as any } : "skip",
  );
  const retroHistory = useQuery(
    api.retrospectives.listByProject,
    projectId ? { projectId: projectId as any } : "skip",
  );
  const timeSummary = useQuery(
    api.timeTracking.getSprintSummary,
    sprintId ? { sprintId: sprintId as any } : "skip",
  );

  /* ── Derived figures ─────────────────────────────────────── */
  const committed = selectedSprint?.totalPoints ?? 0;
  const delivered = selectedSprint?.completedPoints ?? 0;
  const completion = committed > 0 ? Math.round((delivered / committed) * 100) : 0;
  const loggedMinutes = timeSummary?.totalMinutes ?? 0;
  const minutesPerPoint = delivered > 0 ? loggedMinutes / delivered : 0;

  const history = useMemo(
    () =>
      (retroHistory ?? [])
        .map((entry) => ({
          id: entry._id,
          sprintId: entry.sprintId,
          sprintName: entry.sprintName,
          total:
            (entry.wentWell?.length ?? 0) +
            (entry.toImprove?.length ?? 0) +
            (entry.actionItems?.length ?? 0),
          actions: entry.actionItems?.length ?? 0,
        }))
        .sort((a, b) => b.total - a.total),
    [retroHistory],
  );

  const carriedActions = (retro?.actionItems ?? []) as string[];

  /* ── Empty states ───────────────────────────────────────── */
  if (projects && projects.length === 0) {
    return (
      <div className="space-y-6">
        <PageHeader />
        <div className="glass-card p-10 text-center">
          <span className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-2xl aie-gradient">
            <MessageSquare className="h-6 w-6 text-white" />
          </span>
          <h2 className="text-base font-bold">No projects yet</h2>
          <p className="mx-auto mt-2 max-w-sm text-sm text-muted-foreground">
            A retrospective belongs to a sprint, and a sprint belongs to a project. Create one first —
            or load the sample workspace to see this page with data in it.
          </p>
          <Button className="mt-5 gap-2" onClick={() => navigate("/dashboard/projects")}>
            Go to Projects <ArrowRight />
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <PageHeader />

      {/* Project switcher */}
      {projects && projects.length > 1 && (
        <div className="flex flex-wrap gap-2">
          {projects.map((project) => (
            <button
              key={project._id}
              type="button"
              onClick={() => setProjectId(project._id)}
              className={cn(
                "rounded-xl px-3 py-1.5 text-xs font-medium transition-all",
                projectId === project._id
                  ? "bg-primary text-primary-foreground shadow-sm"
                  : "glass-card hover:bg-accent/50",
              )}
            >
              {project.name}
            </button>
          ))}
        </div>
      )}

      {/* Sprint list loaded but the selection has not resolved yet — the board
          needs a real sprint id, so render the skeleton rather than guessing. */}
      {orderedSprints.length > 0 && (!selectedSprint || !selectedProject) ? (
        <div className="grid gap-4 md:grid-cols-3">
          {[1, 2, 3].map((column) => (
            <div key={column} className="glass-card space-y-3 p-4">
              <div className="aie-skeleton h-4 w-32 rounded" />
              <div className="aie-skeleton h-8 w-full rounded" />
              <div className="aie-skeleton h-8 w-full rounded" />
            </div>
          ))}
        </div>
      ) : orderedSprints.length === 0 ? (
        <div className="glass-card p-10 text-center">
          <span className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-2xl bg-primary/10">
            <TrendingUp className="h-6 w-6 text-primary" />
          </span>
          <h2 className="text-base font-bold">No sprints in this project</h2>
          <p className="mx-auto mt-2 max-w-sm text-sm text-muted-foreground">
            Plan a sprint on the Sprint Board, run it, and this page becomes the debrief: what you
            delivered, where the time went, and what to change next time.
          </p>
          <Button
            className="mt-5 gap-2"
            onClick={() => navigate("/dashboard/sprint-board")}
          >
            Open Sprint Board <ArrowRight />
          </Button>
        </div>
      ) : (
        <>
          {/* Sprint rail — one card per sprint, doubling as navigation */}
          <div className="-mx-1 flex gap-3 overflow-x-auto px-1 pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
            {orderedSprints.map((sprint) => {
              const active = sprint._id === sprintId;
              const pct =
                sprint.totalPoints > 0
                  ? Math.round((sprint.completedPoints / sprint.totalPoints) * 100)
                  : 0;
              return (
                <button
                  key={sprint._id}
                  type="button"
                  onClick={() => setSprintId(sprint._id)}
                  className={cn(
                    "w-56 shrink-0 rounded-2xl border p-4 text-left transition-all",
                    active
                      ? "border-primary/50 bg-primary/5 shadow-sm"
                      : "glass-card hover:bg-accent/40",
                  )}
                >
                  <div className="flex items-center justify-between gap-2">
                    <p className="truncate text-sm font-bold">{sprint.name}</p>
                    {sprint.status === "active" && (
                      <Badge className="shrink-0 text-[10px]">Active</Badge>
                    )}
                  </div>
                  <p className="mt-1 text-[10px] text-muted-foreground">
                    {formatDate(sprint.startDate)} – {formatDate(sprint.endDate)}
                  </p>
                  <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-muted/60">
                    <motion.div
                      initial={{ scaleX: 0 }}
                      animate={{ scaleX: pct / 100 }}
                      transition={{ duration: DURATION.reveal, ease: EASING.standard }}
                      style={{ width: `${pct}%` }}
                      className={cn(
                        "h-full origin-left rounded-full",
                        pct >= 90 ? "bg-chart-1" : pct >= 60 ? "bg-primary" : "bg-destructive",
                      )}
                    />
                  </div>
                  <p className="mt-2 text-[10px] font-medium text-muted-foreground">
                    {sprint.completedPoints} / {sprint.totalPoints} SP · {sprint.taskCount} tasks
                  </p>
                </button>
              );
            })}
          </div>

          {/* ── Outcome ─────────────────────────────────── */}
          <motion.section
            variants={{ hidden: { opacity: 0, y: 10 }, show: { opacity: 1, y: 0 } }}
            initial="hidden"
            animate="show"
            transition={{ duration: DURATION.reveal, ease: EASING.standard }}
            className="glass-card p-6"
          >
            <div className="grid gap-8 lg:grid-cols-[auto_1fr] lg:items-center">
              {/* Donut: the one number a retro opens with */}
              <div className="relative mx-auto h-40 w-40 shrink-0">
                <svg viewBox="0 0 80 80" className="h-full w-full -rotate-90" aria-hidden="true">
                  <circle
                    cx="40"
                    cy="40"
                    r="33"
                    fill="none"
                    strokeWidth="8"
                    className="text-muted/60"
                    stroke="currentColor"
                  />
                  <motion.circle
                    cx="40"
                    cy="40"
                    r="33"
                    fill="none"
                    strokeWidth="8"
                    strokeLinecap="round"
                    className="text-primary"
                    stroke="currentColor"
                    initial={{ pathLength: 0 }}
                    animate={{ pathLength: completion / 100 }}
                    transition={{ duration: DURATION.transition, ease: EASING.emphasised }}
                  />
                </svg>
                <div className="absolute inset-0 flex flex-col items-center justify-center">
                  <span className="text-3xl font-bold tracking-tight">
                    <AnimatedCounter to={completion} suffix="%" />
                  </span>
                  <span className="text-[10px] text-muted-foreground">points delivered</span>
                </div>
              </div>

              {/* The words that go with the number */}
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <h2 className="text-lg font-bold">{selectedSprint?.name}</h2>
                  <Badge variant="outline" className="text-[10px]">
                    {selectedSprint?.status}
                  </Badge>
                </div>
                {selectedSprint?.goal && (
                  <p className="mt-1 text-sm text-muted-foreground">
                    <span className="font-medium text-foreground">Goal:</span> {selectedSprint.goal}
                  </p>
                )}

                <div className="mt-5 grid gap-3 sm:grid-cols-3">
                  <Stat
                    icon={CheckCircle2}
                    label="Committed"
                    value={committed}
                    suffix=" SP"
                    detail={`${delivered} SP delivered`}
                  />
                  <Stat
                    icon={Timer}
                    label="Time logged"
                    value={Math.round(loggedMinutes / 60)}
                    suffix="h"
                    detail={`${timeSummary?.entryCount ?? 0} entries`}
                  />
                  <Stat
                    icon={Clock}
                    label="Per point"
                    value={Math.round(minutesPerPoint)}
                    suffix="m"
                    detail={
                      delivered > 0 ? "of effort per SP" : "no points delivered yet"
                    }
                  />
                </div>

                <p className="mt-4 text-xs leading-relaxed text-muted-foreground">
                  {committed === 0
                    ? "No story points were committed to this sprint, so there is nothing to compare against yet. Estimate as you plan and this becomes a real signal."
                    : `The team committed ${committed} points and delivered ${delivered}. ${
                        completion >= 90
                          ? "That is a sprint worth repeating — the board matched the plan."
                          : completion >= 60
                            ? "Close, but the shortfall is worth naming in the 'To Improve' column below."
                            : "A wide gap usually points at something structural: scope added mid-sprint, a blocked dependency, or estimates that were optimistic."
                      }`}
                </p>
              </div>
            </div>
          </motion.section>

          {/* ── The board ────────────────────────────────── */}
          <section>
            <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
              <div>
                <h2 className="text-base font-bold">Retrospective</h2>
                <p className="text-xs text-muted-foreground">
                  Three columns, one sprint. Add items as you talk — they persist per sprint, so the
                  next retro starts from last time&apos;s decisions.
                </p>
              </div>
              <Badge variant="outline" className="gap-1.5 text-[10px]">
                <Sparkles className="h-3 w-3" />
                {carriedActions.length} action
                {carriedActions.length === 1 ? "" : "s"} carried forward
              </Badge>
            </div>

            <RetrospectiveBoard
              sprintId={selectedSprint!._id}
              projectId={selectedProject!._id}
            />
          </section>

          {/* ── Where the time went ──────────────────────── */}
          <section className="glass-card p-6">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div>
                <h2 className="text-base font-bold">Where the time went</h2>
                <p className="text-xs text-muted-foreground">
                  Actuals for this sprint only — the input to next sprint&apos;s capacity plan.
                </p>
              </div>
              <span className="text-lg font-bold text-primary">
                {formatMinutes(loggedMinutes)}
              </span>
            </div>

            {(timeSummary?.byUser?.length ?? 0) === 0 ? (
              <p className="py-8 text-center text-sm text-muted-foreground">
                No time logged against this sprint&apos;s tasks yet. Log time from any task&apos;s
                detail sheet and it will show up here.
              </p>
            ) : (
              <div className="mt-6 grid gap-8 lg:grid-cols-2">
                <TimeBars
                  title="By person"
                  empty="No entries"
                  rows={timeSummary!.byUser.map((entry) => ({
                    key: entry.userId,
                    label: entry.userName,
                    minutes: entry.minutes,
                  }))}
                />
                <TimeBars
                  title="Most expensive tasks"
                  empty="No entries"
                  rows={timeSummary!.byTask.slice(0, 6).map((entry) => ({
                    key: entry.taskId,
                    label: entry.title,
                    minutes: entry.minutes,
                  }))}
                />
              </div>
            )}
          </section>

          {/* ── Carry forward ────────────────────────────── */}
          {carriedActions.length > 0 && (
            <section className="glass-card p-6">
              <div className="flex items-center gap-2">
                <Zap className="h-4 w-4 text-primary" />
                <h2 className="text-base font-bold">Carry into the next sprint</h2>
              </div>
              <p className="mt-1 text-xs text-muted-foreground">
                Action items from this retro. Pull them into the backlog before planning so the next
                sprint is shaped by what you just learned.
              </p>
              <motion.ul
                className="mt-4 space-y-2"
                initial="hidden"
                animate="show"
                variants={{ hidden: {}, show: { transition: { staggerChildren: STAGGER.step } } }}
              >
                {carriedActions.map((action, index) => (
                  <motion.li
                    key={`${action}-${index}`}
                    variants={{
                      hidden: { opacity: 0, y: 8 },
                      show: {
                        opacity: 1,
                        y: 0,
                        transition: { duration: DURATION.enter, ease: EASING.standard },
                      },
                    }}
                    className="flex items-start gap-2.5 rounded-xl border border-border/60 bg-card/40 p-3"
                  >
                    <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-chart-1" />
                    <span className="text-sm">{action}</span>
                  </motion.li>
                ))}
              </motion.ul>
              <Button
                variant="outline"
                size="sm"
                className="mt-4 gap-2"
                onClick={() => navigate("/dashboard/backlog")}
              >
                Open Backlog <ArrowRight className="h-3.5 w-3.5" />
              </Button>
            </section>
          )}

          {/* ── History ──────────────────────────────────── */}
          {history.length > 1 && (
            <section className="glass-card p-6">
              <h2 className="text-base font-bold">Every retro in this project</h2>
              <p className="mt-1 text-xs text-muted-foreground">
                {history.length} sprints reviewed. Sprints with more action items are usually the ones
                that needed them.
              </p>
              <div className="mt-4 space-y-2">
                {history.map((entry) => (
                  <button
                    key={entry.id}
                    type="button"
                    onClick={() => setSprintId(entry.sprintId)}
                    className="flex w-full items-center gap-3 rounded-xl border border-border/50 bg-card/30 p-3 text-left transition-colors hover:border-primary/40"
                  >
                    <ThumbsUp className="h-3.5 w-3.5 shrink-0 text-chart-1" />
                    <span className="min-w-0 flex-1 truncate text-sm font-medium">
                      {entry.sprintName}
                    </span>
                    <span className="shrink-0 text-[10px] text-muted-foreground">
                      {entry.total} items · {entry.actions} actions
                    </span>
                  </button>
                ))}
              </div>
            </section>
          )}
        </>
      )}
    </div>
  );
}

/* ── Pieces ──────────────────────────────────────────────────── */

function PageHeader() {
  return (
    <div className="flex flex-wrap items-start justify-between gap-3">
      <div>
        <div className="flex items-center gap-2.5">
          <span className="flex h-9 w-9 items-center justify-center rounded-xl aie-gradient">
            <MessageSquare className="h-4 w-4 text-white" />
          </span>
          <h1 className="text-2xl font-bold tracking-tight">Retrospective</h1>
        </div>
        <p className="mt-1 text-sm text-muted-foreground">
          Close the sprint loop: what you delivered, where the time went, and what to change next
          time.
        </p>
      </div>
    </div>
  );
}

function Stat({
  icon: Icon,
  label,
  value,
  suffix,
  detail,
}: {
  icon: ComponentType<{ className?: string }>;
  label: string;
  value: number;
  suffix?: string;
  detail: string;
}) {
  return (
    <div className="rounded-xl border border-border/60 bg-card/40 p-3">
      <div className="flex items-center gap-1.5">
        <Icon className="h-3.5 w-3.5 text-primary" />
        <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
          {label}
        </span>
      </div>
      <p className="mt-1.5 text-xl font-bold tracking-tight">
        <AnimatedCounter to={value} suffix={suffix ?? ""} />
      </p>
      <p className="mt-0.5 text-[10px] text-muted-foreground">{detail}</p>
    </div>
  );
}

/**
 * Horizontal bars scaled against the largest row, so the shape of the
 * distribution is readable at a glance rather than being a table of numbers.
 */
function TimeBars({
  title,
  rows,
  empty,
}: {
  title: string;
  rows: { key: string; label: string; minutes: number }[];
  empty: string;
}) {
  const max = rows.reduce((peak, row) => Math.max(peak, row.minutes), 0);
  const total = rows.reduce((sum, row) => sum + row.minutes, 0);

  return (
    <div>
      <div className="flex items-center justify-between">
        <h3 className="text-xs font-bold uppercase tracking-wider text-muted-foreground">{title}</h3>
        <span className="text-[10px] text-muted-foreground">{formatMinutes(total)}</span>
      </div>
      {rows.length === 0 ? (
        <p className="mt-4 text-xs text-muted-foreground">{empty}</p>
      ) : (
        <motion.ul
          className="mt-3 space-y-2.5"
          initial="hidden"
          animate="show"
          variants={{ hidden: {}, show: { transition: { staggerChildren: STAGGER.step } } }}
        >
          {rows.map((row) => (
            <motion.li
              key={row.key}
              variants={{
                hidden: { opacity: 0, x: -8 },
                show: {
                  opacity: 1,
                  x: 0,
                  transition: { duration: DURATION.enter, ease: EASING.standard },
                },
              }}
            >
              <div className="flex items-baseline justify-between gap-2">
                <span className="min-w-0 truncate text-xs">{row.label}</span>
                <span className="shrink-0 text-[10px] font-semibold text-muted-foreground">
                  {formatMinutes(row.minutes)}
                  {total > 0 && (
                    <span className="ml-1 opacity-60">
                      {Math.round((row.minutes / total) * 100)}%
                    </span>
                  )}
                </span>
              </div>
              <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-muted/60">
                <motion.div
                  className="h-full origin-left rounded-full bg-chart-2"
                  initial={{ scaleX: 0 }}
                  animate={{ scaleX: max > 0 ? row.minutes / max : 0 }}
                  transition={{ duration: DURATION.reveal, ease: EASING.emphasised }}
                  style={{ width: `${max > 0 ? (row.minutes / max) * 100 : 0}%` }}
                />
              </div>
            </motion.li>
          ))}
        </motion.ul>
      )}
    </div>
  );
}