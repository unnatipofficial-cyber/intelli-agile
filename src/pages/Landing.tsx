import { motion } from "framer-motion";
import { useNavigate } from "react-router";
import { Button } from "@/components/ui/button";
import {
  Zap,
  BarChart3,
  ShieldAlert,
  Brain,
  Columns3,
  Users,
  ArrowRight,
  CheckCircle2,
  Sparkles,
  TrendingUp,
  Target,
  Layers,
} from "lucide-react";

const features = [
  {
    icon: Brain,
    title: "AIE Intelligence",
    description: "AI-powered insights that analyze your project data and provide actionable recommendations.",
  },
  {
    icon: Columns3,
    title: "Sprint Board",
    description: "Visual Kanban board with drag-and-drop for managing tasks across your workflow.",
  },
  {
    icon: BarChart3,
    title: "Analytics & Reports",
    description: "Comprehensive charts and reports for velocity, burndown, workload, and progress tracking.",
  },
  {
    icon: ShieldAlert,
    title: "Risk Management",
    description: "Identify, assess, and mitigate risks with an interactive probability-impact matrix.",
  },
  {
    icon: Users,
    title: "Team Workload",
    description: "Visualize team capacity and prevent burnout with intelligent workload tracking.",
  },
  {
    icon: Target,
    title: "Backlog Management",
    description: "Full Agile backlog with epics, stories, tasks, bugs, and smart filtering.",
  },
];

const stats = [
  { value: "2.5x", label: "Faster Delivery" },
  { value: "40%", label: "Less Overhead" },
  { value: "98%", label: "Sprint Success" },
  { value: "100%", label: "Visibility" },
];

export default function Landing() {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen">
      {/* Nav */}
      <nav className="glass-topbar sticky top-0 z-50">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg aie-gradient flex items-center justify-center">
              <Zap className="w-4 h-4 text-white" />
            </div>
            <div>
              <span className="text-base font-bold tracking-tight">AIE</span>
              <span className="text-[9px] font-medium text-muted-foreground ml-1.5 hidden sm:inline">Agile Intelligence Engine</span>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="ghost" size="sm" onClick={() => navigate("/auth")}>
              Sign In
            </Button>
            <Button size="sm" onClick={() => navigate("/auth")} className="gap-1.5">
              Get Started <ArrowRight className="w-3.5 h-3.5" />
            </Button>
          </div>
        </div>
      </nav>

      {/* Hero */}
      <section className="relative overflow-hidden">
        {/* Background gradient */}
        <div className="absolute inset-0 bg-gradient-to-b from-primary/5 via-transparent to-transparent pointer-events-none" />
        <div className="absolute top-20 left-1/2 -translate-x-1/2 w-[600px] h-[600px] bg-primary/5 rounded-full blur-3xl pointer-events-none" />

        <div className="max-w-6xl mx-auto px-4 sm:px-6 pt-20 sm:pt-32 pb-20">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5 }}
            className="text-center max-w-3xl mx-auto"
          >
            <motion.div
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ delay: 0.1 }}
              className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-primary/10 text-primary text-xs font-medium mb-6"
            >
              <Sparkles className="w-3.5 h-3.5" />
              AI-Powered Agile Management
            </motion.div>

            <h1 className="text-4xl sm:text-5xl lg:text-6xl font-bold tracking-tight leading-tight mb-6">
              Manage Agile.
              <br />
              <span className="text-primary">Understand Progress.</span>
              <br />
              Predict Risk.
            </h1>

            <p className="text-base sm:text-lg text-muted-foreground max-w-xl mx-auto mb-8 leading-relaxed">
              AIE is an intelligent Agile project-management platform that helps teams manage projects, sprints, tasks, and risks — while an AI engine provides insights and early warnings.
            </p>

            <div className="flex items-center justify-center gap-3">
              <Button size="lg" onClick={() => navigate("/auth")} className="gap-2 px-6">
                Start Free <ArrowRight className="w-4 h-4" />
              </Button>
              <Button size="lg" variant="outline" onClick={() => navigate("/auth")} className="gap-2 px-6">
                View Demo
              </Button>
            </div>
          </motion.div>

          {/* Stats */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3 }}
            className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-20 max-w-2xl mx-auto"
          >
            {stats.map((stat, i) => (
              <motion.div
                key={stat.label}
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.4 + i * 0.1 }}
                className="text-center"
              >
                <p className="text-2xl sm:text-3xl font-bold text-primary">{stat.value}</p>
                <p className="text-xs text-muted-foreground mt-1">{stat.label}</p>
              </motion.div>
            ))}
          </motion.div>
        </div>
      </section>

      {/* Features */}
      <section className="py-20">
        <div className="max-w-6xl mx-auto px-4 sm:px-6">
          <motion.div
            initial={{ opacity: 0 }}
            whileInView={{ opacity: 1 }}
            viewport={{ once: true }}
            className="text-center mb-12"
          >
            <h2 className="text-2xl sm:text-3xl font-bold tracking-tight mb-3">Everything you need to manage Agile</h2>
            <p className="text-sm text-muted-foreground max-w-lg mx-auto">
              Built for modern software teams. From sprint planning to risk prediction.
            </p>
          </motion.div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {features.map((feature, i) => (
              <motion.div
                key={feature.title}
                initial={{ opacity: 0, y: 16 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: i * 0.08 }}
                className="glass-card p-6"
              >
                <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center mb-4">
                  <feature.icon className="w-5 h-5 text-primary" />
                </div>
                <h3 className="text-sm font-bold mb-2">{feature.title}</h3>
                <p className="text-xs text-muted-foreground leading-relaxed">{feature.description}</p>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="py-20">
        <div className="max-w-6xl mx-auto px-4 sm:px-6">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="glass-card p-8 sm:p-12 text-center relative overflow-hidden"
          >
            <div className="absolute inset-0 bg-gradient-to-br from-primary/5 via-transparent to-transparent pointer-events-none" />
            <div className="relative">
              <div className="w-12 h-12 rounded-2xl aie-gradient flex items-center justify-center mx-auto mb-4">
                <Zap className="w-6 h-6 text-white" />
              </div>
              <h2 className="text-2xl sm:text-3xl font-bold tracking-tight mb-3">
                Ready to build smarter?
              </h2>
              <p className="text-sm text-muted-foreground max-w-md mx-auto mb-6">
                Join teams using AIE to manage sprints, track risks, and get AI-powered insights for faster delivery.
              </p>
              <Button size="lg" onClick={() => navigate("/auth")} className="gap-2 px-8">
                Get Started Free <ArrowRight className="w-4 h-4" />
              </Button>
            </div>
          </motion.div>
        </div>
      </section>

      {/* Footer */}
      <footer className="py-8 border-t border-border/50">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Zap className="w-4 h-4 text-primary" />
            <span className="text-xs font-semibold">AIE</span>
          </div>
          <p className="text-xs text-muted-foreground">© 2026 AIE. Agile Intelligence Engine.</p>
        </div>
      </footer>
    </div>
  );
}
