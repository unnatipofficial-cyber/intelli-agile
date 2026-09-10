"use node";

import { action } from "./_generated/server";
import { v } from "convex/values";

function getGeminiClient() {
  const apiKey = process.env.GOOGLE_AI_API_KEY;
  if (!apiKey) {
    return null;
  }
  const { GoogleGenerativeAI } = require("@google/generative-ai");
  return new GoogleGenerativeAI(apiKey);
}

export const generateInsights = action({
  args: {
    projectData: v.string(),
  },
  handler: async (ctx, args) => {
    const genAI = getGeminiClient();
    if (!genAI) {
      return JSON.stringify([
        {
          severity: "medium",
          title: "AI Insights Unavailable",
          description:
            "GOOGLE_AI_API_KEY is not configured. Add it in your Convex dashboard under Settings → Environment Variables.",
          recommendedAction:
            "Add GOOGLE_AI_API_KEY to your Convex environment variables to enable AI-powered insights.",
          category: "sprint",
        },
      ]);
    }

    const model = genAI.getGenerativeModel({ model: "gemini-2.0-flash" });

    const result = await model.generateContent(
      `You are AIE (Agile Intelligence Engine), an expert Agile project analyst. Analyze the following project data and provide 3-6 actionable insights.

For each insight, respond with a JSON array of objects, each with:
- "severity": "critical" | "high" | "medium" | "low"
- "title": Short headline (max 60 chars)
- "description": One sentence explaining the situation
- "recommendedAction": One specific action the team should take
- "category": "sprint" | "workload" | "velocity" | "risk" | "deadline"

Respond ONLY with valid JSON array. No markdown, no explanation text.

Project Data:
${args.projectData}`
    );

    const text = result.response.text();

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
    const genAI = getGeminiClient();
    if (!genAI) {
      return "AI summary unavailable — GOOGLE_AI_API_KEY is not configured.";
    }

    const model = genAI.getGenerativeModel({ model: "gemini-2.0-flash" });

    const result = await model.generateContent(
      `You are AIE, an expert Agile analyst. Write a concise sprint summary (2-4 sentences) for "${args.sprintName}" based on this data:\n\n${args.taskSummary}\n\nFocus on: progress, risks, and what to watch next. Be direct and professional.`
    );

    return result.response.text();
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
    const genAI = getGeminiClient();
    if (!genAI) {
      return "I am unable to respond right now. GOOGLE_AI_API_KEY is not configured.\n\nTo enable the AI assistant:\n1. Get an API key from https://aistudio.google.com/apikey\n2. Add GOOGLE_AI_API_KEY in your Convex dashboard under Settings → Environment Variables\n3. The AI chat will start working immediately after the key is set.";
    }

    const model = genAI.getGenerativeModel({ model: "gemini-2.0-flash" });

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

    // Build conversation history
    const history = args.messages.slice(0, -1).map((m) => ({
      role: m.role === "assistant" ? "model" : "user",
      parts: [{ text: m.content }],
    }));

    const chat = model.startChat({
      history,
      generationConfig: {
        maxOutputTokens: 2048,
      },
    });

    const lastMessage = args.messages[args.messages.length - 1];
    const result = await chat.sendMessage(lastMessage.content);

    return result.response.text();
  },
});
