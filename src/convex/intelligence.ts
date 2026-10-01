/**
 * Ambient intelligence — the layer that makes every page in AIE explain
 * itself instead of just displaying rows.
 *
 * Two halves, deliberately split:
 *
 *  1. `facts` (a plain query) computes the deterministic picture for a view:
 *     dashboard, project, sprint, team, risks or tasks. It is fast, reactive
 *     and costs nothing, so the UI can render it immediately.
 *  2. `narrative` (an action, in agent.ts) has Gemini write the "so what" over
 *     those facts. It is cached with a TTL in `aiBriefings` and degrades to a
 *     deterministic summary if the model is unavailable, so a briefing is
 *     never blank.
 *
 * The split matters for trust: the numbers always come from the database, and
 * the AI only ever narrates them.
 */

import { v } from "convex/values";
import { query, internalQuery, internalMutation } from "./_generated/server";
import {
  BRIEFING_TTL_MS,
  briefingKey,
  type BriefKind,
} from "./briefingKey";

export { BRIEFING_TTL_MS, briefingKey };
export type { BriefKind };

export interface BriefMetric {
  label: string;
  value: string;
  tone?: "good" | "warn" | "bad" | "neutral";
}

export interface BriefFlag {
  tone: "critical" | "high" | "medium" | "low";
  title: string;
  detail: string;
}

export interface BriefFacts {
  kind: BriefKind;
  scope: string;
  headline: string;
  metrics: BriefMetric[];
  flags: BriefFlag[];
  /** Concrete next actions, derived from the data rather than invented. */
  suggestions: string[];
}

const DAY = 86_400_000;

const pct = (done: number, total: number) =>
  total === 0 ? 0 : Math.round((done / total) * 100);

function toneForOverdue(count: number): "good" | "warn" | "bad" | "neutral" {
  if (count === 0) return "good";
  if (count <= 3) return "warn";
  return "bad";
}

function nameOf(u: any): string {
  return u?.name ?? u?.email ?? "Unknown";
}

/**
 * The deterministic read-out for a page. Everything the AI panel shows as a
 * number, flag or suggestion is computed here.
 */
export const facts = query({
  args: {
    kind: v.union(
      v.literal("dashboard"),
      v.literal("project"),
      v.literal("sprint"),
      v.literal("team"),
      v.literal("risks"),
      v.literal("tasks")
    ),
    projectId: v.optional(v.id("projects")),
  },
  handler: async (ctx, args): Promise<BriefFacts> => {
    const now = Date.now();
    const [projects, tasks, risks, sprints, users, members] = await Promise.all([
      ctx.db.query("projects").collect(),
      ctx.db.query("tasks").collect(),
      ctx.db.query("risks").collect(),
      ctx.db.query("sprints").collect(),
      ctx.db.query("users").collect(),
      ctx.db.query("projectMembers").collect(),
    ]);

    const scoped = args.projectId
      ? projects.filter((p) => p._id === args.projectId)
      : projects;
    const scopeIds = new Set(scoped.map((p) => p._id));
    const inScope = <T extends { projectId: any }>(rows: T[]) =>
      rows.filter((r) => scopeIds.has(r.projectId));

    const allTasks = args.projectId ? inScope(tasks) : tasks;
    const allRisks = args.projectId ? inScope(risks) : risks;
    const allSprints = args.projectId ? inScope(sprints) : sprints;

    const open = allTasks.filter((t) => t.status !== "done");
    const done = allTasks.filter((t) => t.status === "done");
    const overdue = open.filter((t) => t.dueDate && t.dueDate < now);
    const unassigned = open.filter((t) => !t.assigneeId);
    const openBugs = open.filter((t) => t.type === "bug");
    const pointsDone = done.reduce((s, t) => s + (t.storyPoints ?? 0), 0);
    const pointsTotal = allTasks.reduce((s, t) => s + (t.storyPoints ?? 0), 0);
    const activeSprints = allSprints.filter((s) => s.status === "active");
    const criticalRisks = allRisks.filter(
      (r) => r.status === "open" && (r.severity === "critical" || r.score >= 16)
    );

    const scopeName = args.projectId ? (scoped[0]?.name ?? "Project") : "the workspace";
    const base = {
      kind: args.kind,
      scope: scopeName,
      metrics: [] as BriefMetric[],
      flags: [] as BriefFlag[],
      suggestions: [] as string[],
      headline: "",
    };

    /* ── Shared building blocks ─────────────────────────────────── */

    const workload = users
      .map((u) => {
        const mine = allTasks.filter((t) => t.assigneeId === u._id);
        const openMine = mine.filter((t) => t.status !== "done");
        return {
          id: u._id,
          name: nameOf(u),
          jobTitle: u.jobTitle ?? null,
          open: openMine.length,
          openPoints: openMine.reduce((s, t) => s + (t.storyPoints ?? 0), 0),
          overdue: openMine.filter((t) => t.dueDate && t.dueDate < now).length,
          done: mine.filter((t) => t.status === "done").length,
          total: mine.length,
        };
      })
      .sort((a, b) => b.openPoints - a.openPoints);

    const overload = workload.filter((w) => w.openPoints > 0);
    const avgOpen =
      overload.length > 0
        ? overload.reduce((s, w) => s + w.openPoints, 0) / overload.length
        : 0;

    /* ── Per-view briefs ────────────────────────────────────────── */

    switch (args.kind) {
      case "dashboard": {
        const lateProjects = scoped.filter(
          (p) => p.status === "active" && p.endDate && p.endDate < new Date(now).toISOString().slice(0, 10)
        );
        const criticalPoints = criticalRisks
          .slice(0, 3)
          .map((r) => `${r.title} (score ${r.score})`);

        base.metrics = [
          { label: "Active projects", value: String(scoped.filter((p) => p.status === "active").length), tone: "neutral" },
          { label: "Open tasks", value: String(open.length), tone: open.length > 40 ? "warn" : "neutral" },
          { label: "Overdue", value: String(overdue.length), tone: toneForOverdue(overdue.length) },
          { label: "Unassigned", value: String(unassigned.length), tone: unassigned.length > 0 ? "warn" : "good" },
          { label: "Open bugs", value: String(openBugs.length), tone: openBugs.length > 5 ? "bad" : "neutral" },
          { label: "Critical risks", value: String(criticalRisks.length), tone: criticalRisks.length > 0 ? "bad" : "good" },
          { label: "Team", value: String(users.length), tone: "neutral" },
        ];

        base.flags = [
          ...criticalPoints.map((title) => ({
            tone: "critical" as const,
            title: "Critical risk is open",
            detail: title,
          })),
          ...(overdue.length > 0
            ? [
                {
                  tone: (overdue.length > 5 ? "high" : "medium") as "high" | "medium",
                  title: `${overdue.length} task${overdue.length === 1 ? "" : "s"} past due`,
                  detail:
                    "Oldest is " +
                    Math.round((now - Math.min(...overdue.map((t) => t.dueDate!))) / DAY) +
                    " days late.",
                },
              ]
            : []),
          ...(unassigned.length > 0
            ? [
                {
                  tone: "medium" as const,
                  title: `${unassigned.length} open task${unassigned.length === 1 ? "" : "s"} have no owner`,
                  detail: "Nobody is accountable for this work.",
                },
              ]
            : []),
          ...(overload[0] && avgOpen > 0 && overload[0].openPoints > avgOpen * 1.8
            ? [
                {
                  tone: "high" as const,
                  title: `${overload[0].name} is carrying the heaviest load`,
                  detail: `${overload[0].openPoints} open story points against a team average of ${Math.round(avgOpen)}.`,
                },
              ]
            : []),
          ...lateProjects.map((p) => ({
            tone: "high" as const,
            title: `${p.name} is past its end date`,
            detail: `End date was ${p.endDate} and the project is still active.`,
          })),
        ];

        base.suggestions = [
          overdue.length > 0
            ? `Clear the ${overdue.length} overdue task(s) first — start with the oldest.`
            : "Nothing is overdue — a good moment to pull work forward.",
          unassigned.length > 0
            ? `Assign the ${unassigned.length} unowned task(s) so nothing drifts.`
            : "Every open task has an owner.",
          criticalRisks.length > 0
            ? "Schedule a risk review for the open critical items."
            : "Risk register is clear.",
        ];

        base.headline = `${scoped.length} project(s), ${open.length} open task(s) across ${users.length} people, ${overdue.length} overdue and ${criticalRisks.length} critical risk(s).`;
        break;
      }

      case "project": {
        const project = scoped[0];
        if (!project) {
          return { ...base, headline: "This project no longer exists." };
        }
        const endMs = project.endDate ? Date.parse(project.endDate) : null;
        const daysLeft = endMs ? Math.round((endMs - now) / DAY) : null;
        const projectMembers = members.filter((m) => m.projectId === project._id);
        const sprint = activeSprints[0];

        base.scope = project.name;
        base.metrics = [
          { label: "Progress", value: `${pct(done.length, allTasks.length)}%`, tone: pct(done.length, allTasks.length) >= 60 ? "good" : "warn" },
          { label: "Open tasks", value: String(open.length), tone: "neutral" },
          { label: "Overdue", value: String(overdue.length), tone: toneForOverdue(overdue.length) },
          { label: "Open bugs", value: String(openBugs.length), tone: openBugs.length > 3 ? "bad" : "neutral" },
          { label: "Points done", value: `${pointsDone}/${pointsTotal}`, tone: "neutral" },
          { label: "Members", value: String(projectMembers.length), tone: "neutral" },
          ...(daysLeft !== null
            ? [
                {
                  label: "Days left",
                  value: String(daysLeft),
                  tone: daysLeft < 0 ? ("bad" as const) : daysLeft < 7 ? ("warn" as const) : ("neutral" as const),
                },
              ]
            : []),
        ];

        base.flags = [
          ...(daysLeft !== null && daysLeft < 0 && project.status === "active"
            ? [
                {
                  tone: "critical" as const,
                  title: "Past the end date",
                  detail: `Due ${project.endDate}, ${Math.abs(daysLeft)} day(s) ago, and still ${project.status}.`,
                },
              ]
            : []),
          ...(sprint
            ? [
                {
                  tone: "medium" as const,
                  title: `${sprint.name} ends in ${Math.max(0, Math.round((sprint.endDate - now) / DAY))} day(s)`,
                  detail: `Goal: ${sprint.goal ?? "not set"}.`,
                },
              ]
            : []),
          ...allRisks
            .filter((r) => r.status === "open" && !r.mitigationStrategy)
            .slice(0, 2)
            .map((r) => ({
              tone: "high" as const,
              title: `"${r.title}" has no mitigation`,
              detail: "An open risk with no plan is just a surprise later.",
            })),
          ...(projectMembers.length === 0
            ? [
                {
                  tone: "medium" as const,
                  title: "No members assigned",
                  detail: "Nobody is on this project yet.",
                },
              ]
            : []),
        ];

        base.suggestions = [
          `This project is ${pct(done.length, allTasks.length)}% complete with ${open.length} task(s) still open.`,
          overdue.length > 0
            ? `Resolve the ${overdue.length} overdue task(s) or re-date them honestly.`
            : "Nothing is overdue on this project.",
          sprint && sprint.goal
            ? `Check progress against the sprint goal: ${sprint.goal}`
            : "The active sprint has no goal written — that is worth setting.",
        ];
        base.headline = `${project.name} is ${pct(done.length, allTasks.length)}% complete${daysLeft !== null ? ` with ${daysLeft} day(s) to the end date` : ""}.`;
        break;
      }

      case "sprint": {
        const sprint = activeSprints[0];
        if (!sprint) {
          return {
            ...base,
            scope: scopeName,
            headline: "There is no active sprint to analyse.",
            metrics: [{ label: "Active sprint", value: "none", tone: "warn" }],
          };
        }
        const sprintTasks = allTasks.filter((t) => t.sprintId === sprint._id);
        const sprintDone = sprintTasks.filter((t) => t.status === "done");
        const remaining = sprintTasks.length - sprintDone.length;
        const elapsed = now > sprint.startDate ? now - sprint.startDate : 0;
        const duration = Math.max(1, sprint.endDate - sprint.startDate);
        const expected = Math.min(100, Math.round((elapsed / duration) * 100));
        const actual = pct(sprintDone.length, sprintTasks.length);
        const drift = expected - actual;
        const daysLeft = Math.round((sprint.endDate - now) / DAY);
        const sprintPoints = sprintDone.reduce((s, t) => s + (t.storyPoints ?? 0), 0);
        const sprintCapacity = sprint.capacity ?? 0;

        base.scope = `${sprint.name}${args.projectId ? "" : ""}`;
        base.metrics = [
          { label: "Done", value: `${sprintDone.length}/${sprintTasks.length}`, tone: actual >= expected ? "good" : "warn" },
          { label: "Points done", value: `${sprintPoints}${sprintCapacity ? `/${sprintCapacity}` : ""}`, tone: "neutral" },
          { label: "Days left", value: String(daysLeft), tone: daysLeft < 0 ? "bad" : daysLeft <= 1 ? "warn" : "neutral" },
          { label: "In progress", value: String(sprintTasks.filter((t) => t.status === "in-progress").length), tone: "neutral" },
          { label: "In review", value: String(sprintTasks.filter((t) => t.status === "review").length), tone: "warn" },
        ];

        base.flags = [
          ...(drift > 15
            ? [
                {
                  tone: (drift > 25 ? "critical" : "high") as "critical" | "high",
                  title: "Sprint is behind pace",
                  detail: `${actual}% done at ${expected}% through the sprint — ${drift} points of drift with ${daysLeft} day(s) left.`,
                },
              ]
            : []),
          ...(daysLeft < 0 && remaining > 0
            ? [
                {
                  tone: "critical" as const,
                  title: "Sprint ended with work outstanding",
                  detail: `${remaining} task(s) are still not done.`,
                },
              ]
            : []),
          ...(sprintTasks.filter((t) => t.status === "review").length > 2
            ? [
                {
                  tone: "medium" as const,
                  title: "Review queue is building up",
                  detail: `${sprintTasks.filter((t) => t.status === "review").length} task(s) are waiting on review.`,
                },
              ]
            : []),
        ];

        base.suggestions = [
          drift > 15
            ? `Cut scope or add capacity — ${remaining} task(s) left with ${daysLeft} day(s) to go.`
            : "The sprint is tracking to plan. Protect the remaining work.",
          sprintTasks.filter((t) => t.status === "review").length > 0
            ? "Clear the review queue; finished work only counts once it is merged."
            : "No review backlog.",
        ];
        base.headline = `${sprint.name} is ${actual}% complete, ${Math.abs(drift)} points ${drift >= 0 ? "behind" : "ahead of"} expected pace.`;
        break;
      }

      case "team": {
        const busiest = overload[0];
        const idle = workload.filter((w) => w.total > 0 && w.open === 0);
        const withOverdue = workload.filter((w) => w.overdue > 0);
        const criticalTasks = open.filter((t) => t.priority === "critical" && t.assigneeId);
        const byAssignee = new Map<string, number>();
        for (const t of criticalTasks) {
          byAssignee.set(t.assigneeId!, (byAssignee.get(t.assigneeId!) ?? 0) + 1);
        }
        const bottleneck = [...byAssignee.entries()].sort((a, b) => b[1] - a[1])[0];
        const bottleneckName = bottleneck
          ? workload.find((w) => w.id === bottleneck[0])?.name ?? "Someone"
          : null;

        base.metrics = [
          { label: "People", value: String(users.length), tone: "neutral" },
          { label: "Open tasks", value: String(open.length), tone: "neutral" },
          { label: "Avg open points", value: String(Math.round(avgOpen)), tone: avgOpen > 8 ? "warn" : "neutral" },
          { label: "Completed", value: String(done.length), tone: "good" },
        ];

        base.flags = [
          ...(bottleneckName && bottleneck && bottleneck[1] >= 3
            ? [
                {
                  tone: "high" as const,
                  title: `${bottleneckName} holds ${bottleneck[1]} critical tasks`,
                  detail: "Concentrating critical work on one person is a single point of failure.",
                },
              ]
            : []),
          ...withOverdue.slice(0, 2).map((w) => ({
            tone: "medium" as const,
            title: `${w.name} has ${w.overdue} overdue task(s)`,
            detail: "Worth a check-in before it becomes a pattern.",
          })),
          ...(idle.length > 0 && busiest
            ? [
                {
                  tone: "low" as const,
                  title: `${idle.length} people have nothing open`,
                  detail: `${busiest.name} is carrying ${busiest.openPoints} points — there is room to rebalance.`,
                },
              ]
            : []),
        ];

        base.suggestions = [
          busiest ? `Start by rebalancing ${busiest.name}'s ${busiest.openPoints} open story points.` : "Workload is evenly spread.",
          withOverdue.length > 0
            ? `Check in with ${withOverdue.map((w) => w.name).join(", ")} about overdue work.`
            : "Nobody is carrying overdue work.",
        ];
        base.headline = `${users.length} people carrying ${open.length} open task(s); ${busiest ? `${busiest.name} is the most loaded with ${busiest.openPoints} points` : "no one is loaded"}.`;
        break;
      }

      case "risks": {
        const openRisks = allRisks.filter((r) => r.status === "open");
        const mitigated = allRisks.filter((r) => r.status === "mitigated");
        const noPlan = openRisks.filter((r) => !r.mitigationStrategy);
        const unowned = openRisks.filter((r) => !r.ownerId);
        const sorted = [...openRisks].sort((a, b) => b.score - a.score);

        base.metrics = [
          { label: "Open risks", value: String(openRisks.length), tone: openRisks.length > 5 ? "warn" : "neutral" },
          { label: "Critical", value: String(criticalRisks.length), tone: criticalRisks.length > 0 ? "bad" : "good" },
          { label: "Mitigated", value: String(mitigated.length), tone: "good" },
          { label: "No plan", value: String(noPlan.length), tone: noPlan.length > 0 ? "bad" : "good" },
          { label: "No owner", value: String(unowned.length), tone: unowned.length > 0 ? "warn" : "good" },
        ];

        base.flags = sorted.slice(0, 4).map((r) => ({
          tone: (r.severity === "critical" ? "critical" : r.severity === "high" ? "high" : "medium") as
            | "critical"
            | "high"
            | "medium",
          title: r.title,
          detail: `Probability ${r.probability}/5, impact ${r.impact}/5 → score ${r.score}. ${r.mitigationStrategy ? "Has a mitigation." : "No mitigation recorded."}`,
        }));

        base.suggestions = [
          noPlan.length > 0
            ? `Write a mitigation for the ${noPlan.length} risk(s) that have none.`
            : "Every open risk has a mitigation.",
          unowned.length > 0
            ? `Assign owners to the ${unowned.length} unowned risk(s).`
            : "Every open risk has an owner.",
          criticalRisks.length > 0
            ? `Book a review for: ${criticalRisks.map((r) => r.title).join(", ")}.`
            : "No critical risks open.",
        ];
        base.headline = `${openRisks.length} open risk(s), ${criticalRisks.length} of them critical.`;
        break;
      }

      case "tasks": {
        const stale = open.filter(
          (t) => now - (t.updatedAt ?? t.createdAt) > 14 * DAY
        );
        const dueSoon = open.filter(
          (t) => t.dueDate && t.dueDate >= now && t.dueDate < now + 3 * DAY
        );
        const readyToClose = allTasks.filter(
          (t) => t.status === "review"
        );

        base.metrics = [
          { label: "Open", value: String(open.length), tone: "neutral" },
          { label: "Overdue", value: String(overdue.length), tone: toneForOverdue(overdue.length) },
          { label: "Due in 3 days", value: String(dueSoon.length), tone: dueSoon.length > 0 ? "warn" : "neutral" },
          { label: "Unassigned", value: String(unassigned.length), tone: unassigned.length > 0 ? "warn" : "good" },
          { label: "Stale 14d+", value: String(stale.length), tone: stale.length > 5 ? "bad" : "neutral" },
          { label: "In review", value: String(readyToClose.length), tone: readyToClose.length > 0 ? "warn" : "neutral" },
        ];

        base.flags = [
          ...overdue
            .slice(0, 3)
            .map((t) => ({
              tone: "high" as const,
              title: `"${t.title}" is overdue`,
              detail: `${Math.round((now - t.dueDate!) / DAY)} day(s) late, still ${t.status}.`,
            })),
          ...unassigned.slice(0, 2).map((t) => ({
            tone: "medium" as const,
            title: `"${t.title}" has no owner`,
            detail: "Unassigned work is work that quietly does not happen.",
          })),
          ...(stale.length > 3
            ? [
                {
                  tone: "medium" as const,
                  title: `${stale.length} task(s) have not moved in two weeks`,
                  detail: "Stale tasks are usually blocked, forgotten, or done but unmarked.",
                },
              ]
            : []),
        ];

        base.suggestions = [
          readyToClose.length > 0
            ? `Review and close the ${readyToClose.length} task(s) sitting in review.`
            : "Nothing is stuck waiting on review.",
          overdue.length > 0
            ? `Triage the ${overdue.length} overdue task(s).`
            : "Nothing is overdue.",
          stale.length > 0
            ? `Decide whether the ${stale.length} stale task(s) are blocked, done, or should be closed.`
            : "The backlog is moving.",
        ];
        base.headline = `${open.length} open task(s): ${overdue.length} overdue, ${unassigned.length} unassigned, ${stale.length} untouched for two weeks.`;
        break;
      }
    }

    return base;
  },
});

/* ── Narrative cache ───────────────────────────────────────────── */

/** Read the cached narrative for a view, if it hasn't expired. */
export const cachedNarrative = internalQuery({
  args: { key: v.string() },
  handler: async (ctx, args) => {
    const row = await ctx.db
      .query("aiBriefings")
      .withIndex("by_key", (q) => q.eq("key", args.key))
      .first();
    if (!row || row.expiresAt <= Date.now()) return null;
    return {
      text: row.text,
      generatedAt: row.generatedAt,
      cached: true,
    };
  },
});

export const storeNarrative = internalMutation({
  args: {
    key: v.string(),
    kind: v.string(),
    text: v.string(),
  },
  handler: async (ctx, args) => {
    const now = Date.now();
    const existing = await ctx.db
      .query("aiBriefings")
      .withIndex("by_key", (q) => q.eq("key", args.key))
      .first();
    if (existing) {
      await ctx.db.patch(existing._id, {
        text: args.text,
        generatedAt: now,
        expiresAt: now + BRIEFING_TTL_MS,
      });
    } else {
      await ctx.db.insert("aiBriefings", {
        key: args.key,
        kind: args.kind,
        text: args.text,
        generatedAt: now,
        expiresAt: now + BRIEFING_TTL_MS,
      });
    }
    // Opportunistic cleanup so the table cannot grow without bound.
    const expired = await ctx.db
      .query("aiBriefings")
      .withIndex("by_expiry", (q) => q.lte("expiresAt", now))
      .take(20);
    for (const row of expired) await ctx.db.delete(row._id);
    return { stored: true };
  },
});