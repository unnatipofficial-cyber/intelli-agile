import { MotionConfig, motion, useScroll, useTransform } from "framer-motion";
import { useCallback, useEffect, useRef, useState } from "react";
import type { ReactNode } from "react";
import { useNavigate } from "react-router";
import {
  ArrowRight,
  Columns3,
  Layers,
  ListTodo,
  Palette,
  Radar,
  RefreshCw,
  Search,
  Sparkles,
  Target,
} from "lucide-react";
import { AIELogo } from "@/components/AIELogo";
import { AnimatedCounter } from "@/components/landing/AnimatedCounter";
import { CustomCursor } from "@/components/landing/CustomCursor";
import { DepthTransition } from "@/components/landing/DepthTransition";
import { MagneticButton } from "@/components/landing/MagneticButton";
import { ScrollProgressBar } from "@/components/landing/ScrollProgressBar";
import { ScrollReveal } from "@/components/landing/ScrollReveal";
import { SpaceBackdrop } from "@/components/landing/SpaceBackdrop";
import { TiltCard } from "@/components/landing/TiltCard";
import AppleCardsCarouselDemo from "@/components/guide/AppleCardsCarousel";
import { BoardMock, MockFrame } from "@/components/guide/GuideMocks";
import {
  GUIDE_CARDS,
  GUIDE_SECTIONS,
  SectionCTA,
  SectionLists,
  SectionMock,
} from "@/components/guide/guide-content";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { usePointerMode } from "@/hooks/use-pointer-mode";
import { useScrollSpine } from "@/hooks/use-scroll-spine";
import { useSmoothScroll } from "@/hooks/use-smooth-scroll";
import { useGraphiteSurface } from "@/hooks/use-theme";
import { useThemePalette } from "@/hooks/use-theme-palette";
import { pageVariants } from "@/lib/motion-variants";
import { cn } from "@/lib/utils";

/**
 * Guide — the product tour.
 *
 * A public page linked from the landing page that explains what every section
 * of AIE does. Three visual registers repeat down the page:
 *
 *  1. Animated mock "screenshots" (GuideMocks) that demonstrate each section.
 *  2. Scroll-driven motion: anime.js reveals (ScrollReveal), a scrubbed spine
 *     (useScrollSpine) and perspective panels that flatten as they enter view.
 *  3. The Apple-style card deck for skimmers — cards open into the full
 *     explanation in a modal.
 *
 * Chrome (starfield, cursor, smooth scroll, graphite surface) is shared with
 * the landing page so the two public pages feel like one site.
 */

const AUTH_ROUTE = "/auth/ui";
/** Sticky nav (64px) + chips bar (~45px), so anchors land below both. */
const ANCHOR_OFFSET = -118;

function Kicker({ children }: { children: ReactNode }) {
  return (
    <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-primary">{children}</p>
  );
}

/**
 * A panel that enters tilted and flattens as it reaches the middle of the
 * viewport — the Apple-style "screen settling into place" move. All values are
 * scroll-linked MotionValues; reduced-motion users get a plain static panel.
 */
function PerspectivePanel({ children, className }: { children: ReactNode; className?: string }) {
  const ref = useRef<HTMLDivElement>(null);
  const pointer = usePointerMode();
  const { scrollYProgress } = useScroll({ target: ref, offset: ["start end", "end start"] });
  const rotateX = useTransform(scrollYProgress, [0, 0.42, 1], [15, 0, -7]);
  const scale = useTransform(scrollYProgress, [0, 0.42, 1], [0.95, 1, 0.985]);
  const y = useTransform(scrollYProgress, [0, 1], [46, -22]);
  const opacity = useTransform(scrollYProgress, [0, 0.16], [0, 1]);

  return (
    <div ref={ref} className={cn("[perspective:1200px]", className)}>
      <motion.div
        style={pointer.reduced ? undefined : { rotateX, scale, y, opacity }}
        className="transform-gpu will-change-transform"
      >
        {children}
      </motion.div>
    </div>
  );
}

/* ── Page data ─────────────────────────────────────────────────── */

const stats = [
  { to: 10, label: "Sections, toured", detail: "From dashboard to settings" },
  { to: 6, label: "Analytics views", detail: "Velocity, burndown, completion, priority, workload, risk" },
  { to: 4, label: "Sprint stages", detail: "To Do → In Progress → Review → Done" },
  { to: 3, label: "Appearance themes", detail: "Graphite, Modern Minimal, Darkmatter" },
];

const flowSteps = [
  {
    icon: Sparkles,
    title: "Set up your workspace",
    body: "Sign in with an email code — or jump straight in as a guest. Load the sample workspace and every section in this guide fills with realistic data in one click.",
    points: ["Email code or guest sign-in", "Sample data in one click"],
  },
  {
    icon: Layers,
    title: "Shape the backlog",
    body: "Break the idea down: epics → user stories → tasks and bugs. Estimate with story points, tag labels, set priorities and due dates, and keep the queue ordered.",
    points: ["Epics, stories, tasks, bugs", "Points, labels, due dates"],
  },
  {
    icon: Target,
    title: "Plan the sprint",
    body: "Pull the top of the queue into a new sprint, give it a goal, and check the team's capacity before committing — the workload bars tell you who can take more.",
    points: ["Capacity-aware commitment", "A single sprint goal"],
  },
  {
    icon: Columns3,
    title: "Run the board",
    body: "Move cards across To Do, In Progress, Review and Done. Every drag updates the dashboard, the burndown, the analytics and the AI notes — one move, everywhere.",
    points: ["Drag and drop", "Statuses stay in sync"],
  },
  {
    icon: Radar,
    title: "Read the signal",
    body: "Velocity, burndown, workload and the risk matrix all run off the same data. The AI engine reads it too, and points at what needs attention before standup.",
    points: ["Six analytics views", "AI notes on sprint health"],
  },
  {
    icon: RefreshCw,
    title: "Review and improve",
    body: "Close the loop on a retrospective board, look at where time actually went, then plan the next sprint with a clearer picture than the last one.",
    points: ["Retrospectives", "Time reports feed the next plan"],
  },
];

const tips = [
  {
    icon: Search,
    title: "Press ⌘K anywhere",
    body: "The command palette jumps to any page, task or project without your hands leaving the keyboard. Ctrl+K works too.",
  },
  {
    icon: Sparkles,
    title: "Try before you sign in",
    body: "The landing page’s “Try it instantly” opens a throwaway guest session on sample data — no email code, nothing to clean up.",
  },
  {
    icon: ListTodo,
    title: "Filters work the same everywhere",
    body: "Status, priority, assignee and sprint appear on every list page in the same place. Learn the pattern once.",
  },
  {
    icon: Palette,
    title: "Three themes × light and dark",
    body: "Graphite, Modern Minimal and Darkmatter. Switch from Settings → Appearance; the whole workspace follows instantly.",
  },
];

const themes = [
  {
    name: "Graphite",
    tag: "The default",
    blurb: "Machined, monochromatic neutrality. Hairline edges, no colour, built for long sessions.",
    colors: ["#0b0d0f", "#606060", "#f1f1ef"],
    ring: "ring-white/10",
  },
  {
    name: "Modern Minimal",
    tag: "Flat clarity",
    blurb: "A plain surface with one confident blue. Charts and accents speak in a single voice.",
    colors: ["#171717", "#3b82f6", "#e5e5e5"],
    ring: "ring-white/10",
  },
  {
    name: "Darkmatter",
    tag: "After hours",
    blurb: "Deep-space violet with a warm ember accent — the same engine, dressed for night.",
    colors: ["#0d0b14", "#f09050", "#d4cde5"],
    ring: "ring-white/10",
  },
];

/* ── Page ──────────────────────────────────────────────────────── */

export default function Guide() {
  const navigate = useNavigate();
  const palette = useThemePalette();
  const pointer = usePointerMode();
  const interactive = pointer.hover;
  const { scrollTo } = useSmoothScroll();
  const spine = useScrollSpine<HTMLDivElement>();

  // Same contract as the landing page: the guide is a public marketing page,
  // so it pins the graphite surface for its duration and restores the
  // visitor's own appearance theme on the way out.
  useGraphiteSurface();

  const [activeSection, setActiveSection] = useState(GUIDE_SECTIONS[0].id);

  // Highlight the chip of whatever section currently crosses the reading band.
  useEffect(() => {
    if (typeof IntersectionObserver === "undefined") return;
    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) setActiveSection(entry.target.id);
        }
      },
      { rootMargin: "-34% 0px -56% 0px", threshold: 0 },
    );
    GUIDE_SECTIONS.forEach((section) => {
      const element = document.getElementById(section.id);
      if (element) observer.observe(element);
    });
    return () => observer.disconnect();
  }, []);

  const goToAuth = useCallback(() => navigate(AUTH_ROUTE), [navigate]);
  const goToGuest = useCallback(() => navigate(`${AUTH_ROUTE}?guest=1`), [navigate]);
  const startTour = useCallback(
    () => scrollTo(GUIDE_SECTIONS[0].id, ANCHOR_OFFSET),
    [scrollTo],
  );

  const navLinks = [
    { label: "The deck", id: "tour" },
    { label: "Sections", id: GUIDE_SECTIONS[0].id },
    { label: "The loop", id: "flow" },
    { label: "Tips", id: "tips" },
    { label: "Themes", id: "themes" },
  ];

  return (
    <MotionConfig reducedMotion="user">
      <SpaceBackdrop accent={palette.accent} glow={palette.glow} animated={!pointer.reduced} />

      <motion.div
        variants={pageVariants}
        initial="initial"
        animate="animate"
        className="aie-page aie-cinema-surface min-h-screen"
        data-custom-cursor={interactive ? "true" : undefined}
      >
        <CustomCursor enabled={interactive} />
        <ScrollProgressBar />
        <div className="aie-cinema-vignette" aria-hidden="true" />

        {/* ── Nav ───────────────────────────────────────────── */}
        <nav className="glass-topbar aie-nav-scrim sticky top-0 z-50">
          <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-4 sm:px-6">
            <button
              type="button"
              onClick={() => navigate("/")}
              data-cursor="hover"
              className="flex items-center gap-2.5 rounded-lg px-1 py-1 text-left"
            >
              <AIELogo size="sm" />
              <span className="flex items-baseline gap-1.5">
                <span className="text-base font-bold tracking-tight">AIE</span>
                <span className="hidden text-[9px] font-medium text-muted-foreground sm:inline">
                  Product guide
                </span>
              </span>
            </button>

            <div className="hidden items-center gap-1 md:flex">
              {navLinks.map((link) => (
                <button
                  key={link.id}
                  type="button"
                  onClick={() => scrollTo(link.id, ANCHOR_OFFSET)}
                  data-cursor="hover"
                  className="rounded-lg px-3 py-2 text-xs font-medium text-muted-foreground transition-colors hover:bg-accent/50 hover:text-foreground"
                >
                  {link.label}
                </button>
              ))}
            </div>

            <div className="flex items-center gap-2">
              <Button variant="ghost" size="sm" onClick={() => navigate("/")} data-cursor="hover">
                Home
              </Button>
              <MagneticButton enabled={interactive} strength={5}>
                <Button size="sm" onClick={goToAuth} data-cursor="hover" className="gap-1.5">
                  Open AIE <ArrowRight className="h-3.5 w-3.5" />
                </Button>
              </MagneticButton>
            </div>
          </div>
        </nav>

        {/* ── Sticky section chips ──────────────────────────── */}
        <div className="sticky top-16 z-40 border-b border-border/40 bg-background/75 backdrop-blur-md">
          <div className="mx-auto flex max-w-6xl gap-1.5 overflow-x-auto px-4 py-2.5 [scrollbar-width:none] sm:px-6 [&::-webkit-scrollbar]:hidden">
            {GUIDE_SECTIONS.map((section) => (
              <button
                key={section.id}
                type="button"
                onClick={() => scrollTo(section.id, ANCHOR_OFFSET)}
                className={cn(
                  "shrink-0 rounded-full border px-3 py-1.5 text-[11px] font-medium transition-colors",
                  activeSection === section.id
                    ? "border-primary/50 bg-primary/15 text-primary"
                    : "border-border/60 text-muted-foreground hover:border-border hover:text-foreground",
                )}
              >
                <span className="mr-1.5 font-mono text-[9px] opacity-60">{section.index}</span>
                {section.nav}
              </button>
            ))}
          </div>
        </div>

        {/* ── Hero ──────────────────────────────────────────── */}
        <section id="top" className="relative overflow-hidden">
          <div
            aria-hidden="true"
            className="landing-aurora absolute -left-24 top-10 h-[380px] w-[380px] rounded-full bg-primary/20"
          />
          <div
            aria-hidden="true"
            className="landing-aurora absolute -right-16 top-40 h-[320px] w-[320px] rounded-full bg-primary/10"
            style={{ animationDelay: "-6s" }}
          />

          <div className="relative mx-auto grid max-w-6xl items-center gap-12 px-4 pt-14 pb-14 sm:px-6 sm:pt-20 lg:grid-cols-[1.02fr_0.98fr] lg:gap-10 lg:pt-24">
            {/* Copy */}
            <div className="max-w-2xl">
              <ScrollReveal trigger="mount" selector="[data-intro]" delay={90} y={18} duration={700}>
                <div data-intro>
                  <Badge
                    variant="outline"
                    className="gap-1.5 rounded-full border-primary/30 bg-primary/10 px-3 py-1 text-[11px] font-medium text-primary"
                  >
                    <Sparkles className="h-3.5 w-3.5" />
                    Product guide · 10 sections
                  </Badge>
                </div>

                <h1 className="mt-6 text-[2.1rem] leading-[1.08] font-bold tracking-tight sm:text-5xl lg:text-[3.3rem]">
                  <ScrollReveal
                    as="span"
                    className="block"
                    trigger="mount"
                    selector="[data-hero-line]"
                    delay={120}
                    y="112%"
                    duration={900}
                    ease="out(4)"
                  >
                    <span className="block overflow-hidden pb-1">
                      <span data-hero-line className="block">
                        The guided tour
                      </span>
                    </span>
                    <span className="block overflow-hidden pb-1">
                      <span data-hero-line className="landing-shine block">
                        of every screen
                      </span>
                    </span>
                    <span className="block overflow-hidden pb-1">
                      <span data-hero-line className="block">
                        in AIE.
                      </span>
                    </span>
                  </ScrollReveal>
                </h1>

                <p className="mt-6 max-w-xl text-sm leading-relaxed text-muted-foreground sm:text-base">
                  Ten sections, one engine. This guide walks through what each page does, what{" "}
                  <span className="font-semibold text-foreground">you</span> do on it, and what AIE does for
                  you in return — with a live animated preview of every screen before you open the
                  workspace.
                </p>

                <div data-intro className="mt-8 flex flex-wrap items-center gap-3">
                  <MagneticButton enabled={interactive} strength={8}>
                    <Button size="lg" onClick={startTour} data-cursor="hover" className="gap-2 px-6">
                      Start the tour <ArrowRight className="h-4 w-4" />
                    </Button>
                  </MagneticButton>
                  <Button
                    size="lg"
                    variant="outline"
                    onClick={goToGuest}
                    data-cursor="hover"
                    className="gap-2 px-6"
                    title="Explore with sample data — no account, no email code"
                  >
                    <Sparkles className="h-4 w-4" />
                    Try it instantly
                  </Button>
                  <Button
                    size="lg"
                    variant="ghost"
                    onClick={() => navigate("/")}
                    data-cursor="hover"
                    className="px-4 text-muted-foreground"
                  >
                    ← Back to landing
                  </Button>
                </div>

                <ul data-intro className="mt-7 flex flex-wrap items-center gap-x-5 gap-y-2">
                  {["Anchored by a sticky index", "Every preview animates on scroll", "Open any section from here"].map(
                    (item) => (
                      <li key={item} className="flex items-center gap-1.5 text-xs text-muted-foreground">
                        <span aria-hidden="true" className="h-1.5 w-1.5 rounded-full bg-primary/70" />
                        {item}
                      </li>
                    ),
                  )}
                </ul>
              </ScrollReveal>
            </div>

            {/* Visual: the board, settling into place as you scroll */}
            <div className="relative mx-auto w-full max-w-[540px]">
              <PerspectivePanel>
                <MockFrame url="aie.app/dashboard/sprint-board">
                  <BoardMock />
                </MockFrame>
              </PerspectivePanel>

              <span className="absolute -top-3 right-4 hidden items-center gap-1.5 rounded-full border border-border/60 bg-background/85 px-3 py-1.5 text-[10px] font-semibold text-muted-foreground shadow-lg backdrop-blur sm:flex">
                <span aria-hidden="true" className="h-1.5 w-1.5 animate-pulse rounded-full bg-primary" />
                Every preview below is live
              </span>
              <span className="absolute -bottom-3 left-4 hidden items-center gap-1.5 rounded-full border border-border/60 bg-background/85 px-3 py-1.5 text-[10px] font-semibold text-muted-foreground shadow-lg backdrop-blur sm:flex">
                <kbd className="rounded border border-border bg-muted px-1.5 py-0.5 font-mono text-[9px]">⌘K</kbd>
                command palette anywhere
              </span>
            </div>
          </div>

          {/* Stats */}
          <div className="relative mx-auto max-w-6xl px-4 pb-14 sm:px-6">
            <ScrollReveal className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4" delay={70} y={22}>
              {stats.map((stat) => (
                <div key={stat.label} className="h-full">
                  <TiltCard className="h-full p-5" intensity={3.5} lift={5} interactive={interactive} glow={false}>
                    <p className="text-3xl font-bold tracking-tight text-primary">
                      <AnimatedCounter to={stat.to} />
                    </p>
                    <p className="mt-1.5 text-sm font-semibold">{stat.label}</p>
                    <p className="mt-1 text-[11px] leading-relaxed text-muted-foreground">{stat.detail}</p>
                  </TiltCard>
                </div>
              ))}
            </ScrollReveal>
          </div>
        </section>

        <DepthTransition label="The deck" animated={!pointer.reduced} />

        {/* ── Carousel deck ─────────────────────────────────── */}
        <section id="tour" className="scroll-mt-32 py-14 sm:py-16">
          <ScrollReveal delay={0} y={20}>
            <div>
              <AppleCardsCarouselDemo cards={GUIDE_CARDS} />
            </div>
          </ScrollReveal>
        </section>

        {/* ── Deep dives ────────────────────────────────────── */}
        {GUIDE_SECTIONS.map((section, index) => {
          const flipped = index % 2 === 1;
          return (
            <section key={section.id} id={section.id} className="scroll-mt-32 py-14 sm:py-20">
              <div className="mx-auto max-w-6xl px-4 sm:px-6">
                <div className="grid items-center gap-10 lg:grid-cols-2 lg:gap-14">
                  {/* Copy */}
                  <ScrollReveal
                    className={cn(flipped && "lg:order-2")}
                    delay={40}
                    y={26}
                  >
                    <div className="flex items-center gap-3">
                      <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-primary/10">
                        <section.icon className="h-5 w-5 text-primary" />
                      </span>
                      <span className="font-mono text-xs font-semibold tracking-[0.2em] text-muted-foreground">
                        {section.index} / 10
                      </span>
                      <Badge
                        variant="outline"
                        className="rounded-full border-primary/30 bg-primary/10 text-[10px] text-primary"
                      >
                        {section.category}
                      </Badge>
                    </div>

                    <Kicker>
                      <span className="mt-6 block">{section.title}</span>
                    </Kicker>

                    <h2 className="mt-3 text-2xl font-bold tracking-tight text-balance sm:text-3xl">
                      {section.headline}
                    </h2>

                    <p className="mt-4 text-sm leading-relaxed text-muted-foreground">{section.lede}</p>

                    <div className="mt-6">
                      <SectionLists section={section} />
                    </div>

                    <div className="mt-6">
                      <SectionCTA section={section} />
                    </div>
                  </ScrollReveal>

                  {/* Visual */}
                  <div className={cn(flipped && "lg:order-1")}>
                    <div className="relative">
                      <PerspectivePanel>
                        <SectionMock section={section} />
                      </PerspectivePanel>
                    </div>
                  </div>
                </div>
              </div>
            </section>
          );
        })}

        <DepthTransition label="The loop" animated={!pointer.reduced} />

        {/* ── How a sprint runs (scrubbed spine) ────────────── */}
        <section id="flow" className="scroll-mt-32 py-16 sm:py-20">
          <div className="mx-auto max-w-6xl px-4 sm:px-6">
            <ScrollReveal className="mb-14 max-w-2xl" delay={0} y={20}>
              <Kicker>The loop</Kicker>
              <h2 className="mt-3 text-2xl font-bold tracking-tight sm:text-3xl">
                How a sprint runs, end to end
              </h2>
              <p className="mt-3 text-sm leading-relaxed text-muted-foreground">
                The line on the left fills as you scroll — the same way AIE fills in the picture of your
                project while the team works.
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

              <div className="space-y-5">
                {flowSteps.map((step, index) => (
                  <ScrollReveal key={step.title} delay={0} y={30}>
                    {/* Wrapper keeps anime.js' inline transform off the tilt element. */}
                    <div>
                      <TiltCard className="p-5 sm:p-6" intensity={4} lift={6} interactive={interactive} glow>
                        <div className="flex flex-wrap items-center gap-3">
                          <span className="flex h-9 w-9 items-center justify-center rounded-lg aie-gradient text-sm font-bold text-white">
                            {index + 1}
                          </span>
                          <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary/10">
                            <step.icon className="h-4 w-4 text-primary" />
                          </span>
                          <h3 className="text-base font-bold">{step.title}</h3>
                        </div>
                        <p className="mt-3.5 text-xs leading-relaxed text-muted-foreground sm:text-sm">
                          {step.body}
                        </p>
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

        {/* ── Tips ──────────────────────────────────────────── */}
        <section id="tips" className="scroll-mt-32 py-14 sm:py-20">
          <div className="mx-auto max-w-6xl px-4 sm:px-6">
            <ScrollReveal className="mb-10 max-w-2xl" delay={0} y={20}>
              <Kicker>Work faster</Kicker>
              <h2 className="mt-3 text-2xl font-bold tracking-tight sm:text-3xl">Four habits that pay off</h2>
            </ScrollReveal>

            <ScrollReveal className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4" delay={80} y={26}>
              {tips.map((tip, index) => (
                <div key={tip.title} className="h-full">
                  <TiltCard
                    as="article"
                    className="group h-full p-5"
                    intensity={index % 2 === 0 ? 5 : 6}
                    lift={7}
                    interactive={interactive}
                    cursorLabel="Note"
                  >
                    <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10 transition-colors group-hover:bg-primary/15">
                      <tip.icon className="h-5 w-5 text-primary" />
                    </div>
                    <h3 className="mt-4 text-sm font-bold">{tip.title}</h3>
                    <p className="mt-2 text-xs leading-relaxed text-muted-foreground">{tip.body}</p>
                  </TiltCard>
                </div>
              ))}
            </ScrollReveal>
          </div>
        </section>

        {/* ── Themes ────────────────────────────────────────── */}
        <section id="themes" className="scroll-mt-32 py-14 sm:py-20">
          <div className="mx-auto max-w-6xl px-4 sm:px-6">
            <ScrollReveal className="mb-10 max-w-2xl" delay={0} y={20}>
              <Kicker>Appearance</Kicker>
              <h2 className="mt-3 text-2xl font-bold tracking-tight sm:text-3xl">
                Three themes, each in light and dark
              </h2>
              <p className="mt-3 text-sm leading-relaxed text-muted-foreground">
                Switch from Settings → Appearance and the whole workspace follows instantly — charts,
                panels and the sidebar included.
              </p>
            </ScrollReveal>

            <ScrollReveal className="grid gap-4 sm:grid-cols-3" delay={90} y={26}>
              {themes.map((theme) => (
                <div key={theme.name} className="h-full">
                  <TiltCard className="h-full p-5" intensity={4} lift={6} interactive={interactive} glow>
                    <div className="flex items-center gap-2">
                      {theme.colors.map((color) => (
                        <span
                          key={color}
                          className={cn("h-7 w-7 rounded-full ring-1", theme.ring)}
                          style={{ backgroundColor: color }}
                          aria-hidden="true"
                        />
                      ))}
                    </div>
                    <div className="mt-4 flex items-center gap-2">
                      <h3 className="text-sm font-bold">{theme.name}</h3>
                      <span className="rounded-full border border-border/60 bg-muted/40 px-2 py-0.5 text-[10px] font-semibold text-muted-foreground">
                        {theme.tag}
                      </span>
                    </div>
                    <p className="mt-2 text-xs leading-relaxed text-muted-foreground">{theme.blurb}</p>
                  </TiltCard>
                </div>
              ))}
            </ScrollReveal>
          </div>
        </section>

        {/* ── Final CTA ─────────────────────────────────────── */}
        <section id="start" className="scroll-mt-32 py-16 sm:py-20">
          <div className="mx-auto max-w-6xl px-4 sm:px-6">
            <ScrollReveal delay={0} y={26}>
              <div>
                <TiltCard className="relative overflow-hidden p-7 text-center sm:p-12" intensity={3} lift={5} interactive={interactive} glow>
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
                  <div className="relative">
                    <div className="aie-glow mx-auto mb-5 flex h-12 w-12 items-center justify-center rounded-2xl aie-gradient">
                      <Sparkles className="h-6 w-6 text-white" />
                    </div>
                    <h2 className="text-2xl font-bold tracking-tight sm:text-3xl">
                      You’ve seen the tour — now drive it
                    </h2>
                    <p className="mx-auto mt-3 max-w-md text-sm leading-relaxed text-muted-foreground">
                      Open the dashboard with a guest session and walk every section on real sample data.
                      No email code, nothing to clean up afterwards.
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
                        onClick={goToGuest}
                        data-cursor="hover"
                        className="gap-2 px-8"
                      >
                        <Sparkles className="h-4 w-4" />
                        Try without an account
                      </Button>
                      <Button
                        size="lg"
                        variant="ghost"
                        onClick={() => navigate("/")}
                        data-cursor="hover"
                        className="px-8 text-muted-foreground"
                      >
                        Back to landing
                      </Button>
                    </div>
                  </div>
                </TiltCard>
              </div>
            </ScrollReveal>
          </div>
        </section>

        {/* ── Footer ────────────────────────────────────────── */}
        <footer className="border-t border-border/50 py-10">
          <div className="mx-auto max-w-6xl px-4 sm:px-6">
            <div className="flex flex-col gap-8 sm:flex-row sm:items-start sm:justify-between">
              <div className="max-w-xs">
                <button
                  type="button"
                  onClick={() => navigate("/")}
                  className="flex items-center gap-2"
                  data-cursor="hover"
                >
                  <AIELogo size="sm" />
                  <span className="text-sm font-bold tracking-tight">AIE</span>
                </button>
                <p className="mt-3 text-xs leading-relaxed text-muted-foreground">
                  Agile Intelligence Engine — plan the sprint, run the board and read the risk before it
                  reads you.
                </p>
              </div>

              <div className="grid grid-cols-2 gap-8 sm:gap-14">
                <div>
                  <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">
                    This guide
                  </p>
                  <ul className="mt-3 space-y-2">
                    {navLinks.map((link) => (
                      <li key={link.id}>
                        <button
                          type="button"
                          onClick={() => scrollTo(link.id, ANCHOR_OFFSET)}
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
                  <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">
                    Product
                  </p>
                  <ul className="mt-3 space-y-2">
                    <li>
                      <button
                        type="button"
                        onClick={() => navigate("/")}
                        data-cursor="hover"
                        className="text-xs text-muted-foreground transition-colors hover:text-foreground"
                      >
                        Landing page
                      </button>
                    </li>
                    <li>
                      <button
                        type="button"
                        onClick={goToAuth}
                        data-cursor="hover"
                        className="text-xs text-muted-foreground transition-colors hover:text-foreground"
                      >
                        Open the dashboard
                      </button>
                    </li>
                    <li>
                      <button
                        type="button"
                        onClick={goToGuest}
                        data-cursor="hover"
                        className="text-xs text-muted-foreground transition-colors hover:text-foreground"
                      >
                        Guest preview
                      </button>
                    </li>
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
      </motion.div>
    </MotionConfig>
  );
}
