import { useMemo } from "react";
import { motion } from "framer-motion";
import { staggeredEnter } from "@/lib/motion";

interface GanttItem {
  id: string;
  name: string;
  start: number; // timestamp
  end: number; // timestamp
  progress: number; // 0-100
  type: "sprint" | "epic" | "task";
  status?: string;
}

interface GanttChartProps {
  items: GanttItem[];
  startDate?: number;
  endDate?: number;
}

const typeColors: Record<string, { bg: string; bar: string; text: string }> = {
  sprint: { bg: "bg-primary/5", bar: "bg-primary", text: "text-primary" },
  epic: { bg: "bg-blue-500/5", bar: "bg-blue-500", text: "text-blue-500" },
  task: { bg: "bg-muted/30", bar: "bg-muted-foreground/60", text: "text-muted-foreground" },
};

export default function GanttChart({ items, startDate, endDate }: GanttChartProps) {
  const { timelineStart, timelineEnd, totalDays, dayWidth } = useMemo(() => {
    if (items.length === 0) {
      const now = Date.now();
      return {
        timelineStart: now - 7 * 86400000,
        timelineEnd: now + 30 * 86400000,
        totalDays: 37,
        dayWidth: 40,
      };
    }

    const minStart = startDate || Math.min(...items.map((i) => i.start));
    const maxEnd = endDate || Math.max(...items.map((i) => i.end));
    // Add padding
    const padding = 2 * 86400000;
    const start = minStart - padding;
    const end = maxEnd + padding;
    const days = Math.ceil((end - start) / 86400000);
    return {
      timelineStart: start,
      timelineEnd: end,
      totalDays: days,
      dayWidth: Math.max(30, Math.min(50, 800 / days)),
    };
  }, [items, startDate, endDate]);

  if (items.length === 0) {
    return (
      <div className="text-center py-12">
        <p className="text-sm text-muted-foreground">No timeline data</p>
        <p className="text-xs text-muted-foreground/60 mt-1">Add sprints or tasks to see the Gantt chart</p>
      </div>
    );
  }

  const getPosition = (timestamp: number) => {
    const days = (timestamp - timelineStart) / 86400000;
    return days * dayWidth;
  };

  const getWidth = (start: number, end: number) => {
    const days = (end - start) / 86400000;
    return Math.max(days * dayWidth, dayWidth * 0.5);
  };

  // Generate month headers
  const months: { label: string; startDay: number }[] = [];
  let currentMonth = -1;
  for (let d = 0; d <= totalDays; d++) {
    const date = new Date(timelineStart + d * 86400000);
    const month = date.getMonth();
    if (month !== currentMonth) {
      months.push({
        label: date.toLocaleDateString("en-US", { month: "short", year: "2-digit" }),
        startDay: d,
      });
      currentMonth = month;
    }
  }

  return (
    <div className="overflow-x-auto">
      <div style={{ minWidth: totalDays * dayWidth + 200 }}>
        {/* Month headers */}
        <div className="flex border-b border-border/50">
          <div className="w-48 shrink-0 px-3 py-2 text-xs font-medium text-muted-foreground">Item</div>
          <div className="flex-1 relative h-8">
            {months.map((month, i) => {
              const nextStart = months[i + 1]?.startDay || totalDays;
              const width = (nextStart - month.startDay) * dayWidth;
              return (
                <div
                  key={i}
                  className="absolute top-0 h-full flex items-center px-2 text-[11px] text-muted-foreground/70 border-l border-border/30"
                  style={{ left: month.startDay * dayWidth, width }}
                >
                  {month.label}
                </div>
              );
            })}
          </div>
        </div>

        {/* Rows */}
        {items.map((item, i) => {
          const colors = typeColors[item.type] || typeColors.task;
          return (
            <motion.div
              key={item.id}
              initial={{ opacity: 0, x: -10 }}
              animate={{ opacity: 1, x: 0 }}
              transition={staggeredEnter(i)}
              className={`flex border-b border-border/30 ${colors.bg}`}
            >
              <div className="w-48 shrink-0 px-3 py-2.5 flex items-center gap-2">
                <span className={`text-[10px] uppercase font-medium ${colors.text}`}>
                  {item.type.charAt(0)}
                </span>
                <span className="text-xs truncate">{item.name}</span>
              </div>
              <div className="flex-1 relative h-10 flex items-center">
                {/* Day grid lines */}
                {Array.from({ length: totalDays }).map((_, d) => (
                  <div
                    key={d}
                    className="absolute top-0 h-full border-l border-border/20"
                    style={{ left: d * dayWidth }}
                  />
                ))}

                {/* Bar */}
                <div
                  className="absolute h-5 rounded-sm overflow-hidden"
                  style={{
                    left: getPosition(item.start),
                    width: getWidth(item.start, item.end),
                  }}
                >
                  <div className="w-full h-full bg-muted/50 rounded-sm" />
                  <div
                    className={`absolute top-0 left-0 h-full ${colors.bar} rounded-sm opacity-80`}
                    style={{ width: `${item.progress}%` }}
                  />
                </div>
              </div>
            </motion.div>
          );
        })}
      </div>
    </div>
  );
}
