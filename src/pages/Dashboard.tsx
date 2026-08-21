import { cssVar } from "@/lib/theme-colors";
import { useState, useEffect, useMemo } from "react";
import { useQuery, useMutation } from "convex/react";
import { api } from "../convex/_generated/api";
import { useAuth } from "@/hooks/use-auth";
import { useAiInsights } from "@/hooks/use-ai-insights";
import { motion } from "framer-motion";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  FolderKanban,
  Zap,
  CheckCircle2,
  Clock,
  Gauge,
  Users,
  ShieldAlert,
  TrendingUp,
  TrendingDown,
  ArrowRight,
  AlertTriangle,
  Sparkles,
  Brain,
  Activity,
  Target,
  Timer,
} from "lucide-react";
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  BarChart,
  Bar,
  PieChart,
  Pie,
  Cell,
} from "recharts";

const COLORS = {
  get primary() { return cssVar("--chart-1"); },
  get secondary() { return cssVar("--chart-2"); },
  get tertiary() { return cssVar("--chart-3"); },
  get quaternary() { return cssVar("--chart-4"); },
  get quinary() { return cssVar("--chart-5"); },
};

function KpiCard({
  icon: Icon,
  label,
  value,
  subtext,
  color,
  delay,
}: {
  icon: any;
  label: string;
  value: string | number;
  subtext?: string;
  color: string;
  delay: number;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3, delay }}
    >
      <div className="glass-card p-4 lg:p-5">
        <div className="flex items-start justify-between">
          <div>
            <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">{label}</p>
            <p className="text-2xl lg:text-3xl font-bold mt-1 tracking-tight tabular-nums">{value}</p>
            {subtext && <p className="text-xs text-muted-foreground mt-1">{subtext}</p>}
          </div>
          <div
            className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0"
            style={{ backgroundColor: `${color}15`, color }}
          >
            <Icon className="w-5 h-5" />
          </div>
        </div>
      </div>
    </motion.div>
  );
}

function AieInsights({ projectId, allTasks, sprints, risks, workload }: { projectId: any; allTasks: any[]; sprints: any[]; risks: any[]; workload: any[] }) {
  const insights = useQuery(api.insights.generate, projectId ? { projectId } : "skip");
  const { aiInsights, isLoading: aiLoading, error: aiError, analyzeProject } = useAiInsights();
  const [aiAnalyzed, setAiAnalyzed] = useState(false);

  const handleAnalyze = async () => {
    await analyzeProject({
      projectName: "Current Project",
      tasks: allTasks?.map((t: any) => ({ title: t.title, status: t.status, priority: t.priority, storyPoints: t.storyPoints || 0 })) || [],
      sprints: sprints?.map((s: any) => ({ name: s.name, status: s.status, totalPoints: s.totalPoints || 0, completedPoints: s.completedPoints || 0 })) || [],
      risks: risks?.map((r: any) => ({ title: r.title, severity: r.severity, probability: r.probability, impact: r.impact, score: r.score, status: r.status })) || [],
      teamWorkload: workload?.map((w: any) => ({ name: w.user?.name || "Unknown", activePoints: w.activePoints || 0, completedPoints: w.completedPoints || 0 })) || [],
    });
    setAiAnalyzed(true);
  };

  if (!insights) {
    return (
      <div className="glass-card p-6 aie-glow">
        <div className="flex items-center gap-3 mb-4">
          <div className="w-9 h-9 rounded-xl aie-gradient flex items-center justify-center">
            <Brain className="w-5 h-5 text-white" />
          </div>
          <div>
            <h3 className="text-sm font-bold tracking-tight">AIE Intelligence</h3>
            <p className="text-xs text-muted-foreground">Analyzing project data...</p>
          </div>
        </div>
        <div className="space-y-3">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-16 rounded-xl bg-muted/50 animate-pulse" />
          ))}
        </div>
      </div>
    );
  }

  const severityColors: Record<string, { bg: string; text: string; border: string; icon: any }> = {
    critical: { bg: "bg-red-50 dark:bg-red-950/20", text: "text-red-700 dark:text-red-400", border: "border-red-200 dark:border-red-800/30", icon: AlertTriangle },
    high: { bg: "bg-orange-50 dark:bg-orange-950/20", text: "text-orange-700 dark:text-orange-400", border: "border-orange-200 dark:border-orange-800/30", icon: TrendingUp },
    medium: { bg: "bg-amber-50 dark:bg-amber-950/20", text: "text-amber-700 dark:text-amber-400", border: "border-amber-200 dark:border-amber-800/30", icon: Timer },
    low: { bg: "bg-emerald-50 dark:bg-emerald-950/20", text: "text-emerald-700 dark:text-emerald-400", border: "border-emerald-200 dark:border-emerald-800/30", icon: CheckCircle2 },
  };

  return (
    <div className="glass-card p-6 aie-glow relative overflow-hidden">
      {/* Subtle gradient overlay */}
      <div className="absolute inset-0 bg-gradient-to-br from-primary/5 via-transparent to-transparent pointer-events-none" />

      <div className="relative">
        <div className="flex items-center gap-3 mb-5">
          <div className="w-9 h-9 rounded-xl aie-gradient flex items-center justify-center shadow-sm">
            <Brain className="w-5 h-5 text-white" />
          </div>
          <div>
            <h3 className="text-sm font-bold tracking-tight">AIE Intelligence</h3>
            <p className="text-xs text-muted-foreground">AI-powered project insights</p>
          </div>
          <div className="ml-auto flex items-center gap-2">
            <Badge variant="secondary" className="text-[10px] px-2 py-0.5 bg-primary/10 text-primary">
              <Sparkles className="w-3 h-3 mr-1" />
              {insights.length} rule{insights.length !== 1 ? "s" : ""}
            </Badge>
            <Button
              size="sm"
              variant="outline"
              onClick={handleAnalyze}
              disabled={aiLoading}
              className="h-7 text-[10px] gap-1.5 border-primary/20 hover:bg-primary/5"
            >
              <Brain className="w-3 h-3" />
              {aiLoading ? "Analyzing..." : "Analyze with AI"}
            </Button>
          </div>
        </div>

        <div className="space-y-3">
          {insights.slice(0, 5).map((insight) => {
            const colors = severityColors[insight.severity] || severityColors.medium;
            const IconComp = colors.icon;
            return (
              <motion.div
                key={insight.id}
                initial={{ opacity: 0, x: -8 }}
                animate={{ opacity: 1, x: 0 }}
                className={cn(
                  "rounded-xl border p-4 transition-colors",
                  colors.bg,
                  colors.border
                )}
              >
                <div className="flex items-start gap-3">
                  <div className={cn("w-8 h-8 rounded-lg flex items-center justify-center shrink-0", colors.bg)}>
                    <IconComp className={cn("w-4 h-4", colors.text)} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <Badge variant="outline" className={cn("text-[10px] px-1.5 py-0 h-4 capitalize border-current", colors.text)}>
                        {insight.severity}
                      </Badge>
                      <span className="text-sm font-semibold">{insight.title}</span>
                    </div>
                    <p className="text-xs text-muted-foreground leading-relaxed">{insight.description}</p>
                    <div className="mt-2 flex items-center gap-1.5">
                      <ArrowRight className="w-3 h-3 text-primary" />
                      <p className="text-xs font-medium text-primary">{insight.recommendedAction}</p>
                    </div>
                  </div>
                </div>
              </motion.div>
            );
          })}
        </div>

        {/* AI-Powered Insights from Claude */}
        {aiAnalyzed && aiInsights.length > 0 && (
          <div className="mt-5 pt-5 border-t border-border/50">
            <div className="flex items-center gap-2 mb-3">
              <Brain className="w-4 h-4 text-primary" />
              <span className="text-xs font-bold tracking-tight">Claude AI Analysis</span>
              <Badge variant="outline" className="text-[9px] px-1.5 py-0 h-4 border-primary/20 text-primary">
                {aiInsights.length} insight{aiInsights.length !== 1 ? "s" : ""}
              </Badge>
            </div>
            <div className="space-y-3">
              {aiInsights.map((insight: any, i: number) => {
                const colors = severityColors[insight.severity] || severityColors.medium;
                const IconComp = colors.icon;
                return (
                  <motion.div
                    key={`ai-${i}`}
                    initial={{ opacity: 0, x: -8 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: i * 0.05 }}
                    className={cn(
                      "rounded-xl border p-4 transition-colors",
                      colors.bg,
                      colors.border
                    )}
                  >
                    <div className="flex items-start gap-3">
                      <div className={cn("w-8 h-8 rounded-lg flex items-center justify-center shrink-0", colors.bg)}>
                        <IconComp className={cn("w-4 h-4", colors.text)} />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          <Badge variant="outline" className={cn("text-[10px] px-1.5 py-0 h-4 capitalize border-current", colors.text)}>
                            {insight.severity}
                          </Badge>
                          <span className="text-sm font-semibold">{insight.title}</span>
                        </div>
                        <p className="text-xs text-muted-foreground leading-relaxed">{insight.description}</p>
                        <div className="mt-2 flex items-center gap-1.5">
                          <ArrowRight className="w-3 h-3 text-primary" />
                          <p className="text-xs font-medium text-primary">{insight.recommendedAction}</p>
                        </div>
                      </div>
                    </div>
                  </motion.div>
                );
              })}
            </div>
          </div>
        )}

        {aiError && (
          <div className="mt-4 p-3 rounded-xl bg-red-50 dark:bg-red-950/20 border border-red-200 dark:border-red-800/30">
            <p className="text-xs text-red-600 dark:text-red-400">AI analysis failed: {aiError}</p>
          </div>
        )}
      </div>
    </div>
  );
}

export default function Dashboard() {
  const { user } = useAuth();
  const projects = useQuery(api.projects.list);
  const [selectedProjectId, setSelectedProjectId] = useState<string | null>(null);

  useEffect(() => {
    if (projects && projects.length > 0 && !selectedProjectId) {
      setSelectedProjectId(projects[0]._id);
    }
  }, [projects, selectedProjectId]);

  const activeProject = projects?.find((p) => p._id === selectedProjectId);
  const activeSprint = useQuery(
    api.sprints.getActive,
    selectedProjectId ? { projectId: selectedProjectId as any } : "skip"
  );
  const allTasks = useQuery(
    api.tasks.list,
    selectedProjectId ? { projectId: selectedProjectId as any } : "skip"
  );
  const risks = useQuery(
    api.risks.list,
    selectedProjectId ? { projectId: selectedProjectId as any } : "skip"
  );
  const sprints = useQuery(
    api.sprints.list,
    selectedProjectId ? { projectId: selectedProjectId as any } : "skip"
  );
  const velocity = useQuery(
    api.sprints.getVelocity,
    selectedProjectId ? { projectId: selectedProjectId as any } : "skip"
  );
  const seedData = useMutation(api.seed.getOrCreateSampleData);

  useEffect(() => {
    seedData();
  }, []);

  const stats = useMemo(() => {
    if (!allTasks) return null;
    const total = allTasks.length;
    const completed = allTasks.filter((t) => t.status === "done").length;
    const inProgress = allTasks.filter((t) => t.status === "in-progress").length;
    const todo = allTasks.filter((t) => t.status === "todo").length;
    const review = allTasks.filter((t) => t.status === "review").length;
    const totalPoints = allTasks.reduce((s, t) => s + (t.storyPoints || 0), 0);
    const completedPoints = allTasks.filter((t) => t.status === "done").reduce((s, t) => s + (t.storyPoints || 0), 0);
    return { total, completed, inProgress, todo, review, totalPoints, completedPoints };
  }, [allTasks]);

  const sprintProgress = useMemo(() => {
    if (!activeSprint) return null;
    const total = activeSprint.totalPoints;
    const completed = activeSprint.completedPoints;
    const remaining = total - completed;
    const progress = total > 0 ? Math.round((completed / total) * 100) : 0;
    const now = Date.now();
    const totalDuration = activeSprint.endDate - activeSprint.startDate;
    const elapsed = now - activeSprint.startDate;
    const timeProgress = totalDuration > 0 ? Math.round((elapsed / totalDuration) * 100) : 0;
    const daysRemaining = Math.max(0, Math.ceil((activeSprint.endDate - now) / 86400000));
    return { total, completed, remaining, progress, timeProgress, daysRemaining };
  }, [activeSprint]);

  const taskDistribution = useMemo(() => {
    if (!stats) return [];
    return [
      { name: "Done", value: stats.completed, color: cssVar("--chart-5") },
      { name: "In Progress", value: stats.inProgress, color: cssVar("--chart-1") },
      { name: "Review", value: stats.review, color: cssVar("--chart-3") },
      { name: "To Do", value: stats.todo, color: cssVar("--muted") },
    ];
  }, [stats]);

  const burndownData = useMemo(() => {
    if (!activeSprint) return [];
    const days = 14;
    const totalPoints = activeSprint.totalPoints || 42;
    const idealBurndown: { day: string; ideal: number }[] = [];
    const now = Date.now();
    const elapsed = Math.min(days, Math.floor((now - activeSprint.startDate) / 86400000));
    const completedPct = activeSprint.completedPoints / (totalPoints || 1);
    const actualBurndown: { day: string; actual: number }[] = [];
    
    for (let i = 0; i <= days; i++) {
      const ideal = totalPoints - (totalPoints * i) / days;
      idealBurndown.push({ day: `Day ${i + 1}`, ideal: Math.max(0, Math.round(ideal)) });
      if (i <= elapsed) {
        const actualReduction = completedPct * totalPoints * (i / Math.max(1, elapsed));
        actualBurndown.push({
          day: `Day ${i + 1}`,
          actual: Math.max(0, Math.round(totalPoints - actualReduction + Math.random() * 3)),
        });
      }
    }
    return idealBurndown.map((d, i) => ({
      ...d,
      actual: actualBurndown[i]?.actual,
    }));
  }, [activeSprint]);

  const workloadData = useMemo(() => {
    if (!allTasks || !projects) return [];
    const workloads: Record<string, number> = {};
    allTasks.filter((t) => t.assigneeId && t.status !== "done").forEach((t) => {
      const name = (t.assignee as any)?.name || "Unassigned";
      workloads[name] = (workloads[name] || 0) + (t.storyPoints || 1);
    });
    return Object.entries(workloads).map(([name, points]) => ({
      name: name.split(" ")[0],
      points,
    }));
  }, [allTasks, projects]);

  if (projects && projects.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] text-center">
        <div className="w-16 h-16 rounded-2xl aie-gradient flex items-center justify-center mb-4">
          <Zap className="w-8 h-8 text-white" />
        </div>
        <h2 className="text-xl font-bold mb-2">Welcome to AIE</h2>
        <p className="text-muted-foreground text-sm max-w-md mb-6">
          Your workspace is ready. Load sample data to explore the dashboard.
        </p>
        <Button onClick={() => seedData()}>Load Sample Data</Button>
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-fade-in-up">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">
            Welcome back{user?.name ? `, ${user.name}` : ""}
          </h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            Here is your project overview
          </p>
        </div>
        {projects && projects.length > 0 && (
          <div className="flex gap-2 flex-wrap">
            {projects.filter(p => p.status === "active").map((project) => (
              <button
                key={project._id}
                onClick={() => setSelectedProjectId(project._id)}
                className={cn(
                  "px-3 py-1.5 rounded-xl text-xs font-medium transition-all",
                  selectedProjectId === project._id
                    ? "bg-primary text-primary-foreground shadow-sm"
                    : "glass-card hover:bg-accent/50"
                )}
              >
                {project.name}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Sprint Progress Banner */}
      {sprintProgress && activeSprint && (
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          className="glass-card p-5 relative overflow-hidden"
        >
          <div className="absolute inset-0 bg-gradient-to-r from-primary/5 to-transparent pointer-events-none" />
          <div className="relative flex flex-col lg:flex-row lg:items-center gap-4">
            <div className="flex-1">
              <div className="flex items-center gap-2 mb-2">
                <Activity className="w-4 h-4 text-primary" />
                <span className="text-sm font-semibold">{activeSprint.name}</span>
                <Badge variant="secondary" className="text-[10px] bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400">
                  Active
                </Badge>
              </div>
              <p className="text-xs text-muted-foreground mb-3">{activeSprint.goal}</p>
              <div className="flex items-center gap-6">
                <div>
                  <span className="text-3xl font-bold tracking-tight">{sprintProgress.progress}%</span>
                  <span className="text-xs text-muted-foreground ml-1">complete</span>
                </div>
                <div className="text-xs text-muted-foreground">
                  <span className="font-semibold text-foreground">{sprintProgress.completed}</span> / {sprintProgress.total} SP
                </div>
                <div className="text-xs text-muted-foreground">
                  <span className="font-semibold text-foreground">{sprintProgress.daysRemaining}</span> days left
                </div>
              </div>
            </div>
            <div className="w-full lg:w-64">
              <div className="flex items-center justify-between text-xs mb-1.5">
                <span className="text-muted-foreground">Sprint Progress</span>
                <span className="font-semibold">{sprintProgress.progress}%</span>
              </div>
              <div className="h-2.5 rounded-full bg-muted overflow-hidden">
                <motion.div
                  initial={{ width: 0 }}
                  animate={{ width: `${sprintProgress.progress}%` }}
                  transition={{ duration: 0.8, ease: "easeOut" }}
                  className="h-full rounded-full aie-gradient"
                />
              </div>
              <div className="flex items-center justify-between text-[10px] text-muted-foreground mt-1.5">
                <span>Time: {sprintProgress.timeProgress}%</span>
                <span className={sprintProgress.progress < sprintProgress.timeProgress - 10 ? "text-red-500 font-semibold" : "text-emerald-500"}>
                  {sprintProgress.progress >= sprintProgress.timeProgress ? "On track" : "Behind schedule"}
                </span>
              </div>
            </div>
          </div>
        </motion.div>
      )}

      {/* KPI Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 xl:grid-cols-7 gap-3">
        <KpiCard icon={FolderKanban} label="Projects" value={projects?.length || 0} color={COLORS.primary} delay={0} />
        <KpiCard icon={Zap} label="Active Sprint" value={activeSprint ? 1 : 0} color={COLORS.secondary} delay={0.05} />
        <KpiCard icon={CheckCircle2} label="Completed" value={stats?.completed || 0} subtext={`${stats?.completedPoints || 0} SP`} color={COLORS.quinary} delay={0.1} />
        <KpiCard icon={Clock} label="Pending" value={(stats?.todo || 0) + (stats?.review || 0)} color={COLORS.quaternary} delay={0.15} />
        <KpiCard icon={Gauge} label="In Progress" value={stats?.inProgress || 0} color={COLORS.primary} delay={0.2} />
        <KpiCard icon={Users} label="Team" value={workloadData.length || 0} color={COLORS.tertiary} delay={0.25} />
        <KpiCard icon={ShieldAlert} label="Risks" value={risks?.filter((r) => r.status === "open").length || 0} color="#ef4444" delay={0.3} />
      </div>

      {/* Main content grid */}
      <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
        {/* Charts section */}
        <div className="xl:col-span-2 space-y-6">
          {/* Burndown Chart */}
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
          >
            <div className="glass-card p-5">
              <div className="flex items-center justify-between mb-4">
                <div>
                  <h3 className="text-sm font-bold">Sprint Burndown</h3>
                  <p className="text-xs text-muted-foreground">Story points remaining</p>
                </div>
                <Badge variant="outline" className="text-[10px]">
                  {activeSprint?.name || "No active sprint"}
                </Badge>
              </div>
              <div className="h-[220px]">
                {burndownData.length > 0 ? (
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={burndownData}>
                      <defs>
                        <linearGradient id="colorIdeal" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor={COLORS.primary} stopOpacity={0.15} />
                          <stop offset="95%" stopColor={COLORS.primary} stopOpacity={0} />
                        </linearGradient>
                        <linearGradient id="colorActual" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor={COLORS.quaternary} stopOpacity={0.2} />
                          <stop offset="95%" stopColor={COLORS.quaternary} stopOpacity={0} />
                        </linearGradient>
                      </defs>
                      <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
                      <XAxis dataKey="day" tick={{ fontSize: 10 }} tickLine={false} axisLine={false} />
                      <YAxis tick={{ fontSize: 10 }} tickLine={false} axisLine={false} />
                      <Tooltip
                        contentStyle={{
                          background: "var(--card)",
                          border: "1px solid var(--border)",
                          borderRadius: "8px",
                          fontSize: "12px",
                        }}
                      />
                      <Area type="monotone" dataKey="ideal" stroke={COLORS.primary} strokeDasharray="5 5" fill="url(#colorIdeal)" strokeWidth={2} />
                      <Area type="monotone" dataKey="actual" stroke={COLORS.quaternary} fill="url(#colorActual)" strokeWidth={2} />
                    </AreaChart>
                  </ResponsiveContainer>
                ) : (
                  <div className="flex items-center justify-center h-full text-muted-foreground text-sm">
                    No burndown data available
                  </div>
                )}
              </div>
            </div>
          </motion.div>

          {/* Velocity + Task Distribution */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <motion.div
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.3 }}
            >
              <div className="glass-card p-5">
                <div className="mb-4">
                  <h3 className="text-sm font-bold">Sprint Velocity</h3>
                  <p className="text-xs text-muted-foreground">Story points per sprint</p>
                </div>
                <div className="h-[180px]">
                  {velocity && velocity.length > 0 ? (
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={velocity}>
                        <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
                        <XAxis dataKey="sprintName" tick={{ fontSize: 10 }} tickLine={false} axisLine={false} />
                        <YAxis tick={{ fontSize: 10 }} tickLine={false} axisLine={false} />
                        <Tooltip
                          contentStyle={{
                            background: "var(--card)",
                            border: "1px solid var(--border)",
                            borderRadius: "8px",
                            fontSize: "12px",
                          }}
                        />
                        <Bar dataKey="velocity" fill={COLORS.primary} radius={[4, 4, 0, 0]} />
                      </BarChart>
                    </ResponsiveContainer>
                  ) : (
                    <div className="flex items-center justify-center h-full text-muted-foreground text-sm">
                      Complete sprints to see velocity
                    </div>
                  )}
                </div>
              </div>
            </motion.div>

            <motion.div
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.35 }}
            >
              <div className="glass-card p-5">
                <div className="mb-4">
                  <h3 className="text-sm font-bold">Task Distribution</h3>
                  <p className="text-xs text-muted-foreground">By status</p>
                </div>
                <div className="h-[180px] flex items-center">
                  {taskDistribution.some((d) => d.value > 0) ? (
                    <>
                      <div className="w-1/2">
                        <ResponsiveContainer width="100%" height={160}>
                          <PieChart>
                            <Pie
                              data={taskDistribution}
                              cx="50%"
                              cy="50%"
                              innerRadius={40}
                              outerRadius={65}
                              paddingAngle={3}
                              dataKey="value"
                            >
                              {taskDistribution.map((entry, index) => (
                                <Cell key={`cell-${index}`} fill={entry.color} />
                              ))}
                            </Pie>
                            <Tooltip
                              contentStyle={{
                                background: "var(--card)",
                                border: "1px solid var(--border)",
                                borderRadius: "8px",
                                fontSize: "12px",
                              }}
                            />
                          </PieChart>
                        </ResponsiveContainer>
                      </div>
                      <div className="w-1/2 space-y-2">
                        {taskDistribution.map((item) => (
                          <div key={item.name} className="flex items-center gap-2 text-xs">
                            <div className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: item.color }} />
                            <span className="text-muted-foreground">{item.name}</span>
                            <span className="ml-auto font-semibold">{item.value}</span>
                          </div>
                        ))}
                      </div>
                    </>
                  ) : (
                    <div className="flex items-center justify-center w-full text-muted-foreground text-sm">
                      No tasks yet
                    </div>
                  )}
                </div>
              </div>
            </motion.div>
          </div>

          {/* Team Workload */}
          {workloadData.length > 0 && (
            <motion.div
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.4 }}
            >
              <div className="glass-card p-5">
                <div className="mb-4">
                  <h3 className="text-sm font-bold">Team Workload</h3>
                  <p className="text-xs text-muted-foreground">Active story points per member</p>
                </div>
                <div className="h-[180px]">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={workloadData} layout="vertical">
                      <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" horizontal={false} />
                      <XAxis type="number" tick={{ fontSize: 10 }} tickLine={false} axisLine={false} />
                      <YAxis dataKey="name" type="category" tick={{ fontSize: 10 }} tickLine={false} axisLine={false} width={60} />
                      <Tooltip
                        contentStyle={{
                          background: "var(--card)",
                          border: "1px solid var(--border)",
                          borderRadius: "8px",
                          fontSize: "12px",
                        }}
                      />
                      <Bar dataKey="points" fill={COLORS.tertiary} radius={[0, 4, 4, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </div>
            </motion.div>
          )}
        </div>

        {/* AIE Intelligence Panel */}
        <div className="xl:col-span-1">
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.25 }}
          >
            <AieInsights projectId={selectedProjectId} allTasks={allTasks || []} sprints={sprints || []} risks={risks || []} workload={workloadData || []} />
          </motion.div>
        </div>
      </div>
    </div>
  );
}
