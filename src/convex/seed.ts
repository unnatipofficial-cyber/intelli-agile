import { getAuthUserId } from "@convex-dev/auth/server";
import { mutation } from "./_generated/server";
import { ROLES } from "./rbac";

export const getOrCreateSampleData = mutation({
  args: {},
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Not authenticated");

    const now = Date.now();

    // Whoever seeds the workspace owns it. Note we deliberately do NOT invent a
    // name for a Guest session: Convex Auth already stores the anonymous user
    // row, and persisting a "Guest User" profile on top of it is exactly the
    // throwaway data we do not want to keep. Guests stay nameless and are
    // filtered out of the roster by `isEphemeralGuest`.
    const existingUser = await ctx.db.get(userId);
    if (existingUser && existingUser.role !== ROLES.ADMIN) {
      await ctx.db.patch(userId, { role: ROLES.ADMIN, updatedAt: now });
    }

    const existingProjects = await ctx.db.query("projects").collect();
    if (existingProjects.length > 0) return { seeded: false, message: "Data already exists" };

    const day = 86400000;

    // Create team member users
    const teamNames = [
      { name: "Alex Chen", email: "alex@aie.dev", jobTitle: "Tech Lead", department: "Engineering" },
      { name: "Sarah Kim", email: "sarah@aie.dev", jobTitle: "Senior Developer", department: "Engineering" },
      { name: "Marcus Johnson", email: "marcus@aie.dev", jobTitle: "Backend Developer", department: "Engineering" },
      { name: "Priya Patel", email: "priya@aie.dev", jobTitle: "Frontend Developer", department: "Engineering" },
      { name: "James Wilson", email: "james@aie.dev", jobTitle: "DevOps Engineer", department: "Infrastructure" },
      { name: "Elena Rodriguez", email: "elena@aie.dev", jobTitle: "QA Lead", department: "Quality Assurance" },
    ];

    // First team member is the current (guest) user
    const teamUserIds: any[] = [userId];

    for (const tm of teamNames) {
      const existing = await ctx.db
        .query("users")
        .withIndex("email", (q) => q.eq("email", tm.email))
        .first();
      if (existing) {
        teamUserIds.push(existing._id);
      } else {
        const id = await ctx.db.insert("users", {
          name: tm.name,
          email: tm.email,
          jobTitle: tm.jobTitle,
          department: tm.department,
          role: ROLES.MEMBER,
          createdAt: now,
          updatedAt: now,
        });
        teamUserIds.push(id);
      }
    }

    // Create Projects
    const project1 = await ctx.db.insert("projects", {
      name: "AIE Platform v2",
      description: "Next-generation Agile Intelligence Engine with advanced analytics and AI-powered insights for software teams.",
      status: "active",
      priority: "high",
      startDate: now - 30 * day,
      endDate: new Date(now + 60 * day).toISOString().split("T")[0],
      ownerId: teamUserIds[0],
      color: "#606060",
      createdAt: now - 30 * day,
      updatedAt: now,
    });

    const project2 = await ctx.db.insert("projects", {
      name: "Mobile Companion App",
      description: "Cross-platform mobile application for on-the-go sprint management and team notifications.",
      status: "active",
      priority: "medium",
      startDate: now - 15 * day,
      endDate: new Date(now + 75 * day).toISOString().split("T")[0],
      ownerId: teamUserIds[1],
      color: "#808080",
      createdAt: now - 15 * day,
      updatedAt: now,
    });

    const project3 = await ctx.db.insert("projects", {
      name: "API Gateway Redesign",
      description: "Complete overhaul of the API gateway layer for improved performance, security, and scalability.",
      status: "planning",
      priority: "critical",
      startDate: now + 10 * day,
      endDate: new Date(now + 100 * day).toISOString().split("T")[0],
      ownerId: teamUserIds[2],
      color: "#cc3333",
      createdAt: now - 5 * day,
      updatedAt: now,
    });

    // Add team members to project 1
    for (const uid of teamUserIds) {
      await ctx.db.insert("projectMembers", {
        projectId: project1,
        userId: uid,
        role: uid === teamUserIds[0] ? "owner" : "member",
        joinedAt: now - 30 * day,
      });
    }
    for (const uid of [teamUserIds[1], teamUserIds[3], teamUserIds[5]]) {
      await ctx.db.insert("projectMembers", {
        projectId: project2,
        userId: uid,
        role: uid === teamUserIds[1] ? "owner" : "member",
        joinedAt: now - 15 * day,
      });
    }

    // Create Sprints
    const sprint1 = await ctx.db.insert("sprints", {
      projectId: project1,
      name: "Sprint 14",
      goal: "Complete dashboard redesign and fix critical auth bugs",
      status: "completed",
      startDate: now - 28 * day,
      endDate: now - 14 * day,
      capacity: 40,
      createdAt: now - 28 * day,
      updatedAt: now - 14 * day,
    });

    const sprint2 = await ctx.db.insert("sprints", {
      projectId: project1,
      name: "Sprint 15",
      goal: "Implement risk analytics module and team workload features",
      status: "active",
      startDate: now - 14 * day,
      endDate: now + 1 * day,
      capacity: 42,
      createdAt: now - 14 * day,
      updatedAt: now,
    });

    await ctx.db.insert("sprints", {
      projectId: project1,
      name: "Sprint 16",
      goal: "AIE Insights engine and notification system",
      status: "planning",
      startDate: now + 2 * day,
      endDate: now + 16 * day,
      capacity: 42,
      createdAt: now - 3 * day,
      updatedAt: now,
    });

    await ctx.db.insert("sprints", {
      projectId: project2,
      name: "Sprint 1",
      goal: "Mobile app scaffolding and core navigation",
      status: "active",
      startDate: now - 10 * day,
      endDate: now + 4 * day,
      capacity: 30,
      createdAt: now - 10 * day,
      updatedAt: now,
    });

    // Create Epics
    const epic1 = await ctx.db.insert("epics", {
      projectId: project1,
      title: "Dashboard & Analytics",
      description: "Complete dashboard with KPIs, charts, and analytics views",
      status: "in-progress",
      priority: "high",
      color: "#606060",
      createdAt: now - 25 * day,
      updatedAt: now,
    });

    const epic2 = await ctx.db.insert("epics", {
      projectId: project1,
      title: "Risk Management",
      description: "Risk identification, assessment, and mitigation tracking",
      status: "in-progress",
      priority: "high",
      color: "#cc3333",
      createdAt: now - 20 * day,
      updatedAt: now,
    });

    const epic3 = await ctx.db.insert("epics", {
      projectId: project1,
      title: "AIE Intelligence Engine",
      description: "AI-powered insights and recommendations system",
      status: "todo",
      priority: "critical",
      color: "#808080",
      createdAt: now - 15 * day,
      updatedAt: now,
    });

    // Tasks for Sprint 14 (completed)
    const completedTasks = [
      { title: "Set up project architecture", points: 3, assignee: 0 },
      { title: "Implement auth flow", points: 5, assignee: 0 },
      { title: "Design component library", points: 3, assignee: 3 },
      { title: "Set up Convex schema", points: 2, assignee: 2 },
      { title: "Create sidebar navigation", points: 2, assignee: 3 },
      { title: "Implement theme system", points: 2, assignee: 3 },
      { title: "Build responsive layout", points: 3, assignee: 1 },
      { title: "Create landing page", points: 5, assignee: 1 },
      { title: "Set up CI/CD pipeline", points: 3, assignee: 4 },
      { title: "Write integration tests", points: 5, assignee: 5 },
      { title: "Configure monitoring", points: 3, assignee: 4 },
      { title: "Database optimization", points: 2, assignee: 2 },
    ];

    for (const task of completedTasks) {
      await ctx.db.insert("tasks", {
        projectId: project1,
        title: task.title,
        type: "task",
        status: "done",
        priority: task.points > 3 ? "high" : "medium",
        storyPoints: task.points,
        assigneeId: teamUserIds[task.assignee],
        sprintId: sprint1,
        epicId: epic1,
        createdAt: now - 25 * day + Math.floor(Math.random() * 5 * day),
        updatedAt: now - 15 * day,
      });
    }

    // Tasks for Sprint 15 (active)
    const activeTasks = [
      { title: "Build KPI dashboard cards", points: 3, assignee: 3, status: "done" as const, priority: "high" as const, epic: epic1 },
      { title: "Implement burndown chart", points: 5, assignee: 1, status: "done" as const, priority: "high" as const, epic: epic1 },
      { title: "Create velocity tracking", points: 3, assignee: 2, status: "in-progress" as const, priority: "medium" as const, epic: epic1 },
      { title: "Build risk matrix component", points: 5, assignee: 0, status: "in-progress" as const, priority: "high" as const, epic: epic2 },
      { title: "Implement risk CRUD operations", points: 3, assignee: 2, status: "in-progress" as const, priority: "high" as const, epic: epic2 },
      { title: "Design team workload view", points: 3, assignee: 3, status: "in-progress" as const, priority: "medium" as const, epic: epic1 },
      { title: "Create sprint board with drag-drop", points: 8, assignee: 0, status: "todo" as const, priority: "critical" as const, epic: epic1 },
      { title: "Build notification system", points: 5, assignee: 1, status: "todo" as const, priority: "high" as const, epic: epic3 },
      { title: "Implement global search", points: 3, assignee: 3, status: "todo" as const, priority: "medium" as const, epic: epic1 },
      { title: "Performance testing suite", points: 5, assignee: 5, status: "todo" as const, priority: "medium" as const, epic: epic1 },
      { title: "API rate limiting", points: 3, assignee: 4, status: "review" as const, priority: "high" as const, epic: epic2 },
      { title: "Fix login redirect bug", points: 2, assignee: 2, status: "done" as const, priority: "critical" as const, epic: epic1, labels: ["bug"] },
    ];

    for (let i = 0; i < activeTasks.length; i++) {
      const task = activeTasks[i];
      await ctx.db.insert("tasks", {
        projectId: project1,
        title: task.title,
        type: "bug" in task ? "bug" : "task",
        status: task.status,
        priority: task.priority,
        storyPoints: task.points,
        assigneeId: teamUserIds[task.assignee],
        sprintId: sprint2,
        epicId: task.epic,
        labels: "labels" in task ? (task as any).labels : undefined,
        order: i,
        dueDate: task.status !== "done" ? now + (Math.random() * 5 - 1) * day : undefined,
        createdAt: now - 14 * day + i * 100000,
        updatedAt: now,
      });
    }

    // Backlog items
    const backlogItems = [
      { title: "User story: Export project data to PDF", points: 5, priority: "medium" as const, epic: epic1 },
      { title: "User story: Custom dashboard widgets", points: 8, priority: "low" as const, epic: epic1 },
      { title: "Bug: Chart tooltip positioning off-screen", points: 1, priority: "high" as const, epic: epic1 },
      { title: "Epic: Multi-project portfolio view", points: 13, priority: "medium" as const, epic: epic1 },
      { title: "User story: Risk trend analysis over time", points: 5, priority: "high" as const, epic: epic2 },
      { title: "Task: Set up error tracking (Sentry)", points: 2, priority: "medium" as const, epic: epic1 },
      { title: "Bug: Dark mode contrast issues on charts", points: 2, priority: "high" as const, epic: epic1 },
      { title: "User story: Sprint retrospective board", points: 8, priority: "low" as const, epic: epic1 },
      { title: "Task: Database backup automation", points: 3, priority: "medium" as const, epic: epic2 },
      { title: "User story: Team performance comparison", points: 5, priority: "medium" as const, epic: epic1 },
    ];

    for (let i = 0; i < backlogItems.length; i++) {
      const item = backlogItems[i];
      const isBug = item.title.startsWith("Bug:");
      await ctx.db.insert("tasks", {
        projectId: project1,
        title: item.title,
        type: isBug ? "bug" : "task",
        status: "todo",
        priority: item.priority,
        storyPoints: item.points,
        epicId: item.epic,
        order: 100 + i,
        createdAt: now - 10 * day + i * 50000,
        updatedAt: now,
      });
    }

    // Risks
    const riskData = [
      { title: "Sprint 15 deadline at risk", desc: "Current velocity suggests 3-4 story points will remain uncompleted by sprint end.", prob: 4, impact: 4, severity: "high" as const, status: "open" as const, mitigation: "Consider moving low-priority items to next sprint. Focus team on critical path items." },
      { title: "Key developer bandwidth constraint", desc: "Alex is handling both tech lead responsibilities and 40% of sprint tasks, creating a bottleneck.", prob: 3, impact: 5, severity: "critical" as const, status: "open" as const, mitigation: "Redistribute 2 tasks to other team members. Prioritize code reviews." },
      { title: "Third-party API dependency", desc: "Analytics API has had 2 outages this month. No fallback service identified.", prob: 3, impact: 3, severity: "medium" as const, status: "mitigated" as const, mitigation: "Implemented caching layer. Evaluating backup provider." },
      { title: "Scope creep in mobile app", desc: "Stakeholders requesting additional features beyond MVP scope.", prob: 4, impact: 3, severity: "high" as const, status: "open" as const, mitigation: "Enforce strict scope control. New features go to backlog for next quarter." },
      { title: "Database performance degradation", desc: "Query times increasing as data volume grows. May impact sprint board responsiveness.", prob: 2, impact: 4, severity: "medium" as const, status: "open" as const, mitigation: "Schedule index optimization. Monitor query performance metrics." },
      { title: "Security audit findings", desc: "Two medium-severity findings from last security review need remediation.", prob: 5, impact: 4, severity: "critical" as const, status: "open" as const, mitigation: "Assign dedicated sprint for security fixes. Prioritize high-severity items." },
    ];

    for (const risk of riskData) {
      await ctx.db.insert("risks", {
        projectId: project1,
        title: risk.title,
        description: risk.desc,
        probability: risk.prob,
        impact: risk.impact,
        severity: risk.severity,
        ownerId: teamUserIds[Math.floor(Math.random() * teamUserIds.length)],
        status: risk.status,
        mitigationStrategy: risk.mitigation,
        score: risk.prob * risk.impact,
        createdAt: now - 20 * day + Math.floor(Math.random() * 10 * day),
        updatedAt: now,
      });
    }

    // Notifications
    const notifData = [
      { title: "Sprint 15 ending tomorrow", message: "4 tasks remain in the current sprint. Review progress and adjust priorities.", type: "sprint" as const, read: false },
      { title: "Task assigned to you", message: "Build risk matrix component has been assigned to you.", type: "task" as const, read: false },
      { title: "Critical risk identified", message: "Security audit findings require immediate attention.", type: "risk" as const, read: false },
      { title: "Sprint 14 completed", message: "Sprint 14 has been marked as completed. 12 story points delivered.", type: "sprint" as const, read: true },
      { title: "New team member added", message: "Elena Rodriguez has joined the AIE Platform v2 project.", type: "team" as const, read: true },
      { title: "Project status updated", message: "API Gateway Redesign moved to planning phase.", type: "project" as const, read: false },
    ];

    for (const notif of notifData) {
      await ctx.db.insert("notifications", {
        userId: userId,
        title: notif.title,
        message: notif.message,
        type: notif.type,
        isRead: notif.read,
        createdAt: now - Math.floor(Math.random() * 5 * day),
      });
    }

    // User Stories
    await ctx.db.insert("userStories", {
      projectId: project1,
      epicId: epic1,
      title: "As a PM, I want to view sprint burndown to track progress",
      description: "Display a real-time burndown chart showing ideal vs actual progress",
      storyPoints: 5,
      priority: "high",
      status: "done",
      assigneeId: teamUserIds[1],
      sprintId: sprint2,
      labels: ["analytics"],
      createdAt: now - 14 * day,
      updatedAt: now - 2 * day,
    });

    await ctx.db.insert("userStories", {
      projectId: project1,
      epicId: epic2,
      title: "As a manager, I want to assess project risks visually",
      description: "Display risks in a probability/impact matrix with severity indicators",
      storyPoints: 8,
      priority: "high",
      status: "in-progress",
      assigneeId: teamUserIds[0],
      sprintId: sprint2,
      labels: ["risk", "visualization"],
      createdAt: now - 12 * day,
      updatedAt: now,
    });

    // Activity logs
    const actions = [
      "created project AIE Platform v2",
      "started Sprint 15",
      "moved Build KPI dashboard cards to Done",
      "identified risk: Sprint 15 deadline at risk",
      "assigned API rate limiting to James Wilson",
      "updated task priority: Fix login redirect bug to Critical",
    ];
    for (let i = 0; i < actions.length; i++) {
      await ctx.db.insert("activityLogs", {
        userId: teamUserIds[i % teamUserIds.length],
        projectId: project1,
        action: actions[i],
        entityType: "task",
        entityName: actions[i],
        createdAt: now - i * 3600000,
      });
    }

    return { seeded: true, message: "Sample data created successfully" };
  },
});
