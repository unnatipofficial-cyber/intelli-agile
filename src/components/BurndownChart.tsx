import { useQuery } from "convex/react";
import { api } from "../convex/_generated/api";
import { Id } from "../convex/_generated/dataModel";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  ReferenceLine,
} from "recharts";

interface BurndownChartProps {
  sprintId: Id<"sprints">;
  compact?: boolean;
}

export default function BurndownChart({ sprintId, compact = false }: BurndownChartProps) {
  const data = useQuery(api.tasks.getBurndownData, { sprintId });

  if (!data) {
    return (
      <div className={`flex items-center justify-center ${compact ? "h-32" : "h-48"}`}>
        <div className="text-sm text-muted-foreground">Loading burndown data...</div>
      </div>
    );
  }

  if (data.totalPoints === 0) {
    return (
      <div className={`flex items-center justify-center ${compact ? "h-32" : "h-48"}`}>
        <div className="text-center">
          <p className="text-sm text-muted-foreground">No story points in this sprint</p>
          <p className="text-xs text-muted-foreground/60">Add story points to tasks to see the burndown</p>
        </div>
      </div>
    );
  }

  // Merge ideal and actual into chart data
  const chartData = data.idealPoints.map((ideal, i) => ({
    day: `Day ${ideal.day}`,
    ideal: Math.round(ideal.points * 10) / 10,
    actual: data.actualPoints[i] ? Math.round(data.actualPoints[i].points * 10) / 10 : null,
  }));

  const completionPercent = Math.round(
    (data.completedPoints / data.totalPoints) * 100
  );

  return (
    <div>
      {/* Stats bar */}
      {!compact && (
        <div className="flex items-center gap-4 mb-4">
          <div className="flex items-center gap-1.5">
            <div className="w-2 h-2 rounded-full bg-muted-foreground/40" />
            <span className="text-xs text-muted-foreground">
              Ideal: {data.totalPoints} SP
            </span>
          </div>
          <div className="flex items-center gap-1.5">
            <div className="w-2 h-2 rounded-full bg-primary" />
            <span className="text-xs text-muted-foreground">
              Actual: {data.completedPoints}/{data.totalPoints} SP ({completionPercent}%)
            </span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="text-xs text-muted-foreground">
              Day {data.currentDay}/{data.totalDays}
            </span>
          </div>
        </div>
      )}

      {/* Chart */}
      <ResponsiveContainer width="100%" height={compact ? 120 : 200}>
        <LineChart data={chartData} margin={{ top: 5, right: 10, left: -10, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" opacity={0.5} />
          <XAxis
            dataKey="day"
            tick={{ fontSize: 10, fill: "var(--muted-foreground)" }}
            tickLine={false}
            axisLine={false}
          />
          <YAxis
            tick={{ fontSize: 10, fill: "var(--muted-foreground)" }}
            tickLine={false}
            axisLine={false}
          />
          <Tooltip
            contentStyle={{
              backgroundColor: "var(--card)",
              border: "1px solid var(--border)",
              borderRadius: "8px",
              fontSize: "12px",
            }}
          />
          <ReferenceLine
            x={`Day ${data.currentDay}`}
            stroke="var(--destructive)"
            strokeDasharray="4 4"
            opacity={0.5}
          />
          <Line
            type="monotone"
            dataKey="ideal"
            stroke="var(--muted-foreground)"
            strokeWidth={1.5}
            strokeDasharray="6 4"
            dot={false}
            name="Ideal"
          />
          <Line
            type="monotone"
            dataKey="actual"
            stroke="var(--primary)"
            strokeWidth={2}
            dot={false}
            name="Actual"
            connectNulls={false}
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
