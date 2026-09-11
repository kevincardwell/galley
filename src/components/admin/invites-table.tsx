"use client";
import { Button } from "@/components/ui/button";
import { Pill } from "@/components/ui/pill";
import { revokeInvite } from "@/actions/admin";
import type { InviteRow } from "@/lib/queries/admin";
import { timeAgo } from "@/lib/format";
import { CopyButton } from "./copy-button";
import { InlineError, Table, Td, Th, WsDot } from "./bits";
import { useAdminAction } from "./use-action";

function StatePill({ state }: { state: InviteRow["state"] }) {
  if (state === "pending") return <Pill tone="accent">Pending</Pill>;
  if (state === "accepted") return <Pill tone="done">Accepted</Pill>;
  if (state === "expired") return <Pill tone="late">Expired</Pill>;
  return <Pill tone="draft">Revoked</Pill>;
}

function expiry(i: InviteRow) {
  if (i.state === "accepted") return `accepted ${timeAgo(i.acceptedAt)}`;
  if (i.state === "revoked") return `revoked ${timeAgo(i.revokedAt)}`;
  return `expires ${new Date(i.expiresAt * 1000).toLocaleDateString("en-GB", { day: "numeric", month: "short" })}`;
}

export function InvitesTable({ invites, baseUrl }: { invites: InviteRow[]; baseUrl: string }) {
  const revoke = useAdminAction();
  return (
    <>
      <Table>
        <thead>
          <tr><Th>Invitee</Th><Th>Status</Th><Th>Workspace</Th><Th>Invited by</Th><Th>Sent</Th><Th> </Th></tr>
        </thead>
        <tbody>
          {invites.map((i) => (
            <tr key={i.id} className={i.state === "pending" ? undefined : "text-ink-3"}>
              <Td>
                <span className="block truncate font-medium">{i.name || i.email}</span>
                <span className="block truncate text-xs text-ink-3">{i.name ? `${i.email} · ` : ""}{expiry(i)}{i.isAdmin ? " · instance admin" : ""}</span>
              </Td>
              <Td><StatePill state={i.state} /></Td>
              <Td>
                {i.workspace ? (
                  <span className="flex items-center gap-1.5"><WsDot accent={i.workspace.accent} />{i.workspace.name}<span className="text-xs text-ink-3">{i.workspaceRole}</span></span>
                ) : <span className="text-ink-3">—</span>}
              </Td>
              <Td className="text-ink-2">{i.inviterName ?? <span className="text-ink-3">someone</span>}</Td>
              <Td className="whitespace-nowrap text-ink-2">{timeAgo(i.createdAt)}</Td>
              <Td className="whitespace-nowrap text-right">
                {i.state === "pending" && (
                  <span className="inline-flex gap-1">
                    <CopyButton size="sm" variant="ghost" label="Copy link" value={`${baseUrl}/invite/${i.token}`} />
                    <Button size="sm" variant="ghost" disabled={revoke.pending} onClick={() => revoke.run(() => revokeInvite(i.id))}>Revoke</Button>
                  </span>
                )}
              </Td>
            </tr>
          ))}
        </tbody>
      </Table>
      <InlineError>{revoke.error}</InlineError>
    </>
  );
}
