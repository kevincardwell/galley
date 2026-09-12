"use client";
import { useState, useTransition } from "react";
import { Avatar } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Select } from "@/components/ui/field";
import { IconButton } from "@/components/ui/icon";
import { Tooltip } from "@/components/ui/tooltip";
import { addMember, removeMember, setMemberRole } from "@/actions/members";

type M = { id: string; name: string; email: string; role: string };

const ROLES = [
  { value: "viewer", label: "Viewer" },
  { value: "editor", label: "Editor" },
  { value: "manager", label: "Manager" },
];

export function MembersPanel({ workspaceId, members, candidates, isAdmin, selfId }: { workspaceId: string; members: M[]; candidates: { id: string; name: string; email: string }[]; isAdmin: boolean; selfId: string }) {
  const [pending, start] = useTransition();
  const [pick, setPick] = useState(candidates[0]?.id ?? "");
  const [role, setRole] = useState("editor");
  return (
    <div className="flex flex-col gap-4">
      <ul className="m-0 list-none divide-y divide-line-2 border-y border-line-2 p-0">
        {members.map((m) => (
          <li key={m.id} className="flex items-center gap-3 py-2">
            <Avatar name={m.name} size={26} muted={m.id !== selfId} />
            <span className="min-w-0 flex-1">
              <span className="block truncate text-[13px] font-medium">
                {m.name}
                {m.id === selfId && <span className="ml-1.5 text-xs font-normal text-ink-3">you</span>}
              </span>
              <span className="block truncate text-xs text-ink-3">{m.email}</span>
            </span>
            <Select
              className="w-auto text-[13px]"
              aria-label={`Role for ${m.name}`}
              value={m.role}
              disabled={pending}
              onChange={(e) => start(() => setMemberRole(workspaceId, m.id, e.target.value))}
            >
              {ROLES.map((r) => <option key={r.value} value={r.value}>{r.label}</option>)}
            </Select>
            <Tooltip label={m.id === selfId ? "You cannot remove yourself" : `Remove ${m.name}`}>
              <IconButton
                name="trash"
                tone="danger"
                label={`Remove ${m.name}`}
                title={undefined}
                disabled={pending || m.id === selfId}
                onClick={() => start(() => removeMember(workspaceId, m.id))}
              />
            </Tooltip>
          </li>
        ))}
      </ul>
      {isAdmin ? (
        candidates.length > 0 ? (
          <div className="flex flex-wrap items-end gap-2">
            <label className="flex flex-col gap-1 text-xs font-medium text-ink-2" htmlFor="m-pick">
              Person
              <Select id="m-pick" className="w-auto min-w-52 text-[13px]" value={pick} onChange={(e) => setPick(e.target.value)}>
                {candidates.map((c) => <option key={c.id} value={c.id}>{c.name} ({c.email})</option>)}
              </Select>
            </label>
            <label className="flex flex-col gap-1 text-xs font-medium text-ink-2" htmlFor="m-role">
              Role
              <Select id="m-role" className="w-auto text-[13px]" value={role} onChange={(e) => setRole(e.target.value)}>
                {ROLES.map((r) => <option key={r.value} value={r.value}>{r.label}</option>)}
              </Select>
            </label>
            <Button icon="plus" loading={pending} disabled={!pick} onClick={() => start(() => addMember(workspaceId, pick, role as "editor"))}>
              Add to workspace
            </Button>
          </div>
        ) : (
          <p className="m-0 text-[13px] text-ink-3">Everyone on this instance is already here. Invite more people from Admin.</p>
        )
      ) : (
        <p className="m-0 text-[13px] text-ink-3">Only an instance admin can add people to a workspace.</p>
      )}
    </div>
  );
}
