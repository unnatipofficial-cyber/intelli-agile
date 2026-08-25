"use node";

import { action } from "./_generated/server";
import { v } from "convex/values";

function getAnthropicClient() {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    return null;
  }
  // Dynamic import so the module doesn't crash when the key is absent
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const Anthropic = require("@anthropic-ai/sdk").default;
  return new Anthropic({ apiKey });
}

export const generateInsights = action({
  args: {
    projectData: v.string(),
  },
  handler: async (ctx, args) => {
    const anthropic = getAnthropicClient();
    if (!anthropic) {
      return JSON.stringify([
        {
          severity: "medium",
          title: "AI Insights Unavailable",
          description:
            "ANTHROPIC_API_KEY is not configured. Add it in your Convex dashboard under Settings → Environment Variables.",
          recommendedAction:
            "Add ANTHROPIC_API_KEY to your Convex environment variables to enable AI-powered insights.",
          category: "sprint",
        },
      ]);
    }

    const response = await anthropic.messages.create({
      model: "claude-sonnet-4-20250514",
      max_tokens: 2048,
      messages: [
        {
          role: "user",
          content: `You are AIE (Agile Intelligence Engine), an expert Agile project analyst. Analyze the following project data and provide 3-6 actionable insights.

For each insight, respond with a JSON array of objects, each with:
- "severity": "critical" | "high" | "medium" | "low"
- "title": Short headline (max 60 chars)
- "description": One sentence explaining the situation
- "recommendedAction": One specific action the team should take
- "category": "sprint" | "workload" | "velocity" | "risk" | "deadline"

Respond ONLY with valid JSON array. No markdown, no explanation text.

Project Data:
${args.projectData}`,
        },
      ],
    });

    const text =
      response.content[0].type === "text" ? response.content[0].text : "[]";

    try {
      const cleaned = text
        .replace(/```json?\n?/g, "")
        .replace(/```\n?/g, "")
        .trim();
      const insights = JSON.parse(cleaned);
      return JSON.stringify(insights);
    } catch {
      return JSON.stringify([
        {
          severity: "medium",
          title: "AIE Analysis",
          description: text.slice(0, 300),
          recommendedAction:
            "Review the analysis above and discuss with your team.",
          category: "sprint",
        },
      ]);
    }
  },
});

export const generateSprintSummary = action({
  args: {
    sprintName: v.string(),
    taskSummary: v.string(),
  },
  handler: async (ctx, args) => {
    const anthropic = getAnthropicClient();
    if (!anthropic) {
      return "AI summary unavailable — ANTHROPIC_API_KEY is not configured.";
    }

    const response = await anthropic.messages.create({
      model: "claude-sonnet-4-20250514",
      max_tokens: 1024,
      messages: [
        {
          role: "user",
          content: `You are AIE, an expert Agile analyst. Write a concise sprint summary (2-4 sentences) for "${args.sprintName}" based on this data:\n\n${args.taskSummary}\n\nFocus on: progress, risks, and what to watch next. Be direct and professional.`,
        },
      ],
    });

    return response.content[0].type === "text"
      ? response.content[0].text
      : "Summary unavailable.";
  },
});

export const chat = action({
  args: {
    messages: v.array(
      v.object({
        role: v.union(v.literal("user"), v.literal("assistant")),
        content: v.string(),
      })
    ),
    projectContext: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const anthropic = getAnthropicClient();
    if (!anthropic) {
      return "I am unable to respond right now. ANTHROPIC_API_KEY is not configured.\n\nTo enable the AI assistant:\n1. Get an API key from https://console.anthropic.com/settings/keys\n2. Add ANTHROPIC_API_KEY in your Convex dashboard under Settings → Environment Variables\n3. The AI chat will start working immediately after the key is set.";
    }

    const systemPrompt = `You are AIE Assistant, an expert AI assistant built into the AIE (Agile Intelligence Engine) platform. You help software teams with Agile project management.

You can help with:
- Sprint planning and management advice
- Task prioritization and estimation
- Risk assessment and mitigation strategies
- Team workload balancing
- Agile best practices and methodology
- Interpreting project metrics and analytics
- Writing user stories and acceptance criteria
- Retrospective facilitation

Be concise, professional, and actionable. Use bullet points for lists. When referring to data, be specific.
${args.projectContext ? `\nCurrent project context:\n${args.projectContext}` : ""}`;

    const messages = args.messages.map((m) => ({
      role: m.role as "user" | "assistant",
      content: m.content,
    }));

    const response = await anthropic.messages.create({
      model: "claude-sonnet-4-20250514",
      max_tokens: 2048,
      system: systemPrompt,
      messages,
    });

    return response.content[0].type === "text"
      ? response.content[0].text
      : "I apologize, but I encountered an issue processing your request.";
  },
});
