import { useState, useRef, useEffect } from "react";
import { useAction, useQuery } from "convex/react";
import { useNavigate } from "react-router";
import { api } from "../convex/_generated/api";
import { motion, AnimatePresence } from "framer-motion";
import { cn } from "@/lib/utils";
import { AGENT_OPEN_EVENT, type OpenAgentDetail } from "@/lib/aie-bus";
import { useTheme, type AppTheme, type ThemeMode } from "@/hooks/use-theme";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  X,
  Send,
  Loader2,
  Bot,
  User,
  CheckCircle2,
  AlertCircle,
  Sparkles,
} from "lucide-react";

interface AgentAction {
  tool: string;
  label: string;
  ok: boolean;
}

/** Instructions the agent hands to the browser — theme, navigation. */
interface ClientAction {
  type: "set_theme" | "open_page";
  mode?: ThemeMode;
  appTheme?: AppTheme;
  path?: string;
  label: string;
}

interface Message {
  role: "user" | "assistant";
  content: string;
  /** Present on agent messages: what it actually did in the workspace. */
  actions?: AgentAction[];
}

const THINKING_LINES = [
  "Reading the board…",
  "Checking the backlog…",
  "Matching names…",
  "Working on it…",
];

const SUGGESTED_PROMPTS = [
  "Create a project called Apollo, high priority, due Dec 15",
  "Add Dana Reyes to the team as a QA lead, and put her on Apollo",
  "Every weekday at 9am, tell me what's at risk across my projects",
  "Who's doing the best this sprint?",
  "How's Apollo going — what should I worry about?",
  "Log a high risk: vendor API delay",
];

export default function AIChat() {
  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState<Message[]>([
    {
      role: "assistant",
      content:
        "I'm the AIE Agent — I act, I don't just advise. I can create projects, add and remove people (including brand-new team members), plan sprints, epics, stories and tasks, assign work, log time, manage risks and answer questions about the board. I can also run on a timer — say \"every weekday at 9am tell me what's at risk\" and I'll check in with you. Typos are fine — I'll work out what you meant.",
    },
  ]);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const [thinkingIndex, setThinkingIndex] = useState(0);
  // The id of the in-flight run; progress events are tagged with it and the
  // agent writes them as it works, so the panel can stream the answer and show
  // each tool as it runs instead of a blanket spinner.
  const [runId, setRunId] = useState<string | null>(null);
  const chatAction = useAction(api.agent.chat);
  const liveEvents = useQuery(
    api.agentStream.events,
    runId ? { runId } : "skip"
  );
  const navigate = useNavigate();
  const { theme, setAppTheme, toggleTheme } = useTheme();

  const liveToolEvents = (liveEvents ?? []).filter((e) => e.type === "tool");
  const liveText = (liveEvents ?? [])
    .filter((e) => e.type === "token")
    .map((e) => e.text ?? "")
    .join("");

  /** Applies the browser-side half of a reply: theme switches and navigation. */
  const applyClientActions = (incoming: ClientAction[]) => {
    for (const action of incoming ?? []) {
      if (action.type === "set_theme") {
        if (action.appTheme) setAppTheme(action.appTheme);
        // Mode is binary in the provider, so flipping is the only move.
        if (action.mode && action.mode !== theme) toggleTheme();
      } else if (action.type === "open_page" && action.path) {
        navigate(action.path);
      }
    }
  };

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, isLoading]);

  useEffect(() => {
    if (isOpen) {
      setTimeout(() => inputRef.current?.focus(), 100);
    }
  }, [isOpen]);

  // Rotate the status line while the agent works, so a long tool chain
  // (create project -> add members -> create tasks) doesn't look frozen.
  useEffect(() => {
    if (!isLoading) {
      setThinkingIndex(0);
      return;
    }
    const timer = setInterval(
      () => setThinkingIndex((i) => (i + 1) % THINKING_LINES.length),
      2200
    );
    return () => clearInterval(timer);
  }, [isLoading]);

  const sendMessage = async (text?: string) => {
    const content = text || input.trim();
    if (!content || isLoading) return;

    const userMessage: Message = { role: "user", content };
    const updatedMessages = [...messages, userMessage];
    setMessages(updatedMessages);
    setInput("");
    setIsLoading(true);

    const nextRunId =
      typeof crypto !== "undefined" && "randomUUID" in crypto
        ? crypto.randomUUID()
        : `run-${Date.now()}-${Math.random().toString(36).slice(2)}`;
    setRunId(nextRunId);

    try {
      // History is trimmed to the last 12 turns: enough continuity for the
      // agent to resolve "that project", without ballooning the prompt.
      const response = await chatAction({
        messages: updatedMessages.slice(-12).map((m) => ({
          role: m.role,
          content: m.content,
        })),
        runId: nextRunId,
      });

      setMessages([
        ...updatedMessages,
        {
          role: "assistant",
          content: response.reply,
          actions: response.actions.length > 0 ? response.actions : undefined,
        },
      ]);
      applyClientActions(response.clientActions as ClientAction[]);
    } catch (err) {
      console.error("Chat error:", err);
      setMessages([
        ...updatedMessages,
        {
          role: "assistant",
          content:
            "I ran into an error reaching the model. Please try again in a moment.",
        },
      ]);
    }
    setRunId(null);
    setIsLoading(false);
  };

  // Kept in a ref so the event listener can stay registered once while still
  // calling the latest handler (which closes over current isLoading/input).
  const sendRef = useRef(sendMessage);
  useEffect(() => {
    sendRef.current = sendMessage;
  });

  // Pages hand work to the agent through a custom event rather than shared
  // context — e.g. clicking a recommendation in the intelligence panel.
  useEffect(() => {
    const handleOpen = (event: Event) => {
      const detail = (event as CustomEvent<OpenAgentDetail>).detail;
      setIsOpen(true);
      if (detail?.prompt) {
        setTimeout(() => sendRef.current(detail.prompt), 120);
      }
    };
    window.addEventListener(AGENT_OPEN_EVENT, handleOpen);
    return () => window.removeEventListener(AGENT_OPEN_EVENT, handleOpen);
  }, []);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  return (
    <>
      {/* Floating trigger button */}
      <AnimatePresence>
        {!isOpen && (
          <motion.button
            initial={{ scale: 0, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0, opacity: 0 }}
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            onClick={() => setIsOpen(true)}
            aria-label="Open the AIE Agent"
            className="fixed bottom-28 right-4 md:bottom-8 md:right-6 z-40 w-12 h-12 rounded-full bg-primary text-primary-foreground shadow-lg flex items-center justify-center hover:bg-primary/90 transition-colors"
          >
            <Bot className="w-5 h-5" />
          </motion.button>
        )}
      </AnimatePresence>

      {/* Chat panel */}
      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, y: 20, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 20, scale: 0.95 }}
            transition={{ type: "spring", damping: 25, stiffness: 300 }}
            className="fixed bottom-28 right-4 md:bottom-8 md:right-6 z-40 w-[calc(100vw-2rem)] max-w-[400px] h-[560px] max-h-[75vh] rounded-2xl shadow-2xl border border-border/50 bg-background flex flex-col overflow-hidden"
          >
            {/* Header */}
            <div className="flex items-center justify-between px-4 py-3 border-b border-border/50 bg-background">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center">
                  <Bot className="w-4 h-4 text-primary" />
                </div>
                <div>
                  <p className="text-sm font-semibold">AIE Agent</p>
                  <p className="text-[10px] text-muted-foreground">
                    Can build, assign, analyse — typos welcome
                  </p>
                </div>
              </div>
              <Button
                variant="ghost"
                size="icon"
                className="w-8 h-8"
                onClick={() => setIsOpen(false)}
                aria-label="Close the agent"
              >
                <X className="w-4 h-4" />
              </Button>
            </div>

            {/* Messages */}
            <div className="flex-1 overflow-y-auto px-4 py-3 space-y-3">
              {messages.map((msg, i) => (
                <div
                  key={i}
                  className={cn(
                    "flex gap-2",
                    msg.role === "user" ? "justify-end" : "justify-start"
                  )}
                >
                  {msg.role === "assistant" && (
                    <div className="w-6 h-6 rounded-full bg-primary/10 flex items-center justify-center shrink-0 mt-0.5">
                      <Bot className="w-3 h-3 text-primary" />
                    </div>
                  )}
                  <div
                    className={cn(
                      "max-w-[85%] rounded-xl px-3 py-2 text-sm leading-relaxed",
                      msg.role === "user"
                        ? "bg-primary text-primary-foreground rounded-br-sm"
                        : "bg-muted/60 text-foreground rounded-bl-sm"
                    )}
                  >
                    {msg.content.split("\n").map((line, j) => {
                      if (!line.trim()) return null;
                      const isBullet = /^\s*[-*•]\s+/.test(line);
                      const text = line.replace(/^\s*[-*•]\s+/, "");
                      return (
                        <p
                          key={j}
                          className={cn(
                            j > 0 && "mt-1.5",
                            isBullet && "flex gap-1.5"
                          )}
                        >
                          {isBullet && (
                            <span className="mt-[7px] h-1 w-1 shrink-0 rounded-full bg-current opacity-60" />
                          )}
                          <span>{text}</span>
                        </p>
                      );
                    })}
                    {msg.actions && msg.actions.length > 0 && (
                      <div className="mt-2 pt-2 border-t border-border/40 space-y-1">
                        {msg.actions.map((action, k) => (
                          <p
                            key={k}
                            className={cn(
                              "flex items-start gap-1.5 text-[11px]",
                              action.ok
                                ? "text-muted-foreground"
                                : "text-amber-600 dark:text-amber-400"
                            )}
                          >
                            {action.ok ? (
                              <CheckCircle2 className="w-3 h-3 mt-0.5 shrink-0 text-emerald-500" />
                            ) : (
                              <AlertCircle className="w-3 h-3 mt-0.5 shrink-0" />
                            )}
                            {action.label}
                          </p>
                        ))}
                      </div>
                    )}
                  </div>
                  {msg.role === "user" && (
                    <div className="w-6 h-6 rounded-full bg-muted flex items-center justify-center shrink-0 mt-0.5">
                      <User className="w-3 h-3 text-muted-foreground" />
                    </div>
                  )}
                </div>
              ))}
              {isLoading && (
                <div className="flex gap-2 justify-start">
                  <div className="w-6 h-6 rounded-full bg-primary/10 flex items-center justify-center shrink-0 mt-0.5">
                    <Bot className="w-3 h-3 text-primary" />
                  </div>
                  <div className="max-w-[85%] bg-muted/60 rounded-xl rounded-bl-sm px-3 py-2 space-y-2">
                    {liveToolEvents.length > 0 && (
                      <div className="space-y-1">
                        {liveToolEvents.map((event, k) => (
                          <p
                            key={k}
                            className={cn(
                              "flex items-start gap-1.5 text-[11px]",
                              event.ok === false
                                ? "text-amber-600 dark:text-amber-400"
                                : "text-muted-foreground"
                            )}
                          >
                            {event.ok === false ? (
                              <AlertCircle className="w-3 h-3 mt-0.5 shrink-0" />
                            ) : (
                              <CheckCircle2 className="w-3 h-3 mt-0.5 shrink-0 text-emerald-500" />
                            )}
                            {event.label}
                          </p>
                        ))}
                      </div>
                    )}
                    {liveText ? (
                      <p className="text-sm leading-relaxed whitespace-pre-wrap">
                        {liveText}
                        <span className="ml-0.5 inline-block h-3.5 w-1.5 align-middle bg-foreground/60 animate-pulse" />
                      </p>
                    ) : (
                      <span className="flex items-center gap-2 text-xs text-muted-foreground">
                        <Loader2 className="w-3.5 h-3.5 animate-spin" />
                        {liveToolEvents.length > 0 ? "Working…" : THINKING_LINES[thinkingIndex]}
                      </span>
                    )}
                  </div>
                </div>
              )}
              <div ref={messagesEndRef} />
            </div>

            {/* Suggested prompts (shown when no messages besides greeting) */}
            {messages.length <= 1 && (
              <div className="px-4 pb-2">
                <p className="text-[10px] text-muted-foreground mb-2 flex items-center gap-1">
                  <Sparkles className="w-3 h-3" /> Try:
                </p>
                <div className="flex flex-wrap gap-1.5">
                  {SUGGESTED_PROMPTS.map((prompt) => (
                    <button
                      key={prompt}
                      onClick={() => sendMessage(prompt)}
                      className="text-[11px] px-2.5 py-1 rounded-full bg-muted/60 hover:bg-muted text-muted-foreground hover:text-foreground transition-colors text-left"
                    >
                      {prompt}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Input */}
            <div className="px-4 py-3 border-t border-border/50">
              <div className="flex gap-2">
                <Input
                  ref={inputRef}
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  onKeyDown={handleKeyDown}
                  placeholder="Create, assign, analyse… typos are fine"
                  disabled={isLoading}
                  className="flex-1"
                />
                <Button
                  size="icon"
                  onClick={() => sendMessage()}
                  disabled={!input.trim() || isLoading}
                  className="w-9 h-9 shrink-0"
                  aria-label="Send message"
                >
                  {isLoading ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <Send className="w-4 h-4" />
                  )}
                </Button>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
