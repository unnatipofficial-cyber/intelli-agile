import { useQuery } from "convex/react";
import { api } from "../convex/_generated/api";
import { Id } from "../convex/_generated/dataModel";
import { motion } from "framer-motion";
import { staggeredEnter } from "@/lib/motion";
import {
  MessageSquare,
  PlusCircle,
  CheckCircle,
  ArrowRight,
  Trash2,
  Clock,
  AlertTriangle,
  FileText,
  Users,
  RefreshCw,
} from "lucide-react";

const actionIcons: Record<string, { icon: React.ReactNode; color: string }> = {
  created: { icon: <PlusCircle className="w-3.5 h-3.5" />, color: "text-emerald-500" },
  "moved to": { icon: <ArrowRight className="w-3.5 h-3.5" />, color: "text-blue-500" },
  completed: { icon: <CheckCircle className="w-3.5 h-3.5" />, color: "text-emerald-500" },
  commented: { icon: <MessageSquare className="w-3.5 h-3.5" />, color: "text-blue-500" },
  deleted: { icon: <Trash2 className="w-3.5 h-3.5" />, color: "text-red-500" },
  "logged time": { icon: <Clock className="w-3.5 h-3.5" />, color: "text-amber-500" },
  "bulk updated": { icon: <RefreshCw className="w-3.5 h-3.5" />, color: "text-purple-500" },
  "created retrospective": { icon: <FileText className="w-3.5 h-3.5" />, color: "text-teal-500" },
  default: { icon: <AlertTriangle className="w-3.5 h-3.5" />, color: "text-muted-foreground" },
};

function getActionStyle(action: string) {
  for (const [key, style] of Object.entries(actionIcons)) {
    if (action.includes(key)) return style;
  }
  return actionIcons.default;
}

function timeAgo(timestamp: number): string {
  const diff = Date.now() - timestamp;
  const minutes = Math.floor(diff / 60000);
  if (minutes < 1) return "just now";
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days}d ago`;
  return new Date(timestamp).toLocaleDateString();
}

interface ActivityFeedProps {
  projectId?: Id<"projects">;
  limit?: number;
  showProjectName?: boolean;
}

export default function ActivityFeed({ projectId, limit = 30, showProjectName = false }: ActivityFeedProps) {
  const recentLogs = useQuery(api.activity.listRecent, projectId ? "skip" : { limit });
  const projectLogs = useQuery(
    api.activity.listByProject,
    projectId ? { projectId, limit } : "skip"
  );

  const logs = projectId ? projectLogs : recentLogs;

  if (!logs) {
    return (
      <div className="space-y-3">
        {[1, 2, 3, 4, 5].map((i) => (
          <div key={i} className="flex gap-3 animate-pulse">
            <div className="w-8 h-8 rounded-full bg-muted" />
            <div className="flex-1 space-y-2">
              <div className="h-3 bg-muted rounded w-3/4" />
              <div className="h-2 bg-muted rounded w-1/4" />
            </div>
          </div>
        ))}
      </div>
    );
  }

  if (logs.length === 0) {
    return (
      <div className="text-center py-8">
        <Users className="w-8 h-8 text-muted-foreground mx-auto mb-2" />
        <p className="text-sm text-muted-foreground">No activity yet</p>
        <p className="text-xs text-muted-foreground/60 mt-1">Actions will appear here as your team works</p>
      </div>
    );
  }

  return (
    <div className="space-y-1">
      {logs.map((log, i) => {
        const style = getActionStyle(log.action);
        return (
          <motion.div
            key={log._id}
            initial={{ opacity: 0, x: -8 }}
            animate={{ opacity: 1, x: 0 }}
            transition={staggeredEnter(i)}
            className="flex gap-3 px-3 py-2.5 rounded-lg hover:bg-muted/40 transition-colors group"
          >
            <div
              className="w-8 h-8 rounded-full flex items-center justify-center shrink-0 mt-0.5"
              style={{ backgroundColor: "color-mix(in srgb, var(--primary) 10%, transparent)" }}
            >
              {style.icon}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm leading-snug">
                <span className="font-medium">{log.userName}</span>{" "}
                <span className="text-muted-foreground">{log.action}</span>
                {log.entityName && (
                  <>
                    {" "}
                    <span className="font-medium text-foreground">{log.entityName}</span>
                  </>
                )}
              </p>
              <div className="flex items-center gap-2 mt-0.5">
                <span className="text-[11px] text-muted-foreground/60">{timeAgo(log.createdAt)}</span>
                {showProjectName && (log as any).projectName && (
                  <>
                    <span className="text-muted-foreground/30">·</span>
                    <span className="text-[11px] text-muted-foreground/60">{(log as any).projectName}</span>
                  </>
                )}
              </div>
            </div>
          </motion.div>
        );
      })}
    </div>
  );
}
