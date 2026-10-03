import { useState } from "react";
import { useMutation, useQuery } from "convex/react";
import { api } from "../convex/_generated/api";
import { Id } from "../convex/_generated/dataModel";
import { motion, AnimatePresence } from "framer-motion";
import { ThumbsUp, AlertCircle, Zap, Plus, X, Trash2 } from "lucide-react";

interface RetroBoardProps {
  sprintId: Id<"sprints">;
  projectId: Id<"projects">;
}

/**
 * Column treatments run on theme tokens rather than fixed palette names.
 * Emerald/amber/blue are literal Tailwind colours: they ignore the active
 * theme entirely, which is exactly how a board ends up looking pasted onto
 * the page. `chart-1`/`chart-3`/`primary` carry the same semantics — positive,
 * caution, act — and re-tint with the theme.
 */
const columns = [
  {
    key: "wentWell" as const,
    title: "What Went Well",
    icon: <ThumbsUp className="w-4 h-4" />,
    color: "text-chart-1",
    bgColor: "bg-chart-1/5",
    borderColor: "border-chart-1/25",
    placeholder: "What did the team do well?",
  },
  {
    key: "toImprove" as const,
    title: "To Improve",
    icon: <AlertCircle className="w-4 h-4" />,
    color: "text-chart-3",
    bgColor: "bg-chart-3/5",
    borderColor: "border-chart-3/25",
    placeholder: "What could be better?",
  },
  {
    key: "actionItems" as const,
    title: "Action Items",
    icon: <Zap className="w-4 h-4" />,
    color: "text-primary",
    bgColor: "bg-primary/5",
    borderColor: "border-primary/25",
    placeholder: "What will we do differently?",
  },
];

export default function RetroBoard({ sprintId, projectId }: RetroBoardProps) {
  const retro = useQuery(api.retrospectives.getBySprint, { sprintId });
  const upsert = useMutation(api.retrospectives.upsert);
  const addItem = useMutation(api.retrospectives.addItem);
  const removeItem = useMutation(api.retrospectives.removeItem);

  const [newItems, setNewItems] = useState<Record<string, string>>({});

  const handleAddItem = async (category: "wentWell" | "toImprove" | "actionItems") => {
    const text = newItems[category]?.trim();
    if (!text) return;

    if (retro) {
      await addItem({ sprintId, category, item: text });
    } else {
      // Create retro with first item
      const wentWell = category === "wentWell" ? [text] : [];
      const toImprove = category === "toImprove" ? [text] : [];
      const actionItems = category === "actionItems" ? [text] : [];
      await upsert({ sprintId, projectId, wentWell, toImprove, actionItems });
    }
    setNewItems({ ...newItems, [category]: "" });
  };

  const handleRemoveItem = async (category: "wentWell" | "toImprove" | "actionItems", index: number) => {
    if (!retro) return;
    await removeItem({ sprintId, category, index });
  };

  const getColumnItems = (key: "wentWell" | "toImprove" | "actionItems"): string[] => {
    if (!retro) return [];
    return (retro[key] as string[]) || [];
  };

  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
      {columns.map((col) => {
        const items = getColumnItems(col.key);
        return (
          <div
            key={col.key}
            className={`rounded-xl border ${col.borderColor} ${col.bgColor} p-4`}
          >
            <div className="flex items-center gap-2 mb-4">
              <span className={col.color}>{col.icon}</span>
              <h3 className="text-sm font-semibold">{col.title}</h3>
              <span className="text-xs text-muted-foreground ml-auto">{items.length}</span>
            </div>

            {/* Items */}
            <div className="space-y-2 mb-3">
              <AnimatePresence>
                {items.map((item, i) => (
                  <motion.div
                    key={`${col.key}-${i}`}
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -8 }}
                    className="group flex items-start gap-2 p-2.5 rounded-lg bg-background/80 border border-border/30"
                  >
                    <span className="text-xs text-muted-foreground/50 mt-0.5 shrink-0">{i + 1}</span>
                    <p className="text-sm flex-1">{item}</p>
                    <button
                      onClick={() => handleRemoveItem(col.key, i)}
                      className="opacity-0 group-hover:opacity-100 transition-opacity"
                    >
                      <Trash2 className="w-3 h-3 text-muted-foreground hover:text-red-500" />
                    </button>
                  </motion.div>
                ))}
              </AnimatePresence>

              {items.length === 0 && (
                <p className="text-xs text-muted-foreground/50 text-center py-4">
                  No items yet
                </p>
              )}
            </div>

            {/* Add input */}
            <div className="flex gap-2">
              <input
                value={newItems[col.key] || ""}
                onChange={(e) => setNewItems({ ...newItems, [col.key]: e.target.value })}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    handleAddItem(col.key);
                  }
                }}
                placeholder={col.placeholder}
                className="flex-1 text-xs px-3 py-2 rounded-lg border border-border/50 bg-background/60 outline-none focus:border-primary/50"
              />
              <button
                onClick={() => handleAddItem(col.key)}
                disabled={!newItems[col.key]?.trim()}
                className="p-2 rounded-lg bg-primary text-primary-foreground disabled:opacity-40"
              >
                <Plus className="w-3 h-3" />
              </button>
            </div>
          </div>
        );
      })}
    </div>
  );
}
