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
import type { ReactNode } from "react";
import { useNavigate } from "react-router";
import { AIELogo } from "@/components/AIELogo";
import { ErrorBoundary } from "@/components/ErrorBoundary";
import { AnimatedCounter } from "@/components/landing/AnimatedCounter";
import { CustomCursor } from "@/components/landing/CustomCursor";
import { DepthTransition } from "@/components/landing/DepthTransition";
import { MagneticButton } from "@/components/landing/MagneticButton";
import { ScrollProgressBar } from "@/components/landing/ScrollProgressBar";
import { SpaceBackdrop } from "@/components/landing/SpaceBackdrop";
import { ScrollReveal } from "@/components/landing/ScrollReveal";
import { TiltCard } from "@/components/landing/TiltCard";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { usePointerMode } from "@/hooks/use-pointer-mode";
import { useScrollSpine } from "@/hooks/use-scroll-spine";
import { useSmoothScroll } from "@/hooks/use-smooth-scroll";
import { useDarkSurface, useTheme } from "@/hooks/use-theme";
import { useThemePalette } from "@/hooks/use-theme-palette";
import type { AppTheme } from "@/hooks/use-theme";
import type { HeroSubject } from "@/components/landing/Hero3DScene";
import { supportsWebGL } from "@/lib/motion-prefs";

/** three.js only loads when a WebGL context is actually available. */
const Hero3DScene = lazy(() => import("@/components/landing/Hero3DScene"));

const AUTH_ROUTE = "/auth/ui";

/** Every appearance theme gets its own subject in the hero. */
const SUBJECT_BY_THEME: Record<AppTheme, HeroSubject> = {
  graphite: "earth",
  "modern-minimal": "blackhole",
  darkmatter: "solar",
};

const SUBJECT_CAPTION: Record<HeroSubject, string> = {
  earth: "Graphite · Earth and satellite",
  blackhole: "Modern Minimal · Black hole",
  solar: "Darkmatter · Solar system",
};

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

const pillars = [
  {
    icon: Layers,
    label: "Plan",
    body: "Epics, stories, tasks and bugs in one hierarchy, with points, labels and due dates.",
  },
  {
    icon: Columns3,
    label: "Run",
    body: "A board that reflects what is actually happening, not what you planned last week.",
  },
  {
    icon: Radar,
    label: "Read",
    body: "Velocity, burndown, workload and risk drawn from the same data — plus AI notes on all of it.",
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
  { value: 6, label: "Product modules", detail: "Dashboard, Backlog, Sprint Board, Tasks, Team, Risks" },
  { value: 4, label: "Sprint stages", detail: "To Do → In Progress → Review → Done" },
  { value: 6, label: "Analytics views", detail: "Velocity, completion, progress, priority, workload, risk" },
  { value: 3, label: "Appearance themes", detail: "Graphite, Modern Minimal, Darkmatter" },
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
    points: ["Drag-and-drop Kanban", "Assignees and priorities", "Workspace-wide filters"],
  },
  {
    icon: Brain,
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

const navLinks = [
  { id: "features", label: "Features" },
  { id: "how", label: "How it works" },
  { id: "intelligence", label: "Intelligence" },
];

function Kicker({ children }: { children: ReactNode }) {
  return (
    <p className="text-[11px] font-semibold tracking-[0.18em] text-primary uppercase">{children}</p>
  );
}

/**
 * Static CSS illustration shown behind — and instead of — the WebGL scene:
 * a dark core, a glowing orbital ring and a soft nebula. It stands in as a
 * complete hero for browsers without a WebGL context.
 */
function HeroBackdrop() {
  return (
    <div aria-hidden="true" className="pointer-events-none absolute inset-0 flex items-center justify-center">
      <div className="absolute h-[74%] w-[74%] rounded-full bg-primary/15 blur-3xl" />
      <div className="absolute h-[86%] w-[86%] rounded-full border border-border/20" />
      <div
        className="absolute h-[58%] w-[58%] rounded-full border border-primary/25"
        style={{ transform: "rotateX(72deg)" }}
      />
      <div className="absolute h-[46%] w-[46%] rounded-full border border-border/30" />
      <div className="absolute h-[38%] w-[38%] rounded-full bg-black/70 blur-[2px]" />
      <div className="absolute h-[40%] w-[40%] rounded-full border border-primary/40 aie-glow" />
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
  const { appTheme } = useTheme();
  const pointer = usePointerMode();
  const { scrollTo } = useSmoothScroll();

  // The landing page is dark-only in every appearance theme; the light/dark
  // preference still applies everywhere else in the app.
  useDarkSurface();

  const subject = SUBJECT_BY_THEME[appTheme] ?? "earth";
  const heroRef = useRef<HTMLElement>(null);
  const spine = useScrollSpine<HTMLDivElement>();

  const [canRender3D] = useState(() => supportsWebGL());

  // Hover-driven effects are collapsed into one decision so the page degrades
  // to a calm, static composition on touch devices and for reduced motion.
  const interactive = pointer.hover;

  const { scrollYProgress } = useScroll({
    target: heroRef,
    offset: ["start start", "end start"],
  });
  const copyY = useTransform(scrollYProgress, [0, 1], [0, 90]);
  const copyOpacity = useTransform(scrollYProgress, [0, 0.9], [1, 0]);
  const sceneY = useTransform(scrollYProgress, [0, 1], [0, -60]);
  const sceneScale = useTransform(scrollYProgress, [0, 1], [1, 0.9]);

  const goToAuth = useCallback(() => navigate(AUTH_ROUTE), [navigate]);

  return (
    <>
      {/* Fixed sky behind the whole page. It lives outside the page wrapper so
          no ancestor overflow rule can clip it. */}
      <SpaceBackdrop accent={palette.accent} glow={palette.glow} animated={!pointer.reduced} />

      <div className="aie-page min-h-screen" data-custom-cursor={interactive ? "true" : undefined}>
      <CustomCursor enabled={interactive} />
      <ScrollProgressBar />

      {/* ── Nav ─────────────────────────────────────────────── */}
      <nav className="glass-topbar sticky top-0 z-50">
        <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-4 sm:px-6">
          <button
            type="button"
            onClick={() => scrollTo("top", 0)}
            data-cursor="hover"
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
                data-cursor="hover"
                className="rounded-lg px-3 py-2 text-xs font-medium text-muted-foreground transition-colors hover:bg-accent/50 hover:text-foreground"
              >
                {link.label}
              </button>
            ))}
          </div>

          <div className="flex items-center gap-2">
            <Button variant="ghost" size="sm" onClick={goToAuth} data-cursor="hover">
              Sign In
            </Button>
            <MagneticButton enabled={interactive} strength={5}>
              <Button size="sm" onClick={goToAuth} data-cursor="hover" className="gap-1.5">
                Get Started <ArrowRight className="h-3.5 w-3.5" />
              </Button>
            </MagneticButton>
          </div>
        </div>
      </nav>

      {/* ── Hero ────────────────────────────────────────────── */}
      <section id="top" ref={heroRef} className="relative overflow-hidden">
        <div
          aria-hidden="true"
          className="landing-aurora absolute -left-24 top-10 h-[420px] w-[420px] rounded-full bg-primary/20"
        />
        <div
          aria-hidden="true"
          className="landing-aurora absolute -right-16 top-40 h-[360px] w-[360px] rounded-full bg-primary/10"
          style={{ animationDelay: "-6s" }}
        />

        <div className="relative mx-auto grid max-w-6xl items-center gap-12 px-4 pt-14 pb-16 sm:px-6 sm:pt-24 lg:grid-cols-[1.04fr_0.96fr] lg:gap-8 lg:pt-28">
          {/* Copy */}
          <motion.div style={interactive ? { y: copyY, opacity: copyOpacity } : undefined} className="max-w-2xl">
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

              {/* Dimensional typography: the block tilts toward the cursor while
                  each line drifts at its own rate via the layer utilities. */}
              <TiltCard
                surface={false}
                glow={false}
                intensity={3.5}
                lift={0}
                interactive={interactive}
                className="mt-6"
              >
                <h1 className="text-[2.1rem] leading-[1.08] font-bold tracking-tight sm:text-5xl lg:text-[3.4rem]">
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
                    <span className="aie-layer-mid block overflow-hidden pb-1">
                      <span data-hero-line className="block">
                        Manage Agile.
                      </span>
                    </span>
                    <span className="aie-layer-near block overflow-hidden pb-1">
                      <span data-hero-line className="landing-shine block">
                        Understand Progress.
                      </span>
                    </span>
                    <span className="aie-layer-mid block overflow-hidden pb-1">
                      <span data-hero-line className="block">
                        Predict Risk.
                      </span>
                    </span>
                  </ScrollReveal>
                </h1>
              </TiltCard>

              <p className="mt-6 max-w-xl text-sm leading-relaxed text-muted-foreground sm:text-base">
                AIE is an intelligent Agile platform that helps software teams plan sprints, manage tasks, track
                progress and analyse risks — while an AI engine surfaces insights and early warnings before problems
                escalate.
              </p>

              <div data-intro className="mt-8 flex flex-wrap items-center gap-3">
                <MagneticButton enabled={interactive} strength={8}>
                  <Button size="lg" onClick={goToAuth} data-cursor="hover" className="gap-2 px-6">
                    Open the dashboard <ArrowRight className="h-4 w-4" />
                  </Button>
                </MagneticButton>
                <Button
                  size="lg"
                  variant="outline"
                  onClick={() => scrollTo("how")}
                  data-cursor="hover"
                  className="gap-2 px-6"
                >
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

              <div data-intro className="mt-9 hidden items-center gap-3 sm:flex">
                <span aria-hidden="true" className="h-10 w-px animate-pulse bg-gradient-to-b from-primary to-transparent" />
                <span className="text-[10px] font-medium tracking-[0.2em] text-muted-foreground uppercase">
                  Scroll
                </span>
              </div>
            </ScrollReveal>
          </motion.div>

          {/* 3D scene */}
          <motion.div
            style={interactive ? { y: sceneY, scale: sceneScale } : undefined}
            className="relative mx-auto h-[300px] w-full max-w-[520px] sm:h-[420px] lg:h-[540px] lg:max-w-none"
          >
            {/* The CSS illustration stands in while three.js loads, and stays as
                the complete hero for browsers without a WebGL context. */}
            {canRender3D ? (
              <ErrorBoundary fallback={<HeroBackdrop />}>
                <Suspense fallback={<HeroBackdrop />}>
                  <div className="absolute inset-0">
                    <Hero3DScene
                      palette={palette}
                      subject={subject}
                      animated={!pointer.reduced}
                      scrollTarget={heroRef}
                    />
                  </div>
                </Suspense>
              </ErrorBoundary>
            ) : (
              <HeroBackdrop />
            )}

            {canRender3D ? (
              /* Tells the visitor the hero follows the appearance theme. */
              <p className="pointer-events-none absolute inset-x-0 bottom-1 text-center text-[10px] font-semibold tracking-[0.24em] text-muted-foreground uppercase">
                {SUBJECT_CAPTION[subject]}
              </p>
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

      <DepthTransition label="From plan to signal" animated={!pointer.reduced} />

      {/* ── Introduction ────────────────────────────────────── */}
      <section className="pt-20 pb-16 sm:pt-24 sm:pb-20">
        <div className="mx-auto max-w-6xl px-4 sm:px-6">
          <ScrollReveal className="max-w-3xl" delay={70} y={26}>
            <Kicker>The idea</Kicker>
            <p className="mt-5 text-xl leading-snug font-semibold tracking-tight sm:text-3xl">
              Most teams do not need another board. They need to know{" "}
              <span className="landing-shine">what the board is telling them</span> — before the sprint ends.
            </p>
          </ScrollReveal>

          <ScrollReveal className="mx-auto mt-6 max-w-2xl text-sm leading-relaxed text-muted-foreground" delay={120} y={20}>
            <p>
              AIE reads the stories, sprints, risks and time entries already on your board and turns them into
              something a human can act on. No invented metrics, no parallel spreadsheet — one working surface that
              explains itself.
            </p>
          </ScrollReveal>

          <ScrollReveal className="mt-14 grid gap-4 sm:grid-cols-3" delay={90} y={26}>
            {pillars.map((pillar) => (
              <div key={pillar.label} className="h-full">
                <TiltCard className="h-full p-5" intensity={4} lift={6} interactive={interactive} glow>
                  <div className="aie-layer-mid flex h-9 w-9 items-center justify-center rounded-xl bg-primary/10">
                    <pillar.icon className="h-4 w-4 text-primary" />
                  </div>
                  <p className="mt-4 text-sm font-bold">{pillar.label}</p>
                  <p className="mt-1.5 text-xs leading-relaxed text-muted-foreground">{pillar.body}</p>
                </TiltCard>
              </div>
            ))}
          </ScrollReveal>
        </div>
      </section>

      {/* ── Stats ───────────────────────────────────────────── */}
      <section className="pb-16 sm:pb-20">
        <div className="mx-auto max-w-6xl px-4 sm:px-6">
          <ScrollReveal className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4" delay={80} y={22}>
            {stats.map((stat) => (
              <div key={stat.label} className="h-full">
                <TiltCard className="h-full p-5" intensity={3.5} lift={5} interactive={interactive} glow={false}>
                  <p className="aie-layer-mid text-3xl font-bold tracking-tight text-primary">
                    <AnimatedCounter to={stat.value} />
                  </p>
                  <p className="mt-1.5 text-sm font-semibold">{stat.label}</p>
                  <p className="mt-1 text-[11px] leading-relaxed text-muted-foreground">{stat.detail}</p>
                </TiltCard>
              </div>
            ))}
          </ScrollReveal>
        </div>
      </section>

      {/* ── Features ────────────────────────────────────────── */}
      <section id="features" className="scroll-mt-20 py-12 sm:py-16">
        <div className="mx-auto max-w-6xl px-4 sm:px-6">
          <ScrollReveal className="mx-auto mb-12 max-w-2xl text-center" delay={0} y={20}>
            <Kicker>Everything in one place</Kicker>
            <h2 className="mt-3 text-2xl font-bold tracking-tight sm:text-3xl">
              Built for how software teams actually work
            </h2>
            <p className="mt-3 text-sm leading-relaxed text-muted-foreground">
              From sprint planning to risk prediction, AIE gives your team a single place to plan, execute and
              understand progress.
            </p>
          </ScrollReveal>

          <ScrollReveal className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3" delay={85} y={26}>
            {features.map((feature, index) => (
              <div key={feature.title} className="h-full">
                <TiltCard
                  as="article"
                  className="group h-full p-5 sm:p-6"
                  // Alternating intensity keeps the grid from feeling mechanical.
                  intensity={index % 3 === 0 ? 5 : index % 3 === 1 ? 6 : 4.5}
                  lift={7}
                  interactive={interactive}
                  cursorLabel="Explore"
                >
                  <div className="aie-layer-mid mb-4 flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10 transition-colors group-hover:bg-primary/15">
                    <feature.icon className="h-5 w-5 text-primary" />
                  </div>
                  <h3 className="aie-layer-mid mb-2 flex items-center gap-1.5 text-sm font-bold">
                    {feature.title}
                    <ArrowUpRight className="h-3.5 w-3.5 text-muted-foreground opacity-0 transition-opacity group-hover:opacity-100" />
                  </h3>
                  <p className="text-xs leading-relaxed text-muted-foreground">{feature.description}</p>
                </TiltCard>
              </div>
            ))}
          </ScrollReveal>
        </div>
      </section>

      {/* ── How it works (scroll-scrubbed spine) ────────────── */}
      <section id="how" className="scroll-mt-20 py-16 sm:py-20">
        <div className="mx-auto max-w-6xl px-4 sm:px-6">
          <ScrollReveal className="mb-14 max-w-2xl" delay={0} y={20}>
            <Kicker>How it works</Kicker>
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
                  {/* The wrapper keeps anime.js' inline transform off the tilt element,
                      which owns its own transform via CSS custom properties. */}
                  <div>
                    <TiltCard className="p-5 sm:p-7" intensity={4} lift={6} interactive={interactive} glow>
                      <div className="flex flex-wrap items-center gap-3">
                        <span className="flex h-10 w-10 items-center justify-center rounded-xl aie-gradient text-sm font-bold text-white">
                          {index + 1}
                        </span>
                        <span className="aie-layer-mid flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10">
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
                    </TiltCard>
                  </div>
                </ScrollReveal>
              ))}
            </div>
          </div>
        </div>
      </section>

      <DepthTransition label="Read the signal" animated={!pointer.reduced} />

      {/* ── Intelligence ────────────────────────────────────── */}
      <section id="intelligence" className="scroll-mt-20 py-16 sm:py-20">
        <div className="mx-auto max-w-6xl px-4 sm:px-6">
          <div className="grid items-center gap-10 lg:grid-cols-2 lg:gap-14">
            <ScrollReveal delay={0} y={24}>
              <Kicker>AIE Intelligence</Kicker>
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

            <ScrollReveal delay={140} y={28}>
              <div>
                <TiltCard className="p-5 sm:p-6" intensity={5} lift={8} interactive={interactive} cursorLabel="Inspect">
                  <div
                    aria-hidden="true"
                    className="absolute inset-x-0 top-0 h-24 overflow-hidden bg-gradient-to-b from-primary/10 to-transparent"
                    style={{ borderRadius: "inherit" }}
                  />
                  <div className="aie-layer-near">
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
                    <Badge
                      variant="outline"
                      className="rounded-full border-primary/30 bg-primary/10 text-[10px] text-primary"
                    >
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
                </TiltCard>
              </div>
            </ScrollReveal>
          </div>
        </div>
      </section>

      {/* ── CTA ─────────────────────────────────────────────── */}
      <section id="get-started" className="scroll-mt-20 py-16 sm:py-20">
        <div className="mx-auto max-w-6xl px-4 sm:px-6">
          <ScrollReveal delay={0} y={26}>
            <div>
              <TiltCard className="p-7 text-center sm:p-12" intensity={3} lift={5} interactive={interactive} glow>
                <div
                  aria-hidden="true"
                  className="landing-grid absolute inset-0 opacity-60"
                  style={{ borderRadius: "inherit" }}
                />
                <div
                  aria-hidden="true"
                  className="absolute inset-0 bg-gradient-to-br from-primary/10 via-transparent to-transparent"
                  style={{ borderRadius: "inherit" }}
                />
                <div className="aie-layer-mid relative">
                <div className="aie-glow mx-auto mb-5 flex h-12 w-12 items-center justify-center rounded-2xl aie-gradient">
                  <Zap className="h-6 w-6 text-white" />
                </div>
                <h2 className="text-2xl font-bold tracking-tight sm:text-3xl">Start managing smarter today</h2>
                <p className="mx-auto mt-3 max-w-md text-sm leading-relaxed text-muted-foreground">
                  Sign in with an email code or jump straight in as a guest. Load the sample workspace and see the whole
                  engine working in under a minute.
                </p>
                <div className="mt-7 flex flex-wrap items-center justify-center gap-3">
                  <MagneticButton enabled={interactive} strength={9}>
                    <Button size="lg" onClick={goToAuth} data-cursor="hover" className="gap-2 px-8">
                      Open AIE <ArrowRight className="h-4 w-4" />
                    </Button>
                  </MagneticButton>
                  <Button
                    size="lg"
                    variant="outline"
                    onClick={() => scrollTo("features")}
                    data-cursor="hover"
                    className="px-8"
                  >
                    Browse the features
                  </Button>
                  </div>
                </div>
              </TiltCard>
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
                        data-cursor="hover"
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
                        data-cursor="hover"
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
            <p className="text-xs text-muted-foreground">Built with three.js, anime.js and Framer Motion.</p>
          </div>
        </div>
      </footer>
      </div>
    </>
  );
}
