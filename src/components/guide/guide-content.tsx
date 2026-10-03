import { useNavigate } from "react-router";
import {
  ArrowRight,
  BarChart3,
  Brain,
  CheckCircle2,
  Columns3,
  FolderKanban,
  Layers,
  LayoutDashboard,
  ListTodo,
  Settings as SettingsIcon,
  ShieldAlert,
  Sparkles,
  Users,
} from "lucide-react";
import type { ComponentType } from "react";
import type { ReactNode } from "react";
import { Button } from "@/components/ui/button";
import type { CarouselCardData } from "./AppleCardsCarousel";
import {
  AnalyticsMock,
  BacklogMock,
  BoardMock,
  DashboardMock,
  IntelligenceMock,
  MockFrame,
  ProjectsMock,
  RiskMatrixMock,
  SettingsMock,
  TasksMock,
  TeamMock,
} from "./GuideMocks";

/**
 * Guide content — the single source of truth for what the guide says about
 * each section of the product.
 *
 * Every entry feeds three surfaces: the deep-dive band on the guide page, the
 * card in the carousel, and that card's expanded modal. Keeping the data here
 * (rather than inline in the page) means the deck and the deep dives can never
 * drift apart, and adding a section is one object.
 */

export interface GuideSection {
  /** Anchor id, also the chips-nav target. */
  id: string;
  /** Short label for the sticky chips bar. */
  nav: string;
  /** Two-digit position shown in the deep-dive band. */
  index: string;
  /** Carousel card category. */
  category: string;
  /** Product name of the section, as it appears in the sidebar. */
  title: string;
  /** Deep-dive headline. */
  headline: string;
  /** Real route inside the app. */
  route: string;
  /** Fake address-bar text for the mock frame. */
  url: string;
  /** Cover photo for the carousel card. */
  image: string;
  /** Sidebar icon this section uses (same family as the real nav). */
  icon: ComponentType<{ className?: string }>;
  lede: string;
  /** Three things the reader personally does on this page. */
  youDo: string[];
  /** Three things AIE does for them in return. */
  itDoes: string[];
  /** The animated live preview. */
  mock: ReactNode;
}

const unsplash = (id: string) => `https://images.unsplash.com/${id}?q=80&w=1200&auto=format&fit=crop`;

export const GUIDE_SECTIONS: GuideSection[] = [
  {
    id: "dashboard",
    nav: "Dashboard",
    index: "01",
    category: "Overview",
    title: "Dashboard",
    headline: "The pulse of every project, the moment you sign in",
    route: "/dashboard",
    url: "aie.app/dashboard",
    image: unsplash("photo-1551288049-bebda4e38f71"),
    icon: LayoutDashboard,
    lede: "The dashboard is your at-a-glance answer to “how are things going?”. It rolls every project into health, sprint progress, workload and open risks — then points at what deserves attention first.",
    youDo: [
      "Scan the KPI tiles: projects, completed points, pending work, open risks",
      "Read the sprint burndown against the ideal line",
      "Jump from any signal straight to the page behind it",
    ],
    itDoes: [
      "Scores each project’s health from progress, scope and risk",
      "Updates the moment a card moves on the board",
      "Streams recent activity so nothing changes in silence",
    ],
    mock: <DashboardMock />,
  },
  {
    id: "projects",
    nav: "Projects",
    index: "02",
    category: "Portfolio",
    title: "Projects",
    headline: "Every initiative gets its own world",
    route: "/dashboard/projects",
    url: "aie.app/dashboard/projects",
    image: unsplash("photo-1454165804606-c3d57bc86b40"),
    icon: FolderKanban,
    lede: "Projects are the containers for everything else. Each one owns a backlog, sprints, a board, risks and reports — so context never bleeds between initiatives and every chart has a clear scope.",
    youDo: [
      "Create a project with a name, key and goal",
      "Open one to enter its backlog, sprints and reports",
      "Or seed a realistic sample workspace in one click",
    ],
    itDoes: [
      "Scopes every query and chart to the project you’re in",
      "Tracks progress, health and key metrics per project",
      "Keeps members and permissions consistent workspace-wide",
    ],
    mock: <ProjectsMock />,
  },
  {
    id: "backlog",
    nav: "Backlog",
    index: "03",
    category: "Planning",
    title: "Backlog",
    headline: "Shape ideas into estimable, ordered work",
    route: "/dashboard/backlog",
    url: "aie.app/dashboard/backlog",
    image: unsplash("photo-1484480974693-6ca0a78fb36b"),
    icon: Layers,
    lede: "The backlog is where work is born. Organise it as epics → user stories → tasks and bugs, estimate with story points, tag with labels, then pull the top of the queue into the next sprint.",
    youDo: [
      "Create epics, stories, tasks and bugs in one hierarchy",
      "Set priority, points, labels, assignee and due date",
      "Filter by status, sprint, assignee or label",
      "Pull a sprint’s worth of work when you’re ready",
    ],
    itDoes: [
      "Keeps estimates and statuses in sync with the board",
      "Rolls story points up to the parent epic",
      "Always leaves the next sprint an ordered queue to draw from",
    ],
    mock: <BacklogMock />,
  },
  {
    id: "sprint-board",
    nav: "Board",
    index: "04",
    category: "Execution",
    title: "Sprint Board",
    headline: "A Kanban that reflects what is actually happening",
    route: "/dashboard/sprint-board",
    url: "aie.app/dashboard/sprint-board",
    image: unsplash("photo-1517245386807-bb43f82c33c4"),
    icon: Columns3,
    lede: "Four columns — To Do, In Progress, Review, Done. Drag a card and the status updates everywhere: dashboard, analytics, burndown and the AI engine all read from the same move.",
    youDo: [
      "Drag cards between columns as work moves",
      "Set the sprint goal and watch progress against it",
      "Assign owners and priorities without leaving the board",
    ],
    itDoes: [
      "Writes status changes back to the task instantly",
      "Recomputes burndown and velocity from real movement",
      "Highlights work sitting too long in one column",
    ],
    mock: <BoardMock />,
  },
  {
    id: "tasks",
    nav: "Tasks",
    index: "05",
    category: "Execution",
    title: "Tasks",
    headline: "Every task, filterable to the exact slice you need",
    route: "/dashboard/tasks",
    url: "aie.app/dashboard/tasks",
    image: unsplash("photo-1498050108023-c5249f4df085"),
    icon: ListTodo,
    lede: "The Tasks page is the flat, sortable view of everything in the project — ideal when you want rows, not columns. Filter by status, priority, assignee or sprint, then open any task for its full detail sheet.",
    youDo: [
      "Filter and sort across the whole project in seconds",
      "Open a task for description, comments and history",
      "Log time against a task as you work",
      "Create or edit without breaking your flow",
    ],
    itDoes: [
      "Keeps list, board and backlog as three views of one truth",
      "Records time entries and rolls them into reports",
      "Feeds every change to the activity stream and AI notes",
    ],
    mock: <TasksMock />,
  },
  {
    id: "team",
    nav: "Team",
    index: "06",
    category: "People",
    title: "Team",
    headline: "Workload you can see before someone burns out",
    route: "/dashboard/team",
    url: "aie.app/dashboard/team",
    image: unsplash("photo-1522071820081-009f0129c71c"),
    icon: Users,
    lede: "The Team page answers the two questions every standup needs: who has capacity, and who is carrying too much. Assignments roll into per-member workload bars with completed and pending story points.",
    youDo: [
      "Add members and set roles — admin, member or viewer",
      "Assign tasks and watch each bar respond",
      "Open a member’s report for their sprints and risks",
    ],
    itDoes: [
      "Sums assigned points into live workload bars",
      "Colour-codes overload before it becomes a schedule slip",
      "Tracks completed SP per member as a velocity signal",
    ],
    mock: <TeamMock />,
  },
  {
    id: "risks",
    nav: "Risks",
    index: "07",
    category: "Risk",
    title: "Risks",
    headline: "Probability × impact, on one honest matrix",
    route: "/dashboard/risks",
    url: "aie.app/dashboard/risks",
    image: unsplash("photo-1554224155-6726b3ff858f"),
    icon: ShieldAlert,
    lede: "Risks are logged with probability, impact, severity, an owner and a mitigation plan — then plotted on an interactive matrix, so a critical risk can never hide at the bottom of a list.",
    youDo: [
      "Log a risk with probability, impact and an owner",
      "Describe the mitigation and drive status to resolved",
      "Click a matrix cell to see every risk in that band",
    ],
    itDoes: [
      "Positions each dot by probability × impact automatically",
      "Feeds open critical risks into the dashboard and briefing",
      "Keeps an owner accountable until it is closed",
    ],
    mock: <RiskMatrixMock />,
  },
  {
    id: "analytics",
    nav: "Analytics",
    index: "08",
    category: "Reporting",
    title: "Analytics & Reports",
    headline: "Six views of the same truth — plus a report to share",
    route: "/dashboard/analytics",
    url: "aie.app/dashboard/analytics",
    image: unsplash("photo-1460925895917-afdab827c52f"),
    icon: BarChart3,
    lede: "Analytics turns your board’s history into velocity trends, burndown, completion, priority mix, workload and risk charts. Reports packages the selected project into a summary you can take to a review.",
    youDo: [
      "Switch between velocity, burndown, completion, priority, workload and risk",
      "Scope every chart by project and sprint",
      "Open Reports for the printable project summary",
    ],
    itDoes: [
      "Computes velocity from points actually completed per sprint",
      "Projects burndown against the ideal line",
      "Refreshes live as the board moves — no manual entry",
    ],
    mock: <AnalyticsMock />,
  },
  {
    id: "intelligence",
    nav: "AI",
    index: "09",
    category: "AI",
    title: "AI Intelligence",
    headline: "An engine that reads the same board your team does",
    route: "/dashboard",
    url: "aie.app/dashboard · ask AIE",
    image: unsplash("photo-1593508512255-86ab42a8e620"),
    icon: Brain,
    lede: "The assistant sits in the corner of your workspace. Ask about sprint health, risks or workload and it answers from your real data — or schedule a briefing and let it come to you every weekday.",
    youDo: [
      "Ask anything: “What’s at risk across my projects?”",
      "Schedule briefings: “Every weekday at 9am, tell me what’s at risk”",
      "Use the Intelligence panel for live sprint-health notes",
    ],
    itDoes: [
      "Reads sprints, tasks, risks and time entries — never invented metrics",
      "Runs workspace tools inside your session to answer precisely",
      "Streams progress live, with a deterministic fallback digest",
    ],
    mock: <IntelligenceMock />,
  },
  {
    id: "settings",
    nav: "Settings",
    index: "10",
    category: "Workspace",
    title: "Settings",
    headline: "Your profile, your look, your people — under control",
    route: "/dashboard/settings",
    url: "aie.app/dashboard/settings",
    image: unsplash("photo-1555949963-aa79dcee981c"),
    icon: SettingsIcon,
    lede: "Settings holds everything personal and administrative: your profile, appearance (three themes × light and dark), members and roles, invitations with copyable links, guest sessions and the admin audit log.",
    youDo: [
      "Switch appearance: Graphite, Modern Minimal or Darkmatter",
      "Invite teammates by link and set their role",
      "Copy or revoke an invitation at any time",
      "Review the audit log for who changed what",
    ],
    itDoes: [
      "Applies the theme across every page instantly",
      "Revoked links die immediately, accepted invites are audited",
      "Records role changes, invites and guest purges",
    ],
    mock: <SettingsMock />,
  },
];

/* ── Shared pieces of a section explanation ───────────────────── */

/** The two "you do / AIE does" lists. */
export function SectionLists({ section }: { section: GuideSection }) {
  return (
    <div className="grid gap-3 sm:grid-cols-2">
      <ListPanel label="What you do" items={section.youDo} tone="primary" />
      <ListPanel label="What AIE does" items={section.itDoes} tone="spark" />
    </div>
  );
}

function ListPanel({
  label,
  items,
  tone,
}: {
  label: string;
  items: string[];
  tone: "primary" | "spark";
}) {
  return (
    <div className="rounded-2xl border border-border/60 bg-card/50 p-4">
      <p className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-[0.16em] text-primary">
        {tone === "primary" ? (
          <CheckCircle2 className="h-3.5 w-3.5" />
        ) : (
          <Sparkles className="h-3.5 w-3.5" />
        )}
        {label}
      </p>
      <ul className="mt-3 space-y-2">
        {items.map((item) => (
          <li key={item} className="flex items-start gap-2 text-xs leading-relaxed text-muted-foreground">
            <span aria-hidden="true" className="mt-1.5 h-1 w-1 shrink-0 rounded-full bg-primary/70" />
            {item}
          </li>
        ))}
      </ul>
    </div>
  );
}

/** The animated preview in its browser-style frame, with a caption. */
export function SectionMock({ section }: { section: GuideSection }) {
  return (
    <div>
      <p className="mb-2.5 flex items-center gap-2 text-[10px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">
        <span aria-hidden="true" className="h-1.5 w-1.5 animate-pulse rounded-full bg-primary" />
        Live preview — animates from your real data
      </p>
      <MockFrame url={section.url}>{section.mock}</MockFrame>
    </div>
  );
}

/** Button that deep-links into the real section (auth preserves the path). */
export function SectionCTA({ section, variant = "default" }: { section: GuideSection; variant?: "default" | "outline" }) {
  const navigate = useNavigate();
  return (
    <Button
      variant={variant}
      onClick={() => navigate(section.route)}
      className="gap-1.5"
    >
      Open {section.title.replace(" & Reports", "")} <ArrowRight className="h-4 w-4" />
    </Button>
  );
}

/** Full explanation used inside the carousel card’s modal. */
export function SectionGuideContent({ section }: { section: GuideSection }) {
  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <p className="text-sm leading-relaxed text-muted-foreground sm:text-base">{section.lede}</p>
      <SectionLists section={section} />
      <SectionMock section={section} />
      <div className="flex flex-wrap items-center gap-3 border-t border-border/50 pt-5">
        <SectionCTA section={section} />
        <p className="text-xs text-muted-foreground">
          Signed out? AIE will ask you to sign in and bring you right back here.
        </p>
      </div>
    </div>
  );
}

/** Carousel deck data — one card per section. */
export const GUIDE_CARDS: CarouselCardData[] = GUIDE_SECTIONS.map((section) => ({
  src: section.image,
  title: section.title,
  category: section.category,
  content: <SectionGuideContent section={section} />,
}));
