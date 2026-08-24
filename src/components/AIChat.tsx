import { useState, useRef, useEffect } from "react";
import { useAction, useQuery } from "convex/react";
import { api } from "../convex/_generated/api";
import { motion, AnimatePresence } from "framer-motion";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { MessageCircle, X, Send, Loader2, Bot, User } from "lucide-react";

interface Message {
  role: "user" | "assistant";
  content: string;
}

const SUGGESTED_PROMPTS = [
  "How should I prioritize tasks for this sprint?",
  "What's the best way to handle an overloaded team member?",
  "Help me write a user story for a new feature",
  "What Agile metrics should I track?",
  "How do I run an effective sprint retrospective?",
];

export default function AIChat() {
  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState<Message[]>([
    {
      role: "assistant",
      content:
        "Hello! I am the AIE Assistant. I can help you with sprint planning, task prioritization, risk assessment, Agile best practices, and more. How can I help you today?",
    },
  ]);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const chatAction = useAction(api.ai.chat);
  const projects = useQuery(api.projects.list);
  const activeSprint = useQuery(
    api.sprints.getActive,
    projects && projects.length > 0
      ? { projectId: projects[0]._id }
      : "skip"
  );

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  useEffect(() => {
    if (isOpen) {
      setTimeout(() => inputRef.current?.focus(), 100);
    }
  }, [isOpen]);

  const buildContext = (): string => {
    if (!projects || projects.length === 0) return "";
    const project = projects[0];
    const parts = [`Project: ${project.name} (${project.status})`];
    if (activeSprint) {
      parts.push(
        `Active Sprint: ${activeSprint.name} — ${activeSprint.completedPoints}/${activeSprint.totalPoints} story points completed`
      );
    }
    parts.push(`${project.taskCount || 0} tasks across ${project.sprintCount || 0} sprints`);
    return parts.join("\n");
  };

  const sendMessage = async (text?: string) => {
    const content = text || input.trim();
    if (!content || isLoading) return;

    const userMessage: Message = { role: "user", content };
    const updatedMessages = [...messages, userMessage];
    setMessages(updatedMessages);
    setInput("");
    setIsLoading(true);

    try {
      const context = buildContext();
      const response = await chatAction({
        messages: updatedMessages.map((m) => ({
          role: m.role,
          content: m.content,
        })),
        projectContext: context || undefined,
      });
      setMessages([...updatedMessages, { role: "assistant", content: response }]);
    } catch (err) {
      console.error("Chat error:", err);
      setMessages([
        ...updatedMessages,
        {
          role: "assistant",
          content: "I am unable to respond right now. Please make sure the ANTHROPIC_API_KEY is configured in your Convex dashboard under Settings → Environment Variables.",
        },
      ]);
    }
    setIsLoading(false);
  };

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
            className="fixed bottom-28 right-4 md:bottom-8 md:right-6 z-40 w-[calc(100vw-2rem)] max-w-[400px] h-[500px] max-h-[70vh] rounded-2xl shadow-2xl border border-border/50 bg-background flex flex-col overflow-hidden"
          >
            {/* Header */}
            <div className="flex items-center justify-between px-4 py-3 border-b border-border/50 bg-background">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center">
                  <Bot className="w-4 h-4 text-primary" />
                </div>
                <div>
                  <p className="text-sm font-semibold">AIE Assistant</p>
                  <p className="text-[10px] text-muted-foreground">Powered by Claude AI</p>
                </div>
              </div>
              <Button
                variant="ghost"
                size="icon"
                className="w-8 h-8"
                onClick={() => setIsOpen(false)}
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
                    {msg.content.split("\n").map((line, j) => (
                      <p key={j} className={j > 0 ? "mt-1.5" : ""}>
                        {line}
                      </p>
                    ))}
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
                  <div className="bg-muted/60 rounded-xl rounded-bl-sm px-3 py-2">
                    <Loader2 className="w-4 h-4 animate-spin text-muted-foreground" />
                  </div>
                </div>
              )}
              <div ref={messagesEndRef} />
            </div>

            {/* Suggested prompts (shown when no messages besides greeting) */}
            {messages.length <= 1 && (
              <div className="px-4 pb-2">
                <p className="text-[10px] text-muted-foreground mb-2">Suggested:</p>
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
                  placeholder="Ask about Agile, sprints, tasks..."
                  disabled={isLoading}
                  className="flex-1"
                />
                <Button
                  size="icon"
                  onClick={() => sendMessage()}
                  disabled={!input.trim() || isLoading}
                  className="w-9 h-9 shrink-0"
                >
                  <Send className="w-4 h-4" />
                </Button>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
