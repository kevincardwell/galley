"use client";
import { useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { Input, Label } from "@/components/ui/field";
import { changePassword, updateProfile, type AccountResult } from "@/actions/account";

type Notice = { tone: "ok" | "error"; text: string } | null;

function Message({ notice }: { notice: Notice }) {
  if (!notice) return null;
  return (
    <p role={notice.tone === "error" ? "alert" : "status"} className={`m-0 rounded-r px-3 py-2 text-sm ${notice.tone === "error" ? "bg-late-soft text-late" : "bg-done-soft text-done"}`}>
      {notice.text}
    </p>
  );
}

export function AccountForm({ name, email, role }: { name: string; email: string; role: string }) {
  const [profileNotice, setProfileNotice] = useState<Notice>(null);
  const [passwordNotice, setPasswordNotice] = useState<Notice>(null);
  const [profilePending, startProfile] = useTransition();
  const [passwordPending, startPassword] = useTransition();

  function onProfile(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = new FormData(e.currentTarget);
    const next = String(form.get("name") || "");
    setProfileNotice(null);
    startProfile(async () => {
      const r: AccountResult = await updateProfile(next);
      setProfileNotice(r.ok ? { tone: "ok", text: "Name saved." } : { tone: "error", text: r.error });
    });
  }

  function onPassword(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const el = e.currentTarget;
    const form = new FormData(el);
    const current = String(form.get("current") || "");
    const next = String(form.get("next") || "");
    const confirm = String(form.get("confirm") || "");
    setPasswordNotice(null);
    if (next.length < 8) return setPasswordNotice({ tone: "error", text: "Use at least 8 characters." });
    if (next !== confirm) return setPasswordNotice({ tone: "error", text: "The new passwords do not match." });
    startPassword(async () => {
      const r: AccountResult = await changePassword(current, next);
      if (r.ok) {
        el.reset();
        setPasswordNotice({ tone: "ok", text: "Password changed. Other devices have been signed out." });
      } else {
        setPasswordNotice({ tone: "error", text: r.error });
      }
    });
  }

  return (
    <div className="flex flex-col gap-8">
      <form onSubmit={onProfile} className="flex flex-col gap-3">
        <h2 className="m-0 text-base font-semibold">Profile</h2>
        <Label htmlFor="account-name">
          Display name
          <Input id="account-name" name="name" defaultValue={name} autoComplete="name" required maxLength={80} />
        </Label>
        <Label htmlFor="account-email">
          Email
          <Input id="account-email" value={email} readOnly className="text-ink-2" />
        </Label>
        <div className="flex flex-col gap-1 text-xs text-ink-2">
          Role
          <span className="text-sm text-ink">{role}</span>
        </div>
        <Message notice={profileNotice} />
        <div>
          <Button variant="primary" type="submit" disabled={profilePending}>{profilePending ? "Saving…" : "Save name"}</Button>
        </div>
      </form>

      <form onSubmit={onPassword} className="flex flex-col gap-3 border-t border-line pt-6">
        <h2 className="m-0 text-base font-semibold">Password</h2>
        <p className="m-0 -mt-1 text-ink-2">Changing your password signs you out on every other device.</p>
        <input type="text" name="username" value={email} autoComplete="username" readOnly hidden aria-hidden="true" />
        <Label htmlFor="account-current">
          Current password
          <Input id="account-current" name="current" type="password" autoComplete="current-password" required />
        </Label>
        <Label htmlFor="account-next">
          New password
          <Input id="account-next" name="next" type="password" autoComplete="new-password" required minLength={8} />
        </Label>
        <Label htmlFor="account-confirm">
          Confirm new password
          <Input id="account-confirm" name="confirm" type="password" autoComplete="new-password" required minLength={8} />
        </Label>
        <Message notice={passwordNotice} />
        <div>
          <Button variant="primary" type="submit" disabled={passwordPending}>{passwordPending ? "Changing…" : "Change password"}</Button>
        </div>
      </form>
    </div>
  );
}
