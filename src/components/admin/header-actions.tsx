"use client";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import type { WorkspaceOption } from "@/lib/queries/admin";
import { InviteForm } from "./invite-form";

export function AdminHeaderActions({ workspaces }: { workspaces: WorkspaceOption[] }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <Button variant="primary" icon="plus" onClick={() => setOpen(true)}>Invite someone</Button>
      <Dialog open={open} onClose={() => setOpen(false)} title="Invite someone">
        {open && <InviteForm workspaces={workspaces} idPrefix="dlg" onDone={() => setOpen(false)} />}
      </Dialog>
    </>
  );
}
