"use client";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input, Label, Select } from "@/components/ui/field";
import { Icon } from "@/components/ui/icon";
import { createInvite, createUser, setMembership } from "@/actions/admin";
import type { WorkspaceRole } from "@/db/schema";
import type { WorkspaceOption } from "@/lib/queries/admin";
import { CopyButton } from "./copy-button";
import { Hint, InlineError } from "./bits";
import { useAdminAction } from "./use-action";

const ROLES: WorkspaceRole[] = ["viewer", "editor", "manager"];

/**
 * "Add a person": creates an invite link, or (expander) an account with a password.
 * `idPrefix` keeps ids unique when the form is mounted twice on one page.
 */
export function InviteForm({ workspaces, idPrefix = "inv", onDone }: { workspaces: WorkspaceOption[]; idPrefix?: string; onDone?: () => void }) {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [workspaceId, setWorkspaceId] = useState("");
  const [role, setRole] = useState<WorkspaceRole>("editor");
  const [isAdmin, setIsAdmin] = useState(false);
  const [password, setPassword] = useState("");
  const [link, setLink] = useState<{ url: string; emailed: boolean; to: string } | null>(null);
  const [created, setCreated] = useState<string | null>(null);
  const invite = useAdminAction();
  const account = useAdminAction();
  const id = (s: string) => `${idPrefix}-${s}`;
  const busy = invite.pending || account.pending;

  function reset() {
    setName("");
    setEmail("");
    setPassword("");
    setIsAdmin(false);
  }

  return (
    <div className="flex flex-col gap-3">
      <form
        className="flex flex-col gap-2.5"
        onSubmit={(e) => {
          e.preventDefault();
          setCreated(null);
          invite.run(
            () => createInvite({ name, email, workspaceId: workspaceId || undefined, workspaceRole: role, isAdmin }),
            (d) => setLink({ url: d.url, emailed: d.emailed, to: email.trim() }),
          );
        }}
      >
        <Label htmlFor={id("name")}>Name<Input id={id("name")} value={name} onChange={(e) => setName(e.target.value)} placeholder="Full name" autoComplete="off" /></Label>
        <Label htmlFor={id("email")}>Email<Input id={id("email")} type="email" required value={email} onChange={(e) => setEmail(e.target.value)} placeholder="name@company.co.uk" autoComplete="off" /></Label>
        <Label htmlFor={id("workspace")}>Workspace
          <Select id={id("workspace")} value={workspaceId} onChange={(e) => setWorkspaceId(e.target.value)}>
            <option value="">No workspace</option>
            {workspaces.map((w) => <option key={w.id} value={w.id}>{w.name}</option>)}
          </Select>
        </Label>
        <Label htmlFor={id("role")}>Role
          <Select id={id("role")} value={role} disabled={!workspaceId} onChange={(e) => setRole(e.target.value as WorkspaceRole)}>
            {ROLES.map((r) => <option key={r} value={r}>{r[0]!.toUpperCase() + r.slice(1)}</option>)}
          </Select>
        </Label>
        <label className="flex items-center gap-2 text-[13px] text-ink" htmlFor={id("admin")}>
          <input id={id("admin")} type="checkbox" checked={isAdmin} onChange={(e) => setIsAdmin(e.target.checked)} className="accent-accent" />
          Make instance admin
        </label>
        <Button type="submit" variant="primary" icon="mail" className="mt-1" loading={invite.pending} disabled={busy}>{invite.pending ? "Creating…" : "Create invite link"}</Button>
        <InlineError>{invite.error}</InlineError>
        {link ? (
          <div className="flex flex-col gap-2">
            {link.emailed && <p role="status" className="m-0 flex items-center gap-1.5 text-sm text-done"><Icon name="check-circle" size={14} />Invite emailed to {link.to}</p>}
            <div className="flex gap-2">
              <input id={id("link")} readOnly value={link.url} onFocus={(e) => e.currentTarget.select()} aria-label="Invite link" className="min-w-0 flex-1 rounded-r border border-line bg-surface px-2.5 py-1.5 text-sm text-ink-2 focus:ring-2 focus:ring-accent focus:outline-none" />
              <CopyButton value={link.url} />
            </div>
            <Hint small>{link.emailed ? "You can also paste this link to them directly." : "No email was sent (SMTP is not set up). Paste this link to them."}</Hint>
            {onDone && <Button size="sm" onClick={onDone}>Done</Button>}
          </div>
        ) : (
          <Hint small>The invite is emailed when SMTP is set up. Either way you get a link to paste to them.</Hint>
        )}
      </form>

      <details className="group border-t border-line-2 pt-3">
        <summary className="flex cursor-pointer list-none items-center gap-1.5 text-sm text-ink-2 transition-colors duration-150 hover:text-ink">
          <Icon name="chevron-right" size={14} className="transition-transform duration-150 ease-out group-open:rotate-90" />
          Or set a password now
        </summary>
        <form
          className="mt-2.5 flex flex-col gap-2.5"
          onSubmit={(e) => {
            e.preventDefault();
            setLink(null);
            setCreated(null);
            account.run(
              async () => {
                const r = await createUser({ name, email, password, isAdmin });
                if (!r.ok || !workspaceId) return r;
                const m = await setMembership(workspaceId, r.data.userId, role);
                return m.ok ? r : m;
              },
              () => {
                setCreated(`Account created for ${name || email}. They can sign in with that password now.`);
                reset();
              },
            );
          }}
        >
          <Hint small>Uses the name, email, workspace and role above. Tell them the password yourself.</Hint>
          <Label htmlFor={id("password")}>Password<Input id={id("password")} type="password" required minLength={8} value={password} onChange={(e) => setPassword(e.target.value)} autoComplete="new-password" /></Label>
          <Button type="submit" icon="key" loading={account.pending} disabled={busy}>{account.pending ? "Creating…" : "Create account"}</Button>
          <InlineError>{account.error}</InlineError>
          {created && <p role="status" className="m-0 flex items-start gap-1.5 text-sm text-done"><Icon name="check-circle" size={14} className="mt-0.5" />{created}</p>}
        </form>
      </details>
    </div>
  );
}
