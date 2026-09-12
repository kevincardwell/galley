"use client";
import { useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import { Input } from "@/components/ui/field";
import { Section } from "@/components/ui/page";
import { deleteWorkspace, setWorkspaceStatus } from "@/actions/workspaces";

export function DangerZone({ workspaceId, name, archived }: { workspaceId: string; name: string; archived: boolean }) {
  const [open, setOpen] = useState(false);
  const [typed, setTyped] = useState("");
  const [pending, start] = useTransition();
  return (
    <Section title="Archive or delete">
      <div className="flex flex-wrap gap-2">
        <Button
          icon={archived ? "undo" : "archive"}
          loading={pending}
          onClick={() => start(() => setWorkspaceStatus(workspaceId, archived ? "live" : "archived"))}
        >
          {archived ? "Restore workspace" : "Archive workspace"}
        </Button>
        <Button variant="danger" icon="trash" onClick={() => setOpen(true)}>Delete workspace</Button>
      </div>
      <p className="m-0 text-xs text-ink-3">
        Archiving hides it from the list and keeps everything. Deleting removes tasks, copy and every uploaded file for good.
      </p>
      <Dialog open={open} onClose={() => setOpen(false)} title="Delete this workspace?">
        <p className="m-0 mb-3 text-ink-2">Type <b>{name}</b> to confirm. This cannot be undone.</p>
        <Input id="del-confirm" aria-label={`Type ${name} to confirm`} value={typed} onChange={(e) => setTyped(e.target.value)} />
        <div className="mt-4 flex justify-end gap-2">
          <Button onClick={() => setOpen(false)}>Keep it</Button>
          <Button variant="danger" icon="trash" disabled={typed !== name} loading={pending} onClick={() => start(() => deleteWorkspace(workspaceId))}>
            Delete for good
          </Button>
        </div>
      </Dialog>
    </Section>
  );
}
