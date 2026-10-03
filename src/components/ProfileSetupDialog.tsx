import { useEffect, useState } from "react";
import { useMutation } from "convex/react";
import { Loader2, UserRound } from "lucide-react";
import { api } from "@/convex/_generated/api";
import { splitFullName } from "@/convex/helpers";
import { useAuth } from "@/hooks/use-auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

/**
 * First-login profile prompt.
 *
 * Shown once, after a real account signs in, to capture a first and last name
 * that the workspace can actually show (instead of an email initial or
 * "Unknown"). Google and OTP sign-ins often already carry a name, so those
 * fields come pre-filled and confirming is a single click.
 *
 * Deliberately not dismissable: this is the only moment we ask, so letting it
 * be swiped away would mean never asking again. `RequireAuth` mounts it and the
 * server's `profileCompletedAt` flag decides whether it renders at all.
 */
export function ProfileSetupDialog() {
  const { user } = useAuth();
  const updateProfile = useMutation(api.users.updateProfile);

  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  // Seed from whatever the identity provider already gave us. Re-running when
  // `user?.name` changes keeps the pre-fill correct if the account doc lands
  // after the dialog mounts.
  useEffect(() => {
    const { firstName: first, lastName: last } = splitFullName(user?.name);
    setFirstName(first);
    setLastName(last);
  }, [user?.name]);

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!firstName.trim()) {
      setError("Please enter your first name.");
      return;
    }
    setError(null);
    setSaving(true);
    try {
      await updateProfile({ firstName: firstName.trim(), lastName: lastName.trim() });
      // No local close: the dialog unmounts on its own once the reactive
      // `user` doc reports profileCompletedAt, which avoids a flash of the
      // dialog lingering after save.
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not save your profile.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open>
      <DialogContent
        showCloseButton={false}
        onEscapeKeyDown={(e) => e.preventDefault()}
        onPointerDownOutside={(e) => e.preventDefault()}
        onInteractOutside={(e) => e.preventDefault()}
        className="sm:max-w-md"
      >
        <form onSubmit={submit}>
          <DialogHeader>
            <div className="mb-2 flex size-11 items-center justify-center rounded-full bg-primary/10">
              <UserRound className="size-5 text-primary" />
            </div>
            <DialogTitle>Tell us your name</DialogTitle>
            <DialogDescription>
              This is how teammates will see you across the workspace. You can
              change it any time in Settings.
            </DialogDescription>
          </DialogHeader>

          <div className="grid gap-4 py-5">
            <div className="grid gap-2">
              <Label htmlFor="setup-first-name">First name</Label>
              <Input
                id="setup-first-name"
                value={firstName}
                onChange={(e) => setFirstName(e.target.value)}
                placeholder="Ada"
                autoComplete="given-name"
                autoFocus
                required
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="setup-last-name">
                Last name{" "}
                <span className="text-xs font-normal text-muted-foreground">
                  (optional)
                </span>
              </Label>
              <Input
                id="setup-last-name"
                value={lastName}
                onChange={(e) => setLastName(e.target.value)}
                placeholder="Lovelace"
                autoComplete="family-name"
              />
            </div>
            {error && (
              <p role="alert" className="text-sm text-destructive">
                {error}
              </p>
            )}
          </div>

          <DialogFooter>
            <Button type="submit" disabled={saving} className="w-full sm:w-auto">
              {saving && <Loader2 className="mr-2 size-4 animate-spin" />}
              Save and continue
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}