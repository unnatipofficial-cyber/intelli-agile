import { useState, useEffect, useCallback } from "react";
import { useQuery } from "convex/react";
import { api } from "../convex/_generated/api";
import { motion, AnimatePresence } from "framer-motion";
import { useNavigate } from "react-router";
import { SPRING } from "@/lib/motion";
import {
  Search,
  LayoutDashboard,
  FolderKanban,
  ListTodo,
  Columns3,
  Users,
  AlertTriangle,
  BarChart3,
  FileText,
  Settings,
  Plus,
  Zap,
} from "lucide-react";

interface CommandItem {
  id: string;
  label: string;
  description?: string;
  icon: React.ReactNode;
  action: () => void;
  category: string;
}

export default function CommandPalette() {
  const [isOpen, setIsOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [selectedIndex, setSelectedIndex] = useState(0);
  const navigate = useNavigate();

  const projects = useQuery(api.projects.list);
  const tasks = useQuery(
    api.tasks.list,
    projects && projects.length > 0 ? { projectId: projects[0]._id } : "skip"
  );

  // Global keyboard shortcut
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === "k") {
        e.preventDefault();
        setIsOpen((prev) => !prev);
      }
      if (e.key === "Escape") setIsOpen(false);
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, []);

  const buildItems = useCallback((): CommandItem[] => {
    const items: CommandItem[] = [];

    // Navigation items
    const navItems = [
      { path: "/dashboard", label: "Dashboard", icon: <LayoutDashboard className="w-4 h-4" /> },
      { path: "/projects", label: "Projects", icon: <FolderKanban className="w-4 h-4" /> },
      { path: "/backlog", label: "Backlog", icon: <ListTodo className="w-4 h-4" /> },
      { path: "/sprint-board", label: "Sprint Board", icon: <Columns3 className="w-4 h-4" /> },
      { path: "/team", label: "Team", icon: <Users className="w-4 h-4" /> },
      { path: "/risks", label: "Risks", icon: <AlertTriangle className="w-4 h-4" /> },
      { path: "/analytics", label: "Analytics", icon: <BarChart3 className="w-4 h-4" /> },
      { path: "/reports", label: "Reports", icon: <FileText className="w-4 h-4" /> },
      { path: "/settings", label: "Settings", icon: <Settings className="w-4 h-4" /> },
    ];

    navItems.forEach((nav) => {
      items.push({
        id: `nav-${nav.path}`,
        label: nav.label,
        icon: nav.icon,
        action: () => {
          navigate(nav.path);
          setIsOpen(false);
        },
        category: "Navigation",
      });
    });

    // Quick actions
    items.push({
      id: "action-new-task",
      label: "Create New Task",
      description: "Add a task to the backlog",
      icon: <Plus className="w-4 h-4" />,
      action: () => {
        navigate("/backlog");
        setIsOpen(false);
      },
      category: "Quick Actions",
    });

    items.push({
      id: "action-new-project",
      label: "Create New Project",
      description: "Start a new project",
      icon: <Plus className="w-4 h-4" />,
      action: () => {
        navigate("/projects");
        setIsOpen(false);
      },
      category: "Quick Actions",
    });

    // Task search
    if (tasks) {
      tasks.slice(0, 20).forEach((task) => {
        items.push({
          id: `task-${task._id}`,
          label: task.title,
          description: `${task.status} · ${task.priority} ${task.storyPoints ? `· ${task.storyPoints} SP` : ""}`,
          icon: <Zap className="w-4 h-4" />,
          action: () => {
            navigate("/sprint-board");
            setIsOpen(false);
          },
          category: "Tasks",
        });
      });
    }

    return items;
  }, [projects, tasks, navigate]);

  const items = buildItems();
  const filtered = query
    ? items.filter(
        (item) =>
          item.label.toLowerCase().includes(query.toLowerCase()) ||
          item.description?.toLowerCase().includes(query.toLowerCase())
      )
    : items;

  // Group by category
  const grouped = filtered.reduce(
    (acc, item) => {
      if (!acc[item.category]) acc[item.category] = [];
      acc[item.category].push(item);
      return acc;
    },
    {} as Record<string, CommandItem[]>
  );

  useEffect(() => {
    setSelectedIndex(0);
  }, [query]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setSelectedIndex((i) => Math.min(i + 1, filtered.length - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setSelectedIndex((i) => Math.max(i - 1, 0));
    } else if (e.key === "Enter" && filtered[selectedIndex]) {
      filtered[selectedIndex].action();
    }
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 bg-black/40 backdrop-blur-sm"
            onClick={() => setIsOpen(false)}
          />
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: -10 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: -10 }}
            transition={{ type: "spring", ...SPRING.snappy }}
            className="fixed top-[15%] left-1/2 -translate-x-1/2 z-50 w-full max-w-lg rounded-xl border border-border/50 bg-background shadow-2xl overflow-hidden"
          >
            {/* Search input */}
            <div className="flex items-center gap-3 px-4 py-3 border-b border-border/50">
              <Search className="w-4 h-4 text-muted-foreground" />
              <input
                autoFocus
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="Type a command or search..."
                className="flex-1 bg-transparent text-sm outline-none placeholder:text-muted-foreground"
              />
              <kbd className="text-[10px] text-muted-foreground bg-muted px-1.5 py-0.5 rounded">ESC</kbd>
            </div>

            {/* Results */}
            <div className="max-h-[300px] overflow-y-auto p-2">
              {Object.entries(grouped).map(([category, catItems]) => (
                <div key={category} className="mb-2">
                  <p className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider px-2 py-1">
                    {category}
                  </p>
                  {catItems.map((item) => {
                    const globalIndex = filtered.indexOf(item);
                    return (
                      <button
                        key={item.id}
                        onClick={item.action}
                        onMouseEnter={() => setSelectedIndex(globalIndex)}
                        className={`w-full flex items-center gap-3 px-3 py-2 rounded-lg text-sm transition-colors ${
                          globalIndex === selectedIndex
                            ? "bg-accent text-accent-foreground"
                            : "text-foreground hover:bg-muted/60"
                        }`}
                      >
                        <span className="text-muted-foreground">{item.icon}</span>
                        <div className="text-left flex-1 min-w-0">
                          <p className="truncate">{item.label}</p>
                          {item.description && (
                            <p className="text-[11px] text-muted-foreground truncate">{item.description}</p>
                          )}
                        </div>
                      </button>
                    );
                  })}
                </div>
              ))}
              {filtered.length === 0 && (
                <p className="text-sm text-muted-foreground text-center py-8">No results found</p>
              )}
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
