"use client";
import { useState, useTransition } from "react";
import { Avatar } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Select } from "@/components/ui/field";
import { addMember, removeMember, setMemberRole } from "@/actions/members";

type M = { id: string; name: string; email: string; role: string };

export function MembersPanel({ workspaceId, members, candidates, isAdmin, selfId }: { workspaceId: string; members: M[]; candidates: { id: string; name: string; email: string }[]; isAdmin: boolean; selfId: string }) {
  const [pending, start] = useTransition();
  const [pick, setPick] = useState(candidates[0]?.id ?? "");
  const [role, setRole] = useState("editor");
  return (
    <div className="flex flex-col gap-3">
      <ul className="m-0 list-none divide-y divide-line-2 border-y border-line-2 p-0">
        {members.map((m) => (
          <li key={m.id} className="flex items-center gap-3 py-2">
            <Avatar name={m.name} muted={m.id !== selfId} />
            <span className="min-w-0 flex-1"><span className="block truncate">{m.name}</span><span className="block truncate text-xs text-ink-3">{m.email}</span></span>
            <Select className="w-auto" value={m.role} disabled={pending} onChange={(e) => start(() => setMemberRole(workspaceId, m.id, e.target.value))}>
              <option value="viewer">Viewer</option><option value="editor">Editor</option><option value="manager">Manager</option>
            </Select>
            <Button size="sm" variant="ghost" disabled={pending || m.id === selfId} onClick={() => start(() => removeMember(workspaceId, m.id))}>Remove</Button>
          </li>
        ))}
      </ul>
      {isAdmin ? (
        candidates.length > 0 ? (
          <div className="flex flex-wrap items-center gap-2">
            <Select id="m-pick" className="w-auto min-w-52" value={pick} onChange={(e) => setPick(e.target.value)}>
              {candidates.map((c) => <option key={c.id} value={c.id}>{c.name} ({c.email})</option>)}
            </Select>
            <Select id="m-role" className="w-auto" value={role} onChange={(e) => setRole(e.target.value)}>
              <option value="viewer">Viewer</option><option value="editor">Editor</option><option value="manager">Manager</option>
            </Select>
            <Button disabled={pending || !pick} onClick={() => start(() => addMember(workspaceId, pick, role as "editor"))}>Add to workspace</Button>
          </div>
        ) : (
          <p className="m-0 text-ink-3">Everyone on this instance is already here. Invite more people from Admin.</p>
        )
      ) : (
        <p className="m-0 text-ink-3">Only an instance admin can add people to a workspace.</p>
      )}
    </div>
  );
}
