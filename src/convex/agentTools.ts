/**
 * AIE Agent tools — every query and mutation the agent's function-calling loop
 * can execute. These cannot live in agent.ts: "use node" modules may only
 * define actions, and these must be regular Convex functions.
 *
 * They run through ctx.runQuery / ctx.runMutation from the agent action, so
 * the auth context carries over: getAuthUserId returns the signed-in user who
 * asked the agent to act, and every write is logged to activityLogs exactly
 * as if they had clicked the buttons themselves.
 *
 * Typo tolerance lives here, not in the prompt: mutating tools take *names*
 * ("project", "assignee", "title") rather than ids, and resolve them through
 * fuzzy matching in ./fuzzy. So "creat a projct called apolo" still finds
 * Apollo, and the resolution is reported back so the agent can confirm it.
 */

import { v } from "convex/values";
import { internalQuery, internalMutation } from "./_generated/server";
import { getAuthUserId } from "@convex-dev/auth/server";
import { api } from "./_generated/api";
import {
  findFuzzy,
  normEnum,
  parseDateInput,
  describeRelative,
  type FuzzyCandidate,
} from "./fuzzy";

/* ── Shared plumbing ───────────────────────────────────────────── */

type DbCtx = { db: any };

/**
 * Document fetch that keeps a single loose type. Resolved ids come out of
 * fuzzy matching as `any`, and `getDoc(ctx,any)` widens to the union of every
 * table's document shape, which makes ordinary field reads fail to compile.
 */
async function getDoc(ctx: any, id: any): Promise<any> {
  return await getDoc(ctx,id);
}

interface Resolved {
  ok: boolean;
  id?: any;
  name?: string;
  error?: string;
  /** Set when the input was misspelled and fuzzy matching corrected it. */
  note?: string;
}

function corrected(input: string, match: { label: string; corrected: boolean }): string | undefined {
  return match.corrected
    ? `Matched your "${input}" to "${match.label}"`
    : undefined;
}

async function resolveProject(ctx: DbCtx, input?: string): Promise<Resolved> {
  const projects = await ctx.db.query("projects").collect();
  if (!projects.length) {
    return { ok: false, error: "There are no projects in the workspace yet." };
  }
  const names = projects.map((p: any) => p.name).join(", ");
  if (!input) {
    if (projects.length === 1) {
      return { ok: true, id: projects[0]._id, name: projects[0].name };
    }
    return { ok: false, error: `Which project? Available projects: ${names}` };
  }
  const match = findFuzzy(
    input,
    projects.map((p: any) => ({ value: p._id, label: p.name }))
  );
  if (!match) {
    return { ok: false, error: `No project matches "${input}". Available: ${names}` };
  }
  return {
    ok: true,
    id: match.item.value,
    name: match.label,
    note: corrected(input, match),
  };
}

async function resolveUser(ctx: DbCtx, input?: string): Promise<Resolved> {
  const users = await ctx.db.query("users").collect();
  if (!users.length) {
    return {
      ok: false,
      error: "There are no team members yet. Create one with add_team_member first.",
    };
  }
  const label = (u: any) => u.name ?? u.email ?? "Unknown";
  const names = users.map(label).join(", ");
  if (!input) return { ok: false, error: `Who? Team members: ${names}` };
  const candidates: FuzzyCandidate<any>[] = users.map((u: any) => ({
    value: u._id,
    label: label(u),
    aliases: [u.email, u.jobTitle, u.department].filter(Boolean) as string[],
  }));
  const match = findFuzzy(input, candidates);
  if (!match) {
    return {
      ok: false,
      error: `No team member matches "${input}". Team: ${names}. If this person is new to the workspace, create them with add_team_member instead of assigning work.`,
    };
  }
  const user = users.find((u: any) => u._id === match.item.value);
  return {
    ok: true,
    id: user._id,
    name: label(user),
    note: corrected(input, match),
  };
}

async function resolveTask(
  ctx: DbCtx,
  input?: string,
  projectId?: any
): Promise<Resolved> {
  let tasks = await ctx.db.query("tasks").collect();
  if (projectId) {
    tasks = tasks.filter((t: any) => t.projectId === projectId);
  }
  if (!tasks.length) {
    return {
      ok: false,
      error: projectId
        ? "That project has no tasks yet."
        : "There are no tasks in the workspace yet.",
    };
  }
  if (!input) return { ok: false, error: "Which task? Pass a task title." };
  const match = findFuzzy(
    input,
    tasks.map((t: any) => ({ value: t._id, label: t.title }))
  );
  if (!match) {
    return {
      ok: false,
      error: `No task matches "${input}". Ask the user to pick from the task list.`,
    };
  }
  const task = tasks.find((t: any) => t._id === match.item.value);
  return { ok: true, id: task._id, name: task.title, note: corrected(input, match) };
}

async function resolveSprint(
  ctx: DbCtx,
  input?: string,
  projectId?: any
): Promise<Resolved> {
  let sprints = await ctx.db.query("sprints").collect();
  if (projectId) sprints = sprints.filter((s: any) => s.projectId === projectId);
  if (!sprints.length) return { ok: false, error: "There are no sprints yet." };
  const names = sprints.map((s: any) => s.name).join(", ");
  if (!input) {
    const active = sprints.find((s: any) => s.status === "active");
    if (active) return { ok: true, id: active._id, name: active.name };
    return { ok: false, error: `Which sprint? Available: ${names}` };
  }
  const match = findFuzzy(
    input,
    sprints.map((s: any) => ({ value: s._id, label: s.name }))
  );
  if (!match) return { ok: false, error: `No sprint matches "${input}". Available: ${names}` };
  const sprint = sprints.find((s: any) => s._id === match.item.value);
  return { ok: true, id: sprint._id, name: sprint.name, note: corrected(input, match) };
}

async function resolveEpic(
  ctx: DbCtx,
  input: string,
  projectId: any
): Promise<Resolved> {
  const epics = await ctx.db
    .query("epics")
    .withIndex("by_project", (q: any) => q.eq("projectId", projectId))
    .collect();
  if (!epics.length) return { ok: false, error: "That project has no epics yet." };
  const match = findFuzzy(
    input,
    epics.map((e: any) => ({ value: e._id, label: e.title }))
  );
  if (!match) {
    return {
      ok: false,
      error: `No epic matches "${input}". Epics: ${epics.map((e: any) => e.title).join(", ")}`,
    };
  }
  const epic = epics.find((e: any) => e._id === match.item.value);
  return { ok: true, id: epic._id, name: epic.title, note: corrected(input, match) };
}

async function resolveStory(
  ctx: DbCtx,
  input: string,
  projectId: any
): Promise<Resolved> {
  const stories = await ctx.db
    .query("userStories")
    .withIndex("by_project", (q: any) => q.eq("projectId", projectId))
    .collect();
  if (!stories.length) return { ok: false, error: "That project has no user stories yet." };
  const match = findFuzzy(
    input,
    stories.map((s: any) => ({ value: s._id, label: s.title }))
  );
  if (!match) {
    return {
      ok: false,
      error: `No story matches "${input}". Stories: ${stories.map((s: any) => s.title).join(", ")}`,
    };
  }
  const story = stories.find((s: any) => s._id === match.item.value);
  return { ok: true, id: story._id, name: story.title, note: corrected(input, match) };
}

async function resolveRisk(
  ctx: DbCtx,
  input: string,
  projectId?: any
): Promise<Resolved> {
  let risks = await ctx.db.query("risks").collect();
  if (projectId) risks = risks.filter((r: any) => r.projectId === projectId);
  if (!risks.length) return { ok: false, error: "There are no risks recorded." };
  const match = findFuzzy(
    input,
    risks.map((r: any) => ({ value: r._id, label: r.title }))
  );
  if (!match) {
    return {
      ok: false,
      error: `No risk matches "${input}". Risks: ${risks.map((r: any) => r.title).join(", ")}`,
    };
  }
  const risk = risks.find((r: any) => r._id === match.item.value);
  return { ok: true, id: risk._id, name: risk.title, note: corrected(input, match) };
}

function toMillis(value: unknown): number | undefined {
  const iso = parseDateInput(value);
  return iso ? Date.parse(iso) : undefined;
}

async function requireActor(ctx: DbCtx): Promise<any> {
  const userId = await getAuthUserId(ctx as any);
  if (!userId) throw new Error("Not authenticated");
  return userId;
}

async function logActivity(
  ctx: DbCtx,
  actorId: any,
  projectId: any,
  action: string,
  entityType: string,
  entityName?: string
) {
  await ctx.db.insert("activityLogs", {
    userId: actorId,
    projectId,
    action,
    entityType,
    entityName,
    createdAt: Date.now(),
  });
}

const PROJECT_STATUS = ["active", "completed", "on-hold", "planning"] as const;
const PRIORITY = ["low", "medium", "high", "critical"] as const;
const TASK_STATUS = ["todo", "in-progress", "review", "done"] as const;
const TASK_TYPE = ["task", "bug", "subtask"] as const;
const SPRINT_STATUS = ["planning", "active", "completed", "cancelled"] as const;
const RISK_STATUS = ["open", "mitigated", "closed", "accepted"] as const;

function countBy<T>(items: T[], key: (item: T) => string): Record<string, number> {
  const out: Record<string, number> = {};
  for (const item of items) {
    const k = key(item);
    out[k] = (out[k] ?? 0) + 1;
  }
  return out;
}

function points(items: { storyPoints?: number }[]): number {
  return items.reduce((sum, i) => sum + (i.storyPoints ?? 0), 0);
}

/* ═══════════════════════════════════════════════════════════════
   READ TOOLS
   ═══════════════════════════════════════════════════════════════ */

export const listProjects = internalQuery({
  args: {},
  handler: async (ctx) => {
    const projects = await ctx.db.query("projects").collect();
    return await Promise.all(
      projects.map(async (p: any) => {
        const members = await ctx.db
          .query("projectMembers")
          .withIndex("by_project", (q: any) => q.eq("projectId", p._id))
          .collect();
        const names = await Promise.all(
          members.map(async (m: any) => {
            const u = await getDoc(ctx,m.userId);
            return u?.name ?? u?.email ?? "Unknown";
          })
        );
        const tasks = await ctx.db
          .query("tasks")
          .withIndex("by_project", (q: any) => q.eq("projectId", p._id))
          .collect();
        const done = tasks.filter((t: any) => t.status === "done").length;
        return {
          id: p._id,
          name: p.name,
          status: p.status,
          priority: p.priority,
          startDate: p.startDate ? new Date(p.startDate).toISOString().slice(0, 10) : null,
          endDate: p.endDate ?? null,
          description: p.description ?? null,
          members: names,
          tasks: tasks.length,
          completedTasks: done,
          progressPercent: tasks.length ? Math.round((done / tasks.length) * 100) : 0,
        };
      })
    );
  },
});

/** Whole-workspace dashboard snapshot: status rollups, per-project health, risks, workload. */
export const workspaceDashboard = internalQuery({
  args: {},
  handler: async (ctx) => {
    const [projects, tasks, stories, risks, users, sprints, members] = await Promise.all([
      ctx.db.query("projects").collect(),
      ctx.db.query("tasks").collect(),
      ctx.db.query("userStories").collect(),
      ctx.db.query("risks").collect(),
      ctx.db.query("users").collect(),
      ctx.db.query("sprints").collect(),
      ctx.db.query("projectMembers").collect(),
    ]);
    const now = Date.now();
    const openTasks = tasks.filter((t: any) => t.status !== "done");
    const doneTasks = tasks.filter((t: any) => t.status === "done");
    const overdue = openTasks.filter((t: any) => t.dueDate && t.dueDate < now);
    const unassigned = openTasks.filter((t: any) => !t.assigneeId);

    const projectRollup = await Promise.all(
      projects.map(async (p: any) => {
        const pTasks = tasks.filter((t: any) => t.projectId === p._id);
        const pOpen = pTasks.filter((t: any) => t.status !== "done");
        const pDone = pTasks.filter((t: any) => t.status === "done");
        const pMembers = members.filter((m: any) => m.projectId === p._id);
        const pRisks = risks.filter((r: any) => r.projectId === p._id);
        const activeSprint = sprints.find(
          (s: any) => s.projectId === p._id && s.status === "active"
        );
        const highRisk = pRisks.filter(
          (r: any) => r.status === "open" && (r.severity === "high" || r.severity === "critical")
        );
        return {
          name: p.name,
          status: p.status,
          priority: p.priority,
          endDate: p.endDate ?? null,
          memberCount: pMembers.length,
          totalTasks: pTasks.length,
          openTasks: pOpen.length,
          progressPercent: pTasks.length
            ? Math.round((pDone.length / pTasks.length) * 100)
            : 0,
          storyPointsTotal: points(pTasks),
          storyPointsDone: points(pDone),
          openBugs: pOpen.filter((t: any) => t.type === "bug").length,
          openRisks: pRisks.filter((r: any) => r.status === "open").length,
          criticalRisks: highRisk.map((r: any) => r.title),
          activeSprint: activeSprint?.name ?? null,
          isLate: !!(p.endDate && p.status === "active" && p.endDate < isoToday(now)),
        };
      })
    );

    const workload = await Promise.all(
      users.map(async (u: any) => {
        const assigned = tasks.filter((t: any) => t.assigneeId === u._id);
        const completed = assigned.filter((t: any) => t.status === "done");
        return {
          name: u.name ?? u.email ?? "Unknown",
          jobTitle: u.jobTitle ?? null,
          openTasks: assigned.length - completed.length,
          openPoints: points(assigned.filter((t: any) => t.status !== "done")),
          completedTasks: completed.length,
          completedPoints: points(completed),
        };
      })
    );

    return {
      generatedAt: new Date(now).toISOString().slice(0, 10),
      totals: {
        projects: projects.length,
        teamMembers: users.length,
        tasks: tasks.length,
        openTasks: openTasks.length,
        doneTasks: doneTasks.length,
        overdueTasks: overdue.length,
        unassignedOpenTasks: unassigned.length,
        openBugs: openTasks.filter((t: any) => t.type === "bug").length,
        inReview: tasks.filter((t: any) => t.status === "review").length,
        stories: stories.length,
        openStories: stories.filter((s: any) => s.status !== "done").length,
        storyPointsTotal: points(tasks),
        storyPointsDone: points(doneTasks),
        openRisks: risks.filter((r: any) => r.status === "open").length,
        criticalRisks: risks.filter(
          (r: any) => r.status === "open" && r.severity === "critical"
        ).length,
        activeSprints: sprints.filter((s: any) => s.status === "active").map((s: any) => s.name),
      },
      projectsByStatus: countBy(projects as any[], (p: any) => p.status),
      tasksByStatus: countBy(tasks as any[], (t: any) => t.status),
      tasksByType: countBy(tasks as any[], (t: any) => t.type),
      projectRollup,
      topRisks: risks
        .filter((r: any) => r.status === "open")
        .sort((a: any, b: any) => (b.score ?? 0) - (a.score ?? 0))
        .slice(0, 5)
        .map((r: any) => ({
          title: r.title,
          severity: r.severity,
          score: r.score,
          probability: r.probability,
          impact: r.impact,
          mitigation: r.mitigationStrategy ?? null,
        })),
      overdueTasks: overdue
        .sort((a: any, b: any) => a.dueDate - b.dueDate)
        .slice(0, 8)
        .map((t: any) => ({
          title: t.title,
          status: t.status,
          priority: t.priority,
          dueDate: new Date(t.dueDate).toISOString().slice(0, 10),
          overdueDays: Math.round((now - t.dueDate) / 86400000),
        })),
      workload: workload.sort((a, b) => b.openPoints - a.openPoints),
    };
  },
});

function isoToday(now: number): string {
  return new Date(now).toISOString().slice(0, 10);
}

/** Everything known about one project: members, board, backlog, sprints, risks, activity. */
export const projectReport = internalQuery({
  args: { project: v.optional(v.string()) },
  handler: async (ctx, args) => {
    const resolved = await resolveProject(ctx, args.project);
    if (!resolved.ok) return { error: resolved.error };
    const project = await getDoc(ctx,resolved.id);
    if (!project) return { error: "Project not found" };

    const [members, tasks, epics, stories, sprints, risks, activity] = await Promise.all([
      ctx.db.query("projectMembers").withIndex("by_project", (q: any) => q.eq("projectId", resolved.id)).collect(),
      ctx.db.query("tasks").withIndex("by_project", (q: any) => q.eq("projectId", resolved.id)).collect(),
      ctx.db.query("epics").withIndex("by_project", (q: any) => q.eq("projectId", resolved.id)).collect(),
      ctx.db.query("userStories").withIndex("by_project", (q: any) => q.eq("projectId", resolved.id)).collect(),
      ctx.db.query("sprints").withIndex("by_project", (q: any) => q.eq("projectId", resolved.id)).collect(),
      ctx.db.query("risks").withIndex("by_project", (q: any) => q.eq("projectId", resolved.id)).collect(),
      ctx.db.query("activityLogs").withIndex("by_project", (q: any) => q.eq("projectId", resolved.id)).collect(),
    ]);

    const now = Date.now();
    const open = tasks.filter((t: any) => t.status !== "done");
    const done = tasks.filter((t: any) => t.status === "done");
    const memberNames = await Promise.all(
      members.map(async (m: any) => {
        const u = await getDoc(ctx,m.userId);
        const assigned = tasks.filter((t: any) => t.assigneeId === m.userId);
        const completed = assigned.filter((t: any) => t.status === "done");
        return {
          name: u?.name ?? u?.email ?? "Unknown",
          role: m.role ?? "member",
          openTasks: assigned.length - completed.length,
          completedTasks: completed.length,
          completedPoints: points(completed),
        };
      })
    );

    const taskRows = tasks.map((t: any) => ({
      title: t.title,
      type: t.type,
      status: t.status,
      priority: t.priority,
      points: t.storyPoints ?? 0,
      dueDate: t.dueDate ? isoToday(t.dueDate) : null,
      assignee: undefined as string | undefined,
      sprintId: t.sprintId ?? null,
    }));

    const assigneeNames = new Map<string, string>();
    for (const t of tasks as any[]) {
      if (!t.assigneeId) continue;
      if (assigneeNames.has(t.assigneeId)) continue;
      const u = await getDoc(ctx,t.assigneeId);
      assigneeNames.set(t.assigneeId, u?.name ?? u?.email ?? "Unknown");
    }
    for (const row of taskRows) {
      const task = (tasks as any[]).find((t: any) => t.title === row.title);
      if (task?.assigneeId) row.assignee = assigneeNames.get(task.assigneeId);
    }

    return {
      matchedProject: resolved.name,
      note: resolved.note,
      project: {
        name: project.name,
        description: project.description ?? null,
        status: project.status,
        priority: project.priority,
        startDate: project.startDate ? isoToday(project.startDate) : null,
        endDate: project.endDate ?? null,
        isLate: !!(project.endDate && project.status === "active" && project.endDate < isoToday(now)),
      },
      health: {
        totalTasks: tasks.length,
        openTasks: open.length,
        doneTasks: done.length,
        progressPercent: tasks.length ? Math.round((done.length / tasks.length) * 100) : 0,
        tasksByStatus: countBy(tasks as any[], (t: any) => t.status),
        tasksByType: countBy(tasks as any[], (t: any) => t.type),
        openBugs: open.filter((t: any) => t.type === "bug").length,
        inReview: tasks.filter((t: any) => t.status === "review").length,
        overdueTasks: open.filter((t: any) => t.dueDate && t.dueDate < now).length,
        unassignedOpenTasks: open.filter((t: any) => !t.assigneeId).length,
        storyPointsTotal: points(tasks),
        storyPointsDone: points(done),
        storyPointsRemaining: points(open),
      },
      members: memberNames,
      tasks: taskRows.sort((a, b) => a.status.localeCompare(b.status)),
      epics: (epics as any[]).map((e) => ({
        title: e.title,
        status: e.status,
        priority: e.priority,
      })),
      userStories: (stories as any[]).map((s) => ({
        title: s.title,
        status: s.status,
        priority: s.priority,
        points: s.storyPoints ?? 0,
      })),
      sprints: (sprints as any[]).map((s) => ({
        name: s.name,
        status: s.status,
        goal: s.goal ?? null,
        capacity: s.capacity ?? null,
        startDate: isoToday(s.startDate),
        endDate: isoToday(s.endDate),
        tasks: tasks.filter((t: any) => t.sprintId === s._id).length,
      })),
      risks: (risks as any[]).map((r) => ({
        title: r.title,
        severity: r.severity,
        status: r.status,
        score: r.score,
        mitigation: r.mitigationStrategy ?? null,
      })),
      recentActivity: (activity as any[])
        .sort((a, b) => b.createdAt - a.createdAt)
        .slice(0, 10)
        .map((a) => ({ action: a.action, when: describeRelative(a.createdAt, now) })),
    };
  },
});

export const listTeam = internalQuery({
  args: {},
  handler: async (ctx) => {
    const users = await ctx.db.query("users").collect();
    const now = Date.now();
    return await Promise.all(
      users.map(async (u: any) => {
        const assigned = await ctx.db
          .query("tasks")
          .withIndex("by_assignee", (q: any) => q.eq("assigneeId", u._id))
          .collect();
        const completed = assigned.filter((t: any) => t.status === "done");
        const open = assigned.filter((t: any) => t.status !== "done");
        return {
          id: u._id,
          name: u.name ?? u.email ?? "Unknown",
          email: u.email ?? null,
          jobTitle: u.jobTitle ?? null,
          department: u.department ?? null,
          isAnonymous: !!u.isAnonymous,
          completedTasks: completed.length,
          completedPoints: points(completed),
          openTasks: open.length,
          openPoints: points(open),
          overdueTasks: open.filter((t: any) => t.dueDate && t.dueDate < now).length,
          completionRate:
            assigned.length === 0 ? 0 : Math.round((completed.length / assigned.length) * 100),
        };
      })
    );
  },
});

/** Ranked "who is doing well" answer, with the ranking basis made explicit. */
export const topPerformers = internalQuery({
  args: {
    metric: v.optional(v.string()),
    limit: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const users = await ctx.db.query("users").collect();
    const tasks = await ctx.db.query("tasks").collect();
    const metric = normEnum(args.metric, ["points", "tasks", "completion", "workload"], "points");
    const limit = Math.min(Math.max(args.limit ?? 5, 1), 25);
    const rows = users.map((u: any) => {
      const assigned = tasks.filter((t: any) => t.assigneeId === u._id);
      const completed = assigned.filter((t: any) => t.status === "done");
      const open = assigned.filter((t: any) => t.status !== "done");
      return {
        id: u._id,
        name: u.name ?? u.email ?? "Unknown",
        jobTitle: u.jobTitle ?? null,
        department: u.department ?? null,
        completedTasks: completed.length,
        completedPoints: points(completed),
        openTasks: open.length,
        openPoints: points(open),
        completionRate: assigned.length ? Math.round((completed.length / assigned.length) * 100) : 0,
      };
    });
    const sorters: Record<string, (a: typeof rows[0], b: typeof rows[0]) => number> = {
      points: (a, b) => b.completedPoints - a.completedPoints || b.completedTasks - a.completedTasks,
      tasks: (a, b) => b.completedTasks - a.completedTasks || b.completedPoints - a.completedPoints,
      completion: (a, b) => b.completionRate - a.completionRate,
      workload: (a, b) => b.openPoints - a.openPoints,
    };
    return {
      metric,
      rankedBy:
        metric === "points"
          ? "completed story points, then completed tasks"
          : metric === "tasks"
            ? "completed tasks"
            : metric === "completion"
              ? "completion rate"
              : "open story points (heaviest load first)",
      ranking: rows.sort(sorters[metric]).slice(0, limit),
      everyone: rows,
    };
  },
});

export const memberReport = internalQuery({
  args: { user: v.optional(v.string()) },
  handler: async (ctx, args) => {
    const resolved = await resolveUser(ctx, args.user);
    if (!resolved.ok) return { error: resolved.error };
    const user = await getDoc(ctx,resolved.id);
    const tasks = await ctx.db
      .query("tasks")
      .withIndex("by_assignee", (q: any) => q.eq("assigneeId", resolved.id))
      .collect();
    const time = await ctx.db
      .query("timeEntries")
      .withIndex("by_user", (q: any) => q.eq("userId", resolved.id))
      .collect();
    const projectIds = [...new Set((tasks as any[]).map((t) => t.projectId))] as any[];
    const projectNames = await Promise.all(
      projectIds.map(async (id) => (await getDoc(ctx,id))?.name ?? "Unknown")
    );
    const completed = tasks.filter((t: any) => t.status === "done");
    const open = tasks.filter((t: any) => t.status !== "done");
    const now = Date.now();
    const projects = await ctx.db
      .query("projectMembers")
      .withIndex("by_user", (q: any) => q.eq("userId", resolved.id))
      .collect();
    const memberships = await Promise.all(
      projects.map(async (m: any) => (await getDoc(ctx,m.projectId))?.name ?? "Unknown")
    );

    return {
      matchedUser: resolved.name,
      note: resolved.note,
      profile: {
        name: user?.name ?? resolved.name,
        email: user?.email ?? null,
        jobTitle: user?.jobTitle ?? null,
        department: user?.department ?? null,
        projects: memberships,
      },
      performance: {
        assignedTasks: tasks.length,
        completedTasks: completed.length,
        openTasks: open.length,
        completionRate: tasks.length ? Math.round((completed.length / tasks.length) * 100) : 0,
        completedPoints: points(completed),
        openPoints: points(open),
        overdueTasks: open.filter((t: any) => t.dueDate && t.dueDate < now).length,
        tasksByStatus: countBy(tasks as any[], (t: any) => t.status),
        minutesLogged: (time as any[]).reduce((s, e) => s + (e.minutes ?? 0), 0),
      },
      currentWork: open.map((t: any) => ({
        title: t.title,
        status: t.status,
        priority: t.priority,
        type: t.type,
        points: t.storyPoints ?? 0,
        project: projectNames[projectIds.indexOf(t.projectId)] ?? "Unknown",
        dueDate: t.dueDate ? isoToday(t.dueDate) : null,
      })),
      recentCompleted: completed
        .sort((a: any, b: any) => b.updatedAt - a.updatedAt)
        .slice(0, 8)
        .map((t: any) => t.title),
    };
  },
});

export const sprintReport = internalQuery({
  args: {
    sprint: v.optional(v.string()),
    project: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    let projectId: any;
    if (args.project) {
      const p = await resolveProject(ctx, args.project);
      if (!p.ok) return { error: p.error };
      projectId = p.id;
    }
    const sprint = await resolveSprint(ctx, args.sprint, projectId);
    if (!sprint.ok) return { error: sprint.error };
    const record = await getDoc(ctx,sprint.id);
    const tasks = await ctx.db
      .query("tasks")
      .withIndex("by_sprint", (q: any) => q.eq("sprintId", sprint.id))
      .collect();
    const stories = await ctx.db
      .query("userStories")
      .withIndex("by_sprint", (q: any) => q.eq("sprintId", sprint.id))
      .collect();
    const project = await getDoc(ctx,record.projectId);
    const now = Date.now();
    const done = tasks.filter((t: any) => t.status === "done");

    const allTasks = await ctx.db
      .query("tasks")
      .withIndex("by_project", (q: any) => q.eq("projectId", record.projectId))
      .collect();
    const history = (
      await ctx.db
        .query("sprints")
        .withIndex("by_project", (q: any) => q.eq("projectId", record.projectId))
        .collect()
    )
      .filter((s: any) => s.status === "completed" && s._id !== sprint.id)
      .slice(-6)
      .map((s: any) => ({
        name: s.name,
        completedPoints: points(
          allTasks.filter((t: any) => t.sprintId === s._id && t.status === "done")
        ),
      }));
    const velocities = history.map((h) => h.completedPoints);
    const averageVelocity = velocities.length
      ? Number((velocities.reduce((a, b) => a + b, 0) / velocities.length).toFixed(1))
      : null;

    return {
      matchedSprint: sprint.name,
      note: sprint.note,
      sprint: {
        name: record.name,
        goal: record.goal ?? null,
        status: record.status,
        project: project?.name ?? "Unknown",
        startDate: isoToday(record.startDate),
        endDate: isoToday(record.endDate),
        daysRemaining: Math.round((record.endDate - now) / 86400000),
        capacity: record.capacity ?? null,
        isOverdue: record.endDate < now && record.status === "active",
      },
      burndown: {
        totalTasks: tasks.length,
        doneTasks: done.length,
        remainingTasks: tasks.length - done.length,
        completionPercent: tasks.length ? Math.round((done.length / tasks.length) * 100) : 0,
        totalPoints: points(tasks),
        completedPoints: points(done),
        remainingPoints: points(tasks.filter((t: any) => t.status !== "done")),
        capacity: record.capacity ?? null,
        pointsBurnRatePerDay:
          record.endDate > now && now > record.startDate
            ? Number((points(done) / Math.max(1, Math.round((now - record.startDate) / 86400000))).toFixed(2))
            : null,
        atRisk:
          record.endDate > now && points(done) < (record.capacity ?? 0) * 0.4 ? true : false,
      },
      tasksByStatus: countBy(tasks as any[], (t: any) => t.status),
      tasksByType: countBy(tasks as any[], (t: any) => t.type),
      tasks: (tasks as any[]).map((t: any) => ({
        title: t.title,
        status: t.status,
        priority: t.priority,
        type: t.type,
        points: t.storyPoints ?? 0,
      })),
      stories: (stories as any[]).map((s: any) => ({
        title: s.title,
        status: s.status,
        points: s.storyPoints ?? 0,
      })),
      velocityTrend: history,
      averageVelocity,
    };
  },
});

export const backlogReport = internalQuery({
  args: { project: v.optional(v.string()) },
  handler: async (ctx, args) => {
    const resolved = await resolveProject(ctx, args.project);
    if (!resolved.ok) return { error: resolved.error };
    const [epics, stories] = await Promise.all([
      ctx.db.query("epics").withIndex("by_project", (q: any) => q.eq("projectId", resolved.id)).collect(),
      ctx.db.query("userStories").withIndex("by_project", (q: any) => q.eq("projectId", resolved.id)).collect(),
    ]);
    return {
      matchedProject: resolved.name,
      note: resolved.note,
      epics: (epics as any[]).map((e) => ({
        title: e.title,
        status: e.status,
        priority: e.priority,
        description: e.description ?? null,
        stories: (stories as any[]).filter((s) => s.epicId === e._id).length,
      })),
      stories: (stories as any[]).map((s) => ({
        title: s.title,
        status: s.status,
        priority: s.priority,
        points: s.storyPoints ?? 0,
        epic: (epics as any[]).find((e) => e._id === s.epicId)?.title ?? null,
        sprintId: s.sprintId ?? null,
      })),
      totals: {
        epics: epics.length,
        stories: stories.length,
        unsized: (stories as any[]).filter((s) => !s.storyPoints).length,
        points: points(stories as any[]),
        byStatus: countBy(stories as any[], (s) => s.status),
      },
    };
  },
});

export const taskDetail = internalQuery({
  args: {
    title: v.optional(v.string()),
    project: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    let projectId: any;
    if (args.project) {
      const p = await resolveProject(ctx, args.project);
      if (!p.ok) return { error: p.error };
      projectId = p.id;
    }
    const resolved = await resolveTask(ctx, args.title, projectId);
    if (!resolved.ok) return { error: resolved.error };
    const task = await getDoc(ctx,resolved.id);
    const [comments, time, assignee, project] = await Promise.all([
      ctx.db.query("comments").withIndex("by_task", (q: any) => q.eq("taskId", resolved.id)).collect(),
      ctx.db.query("timeEntries").withIndex("by_task", (q: any) => q.eq("taskId", resolved.id)).collect(),
      task.assigneeId ? getDoc(ctx,task.assigneeId) : Promise.resolve(null),
      getDoc(ctx,task.projectId),
    ]);
    const commentRows = await Promise.all(
      (comments as any[]).map(async (c) => {
        const u = await getDoc(ctx,c.userId);
        return { author: u?.name ?? u?.email ?? "Unknown", content: c.content, when: describeRelative(c.createdAt) };
      })
    );
    return {
      matchedTask: resolved.name,
      note: resolved.note,
      task: {
        title: task.title,
        description: task.description ?? null,
        type: task.type,
        status: task.status,
        priority: task.priority,
        storyPoints: task.storyPoints ?? null,
        assignee: assignee?.name ?? assignee?.email ?? null,
        project: project?.name ?? "Unknown",
        dueDate: task.dueDate ? isoToday(task.dueDate) : null,
        labels: task.labels ?? [],
        createdAt: isoToday(task.createdAt),
        updatedAt: isoToday(task.updatedAt),
      },
      comments: commentRows,
      timeLogged: {
        minutes: (time as any[]).reduce((s, e) => s + (e.minutes ?? 0), 0),
        entries: (time as any[]).map((e) => ({
          minutes: e.minutes,
          description: e.description ?? null,
          date: isoToday(e.date),
        })),
      },
    };
  },
});

export const listRisks = internalQuery({
  args: {
    project: v.optional(v.string()),
    severity: v.optional(v.string()),
    status: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    let projectId: any;
    if (args.project) {
      const p = await resolveProject(ctx, args.project);
      if (!p.ok) return { error: p.error };
      projectId = p.id;
    }
    let risks = await ctx.db.query("risks").collect();
    if (projectId) risks = risks.filter((r: any) => r.projectId === projectId);
    if (args.status) {
      const status = normEnum(args.status, RISK_STATUS, "open");
      risks = risks.filter((r: any) => r.status === status);
    }
    if (args.severity) {
      const severity = normEnum(args.severity, PRIORITY, "medium");
      risks = risks.filter((r: any) => r.severity === severity);
    }
    const rows = await Promise.all(
      (risks as any[]).map(async (r) => {
        const [owner, project] = await Promise.all([
          r.ownerId ? getDoc(ctx,r.ownerId) : Promise.resolve(null),
          getDoc(ctx,r.projectId),
        ]);
        return {
          title: r.title,
          description: r.description ?? null,
          severity: r.severity,
          status: r.status,
          score: r.score,
          probability: r.probability,
          impact: r.impact,
          owner: owner?.name ?? owner?.email ?? null,
          project: project?.name ?? "Unknown",
          mitigation: r.mitigationStrategy ?? null,
        };
      })
    );
    return {
      count: rows.length,
      bySeverity: countBy(rows, (r) => r.severity),
      byStatus: countBy(rows, (r) => r.status),
      risks: rows.sort((a, b) => b.score - a.score),
    };
  },
});

export const activityFeed = internalQuery({
  args: {
    project: v.optional(v.string()),
    limit: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    let projectId: any;
    if (args.project) {
      const p = await resolveProject(ctx, args.project);
      if (!p.ok) return { error: p.error };
      projectId = p.id;
    }
    let logs = await ctx.db.query("activityLogs").collect();
    if (projectId) logs = logs.filter((l: any) => l.projectId === projectId);
    const limit = Math.min(Math.max(args.limit ?? 15, 1), 50);
    const now = Date.now();
    return await Promise.all(
      (logs as any[])
        .sort((a, b) => b.createdAt - a.createdAt)
        .slice(0, limit)
        .map(async (l) => {
          const [user, project] = await Promise.all([
            getDoc(ctx,l.userId),
            l.projectId ? getDoc(ctx,l.projectId) : Promise.resolve(null),
          ]);
          return {
            who: user?.name ?? user?.email ?? "Unknown",
            action: l.action,
            project: project?.name ?? null,
            entityType: l.entityType,
            when: describeRelative(l.createdAt, now),
          };
        })
    );
  },
});

export const listTimeEntries = internalQuery({
  args: {
    project: v.optional(v.string()),
    user: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    let entries = await ctx.db.query("timeEntries").collect();
    if (args.project) {
      const p = await resolveProject(ctx, args.project);
      if (!p.ok) return { error: p.error };
      entries = entries.filter((e: any) => e.projectId === p.id);
    }
    if (args.user) {
      const u = await resolveUser(ctx, args.user);
      if (!u.ok) return { error: u.error };
      entries = entries.filter((e: any) => e.userId === u.id);
    }
    const rows = await Promise.all(
      (entries as any[]).map(async (e) => {
        const [user, task] = await Promise.all([getDoc(ctx,e.userId), getDoc(ctx,e.taskId)]);
        return {
          who: user?.name ?? user?.email ?? "Unknown",
          task: task?.title ?? "Unknown",
          minutes: e.minutes,
          hours: Number((e.minutes / 60).toFixed(2)),
          description: e.description ?? null,
          date: isoToday(e.date),
        };
      })
    );
    const totalMinutes = rows.reduce((s, r) => s + r.minutes, 0);
    const byPerson: Record<string, number> = {};
    for (const r of rows) byPerson[r.who] = (byPerson[r.who] ?? 0) + r.minutes;
    return {
      count: rows.length,
      totalMinutes,
      totalHours: Number((totalMinutes / 60).toFixed(2)),
      byPerson,
      entries: rows.sort((a, b) => b.date.localeCompare(a.date)).slice(0, 25),
    };
  },
});

export const listRetrospectives = internalQuery({
  args: { project: v.optional(v.string()) },
  handler: async (ctx, args) => {
    let projectId: any;
    if (args.project) {
      const p = await resolveProject(ctx, args.project);
      if (!p.ok) return { error: p.error };
      projectId = p.id;
    }
    let retros = await ctx.db.query("retrospectives").collect();
    if (projectId) retros = retros.filter((r: any) => r.projectId === projectId);
    return await Promise.all(
      (retros as any[])
        .sort((a, b) => b.createdAt - a.createdAt)
        .slice(0, 10)
        .map(async (r) => {
          const sprint = await getDoc(ctx,r.sprintId);
          return {
            sprint: sprint?.name ?? "Unknown",
            wentWell: r.wentWell ?? [],
            toImprove: r.toImprove ?? [],
            actionItems: r.actionItems ?? [],
            createdAt: isoToday(r.createdAt),
          };
        })
    );
  },
});

export const listNotifications = internalQuery({
  args: { user: v.optional(v.string()) },
  handler: async (ctx, args) => {
    if (args.user) {
      const u = await resolveUser(ctx, args.user);
      if (!u.ok) return { error: u.error };
      const notes = await ctx.db
        .query("notifications")
        .withIndex("by_user", (q: any) => q.eq("userId", u.id))
        .collect();
      return notes.map((n: any) => ({
        title: n.title,
        message: n.message,
        type: n.type,
        isRead: n.isRead,
        when: describeRelative(n.createdAt),
      }));
    }
    const actor = await requireActor(ctx);
    const notes = await ctx.db
      .query("notifications")
      .withIndex("by_user", (q: any) => q.eq("userId", actor))
      .collect();
    return notes.map((n: any) => ({
      title: n.title,
      message: n.message,
      type: n.type,
      isRead: n.isRead,
      when: describeRelative(n.createdAt),
    }));
  },
});

/* ═══════════════════════════════════════════════════════════════
   WRITE TOOLS
   ═══════════════════════════════════════════════════════════════ */

export const createProject = internalMutation({
  args: {
    name: v.string(),
    description: v.optional(v.string()),
    status: v.optional(v.string()),
    priority: v.optional(v.string()),
    startDate: v.optional(v.string()),
    endDate: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const userId = await requireActor(ctx);
    const now = Date.now();
    const existing = await ctx.db.query("projects").collect();
    const dupe = findFuzzy(args.name, existing.map((p: any) => ({ value: p._id, label: p.name })));
    if (dupe && dupe.score > 0.9) {
      return {
        ok: true,
        duplicate: true,
        projectId: dupe.item.value,
        message: `A project called "${dupe.label}" already exists, so I did not create a duplicate.`,
      };
    }
    const status = normEnum(args.status ?? "planning", PROJECT_STATUS, "planning");
    const priority = normEnum(args.priority ?? "medium", PRIORITY, "medium");
    const start = toMillis(args.startDate);
    const projectId = await ctx.db.insert("projects", {
      name: args.name.trim(),
      description: args.description,
      status,
      priority,
      startDate: start ?? now,
      endDate: parseDateInput(args.endDate),
      ownerId: userId,
      createdAt: now,
      updatedAt: now,
    });
    await ctx.db.insert("projectMembers", {
      projectId,
      userId,
      role: "owner",
      joinedAt: now,
    });
    await logActivity(ctx, userId, projectId, `created project ${args.name} (via AIE Agent)`, "project", args.name);
    return { ok: true, projectId, name: args.name.trim(), status, priority };
  },
});

export const updateProject = internalMutation({
  args: {
    project: v.string(),
    name: v.optional(v.string()),
    description: v.optional(v.string()),
    status: v.optional(v.string()),
    priority: v.optional(v.string()),
    endDate: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const actor = await requireActor(ctx);
    const resolved = await resolveProject(ctx, args.project);
    if (!resolved.ok) return { error: resolved.error };
    const project = await getDoc(ctx,resolved.id);
    if (!project) return { error: "Project not found" };

    const patch: Record<string, unknown> = { updatedAt: Date.now() };
    const changes: string[] = [];
    if (args.name) {
      patch.name = args.name.trim();
      changes.push(`renamed to "${args.name.trim()}"`);
    }
    if (args.description !== undefined) {
      patch.description = args.description;
      changes.push("description updated");
    }
    if (args.status) {
      patch.status = normEnum(args.status, PROJECT_STATUS, project.status);
      changes.push(`status → ${patch.status}`);
    }
    if (args.priority) {
      patch.priority = normEnum(args.priority, PRIORITY, project.priority);
      changes.push(`priority → ${patch.priority}`);
    }
    if (args.endDate !== undefined) {
      patch.endDate = parseDateInput(args.endDate);
      changes.push(`end date → ${patch.endDate ?? "cleared"}`);
    }
    if (changes.length === 0) return { error: "Nothing to update — no fields were provided." };
    await ctx.db.patch(resolved.id, patch);
    await logActivity(ctx, actor, resolved.id, `updated project ${project.name}: ${changes.join(", ")} (via AIE Agent)`, "project", project.name);
    return { ok: true, projectName: project.name, changes, note: resolved.note };
  },
});

export const deleteProject = internalMutation({
  args: {
    project: v.string(),
    confirmed: v.optional(v.boolean()),
  },
  handler: async (ctx, args) => {
    const actor = await requireActor(ctx);
    const resolved = await resolveProject(ctx, args.project);
    if (!resolved.ok) return { error: resolved.error };
    const project = await getDoc(ctx,resolved.id);
    if (!project) return { error: "Project not found" };

    const [tasks, stories, epics, members, risks] = await Promise.all([
      ctx.db.query("tasks").withIndex("by_project", (q: any) => q.eq("projectId", resolved.id)).collect(),
      ctx.db.query("userStories").withIndex("by_project", (q: any) => q.eq("projectId", resolved.id)).collect(),
      ctx.db.query("epics").withIndex("by_project", (q: any) => q.eq("projectId", resolved.id)).collect(),
      ctx.db.query("projectMembers").withIndex("by_project", (q: any) => q.eq("projectId", resolved.id)).collect(),
      ctx.db.query("risks").withIndex("by_project", (q: any) => q.eq("projectId", resolved.id)).collect(),
    ]);

    if (!args.confirmed) {
      return {
        needsConfirmation: true,
        message: `Deleting "${project.name}" is permanent and will also remove ${tasks.length} tasks, ${stories.length} stories, ${epics.length} epics, ${members.length} members and ${risks.length} risks. Ask the user to confirm, then call delete_project again with confirmed: true.`,
      };
    }

    const taskIds = new Set((tasks as any[]).map((t) => t._id));
    for (const entry of await ctx.db.query("timeEntries").collect()) {
      if (taskIds.has(entry.taskId) || entry.projectId === resolved.id) {
        await ctx.db.delete(entry._id);
      }
    }
    for (const t of tasks as any[]) await ctx.db.delete(t._id);
    for (const s of stories as any[]) await ctx.db.delete(s._id);
    for (const e of epics as any[]) await ctx.db.delete(e._id);
    for (const r of risks as any[]) await ctx.db.delete(r._id);
    for (const m of members as any[]) await ctx.db.delete(m._id);
    for (const s of await ctx.db.query("sprints").withIndex("by_project", (q: any) => q.eq("projectId", resolved.id)).collect()) {
      for (const retro of await ctx.db.query("retrospectives").withIndex("by_sprint", (q: any) => q.eq("sprintId", s._id)).collect()) {
        await ctx.db.delete(retro._id);
      }
      await ctx.db.delete(s._id);
    }
    await ctx.db.delete(resolved.id);
    await logActivity(ctx, actor, undefined, `deleted project ${project.name} (via AIE Agent)`, "project", project.name);
    return { ok: true, deleted: project.name, tasksRemoved: tasks.length };
  },
});

export const addMember = internalMutation({
  args: {
    project: v.string(),
    user: v.string(),
    role: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const actor = await requireActor(ctx);
    const project = await resolveProject(ctx, args.project);
    if (!project.ok) return { error: project.error };
    const member = await resolveUser(ctx, args.user);
    if (!member.ok) return { error: member.error };

    const existing = await ctx.db
      .query("projectMembers")
      .withIndex("by_project_user", (q: any) =>
        q.eq("projectId", project.id).eq("userId", member.id)
      )
      .first();
    if (existing) {
      return {
        ok: true,
        skipped: "already a member",
        userName: member.name,
        projectName: project.name,
        note: project.note ?? member.note,
      };
    }
    const tasks = await ctx.db
      .query("tasks")
      .withIndex("by_project", (q: any) => q.eq("projectId", project.id))
      .collect();
    const open = tasks.filter((t: any) => t.status !== "done" && t.assigneeId === member.id).length;
    await ctx.db.insert("projectMembers", {
      projectId: project.id,
      userId: member.id,
      role: args.role?.trim() || "member",
      joinedAt: Date.now(),
    });
    await logActivity(ctx, actor, project.id, `added ${member.name} to project ${project.name} (via AIE Agent)`, "project", project.name);
    return {
      ok: true,
      userName: member.name,
      projectName: project.name,
      role: args.role?.trim() || "member",
      currentOpenTasks: open,
      note: project.note ?? member.note,
    };
  },
});

export const removeMember = internalMutation({
  args: {
    project: v.string(),
    user: v.string(),
    confirmed: v.optional(v.boolean()),
  },
  handler: async (ctx, args) => {
    const actor = await requireActor(ctx);
    const project = await resolveProject(ctx, args.project);
    if (!project.ok) return { error: project.error };
    const member = await resolveUser(ctx, args.user);
    if (!member.ok) return { error: member.error };
    const record = await ctx.db
      .query("projectMembers")
      .withIndex("by_project_user", (q: any) =>
        q.eq("projectId", project.id).eq("userId", member.id)
      )
      .first();
    if (!record) {
      return { error: `${member.name} is not a member of ${project.name}.` };
    }
    if (!args.confirmed) {
      const assigned = await ctx.db
        .query("tasks")
        .withIndex("by_project", (q: any) => q.eq("projectId", project.id))
        .collect();
      const theirs = assigned.filter((t: any) => t.assigneeId === member.id && t.status !== "done");
      return {
        needsConfirmation: true,
        message: `Remove ${member.name} from ${project.name}? They still have ${theirs.length} open tasks which will become unassigned. Ask the user to confirm, then call remove_project_member again with confirmed: true.`,
      };
    }
    await ctx.db.delete(record._id);
    await logActivity(ctx, actor, project.id, `removed ${member.name} from project ${project.name} (via AIE Agent)`, "project", project.name);
    return { ok: true, userName: member.name, projectName: project.name };
  },
});

export const createTask = internalMutation({
  args: {
    project: v.string(),
    title: v.string(),
    description: v.optional(v.string()),
    assignee: v.optional(v.string()),
    type: v.optional(v.string()),
    status: v.optional(v.string()),
    priority: v.optional(v.string()),
    storyPoints: v.optional(v.number()),
    dueDate: v.optional(v.string()),
    labels: v.optional(v.array(v.string())),
    sprint: v.optional(v.string()),
    epic: v.optional(v.string()),
    story: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const actor = await requireActor(ctx);
    const project = await resolveProject(ctx, args.project);
    if (!project.ok) return { error: project.error };
    const now = Date.now();

    let assigneeId: any;
    let assigneeName: string | undefined;
    let assigneeNote: string | undefined;
    if (args.assignee) {
      const a = await resolveUser(ctx, args.assignee);
      if (!a.ok) return { error: a.error };
      assigneeId = a.id;
      assigneeName = a.name;
      assigneeNote = a.note;
    }
    let sprintId: any;
    if (args.sprint) {
      const s = await resolveSprint(ctx, args.sprint, project.id);
      if (!s.ok) return { error: s.error };
      sprintId = s.id;
    }
    let epicId: any;
    if (args.epic) {
      const e = await resolveEpic(ctx, args.epic, project.id);
      if (!e.ok) return { error: e.error };
      epicId = e.id;
    }
    let storyId: any;
    if (args.story) {
      const s = await resolveStory(ctx, args.story, project.id);
      if (!s.ok) return { error: s.error };
      storyId = s.id;
    }

    const tasks = await ctx.db
      .query("tasks")
      .withIndex("by_project", (q: any) => q.eq("projectId", project.id))
      .collect();
    const maxOrder = Math.max(0, ...tasks.map((t: any) => t.order ?? 0));
    const type = normEnum(args.type ?? "task", TASK_TYPE, "task");
    const status = normEnum(args.status ?? "todo", TASK_STATUS, "todo");
    const priority = normEnum(args.priority ?? "medium", PRIORITY, "medium");

    const taskId = await ctx.db.insert("tasks", {
      projectId: project.id,
      storyId,
      epicId,
      title: args.title.trim(),
      description: args.description,
      type,
      status,
      priority,
      storyPoints: args.storyPoints,
      assigneeId,
      sprintId,
      labels: args.labels,
      dueDate: toMillis(args.dueDate),
      order: maxOrder + 1,
      createdAt: now,
      updatedAt: now,
    });

    if (assigneeId) {
      await ctx.db.insert("notifications", {
        userId: assigneeId,
        title: `New task: ${args.title.trim()}`,
        message: `You were assigned "${args.title.trim()}" in ${project.name}.`,
        type: "task",
        isRead: false,
        createdAt: now,
      });
    }
    await logActivity(
      ctx,
      actor,
      project.id,
      `created ${type} ${args.title}${assigneeName ? ` and assigned it to ${assigneeName}` : ""} (via AIE Agent)`,
      "task",
      args.title.trim()
    );
    return {
      ok: true,
      taskId,
      title: args.title.trim(),
      projectName: project.name,
      type,
      status,
      priority,
      assignee: assigneeName,
      dueDate: parseDateInput(args.dueDate),
      note: [project.note, assigneeNote].filter(Boolean).join(" ") || undefined,
    };
  },
});

export const updateTask = internalMutation({
  args: {
    task: v.string(),
    project: v.optional(v.string()),
    title: v.optional(v.string()),
    description: v.optional(v.string()),
    status: v.optional(v.string()),
    priority: v.optional(v.string()),
    type: v.optional(v.string()),
    assignee: v.optional(v.string()),
    storyPoints: v.optional(v.number()),
    dueDate: v.optional(v.string()),
    labels: v.optional(v.array(v.string())),
  },
  handler: async (ctx, args) => {
    const actor = await requireActor(ctx);
    let projectId: any;
    if (args.project) {
      const p = await resolveProject(ctx, args.project);
      if (!p.ok) return { error: p.error };
      projectId = p.id;
    }
    const resolved = await resolveTask(ctx, args.task, projectId);
    if (!resolved.ok) return { error: resolved.error };
    const task = await getDoc(ctx,resolved.id);
    if (!task) return { error: "Task not found" };

    const patch: Record<string, unknown> = { updatedAt: Date.now() };
    const changes: string[] = [];
    if (args.title) {
      patch.title = args.title.trim();
      changes.push(`renamed to "${args.title.trim()}"`);
    }
    if (args.description !== undefined) {
      patch.description = args.description;
      changes.push("description updated");
    }
    if (args.status) {
      patch.status = normEnum(args.status, TASK_STATUS, task.status);
      changes.push(`status → ${patch.status}`);
    }
    if (args.priority) {
      patch.priority = normEnum(args.priority, PRIORITY, task.priority);
      changes.push(`priority → ${patch.priority}`);
    }
    if (args.type) {
      patch.type = normEnum(args.type, TASK_TYPE, task.type);
      changes.push(`type → ${patch.type}`);
    }
    if (args.storyPoints !== undefined) {
      patch.storyPoints = args.storyPoints;
      changes.push(`story points → ${args.storyPoints}`);
    }
    if (args.dueDate !== undefined) {
      patch.dueDate = toMillis(args.dueDate);
      changes.push(`due date → ${parseDateInput(args.dueDate) ?? "cleared"}`);
    }
    if (args.labels) {
      patch.labels = args.labels;
      changes.push(`labels → ${args.labels.join(", ") || "none"}`);
    }
    let assigneeName: string | undefined;
    if (args.assignee) {
      const a = await resolveUser(ctx, args.assignee);
      if (!a.ok) return { error: a.error };
      patch.assigneeId = a.id;
      assigneeName = a.name;
      changes.push(`assigned to ${a.name}`);
      await ctx.db.insert("notifications", {
        userId: a.id,
        title: `Task assigned: ${task.title}`,
        message: `${task.title} in ${(await getDoc(ctx,task.projectId))?.name ?? "a project"} is now yours.`,
        type: "task",
        isRead: false,
        createdAt: Date.now(),
      });
    }
    if (changes.length === 0) return { error: "Nothing to update — no fields were provided." };

    await ctx.db.patch(resolved.id, patch);
    if (patch.status === "done" && task.status !== "done") {
      await ctx.db.insert("notifications", {
        userId: actor,
        title: `Task completed: ${args.title ?? task.title}`,
        message: `"${args.title ?? task.title}" was marked done.`,
        type: "task",
        isRead: false,
        createdAt: Date.now(),
      });
    }
    await logActivity(
      ctx,
      actor,
      task.projectId,
      `updated task ${task.title}: ${changes.join(", ")} (via AIE Agent)`,
      "task",
      task.title
    );
    return {
      ok: true,
      taskTitle: args.title ?? task.title,
      changes,
      assignee: assigneeName,
      note: resolved.note,
    };
  },
});

export const assignTask = internalMutation({
  args: {
    task: v.string(),
    user: v.string(),
    project: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const actor = await requireActor(ctx);
    let projectId: any;
    if (args.project) {
      const p = await resolveProject(ctx, args.project);
      if (!p.ok) return { error: p.error };
      projectId = p.id;
    }
    const task = await resolveTask(ctx, args.task, projectId);
    if (!task.ok) return { error: task.error };
    const user = await resolveUser(ctx, args.user);
    if (!user.ok) return { error: user.error };
    const record = await getDoc(ctx,task.id);
    await ctx.db.patch(task.id, { assigneeId: user.id, updatedAt: Date.now() });
    await ctx.db.insert("notifications", {
      userId: user.id,
      title: `Task assigned: ${record.title}`,
      message: `You are now assigned "${record.title}".`,
      type: "task",
      isRead: false,
      createdAt: Date.now(),
    });
    await logActivity(
      ctx,
      actor,
      record.projectId,
      `assigned ${user.name} to task ${record.title} (via AIE Agent)`,
      "task",
      record.title
    );
    return {
      ok: true,
      userName: user.name,
      taskTitle: record.title,
      note: task.note ?? user.note,
    };
  },
});

export const deleteTask = internalMutation({
  args: {
    task: v.string(),
    project: v.optional(v.string()),
    confirmed: v.optional(v.boolean()),
  },
  handler: async (ctx, args) => {
    const actor = await requireActor(ctx);
    let projectId: any;
    if (args.project) {
      const p = await resolveProject(ctx, args.project);
      if (!p.ok) return { error: p.error };
      projectId = p.id;
    }
    const resolved = await resolveTask(ctx, args.task, projectId);
    if (!resolved.ok) return { error: resolved.error };
    const task = await getDoc(ctx,resolved.id);
    if (!task) return { error: "Task not found" };
    if (!args.confirmed) {
      return {
        needsConfirmation: true,
        message: `Deleting the ${task.type} "${task.title}" is permanent. Ask the user to confirm, then call delete_task again with confirmed: true.`,
      };
    }
    for (const c of await ctx.db.query("comments").withIndex("by_task", (q: any) => q.eq("taskId", task._id)).collect()) {
      await ctx.db.delete(c._id);
    }
    for (const e of await ctx.db.query("timeEntries").withIndex("by_task", (q: any) => q.eq("taskId", task._id)).collect()) {
      await ctx.db.delete(e._id);
    }
    await ctx.db.delete(task._id);
    await logActivity(ctx, actor, task.projectId, `deleted task ${task.title} (via AIE Agent)`, "task", task.title);
    return { ok: true, deleted: task.title };
  },
});

export const moveTaskToSprint = internalMutation({
  args: {
    task: v.string(),
    sprint: v.string(),
    project: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const actor = await requireActor(ctx);
    let projectId: any;
    if (args.project) {
      const p = await resolveProject(ctx, args.project);
      if (!p.ok) return { error: p.error };
      projectId = p.id;
    }
    const task = await resolveTask(ctx, args.task, projectId);
    if (!task.ok) return { error: task.error };
    const sprint = await resolveSprint(ctx, args.sprint, projectId);
    if (!sprint.ok) return { error: sprint.error };
    const record = await getDoc(ctx,task.id);
    await ctx.db.patch(task.id, { sprintId: sprint.id, updatedAt: Date.now() });
    await logActivity(
      ctx,
      actor,
      record.projectId,
      `moved ${record.title} to sprint ${sprint.name} (via AIE Agent)`,
      "task",
      record.title
    );
    return { ok: true, taskTitle: record.title, sprintName: sprint.name, note: task.note ?? sprint.note };
  },
});

export const createSprint = internalMutation({
  args: {
    project: v.string(),
    name: v.string(),
    goal: v.optional(v.string()),
    startDate: v.optional(v.string()),
    endDate: v.optional(v.string()),
    capacity: v.optional(v.number()),
    status: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const actor = await requireActor(ctx);
    const project = await resolveProject(ctx, args.project);
    if (!project.ok) return { error: project.error };
    const now = Date.now();
    const start = toMillis(args.startDate) ?? now;
    const end = toMillis(args.endDate) ?? start + 14 * 86400000;
    const status = normEnum(args.status ?? "planning", SPRINT_STATUS, "planning");
    const sprintId = await ctx.db.insert("sprints", {
      projectId: project.id,
      name: args.name.trim(),
      goal: args.goal,
      status,
      startDate: start,
      endDate: end,
      capacity: args.capacity,
      createdAt: now,
      updatedAt: now,
    });
    await logActivity(ctx, actor, project.id, `created sprint ${args.name} (via AIE Agent)`, "sprint", args.name);
    return {
      ok: true,
      sprintId,
      name: args.name.trim(),
      projectName: project.name,
      status,
      note: project.note,
    };
  },
});

export const updateSprint = internalMutation({
  args: {
    sprint: v.string(),
    project: v.optional(v.string()),
    name: v.optional(v.string()),
    goal: v.optional(v.string()),
    status: v.optional(v.string()),
    capacity: v.optional(v.number()),
    endDate: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const actor = await requireActor(ctx);
    let projectId: any;
    if (args.project) {
      const p = await resolveProject(ctx, args.project);
      if (!p.ok) return { error: p.error };
      projectId = p.id;
    }
    const resolved = await resolveSprint(ctx, args.sprint, projectId);
    if (!resolved.ok) return { error: resolved.error };
    const sprint = await getDoc(ctx,resolved.id);
    const patch: Record<string, unknown> = { updatedAt: Date.now() };
    const changes: string[] = [];
    if (args.name) {
      patch.name = args.name.trim();
      changes.push(`renamed to "${args.name.trim()}"`);
    }
    if (args.goal !== undefined) {
      patch.goal = args.goal;
      changes.push("goal updated");
    }
    if (args.capacity !== undefined) {
      patch.capacity = args.capacity;
      changes.push(`capacity → ${args.capacity}`);
    }
    if (args.endDate !== undefined) {
      patch.endDate = toMillis(args.endDate) ?? sprint.endDate;
      changes.push(`end date → ${isoToday(patch.endDate as number)}`);
    }
    if (args.status) {
      const status = normEnum(args.status, SPRINT_STATUS, sprint.status);
      if (status === "active") {
        const existing = await ctx.db
          .query("sprints")
          .withIndex("by_project", (q: any) => q.eq("projectId", sprint.projectId))
          .collect();
        for (const other of existing as any[]) {
          if (other._id !== sprint._id && other.status === "active") {
            await ctx.db.patch(other._id, { status: "completed", updatedAt: Date.now() });
          }
        }
      }
      patch.status = status;
      changes.push(`status → ${status}`);
    }
    if (changes.length === 0) return { error: "Nothing to update — no fields were provided." };
    await ctx.db.patch(resolved.id, patch);
    await logActivity(
      ctx,
      actor,
      sprint.projectId,
      `updated sprint ${sprint.name}: ${changes.join(", ")} (via AIE Agent)`,
      "sprint",
      sprint.name
    );
    return { ok: true, sprintName: sprint.name, changes, note: resolved.note };
  },
});

export const createEpic = internalMutation({
  args: {
    project: v.string(),
    title: v.string(),
    description: v.optional(v.string()),
    status: v.optional(v.string()),
    priority: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const actor = await requireActor(ctx);
    const project = await resolveProject(ctx, args.project);
    if (!project.ok) return { error: project.error };
    const now = Date.now();
    const status = normEnum(args.status ?? "todo", ["todo", "in-progress", "done"] as const, "todo");
    const priority = normEnum(args.priority ?? "medium", PRIORITY, "medium");
    const epicId = await ctx.db.insert("epics", {
      projectId: project.id,
      title: args.title.trim(),
      description: args.description,
      status,
      priority,
      createdAt: now,
      updatedAt: now,
    });
    await logActivity(ctx, actor, project.id, `created epic ${args.title} (via AIE Agent)`, "epic", args.title);
    return { ok: true, epicId, title: args.title.trim(), projectName: project.name, status, priority, note: project.note };
  },
});

export const createUserStory = internalMutation({
  args: {
    project: v.string(),
    title: v.string(),
    description: v.optional(v.string()),
    acceptanceCriteria: v.optional(v.string()),
    storyPoints: v.optional(v.number()),
    priority: v.optional(v.string()),
    status: v.optional(v.string()),
    assignee: v.optional(v.string()),
    epic: v.optional(v.string()),
    sprint: v.optional(v.string()),
    labels: v.optional(v.array(v.string())),
    dueDate: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const actor = await requireActor(ctx);
    const project = await resolveProject(ctx, args.project);
    if (!project.ok) return { error: project.error };
    let epicId: any;
    if (args.epic) {
      const e = await resolveEpic(ctx, args.epic, project.id);
      if (!e.ok) return { error: e.error };
      epicId = e.id;
    }
    let sprintId: any;
    if (args.sprint) {
      const s = await resolveSprint(ctx, args.sprint, project.id);
      if (!s.ok) return { error: s.error };
      sprintId = s.id;
    }
    let assigneeId: any;
    let assigneeName: string | undefined;
    if (args.assignee) {
      const a = await resolveUser(ctx, args.assignee);
      if (!a.ok) return { error: a.error };
      assigneeId = a.id;
      assigneeName = a.name;
    }
    const now = Date.now();
    const status = normEnum(args.status ?? "todo", TASK_STATUS, "todo");
    const priority = normEnum(args.priority ?? "medium", PRIORITY, "medium");
    const storyId = await ctx.db.insert("userStories", {
      projectId: project.id,
      epicId,
      title: args.title.trim(),
      description: args.description,
      acceptanceCriteria: args.acceptanceCriteria,
      storyPoints: args.storyPoints,
      priority,
      status,
      assigneeId,
      sprintId,
      labels: args.labels,
      dueDate: toMillis(args.dueDate),
      createdAt: now,
      updatedAt: now,
    });
    await logActivity(ctx, actor, project.id, `created user story ${args.title} (via AIE Agent)`, "story", args.title);
    return {
      ok: true,
      storyId,
      title: args.title.trim(),
      projectName: project.name,
      status,
      priority,
      storyPoints: args.storyPoints ?? null,
      assignee: assigneeName,
      note: project.note,
    };
  },
});

export const createRisk = internalMutation({
  args: {
    project: v.string(),
    title: v.string(),
    description: v.optional(v.string()),
    probability: v.optional(v.number()),
    impact: v.optional(v.number()),
    severity: v.optional(v.string()),
    owner: v.optional(v.string()),
    mitigation: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const actor = await requireActor(ctx);
    const project = await resolveProject(ctx, args.project);
    if (!project.ok) return { error: project.error };
    let ownerId: any;
    let ownerName: string | undefined;
    if (args.owner) {
      const o = await resolveUser(ctx, args.owner);
      if (!o.ok) return { error: o.error };
      ownerId = o.id;
      ownerName = o.name;
    }
    const clamp = (n: unknown, fallback: number) =>
      Math.min(5, Math.max(1, Math.round(typeof n === "number" ? n : fallback)));
    const probability = clamp(args.probability, 3);
    const impact = clamp(args.impact, 3);
    const score = probability * impact;
    const severity =
      args.severity && PRIORITY.includes(normEnum(args.severity, PRIORITY, "medium") as any)
        ? normEnum(args.severity, PRIORITY, "medium")
        : score >= 16
          ? "critical"
          : score >= 10
            ? "high"
            : score >= 5
              ? "medium"
              : "low";
    const now = Date.now();
    const riskId = await ctx.db.insert("risks", {
      projectId: project.id,
      title: args.title.trim(),
      description: args.description,
      probability,
      impact,
      severity,
      ownerId,
      status: "open",
      mitigationStrategy: args.mitigation,
      score,
      createdAt: now,
      updatedAt: now,
    });
    await logActivity(ctx, actor, project.id, `logged risk ${args.title} (${severity}) (via AIE Agent)`, "risk", args.title);
    return {
      ok: true,
      riskId,
      title: args.title.trim(),
      projectName: project.name,
      severity,
      score,
      owner: ownerName,
      note: project.note,
    };
  },
});

export const updateRisk = internalMutation({
  args: {
    risk: v.string(),
    project: v.optional(v.string()),
    status: v.optional(v.string()),
    severity: v.optional(v.string()),
    probability: v.optional(v.number()),
    impact: v.optional(v.number()),
    mitigation: v.optional(v.string()),
    owner: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const actor = await requireActor(ctx);
    let projectId: any;
    if (args.project) {
      const p = await resolveProject(ctx, args.project);
      if (!p.ok) return { error: p.error };
      projectId = p.id;
    }
    const resolved = await resolveRisk(ctx, args.risk, projectId);
    if (!resolved.ok) return { error: resolved.error };
    const risk = await getDoc(ctx,resolved.id);

    const patch: Record<string, unknown> = { updatedAt: Date.now() };
    const changes: string[] = [];
    if (args.status) {
      patch.status = normEnum(args.status, RISK_STATUS, risk.status);
      changes.push(`status → ${patch.status}`);
    }
    if (args.severity) {
      patch.severity = normEnum(args.severity, PRIORITY, risk.severity);
      changes.push(`severity → ${patch.severity}`);
    }
    if (args.probability !== undefined) {
      patch.probability = Math.min(5, Math.max(1, Math.round(args.probability)));
      changes.push(`probability → ${patch.probability}`);
    }
    if (args.impact !== undefined) {
      patch.impact = Math.min(5, Math.max(1, Math.round(args.impact)));
      changes.push(`impact → ${patch.impact}`);
    }
    if (args.mitigation !== undefined) {
      patch.mitigationStrategy = args.mitigation;
      changes.push("mitigation updated");
    }
    if (args.owner) {
      const o = await resolveUser(ctx, args.owner);
      if (!o.ok) return { error: o.error };
      patch.ownerId = o.id;
      changes.push(`owner → ${o.name}`);
    }
    patch.score =
      ((patch.probability as number) ?? risk.probability) *
      ((patch.impact as number) ?? risk.impact);

    await ctx.db.patch(resolved.id, patch);
    await logActivity(
      ctx,
      actor,
      risk.projectId,
      `updated risk ${risk.title}: ${changes.join(", ")} (via AIE Agent)`,
      "risk",
      risk.title
    );
    return { ok: true, riskTitle: risk.title, changes, note: resolved.note };
  },
});

export const deleteRisk = internalMutation({
  args: {
    risk: v.string(),
    project: v.optional(v.string()),
    confirmed: v.optional(v.boolean()),
  },
  handler: async (ctx, args) => {
    const actor = await requireActor(ctx);
    let projectId: any;
    if (args.project) {
      const p = await resolveProject(ctx, args.project);
      if (!p.ok) return { error: p.error };
      projectId = p.id;
    }
    const resolved = await resolveRisk(ctx, args.risk, projectId);
    if (!resolved.ok) return { error: resolved.error };
    const risk = await getDoc(ctx,resolved.id);
    if (!args.confirmed) {
      return {
        needsConfirmation: true,
        message: `Delete the risk "${risk.title}" (${risk.severity})? Ask the user to confirm, then call delete_risk again with confirmed: true.`,
      };
    }
    await ctx.db.delete(resolved.id);
    await logActivity(ctx, actor, risk.projectId, `deleted risk ${risk.title} (via AIE Agent)`, "risk", risk.title);
    return { ok: true, deleted: risk.title };
  },
});

export const addComment = internalMutation({
  args: {
    task: v.string(),
    content: v.string(),
    project: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const actor = await requireActor(ctx);
    let projectId: any;
    if (args.project) {
      const p = await resolveProject(ctx, args.project);
      if (!p.ok) return { error: p.error };
      projectId = p.id;
    }
    const resolved = await resolveTask(ctx, args.task, projectId);
    if (!resolved.ok) return { error: resolved.error };
    const task = await getDoc(ctx,resolved.id);
    const now = Date.now();
    await ctx.db.insert("comments", {
      taskId: resolved.id,
      userId: actor,
      content: args.content.trim(),
      createdAt: now,
      updatedAt: now,
    });
    await logActivity(
      ctx,
      actor,
      task.projectId,
      `commented on ${task.title}: "${args.content.trim().slice(0, 80)}" (via AIE Agent)`,
      "task",
      task.title
    );
    return { ok: true, taskTitle: task.title, comment: args.content.trim(), note: resolved.note };
  },
});

export const logTime = internalMutation({
  args: {
    task: v.string(),
    minutes: v.number(),
    user: v.optional(v.string()),
    project: v.optional(v.string()),
    description: v.optional(v.string()),
    date: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const actor = await requireActor(ctx);
    let projectId: any;
    if (args.project) {
      const p = await resolveProject(ctx, args.project);
      if (!p.ok) return { error: p.error };
      projectId = p.id;
    }
    const resolved = await resolveTask(ctx, args.task, projectId);
    if (!resolved.ok) return { error: resolved.error };
    let userId = actor;
    let userName = "you";
    if (args.user) {
      const u = await resolveUser(ctx, args.user);
      if (!u.ok) return { error: u.error };
      userId = u.id;
      userName = u.name ?? "that person";
    }
    const task = await getDoc(ctx,resolved.id);
    const now = Date.now();
    const minutes = Math.max(1, Math.round(args.minutes));
    await ctx.db.insert("timeEntries", {
      taskId: resolved.id,
      userId,
      projectId: task.projectId,
      description: args.description,
      minutes,
      date: toMillis(args.date) ?? now,
      createdAt: now,
    });
    await logActivity(
      ctx,
      actor,
      task.projectId,
      `logged ${minutes}m on ${task.title} for ${userName} (via AIE Agent)`,
      "task",
      task.title
    );
    return { ok: true, taskTitle: task.title, minutes, userName, note: resolved.note };
  },
});

export const notifyUser = internalMutation({
  args: {
    user: v.string(),
    title: v.string(),
    message: v.optional(v.string()),
    type: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    await requireActor(ctx);
    const user = await resolveUser(ctx, args.user);
    if (!user.ok) return { error: user.error };
    const type = normEnum(
      args.type ?? "team",
      ["task", "sprint", "risk", "project", "team"] as const,
      "team"
    );
    await ctx.db.insert("notifications", {
      userId: user.id,
      title: args.title.trim(),
      message: args.message?.trim() ?? args.title.trim(),
      type,
      isRead: false,
      createdAt: Date.now(),
    });
    return { ok: true, userName: user.name, title: args.title.trim(), type, note: user.note };
  },
});

export const createRetrospective = internalMutation({
  args: {
    sprint: v.string(),
    project: v.optional(v.string()),
    wentWell: v.optional(v.array(v.string())),
    toImprove: v.optional(v.array(v.string())),
    actionItems: v.optional(v.array(v.string())),
  },
  handler: async (ctx, args) => {
    const actor = await requireActor(ctx);
    let projectId: any;
    if (args.project) {
      const p = await resolveProject(ctx, args.project);
      if (!p.ok) return { error: p.error };
      projectId = p.id;
    }
    const resolved = await resolveSprint(ctx, args.sprint, projectId);
    if (!resolved.ok) return { error: resolved.error };
    const sprint = await getDoc(ctx,resolved.id);
    await ctx.db.insert("retrospectives", {
      sprintId: resolved.id,
      projectId: sprint.projectId,
      wentWell: args.wentWell ?? [],
      toImprove: args.toImprove ?? [],
      actionItems: args.actionItems ?? [],
      createdAt: Date.now(),
    });
    await logActivity(
      ctx,
      actor,
      sprint.projectId,
      `added a retrospective for sprint ${sprint.name} (via AIE Agent)`,
      "sprint",
      sprint.name
    );
    return { ok: true, sprintName: sprint.name, note: resolved.note };
  },
});

/** Bulk planner: create many tasks in one project in a single call. */
export const createTasksBulk = internalMutation({
  args: {
    project: v.string(),
    tasks: v.array(
      v.object({
        title: v.string(),
        description: v.optional(v.string()),
        assignee: v.optional(v.string()),
        type: v.optional(v.string()),
        priority: v.optional(v.string()),
        storyPoints: v.optional(v.number()),
        dueDate: v.optional(v.string()),
      })
    ),
  },
  handler: async (ctx, args) => {
    const actor = await requireActor(ctx);
    const project = await resolveProject(ctx, args.project);
    if (!project.ok) return { error: project.error };
    const now = Date.now();
    const existing = await ctx.db
      .query("tasks")
      .withIndex("by_project", (q: any) => q.eq("projectId", project.id))
      .collect();
    let order = Math.max(0, ...existing.map((t: any) => t.order ?? 0));
    const created: string[] = [];
    const failed: { title: string; error: string }[] = [];

    for (const spec of args.tasks) {
      let assigneeId: any;
      if (spec.assignee) {
        const a = await resolveUser(ctx, spec.assignee);
        if (!a.ok) {
          failed.push({ title: spec.title, error: a.error ?? "unknown person" });
          continue;
        }
        assigneeId = a.id;
      }
      order += 1;
      const id = await ctx.db.insert("tasks", {
        projectId: project.id,
        title: spec.title.trim(),
        description: spec.description,
        type: normEnum(spec.type ?? "task", TASK_TYPE, "task"),
        status: "todo",
        priority: normEnum(spec.priority ?? "medium", PRIORITY, "medium"),
        storyPoints: spec.storyPoints,
        assigneeId,
        dueDate: toMillis(spec.dueDate),
        order,
        createdAt: now,
        updatedAt: now,
      });
      created.push(spec.title.trim());
      await logActivity(ctx, actor, project.id, `created task ${spec.title} (via AIE Agent)`, "task", spec.title.trim());
    }

    return {
      ok: created.length > 0,
      projectName: project.name,
      createdCount: created.length,
      created,
      failed,
      note: project.note,
    };
  },
});

/* ═══════════════════════════════════════════════════════════════
   TEAM MEMBERSHIP
   In AIE the "team" is the users table: being on the team means having a user
   record, and being on a project means a projectMembers row. These tools cover
   both halves plus removal.
   ═══════════════════════════════════════════════════════════════ */

/**
 * Add someone to the team. Creates their user record — enriching rather than
 * duplicating when an email or a very close name already exists — and
 * optionally seats them on a project in the same call.
 */
export const addTeamMember = internalMutation({
  args: {
    name: v.string(),
    email: v.optional(v.string()),
    jobTitle: v.optional(v.string()),
    department: v.optional(v.string()),
    project: v.optional(v.string()),
    role: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const actor = await requireActor(ctx);
    const name = args.name.trim();
    const email = args.email?.trim().toLowerCase();

    let project: Resolved | undefined;
    if (args.project) {
      project = await resolveProject(ctx, args.project);
      if (!project.ok) return { error: project.error };
    }

    // Prefer an exact email match, then a near-exact name match, so we enrich
    // an existing person instead of creating a second copy of them.
    let userId: any;
    let alreadyExisted = false;
    if (email) {
      const byEmail = await ctx.db
        .query("users")
        .withIndex("email", (q: any) => q.eq("email", email))
        .first();
      if (byEmail) {
        userId = byEmail._id;
        alreadyExisted = true;
      }
    }
    if (!userId) {
      const users = await ctx.db.query("users").collect();
      const match = findFuzzy(
        name,
        users.map((u: any) => ({
          value: u._id,
          label: (u.name ?? u.email ?? "Unknown") as string,
          aliases: u.email ? [u.email] : [],
        }))
      );
      if (match && match.score > 0.9) {
        userId = match.item.value;
        alreadyExisted = true;
      }
    }

    if (!userId) {
      userId = await ctx.db.insert("users", {
        name,
        email,
        jobTitle: args.jobTitle?.trim(),
        department: args.department?.trim(),
      });
      await ctx.db.insert("notifications", {
        userId,
        title: `Welcome to the team, ${name}`,
        message: args.jobTitle
          ? `You have been added to AIE as ${args.jobTitle}.`
          : "You have been added to the AIE workspace.",
        type: "team",
        isRead: false,
        createdAt: Date.now(),
      });
    } else {
      // Fill in profile details we learned that the record was missing.
      const existing = await getDoc(ctx, userId);
      const patch: Record<string, unknown> = {};
      if (!existing?.jobTitle && args.jobTitle) patch.jobTitle = args.jobTitle.trim();
      if (!existing?.department && args.department) patch.department = args.department.trim();
      if (!existing?.email && email) patch.email = email;
      if (Object.keys(patch).length > 0) await ctx.db.patch(userId, patch);
    }

    let seatedOn: string | null = null;
    if (project?.ok && project.id) {
      const record = await ctx.db
        .query("projectMembers")
        .withIndex("by_project_user", (q: any) =>
          q.eq("projectId", project.id).eq("userId", userId)
        )
        .first();
      if (!record) {
        await ctx.db.insert("projectMembers", {
          projectId: project.id,
          userId,
          role: args.role?.trim() || "member",
          joinedAt: Date.now(),
        });
        seatedOn = project.name ?? null;
        await logActivity(
          ctx,
          actor,
          project.id,
          `added ${name} to project ${project.name} (via AIE Agent)`,
          "project",
          project.name
        );
      } else {
        seatedOn = `${project.name} (already a member)`;
      }
    }

    await logActivity(
      ctx,
      actor,
      project?.ok ? project.id : undefined,
      `${alreadyExisted ? "updated team member" : "added team member"} ${name} (via AIE Agent)`,
      "team",
      name
    );

    return {
      ok: true,
      userName: name,
      alreadyExisted,
      email: email ?? null,
      project: seatedOn,
      note: project?.note,
    };
  },
});

export const updateTeamMember = internalMutation({
  args: {
    user: v.string(),
    name: v.optional(v.string()),
    jobTitle: v.optional(v.string()),
    department: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const actor = await requireActor(ctx);
    const resolved = await resolveUser(ctx, args.user);
    if (!resolved.ok) return { error: resolved.error };
    const patch: Record<string, unknown> = {};
    const changes: string[] = [];
    if (args.name) {
      patch.name = args.name.trim();
      changes.push(`name → ${args.name.trim()}`);
    }
    if (args.jobTitle !== undefined) {
      patch.jobTitle = args.jobTitle;
      changes.push(`job title → ${args.jobTitle || "none"}`);
    }
    if (args.department !== undefined) {
      patch.department = args.department;
      changes.push(`department → ${args.department || "none"}`);
    }
    if (changes.length === 0) return { error: "Nothing to update — no fields were provided." };
    await ctx.db.patch(resolved.id, patch);
    await logActivity(
      ctx,
      actor,
      undefined,
      `updated team member ${resolved.name}: ${changes.join(", ")} (via AIE Agent)`,
      "team",
      resolved.name
    );
    return { ok: true, userName: args.name?.trim() ?? resolved.name, changes, note: resolved.note };
  },
});

/**
 * Take someone off the team: drop every project membership, unassign their
 * open work and delete their user record. Gated — the first call reports the
 * blast radius and waits for the user to confirm.
 */
export const removeTeamMember = internalMutation({
  args: {
    user: v.string(),
    confirmed: v.optional(v.boolean()),
  },
  handler: async (ctx, args) => {
    const actor = await requireActor(ctx);
    const resolved = await resolveUser(ctx, args.user);
    if (!resolved.ok) return { error: resolved.error };
    if (resolved.id === actor) {
      return { error: "You cannot remove yourself from the workspace." };
    }

    const memberships = await ctx.db
      .query("projectMembers")
      .withIndex("by_user", (q: any) => q.eq("userId", resolved.id))
      .collect();
    const assigned = await ctx.db
      .query("tasks")
      .withIndex("by_assignee", (q: any) => q.eq("assigneeId", resolved.id))
      .collect();
    const open = assigned.filter((t: any) => t.status !== "done");
    const projectNames = await Promise.all(
      memberships.map(async (m: any) => (await getDoc(ctx, m.projectId))?.name ?? "Unknown")
    );

    if (!args.confirmed) {
      return {
        needsConfirmation: true,
        message: `Removing ${resolved.name} from the team removes them from ${memberships.length} project(s) (${projectNames.join(", ") || "none"}) and unassigns ${open.length} open task(s), then deletes their user record. Ask the user to confirm, then call remove_team_member again with confirmed: true.`,
      };
    }

    const now = Date.now();
    for (const task of open as any[]) {
      await ctx.db.patch(task._id, { assigneeId: undefined, updatedAt: now });
    }
    for (const membership of memberships as any[]) {
      await ctx.db.delete(membership._id);
    }
    for (const note of await ctx.db
      .query("notifications")
      .withIndex("by_user", (q: any) => q.eq("userId", resolved.id))
      .collect()) {
      await ctx.db.delete(note._id);
    }
    await ctx.db.delete(resolved.id);
    await logActivity(
      ctx,
      actor,
      undefined,
      `removed team member ${resolved.name} (via AIE Agent)`,
      "team",
      resolved.name
    );
    return {
      ok: true,
      userName: resolved.name,
      projectsLeft: projectNames,
      tasksUnassigned: open.length,
    };
  },
});

/** Mark notifications read, for the signed-in user or a named person. */
export const markNotificationsRead = internalMutation({
  args: { user: v.optional(v.string()) },
  handler: async (ctx, args) => {
    await requireActor(ctx);
    let userId = await getAuthUserId(ctx);
    let targetName = "you";
    if (args.user) {
      const resolved = await resolveUser(ctx, args.user);
      if (!resolved.ok) return { error: resolved.error };
      userId = resolved.id;
      targetName = resolved.name ?? "them";
    }
    if (!userId) throw new Error("Not authenticated");
    const unread = await ctx.db
      .query("notifications")
      .withIndex("by_user_read", (q: any) => q.eq("userId", userId).eq("isRead", false))
      .collect();
    for (const note of unread as any[]) {
      await ctx.db.patch(note._id, { isRead: true });
    }
    return { ok: true, userName: targetName, markedRead: unread.length };
  },
});

/* ═══════════════════════════════════════════════════════════════
   EPICS, STORIES, BULK EDITS, INSIGHTS
   ═══════════════════════════════════════════════════════════════ */

export const updateEpic = internalMutation({
  args: {
    epic: v.string(),
    project: v.optional(v.string()),
    title: v.optional(v.string()),
    description: v.optional(v.string()),
    status: v.optional(v.string()),
    priority: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const actor = await requireActor(ctx);
    let projectId: any;
    if (args.project) {
      const p = await resolveProject(ctx, args.project);
      if (!p.ok) return { error: p.error };
      projectId = p.id;
    }
    const epic = await resolveEpic(ctx, args.epic, projectId);
    if (!epic.ok) return { error: epic.error };
    const record = await getDoc(ctx, epic.id);
    const patch: Record<string, unknown> = { updatedAt: Date.now() };
    const changes: string[] = [];
    if (args.title) {
      patch.title = args.title.trim();
      changes.push(`renamed to "${args.title.trim()}"`);
    }
    if (args.description !== undefined) {
      patch.description = args.description;
      changes.push("description updated");
    }
    if (args.status) {
      patch.status = normEnum(args.status, ["todo", "in-progress", "done"] as const, record.status);
      changes.push(`status → ${patch.status}`);
    }
    if (args.priority) {
      patch.priority = normEnum(args.priority, PRIORITY, record.priority);
      changes.push(`priority → ${patch.priority}`);
    }
    if (changes.length === 0) return { error: "Nothing to update — no fields were provided." };
    await ctx.db.patch(epic.id, patch);
    await logActivity(
      ctx,
      actor,
      record.projectId,
      `updated epic ${record.title}: ${changes.join(", ")} (via AIE Agent)`,
      "epic",
      record.title
    );
    return { ok: true, epicTitle: args.title ?? record.title, changes, note: epic.note };
  },
});

export const deleteEpic = internalMutation({
  args: {
    epic: v.string(),
    project: v.optional(v.string()),
    confirmed: v.optional(v.boolean()),
  },
  handler: async (ctx, args) => {
    const actor = await requireActor(ctx);
    let projectId: any;
    if (args.project) {
      const p = await resolveProject(ctx, args.project);
      if (!p.ok) return { error: p.error };
      projectId = p.id;
    }
    const resolved = await resolveEpic(ctx, args.epic, projectId);
    if (!resolved.ok) return { error: resolved.error };
    const epic = await getDoc(ctx, resolved.id);
    const [tasks, stories] = await Promise.all([
      ctx.db.query("tasks").withIndex("by_epic", (q: any) => q.eq("epicId", resolved.id)).collect(),
      ctx.db.query("userStories").withIndex("by_epic", (q: any) => q.eq("epicId", resolved.id)).collect(),
    ]);
    if (!args.confirmed) {
      return {
        needsConfirmation: true,
        message: `Deleting the epic "${epic.title}" detaches ${tasks.length} task(s) and ${stories.length} story/ies from it — they are kept, just no longer under this epic. Ask the user to confirm, then call delete_epic again with confirmed: true.`,
      };
    }
    const now = Date.now();
    for (const row of [...(tasks as any[]), ...(stories as any[])]) {
      await ctx.db.patch(row._id, { epicId: undefined, updatedAt: now });
    }
    await ctx.db.delete(resolved.id);
    await logActivity(ctx, actor, epic.projectId, `deleted epic ${epic.title} (via AIE Agent)`, "epic", epic.title);
    return { ok: true, deleted: epic.title, detachedTasks: tasks.length, detachedStories: stories.length };
  },
});

export const updateStory = internalMutation({
  args: {
    story: v.string(),
    project: v.optional(v.string()),
    title: v.optional(v.string()),
    description: v.optional(v.string()),
    acceptanceCriteria: v.optional(v.string()),
    status: v.optional(v.string()),
    priority: v.optional(v.string()),
    storyPoints: v.optional(v.number()),
    assignee: v.optional(v.string()),
    sprint: v.optional(v.string()),
    epic: v.optional(v.string()),
    dueDate: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const actor = await requireActor(ctx);
    let projectId: any;
    if (args.project) {
      const p = await resolveProject(ctx, args.project);
      if (!p.ok) return { error: p.error };
      projectId = p.id;
    }
    const story = await resolveStory(ctx, args.story, projectId);
    if (!story.ok) return { error: story.error };
    const record = await getDoc(ctx, story.id);

    const patch: Record<string, unknown> = { updatedAt: Date.now() };
    const changes: string[] = [];
    if (args.title) {
      patch.title = args.title.trim();
      changes.push(`renamed to "${args.title.trim()}"`);
    }
    if (args.description !== undefined) {
      patch.description = args.description;
      changes.push("description updated");
    }
    if (args.acceptanceCriteria !== undefined) {
      patch.acceptanceCriteria = args.acceptanceCriteria;
      changes.push("acceptance criteria updated");
    }
    if (args.status) {
      patch.status = normEnum(args.status, TASK_STATUS, record.status);
      changes.push(`status → ${patch.status}`);
    }
    if (args.priority) {
      patch.priority = normEnum(args.priority, PRIORITY, record.priority);
      changes.push(`priority → ${patch.priority}`);
    }
    if (args.storyPoints !== undefined) {
      patch.storyPoints = args.storyPoints;
      changes.push(`story points → ${args.storyPoints}`);
    }
    if (args.dueDate !== undefined) {
      patch.dueDate = toMillis(args.dueDate);
      changes.push(`due date → ${parseDateInput(args.dueDate) ?? "cleared"}`);
    }
    if (args.assignee) {
      const a = await resolveUser(ctx, args.assignee);
      if (!a.ok) return { error: a.error };
      patch.assigneeId = a.id;
      changes.push(`assigned to ${a.name}`);
    }
    if (args.sprint) {
      const s = await resolveSprint(ctx, args.sprint, record.projectId);
      if (!s.ok) return { error: s.error };
      patch.sprintId = s.id;
      changes.push(`sprint → ${s.name}`);
    }
    if (args.epic) {
      const e = await resolveEpic(ctx, args.epic, record.projectId);
      if (!e.ok) return { error: e.error };
      patch.epicId = e.id;
      changes.push(`epic → ${e.name}`);
    }
    if (changes.length === 0) return { error: "Nothing to update — no fields were provided." };
    await ctx.db.patch(story.id, patch);
    await logActivity(
      ctx,
      actor,
      record.projectId,
      `updated story ${record.title}: ${changes.join(", ")} (via AIE Agent)`,
      "story",
      record.title
    );
    return { ok: true, storyTitle: args.title ?? record.title, changes, note: story.note };
  },
});

export const deleteStory = internalMutation({
  args: {
    story: v.string(),
    project: v.optional(v.string()),
    confirmed: v.optional(v.boolean()),
  },
  handler: async (ctx, args) => {
    const actor = await requireActor(ctx);
    let projectId: any;
    if (args.project) {
      const p = await resolveProject(ctx, args.project);
      if (!p.ok) return { error: p.error };
      projectId = p.id;
    }
    const resolved = await resolveStory(ctx, args.story, projectId);
    if (!resolved.ok) return { error: resolved.error };
    const story = await getDoc(ctx, resolved.id);
    const tasks = await ctx.db
      .query("tasks")
      .withIndex("by_story", (q: any) => q.eq("storyId", resolved.id))
      .collect();
    if (!args.confirmed) {
      return {
        needsConfirmation: true,
        message: `Deleting the story "${story.title}" also detaches ${tasks.length} linked task(s). Ask the user to confirm, then call delete_story again with confirmed: true.`,
      };
    }
    const now = Date.now();
    for (const task of tasks as any[]) {
      await ctx.db.patch(task._id, { storyId: undefined, updatedAt: now });
    }
    await ctx.db.delete(resolved.id);
    await logActivity(ctx, actor, story.projectId, `deleted story ${story.title} (via AIE Agent)`, "story", story.title);
    return { ok: true, deleted: story.title, detachedTasks: tasks.length };
  },
});

/**
 * Sweep a filtered set of tasks to new values in one call: "move every open
 * task in Apollo to review", "reassign all of Sarah's in-progress work to
 * James". Gated, because a loose filter can match far more than expected.
 */
export const bulkUpdateTasks = internalMutation({
  args: {
    project: v.optional(v.string()),
    assignee: v.optional(v.string()),
    matchTitle: v.optional(v.string()),
    matchStatus: v.optional(v.string()),
    matchPriority: v.optional(v.string()),
    matchType: v.optional(v.string()),
    setStatus: v.optional(v.string()),
    setPriority: v.optional(v.string()),
    setAssignee: v.optional(v.string()),
    setSprint: v.optional(v.string()),
    confirmed: v.optional(v.boolean()),
  },
  handler: async (ctx, args) => {
    const actor = await requireActor(ctx);
    let projectId: any;
    let projectName: string | undefined;
    if (args.project) {
      const p = await resolveProject(ctx, args.project);
      if (!p.ok) return { error: p.error };
      projectId = p.id;
      projectName = p.name;
    }

    const hasChange =
      args.setStatus !== undefined ||
      args.setPriority !== undefined ||
      args.setAssignee !== undefined ||
      args.setSprint !== undefined;
    if (!hasChange) {
      return {
        error:
          "Nothing to do — pass at least one of setStatus, setPriority, setAssignee or setSprint.",
      };
    }

    let assigneeId: any;
    let assigneeName: string | undefined;
    if (args.assignee) {
      const a = await resolveUser(ctx, args.assignee);
      if (!a.ok) return { error: a.error };
      assigneeId = a.id;
      assigneeName = a.name;
    }
    let newAssigneeId: any;
    let newAssigneeName: string | undefined;
    if (args.setAssignee) {
      const a = await resolveUser(ctx, args.setAssignee);
      if (!a.ok) return { error: a.error };
      newAssigneeId = a.id;
      newAssigneeName = a.name;
    }

    let candidates = await ctx.db.query("tasks").collect();
    if (projectId) candidates = candidates.filter((t: any) => t.projectId === projectId);
    if (assigneeId) candidates = candidates.filter((t: any) => t.assigneeId === assigneeId);
    if (args.matchStatus) {
      const status = normEnum(args.matchStatus, TASK_STATUS, "todo");
      candidates = candidates.filter((t: any) => t.status === status);
    }
    if (args.matchPriority) {
      const priority = normEnum(args.matchPriority, PRIORITY, "medium");
      candidates = candidates.filter((t: any) => t.priority === priority);
    }
    if (args.matchType) {
      const type = normEnum(args.matchType, TASK_TYPE, "task");
      candidates = candidates.filter((t: any) => t.type === type);
    }
    if (args.matchTitle) {
      const match = findFuzzy(
        args.matchTitle,
        candidates.map((t: any) => ({ value: t._id, label: t.title }))
      );
      candidates = match ? candidates.filter((t: any) => t._id === match.item.value) : [];
    }

    const scope = [
      projectName ? `project ${projectName}` : "all projects",
      assigneeName ? `assigned to ${assigneeName}` : null,
      args.matchStatus ? `status ${args.matchStatus}` : null,
      args.matchPriority ? `priority ${args.matchPriority}` : null,
      args.matchTitle ? `matching "${args.matchTitle}"` : null,
    ]
      .filter(Boolean)
      .join(", ");

    if (candidates.length === 0) {
      return { error: `No tasks match that filter (${scope}). Nothing was changed.` };
    }
    if (!args.confirmed) {
      return {
        needsConfirmation: true,
        message: `About to change ${candidates.length} task(s) (${scope}): "${candidates[0].title}" and ${candidates.length - 1} more. Ask the user to confirm, then call bulk_update_tasks again with confirmed: true.`,
      };
    }

    let sprintId: any;
    let sprintName: string | undefined;
    if (args.setSprint) {
      const s = await resolveSprint(ctx, args.setSprint, projectId);
      if (!s.ok) return { error: s.error };
      sprintId = s.id;
      sprintName = s.name;
    }

    const patch: Record<string, unknown> = { updatedAt: Date.now() };
    const changes: string[] = [];
    if (args.setStatus) {
      patch.status = normEnum(args.setStatus, TASK_STATUS, "todo");
      changes.push(`status → ${patch.status}`);
    }
    if (args.setPriority) {
      patch.priority = normEnum(args.setPriority, PRIORITY, "medium");
      changes.push(`priority → ${patch.priority}`);
    }
    if (newAssigneeId) {
      patch.assigneeId = newAssigneeId;
      changes.push(`assignee → ${newAssigneeName}`);
    }
    if (sprintId) {
      patch.sprintId = sprintId;
      changes.push(`sprint → ${sprintName}`);
    }

    for (const task of candidates as any[]) {
      await ctx.db.patch(task._id, patch);
    }
    const projectIdForLog = projectId ?? (candidates[0] as any).projectId;
    await logActivity(
      ctx,
      actor,
      projectIdForLog,
      `updated ${candidates.length} task(s) (${changes.join(", ")}) via AIE Agent`,
      "task",
      candidates[0].title
    );
    return {
      ok: true,
      updatedCount: candidates.length,
      scope,
      changes: changes.join(", "),
      tasks: candidates.slice(0, 10).map((t: any) => t.title),
    };
  },
});

/** Surfaces the app's own insights engine so the agent can explain *why* a board looks bad. */
export const projectInsights = internalMutation({
  args: { project: v.optional(v.string()) },
  handler: async (ctx, args): Promise<Record<string, unknown>> => {
    const resolved = await resolveProject(ctx, args.project);
    if (!resolved.ok) return { error: resolved.error };
    const insights = await ctx.runQuery(api.insights.generate, { projectId: resolved.id });
    return { project: resolved.name, note: resolved.note, insights };
  },
});