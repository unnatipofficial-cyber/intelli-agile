import type { ComponentType, ReactNode } from "react";
import { useNavigate } from "react-router";
import {
  ArrowRight,
  Bot,
  CheckCircle2,
  Database,
  Fingerprint,
  KeyRound,
  ScrollText,
  Trash2,
  Users,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  AccessMatrixMock,
  AiBoundaryMock,
  AuditStreamMock,
  GuestPurgeMock,
} from "./SecurityMocks";

/**
 * Security & Trust page content.
 *
 * Every claim on this page is traceable to code in this repository. The
 * comments name the source: `src/convex/rbac.ts` for the roles and the gate,
 * `src/convex/audit.ts` for the actor resolution, `src/convex/users.ts` for
 * the guest purge, `src/convex/agent.ts` for the model provider. Nothing here
 * is aspirational — if a control is described, it is implemented; if it is not
 * implemented, it is not on the page.
 */

export interface SecurityControl {
  id: string;
  /** Short label for the sticky chips nav. */
  nav: string;
  category: string;
  title: string;
  headline: string;
  /** Cover image for the carousel card. */
  image: string;
  icon: ComponentType<{ className?: string }>;
  /** The one-sentence promise. */
  lede: string;
  /** What the reader gets, stated concretely. */
  guarantees: string[];
  /** The mechanism behind it, with the code path named. */
  howItWorks: string[];
  /** Optional animated diagram. */
  diagram?: ReactNode;
  /** Optional deep link into the app. */
  route?: string;
  /**
   * Anchor to scroll to, when it differs from `id`. Used by controls that get
   * a hand-written section instead of the generated deep-dive band, so the
   * chip nav and the section never disagree about which element is "the AI".
   */
  anchorId?: string;
  /** True when the page renders its own full section for this control. */
  dedicated?: boolean;
}

const unsplash = (id: string) => `https://images.unsplash.com/${id}?q=80&w=1200&auto=format&fit=crop`;

export const SECURITY_CONTROLS: SecurityControl[] = [
  {
    id: "access",
    nav: "Access",
    category: "Authorisation",
    title: "Role-based access",
    headline: "Three roles, checked on the server before the database is touched",
    image: unsplash("photo-1517245386807-bb43f82c33c4"),
    icon: Fingerprint,
    lede: "Not every teammate can delete production work or hand out access — and that decision is made on the server, not hidden in the interface.",
    guarantees: [
      "Admin, User and Member, defined once and enforced everywhere",
      "Destructive writes pass an explicit gate before they run",
      "A refused action returns a clear reason instead of failing silently",
    ],
    howItWorks: [
      "`requireRole` in `src/convex/rbac.ts` is the single gate destructive mutations call before touching the database",
      "Admins hold full control plus workspace administration; Users manage their own work including deletes; Members do everything except remove",
      "The UI reflects roles, but hiding a button is never the enforcement — the mutation itself refuses",
    ],
    diagram: <AccessMatrixMock />,
  },
  {
    id: "invitations",
    nav: "Invites",
    category: "Access",
    title: "Invitations",
    headline: "An invite you can take back",
    image: unsplash("photo-1522071820081-009f0129c71c"),
    icon: KeyRound,
    lede: "Share a link, set the role, and revoke it the moment something looks wrong — the link stops working immediately and the change is recorded.",
    guarantees: [
      "Links are revocable at any time, with no waiting period",
      "Only an Admin can send or revoke an invitation",
      "Every send, acceptance and revocation is audited",
    ],
    howItWorks: [
      "`src/convex/invitations.ts` requires the Admin role before creating or revoking",
      "Revoking deletes the invitation row outright, so the link stops resolving immediately",
      "The invitation's email is written into the audit entry before the row disappears",
    ],
    route: "/dashboard/settings",
  },
  {
    id: "guests",
    nav: "Guests",
    category: "Privacy",
    title: "Guest sessions",
    headline: "A throwaway session that leaves nothing behind",
    image: unsplash("photo-1519389950473-47ba0277781c"),
    icon: Trash2,
    lede: "Guest mode exists so someone can try the product without an account. When the session ends, everything it created is removed — accounts, codes, sessions and the user record itself.",
    guarantees: [
      "Guests are anonymous and carry no email address",
      "Ending a session purges accounts, sessions, tokens and the user row",
      "The purge is recorded, and the actor name survives deletion",
    ],
    howItWorks: [
      "`isEphemeralGuest` in `src/convex/helpers.ts` defines a guest as anonymous with no email",
      "`endGuestSession` in `src/convex/users.ts` deletes accounts and verification codes first, then sessions and refresh tokens, then the user row",
      "The audit entry keeps the actor's name so the history still reads correctly after the record is gone",
    ],
    diagram: <GuestPurgeMock />,
  },
  {
    id: "audit",
    nav: "Audit",
    category: "Accountability",
    title: "Audit log",
    headline: "Who changed what, recorded by the server",
    image: unsplash("photo-1554224155-6726b3ff858f"),
    icon: ScrollText,
    lede: "Role changes, invitations and guest purges are all recorded. The writer resolves who did it from the caller's own authenticated identity, so an entry cannot be forged.",
    guarantees: [
      "Entries are append-only and readable by admins alone",
      "The actor is resolved server-side, never supplied by the caller",
      "A failed audit write never rolls back the action it was recording",
    ],
    howItWorks: [
      "`record` in `src/convex/audit.ts` is an internalMutation — only server functions can call it at all",
      "The actor is read from the authenticated identity inside the mutation; the argument for it is never trusted",
      "It is written not to throw, so losing an audit row can never fail a legitimate role change",
    ],
    diagram: <AuditStreamMock />,
    route: "/dashboard/settings",
  },
  {
    id: "ai",
    // This control gets its own hand-written section further down the page
    // (the "honest section"), so it opts out of the generated deep-dive band
    // and points its chip at that section instead.
    anchorId: "ai-boundary",
    dedicated: true,
    nav: "AI",
    category: "AI boundary",
    title: "The AI boundary",
    headline: "Exactly what leaves your workspace, and why",
    image: unsplash("photo-1593508512255-86ab42a8e620"),
    icon: Bot,
    lede: "The assistant is the part of an AI product most likely to worry a security reviewer, so here is the boundary in plain terms: what it reads, what leaves, and what it can never touch.",
    guarantees: [
      "It reads workspace data only — there is no cross-workspace path",
      "Tools execute inside your authenticated session, under your role",
      "The single outbound hop is to Google's Gemini API, with the minimum context needed",
    ],
    howItWorks: [
      "Tools in `src/convex/agent.ts` resolve the current user and project server-side on every call",
      "The API key lives in server-side environment variables and is never sent to the browser",
      "The API key never reaches the client bundle; every call is made from a Convex action",
    ],
    diagram: <AiBoundaryMock />,
  },
  {
    id: "data",
    nav: "Data",
    category: "Data",
    title: "Your data",
    headline: "Eighteen tables, one workspace, no strangers",
    image: unsplash("photo-1454165804606-c3d57bc86b40"),
    icon: Database,
    lede: "Everything AIE knows about your delivery lives in tables you can enumerate — projects, sprints, tasks, risks, comments, time entries, retrospectives and the activity history behind them.",
    guarantees: [
      "A closed set of tables, all visible in the schema",
      "Project membership scopes what each person can reach",
      "Sign-in is by emailed code, Google account, or a guest session",
    ],
    howItWorks: [
      "The data model is defined in one file, `src/convex/schema.ts`, and nothing is stored outside it",
      "Seats and roles are recorded per project in `projectMembers`",
      "Authentication is handled by Convex Auth: email one-time codes, Google, or anonymous guest",
    ],
  },
];

/** Layers of the request path, shown as a scroll-scrubbed spine. */
/** The anchor a control's chip should scroll to. */
export function controlAnchor(control: SecurityControl): string {
  return control.anchorId ?? control.id;
}

/** Controls rendered by the generated deep-dive band, in page order. */
export const DEEP_DIVE_CONTROLS = SECURITY_CONTROLS.filter(
  (control) => !control.dedicated,
);

export const DEFENCE_LAYERS = [
  {
    icon: Fingerprint,
    title: "Identity",
    body: "Every request is authenticated first. An anonymous caller is not a caller — the mutation refuses before it looks at your data.",
  },
  {
    icon: Users,
    title: "Role",
    body: "The authenticated identity is resolved to a role, and destructive writes ask that role for permission before any write happens.",
  },
  {
    icon: Database,
    title: "Scope",
    body: "Queries are scoped to the caller's own workspace and project membership, so one team cannot read another's board.",
  },
  {
    icon: ScrollText,
    title: "Record",
    body: "Administrative changes are appended to an audit trail whose actor the server resolves for itself.",
  },
  {
    icon: Trash2,
    title: "Purge",
    body: "Data you do not want kept can be deleted outright — ending a guest session removes the account it created.",
  },
] as const;

export const SECURITY_FAQ = [
  {
    question: "Can a teammate delete my work?",
    answer:
      "Only Admins and Users. Members can create and edit everything, but deletion is refused for them — the mutation itself refuses, not just the button.",
  },
  {
    question: "Who can see the audit log?",
    answer: "Admins only. It records role changes, invitations created, revoked and accepted, and guest sessions purged.",
  },
  {
    question: "Does the AI train on my workspace?",
    answer:
      "Nothing here is used to train a model of ours. A question is sent to Google's Gemini API to be answered, with only the context needed for that answer.",
  },
  {
    question: "What happens to data if I use guest mode?",
    answer:
      "Guest sessions are anonymous. Ending the session removes the accounts, verification codes, sessions, refresh tokens and the user record it created.",
  },
  {
    question: "Is my API key exposed to the browser?",
    answer:
      "No. Model calls are made from server-side Convex actions, and the key is read from an environment variable that is never shipped to the client.",
  },
];

/** Card deck content for the carousel's modal. */
export function SecurityControlContent({ control }: { control: SecurityControl }) {
  const navigate = useNavigate();
  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <p className="text-sm leading-relaxed text-muted-foreground sm:text-base">{control.lede}</p>

      <div className="rounded-2xl border border-border/60 bg-card/50 p-4">
        <p className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-[0.16em] text-primary">
          <CheckCircle2 className="h-3.5 w-3.5" />
          What you get
        </p>
        <ul className="mt-3 space-y-2">
          {control.guarantees.map((item) => (
            <li key={item} className="flex items-start gap-2 text-xs leading-relaxed text-muted-foreground">
              <span aria-hidden="true" className="mt-1.5 h-1 w-1 shrink-0 rounded-full bg-primary/70" />
              {item}
            </li>
          ))}
        </ul>
      </div>

      <div className="rounded-2xl border border-border/60 bg-card/50 p-4">
        <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-muted-foreground">
          How it actually works
        </p>
        <ul className="mt-3 space-y-2">
          {control.howItWorks.map((item) => (
            <li key={item} className="flex items-start gap-2 text-xs leading-relaxed text-muted-foreground">
              <span aria-hidden="true" className="mt-1.5 h-1 w-1 shrink-0 rounded-full bg-muted-foreground/50" />
              <code className="font-mono text-[11px] text-foreground/90">{item}</code>
            </li>
          ))}
        </ul>
      </div>

      {control.diagram}

      {control.route && (
        <div className="flex flex-wrap items-center gap-3 border-t border-border/50 pt-5">
          <Button onClick={() => navigate(control.route!)} className="gap-1.5">
            See it in Settings <ArrowRight className="h-4 w-4" />
          </Button>
          <p className="text-xs text-muted-foreground">
            Requires an account — you will be asked to sign in first.
          </p>
        </div>
      )}
    </div>
  );
}