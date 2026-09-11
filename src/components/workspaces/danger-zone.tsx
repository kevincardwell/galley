"use client";
import { useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import { Input } from "@/components/ui/field";
import { deleteWorkspace, setWorkspaceStatus } from "@/actions/workspaces";

export function DangerZone({ workspaceId, name, archived }: { workspaceId: string; name: string; archived: boolean }) {
  const [open, setOpen] = useState(false);
  const [typed, setTyped] = useState("");
  const [pending, start] = useTransition();
  return (
    <section>
      <h2 className="m-0 mb-3 text-sm font-semibold">Archive or delete</h2>
      <div className="flex flex-wrap gap-2">
        <Button disabled={pending} onClick={() => start(() => setWorkspaceStatus(workspaceId, archived ? "live" : "archived"))}>{archived ? "Restore workspace" : "Archive workspace"}</Button>
        <Button variant="danger" onClick={() => setOpen(true)}>Delete workspace</Button>
      </div>
      <p className="mb-0 mt-2 text-xs text-ink-3">Archiving hides it from the list and keeps everything. Deleting removes tasks, copy and every uploaded file for good.</p>
      <Dialog open={open} onClose={() => setOpen(false)} title="Delete this workspace?">
        <p className="m-0 mb-3 text-ink-2">Type <b>{name}</b> to confirm. This cannot be undone.</p>
        <Input id="del-confirm" value={typed} onChange={(e) => setTyped(e.target.value)} />
        <div className="mt-4 flex justify-end gap-2">
          <Button onClick={() => setOpen(false)}>Keep it</Button>
          <Button variant="danger" disabled={typed !== name || pending} onClick={() => start(() => deleteWorkspace(workspaceId))}>Delete for good</Button>
        </div>
      </Dialog>
    </section>
  );
}
