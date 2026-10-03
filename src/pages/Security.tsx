import { MotionConfig, motion, useScroll, useTransform } from "framer-motion";
import { useCallback, useEffect, useRef, useState } from "react";
import type { ReactNode } from "react";
import { useNavigate } from "react-router";
import { ArrowRight, CheckCircle2, ChevronDown, ShieldCheck } from "lucide-react";
import { AIELogo } from "@/components/AIELogo";
import { ThemeSwitcher } from "@/components/ThemeSwitcher";
import { AnimatedCounter } from "@/components/landing/AnimatedCounter";
import { CustomCursor } from "@/components/landing/CustomCursor";
import { DepthTransition } from "@/components/landing/DepthTransition";
import { MagneticButton } from "@/components/landing/MagneticButton";
import { ScrollProgressBar } from "@/components/landing/ScrollProgressBar";
import { ScrollReveal } from "@/components/landing/ScrollReveal";
import { SpaceBackdrop } from "@/components/landing/SpaceBackdrop";
import { TiltCard } from "@/components/landing/TiltCard";
import AppleCardsCarouselDemo from "@/components/guide/AppleCardsCarousel";
import {
  AccessMatrixMock,
  AiBoundaryMock,
} from "@/components/security/SecurityMocks";
import {
  controlAnchor,
  DEEP_DIVE_CONTROLS,
  DEFENCE_LAYERS,
  SECURITY_CONTROLS,
  SECURITY_FAQ,
  SecurityControlContent,
} from "@/components/security/security-content";
import type { SecurityControl } from "@/components/security/security-content";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { usePointerMode } from "@/hooks/use-pointer-mode";
import { useScrollSpine } from "@/hooks/use-scroll-spine";
import { useSmoothScroll } from "@/hooks/use-smooth-scroll";
import { useDarkSurface } from "@/hooks/use-theme";
import { useThemePalette } from "@/hooks/use-theme-palette";
import { pageVariants } from "@/lib/motion-variants";
import { cn } from "@/lib/utils";

/**
 * Security — the public trust page.
 *
 * A security page is only worth reading if it is specific, so every control
 * here names the file that implements it. The page makes no compliance claims
 * (no SOC 2, no ISO, no pen-test report) because none of that exists yet, and
 * claiming it would be the fastest way to lose the trust the rest of the page
 * is trying to earn.
 *
 * Chrome and motion vocabulary are shared with the landing page and the guide:
 * one starfield, one motion system, one theme state.
 */

const ANCHOR_OFFSET = -76;

function Kicker({ children }: { children: ReactNode }) {
  return <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-primary">{children}</p>;
}

/**
 * Visual column for controls that have no diagram: the guarantee list, shown
 * as a checklist card. Every control gets a section either way, so no chip in
 * the sticky nav points at a section that does not exist.
 */
function GuaranteePanel({ control }: { control: SecurityControl }) {
  return (
    <motion.div
      initial="hidden"
      whileInView="show"
      viewport={{ once: true, amount: 0.3 }}
      variants={{ hidden: {}, show: { transition: { staggerChildren: 0.06 } } }}
      className="rounded-2xl border border-border/60 bg-card/50 p-5"
    >
      <p className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-[0.16em] text-primary">
        <CheckCircle2 className="h-3.5 w-3.5" />
        What this control guarantees
      </p>
      <ul className="mt-4 space-y-2.5">
        {control.guarantees.map((item) => (
          <motion.li
            key={item}
            variants={{
              hidden: { opacity: 0, y: 10 },
              show: { opacity: 1, y: 0, transition: { duration: 0.24, ease: [0.2, 0, 0, 1] } },
            }}
            className="flex items-start gap-2.5 rounded-xl border border-border/50 bg-background/50 p-3"
          >
            <CheckCircle2 className="mt-0.5 h-3.5 w-3.5 shrink-0 text-chart-1" />
            <span className="text-xs leading-relaxed text-muted-foreground">{item}</span>
          </motion.li>
        ))}
      </ul>
    </motion.div>
  );
}

/** Scroll-driven panel: enters tilted, flattens as it reaches centre stage. */
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

const stats = [
  { to: 3, label: "Roles, server-enforced", detail: "Admin, User, Member" },
  { to: 12, label: "Gated write paths", detail: "requireRole before any destructive write" },
  { to: 5, label: "Audited actions", detail: "roles, invitations, guest purges" },
];

export default function Security() {
  const navigate = useNavigate();
  const palette = useThemePalette();
  const pointer = usePointerMode();
  const interactive = pointer.hover;
  const { scrollTo } = useSmoothScroll();
  const spine = useScrollSpine<HTMLDivElement>();

  // Public page, night sky — same contract as the landing page and the guide,
  // and the same shared theme state the navbar switcher writes to.
  useDarkSurface();

  const [openFaq, setOpenFaq] = useState<number | null>(0);
  const [activeSection, setActiveSection] = useState(SECURITY_CONTROLS[0].id);

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
    SECURITY_CONTROLS.forEach((control) => {
      const element = document.getElementById(control.id);
      if (element) observer.observe(element);
    });
    return () => observer.disconnect();
  }, []);

  const startTour = useCallback(
    () => scrollTo(SECURITY_CONTROLS[0].id, ANCHOR_OFFSET),
    [scrollTo],
  );

  const cards = SECURITY_CONTROLS.map((control) => ({
    src: control.image,
    title: control.title,
    category: control.category,
    content: <SecurityControlContent control={control} />,
  }));

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
                  Security &amp; Trust
                </span>
              </span>
            </button>

            <div className="hidden items-center gap-1 md:flex">
              {[
                { label: "Controls", id: SECURITY_CONTROLS[0].id },
                { label: "The AI", id: "ai-boundary" },
                { label: "Questions", id: "faq" },
                { label: "Guide", id: "/guide" },
              ].map((link) => (
                <button
                  key={link.label}
                  type="button"
                  onClick={() =>
                    link.id.startsWith("/") ? navigate(link.id) : scrollTo(link.id, ANCHOR_OFFSET)
                  }
                  data-cursor="hover"
                  className="rounded-lg px-3 py-2 text-xs font-medium text-muted-foreground transition-colors hover:bg-accent/50 hover:text-foreground"
                >
                  {link.label}
                </button>
              ))}
            </div>

            <div className="flex items-center gap-2">
              <ThemeSwitcher className="mr-1" />
              <MagneticButton enabled={interactive} strength={5}>
                <Button size="sm" onClick={() => navigate("/auth/ui")} data-cursor="hover" className="gap-1.5">
                  Open AIE <ArrowRight className="h-3.5 w-3.5" />
                </Button>
              </MagneticButton>
            </div>
          </div>
        </nav>

        {/* ── Chips nav ───────────────────────────────────── */}
        <div className="sticky top-16 z-40 border-b border-border/40 bg-background/75 backdrop-blur-md">
          <div className="mx-auto flex max-w-6xl gap-1.5 overflow-x-auto px-4 py-2.5 [scrollbar-width:none] sm:px-6 [&::-webkit-scrollbar]:hidden">
            {SECURITY_CONTROLS.map((control) => (
              <button
                key={control.id}
                type="button"
                onClick={() => scrollTo(controlAnchor(control), ANCHOR_OFFSET)}
                className={cn(
                  "shrink-0 rounded-full border px-3 py-1.5 text-[11px] font-medium transition-colors",
                  activeSection === control.id
                    ? "border-primary/50 bg-primary/15 text-primary"
                    : "border-border/60 text-muted-foreground hover:border-border hover:text-foreground",
                )}
              >
                {control.nav}
              </button>
            ))}
          </div>
        </div>

        {/* ── Hero ──────────────────────────────────────────── */}
        <section id="top" className="relative overflow-hidden">
          <div
            aria-hidden="true"
            className="landing-aurora absolute -left-24 top-10 h-[380px] w-[380px] rounded-full bg-primary/15"
          />
          <div
            aria-hidden="true"
            className="landing-aurora absolute -right-16 top-48 h-[320px] w-[320px] rounded-full bg-primary/10"
            style={{ animationDelay: "-6s" }}
          />

          <div className="relative mx-auto grid max-w-6xl items-center gap-12 px-4 pt-14 pb-12 sm:px-6 sm:pt-20 lg:grid-cols-[1.02fr_0.98fr] lg:gap-10 lg:pt-24">
            <div className="max-w-2xl">
              <ScrollReveal trigger="mount" selector="[data-intro]" delay={90} y={18} duration={700}>
                <div data-intro>
                  <Badge
                    variant="outline"
                    className="gap-1.5 rounded-full border-primary/30 bg-primary/10 px-3 py-1 text-[11px] font-medium text-primary"
                  >
                    <ShieldCheck className="h-3.5 w-3.5" />
                    Security &amp; Trust
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
                        Your roadmap
                      </span>
                    </span>
                    <span className="block overflow-hidden pb-1">
                      <span data-hero-line className="landing-shine block">
                        stays yours
                      </span>
                    </span>
                    <span className="block overflow-hidden pb-1">
                      <span data-hero-line className="block">
                        — here is exactly how.
                      </span>
                    </span>
                  </ScrollReveal>
                </h1>

                <p className="mt-6 max-w-xl text-sm leading-relaxed text-muted-foreground sm:text-base">
                  Most security pages are a compliance badge and a wall of policy language. This one
                  is the opposite: every control below names the code that enforces it, and we have
                  not listed a single certification we do not hold.
                </p>

                <div data-intro className="mt-8 flex flex-wrap items-center gap-3">
                  <MagneticButton enabled={interactive} strength={8}>
                    <Button size="lg" onClick={startTour} data-cursor="hover" className="gap-2 px-6">
                      Walk the controls <ArrowRight className="h-4 w-4" />
                    </Button>
                  </MagneticButton>
                  <Button
                    size="lg"
                    variant="outline"
                    onClick={() => navigate("/guide")}
                    data-cursor="hover"
                    className="gap-2 px-6"
                  >
                    See the product guide
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
              </ScrollReveal>
            </div>

            <div className="relative mx-auto w-full max-w-[540px]">
              <PerspectivePanel>
                <AccessMatrixMock />
              </PerspectivePanel>
              <span className="absolute -top-3 right-4 hidden items-center gap-1.5 rounded-full border border-border/60 bg-background/85 px-3 py-1.5 text-[10px] font-semibold text-muted-foreground shadow-lg backdrop-blur sm:flex">
                <span aria-hidden="true" className="h-1.5 w-1.5 animate-pulse rounded-full bg-primary" />
                Enforced in the mutation, not the UI
              </span>
            </div>
          </div>

          {/* Stats */}
          <div className="relative mx-auto max-w-6xl px-4 pb-14 sm:px-6">
            <ScrollReveal className="grid grid-cols-1 gap-4 sm:grid-cols-3" delay={70} y={22}>
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

        <DepthTransition label="The controls" animated={!pointer.reduced} />

        {/* ── The request path (scrubbed spine) ─────────────── */}
        <section id="path" className="scroll-mt-24 py-16 sm:py-20">
          <div className="mx-auto max-w-6xl px-4 sm:px-6">
            <ScrollReveal className="mb-14 max-w-2xl" delay={0} y={20}>
              <Kicker>The request path</Kicker>
              <h2 className="mt-3 text-2xl font-bold tracking-tight sm:text-3xl">
                Five gates before anything is written
              </h2>
              <p className="mt-3 text-sm leading-relaxed text-muted-foreground">
                The line on the left fills as you scroll. This is the order a request actually meets
                in AIE — not an aspiration, the sequence in the code.
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
                {DEFENCE_LAYERS.map((layer, index) => (
                  <ScrollReveal key={layer.title} delay={0} y={30}>
                    <div>
                      <TiltCard className="p-5 sm:p-6" intensity={4} lift={6} interactive={interactive} glow>
                        <div className="flex flex-wrap items-center gap-3">
                          <span className="flex h-9 w-9 items-center justify-center rounded-lg aie-gradient text-sm font-bold text-white">
                            {index + 1}
                          </span>
                          <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary/10">
                            <layer.icon className="h-4 w-4 text-primary" />
                          </span>
                          <h3 className="text-base font-bold">{layer.title}</h3>
                        </div>
                        <p className="mt-3.5 text-xs leading-relaxed text-muted-foreground sm:text-sm">
                          {layer.body}
                        </p>
                      </TiltCard>
                    </div>
                  </ScrollReveal>
                ))}
              </div>
            </div>
          </div>
        </section>

        {/* ── Card deck ─────────────────────────────────────── */}
        <section id="controls" className="scroll-mt-32 py-14 sm:py-16">
          <ScrollReveal delay={0} y={20}>
            <div>
              <AppleCardsCarouselDemo
                cards={cards}
                kicker="Six controls, six cards"
                title="Open a card and see how the control actually works."
              />
            </div>
          </ScrollReveal>
        </section>

        {/* ── Deep dives ────────────────────────────────────── */}
        {DEEP_DIVE_CONTROLS.filter((control) => control.diagram).map((control, index) => {
          const flipped = index % 2 === 1;
          return (
            <section key={control.id} id={control.id} className="scroll-mt-32 py-14 sm:py-20">
              <div className="mx-auto max-w-6xl px-4 sm:px-6">
                <div className="grid items-center gap-10 lg:grid-cols-2 lg:gap-14">
                  <ScrollReveal className={cn(flipped && "lg:order-2")} delay={40} y={26}>
                    <div className="flex items-center gap-3">
                      <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-primary/10">
                        <control.icon className="h-5 w-5 text-primary" />
                      </span>
                      <Badge
                        variant="outline"
                        className="rounded-full border-primary/30 bg-primary/10 text-[10px] text-primary"
                      >
                        {control.category}
                      </Badge>
                    </div>

                    <Kicker>
                      <span className="mt-6 block">{control.title}</span>
                    </Kicker>

                    <h2 className="mt-3 text-2xl font-bold tracking-tight text-balance sm:text-3xl">
                      {control.headline}
                    </h2>

                    <p className="mt-4 text-sm leading-relaxed text-muted-foreground">{control.lede}</p>

                    <div className="mt-6 rounded-2xl border border-border/60 bg-card/50 p-4">
                      <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-muted-foreground">
                        How it actually works
                      </p>
                      <ul className="mt-3 space-y-2">
                        {control.howItWorks.map((item) => (
                          <li
                            key={item}
                            className="flex items-start gap-2 text-xs leading-relaxed text-muted-foreground"
                          >
                            <span aria-hidden="true" className="mt-1.5 h-1 w-1 shrink-0 rounded-full bg-primary/70" />
                            <code className="font-mono text-[11px] text-foreground/90">{item}</code>
                          </li>
                        ))}
                      </ul>
                    </div>
                  </ScrollReveal>

                  <div className={cn(flipped && "lg:order-1")}>
                    <PerspectivePanel>
                      {control.diagram ?? <GuaranteePanel control={control} />}
                    </PerspectivePanel>
                  </div>
                </div>
              </div>
            </section>
          );
        })}

        {/* ── AI boundary ───────────────────────────────────── */}
        <section id="ai-boundary" className="scroll-mt-32 py-16 sm:py-20">
          <div className="mx-auto max-w-6xl px-4 sm:px-6">
            <div className="grid items-center gap-10 lg:grid-cols-2 lg:gap-14">
              <ScrollReveal delay={0} y={24}>
                <Kicker>The honest section</Kicker>
                <h2 className="mt-3 text-2xl font-bold tracking-tight sm:text-3xl">
                  What actually leaves your workspace
                </h2>
                <p className="mt-4 text-sm leading-relaxed text-muted-foreground">
                  An AI feature that pretends it reads nothing is not reassuring, it is just
                  dishonest. Here is the boundary, stated plainly.
                </p>
                <ul className="mt-6 space-y-3">
                  {[
                    "It reads your own workspace: projects, sprints, tasks, risks, time entries and team.",
                    "A question is sent to Google's Gemini API to be answered, carrying only the context that answer needs.",
                    "Its tools execute inside your authenticated session, under your role — it can do what you can do, and no more.",
                    "The API key is read from a server-side environment variable and is never shipped to the browser.",
                  ].map((point) => (
                    <li key={point} className="flex items-start gap-3">
                      <span className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-primary/10">
                        <ShieldCheck className="h-3.5 w-3.5 text-primary" />
                      </span>
                      <span className="text-xs leading-relaxed text-muted-foreground sm:text-sm">{point}</span>
                    </li>
                  ))}
                </ul>
              </ScrollReveal>

              <ScrollReveal delay={130} y={28}>
                <PerspectivePanel>
                  <AiBoundaryMock />
                </PerspectivePanel>
              </ScrollReveal>
            </div>
          </div>
        </section>

        <DepthTransition label="Questions" animated={!pointer.reduced} />

        {/* ── FAQ ───────────────────────────────────────────── */}
        <section id="faq" className="scroll-mt-32 py-16 sm:py-20">
          <div className="mx-auto max-w-3xl px-4 sm:px-6">
            <ScrollReveal className="mb-10 text-center" delay={0} y={20}>
              <Kicker>Questions</Kicker>
              <h2 className="mt-3 text-2xl font-bold tracking-tight sm:text-3xl">
                The ones security reviewers actually ask
              </h2>
            </ScrollReveal>

            <div className="space-y-3">
              {SECURITY_FAQ.map((item, index) => {
                const open = openFaq === index;
                return (
                  <motion.div
                    key={item.question}
                    initial={{ opacity: 0, y: 12 }}
                    whileInView={{ opacity: 1, y: 0 }}
                    viewport={{ once: true, amount: 0.3 }}
                    transition={{ duration: 0.32, ease: [0.2, 0, 0, 1], delay: index * 0.035 }}
                    className="overflow-hidden rounded-2xl border border-border/60 bg-card/50"
                  >
                    <button
                      type="button"
                      onClick={() => setOpenFaq(open ? null : index)}
                      aria-expanded={open}
                      className="flex w-full items-center justify-between gap-3 px-5 py-4 text-left"
                    >
                      <span className="text-sm font-semibold">{item.question}</span>
                      <ChevronDown
                        className={cn(
                          "h-4 w-4 shrink-0 text-muted-foreground transition-transform duration-300",
                          open && "rotate-180",
                        )}
                      />
                    </button>
                    <motion.div
                      initial={false}
                      animate={{ height: open ? "auto" : 0, opacity: open ? 1 : 0 }}
                      transition={{ duration: 0.28, ease: [0.2, 0, 0, 1] }}
                      className="overflow-hidden"
                    >
                      <p className="px-5 pb-4 text-xs leading-relaxed text-muted-foreground sm:text-sm">
                        {item.answer}
                      </p>
                    </motion.div>
                  </motion.div>
                );
              })}
            </div>
          </div>
        </section>

        {/* ── CTA ───────────────────────────────────────────── */}
        <section id="start" className="scroll-mt-32 py-16 sm:py-20">
          <div className="mx-auto max-w-6xl px-4 sm:px-6">
            <ScrollReveal delay={0} y={26}>
              <TiltCard className="relative overflow-hidden p-7 text-center sm:p-12" intensity={3} lift={5} interactive={interactive} glow>
                <div
                  aria-hidden="true"
                  className="landing-grid absolute inset-0 opacity-60"
                  style={{ borderRadius: "inherit" }}
                />
                <div className="relative">
                  <div className="aie-glow mx-auto mb-5 flex h-12 w-12 items-center justify-center rounded-2xl aie-gradient">
                    <ShieldCheck className="h-6 w-6 text-white" />
                  </div>
                  <h2 className="text-2xl font-bold tracking-tight sm:text-3xl">
                    Read it, then try it
                  </h2>
                  <p className="mx-auto mt-3 max-w-md text-sm leading-relaxed text-muted-foreground">
                    Nothing above is theoretical. Open the workspace as a guest and see the roles,
                    the audit log and the AI boundary behaving exactly as described.
                  </p>
                  <div className="mt-7 flex flex-wrap items-center justify-center gap-3">
                    <MagneticButton enabled={interactive} strength={9}>
                      <Button size="lg" onClick={() => navigate("/auth/ui")} data-cursor="hover" className="gap-2 px-8">
                        Open AIE <ArrowRight className="h-4 w-4" />
                      </Button>
                    </MagneticButton>
                    <Button
                      size="lg"
                      variant="outline"
                      onClick={() => navigate("/auth/ui?guest=1")}
                      data-cursor="hover"
                      className="gap-2 px-8"
                    >
                      Try it as a guest
                    </Button>
                    <Button
                      size="lg"
                      variant="ghost"
                      onClick={() => navigate("/guide")}
                      data-cursor="hover"
                      className="px-8 text-muted-foreground"
                    >
                      Read the guide
                    </Button>
                  </div>
                </div>
              </TiltCard>
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
                  Agile Intelligence Engine — plan the sprint, run the board and read the risk before
                  it reads you.
                </p>
              </div>

              <div className="grid grid-cols-2 gap-8 sm:gap-14">
                <div>
                  <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">
                    This page
                  </p>
                  <ul className="mt-3 space-y-2">
                    {[
                      { label: "Controls", id: SECURITY_CONTROLS[0].id },
                      { label: "The AI", id: "ai-boundary" },
                      { label: "Questions", id: "faq" },
                    ].map((link) => (
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
                        onClick={() => navigate("/guide")}
                        data-cursor="hover"
                        className="text-xs text-muted-foreground transition-colors hover:text-foreground"
                      >
                        Product guide
                      </button>
                    </li>
                    <li>
                      <button
                        type="button"
                        onClick={() => navigate("/auth/ui")}
                        data-cursor="hover"
                        className="text-xs text-muted-foreground transition-colors hover:text-foreground"
                      >
                        Open the dashboard
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