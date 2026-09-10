import { useState, type ReactNode } from "react";
import { useLocation, useNavigate } from "react-router";
import { useAuth } from "@/hooks/use-auth";
import { useTheme } from "@/hooks/use-theme";
import { cn } from "@/lib/utils";
import { FloatingDock, dockNavItems } from "@/components/FloatingDock";
import { AIELogo } from "@/components/AIELogo";
import { ErrorBoundary } from "@/components/ErrorBoundary";
import AIChat from "@/components/AIChat";
import CommandPalette from "@/components/CommandPalette";
import {
  Moon,
  Sun,
  Bell,
  Search,
  LogOut,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useQuery } from "convex/react";
import { api } from "../../convex/_generated/api";

function TopBar() {
  const { user, signOut } = useAuth();
  const { theme, toggleTheme } = useTheme();
  const navigate = useNavigate();
  const unreadCount = useQuery(api.notifications.unreadCount);

  return (
    <header className="glass-topbar sticky top-0 z-20 flex items-center gap-4 h-16 px-4 lg:px-6">
      {/* Logo — always visible */}
      <button
        onClick={() => navigate("/dashboard")}
        className="flex items-center gap-2.5 shrink-0 group"
      >
        <AIELogo size="sm" className="transition-transform group-hover:scale-105" />
        <span className="text-base font-bold tracking-tight text-foreground hidden sm:block">
          AIE
        </span>
      </button>

      {/* Search */}
      <div className="hidden sm:flex flex-1 max-w-md">
        <div className="relative w-full">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            placeholder="Search projects, tasks, risks..."
            className="pl-9 glass-card border-0 h-9 bg-transparent focus-visible:ring-primary/30"
          />
        </div>
      </div>

      <div className="flex items-center gap-2 ml-auto">
        {/* Theme toggle */}
        <Button
          variant="ghost"
          size="icon"
          onClick={toggleTheme}
          className="w-9 h-9 rounded-xl hover:bg-accent/50"
        >
          {theme === "light" ? <Moon className="w-[18px] h-[18px]" /> : <Sun className="w-[18px] h-[18px]" />}
        </Button>

        {/* Notifications */}
        <Button
          variant="ghost"
          size="icon"
          className="w-9 h-9 rounded-xl hover:bg-accent/50 relative"
          onClick={() => navigate("/dashboard/settings")}
        >
          <Bell className="w-[18px] h-[18px]" />
          {unreadCount && unreadCount > 0 && (
            <span className="absolute top-1.5 right-1.5 w-2 h-2 rounded-full bg-destructive" />
          )}
        </Button>

        {/* User menu */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button className="flex items-center gap-2 p-1 rounded-xl hover:bg-accent/50 transition-colors">
              <Avatar className="w-8 h-8">
                <AvatarFallback className="bg-primary/10 text-primary text-xs font-semibold">
                  {user?.name?.charAt(0) || user?.email?.charAt(0)?.toUpperCase() || "U"}
                </AvatarFallback>
              </Avatar>
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-56 glass-card">
            <div className="px-3 py-2">
              <p className="text-sm font-medium">{user?.name || "User"}</p>
              <p className="text-xs text-muted-foreground">{user?.email || ""}</p>
            </div>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={() => navigate("/dashboard/settings")}>
              <span className="mr-2 text-muted-foreground">⚙</span> Settings
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={() => { signOut(); navigate("/"); }} className="text-destructive">
              <LogOut className="w-4 h-4 mr-2" /> Sign Out
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </header>
  );
}

export default function AppLayout({ children }: { children: ReactNode }) {
  const location = useLocation();
  const navigate = useNavigate();

  return (
    <div className="min-h-screen">
      {/* Top bar */}
      <TopBar />

      {/* Page content */}
      <main className="p-4 lg:p-6 pb-24 md:pb-8">
        {children}
      </main>

      {/* Command Palette (Ctrl+K) */}
      <CommandPalette />

      {/* AI Chat assistant */}
      <ErrorBoundary>
        <AIChat />
      </ErrorBoundary>

      {/* Floating dock — anchored to bottom */}
      <div className="fixed bottom-0 left-0 right-0 z-30 flex justify-center pointer-events-none">
        <div className="pointer-events-auto pb-4 md:pb-6">
          <FloatingDock
            items={dockNavItems}
            activePath={location.pathname}
            onNavigate={(path) => navigate(path)}
          />
        </div>
      </div>
    </div>
  );
}
