"use client";
import { useState } from "react";
import { Avatar } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import { Input, Label } from "@/components/ui/field";
import { Icon, type IconName } from "@/components/ui/icon";
import { Pill } from "@/components/ui/pill";
import { deactivateUser, deleteUser, reactivateUser, removeMembership, resetPassword, setMembership, setUserAdmin } from "@/actions/admin";
import type { Person, WorkspaceOption } from "@/lib/queries/admin";
import { InlineError, ROLE_LABEL, WsDot } from "./bits";
import { MembershipEditor } from "./membership-editor";
import { useAdminAction } from "./use-action";

function Section({ title, icon, children }: { title: string; icon: IconName; children: React.ReactNode }) {
  return (
    <section className="border-t border-line-2 pt-4">
      <h3 className="m-0 mb-2 flex items-center gap-1.5 text-xs font-medium text-ink-3">
        <Icon name={icon} size={13} />
        {title}
      </h3>
      {children}
    </section>
  );
}

export function PersonDialog({ person, workspaces, selfId, onClose }: { person: Person | null; workspaces: WorkspaceOption[]; selfId: string; onClose: () => void }) {
  return (
    <Dialog open={!!person} onClose={onClose} title={person ? `Manage ${person.name}` : "Manage"}>
      {person && <PersonBody key={person.id} person={person} workspaces={workspaces} selfId={selfId} onClose={onClose} />}
    </Dialog>
  );
}

function PersonBody({ person, workspaces, selfId, onClose }: { person: Person; workspaces: WorkspaceOption[]; selfId: string; onClose: () => void }) {
  const isSelf = person.id === selfId;
  const [pw, setPw] = useState("");
  const [typed, setTyped] = useState("");
  const [confirmDelete, setConfirmDelete] = useState(false);
  const roleAction = useAdminAction();
  const pwAction = useAdminAction();
  const stateAction = useAdminAction();
  const delAction = useAdminAction();
  const [pwDone, setPwDone] = useState(false);
  const deactivated = !!person.deactivatedAt;

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center gap-3">
        <Avatar name={person.name} size={32} muted={deactivated} />
        <span className="min-w-0 flex-1">
          <span className="block truncate font-medium">{person.name}{isSelf && <span className="ml-1.5 text-xs text-ink-3">you</span>}</span>
          <span className="block truncate text-xs text-ink-3">{person.email}</span>
        </span>
        {deactivated ? <Pill tone="draft">Deactivated</Pill> : person.isAdmin ? <Pill tone="accent">Admin</Pill> : <Pill tone="neutral">Member</Pill>}
      </div>

      <Section title="Instance role" icon="shield">
        <div className="flex flex-wrap items-center gap-3">
          <Button size="sm" icon="shield" loading={roleAction.pending} disabled={isSelf || deactivated} onClick={() => roleAction.run(() => setUserAdmin(person.id, !person.isAdmin))}>
            {roleAction.pending ? "Saving…" : person.isAdmin ? "Remove admin role" : "Make instance admin"}
          </Button>
          <span className="text-xs text-ink-3">{isSelf ? "You cannot change your own role." : "Admins see every workspace and this panel."}</span>
        </div>
        <InlineError>{roleAction.error}</InlineError>
      </Section>

      <Section title="Workspaces" icon="folder">
        <MembershipEditor
          rows={person.memberships.map((m) => ({ id: m.workspaceId, label: m.name, sub: ROLE_LABEL[m.role], lead: <WsDot accent={m.accent} />, role: m.role }))}
          options={workspaces.map((w) => ({ id: w.id, label: w.name }))}
          addLabel="Add to workspace"
          emptyText={person.isAdmin ? "Admins see every workspace without being a member." : "Not in any workspace yet, so they see nothing after signing in."}
          onSet={(wsId, role) => setMembership(wsId, person.id, role)}
          onRemove={(wsId) => removeMembership(wsId, person.id)}
        />
      </Section>

      <Section title="Reset password" icon="key">
        <form
          className="flex flex-wrap items-end gap-2"
          onSubmit={(e) => {
            e.preventDefault();
            setPwDone(false);
            pwAction.run(() => resetPassword(person.id, pw), () => { setPw(""); setPwDone(true); });
          }}
        >
          <Label htmlFor="pd-pw" className="min-w-40 flex-1">New password<Input id="pd-pw" type="password" minLength={8} required value={pw} onChange={(e) => setPw(e.target.value)} autoComplete="new-password" /></Label>
          <Button type="submit" size="sm" icon="key" loading={pwAction.pending} disabled={pw.length < 8}>{pwAction.pending ? "Saving…" : "Set password"}</Button>
        </form>
        <p className="mb-0 mt-1.5 text-xs text-ink-3">{pwDone ? <span className="text-done">Password changed. They have been signed out everywhere.</span> : "Signs them out everywhere. Tell them the new password yourself."}</p>
        <InlineError>{pwAction.error}</InlineError>
      </Section>

      <Section title={deactivated ? "Reactivate" : "Deactivate"} icon={deactivated ? "undo" : "archive"}>
        <div className="flex flex-wrap items-center gap-3">
          <Button size="sm" icon={deactivated ? "undo" : "archive"} loading={stateAction.pending} disabled={isSelf} onClick={() => stateAction.run(() => (deactivated ? reactivateUser(person.id) : deactivateUser(person.id)))}>
            {stateAction.pending ? "Saving…" : deactivated ? "Reactivate account" : "Deactivate account"}
          </Button>
          <span className="text-xs text-ink-3">{deactivated ? "They will be able to sign in again." : "Keeps their history. They cannot sign in until reactivated."}</span>
        </div>
        <InlineError>{stateAction.error}</InlineError>
      </Section>

      <Section title="Delete" icon="trash">
        {confirmDelete ? (
          <form
            className="flex flex-col gap-2"
            onSubmit={(e) => {
              e.preventDefault();
              delAction.run(() => deleteUser(person.id), onClose);
            }}
          >
            <p className="m-0 text-sm text-ink-2">Type <b>{person.name}</b> to confirm. Their tasks and comments stay, without an author.</p>
            <Input id="pd-del" value={typed} onChange={(e) => setTyped(e.target.value)} autoComplete="off" />
            <div className="flex justify-end gap-2">
              <Button size="sm" type="button" onClick={() => setConfirmDelete(false)}>Keep them</Button>
              <Button size="sm" type="submit" variant="danger" icon="trash" loading={delAction.pending} disabled={typed !== person.name}>{delAction.pending ? "Deleting…" : "Delete for good"}</Button>
            </div>
            <InlineError>{delAction.error}</InlineError>
          </form>
        ) : (
          <div className="flex flex-wrap items-center gap-3">
            <Button size="sm" variant="danger" icon="trash" disabled={isSelf} onClick={() => setConfirmDelete(true)}>Delete person</Button>
            <span className="text-xs text-ink-3">{isSelf ? "You cannot delete yourself." : "Prefer deactivating unless they should vanish entirely."}</span>
          </div>
        )}
      </Section>

      <div className="flex justify-end border-t border-line-2 pt-4">
        <Button onClick={onClose}>Done</Button>
      </div>
    </div>
  );
}
