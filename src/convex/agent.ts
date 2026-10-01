"use node";

/**
 * AIE Agent — an agentic Gemini loop with real tools.
 *
 * The user says "Create a project called Apollo, high priority, due Dec 15" and
 * the model decides to call `create_project`, then answers with a confirmation.
 * Or "Assign Sarah and James to that project, best performers first" and it
 * inspects the team, ranks by completed story points, and calls
 * `add_project_member` per person.
 *
 * The tools themselves live in agentTools.ts as internal queries/mutations
 * ("use node" modules may only define actions). They run through
 * ctx.runQuery / ctx.runMutation from this action, so the caller's auth context
 * carries over and every write is attributed to the signed-in user.
 */

import { internalAction, action } from "./_generated/server";
import { v } from "convex/values";
import { internal } from "./_generated/api";

const MODELS = [
  "gemini-3-flash-preview",
  "gemini-flash-latest",
  "gemini-flash-lite-latest",
];

/** Upper bound on tool-call round trips, so a confused model can't spin. */
const MAX_STEPS = 6;

/* ── Types (Gemini REST, function-calling shape) ────────────────── */

interface ToolCall {
  name: string;
  args: Record<string, unknown>;
}

interface GeminiPart {
  text?: string;
  functionCall?: { name: string; args?: Record<string, unknown> };
  functionResponse?: { name: string; response: Record<string, unknown> };
}

interface GeminiContent {
  role: "user" | "model";
  parts: GeminiPart[];
}

/* ── Tool schemas ──────────────────────────────────────────────── */

const TOOLS = [
  {
    functionDeclarations: [
      {
        name: "list_projects",
        description:
          "List every project in the workspace with its status, priority, dates, owner, and member names.",
        parameters: { type: "OBJECT", properties: {} },
      },
      {
        name: "list_team_members",
        description:
          "List every team member with their name, email, job title, department, and performance stats (assigned/completed tasks and story points). Use this to find people by name or to decide who to assign work to.",
        parameters: { type: "OBJECT", properties: {} },
      },
      {
        name: "get_member_performance",
        description:
          "Get performance stats for a single team member by their exact user id: tasks assigned, completed, completion rate, story points, and current workload. Use after resolving a name via list_team_members.",
        parameters: {
          type: "OBJECT",
          properties: { userId: { type: "STRING" } },
          required: ["userId"],
        },
      },
      {
        name: "create_project",
        description:
          "Create a new project. The model should map the user's words to fields: status (active/completed/on-hold/planning), priority (low/medium/high/critical), endDate as YYYY-MM-DD. Returns the new project id.",
        parameters: {
          type: "OBJECT",
          properties: {
            name: { type: "STRING" },
            description: { type: "STRING" },
            status: { type: "STRING" },
            priority: { type: "STRING" },
            endDate: { type: "STRING" },
          },
          required: ["name"],
        },
      },
      {
        name: "add_project_member",
        description:
          "Add a team member to a project by user id and optional role. Returns ok, or the reason it was skipped (already a member).",
        parameters: {
          type: "OBJECT",
          properties: {
            projectId: { type: "STRING" },
            userId: { type: "STRING" },
            role: { type: "STRING" },
          },
          required: ["projectId", "userId"],
        },
      },
      {
        name: "create_task",
        description:
          "Create a task in a project and optionally assign it immediately. type is task/bug/subtask, status is todo/in-progress/review/done, priority low/medium/high/critical, storyPoints a number, dueDate as YYYY-MM-DD.",
        parameters: {
          type: "OBJECT",
          properties: {
            projectId: { type: "STRING" },
            title: { type: "STRING" },
            description: { type: "STRING" },
            assigneeId: { type: "STRING" },
            type: { type: "STRING" },
            status: { type: "STRING" },
            priority: { type: "STRING" },
            storyPoints: { type: "NUMBER" },
            dueDate: { type: "STRING" },
          },
          required: ["projectId", "title"],
        },
      },
      {
        name: "assign_task",
        description:
          "Assign an existing task to a team member by user id. Returns ok.",
        parameters: {
          type: "OBJECT",
          properties: {
            taskId: { type: "STRING" },
            userId: { type: "STRING" },
          },
          required: ["taskId", "userId"],
        },
      },
    ],
  },
];

const TOOL_NAMES = TOOLS[0].functionDeclarations.map((t) => t.name);

/* ── System prompt ─────────────────────────────────────────────── */

const SYSTEM_PROMPT = `You are AIE Agent, the AI operations agent inside AIE (Agile Intelligence Engine).

You do not just advise — you ACT. You have real tools that create projects, add members, and create and assign tasks in the user's workspace.

Rules:
- When the user asks you to create, add, assign, or set up something, DO IT with the tools. Do not ask for permission for reasonable requests; do not produce hypothetical examples.
- Resolve people by name: call list_team_members first, match on name or email (case-insensitive, forgiving of partial matches). Never invent user ids.
- After creating a project, report what you did in one short line, e.g. "Created project Apollo (high priority, due 2026-12-15)".
- When asked to pick people "by performance", call list_team_members and rank by completed story points, then completed tasks; say what you ranked on.
- If a request is ambiguous on a critical detail (e.g. which project, or two people share a name), ask ONE short clarifying question instead of guessing.
- Dates: today is ${new Date().toISOString().slice(0, 10)}. endDate uses YYYY-MM-DD.
- If a tool result contains "error", explain the failure honestly and do not pretend it succeeded.
- When no tool is needed (agile advice, metrics questions), just answer directly and concisely.`;

/* ── Gemini call with model fallback ───────────────────────────── */

async function callGemini(
  apiKey: string,
  contents: GeminiContent[]
): Promise<any> {
  for (const model of MODELS) {
    for (let attempt = 0; attempt < 2; attempt += 1) {
      try {
        const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;
        const response = await fetch(url, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            contents,
            tools: TOOLS,
            systemInstruction: { parts: [{ text: SYSTEM_PROMPT }] },
            generationConfig: { maxOutputTokens: 2048, temperature: 0.4 },
          }),
        });

        if (response.status === 503 || response.status === 429) {
          await new Promise((r) => setTimeout(r, 1000 * (attempt + 1)));
          continue;
        }
        if (!response.ok) {
          const errText = await response.text();
          throw new Error(
            `Gemini API error: ${response.status} - ${errText.slice(0, 200)}`
          );
        }
        return await response.json();
      } catch (err) {
        if (attempt === 1) {
          if (model === MODELS[MODELS.length - 1]) throw err;
          break; // move to the next model
        }
        await new Promise((r) => setTimeout(r, 800));
      }
    }
  }
  throw new Error("All Gemini models are temporarily unavailable.");
}

/* ── Main action ───────────────────────────────────────────────── */

/** Shape of every agent response, for both the loop and its public wrapper. */
export interface AgentReply {
  reply: string;
  actions: string[];
}

/**
 * The agentic loop. Internal, and invoked only through the authenticated
 * `chat` wrapper at the bottom of this file — the client never gets a handle
 * to the raw model loop.
 */
export const agentLoop = internalAction({
  args: {
    messages: v.array(
      v.object({
        role: v.union(v.literal("user"), v.literal("assistant")),
        content: v.string(),
      })
    ),
  },
  handler: async (ctx, args): Promise<AgentReply> => {
    const apiKey = process.env.GOOGLE_AI_API_KEY;
    if (!apiKey) {
      return {
        reply:
          "GOOGLE_AI_API_KEY is not configured. Add it in Convex Settings → Environment Variables, then try again.",
        actions: [] as string[],
      };
    }

    const contents: GeminiContent[] = [];
    for (const m of args.messages) {
      contents.push({
        role: m.role === "user" ? "user" : "model",
        parts: [{ text: m.content }],
      });
    }

    const actions: string[] = [];

    for (let step = 0; step < MAX_STEPS; step += 1) {
      let data: any;
      try {
        data = await callGemini(apiKey, contents);
      } catch (err: any) {
        return {
          reply:
            actions.length > 0
              ? `${actions.join(" ")} (I hit an API error before I could summarise: ${String(err?.message ?? err).slice(0, 200)})`
              : `I hit an error talking to the model: ${String(err?.message ?? err).slice(0, 300)}`,
          actions,
        };
      }

      const candidate = data.candidates?.[0];
      const parts: GeminiPart[] = candidate?.content?.parts ?? [];

      const calls: ToolCall[] = [];
      let text = "";
      for (const part of parts) {
        if (part.functionCall) {
          calls.push({
            name: part.functionCall.name,
            args: part.functionCall.args ?? {},
          });
        } else if (typeof part.text === "string") {
          text += part.text;
        }
      }

      if (calls.length === 0) {
        return { reply: text.trim() || "Done.", actions };
      }

      // Record + execute each tool call, then feed results back.
      contents.push({ role: "model", parts });
      const responseParts: GeminiPart[] = [];
      for (const call of calls) {
        if (!TOOL_NAMES.includes(call.name)) {
          responseParts.push({
            functionResponse: {
              name: call.name,
              response: { error: `Unknown tool ${call.name}` },
            },
          });
          continue;
        }
        let response: Record<string, unknown>;
        try {
          response = await runTool(ctx, call.name, call.args);
        } catch (err: any) {
          response = { error: String(err?.message ?? err).slice(0, 300) };
        }
        actions.push(describeAction(call.name, call.args, response));
        responseParts.push({
          functionResponse: { name: call.name, response },
        });
      }
      contents.push({ role: "user", parts: responseParts });
    }

    return {
      reply:
        actions.length > 0
          ? `${actions.join(" ")} (I stopped there — ask me to continue if anything is missing.)`
          : "I worked through several steps without a final answer. Could you rephrase that?",
      actions,
    };
  },
});

/* ── Tool execution: model names → internal functions ──────────── */

async function runTool(
  ctx: any,
  name: string,
  args: Record<string, unknown>
): Promise<Record<string, unknown>> {
  switch (name) {
    case "list_projects": {
      const projects = await ctx.runQuery(internal.agentTools.listProjects, {});
      return { projects };
    }
    case "list_team_members": {
      const members = await ctx.runQuery(internal.agentTools.listTeam, {});
      return { members };
    }
    case "get_member_performance": {
      const perf = await ctx.runQuery(internal.agentTools.memberPerformance, {
        userId: String(args.userId),
      });
      return perf ?? { error: "Unknown userId" };
    }
    case "create_project": {
      const projectId = await ctx.runMutation(
        internal.agentTools.createProject,
        {
          name: String(args.name),
          description: args.description ? String(args.description) : undefined,
          status: normalizeEnum(
            args.status,
            ["active", "completed", "on-hold", "planning"],
            "planning"
          ),
          priority: normalizeEnum(
            args.priority,
            ["low", "medium", "high", "critical"],
            "medium"
          ),
          endDate: args.endDate ? String(args.endDate) : undefined,
        }
      );
      return { ok: true, projectId };
    }
    case "add_project_member": {
      return await ctx.runMutation(internal.agentTools.addMember, {
        projectId: String(args.projectId),
        userId: String(args.userId),
        role: args.role ? String(args.role) : undefined,
      });
    }
    case "create_task": {
      const taskId = await ctx.runMutation(internal.agentTools.createTask, {
        projectId: String(args.projectId),
        title: String(args.title),
        description: args.description ? String(args.description) : undefined,
        assigneeId: args.assigneeId ? String(args.assigneeId) : undefined,
        type: normalizeEnum(args.type, ["task", "bug", "subtask"], "task"),
        status: normalizeEnum(
          args.status,
          ["todo", "in-progress", "review", "done"],
          "todo"
        ),
        priority: normalizeEnum(
          args.priority,
          ["low", "medium", "high", "critical"],
          "medium"
        ),
        storyPoints:
          typeof args.storyPoints === "number" ? args.storyPoints : undefined,
        dueDate: args.dueDate ? String(args.dueDate) : undefined,
      });
      return { ok: true, taskId };
    }
    case "assign_task": {
      return await ctx.runMutation(internal.agentTools.assignTask, {
        taskId: String(args.taskId),
        userId: String(args.userId),
      });
    }
    default:
      return { error: `Unknown tool ${name}` };
  }
}

function normalizeEnum(
  value: unknown,
  allowed: string[],
  fallback: string
): string {
  const s = String(value ?? "").toLowerCase().trim();
  return allowed.includes(s) ? s : fallback;
}

function describeAction(
  name: string,
  args: Record<string, unknown>,
  response: Record<string, unknown>
): string {
  const failed = typeof response.error === "string";
  switch (name) {
    case "create_project":
      return failed
        ? `Failed to create project "${args.name}".`
        : `Created project "${args.name}".`;
    case "add_project_member":
      return failed
        ? `Failed to add member: ${response.error}`
        : response.skipped
          ? `${response.userName ?? "Member"} is already on the project.`
          : `Added ${response.userName ?? "member"} to the project.`;
    case "create_task":
      return failed
        ? `Failed to create task "${args.title}".`
        : `Created task "${args.title}".`;
    case "assign_task":
      return failed
        ? `Failed to assign task: ${response.error}`
        : `Assigned ${response.userName ?? "member"} to "${response.taskTitle ?? "task"}".`;
    default:
      return `${name} done.`;
  }
}

/**
 * Browser-facing entry point. Internal actions are not callable from the
 * client, so this authenticated action forwards to the loop; the auth context
 * flows through runAction into the internal queries/mutations in agentTools,
 * and every write is attributed to the signed-in user.
 */
export const chat = action({
  args: {
    messages: v.array(
      v.object({
        role: v.union(v.literal("user"), v.literal("assistant")),
        content: v.string(),
      })
    ),
  },
  handler: async (ctx, args): Promise<AgentReply> => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Not authenticated");
    return await ctx.runAction(internal.agent.agentLoop, {
      messages: args.messages,
    });
  },
});
