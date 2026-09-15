"use client";
import { useState } from "react";
import { IconButton } from "@/components/ui/icon";
import { Pill } from "@/components/ui/pill";
import { Tooltip } from "@/components/ui/tooltip";
import { resendInvite, revokeInvite } from "@/actions/admin";
import type { InviteRow } from "@/lib/queries/admin";
import { timeAgo } from "@/lib/format";
import { CopyIconButton } from "./copy-button";
import { InlineError, RowActions, Table, Td, Th, Tr, WsDot } from "./bits";
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
  if (i.expiresAt === null) return "never expires";
  return `expires ${new Date(i.expiresAt * 1000).toLocaleDateString("en-GB", { day: "numeric", month: "short" })}`;
}

export function InvitesTable({ invites, baseUrl, emailConfigured }: { invites: InviteRow[]; baseUrl: string; emailConfigured: boolean }) {
  const revoke = useAdminAction();
  const resend = useAdminAction();
  const [sentTo, setSentTo] = useState<string | null>(null);
  return (
    <>
      <Table>
        <thead>
          <tr><Th>Invitee</Th><Th>Status</Th><Th>Workspace</Th><Th>Invited by</Th><Th>Sent</Th><Th num><span className="sr-only">Actions</span></Th></tr>
        </thead>
        <tbody>
          {invites.map((i) => (
            <Tr key={i.id} muted={i.state !== "pending"}>
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
              <Td className="whitespace-nowrap text-ink-2">
                {timeAgo(i.createdAt)}
                <span className="block text-xs text-ink-3">{i.emailedAt ? `emailed ${timeAgo(i.emailedAt)}` : "link only"}</span>
              </Td>
              <Td num>
                {i.state === "pending" && (
                  <RowActions>
                    <CopyIconButton value={`${baseUrl}/invite/${i.token}`} />
                    {emailConfigured && (
                      <Tooltip label={i.emailedAt ? "Send the invite again" : "Email this invite"}>
                        <IconButton
                          name="mail"
                          label={`${i.emailedAt ? "Send again" : "Email"} the invite for ${i.name || i.email}`}
                          title=""
                          disabled={resend.pending}
                          onClick={() => { setSentTo(null); resend.run(() => resendInvite(i.id), (d: { email: string }) => setSentTo(d.email)); }}
                        />
                      </Tooltip>
                    )}
                    <Tooltip label="Revoke invite">
                      <IconButton name="trash" tone="danger" label={`Revoke the invite for ${i.name || i.email}`} title="" disabled={revoke.pending} onClick={() => revoke.run(() => revokeInvite(i.id))} />
                    </Tooltip>
                  </RowActions>
                )}
              </Td>
            </Tr>
          ))}
        </tbody>
      </Table>
      {sentTo && <p role="status" className="m-0 mt-2 text-sm text-done">Invite emailed to {sentTo}.</p>}
      <InlineError>{revoke.error}</InlineError>
      <InlineError>{resend.error}</InlineError>
    </>
  );
}
