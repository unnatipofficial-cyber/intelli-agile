import { v } from "convex/values";
import { query } from "./_generated/server";

interface Insight {
  id: string;
  severity: "low" | "medium" | "high" | "critical";
  title: string;
  description: string;
  recommendedAction: string;
  category: "sprint" | "workload" | "velocity" | "risk" | "deadline";
}

export const generate = query({
  args: { projectId: v.id("projects") },
  handler: async (ctx, args) => {
    const insights: Insight[] = [];
    let insightCounter = 0;

    // Get sprints
    const sprints = await ctx.db
      .query("sprints")
      .withIndex("by_project", (q) => q.eq("projectId", args.projectId))
      .collect();

    const activeSprint = sprints.find((s) => s.status === "active");
    const completedSprints = sprints
      .filter((s) => s.status === "completed")
      .sort((a, b) => b.endDate - a.endDate);

    // Get all tasks
    const allTasks = await ctx.db
      .query("tasks")
      .withIndex("by_project", (q) => q.eq("projectId", args.projectId))
      .collect();

    // Sprint analysis
    if (activeSprint) {
      const sprintTasks = allTasks.filter((t) => t.sprintId === activeSprint._id);
      const totalPoints = sprintTasks.reduce((s, t) => s + (t.storyPoints || 0), 0);
      const completedPoints = sprintTasks
        .filter((t) => t.status === "done")
        .reduce((s, t) => s + (t.storyPoints || 0), 0);
      const progress = totalPoints > 0 ? (completedPoints / totalPoints) * 100 : 0;

      const now = Date.now();
      const totalDuration = activeSprint.endDate - activeSprint.startDate;
      const elapsed = now - activeSprint.startDate;
      const expectedProgress = Math.min(100, (elapsed / totalDuration) * 100);

      // Sprint at risk
      if (progress < expectedProgress - 15 && elapsed > totalDuration * 0.3) {
        insights.push({
          id: `insight-${++insightCounter}`,
          severity: progress < expectedProgress - 25 ? "critical" : "high",
          title: "Sprint may be at risk",
          description: `Completion rate is ${Math.round(expectedProgress - progress)}% below expected velocity. Only ${Math.round(progress)}% complete with ${Math.round((remainingdays(activeSprint.endDate)) )} days remaining.`,
          recommendedAction: "Consider moving low-priority tasks to the next sprint or increasing team capacity.",
          category: "sprint",
        });
      }

      // Too many incomplete tasks
      const incompleteTasks = sprintTasks.filter((t) => t.status !== "done");
      if (incompleteTasks.length > sprintTasks.length * 0.6 && elapsed > totalDuration * 0.5) {
        insights.push({
          id: `insight-${++insightCounter}`,
          severity: "high",
          title: "Too many tasks remain incomplete",
          description: `${incompleteTasks.length} of ${sprintTasks.length} tasks are still not done, with ${Math.round(remainingdays(activeSprint.endDate))} days remaining in the sprint.`,
          recommendedAction: "Prioritize critical tasks and defer lower-priority items. Consider pairing on blocked tasks.",
          category: "sprint",
        });
      }

      // High-priority overdue tasks
      const overdueHighPriority = sprintTasks.filter(
        (t) => t.status !== "done" && t.priority === "high" && t.dueDate && t.dueDate < now
      );
      if (overdueHighPriority.length > 0) {
        insights.push({
          id: `insight-${++insightCounter}`,
          severity: "critical",
          title: `${overdueHighPriority.length} high-priority task${overdueHighPriority.length > 1 ? "s are" : " is"} overdue`,
          description: `Tasks "${overdueHighPriority[0]?.title}" and ${overdueHighPriority.length > 1 ? `${overdueHighPriority.length - 1} others ` : ""}have passed their due date while still in "${overdueHighPriority[0]?.status}" status.`,
          recommendedAction: "Immediately reassess these tasks and either assign additional resources or escalate blockers.",
          category: "deadline",
        });
      }
    }

    // Velocity analysis
    if (completedSprints.length >= 2) {
      const velocities = await Promise.all(
        completedSprints.slice(0, 5).map(async (sprint) => {
          const tasks = allTasks.filter((t) => t.sprintId === sprint._id);
          return tasks.filter((t) => t.status === "done").reduce((s, t) => s + (t.storyPoints || 0), 0);
        })
      );

      // Declining velocity
      if (velocities.length >= 3 && velocities[0] < velocities[1] && velocities[1] < velocities[2]) {
        insights.push({
          id: `insight-${++insightCounter}`,
          severity: "high",
          title: "Sprint velocity is decreasing",
          description: `Velocity has declined over the last ${velocities.length} sprints: ${velocities.join(" → ")} story points. This trend may indicate team capacity issues.`,
          recommendedAction: "Review team workload, identify blockers, and consider adjusting sprint capacity or scope.",
          category: "velocity",
        });
      }
    }

    // Team workload analysis
    if (activeSprint) {
      const sprintTasks = allTasks.filter((t) => t.sprintId === activeSprint._id && t.status !== "done");
      const teamWorkload: Record<string, number> = {};
      for (const task of sprintTasks) {
        if (task.assigneeId) {
          teamWorkload[task.assigneeId] = (teamWorkload[task.assigneeId] || 0) + (task.storyPoints || 1);
        }
      }
      const workloads = Object.values(teamWorkload);
      const avgWorkload = workloads.length > 0 ? workloads.reduce((a, b) => a + b, 0) / workloads.length : 0;

      for (const [userId, load] of Object.entries(teamWorkload)) {
        if (load > avgWorkload * 1.8 && load > 6) {
          const userDoc = await ctx.db.get(userId as any as any);
          const userName = userDoc && 'name' in userDoc ? (userDoc as any).name : "Team member";
          insights.push({
            id: `insight-${++insightCounter}`,
            severity: "high",
            title: `${userName} has unusually high workload`,
            description: `Currently assigned ${load} story points in the active sprint, which is ${Math.round((load / avgWorkload) * 100 - 100)}% above the team average of ${Math.round(avgWorkload)} SP.`,
            recommendedAction: `Consider redistributing ${Math.round(load - avgWorkload)} story points to other team members.`,
            category: "workload",
          });
        }
      }
    }

    // Risk analysis
    const risks = await ctx.db
      .query("risks")
      .withIndex("by_project", (q) => q.eq("projectId", args.projectId))
      .collect();

    const openCriticalRisks = risks.filter((r) => r.status === "open" && (r.severity === "critical" || r.score >= 16));
    if (openCriticalRisks.length > 0) {
      insights.push({
        id: `insight-${++insightCounter}`,
        severity: "critical",
        title: `${openCriticalRisks.length} critical risk${openCriticalRisks.length > 1 ? "s require" : " requires"} immediate attention`,
        description: `Open critical risks include: ${openCriticalRisks.map((r) => r.title).join(", ")}. These pose significant threats to project success.`,
        recommendedAction: "Schedule a risk review meeting and assign mitigation owners with clear deadlines.",
        category: "risk",
      });
    }

    const highRisks = risks.filter((r) => r.status === "open" && r.severity === "high");
    if (highRisks.length >= 2) {
      insights.push({
        id: `insight-${++insightCounter}`,
        severity: "medium",
        title: "Multiple high-severity risks open",
        description: `${highRisks.length} high-severity risks remain open. Combined impact could significantly affect sprint goals.`,
        recommendedAction: "Review mitigation strategies and ensure each risk has a clear owner and action plan.",
        category: "risk",
      });
    }

    // If no insights, add a positive one
    if (insights.length === 0) {
      insights.push({
        id: `insight-${++insightCounter}`,
        severity: "low",
        title: "Project is on track",
        description: "All metrics are within healthy ranges. Sprint progress, team workload, and risk levels are stable.",
        recommendedAction: "Continue monitoring and maintain current pace.",
        category: "sprint",
      });
    }

    return insights;
  },
});

function remainingdays(endDate: number): number {
  return Math.max(0, Math.ceil((endDate - Date.now()) / 86400000));
}
