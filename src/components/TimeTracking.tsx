import { useState } from "react";
import { useMutation, useQuery } from "convex/react";
import { api } from "../convex/_generated/api";
import { Id } from "../convex/_generated/dataModel";
import { motion, AnimatePresence } from "framer-motion";
import { Clock, Plus, Trash2 } from "lucide-react";

interface TimeTrackingProps {
  taskId: Id<"tasks">;
  projectId: Id<"projects">;
}

function formatMinutes(minutes: number): string {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  if (h === 0) return `${m}m`;
  if (m === 0) return `${h}h`;
  return `${h}h ${m}m`;
}

function timeAgo(timestamp: number): string {
  const diff = Date.now() - timestamp;
  const days = Math.floor(diff / 86400000);
  if (days === 0) return "Today";
  if (days === 1) return "Yesterday";
  return `${days}d ago`;
}

export default function TimeTracking({ taskId, projectId }: TimeTrackingProps) {
  const entries = useQuery(api.timeTracking.listByTask, { taskId });
  const totalMinutes = useQuery(api.timeTracking.getTaskTotal, { taskId });
  const addEntry = useMutation(api.timeTracking.addEntry);
  const removeEntry = useMutation(api.timeTracking.removeEntry);

  const [minutes, setMinutes] = useState("");
  const [description, setDescription] = useState("");
  const [adding, setAdding] = useState(false);

  const handleAdd = async () => {
    const mins = parseInt(minutes);
    if (!mins || mins <= 0) return;
    setAdding(true);
    try {
      await addEntry({
        taskId,
        projectId,
        minutes: mins,
        description: description.trim() || undefined,
        date: Date.now(),
      });
      setMinutes("");
      setDescription("");
    } finally {
      setAdding(false);
    }
  };

  if (!entries || totalMinutes === undefined) {
    return (
      <div className="p-4 space-y-2">
        {[1, 2].map((i) => (
          <div key={i} className="h-8 bg-muted rounded animate-pulse" />
        ))}
      </div>
    );
  }

  return (
    <div className="p-4">
      {/* Total */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <Clock className="w-4 h-4 text-muted-foreground" />
          <span className="text-sm font-medium">Time Logged</span>
        </div>
        <span className="text-lg font-bold text-primary">{formatMinutes(totalMinutes)}</span>
      </div>

      {/* Entries */}
      <div className="space-y-1.5 mb-4 max-h-48 overflow-y-auto">
        <AnimatePresence>
          {entries.map((entry) => (
            <motion.div
              key={entry._id}
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: "auto" }}
              exit={{ opacity: 0, height: 0 }}
              className="flex items-center gap-3 px-3 py-2 rounded-lg bg-muted/30 group"
            >
              <span className="text-sm font-medium w-12">{formatMinutes(entry.minutes)}</span>
              <div className="flex-1 min-w-0">
                <p className="text-xs truncate">{entry.description || "No description"}</p>
                <p className="text-[10px] text-muted-foreground">
                  {entry.userName} · {timeAgo(entry.createdAt)}
                </p>
              </div>
              <button
                onClick={() => removeEntry({ entryId: entry._id })}
                className="opacity-0 group-hover:opacity-100 transition-opacity"
              >
                <Trash2 className="w-3 h-3 text-muted-foreground hover:text-red-500" />
              </button>
            </motion.div>
          ))}
        </AnimatePresence>

        {entries.length === 0 && (
          <p className="text-xs text-muted-foreground text-center py-4">No time logged yet</p>
        )}
      </div>

      {/* Add form */}
      <div className="flex gap-2">
        <input
          type="number"
          value={minutes}
          onChange={(e) => setMinutes(e.target.value)}
          placeholder="Min"
          min="1"
          className="w-16 text-xs px-2 py-2 rounded-lg border border-border/50 bg-background outline-none focus:border-primary/50 text-center"
        />
        <input
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") handleAdd();
          }}
          placeholder="What did you do?"
          className="flex-1 text-xs px-3 py-2 rounded-lg border border-border/50 bg-background outline-none focus:border-primary/50"
        />
        <button
          onClick={handleAdd}
          disabled={!minutes || parseInt(minutes) <= 0 || adding}
          className="px-3 py-2 rounded-lg bg-primary text-primary-foreground disabled:opacity-40"
        >
          <Plus className="w-3 h-3" />
        </button>
      </div>
    </div>
  );
}
