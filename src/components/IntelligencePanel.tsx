import { motion } from "framer-motion";
import { staggeredEnter } from "@/lib/motion";
import {
  Brain,
  RefreshCw,
  ArrowRight,
  CheckCircle2,
  AlertTriangle,
  Timer,
  TrendingUp,
  Lightbulb,
} from "lucide-react";
import {
  useIntelligence,
  type IntelligenceKind,
} from "@/hooks/use-intelligence";
import { insightSeverityStyles } from "@/lib/badge-colors";
import { openAgent } from "@/lib/aie-bus";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";

const METRIC_TONE: Record<string, string> = {
  good: "text-emerald-500",
  warn: "text-amber-500",
  bad: "text-destructive",
  neutral: "text-foreground",
};

const SEVERITY_ICONS: Record<string, any> = {
  critical: AlertTriangle,
  high: TrendingUp,
  medium: Timer,
  low: CheckCircle2,
};

function relativeAge(timestamp: number | null): string {
  if (!timestamp) return "";
  const mins = Math.round((Date.now() - timestamp) / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.round(mins / 60);
  return hours < 24 ? `${hours}h ago` : `${Math.round(hours / 24)}d ago`;
}

interface IntelligencePanelProps {
  kind: IntelligenceKind;
  projectId?: string;
  /** Hides the scope line for contexts where it would be redundant. */
  hideScope?: boolean;
  className?: string;
}

/**
 * The intelligence panel that sits at the top of a page: live metrics, the
 * things worth worrying about, an AI read-out of both, and concrete next
 * actions. Numbers come from the database; the prose is written by the agent
 * and degrades to a factual summary if the model is unavailable.
 */
export default function IntelligencePanel({
  kind,
  projectId,
  hideScope,
  className,
}: IntelligencePanelProps) {
  const { facts, narrative, generatedAt, isNarrating, refresh } = useIntelligence(
    kind,
    projectId
  );

  const metrics = facts?.metrics ?? [];
  const flags = facts?.flags ?? [];
  const suggestions = facts?.suggestions ?? [];

  return (
    <div className={cn("glass-card p-5 aie-glow relative overflow-hidden", className)}>
      <div className="absolute inset-0 bg-gradient-to-br from-primary/5 via-transparent to-transparent pointer-events-none" />

      <div className="relative">
        {/* Header */}
        <div className="flex items-center gap-3 mb-4">
          <div className="w-9 h-9 rounded-xl aie-gradient flex items-center justify-center shadow-sm">
            <Brain className="w-5 h-5 text-white" />
          </div>
          <div className="min-w-0">
            <h3 className="text-sm font-bold tracking-tight">AIE Intelligence</h3>
            <p className="text-xs text-muted-foreground truncate">
              {hideScope
                ? "Live read on your workspace"
                : facts?.scope
                  ? `Live read on ${facts.scope}`
                  : "Reading the workspace…"}
            </p>
          </div>
          <Button
            size="sm"
            variant="outline"
            onClick={refresh}
            disabled={isNarrating}
            aria-label="Refresh intelligence"
            className="ml-auto h-7 text-[10px] gap-1.5 border-primary/20 hover:bg-primary/5 shrink-0"
          >
            <RefreshCw className={cn("w-3 h-3", isNarrating && "animate-spin")} />
            {isNarrating ? "Thinking" : "Refresh"}
          </Button>
        </div>

        {/* AI read-out */}
        {narrative ? (
          <motion.p
            initial={{ opacity: 0, y: 4 }}
            animate={{ opacity: 1, y: 0 }}
            className="text-sm leading-relaxed mb-4"
          >
            {narrative}
          </motion.p>
        ) : (
          <div className="space-y-2 mb-4">
            <div className="h-4 rounded bg-muted/50 animate-pulse" />
            <div className="h-4 w-3/4 rounded bg-muted/50 animate-pulse" />
          </div>
        )}

        {/* Metrics */}
        {metrics.length > 0 && (
          <div className="grid grid-cols-3 gap-2 mb-4">
            {metrics.map((metric) => (
              <div
                key={metric.label}
                className="rounded-lg border border-border/50 bg-background/40 px-2.5 py-2 min-w-0"
              >
                <p className="text-[10px] uppercase tracking-wider text-muted-foreground truncate">
                  {metric.label}
                </p>
                <p
                  className={cn(
                    "text-lg font-bold tabular-nums leading-tight truncate",
                    METRIC_TONE[metric.tone ?? "neutral"]
                  )}
                >
                  {metric.value}
                </p>
              </div>
            ))}
          </div>
        )}

        {/* Flags */}
        {flags.length > 0 && (
          <div className="space-y-2 mb-4">
            {flags.slice(0, 4).map((flag, i) => {
              const sev = insightSeverityStyles[flag.tone] ?? insightSeverityStyles.medium;
              const Icon = SEVERITY_ICONS[flag.tone] ?? Timer;
              return (
                <motion.div
                  key={`${flag.title}-${i}`}
                  initial={{ opacity: 0, x: -6 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={staggeredEnter(i)}
                  className="rounded-lg border p-3"
                  style={{ backgroundColor: sev.bg, borderColor: sev.border }}
                >
                  <div className="flex items-start gap-2.5">
                    <Icon className="w-4 h-4 mt-0.5 shrink-0" style={{ color: sev.text }} />
                    <div className="min-w-0">
                      <p className="text-xs font-semibold leading-snug">{flag.title}</p>
                      <p className="text-[11px] text-muted-foreground leading-relaxed mt-0.5">
                        {flag.detail}
                      </p>
                    </div>
                  </div>
                </motion.div>
              );
            })}
          </div>
        )}

        {/* Next actions */}
        {suggestions.length > 0 && (
          <div className="pt-3 border-t border-border/50">
            <div className="flex items-center gap-1.5 mb-2">
              <Lightbulb className="w-3.5 h-3.5 text-primary" />
              <span className="text-[11px] font-bold tracking-tight">Next</span>
            </div>
            <ul className="space-y-1.5">
              {suggestions.slice(0, 3).map((suggestion, i) => (
                <li key={i} className="flex items-start gap-1.5">
                  <ArrowRight className="w-3 h-3 mt-1 shrink-0 text-primary" />
                  <button
                    type="button"
                    onClick={() => openAgent(suggestion)}
                    title="Ask the AIE Agent to do this"
                    className="text-left text-[11px] text-muted-foreground leading-relaxed hover:text-foreground hover:underline underline-offset-2 transition-colors"
                  >
                    {suggestion}
                  </button>
                </li>
              ))}
            </ul>
          </div>
        )}

        {generatedAt && (
          <p className="mt-3 text-[10px] text-muted-foreground/70">
            Updated {relativeAge(generatedAt)}
          </p>
        )}
      </div>
    </div>
  );
}