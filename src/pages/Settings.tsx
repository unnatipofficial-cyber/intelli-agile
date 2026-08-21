import { useState } from "react";
import { useQuery, useMutation } from "convex/react";
import { api } from "../convex/_generated/api";
import { useAuth } from "@/hooks/use-auth";
import { useTheme } from "@/hooks/use-theme";
import { motion } from "framer-motion";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import {
  Settings as SettingsIcon,
  Bell,
  Moon,
  Sun,
  User,
  LogOut,
  CheckCheck,
  Trash2,
  CheckCircle2,
  AlertTriangle,
  Shield,
  FolderKanban,
  Users,
} from "lucide-react";
import { toast } from "sonner";
import { useNavigate } from "react-router";

const notifTypeIcons: Record<string, any> = {
  task: CheckCircle2,
  sprint: SettingsIcon,
  risk: AlertTriangle,
  project: FolderKanban,
  team: Users,
};

const notifTypeColors: Record<string, string> = {
  task: "bg-blue-100 text-blue-600 dark:bg-blue-900/30 dark:text-blue-400",
  sprint: "bg-emerald-100 text-emerald-600 dark:bg-emerald-900/30 dark:text-emerald-400",
  risk: "bg-red-100 text-red-600 dark:bg-red-900/30 dark:text-red-400",
  project: "bg-purple-100 text-purple-600 dark:bg-purple-900/30 dark:text-purple-400",
  team: "bg-amber-100 text-amber-600 dark:bg-amber-900/30 dark:text-amber-400",
};

export default function SettingsPage() {
  const { user, signOut } = useAuth();
  const { theme, toggleTheme } = useTheme();
  const navigate = useNavigate();
  const notifications = useQuery(api.notifications.list);
  const markRead = useMutation(api.notifications.markRead);
  const markAllRead = useMutation(api.notifications.markAllRead);
  const deleteNotif = useMutation(api.notifications.remove);

  const unreadNotifications = notifications?.filter((n) => !n.isRead) || [];
  const readNotifications = notifications?.filter((n) => n.isRead) || [];

  return (
    <div className="space-y-6 animate-fade-in-up max-w-4xl">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Settings</h1>
        <p className="text-sm text-muted-foreground">Manage notifications, appearance, and account settings</p>
      </div>

      {/* Profile */}
      <div className="glass-card p-5">
        <div className="flex items-center gap-2 mb-4">
          <User className="w-4 h-4 text-primary" />
          <h3 className="text-sm font-bold">Profile</h3>
        </div>
        <div className="flex items-center gap-4">
          <div className="w-14 h-14 rounded-full bg-primary/10 flex items-center justify-center text-lg font-bold text-primary">
            {user?.name?.charAt(0) || user?.email?.charAt(0)?.toUpperCase() || "U"}
          </div>
          <div>
            <p className="text-sm font-semibold">{user?.name || "User"}</p>
            <p className="text-xs text-muted-foreground">{user?.email || ""}</p>
          </div>
        </div>
      </div>

      {/* Appearance */}
      <div className="glass-card p-5">
        <div className="flex items-center gap-2 mb-4">
          {theme === "light" ? <Sun className="w-4 h-4 text-primary" /> : <Moon className="w-4 h-4 text-primary" />}
          <h3 className="text-sm font-bold">Appearance</h3>
        </div>
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm">Dark Mode</p>
            <p className="text-xs text-muted-foreground">Toggle between light and dark themes</p>
          </div>
          <button
            onClick={toggleTheme}
            className={cn(
              "relative w-12 h-6 rounded-full transition-colors",
              theme === "dark" ? "bg-primary" : "bg-muted"
            )}
          >
            <div
              className={cn(
                "absolute top-0.5 w-5 h-5 rounded-full bg-white shadow-sm transition-transform",
                theme === "dark" ? "translate-x-6" : "translate-x-0.5"
              )}
            />
          </button>
        </div>
      </div>

      {/* Notifications */}
      <div className="glass-card p-5">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <Bell className="w-4 h-4 text-primary" />
            <h3 className="text-sm font-bold">Notifications</h3>
            {unreadNotifications.length > 0 && (
              <Badge className="text-[10px] px-1.5 py-0 h-5">{unreadNotifications.length} unread</Badge>
            )}
          </div>
          {unreadNotifications.length > 0 && (
            <Button
              variant="ghost"
              size="sm"
              onClick={async () => { await markAllRead(); toast.success("All marked as read"); }}
              className="text-xs gap-1"
            >
              <CheckCheck className="w-3.5 h-3.5" /> Mark all read
            </Button>
          )}
        </div>

        {/* Unread */}
        {unreadNotifications.length > 0 && (
          <div className="space-y-2 mb-4">
            {unreadNotifications.map((notif) => {
              const Icon = notifTypeIcons[notif.type] || Bell;
              return (
                <motion.div
                  key={notif._id}
                  initial={{ opacity: 0, y: 4 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="flex items-start gap-3 p-3 rounded-xl bg-primary/5 border border-primary/10"
                >
                  <div className={cn("w-8 h-8 rounded-lg flex items-center justify-center shrink-0", notifTypeColors[notif.type])}>
                    <Icon className="w-4 h-4" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium">{notif.title}</p>
                    <p className="text-xs text-muted-foreground mt-0.5">{notif.message}</p>
                    <p className="text-[10px] text-muted-foreground mt-1">
                      {new Date(notif.createdAt).toLocaleDateString()}
                    </p>
                  </div>
                  <div className="flex gap-1 shrink-0">
                    <button
                      onClick={() => markRead({ notificationId: notif._id })}
                      className="p-1 rounded hover:bg-accent/50 text-muted-foreground"
                      title="Mark as read"
                    >
                      <CheckCircle2 className="w-3.5 h-3.5" />
                    </button>
                    <button
                      onClick={() => deleteNotif({ notificationId: notif._id })}
                      className="p-1 rounded hover:bg-accent/50 text-destructive"
                      title="Delete"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </motion.div>
              );
            })}
          </div>
        )}

        {/* Read */}
        {readNotifications.length > 0 && (
          <div className="space-y-1">
            <p className="text-xs font-medium text-muted-foreground mb-2">Read</p>
            {readNotifications.slice(0, 10).map((notif) => {
              const Icon = notifTypeIcons[notif.type] || Bell;
              return (
                <div key={notif._id} className="flex items-center gap-3 p-2 rounded-lg opacity-60">
                  <Icon className="w-3.5 h-3.5 text-muted-foreground" />
                  <span className="text-xs flex-1 truncate">{notif.title}</span>
                  <button
                    onClick={() => deleteNotif({ notificationId: notif._id })}
                    className="p-1 rounded hover:bg-accent/50 text-muted-foreground"
                  >
                    <Trash2 className="w-3 h-3" />
                  </button>
                </div>
              );
            })}
          </div>
        )}

        {!notifications?.length && (
          <p className="text-sm text-muted-foreground text-center py-6">No notifications yet</p>
        )}
      </div>

      {/* Account */}
      <div className="glass-card p-5">
        <div className="flex items-center gap-2 mb-4">
          <Shield className="w-4 h-4 text-primary" />
          <h3 className="text-sm font-bold">Account</h3>
        </div>
        <Button
          variant="outline"
          className="gap-2 text-destructive border-destructive/30 hover:bg-destructive/5"
          onClick={async () => { await signOut(); navigate("/"); }}
        >
          <LogOut className="w-4 h-4" /> Sign Out
        </Button>
      </div>
    </div>
  );
}
