import { motion, useScroll, useTransform } from "framer-motion";
import {
  Activity,
  ArrowRight,
  ArrowUpRight,
  BarChart3,
  Brain,
  CheckCircle2,
  Clock,
  Columns3,
  Gauge,
  Layers,
  ListChecks,
  Radar,
  ShieldAlert,
  Sparkles,
  Target,
  TrendingUp,
  Users,
  Zap,
} from "lucide-react";
import { lazy, Suspense, useCallback, useRef, useState } from "react";
import { useNavigate } from "react-router";
import { AIELogo } from "@/components/AIELogo";
import { ErrorBoundary } from "@/components/ErrorBoundary";
import { AnimatedCounter } from "@/components/landing/AnimatedCounter";
import { ScrollProgressBar } from "@/components/landing/ScrollProgressBar";
import { ScrollReveal } from "@/components/landing/ScrollReveal";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useScrollSpine } from "@/hooks/use-scroll-spine";
import { useThemePalette } from "@/hooks/use-theme-palette";
import { prefersReducedMotion, supportsWebGL } from "@/lib/motion-prefs";

/** three.js only loads when a WebGL context is actually available. */
const Hero3DScene = lazy(() => import("@/components/landing/Hero3DScene"));

const AUTH_ROUTE = "/auth/ui";

const features = [
  {
    icon: Brain,
    title: "AIE Intelligence",
    description:
      "Analyse project data in real time and receive actionable recommendations on sprint health, team capacity and risk exposure.",
  },
  {
    icon: Columns3,
    title: "Sprint Board",
    description:
      "A visual Kanban interface with drag and drop. Move work across To Do, In Progress, Review and Done in a single gesture.",
  },
  {
    icon: BarChart3,
    title: "Analytics & Reports",
    description:
      "Velocity trends, burndown charts, workload distribution and progress metrics, updated as your team works.",
  },
  {
    icon: ShieldAlert,
    title: "Risk Management",
    description:
      "Map risks on an interactive probability-impact matrix. Track severity, owners and mitigation strategies.",
  },
  {
    icon: Users,
    title: "Team Workload",
    description:
      "See who is overloaded and who has capacity. Balance assignments across the team with clear visual indicators.",
  },
  {
    icon: Target,
    title: "Backlog & Tasks",
    description:
      "Organise work with epics, user stories, tasks and bugs. Filter by priority, status, assignee or sprint.",
  },
];

const marqueeItems = [
  "Sprint planning",
  "Backlog grooming",
  "Velocity tracking",
  "Burndown",
  "Risk radar",
  "Capacity planning",
  "Workload balance",
  "AI insights",
  "Retrospectives",
  "Time tracking",
  "Probability × impact",
  "Project health",
];

const stats = [
  { value: 6, suffix: "", label: "Product modules", detail: "Dashboard, Backlog, Sprint Board, Tasks, Team, Risks" },
  { value: 4, suffix: "", label: "Sprint stages", detail: "To Do → In Progress → Review → Done" },
  { value: 6, suffix: "", label: "Analytics views", detail: "Velocity, completion, progress, priority, workload, risk" },
  { value: 3, suffix: "", label: "Appearance themes", detail: "Graphite, Modern Minimal, Darkmatter" },
];

const steps = [
  {
    icon: Layers,
    title: "Model the work",
    body: "Create a project, then break it down into epics, user stories, tasks and bugs. Or seed a realistic sample workspace in one click and start exploring immediately.",
    points: ["Epics, stories, tasks and bugs", "Story points, labels and due dates", "One-click sample data"],
  },
  {
    icon: Columns3,
    title: "Plan and run the sprint",
    body: "Move work across To Do, In Progress, Review and Done. Assign owners, set priorities and keep the board honest as the sprint progresses.",
    points: ["Drag-and-drop Kanban", "Assignees and priorities", "Filters across the whole workspace"],
  },
  {
    icon: Radar,
    title: "Read the signal",
    body: "Your activity becomes velocity trends, burndown, workload distribution and a probability-impact risk matrix — with the AI engine pointing at what needs attention next.",
    points: ["Velocity and burndown", "Workload and capacity", "AI notes on sprint health"],
  },
];

const intelligencePoints = [
  { icon: Activity, text: "Sprint health summarised in plain language from your own data" },
  { icon: ShieldAlert, text: "Risk exposure flagged before it turns into a missed date" },
  { icon: Gauge, text: "Capacity and workload, so nobody quietly becomes the bottleneck" },
  { icon: ListChecks, text: "Ask-the-engine chat grounded in the project you are looking at" },
];

const insightSample = {
  headline: "Sprint 14 is trending 18% under planned velocity",
  body: "Two of six in-progress stories have been open for more than four days and both are owned by the same developer.",
  suggestions: [
    "Rebalance one story to a teammate with spare capacity",
    "Split the largest story before standup",
    "Confirm the payment provider risk owner",
  ],
  risks: [
    { label: "Payment provider migration", level: "Critical", tone: "destructive" as const },
    { label: "Single-owner dependency", level: "High", tone: "default" as const },
    { label: "Scope creep in search", level: "Medium", tone: "secondary" as const },
  ],
};

function HeroBackdrop() {
  return (
    <div aria-hidden="true" className="pointer-events-none absolute inset-0 flex items-center justify-center">
      <div className="absolute h-[78%] w-[78%] rounded-full bg-primary/10 blur-3xl" />
      <div className="absolute h-[86%] w-[86%] rounded-full border border-border/20" />
      <div className="absolute h-[66%] w-[66%] rounded-full border border-border/30" />
      <div className="absolute h-[46%] w-[46%] rounded-full border border-border/40" />
      <div className="absolute h-[46%] w-[46%] rounded-full aie-gradient opacity-[0.07] blur-2xl" />
    </div>
  );
}

function RiskLevel({ label, tone }: { label: string; tone: "destructive" | "default" | "secondary" }) {
  const map = {
    destructive: "border-destructive/40 bg-destructive/10 text-destructive",
    default: "border-primary/40 bg-primary/10 text-primary",
    secondary: "border-border bg-muted text-muted-foreground",
  } as const;
  return <span className={`rounded-md border px-2 py-0.5 text-[10px] font-semibold ${map[tone]}`}>{label}</span>;
}

export default function Landing() {
  const navigate = useNavigate();
  const palette = useThemePalette();
  const heroRef = useRef<HTMLElement>(null);
  const spine = useScrollSpine<HTMLDivElement>();

  // Sensible one-time capability checks (no re-render churn).
  const [canRender3D] = useState(() => supportsWebGL());
  const [motionOk] = useState(() => !prefersReducedMotion());

  const { scrollYProgress } = useScroll({
    target: heroRef,
    offset: ["start start", "end start"],
  });
  const copyY = useTransform(scrollYProgress, [0, 1], [0, 90]);
  const copyOpacity = useTransform(scrollYProgress, [0, 0.9], [1, 0]);
  const sceneY = useTransform(scrollYProgress, [0, 1], [0, -60]);

  const goToAuth = useCallback(() => navigate(AUTH_ROUTE), [navigate]);

  const scrollTo = useCallback((id: string) => {
    const target = document.getElementById(id);
    if (!target) return;
    target.scrollIntoView({ behavior: prefersReducedMotion() ? "auto" : "smooth", block: "start" });
  }, []);

  const navLinks = [
    { id: "features", label: "Features" },
    { id: "how", label: "How it works" },
    { id: "intelligence", label: "Intelligence" },
  ];

  return (
    <div className="min-h-screen overflow-x-hidden">
      <ScrollProgressBar />

      {/* ── Nav ─────────────────────────────────────────────── */}
      <nav className="glass-topbar sticky top-0 z-50">
        <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-4 sm:px-6">
          <button
            type="button"
            onClick={() => scrollTo("top")}
            className="flex items-center gap-2.5 rounded-lg px-1 py-1 text-left"
          >
            <AIELogo size="sm" />
            <span className="flex items-baseline gap-1.5">
              <span className="text-base font-bold tracking-tight">AIE</span>
              <span className="hidden text-[9px] font-medium text-muted-foreground sm:inline">
                Agile Intelligence Engine
              </span>
            </span>
          </button>

          <div className="hidden items-center gap-1 md:flex">
            {navLinks.map((link) => (
              <button
                key={link.id}
                type="button"
                onClick={() => scrollTo(link.id)}
                className="rounded-lg px-3 py-2 text-xs font-medium text-muted-foreground transition-colors hover:bg-accent/50 hover:text-foreground"
              >
                {link.label}
              </button>
            ))}
          </div>

          <div className="flex items-center gap-2">
            <Button variant="ghost" size="sm" onClick={goToAuth}>
              Sign In
            </Button>
            <Button size="sm" onClick={goToAuth} className="gap-1.5">
              Get Started <ArrowRight className="h-3.5 w-3.5" />
            </Button>
          </div>
        </div>
      </nav>

      {/* ── Hero ────────────────────────────────────────────── */}
      <section id="top" ref={heroRef} className="relative overflow-hidden">
        <div aria-hidden="true" className="landing-grid absolute inset-0" />
        <div
          aria-hidden="true"
          className="landing-aurora absolute -left-24 top-10 h-[420px] w-[420px] rounded-full bg-primary/20"
        />
        <div
          aria-hidden="true"
          className="landing-aurora absolute -right-16 top-40 h-[360px] w-[360px] rounded-full bg-primary/10"
          style={{ animationDelay: "-6s" }}
        />

        <div className="relative mx-auto grid max-w-6xl items-center gap-12 px-4 pt-16 pb-20 sm:px-6 sm:pt-24 lg:grid-cols-[1.04fr_0.96fr] lg:gap-8 lg:pt-28">
          {/* Copy */}
          <motion.div style={motionOk ? { y: copyY, opacity: copyOpacity } : undefined} className="max-w-2xl">
            <ScrollReveal trigger="mount" selector="[data-intro]" delay={110} y={18} duration={720}>
              <div data-intro>
                <Badge
                  variant="outline"
                  className="gap-1.5 rounded-full border-primary/30 bg-primary/10 px-3 py-1 text-[11px] font-medium text-primary"
                >
                  <Sparkles className="h-3.5 w-3.5" />
                  AI-powered Agile intelligence
                </Badge>
              </div>

              <h1 className="mt-6 text-4xl leading-[1.06] font-bold tracking-tight sm:text-5xl lg:text-[3.4rem]">
                <ScrollReveal
                  as="span"
                  className="block"
                  trigger="mount"
                  selector="[data-hero-line]"
                  delay={130}
                  y="112%"
                  duration={920}
                  ease="out(4)"
                >
                  <span className="block overflow-hidden pb-1">
                    <span data-hero-line className="block">
                      Manage Agile.
                    </span>
                  </span>
                  <span className="block overflow-hidden pb-1">
                    <span data-hero-line className="landing-shine block">
                      Understand Progress.
                    </span>
                  </span>
                  <span className="block overflow-hidden pb-1">
                    <span data-hero-line className="block">
                      Predict Risk.
                    </span>
                  </span>
                </ScrollReveal>
              </h1>

              <p className="mt-6 max-w-xl text-sm leading-relaxed text-muted-foreground sm:text-base">
                AIE is an intelligent Agile platform that helps software teams plan sprints, manage tasks, track
                progress and analyse risks — while an AI engine surfaces insights and early warnings before problems
                escalate.
              </p>

              <div data-intro className="mt-8 flex flex-wrap items-center gap-3">
                <Button size="lg" onClick={goToAuth} className="gap-2 px-6">
                  Open the dashboard <ArrowRight className="h-4 w-4" />
                </Button>
                <Button size="lg" variant="outline" onClick={() => scrollTo("how")} className="gap-2 px-6">
                  See how it works
                </Button>
              </div>

              <ul data-intro className="mt-7 flex flex-wrap items-center gap-x-5 gap-y-2">
                {["Email code or guest sign-in", "Three appearance themes", "Ships with sample data"].map((item) => (
                  <li key={item} className="flex items-center gap-1.5 text-xs text-muted-foreground">
                    <CheckCircle2 className="h-3.5 w-3.5 text-primary" />
                    {item}
                  </li>
                ))}
              </ul>
            </ScrollReveal>
          </motion.div>

          {/* 3D scene */}
          <motion.div
            style={motionOk ? { y: sceneY } : undefined}
            className="relative mx-auto h-[330px] w-full max-w-[520px] sm:h-[420px] lg:h-[540px] lg:max-w-none"
          >
            <HeroBackdrop />
            {canRender3D ? (
              /* Fallbacks are intentionally empty: the CSS backdrop above is
                 already a complete hero illustration if WebGL is unavailable. */
              <ErrorBoundary fallback={<div aria-hidden="true" />}>
                <Suspense fallback={<div aria-hidden="true" />}>
                  <div className="absolute inset-0">
                    <Hero3DScene palette={palette} animated={motionOk} />
                  </div>
                </Suspense>
              </ErrorBoundary>
            ) : null}
          </motion.div>
        </div>

        {/* Marquee */}
        <div className="relative border-y border-border/40 py-3">
          <div className="landing-marquee">
            {[0, 1].map((pass) => (
              <div key={pass} className="flex shrink-0 items-center">
                {marqueeItems.map((item) => (
                  <span key={`${pass}-${item}`} className="flex items-center">
                    <span className="px-5 text-[11px] font-medium tracking-wide text-muted-foreground uppercase">
                      {item}
                    </span>
                    <span aria-hidden="true" className="h-1 w-1 rounded-full bg-primary/50" />
                  </span>
                ))}
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Stats ───────────────────────────────────────────── */}
      <section className="py-16 sm:py-20">
        <div className="mx-auto max-w-6xl px-4 sm:px-6">
          <ScrollReveal className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4" delay={80} y={22}>
            {stats.map((stat) => (
              <div key={stat.label} className="glass-card p-5">
                <p className="text-3xl font-bold tracking-tight text-primary">
                  <AnimatedCounter to={stat.value} suffix={stat.suffix} />
                </p>
                <p className="mt-1.5 text-sm font-semibold">{stat.label}</p>
                <p className="mt-1 text-[11px] leading-relaxed text-muted-foreground">{stat.detail}</p>
              </div>
            ))}
          </ScrollReveal>
        </div>
      </section>

      {/* ── Features ────────────────────────────────────────── */}
      <section id="features" className="scroll-mt-20 py-12 sm:py-16">
        <div className="mx-auto max-w-6xl px-4 sm:px-6">
          <ScrollReveal className="mx-auto mb-12 max-w-2xl text-center" delay={0} y={20}>
            <p className="text-[11px] font-semibold tracking-[0.18em] text-primary uppercase">
              Everything in one place
            </p>
            <h2 className="mt-3 text-2xl font-bold tracking-tight sm:text-3xl">
              Built for how software teams actually work
            </h2>
            <p className="mt-3 text-sm leading-relaxed text-muted-foreground">
              From sprint planning to risk prediction, AIE gives your team a single place to plan, execute and
              understand progress.
            </p>
          </ScrollReveal>

          <ScrollReveal
            className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3"
            delay={85}
            y={26}
            scaleFrom={0.97}
          >
            {features.map((feature) => (
              <article key={feature.title} className="glass-card group h-full p-6">
                <div className="mb-4 flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10 transition-colors group-hover:bg-primary/15">
                  <feature.icon className="h-5 w-5 text-primary" />
                </div>
                <h3 className="mb-2 flex items-center gap-1.5 text-sm font-bold">
                  {feature.title}
                  <ArrowUpRight className="h-3.5 w-3.5 text-muted-foreground opacity-0 transition-opacity group-hover:opacity-100" />
                </h3>
                <p className="text-xs leading-relaxed text-muted-foreground">{feature.description}</p>
              </article>
            ))}
          </ScrollReveal>
        </div>
      </section>

      {/* ── How it works (scroll-scrubbed spine) ────────────── */}
      <section id="how" className="scroll-mt-20 py-16 sm:py-20">
        <div className="mx-auto max-w-6xl px-4 sm:px-6">
          <ScrollReveal className="mb-14 max-w-2xl" delay={0} y={20}>
            <p className="text-[11px] font-semibold tracking-[0.18em] text-primary uppercase">How it works</p>
            <h2 className="mt-3 text-2xl font-bold tracking-tight sm:text-3xl">
              Three moves from blank page to clear signal
            </h2>
            <p className="mt-3 text-sm leading-relaxed text-muted-foreground">
              The line on the left fills as you scroll — the same way AIE fills in the picture of your project as the
              team works.
            </p>
          </ScrollReveal>

          <div ref={spine.host} className="grid grid-cols-[2px_1fr] gap-6 sm:gap-10">
            <div className="relative w-[2px] overflow-hidden rounded-full bg-border/50">
              <span
                ref={spine.fill}
                aria-hidden="true"
                className="aie-gradient absolute inset-x-0 top-0 h-full origin-top"
              />
            </div>

            <div className="space-y-6">
              {steps.map((step, index) => (
                <ScrollReveal key={step.title} delay={0} y={30}>
                  <article className="glass-card relative p-6 sm:p-7">
                    <div className="flex flex-wrap items-center gap-3">
                      <span className="flex h-10 w-10 items-center justify-center rounded-xl aie-gradient text-sm font-bold text-white">
                        {index + 1}
                      </span>
                      <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10">
                        <step.icon className="h-5 w-5 text-primary" />
                      </span>
                      <h3 className="text-base font-bold">{step.title}</h3>
                    </div>
                    <p className="mt-4 text-xs leading-relaxed text-muted-foreground sm:text-sm">{step.body}</p>
                    <ul className="mt-4 flex flex-wrap gap-2">
                      {step.points.map((point) => (
                        <li
                          key={point}
                          className="rounded-full border border-border/60 bg-muted/40 px-2.5 py-1 text-[11px] text-muted-foreground"
                        >
                          {point}
                        </li>
                      ))}
                    </ul>
                  </article>
                </ScrollReveal>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* ── Intelligence ────────────────────────────────────── */}
      <section id="intelligence" className="scroll-mt-20 py-16 sm:py-20">
        <div className="mx-auto max-w-6xl px-4 sm:px-6">
          <div className="grid items-center gap-10 lg:grid-cols-2 lg:gap-14">
            <ScrollReveal delay={0} y={24}>
              <p className="text-[11px] font-semibold tracking-[0.18em] text-primary uppercase">AIE Intelligence</p>
              <h2 className="mt-3 text-2xl font-bold tracking-tight sm:text-3xl">
                An engine that reads the same board your team does
              </h2>
              <p className="mt-4 text-sm leading-relaxed text-muted-foreground">
                AIE does not invent metrics. It reads the stories, sprints, risks and time entries already on your
                board and turns them into something a human can act on before the sprint ends.
              </p>
              <ul className="mt-6 space-y-3">
                {intelligencePoints.map((point) => (
                  <li key={point.text} className="flex items-start gap-3">
                    <span className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-primary/10">
                      <point.icon className="h-3.5 w-3.5 text-primary" />
                    </span>
                    <span className="text-xs leading-relaxed text-muted-foreground sm:text-sm">{point.text}</span>
                  </li>
                ))}
              </ul>
            </ScrollReveal>

            <ScrollReveal delay={140} y={28} scaleFrom={0.97}>
              <div className="glass-card relative overflow-hidden p-6">
                <div
                  aria-hidden="true"
                  className="absolute inset-x-0 top-0 h-24 bg-gradient-to-b from-primary/10 to-transparent"
                />
                <div className="relative">
                  <div className="flex items-center justify-between gap-3">
                    <div className="flex items-center gap-2">
                      <span className="flex h-8 w-8 items-center justify-center rounded-lg aie-gradient">
                        <Brain className="h-4 w-4 text-white" />
                      </span>
                      <div>
                        <p className="text-xs font-bold">Sprint 14 insight</p>
                        <p className="text-[10px] text-muted-foreground">Generated from your board</p>
                      </div>
                    </div>
                    <Badge variant="outline" className="rounded-full border-primary/30 bg-primary/10 text-[10px] text-primary">
                      Example
                    </Badge>
                  </div>

                  <p className="mt-5 text-sm font-semibold tracking-tight">{insightSample.headline}</p>
                  <p className="mt-2 text-xs leading-relaxed text-muted-foreground">{insightSample.body}</p>

                  <div className="mt-5 space-y-2">
                    {insightSample.suggestions.map((suggestion) => (
                      <div
                        key={suggestion}
                        className="flex items-start gap-2.5 rounded-lg border border-border/60 bg-background/40 p-2.5"
                      >
                        <TrendingUp className="mt-0.5 h-3.5 w-3.5 shrink-0 text-primary" />
                        <span className="text-[11px] leading-relaxed">{suggestion}</span>
                      </div>
                    ))}
                  </div>

                  <div className="mt-5 border-t border-border/60 pt-4">
                    <p className="mb-2.5 flex items-center gap-1.5 text-[10px] font-semibold tracking-wider text-muted-foreground uppercase">
                      <Clock className="h-3 w-3" /> Tracked risks
                    </p>
                    <div className="space-y-2">
                      {insightSample.risks.map((risk) => (
                        <div key={risk.label} className="flex items-center justify-between gap-3">
                          <span className="truncate text-[11px]">{risk.label}</span>
                          <RiskLevel label={risk.level} tone={risk.tone} />
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            </ScrollReveal>
          </div>
        </div>
      </section>

      {/* ── CTA ─────────────────────────────────────────────── */}
      <section id="get-started" className="scroll-mt-20 py-16 sm:py-20">
        <div className="mx-auto max-w-6xl px-4 sm:px-6">
          <ScrollReveal delay={0} y={26} scaleFrom={0.98}>
            <div className="glass-card relative overflow-hidden p-8 text-center sm:p-12">
              <div aria-hidden="true" className="landing-grid absolute inset-0 opacity-60" />
              <div
                aria-hidden="true"
                className="absolute inset-0 bg-gradient-to-br from-primary/10 via-transparent to-transparent"
              />
              <div className="relative">
                <div className="aie-glow mx-auto mb-5 flex h-12 w-12 items-center justify-center rounded-2xl aie-gradient">
                  <Zap className="h-6 w-6 text-white" />
                </div>
                <h2 className="text-2xl font-bold tracking-tight sm:text-3xl">Start managing smarter today</h2>
                <p className="mx-auto mt-3 max-w-md text-sm leading-relaxed text-muted-foreground">
                  Sign in with an email code or jump straight in as a guest. Load the sample workspace and see the whole
                  engine working in under a minute.
                </p>
                <div className="mt-7 flex flex-wrap items-center justify-center gap-3">
                  <Button size="lg" onClick={goToAuth} className="gap-2 px-8">
                    Open AIE <ArrowRight className="h-4 w-4" />
                  </Button>
                  <Button size="lg" variant="outline" onClick={() => scrollTo("features")} className="px-8">
                    Browse the features
                  </Button>
                </div>
              </div>
            </div>
          </ScrollReveal>
        </div>
      </section>

      {/* ── Footer ──────────────────────────────────────────── */}
      <footer className="border-t border-border/50 py-10">
        <div className="mx-auto max-w-6xl px-4 sm:px-6">
          <div className="flex flex-col gap-8 sm:flex-row sm:items-start sm:justify-between">
            <div className="max-w-xs">
              <div className="flex items-center gap-2">
                <AIELogo size="sm" />
                <span className="text-sm font-bold tracking-tight">AIE</span>
              </div>
              <p className="mt-3 text-xs leading-relaxed text-muted-foreground">
                Agile Intelligence Engine — plan the sprint, run the board and read the risk before it reads you.
              </p>
            </div>

            <div className="grid grid-cols-2 gap-8 sm:gap-14">
              <div>
                <p className="text-[10px] font-semibold tracking-[0.16em] text-muted-foreground uppercase">Product</p>
                <ul className="mt-3 space-y-2">
                  {navLinks.map((link) => (
                    <li key={link.id}>
                      <button
                        type="button"
                        onClick={() => scrollTo(link.id)}
                        className="text-xs text-muted-foreground transition-colors hover:text-foreground"
                      >
                        {link.label}
                      </button>
                    </li>
                  ))}
                </ul>
              </div>
              <div>
                <p className="text-[10px] font-semibold tracking-[0.16em] text-muted-foreground uppercase">Modules</p>
                <ul className="mt-3 space-y-2">
                  {["Backlog", "Sprint board", "Tasks", "Team", "Risks", "Reports"].map((item) => (
                    <li key={item}>
                      <button
                        type="button"
                        onClick={goToAuth}
                        className="text-xs text-muted-foreground transition-colors hover:text-foreground"
                      >
                        {item}
                      </button>
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          </div>

          <div className="landing-rule mt-8 h-px" />

          <div className="mt-5 flex flex-col items-center justify-between gap-3 sm:flex-row">
            <p className="text-xs text-muted-foreground">© 2026 Agile Intelligence Engine. All rights reserved.</p>
            <p className="text-xs text-muted-foreground">
              Built with three.js, anime.js and Framer Motion.
            </p>
          </div>
        </div>
      </footer>
    </div>
  );
}
