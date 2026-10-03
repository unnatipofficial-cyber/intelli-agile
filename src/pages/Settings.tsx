import { useQuery, useMutation, useAction } from "convex/react";
import { api } from "../convex/_generated/api";
import { useAuth } from "@/hooks/use-auth";
import { splitFullName, isEphemeralGuest } from "@/convex/helpers";
import { useTheme } from "@/hooks/use-theme";
import type { AppTheme } from "@/hooks/use-theme";
import { motion } from "framer-motion";
import { useState } from "react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
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
  Palette,
  Zap,
  Mail,
  Send,
  UserCog,
  Pencil,
  Check,
  X,
  Loader2,
} from "lucide-react";
import { toast } from "sonner";
import { useNavigate } from "react-router";
import { notifTypeStyles } from "@/lib/badge-colors";

const notifTypeIcons: Record<string, any> = {
  task: CheckCircle2,
  sprint: SettingsIcon,
  risk: AlertTriangle,
  project: FolderKanban,
  team: Users,
};

/* ── Theme card preview ─────────────────────────────────────── */
function ThemeCard({
  id,
  label,
  description,
  active,
  onClick,
  lightBg,
  lightCard,
  lightAccent,
  lightText,
  darkBg,
  darkCard,
  darkAccent,
  darkText,
}: {
  id: AppTheme;
  label: string;
  description: string;
  active: boolean;
  onClick: () => void;
  lightBg: string;
  lightCard: string;
  lightAccent: string;
  lightText: string;
  darkBg: string;
  darkCard: string;
  darkAccent: string;
  darkText: string;
}) {
  const { theme } = useTheme();
  const isDark = theme === "dark";

  return (
    <button
      onClick={onClick}
      className={cn(
        "relative flex flex-col rounded-xl border-2 p-4 text-left transition-all",
        active
          ? "border-primary shadow-md ring-1 ring-primary/20"
          : "border-border hover:border-muted-foreground/30 hover:shadow-sm"
      )}
    >
      {active && (
        <div className="absolute top-3 right-3">
          <div className="w-5 h-5 rounded-full bg-primary flex items-center justify-center">
            <CheckCircle2 className="w-3 h-3 text-primary-foreground" />
          </div>
        </div>
      )}

      {/* Mini preview */}
      <div
        className="w-full h-20 rounded-lg mb-3 flex items-end gap-1.5 p-2"
        style={{ background: isDark ? darkBg : lightBg }}
      >
        <div
          className="w-8 h-12 rounded-md"
          style={{ background: isDark ? darkCard : lightCard }}
        />
        <div className="flex-1 flex flex-col gap-1">
          <div
            className="h-2 rounded-full w-3/4"
            style={{ background: isDark ? darkAccent : lightAccent }}
          />
          <div
            className="h-1.5 rounded-full w-1/2"
            style={{ background: isDark ? darkText : lightText, opacity: 0.4 }}
          />
        </div>
      </div>

      <p className="text-sm font-semibold">{label}</p>
      <p className="text-xs text-muted-foreground mt-0.5">{description}</p>
    </button>
  );
}

export default function SettingsPage() {
  const { user, signOut } = useAuth();
  const { theme, toggleTheme, appTheme, setAppTheme } = useTheme();
  const navigate = useNavigate();
  const notifications = useQuery(api.notifications.list);
  const markRead = useMutation(api.notifications.markRead);
  const markAllRead = useMutation(api.notifications.markAllRead);
  const deleteNotif = useMutation(api.notifications.remove);

  // Profile name editing. The first-login prompt already captured a name, but
  // people change their name (and get it wrong once), so it stays editable.
  const updateProfile = useMutation(api.users.updateProfile);
  const [editingProfile, setEditingProfile] = useState(false);
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [profileError, setProfileError] = useState<string | null>(null);
  const [savingProfile, setSavingProfile] = useState(false);

  // A Guest's row is deleted on sign-out and `updateProfile` refuses guests, so
  // offering the editor would be a button that can only ever fail. Hide it.
  const canEditProfile = !isEphemeralGuest(user);

  const startEditingProfile = () => {
    const { firstName: first, lastName: last } = splitFullName(user?.name);
    setFirstName(first);
    setLastName(last);
    setProfileError(null);
    setEditingProfile(true);
  };

  const saveProfile = async () => {
    if (!firstName.trim()) {
      setProfileError("Please enter your first name.");
      return;
    }
    setProfileError(null);
    setSavingProfile(true);
    try {
      await updateProfile({
        firstName: firstName.trim(),
        lastName: lastName.trim(),
      });
      setEditingProfile(false);
    } catch (err) {
      setProfileError(
        err instanceof Error ? err.message : "Could not save your profile."
      );
    } finally {
      setSavingProfile(false);
    }
  };

  // Admin-only workspace management.
  const isAdmin = user?.role === "admin";
  const members = useQuery(api.team.listMembers);
  const invitations = useQuery(api.invitations.list);
  const setUserRole = useMutation(api.users.setRole);
  const revokeInvite = useMutation(api.invitations.revoke);
  const sendInvite = useAction(api.invitations.send);
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteRole, setInviteRole] = useState<"admin" | "user" | "member">("member");
  const [sending, setSending] = useState(false);

  const handleSendInvite = async () => {
    const email = inviteEmail.trim();
    if (!email) return;
    setSending(true);
    try {
      const result = await sendInvite({ email, role: inviteRole });
      toast.success(
        result.emailed
          ? `Invitation emailed to ${result.email}`
          : `Invitation created for ${result.email}, but the email could not be sent.`
      );
      setInviteEmail("");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not send the invitation");
    } finally {
      setSending(false);
    }
  };

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
        <div className="flex items-center justify-between gap-2 mb-4">
          <div className="flex items-center gap-2">
            <User className="w-4 h-4 text-primary" />
            <h3 className="text-sm font-bold">Profile</h3>
          </div>
          {!editingProfile && canEditProfile && (
            <Button
              variant="ghost"
              size="sm"
              onClick={startEditingProfile}
              className="h-8 text-xs"
            >
              <Pencil className="w-3.5 h-3.5 mr-1.5" />
              Edit name
            </Button>
          )}
        </div>

        {editingProfile ? (
          <div className="space-y-4">
            <div className="flex flex-col gap-3 sm:flex-row">
              <div className="grid gap-2 flex-1">
                <Label htmlFor="profile-first-name">First name</Label>
                <Input
                  id="profile-first-name"
                  value={firstName}
                  onChange={(e) => setFirstName(e.target.value)}
                  placeholder="Ada"
                  autoComplete="given-name"
                  autoFocus
                />
              </div>
              <div className="grid gap-2 flex-1">
                <Label htmlFor="profile-last-name">Last name</Label>
                <Input
                  id="profile-last-name"
                  value={lastName}
                  onChange={(e) => setLastName(e.target.value)}
                  placeholder="Lovelace"
                  autoComplete="family-name"
                />
              </div>
            </div>
            {profileError && (
              <p role="alert" className="text-sm text-destructive">
                {profileError}
              </p>
            )}
            <div className="flex items-center gap-2">
              <Button size="sm" onClick={saveProfile} disabled={savingProfile}>
                {savingProfile ? (
                  <Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" />
                ) : (
                  <Check className="w-3.5 h-3.5 mr-1.5" />
                )}
                Save
              </Button>
              <Button
                size="sm"
                variant="ghost"
                onClick={() => setEditingProfile(false)}
                disabled={savingProfile}
              >
                <X className="w-3.5 h-3.5 mr-1.5" />
                Cancel
              </Button>
            </div>
          </div>
        ) : (
          <div className="flex items-center gap-4">
            <div className="w-14 h-14 rounded-full bg-primary/10 flex items-center justify-center text-lg font-bold text-primary">
              {user?.name?.charAt(0) || user?.email?.charAt(0)?.toUpperCase() || "U"}
            </div>
            <div>
              <div className="flex items-center gap-2">
                <p className="text-sm font-semibold">{user?.name || "User"}</p>
                <Badge variant="secondary" className="text-[10px] px-1.5 py-0 h-5 capitalize">
                  {user?.role || "user"}
                </Badge>
              </div>
              <p className="text-xs text-muted-foreground">{user?.email || ""}</p>
            </div>
          </div>
        )}
      </div>

      {/* ── Theme selector ───────────────────────────────────── */}
      <div className="glass-card p-5">
        <div className="flex items-center gap-2 mb-1">
          <Palette className="w-4 h-4 text-primary" />
          <h3 className="text-sm font-bold">Theme</h3>
        </div>
        <p className="text-xs text-muted-foreground mb-4">Choose a visual theme for the application</p>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-5">
          <ThemeCard
            id="graphite"
            label="Graphite"
            description="Monochromatic cool-gray. Sharp and restrained."
            active={appTheme === "graphite"}
            onClick={() => setAppTheme("graphite")}
            lightBg="#f0f0f0"
            lightCard="#f5f5f5"
            lightAccent="#606060"
            lightText="#333333"
            darkBg="#1a1a1a"
            darkCard="#202020"
            darkAccent="#a0a0a0"
            darkText="#d9d9d9"
          />
          <ThemeCard
            id="modern-minimal"
            label="Modern Minimal"
            description="Stark black & white with a blue accent. Ultra-clean."
            active={appTheme === "modern-minimal"}
            onClick={() => setAppTheme("modern-minimal")}
            lightBg="#ffffff"
            lightCard="#f9fafb"
            lightAccent="#3b82f6"
            lightText="#333333"
            darkBg="#171717"
            darkCard="#262626"
            darkAccent="#3b82f6"
            darkText="#e5e5e5"
          />
          <ThemeCard
            id="darkmatter"
            label="Darkmatter"
            description="Ultra-dark near-black with a warm amber accent. Intensely atmospheric."
            active={appTheme === "darkmatter"}
            onClick={() => setAppTheme("darkmatter")}
            lightBg="#ffffff"
            lightCard="#f3f4f6"
            lightAccent="#d87943"
            lightText="#111827"
            darkBg="#121113"
            darkCard="#222222"
            darkAccent="#e78a53"
            darkText="#c1c1c1"
          />
        </div>

        {/* Dark mode toggle */}
        <div className="flex items-center justify-between pt-4 border-t border-border/50">
          <div className="flex items-center gap-2">
            {theme === "light" ? <Sun className="w-4 h-4 text-muted-foreground" /> : <Moon className="w-4 h-4 text-muted-foreground" />}
            <div>
              <p className="text-sm font-medium">Dark Mode</p>
              <p className="text-xs text-muted-foreground">Toggle between light and dark</p>
            </div>
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
                  <div className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0" style={notifTypeStyles[notif.type]}>
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

      {/* ── Admin-only workspace management ───────────────────── */}
      {isAdmin && (
        <>
          {/* Team & roles */}
          <div className="glass-card p-5">
            <div className="flex items-center gap-2 mb-1">
              <UserCog className="w-4 h-4 text-primary" />
              <h3 className="text-sm font-bold">Team & Roles</h3>
            </div>
            <p className="text-xs text-muted-foreground mb-4">
              Admins manage everything. Users can delete and bulk-edit work. Members can contribute but not destroy.
            </p>
            <div className="space-y-1.5">
              {(members ?? []).map((member) => (
                <div key={member._id} className="flex items-center gap-3 p-2 rounded-lg hover:bg-accent/40">
                  <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center text-xs font-bold text-primary shrink-0">
                    {(member.name || member.email || "U").charAt(0).toUpperCase()}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate">{member.name || "Unnamed"}</p>
                    <p className="text-xs text-muted-foreground truncate">{member.email || ""}</p>
                  </div>
                  <select
                    value={member.role ?? "user"}
                    onChange={(event) =>
                      setUserRole({ userId: member._id, role: event.target.value as "admin" | "user" | "member" })
                    }
                    className="text-xs rounded-md border border-border bg-background px-2 py-1 capitalize"
                    aria-label={`Role for ${member.name || member.email || "member"}`}
                  >
                    <option value="admin">Admin</option>
                    <option value="user">User</option>
                    <option value="member">Member</option>
                  </select>
                </div>
              ))}
              {members && members.length === 0 && (
                <p className="text-sm text-muted-foreground text-center py-4">No team members yet</p>
              )}
            </div>
          </div>

          {/* Invitations */}
          <div className="glass-card p-5">
            <div className="flex items-center gap-2 mb-1">
              <Mail className="w-4 h-4 text-primary" />
              <h3 className="text-sm font-bold">Invitations</h3>
            </div>
            <p className="text-xs text-muted-foreground mb-4">
              Invite someone by email. They sign in with a one-time code — no password.
            </p>
            <div className="flex flex-col sm:flex-row gap-2 mb-4">
              <Input
                value={inviteEmail}
                onChange={(event) => setInviteEmail(event.target.value)}
                placeholder="name@example.com"
                type="email"
                className="flex-1"
                onKeyDown={(event) => {
                  if (event.key === "Enter") handleSendInvite();
                }}
              />
              <select
                value={inviteRole}
                onChange={(event) => setInviteRole(event.target.value as "admin" | "user" | "member")}
                className="text-xs rounded-md border border-border bg-background px-2 py-2 capitalize"
                aria-label="Invitation role"
              >
                <option value="member">Member</option>
                <option value="user">User</option>
                <option value="admin">Admin</option>
              </select>
              <Button
                onClick={handleSendInvite}
                disabled={sending || !inviteEmail.trim()}
                className="gap-2"
              >
                {sending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
                Invite
              </Button>
            </div>

            {(invitations ?? []).length > 0 && (
              <div className="space-y-2">
                {(invitations ?? []).map((invite) => (
                  <div key={invite._id} className="flex items-center gap-3 p-2 rounded-lg border border-border/50">
                    <div className="flex-1 min-w-0">
                      <p className="text-sm truncate">{invite.email}</p>
                      <p className="text-[10px] text-muted-foreground capitalize">
                        {invite.role}
                        {invite.used
                          ? " · accepted"
                          : invite.expired
                            ? " · expired"
                            : ` · expires ${new Date(invite.expiresAt).toLocaleDateString()}`}
                      </p>
                    </div>
                    {!invite.used && (
                      <button
                        onClick={() => revokeInvite({ invitationId: invite._id })}
                        className="p-1 rounded hover:bg-accent/50 text-destructive"
                        title="Revoke invitation"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        </>
      )}

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
