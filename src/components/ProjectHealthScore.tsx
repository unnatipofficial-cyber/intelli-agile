import { useMemo } from "react";
import { motion } from "framer-motion";

interface ProjectHealthScoreProps {
  completionRate: number; // 0-100
  velocityTrend: number; // positive = improving, negative = declining
  riskCount: number;
  overdueTasks: number;
  teamLoad: number; // average tasks per person
}

function calculateHealthScore(
  completionRate: number,
  velocityTrend: number,
  riskCount: number,
  overdueTasks: number,
  teamLoad: number
): { score: number; label: string; color: string } {
  let score = 50;

  // Completion rate contribution (0-30 points)
  score += (completionRate / 100) * 30;

  // Velocity trend (-10 to +10 points)
  score += Math.max(-10, Math.min(10, velocityTrend * 2));

  // Risk penalty (-15 to 0 points)
  score -= Math.min(15, riskCount * 3);

  // Overdue penalty (-10 to 0 points)
  score -= Math.min(10, overdueTasks * 2);

  // Team load penalty/bonus (-5 to +5 points)
  if (teamLoad > 8) score -= 5;
  else if (teamLoad < 3) score -= 2;
  else if (teamLoad >= 4 && teamLoad <= 6) score += 5;

  score = Math.max(0, Math.min(100, Math.round(score)));

  if (score >= 80) return { score, label: "Excellent", color: "#22c55e" };
  if (score >= 60) return { score, label: "Good", color: "#3b82f6" };
  if (score >= 40) return { score, label: "At Risk", color: "#f59e0b" };
  return { score, label: "Critical", color: "#ef4444" };
}

export default function ProjectHealthScore({
  completionRate,
  velocityTrend,
  riskCount,
  overdueTasks,
  teamLoad,
}: ProjectHealthScoreProps) {
  const { score, label, color } = useMemo(
    () => calculateHealthScore(completionRate, velocityTrend, riskCount, overdueTasks, teamLoad),
    [completionRate, velocityTrend, riskCount, overdueTasks, teamLoad]
  );

  const circumference = 2 * Math.PI * 54;
  const strokeDashoffset = circumference - (score / 100) * circumference;

  return (
    <div className="flex flex-col items-center">
      <div className="relative w-32 h-32">
        <svg className="w-full h-full -rotate-90" viewBox="0 0 120 120">
          {/* Background circle */}
          <circle
            cx="60"
            cy="60"
            r="54"
            fill="none"
            stroke="var(--muted)"
            strokeWidth="8"
            opacity="0.3"
          />
          {/* Score arc */}
          <motion.circle
            cx="60"
            cy="60"
            r="54"
            fill="none"
            stroke={color}
            strokeWidth="8"
            strokeLinecap="round"
            strokeDasharray={circumference}
            initial={{ strokeDashoffset: circumference }}
            animate={{ strokeDashoffset }}
            transition={{ duration: 1.2, ease: "easeOut" }}
          />
        </svg>
        {/* Center text */}
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <motion.span
            className="text-2xl font-bold"
            style={{ color }}
            initial={{ opacity: 0, scale: 0.5 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: 0.3 }}
          >
            {score}
          </motion.span>
          <span className="text-[10px] text-muted-foreground">{label}</span>
        </div>
      </div>
    </div>
  );
}
