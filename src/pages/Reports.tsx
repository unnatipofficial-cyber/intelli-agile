import { useState, useMemo } from "react";
import { useQuery } from "convex/react";
import { api } from "../convex/_generated/api";
import { motion } from "framer-motion";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  FileText,
  Download,
  Printer,
  TrendingUp,
  Users,
  ShieldAlert,
  CheckCircle2,
  Clock,
  Sparkles,
} from "lucide-react";

export default function Reports() {
  const projects = useQuery(api.projects.list);
  const [selectedProjectId, setSelectedProjectId] = useState<string | null>(null);
  const allTasks = useQuery(
    api.tasks.list,
    selectedProjectId ? { projectId: selectedProjectId as any } : "skip"
  );
  const sprints = useQuery(
    api.sprints.list,
    selectedProjectId ? { projectId: selectedProjectId as any } : "skip"
  );
  const risks = useQuery(
    api.risks.list,
    selectedProjectId ? { projectId: selectedProjectId as any } : "skip"
  );
  const workload = useQuery(
    api.team.getWorkload,
    selectedProjectId ? { projectId: selectedProjectId as any } : "skip"
  );
  const insights = useQuery(
    api.insights.generate,
    selectedProjectId ? { projectId: selectedProjectId as any } : "skip"
  );
  const [generating, setGenerating] = useState(false);

  if (!selectedProjectId && projects && projects.length > 0) {
    setSelectedProjectId(projects[0]._id);
  }

  const activeProject = projects?.find((p) => p._id === selectedProjectId);

  const stats = useMemo(() => {
    if (!allTasks) return null;
    const total = allTasks.length;
    const completed = allTasks.filter((t) => t.status === "done").length;
    const inProgress = allTasks.filter((t) => t.status === "in-progress").length;
    const todo = allTasks.filter((t) => t.status === "todo").length;
    const totalPoints = allTasks.reduce((s, t) => s + (t.storyPoints || 0), 0);
    const completedPoints = allTasks.filter((t) => t.status === "done").reduce((s, t) => s + (t.storyPoints || 0), 0);
    const bugs = allTasks.filter((t) => t.type === "bug").length;
    const openBugs = allTasks.filter((t) => t.type === "bug" && t.status !== "done").length;
    return { total, completed, inProgress, todo, totalPoints, completedPoints, bugs, openBugs };
  }, [allTasks]);

  const activeSprint = sprints?.find((s) => s.status === "active");
  const openRisks = risks?.filter((r) => r.status === "open") || [];
  const criticalRisks = openRisks.filter((r) => r.severity === "critical" || r.severity === "high");

  const handlePrint = () => {
    window.print();
  };

  return (
    <div className="space-y-6 animate-fade-in-up">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Reports</h1>
          <p className="text-sm text-muted-foreground">Generate and export project reports</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={handlePrint} className="gap-2">
            <Printer className="w-4 h-4" /> Print
          </Button>
          <Button onClick={handlePrint} className="gap-2">
            <Download className="w-4 h-4" /> Export PDF
          </Button>
        </div>
      </div>

      {projects && projects.length > 1 && (
        <div className="flex gap-2 flex-wrap">
          {projects.map((p) => (
            <button
              key={p._id}
              onClick={() => setSelectedProjectId(p._id)}
              className={cn(
                "px-3 py-1.5 rounded-xl text-xs font-medium transition-all",
                selectedProjectId === p._id
                  ? "bg-primary text-primary-foreground shadow-sm"
                  : "glass-card hover:bg-accent/50"
              )}
            >
              {p.name}
            </button>
          ))}
        </div>
      )}

      {/* Report Preview */}
      {activeProject && (
        <div className="glass-card p-6 lg:p-8 space-y-8 print:shadow-none" id="report">
          {/* Report Header */}
          <div className="flex items-start justify-between pb-6 border-b border-border/50">
            <div>
              <div className="flex items-center gap-2 mb-2">
                <div className="w-8 h-8 rounded-lg aie-gradient flex items-center justify-center">
                  <FileText className="w-4 h-4 text-white" />
                </div>
                <span className="text-xs font-semibold text-primary tracking-wider uppercase">AIE Report</span>
              </div>
              <h2 className="text-xl font-bold">{activeProject.name}</h2>
              <p className="text-sm text-muted-foreground mt-1">{activeProject.description || "Project report"}</p>
            </div>
            <div className="text-right text-xs text-muted-foreground">
              <p>Generated: {new Date().toLocaleDateString()}</p>
              <Badge className={cn("text-[10px] mt-1 capitalize", activeProject.status === "active" ? "bg-emerald-100 text-emerald-700" : "bg-slate-100 text-slate-600")}>
                {activeProject.status}
              </Badge>
            </div>
          </div>

          {/* Project Summary */}
          <div>
            <h3 className="text-sm font-bold mb-3 flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-primary" /> Project Summary
            </h3>
            {stats && (
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                <div className="p-3 rounded-xl bg-muted/50">
                  <p className="text-2xl font-bold">{stats.total}</p>
                  <p className="text-xs text-muted-foreground">Total Tasks</p>
                </div>
                <div className="p-3 rounded-xl bg-muted/50">
                  <p className="text-2xl font-bold text-emerald-600">{stats.completed}</p>
                  <p className="text-xs text-muted-foreground">Completed</p>
                </div>
                <div className="p-3 rounded-xl bg-muted/50">
                  <p className="text-2xl font-bold text-blue-600">{stats.totalPoints}</p>
                  <p className="text-xs text-muted-foreground">Total Story Points</p>
                </div>
                <div className="p-3 rounded-xl bg-muted/50">
                  <p className="text-2xl font-bold text-primary">{stats.completedPoints}</p>
                  <p className="text-xs text-muted-foreground">Points Delivered</p>
                </div>
              </div>
            )}
          </div>

          {/* Sprint Performance */}
          <div>
            <h3 className="text-sm font-bold mb-3 flex items-center gap-2">
              <TrendingUp className="w-4 h-4 text-primary" /> Sprint Performance
            </h3>
            {sprints && sprints.length > 0 ? (
              <div className="space-y-2">
                {sprints.map((sprint) => (
                  <div key={sprint._id} className="flex items-center gap-3 p-3 rounded-xl bg-muted/30">
                    <div className="flex-1">
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-medium">{sprint.name}</span>
                        <Badge variant="outline" className={cn("text-[10px] capitalize",
                          sprint.status === "active" ? "bg-emerald-100 text-emerald-700" :
                          sprint.status === "completed" ? "bg-blue-100 text-blue-700" : "bg-slate-100 text-slate-600"
                        )}>{sprint.status}</Badge>
                      </div>
                      <p className="text-xs text-muted-foreground mt-0.5">{sprint.goal || "No goal"}</p>
                    </div>
                    <div className="text-right">
                      <p className="text-sm font-semibold">{sprint.completedPoints}/{sprint.totalPoints} SP</p>
                      <div className="w-16 h-1.5 rounded-full bg-muted mt-1">
                        <div className="h-full rounded-full aie-gradient" style={{ width: `${sprint.totalPoints > 0 ? (sprint.completedPoints / sprint.totalPoints) * 100 : 0}%` }} />
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">No sprint data available</p>
            )}
          </div>

          {/* Team Workload */}
          <div>
            <h3 className="text-sm font-bold mb-3 flex items-center gap-2">
              <Users className="w-4 h-4 text-primary" /> Team Workload
            </h3>
            {workload && workload.length > 0 ? (
              <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
                {workload.map((m) => (
                  <div key={m._id} className="p-3 rounded-xl bg-muted/30">
                    <div className="flex items-center gap-2 mb-1">
                      <div className="w-6 h-6 rounded-full bg-primary/10 flex items-center justify-center text-[10px] font-bold text-primary">
                        {(m.user as any)?.name?.charAt(0) || "?"}
                      </div>
                      <span className="text-xs font-medium">{(m.user as any)?.name || "Unknown"}</span>
                    </div>
                    <p className="text-lg font-bold">{m.activePoints} SP</p>
                    <p className="text-[10px] text-muted-foreground">{m.completedPoints} completed</p>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">No team data</p>
            )}
          </div>

          {/* Risks */}
          <div>
            <h3 className="text-sm font-bold mb-3 flex items-center gap-2">
              <ShieldAlert className="w-4 h-4 text-primary" /> Risks ({openRisks.length} open)
            </h3>
            {criticalRisks.length > 0 && (
              <div className="mb-3 p-3 rounded-xl bg-red-50 dark:bg-red-950/20 border border-red-200 dark:border-red-800/30">
                <p className="text-xs font-semibold text-red-700 dark:text-red-400">
                  {criticalRisks.length} high/critical risk{criticalRisks.length > 1 ? "s" : ""} require attention
                </p>
              </div>
            )}
            {openRisks.slice(0, 5).map((risk) => (
              <div key={risk._id} className="flex items-center gap-3 p-2 text-xs">
                <Badge className={cn("text-[10px] capitalize w-14 justify-center",
                  risk.severity === "critical" ? "bg-red-100 text-red-700" :
                  risk.severity === "high" ? "bg-orange-100 text-orange-700" :
                  risk.severity === "medium" ? "bg-amber-100 text-amber-700" : "bg-emerald-100 text-emerald-700"
                )}>{risk.severity}</Badge>
                <span className="flex-1">{risk.title}</span>
                <span className="text-muted-foreground">Score: {risk.score}</span>
              </div>
            ))}
          </div>

          {/* AIE Recommendations */}
          {insights && insights.length > 0 && (
            <div>
              <h3 className="text-sm font-bold mb-3 flex items-center gap-2">
                <Sparkles className="w-4 h-4 text-primary" /> AIE Recommendations
              </h3>
              <div className="space-y-2">
                {insights.slice(0, 5).map((insight) => (
                  <div key={insight.id} className="p-3 rounded-xl bg-primary/5 border border-primary/10">
                    <div className="flex items-center gap-2 mb-1">
                      <Badge variant="outline" className={cn("text-[10px] capitalize",
                        insight.severity === "critical" ? "text-red-600 border-red-200" :
                        insight.severity === "high" ? "text-orange-600 border-orange-200" :
                        "text-primary border-primary/20"
                      )}>{insight.severity}</Badge>
                      <span className="text-xs font-semibold">{insight.title}</span>
                    </div>
                    <p className="text-xs text-muted-foreground">{insight.description}</p>
                    <p className="text-xs font-medium text-primary mt-1">→ {insight.recommendedAction}</p>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Footer */}
          <div className="pt-4 border-t border-border/50 flex items-center justify-between text-[10px] text-muted-foreground">
            <span>Generated by AIE — Agile Intelligence Engine</span>
            <span>{new Date().toLocaleString()}</span>
          </div>
        </div>
      )}
    </div>
  );
}
