"use client";
import { useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import { Input, Label } from "@/components/ui/field";
import { createWorkspace } from "@/actions/workspaces";
import { AccentPicker } from "./accent-picker";

export function NewWorkspaceButton() {
  const [open, setOpen] = useState(false);
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  return (
    <>
      <Button variant="primary" onClick={() => setOpen(true)}>New workspace</Button>
      <Dialog open={open} onClose={() => setOpen(false)} title="New workspace">
        <form
          className="flex flex-col gap-3"
          action={(fd) => start(async () => { try { await createWorkspace(fd); } catch (e) { setError((e as Error).message); } })}
        >
          <Label htmlFor="ws-name">Website name<Input id="ws-name" name="name" placeholder="Marlow & Finch Joinery" required autoFocus /></Label>
          <Label htmlFor="ws-url">Live or planned URL<Input id="ws-url" name="url" placeholder="marlowandfinch.co.uk" /></Label>
          <Label htmlFor="ws-client">Client<Input id="ws-client" name="clientName" placeholder="Tom Marlow" /></Label>
          <Label>Accent colour<AccentPicker name="accent" /></Label>
          {error && <p role="alert" className="m-0 text-sm text-late">{error}</p>}
          <div className="mt-2 flex justify-end gap-2">
            <Button type="button" onClick={() => setOpen(false)}>Cancel</Button>
            <Button type="submit" variant="primary" disabled={pending}>{pending ? "Creating…" : "Create workspace"}</Button>
          </div>
        </form>
      </Dialog>
    </>
  );
}
