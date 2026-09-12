"use client";
import { useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { Input, Label } from "@/components/ui/field";
import { Icon } from "@/components/ui/icon";
import { Section } from "@/components/ui/page";
import { changePassword, updateProfile, type AccountResult } from "@/actions/account";

type Notice = { tone: "ok" | "error"; text: string } | null;

const Name = ({ children }: { children: React.ReactNode }) => <span className="font-medium text-ink-2">{children}</span>;
const Hint = ({ children }: { children: React.ReactNode }) => <span className="text-xs text-ink-3">{children}</span>;

function Message({ notice }: { notice: Notice }) {
  if (!notice) return null;
  const bad = notice.tone === "error";
  return (
    <p
      role={bad ? "alert" : "status"}
      className={`m-0 flex items-center gap-2 rounded-r px-3 py-2 text-[13px] ${bad ? "bg-late-soft text-late" : "bg-done-soft text-done"}`}
    >
      <Icon name={bad ? "alert" : "check-circle"} size={15} />
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
      <Section title="Profile">
        <form onSubmit={onProfile} className="flex flex-col gap-4">
          <Label htmlFor="account-name">
            <Name>Display name</Name>
            <Input id="account-name" name="name" defaultValue={name} autoComplete="name" required maxLength={80} />
            <Hint>How you appear on tasks, comments and activity.</Hint>
          </Label>
          <Label htmlFor="account-email">
            <Name>Email</Name>
            <Input id="account-email" value={email} readOnly className="bg-surface-2 text-ink-2" />
            <Hint>Your sign-in address. An admin can change it for you.</Hint>
          </Label>
          <div className="flex flex-col gap-1 text-xs">
            <Name>Role</Name>
            <span className="inline-flex items-center gap-1.5 text-sm text-ink">
              <Icon name={role === "Admin" ? "shield" : "user"} size={14} className="text-ink-3" />
              {role}
            </span>
            <Hint>{role === "Admin" ? "You can manage every workspace on this instance." : "You see the workspaces you were added to."}</Hint>
          </div>
          <Message notice={profileNotice} />
          <div>
            <Button variant="primary" type="submit" icon="check" loading={profilePending}>
              {profilePending ? "Saving…" : "Save name"}
            </Button>
          </div>
        </form>
      </Section>

      <Section title="Password" className="border-t border-line pt-6">
        <form onSubmit={onPassword} className="flex flex-col gap-4">
          <p className="m-0 -mt-1 text-[13px] text-ink-2">Changing your password signs you out on every other device.</p>
          <input type="text" name="username" value={email} autoComplete="username" readOnly hidden aria-hidden="true" />
          <Label htmlFor="account-current">
            <Name>Current password</Name>
            <Input id="account-current" name="current" type="password" autoComplete="current-password" required />
          </Label>
          <Label htmlFor="account-next">
            <Name>New password</Name>
            <Input id="account-next" name="next" type="password" autoComplete="new-password" required minLength={8} />
            <Hint>At least 8 characters.</Hint>
          </Label>
          <Label htmlFor="account-confirm">
            <Name>Confirm new password</Name>
            <Input id="account-confirm" name="confirm" type="password" autoComplete="new-password" required minLength={8} />
          </Label>
          <Message notice={passwordNotice} />
          <div>
            <Button variant="primary" type="submit" icon="key" loading={passwordPending}>
              {passwordPending ? "Changing…" : "Change password"}
            </Button>
          </div>
        </form>
      </Section>
    </div>
  );
}
