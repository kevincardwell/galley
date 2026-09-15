"use client";
import { useState } from "react";
import { Avatar } from "@/components/ui/avatar";
import { Icon, IconButton } from "@/components/ui/icon";
import { Pill } from "@/components/ui/pill";
import { Tooltip } from "@/components/ui/tooltip";
import { revokeInvite } from "@/actions/admin";
import type { InviteRow, Person, WorkspaceOption } from "@/lib/queries/admin";
import { timeAgo } from "@/lib/format";
import { CopyIconButton } from "./copy-button";
import { InlineError, ROLE_LABEL, RowActions, Table, Td, Th, Tr, WsDot } from "./bits";
import { PersonDialog } from "./person-dialog";
import { useAdminAction } from "./use-action";

function daysLeft(expiresAt: number | null) {
  if (expiresAt === null) return "never expires";
  const d = Math.max(0, Math.ceil((expiresAt - Date.now() / 1000) / 86400));
  return d === 0 ? "expires today" : d === 1 ? "expires tomorrow" : `expires in ${d} days`;
}

export function PeopleTable({ people, invites, workspaces, selfId, baseUrl }: { people: Person[]; invites: InviteRow[]; workspaces: WorkspaceOption[]; selfId: string; baseUrl: string }) {
  const [openId, setOpenId] = useState<string | null>(null);
  const revoke = useAdminAction();
  const selected = people.find((p) => p.id === openId) ?? null;
  return (
    <>
      <Table>
        <thead>
          <tr><Th>Person</Th><Th>Role</Th><Th>Workspaces</Th><Th>Last seen</Th><Th num><span className="sr-only">Actions</span></Th></tr>
        </thead>
        <tbody>
          {people.map((p) => {
            const deactivated = !!p.deactivatedAt;
            return (
              <Tr key={p.id} muted={deactivated}>
                <Td>
                  <span className="flex items-center gap-2.5">
                    <Avatar name={p.name} size={26} muted={deactivated || p.id !== selfId} />
                    <span className="min-w-0">
                      <span className="block truncate font-medium">{p.name}{p.id === selfId && <span className="ml-1.5 text-xs font-normal text-ink-3">you</span>}</span>
                      <span className="block truncate text-xs text-ink-3">{p.email}</span>
                    </span>
                  </span>
                </Td>
                <Td>{deactivated ? <Pill tone="draft">Deactivated</Pill> : p.isAdmin ? <Pill tone="accent">Admin</Pill> : <Pill tone="neutral">Member</Pill>}</Td>
                <Td>
                  {p.memberships.length === 0 ? (
                    <span className="text-ink-3">{p.isAdmin ? "All" : "None"}</span>
                  ) : (
                    <span className="flex flex-col gap-0.5">
                      {p.memberships.map((m) => (
                        <span key={m.workspaceId} className="flex items-center gap-1.5">
                          <WsDot accent={m.accent} />
                          <span className="truncate">{m.name}</span>
                          <span className="text-xs text-ink-3">{ROLE_LABEL[m.role]?.toLowerCase()}</span>
                        </span>
                      ))}
                    </span>
                  )}
                </Td>
                <Td className="whitespace-nowrap text-ink-2">{timeAgo(p.lastSeenAt)}</Td>
                <Td num>
                  <RowActions>
                    <Tooltip label={`Manage ${p.name}`}>
                      <IconButton name="sliders" label={`Manage ${p.name}`} title="" onClick={() => setOpenId(p.id)} />
                    </Tooltip>
                  </RowActions>
                </Td>
              </Tr>
            );
          })}
          {invites.map((i) => (
            <Tr key={i.id} className="text-ink-2">
              <Td>
                <span className="flex items-center gap-2.5">
                  <span aria-hidden className="grid size-[26px] shrink-0 place-items-center rounded-full border-[1.5px] border-dashed border-ink-3 text-ink-3">
                    <Icon name="mail" size={12} />
                  </span>
                  <span className="min-w-0">
                    <span className="block truncate font-medium">{i.name || i.email}</span>
                    <span className="block truncate text-xs text-ink-3">{i.name ? `${i.email} · ` : ""}Invited by {i.inviterName ?? "someone"}, {daysLeft(i.expiresAt)}</span>
                  </span>
                </span>
              </Td>
              <Td><Pill tone="neutral" dot={false}>{i.isAdmin ? "Invited admin" : "Invited"}</Pill></Td>
              <Td>
                {i.workspace ? (
                  <span className="flex items-center gap-1.5"><WsDot accent={i.workspace.accent} /><span className="truncate">{i.workspace.name}</span><span className="text-xs text-ink-3">{i.workspaceRole}</span></span>
                ) : <span className="text-ink-3">—</span>}
              </Td>
              <Td className="text-ink-3">—</Td>
              <Td num>
                <RowActions>
                  <CopyIconButton value={`${baseUrl}/invite/${i.token}`} />
                  <Tooltip label="Revoke invite">
                    <IconButton name="trash" tone="danger" label={`Revoke the invite for ${i.name || i.email}`} title="" disabled={revoke.pending} onClick={() => revoke.run(() => revokeInvite(i.id))} />
                  </Tooltip>
                </RowActions>
              </Td>
            </Tr>
          ))}
        </tbody>
      </Table>
      <InlineError>{revoke.error}</InlineError>
      <PersonDialog person={selected} workspaces={workspaces} selfId={selfId} onClose={() => setOpenId(null)} />
    </>
  );
}
