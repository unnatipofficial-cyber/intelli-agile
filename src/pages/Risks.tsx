import { useState, useMemo } from "react";
import { useQuery, useMutation } from "convex/react";
import { api } from "../convex/_generated/api";
import { motion, AnimatePresence } from "framer-motion";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  ShieldAlert,
  Plus,
  Pencil,
  Trash2,
  AlertTriangle,
  TrendingUp,
  Timer,
  CheckCircle2,
} from "lucide-react";
import { toast } from "sonner";

const severityColors: Record<string, { bg: string; text: string; badge: string }> = {
  low: { bg: "bg-emerald-50 dark:bg-emerald-950/20", text: "text-emerald-600", badge: "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400" },
  medium: { bg: "bg-amber-50 dark:bg-amber-950/20", text: "text-amber-600", badge: "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400" },
  high: { bg: "bg-orange-50 dark:bg-orange-950/20", text: "text-orange-600", badge: "bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400" },
  critical: { bg: "bg-red-50 dark:bg-red-950/20", text: "text-red-600", badge: "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400" },
};

const statusIcons: Record<string, any> = {
  open: AlertTriangle,
  mitigated: ShieldAlert,
  closed: CheckCircle2,
  accepted: Timer,
};

interface RiskForm {
  title: string;
  description: string;
  probability: number;
  impact: number;
  severity: "low" | "medium" | "high" | "critical";
  status: "open" | "mitigated" | "closed" | "accepted";
  mitigationStrategy: string;
}

function calculateSeverity(prob: number, impact: number): "low" | "medium" | "high" | "critical" {
  const score = prob * impact;
  if (score >= 16) return "critical";
  if (score >= 10) return "high";
  if (score >= 5) return "medium";
  return "low";
}

function RiskFormDialog({
  open,
  onClose,
  projectId,
  editingRisk,
}: {
  open: boolean;
  onClose: () => void;
  projectId: string | undefined;
  editingRisk?: any;
}) {
  const createRisk = useMutation(api.risks.create);
  const updateRisk = useMutation(api.risks.update);
  const [form, setForm] = useState<RiskForm>(
    editingRisk
      ? {
          title: editingRisk.title,
          description: editingRisk.description || "",
          probability: editingRisk.probability,
          impact: editingRisk.impact,
          severity: editingRisk.severity,
          status: editingRisk.status,
          mitigationStrategy: editingRisk.mitigationStrategy || "",
        }
      : { title: "", description: "", probability: 3, impact: 3, severity: "medium", status: "open", mitigationStrategy: "" }
  );
  const [loading, setLoading] = useState(false);

  const severity = calculateSeverity(form.probability, form.impact);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.title.trim() || !projectId) return;
    setLoading(true);
    try {
      const data = { ...form, severity };
      if (editingRisk) {
        await updateRisk({ riskId: editingRisk._id, ...data });
        toast.success("Risk updated");
      } else {
        await createRisk({ projectId: projectId as any, ...data });
        toast.success("Risk created");
      }
      onClose();
    } catch {
      toast.error("Failed to save risk");
    }
    setLoading(false);
  };

  if (!projectId) return null;

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="glass-card max-w-lg">
        <DialogHeader>
          <DialogTitle>{editingRisk ? "Edit Risk" : "New Risk"}</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4 mt-4">
          <div>
            <label className="text-sm font-medium mb-1.5 block">Title</label>
            <Input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} placeholder="Risk title" required />
          </div>
          <div>
            <label className="text-sm font-medium mb-1.5 block">Description</label>
            <Textarea value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} placeholder="Risk description" rows={2} />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="text-sm font-medium mb-1.5 block">Probability (1-5)</label>
              <Input type="number" min={1} max={5} value={form.probability} onChange={(e) => setForm({ ...form, probability: parseInt(e.target.value) || 1 })} />
            </div>
            <div>
              <label className="text-sm font-medium mb-1.5 block">Impact (1-5)</label>
              <Input type="number" min={1} max={5} value={form.impact} onChange={(e) => setForm({ ...form, impact: parseInt(e.target.value) || 1 })} />
            </div>
          </div>
          <div className="flex items-center gap-3 p-3 rounded-xl bg-muted/50">
            <span className="text-sm text-muted-foreground">Score:</span>
            <span className="text-lg font-bold">{form.probability * form.impact}</span>
            <Badge className={cn("text-[10px] capitalize", severityColors[severity]?.badge)}>{severity}</Badge>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="text-sm font-medium mb-1.5 block">Status</label>
              <Select value={form.status} onValueChange={(v: any) => setForm({ ...form, status: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="open">Open</SelectItem>
                  <SelectItem value="mitigated">Mitigated</SelectItem>
                  <SelectItem value="accepted">Accepted</SelectItem>
                  <SelectItem value="closed">Closed</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <div>
            <label className="text-sm font-medium mb-1.5 block">Mitigation Strategy</label>
            <Textarea value={form.mitigationStrategy} onChange={(e) => setForm({ ...form, mitigationStrategy: e.target.value })} placeholder="How to mitigate this risk" rows={2} />
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <Button type="button" variant="outline" onClick={onClose}>Cancel</Button>
            <Button type="submit" disabled={loading}>{loading ? "Saving..." : editingRisk ? "Update" : "Create"}</Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}

export default function Risks() {
  const projects = useQuery(api.projects.list);
  const [selectedProjectId, setSelectedProjectId] = useState<string | null>(null);
  const risks = useQuery(
    api.risks.list,
    selectedProjectId ? { projectId: selectedProjectId as any } : "skip"
  );
  const deleteRisk = useMutation(api.risks.remove);
  const [showForm, setShowForm] = useState(false);
  const [editingRisk, setEditingRisk] = useState<any>(null);

  if (!selectedProjectId && projects && projects.length > 0) {
    setSelectedProjectId(projects[0]._id);
  }

  const sortedRisks = useMemo(() => {
    if (!risks) return [];
    return [...risks].sort((a, b) => b.score - a.score);
  }, [risks]);

  // Risk matrix data
  const matrixRisks = useMemo(() => {
    if (!risks) return [];
    return risks.filter((r) => r.status === "open");
  }, [risks]);

  const handleDelete = async (id: string) => {
    if (!confirm("Delete this risk?")) return;
    await deleteRisk({ riskId: id as any });
    toast.success("Risk deleted");
  };

  return (
    <div className="space-y-6 animate-fade-in-up">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Risk Management</h1>
          <p className="text-sm text-muted-foreground">Identify, assess, and mitigate project risks</p>
        </div>
        <Button onClick={() => { setEditingRisk(null); setShowForm(true); }} className="gap-2">
          <Plus className="w-4 h-4" /> New Risk
        </Button>
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

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
        {/* Risk Matrix */}
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          className="glass-card p-5"
        >
          <h3 className="text-sm font-bold mb-1">Risk Matrix</h3>
          <p className="text-xs text-muted-foreground mb-4">Probability vs Impact</p>
          <div className="relative">
            {/* Y-axis label */}
            <div className="absolute -left-6 top-1/2 -translate-y-1/2 -rotate-90 text-[10px] text-muted-foreground font-medium whitespace-nowrap">
              Probability →
            </div>
            {/* X-axis label */}
            <div className="text-center text-[10px] text-muted-foreground font-medium mb-2">Impact →</div>
            <div className="grid grid-cols-5 gap-1">
              {Array.from({ length: 5 }, (_, row) =>
                Array.from({ length: 5 }, (_, col) => {
                  const prob = 5 - row;
                  const impact = col + 1;
                  const score = prob * impact;
                  const cellRisks = matrixRisks.filter(
                    (r) => r.probability === prob && r.impact === impact
                  );
                  let bgClass = "bg-emerald-50 dark:bg-emerald-950/20";
                  if (score >= 16) bgClass = "bg-red-100 dark:bg-red-950/30";
                  else if (score >= 10) bgClass = "bg-orange-100 dark:bg-orange-950/20";
                  else if (score >= 5) bgClass = "bg-amber-50 dark:bg-amber-950/20";

                  return (
                    <div
                      key={`${row}-${col}`}
                      className={cn(
                        "aspect-square rounded-lg flex flex-col items-center justify-center text-[10px] relative",
                        bgClass,
                        cellRisks.length > 0 && "ring-2 ring-primary/30"
                      )}
                    >
                      <span className="font-semibold">{score}</span>
                      {cellRisks.length > 0 && (
                        <span className="absolute -top-1 -right-1 w-4 h-4 rounded-full bg-primary text-white text-[8px] flex items-center justify-center font-bold">
                          {cellRisks.length}
                        </span>
                      )}
                    </div>
                  );
                })
              )}
            </div>
          </div>
          {/* Legend */}
          <div className="flex items-center justify-center gap-3 mt-4 text-[10px] text-muted-foreground">
            <div className="flex items-center gap-1"><div className="w-3 h-3 rounded bg-emerald-100 dark:bg-emerald-950/20" /> Low</div>
            <div className="flex items-center gap-1"><div className="w-3 h-3 rounded bg-amber-50 dark:bg-amber-950/20" /> Medium</div>
            <div className="flex items-center gap-1"><div className="w-3 h-3 rounded bg-orange-100 dark:bg-orange-950/20" /> High</div>
            <div className="flex items-center gap-1"><div className="w-3 h-3 rounded bg-red-100 dark:bg-red-950/30" /> Critical</div>
          </div>
        </motion.div>

        {/* Risk List */}
        <div className="space-y-3">
          <AnimatePresence>
            {sortedRisks.map((risk, i) => {
              const StatusIcon = statusIcons[risk.status] || AlertTriangle;
              const colors = severityColors[risk.severity] || severityColors.medium;
              return (
                <motion.div
                  key={risk._id}
                  initial={{ opacity: 0, x: 12 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -12 }}
                  transition={{ delay: i * 0.03 }}
                  className="glass-card p-4 border-l-[3px]"
                  style={{ borderLeftColor: risk.severity === "critical" ? "#ef4444" : risk.severity === "high" ? "#f97316" : risk.severity === "medium" ? "#eab308" : "#22c55e" }}
                >
                  <div className="flex items-start justify-between mb-2">
                    <div className="flex items-center gap-2">
                      <StatusIcon className={cn("w-4 h-4", colors.text)} />
                      <h4 className="text-sm font-semibold">{risk.title}</h4>
                    </div>
                    <div className="flex items-center gap-1">
                      <Badge className={cn("text-[10px] capitalize", colors.badge)}>{risk.severity}</Badge>
                      <button onClick={() => { setEditingRisk(risk); setShowForm(true); }} className="p-1 rounded hover:bg-accent/50 text-muted-foreground">
                        <Pencil className="w-3 h-3" />
                      </button>
                      <button onClick={() => handleDelete(risk._id)} className="p-1 rounded hover:bg-accent/50 text-destructive">
                        <Trash2 className="w-3 h-3" />
                      </button>
                    </div>
                  </div>
                  {risk.description && <p className="text-xs text-muted-foreground mb-2">{risk.description}</p>}
                  <div className="flex items-center gap-4 text-xs">
                    <span className="text-muted-foreground">Score: <span className="font-bold text-foreground">{risk.score}</span></span>
                    <span className="text-muted-foreground">P: {risk.probability} × I: {risk.impact}</span>
                    <Badge variant="outline" className="text-[10px] capitalize">{risk.status}</Badge>
                    {risk.owner && (
                      <span className="text-muted-foreground ml-auto">
                        Owner: {(risk.owner as any)?.name || "Unassigned"}
                      </span>
                    )}
                  </div>
                  {risk.mitigationStrategy && (
                    <p className="text-xs text-muted-foreground mt-2 p-2 rounded-lg bg-muted/50">
                      <span className="font-medium">Mitigation:</span> {risk.mitigationStrategy}
                    </p>
                  )}
                </motion.div>
              );
            })}
          </AnimatePresence>
        </div>
      </div>

      {!sortedRisks.length && (
        <div className="text-center py-12">
          <ShieldAlert className="w-12 h-12 text-muted-foreground/30 mx-auto mb-3" />
          <p className="text-muted-foreground text-sm">No risks identified yet</p>
        </div>
      )}

      <RiskFormDialog
        open={showForm}
        onClose={() => { setShowForm(false); setEditingRisk(null); }}
        projectId={selectedProjectId || undefined}
        editingRisk={editingRisk}
      />
    </div>
  );
}
