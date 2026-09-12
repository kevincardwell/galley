"use client";
import Link from "next/link";
import { useState } from "react";
import { Avatar } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import { Input } from "@/components/ui/field";
import { Icon, IconButton } from "@/components/ui/icon";
import { Pill } from "@/components/ui/pill";
import { Tooltip } from "@/components/ui/tooltip";
import { archiveWorkspace, deleteWorkspace, removeMembership, setMembership } from "@/actions/admin";
import type { AdminWorkspace, PersonOption } from "@/lib/queries/admin";
import { formatBytes, timeAgo } from "@/lib/format";
import { InlineError, RowActions, STATUS_LABEL, Table, Td, Th, Tr, WsDot } from "./bits";
import { MembershipEditor } from "./membership-editor";
import { useAdminAction } from "./use-action";

function StatusPill({ status }: { status: AdminWorkspace["status"] }) {
  const tone = status === "archived" ? "draft" : status === "live" ? "done" : status === "review" ? "review" : "accent";
  return <Pill tone={tone}>{STATUS_LABEL[status]}</Pill>;
}

export function WorkspacesTable({ workspaces, people, selfId }: { workspaces: AdminWorkspace[]; people: PersonOption[]; selfId: string }) {
  const [openId, setOpenId] = useState<string | null>(null);
  const selected = workspaces.find((w) => w.id === openId) ?? null;
  return (
    <>
      <Table>
        <thead>
          <tr><Th>Workspace</Th><Th>Client</Th><Th>Status</Th><Th>Members</Th><Th num>Open tasks</Th><Th num>Storage</Th><Th>Created</Th><Th num><span className="sr-only">Actions</span></Th></tr>
        </thead>
        <tbody>
          {workspaces.map((w) => (
            <Tr key={w.id} muted={!!w.archivedAt}>
              <Td>
                <Link href={`/w/${w.slug}`} className="flex cursor-pointer items-center gap-2 font-medium hover:underline" style={{ ["--accent" as string]: w.accent }}>
                  <WsDot accent={w.accent} />{w.name}
                </Link>
              </Td>
              <Td className="text-ink-2">{w.clientName ?? <span className="text-ink-3">—</span>}</Td>
              <Td><span style={{ ["--accent" as string]: w.accent }}><StatusPill status={w.status} /></span></Td>
              <Td>
                <span className="flex items-center gap-2" style={{ ["--accent" as string]: w.accent }}>
                  <span className="flex">
                    {w.members.slice(0, 4).map((m, i) => (
                      <Avatar key={m.userId} name={m.name} size={22} className={i > 0 ? "-ml-1.5 ring-2 ring-surface" : "ring-2 ring-surface"} />
                    ))}
                  </span>
                  <span className="tnum text-ink-2">{w.members.length}</span>
                </span>
              </Td>
              <Td num>{w.openTasks}</Td>
              <Td num className="text-ink-2">{formatBytes(w.bytes)}</Td>
              <Td className="whitespace-nowrap text-ink-2">{timeAgo(w.createdAt)}</Td>
              <Td num>
                <RowActions>
                  <Tooltip label={`Manage ${w.name}`}>
                    <IconButton name="sliders" label={`Manage ${w.name}`} title="" onClick={() => setOpenId(w.id)} />
                  </Tooltip>
                </RowActions>
              </Td>
            </Tr>
          ))}
        </tbody>
      </Table>
      <Dialog open={!!selected} onClose={() => setOpenId(null)} title={selected ? `Manage ${selected.name}` : "Manage"}>
        {selected && <WorkspaceBody key={selected.id} ws={selected} people={people} selfId={selfId} onClose={() => setOpenId(null)} />}
      </Dialog>
    </>
  );
}

function WorkspaceBody({ ws, people, selfId, onClose }: { ws: AdminWorkspace; people: PersonOption[]; selfId: string; onClose: () => void }) {
  const [typed, setTyped] = useState("");
  const [confirmDelete, setConfirmDelete] = useState(false);
  const archive = useAdminAction();
  const del = useAdminAction();
  const archived = !!ws.archivedAt;
  return (
    <div className="flex flex-col gap-4" style={{ ["--accent" as string]: ws.accent }}>
      <div className="flex items-center gap-3">
        <span className="grid size-8 place-items-center rounded-lg bg-accent font-serif font-semibold text-accent-ink">{ws.name[0]}</span>
        <span className="min-w-0 flex-1">
          <span className="block truncate font-medium">{ws.name}</span>
          <span className="block truncate text-xs text-ink-3">/w/{ws.slug}{ws.clientName ? ` · ${ws.clientName}` : ""}</span>
        </span>
        <StatusPill status={ws.status} />
      </div>

      <section className="border-t border-line-2 pt-4">
        <h3 className="m-0 mb-2 flex items-center gap-1.5 text-xs font-medium text-ink-3"><Icon name="users" size={13} />Members</h3>
        <MembershipEditor
          rows={ws.members.map((m) => ({ id: m.userId, label: m.name, sub: m.email, lead: <Avatar name={m.name} muted={m.userId !== selfId} />, role: m.role }))}
          options={people.map((p) => ({ id: p.id, label: `${p.name} (${p.email})` }))}
          addLabel="Add person"
          emptyText="Nobody is in this workspace yet. Admins can still open it."
          onSet={(userId, role) => setMembership(ws.id, userId, role)}
          onRemove={(userId) => removeMembership(ws.id, userId)}
        />
      </section>

      <section className="border-t border-line-2 pt-4">
        <h3 className="m-0 mb-2 flex items-center gap-1.5 text-xs font-medium text-ink-3"><Icon name="archive" size={13} />Archive or delete</h3>
        <div className="flex flex-wrap gap-2">
          <Button size="sm" icon={archived ? "undo" : "archive"} loading={archive.pending} onClick={() => archive.run(() => archiveWorkspace(ws.id, !archived))}>
            {archive.pending ? "Saving…" : archived ? "Restore workspace" : "Archive workspace"}
          </Button>
          {!confirmDelete && <Button size="sm" variant="danger" icon="trash" onClick={() => setConfirmDelete(true)}>Delete workspace</Button>}
        </div>
        <p className="mb-0 mt-2 text-xs text-ink-3">Archiving hides it from the list and keeps everything. Deleting removes tasks, copy and every uploaded file for good.</p>
        <InlineError>{archive.error}</InlineError>
        {confirmDelete && (
          <form
            className="mt-3 flex flex-col gap-2"
            onSubmit={(e) => {
              e.preventDefault();
              del.run(() => deleteWorkspace(ws.id), onClose);
            }}
          >
            <p className="m-0 text-sm text-ink-2">Type <b>{ws.name}</b> to confirm. This cannot be undone.</p>
            <Input id="wd-del" value={typed} onChange={(e) => setTyped(e.target.value)} autoComplete="off" />
            <div className="flex justify-end gap-2">
              <Button size="sm" type="button" onClick={() => setConfirmDelete(false)}>Keep it</Button>
              <Button size="sm" type="submit" variant="danger" icon="trash" loading={del.pending} disabled={typed !== ws.name}>{del.pending ? "Deleting…" : "Delete for good"}</Button>
            </div>
            <InlineError>{del.error}</InlineError>
          </form>
        )}
      </section>

      <div className="flex justify-end border-t border-line-2 pt-4"><Button onClick={onClose}>Done</Button></div>
    </div>
  );
}
