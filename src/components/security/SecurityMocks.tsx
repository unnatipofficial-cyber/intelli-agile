import { motion } from "framer-motion";
import type { ReactNode } from "react";
import type { Variants } from "framer-motion";
import { Check, Lock, ShieldCheck, X } from "lucide-react";
import { DURATION, EASING, STAGGER } from "@/lib/motion";
import { cn } from "@/lib/utils";

/**
 * SecurityMocks — animated diagrams for the Security & Trust page.
 *
 * Same approach as the guide's product mocks: real DOM built from theme
 * tokens, animated once when scrolled into view, so they stay crisp at any
 * size and follow the active theme.
 *
 * Every diagram mirrors something that actually exists in the codebase — the
 * three roles and the gate, the audit vocabulary, the guest-purge cascade. A
 * security page whose illustrations are decorative would be worth nothing.
 */

const VIEWPORT = { once: true, amount: 0.2 } as const;

const group: Variants = {
  hidden: {},
  show: { transition: { staggerChildren: STAGGER.step, delayChildren: 0.05 } },
};

const rise: Variants = {
  hidden: { opacity: 0, y: 12 },
  show: { opacity: 1, y: 0, transition: { duration: DURATION.enter, ease: EASING.standard } },
};

const growX: Variants = {
  hidden: { opacity: 0, scaleX: 0 },
  show: { opacity: 1, scaleX: 1, transition: { duration: DURATION.reveal, ease: EASING.emphasised } },
};

const draw: Variants = {
  hidden: { pathLength: 0, opacity: 0 },
  show: { pathLength: 1, opacity: 1, transition: { duration: DURATION.transition, ease: EASING.standard } },
};

const pop: Variants = {
  hidden: { opacity: 0, scale: 0.5 },
  show: { opacity: 1, scale: 1, transition: { duration: DURATION.enter, ease: EASING.standard } },
};

export function SecurityFrame({ title, url, children }: { title: string; url: string; children: ReactNode }) {
  return (
    <div className="aie-graphite-panel overflow-hidden rounded-2xl">
      <div className="flex items-center gap-1.5 border-b border-border/60 bg-muted/30 px-3 py-2.5 sm:px-4">
        <span aria-hidden="true" className="h-2.5 w-2.5 rounded-full bg-destructive/70" />
        <span aria-hidden="true" className="h-2.5 w-2.5 rounded-full bg-chart-3/70" />
        <span aria-hidden="true" className="h-2.5 w-2.5 rounded-full bg-chart-1/70" />
        <span className="ml-2 flex-1 truncate rounded-md bg-background/50 px-3 py-1 text-center font-mono text-[10px] text-muted-foreground">
          {url}
        </span>
      </div>
      <div className="bg-background/40 p-3 sm:p-4">
        <p className="mb-3 flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">
          <ShieldCheck className="h-3 w-3 text-primary" />
          {title}
        </p>
        {children}
      </div>
    </div>
  );
}

function Pill({ children, tone = "neutral" }: { children: ReactNode; tone?: "neutral" | "primary" | "danger" }) {
  const tones = {
    neutral: "border-border bg-muted/50 text-muted-foreground",
    primary: "border-primary/30 bg-primary/10 text-primary",
    danger: "border-destructive/30 bg-destructive/10 text-destructive",
  } as const;
  return (
    <span className={cn("inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] font-semibold", tones[tone])}>
      {children}
    </span>
  );
}

/* ── Access matrix ────────────────────────────────────────────── */

const matrix = [
  { capability: "Create / edit tasks", admin: true, user: true, member: true },
  { capability: "Manage team & roles", admin: true, user: false, member: false },
  { capability: "Send / revoke invites", admin: true, user: false, member: false },
  { capability: "Delete work", admin: true, user: true, member: false },
  { capability: "Read the audit log", admin: true, user: false, member: false },
];

export function AccessMatrixMock() {
  return (
    <motion.div variants={group} initial="hidden" whileInView="show" viewport={VIEWPORT}>
      <div className="overflow-hidden rounded-xl border border-border/60">
        <div className="grid grid-cols-[1fr_repeat(3,58px)] items-center gap-1 border-b border-border/60 bg-muted/30 px-3 py-2">
          <span className="text-[9px] font-semibold uppercase tracking-wider text-muted-foreground">
            Capability
          </span>
          {["ADMIN", "USER", "MEMBER"].map((role) => (
            <span key={role} className="text-center text-[9px] font-bold text-muted-foreground">
              {role}
            </span>
          ))}
        </div>
        {matrix.map((row) => (
          <motion.div
            key={row.capability}
            variants={rise}
            className="grid grid-cols-[1fr_repeat(3,58px)] items-center gap-1 border-b border-border/40 px-3 py-2 last:border-0"
          >
            <span className="truncate text-[11px]">{row.capability}</span>
            {[row.admin, row.user, row.member].map((allowed, index) => (
              <span key={index} className="flex justify-center">
                {allowed ? (
                  <motion.span
                    variants={pop}
                    className="flex h-4 w-4 items-center justify-center rounded-full bg-chart-1/15 text-chart-1"
                  >
                    <Check className="h-2.5 w-2.5" strokeWidth={3.5} />
                  </motion.span>
                ) : (
                  <motion.span variants={pop} className="flex h-4 w-4 items-center justify-center rounded-full bg-muted/60 text-muted-foreground/50">
                    <X className="h-2.5 w-2.5" strokeWidth={3} />
                  </motion.span>
                )}
              </span>
            ))}
          </motion.div>
        ))}
      </div>
      <motion.p variants={rise} className="mt-3 flex items-center gap-1.5 text-[10px] text-muted-foreground">
        <Lock className="h-3 w-3" />
        Checked on the server before the database is touched — not in the UI.
      </motion.p>
    </motion.div>
  );
}

/* ── Audit stream ─────────────────────────────────────────────── */

const auditEntries = [
  { actor: "Ada L.", action: "changed a role", target: "Sam K. · member → user", ago: "2m" },
  { actor: "Ada L.", action: "revoked an invitation", target: "dana@contractor.com", ago: "18m" },
  { actor: "System", action: "purged a guest session", target: "guest · anon-4f21", ago: "1h" },
  { actor: "Ada L.", action: "created an invitation", target: "ravi@partner.io", ago: "3h" },
];

export function AuditStreamMock() {
  return (
    <motion.div variants={group} initial="hidden" whileInView="show" viewport={VIEWPORT} className="space-y-2">
      {auditEntries.map((entry) => (
        <motion.div
          key={`${entry.actor}-${entry.ago}`}
          variants={rise}
          className="flex items-start gap-2.5 rounded-xl border border-border/60 bg-card/50 px-3 py-2.5"
        >
          <span className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-primary/15 text-[9px] font-bold text-primary">
            {entry.actor === "System" ? "SY" : entry.actor.split(" ").map((part) => part[0]).join("")}
          </span>
          <div className="min-w-0 flex-1">
            <p className="truncate text-[11px]">
              <span className="font-semibold">{entry.actor}</span>{" "}
              <span className="text-muted-foreground">{entry.action}</span>
            </p>
            <p className="truncate font-mono text-[10px] text-muted-foreground">{entry.target}</p>
          </div>
          <span className="shrink-0 text-[10px] text-muted-foreground/70">{entry.ago}</span>
        </motion.div>
      ))}
      <motion.div variants={rise} className="flex items-center justify-between rounded-xl border border-border/50 bg-muted/20 px-3 py-2">
        <span className="text-[10px] text-muted-foreground">Append-only history</span>
        <Pill tone="primary">Admin-only reads</Pill>
      </motion.div>
    </motion.div>
  );
}

/* ── AI data boundary ─────────────────────────────────────────── */

export function AiBoundaryMock() {
  return (
    <motion.div variants={group} initial="hidden" whileInView="show" viewport={VIEWPORT} className="space-y-3">
      <div className="relative rounded-xl border border-border/60 bg-card/40 p-3">
        <p className="mb-2 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
          What the assistant can read
        </p>
        <div className="flex flex-wrap gap-1.5">
          {["Projects", "Sprints", "Tasks", "Risks", "Time entries", "Team", "Comments"].map((scope) => (
            <motion.span
              key={scope}
              variants={rise}
              className="rounded-lg border border-border/60 bg-background/60 px-2 py-1 text-[10px] text-muted-foreground"
            >
              {scope}
            </motion.span>
          ))}
        </div>
        <p className="mt-2 text-[10px] text-muted-foreground">
          Read-only inside your session. No table outside this workspace is reachable.
        </p>
      </div>

      <div className="relative flex items-center justify-center py-1">
        <svg viewBox="0 0 200 24" className="h-6 w-full" aria-hidden="true">
          <motion.path
            variants={draw}
            d="M8 12 C 60 2, 140 22, 192 12"
            fill="none"
            strokeWidth="1.5"
            className="text-primary"
            stroke="currentColor"
          />
        </svg>
      </div>

      <motion.div variants={rise} className="rounded-xl border border-primary/30 bg-primary/5 p-3">
        <p className="text-[10px] font-semibold uppercase tracking-wider text-primary">
          The one outbound hop
        </p>
        <p className="mt-1.5 text-[11px] leading-relaxed text-muted-foreground">
          A question is sent to Google&apos;s Gemini API to be answered. It carries the question and the
          minimum project context needed to answer it. We do not send your whole workspace, and the
          response is never used to train anything of ours.
        </p>
        <div className="mt-2.5 flex flex-wrap gap-1.5">
          <Pill tone="primary">Server-side key only</Pill>
          <Pill>Model: Gemini</Pill>
          <Pill>Tools run in-session</Pill>
        </div>
      </motion.div>
    </motion.div>
  );
}

/* ── Guest purge cascade ──────────────────────────────────────── */

const purgeTargets = ["Auth accounts", "Verification codes", "Sessions", "Refresh tokens", "The user row"];

export function GuestPurgeMock() {
  return (
    <motion.div variants={group} initial="hidden" whileInView="show" viewport={VIEWPORT} className="space-y-2">
      <p className="text-[10px] text-muted-foreground">
        A guest session is anonymous with no email. Ending it removes every trace, in this order:
      </p>
      {purgeTargets.map((target, index) => (
        <motion.div key={target} variants={rise} className="flex items-center gap-2.5">
          <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-muted/60 text-[9px] font-bold text-muted-foreground">
            {index + 1}
          </span>
          <span className="text-[11px]">{target}</span>
          <motion.span
            variants={growX}
            className="ml-2 h-1 flex-1 origin-left rounded-full bg-destructive/50"
          />
          <Check className="h-3 w-3 shrink-0 text-chart-1" strokeWidth={3} />
        </motion.div>
      ))}
      <motion.div variants={rise} className="mt-1 flex justify-end">
        <Pill tone="danger">Recorded as guest.purged</Pill>
      </motion.div>
    </motion.div>
  );
}