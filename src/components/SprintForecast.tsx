import { useMemo } from "react";
import { motion } from "framer-motion";
import { TrendingUp, TrendingDown, Clock, Target, AlertTriangle, CheckCircle } from "lucide-react";
import { cssVar } from "@/lib/theme-colors";

interface SprintForecastProps {
  sprints: any[];
  tasks: any[];
}

export default function SprintForecast({ sprints, tasks }: SprintForecastProps) {
  const forecast = useMemo(() => {
    if (!sprints || sprints.length === 0) return null;

    const completedSprints = sprints.filter((s: any) => s.status === "done");
    const activeSprint = sprints.find((s: any) => s.status === "active");

    if (completedSprints.length === 0 && !activeSprint) return null;

    // Calculate velocity trend from completed sprints
    const velocities = completedSprints.map((s: any) => s.completedPoints || 0);
    const avgVelocity = velocities.length > 0
      ? velocities.reduce((a: number, b: number) => a + b, 0) / velocities.length
      : 0;

    // Calculate velocity trend
    let velocityTrend = "stable";
    if (velocities.length >= 2) {
      const recent = velocities.slice(-3);
      const older = velocities.slice(0, Math.max(1, velocities.length - 3));
      const recentAvg = recent.reduce((a: number, b: number) => a + b, 0) / recent.length;
      const olderAvg = older.reduce((a: number, b: number) => a + b, 0) / older.length;
      if (recentAvg > olderAvg * 1.1) velocityTrend = "increasing";
      else if (recentAvg < olderAvg * 0.9) velocityTrend = "decreasing";
    }

    if (!activeSprint) {
      return {
        status: "no-active",
        avgVelocity: Math.round(avgVelocity),
        velocityTrend,
        velocityHistory: velocities.slice(-5),
      };
    }

    // Active sprint forecast
    const sprintTasks = tasks.filter((t: any) => t.sprintId === activeSprint._id);
    const totalPoints = sprintTasks.reduce((sum: number, t: any) => sum + (t.storyPoints || 0), 0);
    const completedPoints = sprintTasks
      .filter((t: any) => t.status === "done")
      .reduce((sum: number, t: any) => sum + (t.storyPoints || 0), 0);
    const remainingPoints = totalPoints - completedPoints;

    // Time remaining
    const now = Date.now();
    const sprintDuration = activeSprint.endDate - activeSprint.startDate;
    const elapsed = now - activeSprint.startDate;
    const timeRemaining = Math.max(0, activeSprint.endDate - now);
    const daysRemaining = Math.ceil(timeRemaining / (1000 * 60 * 60 * 24));
    const totalDays = Math.ceil(sprintDuration / (1000 * 60 * 60 * 24));
    const daysElapsed = Math.ceil(elapsed / (1000 * 60 * 60 * 24));
    const progressPercent = Math.min(100, (elapsed / sprintDuration) * 100);

    // Predict completion
    const completionPercent = totalPoints > 0 ? (completedPoints / totalPoints) * 100 : 0;
    const expectedPercent = progressPercent;
    const ahead = completionPercent > expectedPercent + 5;
    const behind = completionPercent < expectedPercent - 5;

    // Predict if sprint will complete on time
    let prediction = "on-track";
    let confidence = 85;

    if (behind) {
      const dailyRate = daysElapsed > 0 ? completedPoints / daysElapsed : 0;
      const projectedTotal = completedPoints + dailyRate * daysRemaining;
      if (projectedTotal < totalPoints * 0.9) {
        prediction = "at-risk";
        confidence = Math.max(40, Math.round((projectedTotal / totalPoints) * 100));
      } else {
        prediction = "tight";
        confidence = Math.round((projectedTotal / totalPoints) * 100);
      }
    } else if (ahead) {
      prediction = "ahead";
      confidence = Math.min(99, Math.round(completionPercent / Math.max(1, expectedPercent) * 80));
    }

    return {
      status: "active",
      sprint: activeSprint,
      totalPoints,
      completedPoints,
      remainingPoints,
      daysRemaining,
      totalDays,
      daysElapsed,
      progressPercent: Math.round(progressPercent),
      completionPercent: Math.round(completionPercent),
      prediction,
      confidence,
      avgVelocity: Math.round(avgVelocity),
      velocityTrend,
      velocityHistory: velocities.slice(-5),
      ahead,
      behind,
    };
  }, [sprints, tasks]);

  if (!forecast) {
    return (
      <div className="p-4 rounded-xl border border-border/50 bg-card/50 text-center">
        <Target className="w-8 h-8 text-muted-foreground mx-auto mb-2" />
        <p className="text-sm text-muted-foreground">No sprint data for forecasting</p>
      </div>
    );
  }

  if (forecast.status === "no-active") {
    return (
      <div className="p-4 rounded-xl border border-border/50 bg-card/50">
        <div className="flex items-center gap-2 mb-2">
          <Clock className="w-4 h-4 text-muted-foreground" />
          <h3 className="text-sm font-semibold">Sprint Forecast</h3>
        </div>
        <p className="text-xs text-muted-foreground">No active sprint to forecast.</p>
        {forecast.avgVelocity > 0 && (
          <p className="text-xs text-muted-foreground mt-1">
            Avg velocity: <span className="font-semibold text-foreground">{forecast.avgVelocity} SP/sprint</span>
          </p>
        )}
      </div>
    );
  }

  const predictionConfig = {
    "ahead": { icon: <CheckCircle className="w-4 h-4" />, color: "text-green-500", bg: "bg-green-500/10", label: "Ahead of Schedule" },
    "on-track": { icon: <Target className="w-4 h-4" />, color: "text-blue-500", bg: "bg-blue-500/10", label: "On Track" },
    "tight": { icon: <Clock className="w-4 h-4" />, color: "text-amber-500", bg: "bg-amber-500/10", label: "Tight" },
    "at-risk": { icon: <AlertTriangle className="w-4 h-4" />, color: "text-red-500", bg: "bg-red-500/10", label: "At Risk" },
  };

  const config = predictionConfig[forecast.prediction as keyof typeof predictionConfig] || predictionConfig["on-track"];

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      className="p-4 rounded-xl border border-border/50 bg-card/50"
    >
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <Target className="w-4 h-4 text-muted-foreground" />
          <h3 className="text-sm font-semibold">Sprint Forecast</h3>
        </div>
        <div className={`flex items-center gap-1.5 px-2 py-1 rounded-lg ${config.bg}`}>
          <span className={config.color}>{config.icon}</span>
          <span className={`text-xs font-medium ${config.color}`}>{config.label}</span>
        </div>
      </div>

      {/* Progress bar */}
      <div className="mb-3">
        <div className="flex justify-between text-[11px] text-muted-foreground mb-1">
          <span>{forecast.completedPoints}/{forecast.totalPoints} SP completed</span>
          <span>{forecast.daysRemaining}d remaining</span>
        </div>
        <div className="w-full h-2 rounded-full bg-muted overflow-hidden">
          <div
            className="h-full rounded-full transition-all duration-500"
            style={{
              width: `${forecast.completionPercent}%`,
              backgroundColor: config.color === "text-green-500" ? cssVar("--chart-1") :
                config.color === "text-red-500" ? cssVar("--destructive") :
                cssVar("--primary"),
            }}
          />
        </div>
        <div className="flex justify-between text-[10px] text-muted-foreground/60 mt-1">
          <span>Started {forecast.daysElapsed}d ago</span>
          <span>Confidence: {forecast.confidence}%</span>
        </div>
      </div>

      {/* Key metrics */}
      <div className="grid grid-cols-2 gap-2">
        <div className="p-2 rounded-lg bg-muted/40">
          <p className="text-[10px] text-muted-foreground">Velocity Trend</p>
          <div className="flex items-center gap-1 mt-0.5">
            {forecast.velocityTrend === "increasing" ? (
              <TrendingUp className="w-3 h-3 text-green-500" />
            ) : forecast.velocityTrend === "decreasing" ? (
              <TrendingDown className="w-3 h-3 text-red-500" />
            ) : (
              <span className="w-3 h-3 text-muted-foreground">→</span>
            )}
            <span className="text-xs font-medium capitalize">{forecast.velocityTrend}</span>
          </div>
        </div>
        <div className="p-2 rounded-lg bg-muted/40">
          <p className="text-[10px] text-muted-foreground">Avg Velocity</p>
          <p className="text-xs font-semibold mt-0.5">{forecast.avgVelocity} SP</p>
        </div>
      </div>
    </motion.div>
  );
}
