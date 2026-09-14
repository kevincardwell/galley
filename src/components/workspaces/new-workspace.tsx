"use client";
import { useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import { Input, Label, Select } from "@/components/ui/field";
import { createWorkspace } from "@/actions/workspaces";
import { AccentPicker } from "./accent-picker";

const Name = ({ children }: { children: React.ReactNode }) => <span className="font-medium text-ink-2">{children}</span>;

export type TemplateOption = { id: string; name: string };

export function NewWorkspaceButton({ templates = [] }: { templates?: TemplateOption[] }) {
  const [open, setOpen] = useState(false);
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  return (
    <>
      <Button variant="primary" icon="plus" onClick={() => setOpen(true)}>New workspace</Button>
      <Dialog open={open} onClose={() => setOpen(false)} title="New workspace">
        <form
          className="flex flex-col gap-3"
          action={(fd) => start(async () => { try { await createWorkspace(fd); } catch (e) { setError((e as Error).message); } })}
        >
          <Label htmlFor="ws-name"><Name>Website name</Name><Input id="ws-name" name="name" placeholder="Marlow &amp; Finch Joinery" required autoFocus /></Label>
          <Label htmlFor="ws-url"><Name>Live or planned URL</Name><Input id="ws-url" name="url" placeholder="marlowandfinch.co.uk" /></Label>
          <Label htmlFor="ws-client"><Name>Client</Name><Input id="ws-client" name="clientName" placeholder="Tom Marlow" /></Label>
          <Label><Name>Accent colour</Name><AccentPicker name="accent" /></Label>
          {templates.length > 0 && (
            <Label htmlFor="ws-template">
              <Name>Start from</Name>
              <Select id="ws-template" name="templateId" defaultValue="">
                <option value="">An empty project</option>
                {templates.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
              </Select>
              <span className="text-xs text-ink-3">Copies the task list and the page and section titles. No copy, files or dates come across.</span>
            </Label>
          )}
          {error && <p role="alert" className="m-0 text-[13px] text-late">{error}</p>}
          <div className="mt-2 flex justify-end gap-2">
            <Button type="button" onClick={() => setOpen(false)}>Cancel</Button>
            <Button type="submit" variant="primary" icon="check" loading={pending}>{pending ? "Creating…" : "Create workspace"}</Button>
          </div>
        </form>
      </Dialog>
    </>
  );
}
