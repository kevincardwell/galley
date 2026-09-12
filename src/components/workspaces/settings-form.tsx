"use client";
import { useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { Input, Label, Select } from "@/components/ui/field";
import { Icon } from "@/components/ui/icon";
import { AccentPicker } from "./accent-picker";
import { updateWorkspace } from "@/actions/workspaces";

type Ws = { id: string; name: string; url: string | null; clientName: string | null; accent: string; status: string };

const Name = ({ children }: { children: React.ReactNode }) => <span className="font-medium text-ink-2">{children}</span>;
const Hint = ({ children }: { children: React.ReactNode }) => <span className="text-xs text-ink-3">{children}</span>;

export function SettingsForm({ workspace }: { workspace: Ws }) {
  const [pending, start] = useTransition();
  const [msg, setMsg] = useState<string | null>(null);
  const ok = msg === "Saved";
  return (
    <form
      className="grid gap-4 sm:grid-cols-2"
      action={(fd) => start(async () => { setMsg(null); try { await updateWorkspace(workspace.id, fd); setMsg("Saved"); } catch (e) { setMsg((e as Error).message); } })}
    >
      <Label htmlFor="s-name">
        <Name>Website name</Name>
        <Input id="s-name" name="name" defaultValue={workspace.name} required />
        <Hint>Shown in the sidebar and on the client&rsquo;s share link.</Hint>
      </Label>
      <Label htmlFor="s-url">
        <Name>URL</Name>
        <Input id="s-url" name="url" defaultValue={workspace.url ?? ""} placeholder="marlowandfinch.co.uk" />
        <Hint>Live or planned. Linked from the project header.</Hint>
      </Label>
      <Label htmlFor="s-client">
        <Name>Client</Name>
        <Input id="s-client" name="clientName" defaultValue={workspace.clientName ?? ""} />
        <Hint>The person you send the share link to.</Hint>
      </Label>
      <Label htmlFor="s-status">
        <Name>Status</Name>
        <Select id="s-status" name="status" defaultValue={workspace.status}>
          <option value="planning">Planning</option>
          <option value="building">Building</option>
          <option value="review">In review</option>
          <option value="live">Live</option>
        </Select>
        <Hint>Sets the badge on the workspace card.</Hint>
      </Label>
      <Label className="sm:col-span-2">
        <Name>Accent colour</Name>
        <AccentPicker name="accent" defaultValue={workspace.accent} />
        <Hint>Used for this project&rsquo;s highlights, progress bars and buttons.</Hint>
      </Label>
      <div className="flex items-center gap-3 sm:col-span-2">
        <Button type="submit" variant="primary" icon="check" loading={pending}>
          {pending ? "Saving…" : "Save changes"}
        </Button>
        {msg && (
          <span role="status" className={`inline-flex items-center gap-1.5 text-[13px] ${ok ? "text-done" : "text-late"}`}>
            <Icon name={ok ? "check-circle" : "alert"} size={14} />
            {msg}
          </span>
        )}
      </div>
    </form>
  );
}
