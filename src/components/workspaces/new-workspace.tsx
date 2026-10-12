"use client";
import { useId, useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import { Input, Label, Select } from "@/components/ui/field";
import { createWorkspace } from "@/actions/workspaces";
import { AccentPicker } from "./accent-picker";
import { SiteFields } from "@/components/site/site-fields";

const Name = ({ children }: { children: React.ReactNode }) => <span className="font-medium text-ink-2">{children}</span>;

export type TemplateOption = { id: string; name: string };

export function NewWorkspaceButton({ templates = [] }: { templates?: TemplateOption[] }) {
  const [open, setOpen] = useState(false);
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  // The page can hold two of these buttons, each with its own dialog: ids must not repeat.
  const uid = useId();
  return (
    <>
      <Button variant="primary" icon="plus" onClick={() => setOpen(true)}>New workspace</Button>
      <Dialog open={open} onClose={() => setOpen(false)} title="New workspace">
        <form
          className="flex flex-col gap-3"
          action={(fd) => start(async () => { try { await createWorkspace(fd); } catch (e) { setError((e as Error).message); } })}
        >
          <Label htmlFor={`${uid}-ws-name`}><Name>Website name</Name><Input id={`${uid}-ws-name`} name="name" placeholder="Marlow &amp; Finch Joinery" required autoFocus /></Label>
          <Label htmlFor={`${uid}-ws-url`}><Name>Live or planned URL</Name><Input id={`${uid}-ws-url`} name="url" placeholder="marlowandfinch.co.uk" /></Label>
          <Label htmlFor={`${uid}-ws-client`}><Name>Client</Name><Input id={`${uid}-ws-client`} name="clientName" placeholder="Tom Marlow" /></Label>
          <Label><Name>Accent colour</Name><AccentPicker name="accent" /></Label>
          {templates.length > 0 && (
            <Label htmlFor={`${uid}-ws-template`}>
              <Name>Start from</Name>
              <Select id={`${uid}-ws-template`} name="templateId" defaultValue="">
                <option value="">An empty project</option>
                {templates.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
              </Select>
              <span className="text-xs text-ink-3">Copies the task list and the page and section titles. No copy, files or dates come across.</span>
            </Label>
          )}
          <details className="rounded-r border border-line px-3 py-2 text-xs text-ink-2 open:pb-3">
            <summary className="cursor-pointer font-medium text-ink-2 select-none">Website code <span className="font-normal text-ink-3">(optional)</span></summary>
            <p className="m-0 mt-2 mb-3 text-ink-3">Connect the site&rsquo;s git repository and the team can edit it from the Site tab. You can also do this later.</p>
            <SiteFields idPrefix={`${uid}-site`} />
          </details>
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
