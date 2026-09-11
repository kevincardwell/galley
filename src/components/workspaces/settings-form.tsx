"use client";
import { useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { Input, Label, Select } from "@/components/ui/field";
import { AccentPicker } from "./accent-picker";
import { updateWorkspace } from "@/actions/workspaces";

type Ws = { id: string; name: string; url: string | null; clientName: string | null; accent: string; status: string };

export function SettingsForm({ workspace }: { workspace: Ws }) {
  const [pending, start] = useTransition();
  const [msg, setMsg] = useState<string | null>(null);
  return (
    <form
      className="grid gap-3 sm:grid-cols-2"
      action={(fd) => start(async () => { setMsg(null); try { await updateWorkspace(workspace.id, fd); setMsg("Saved"); } catch (e) { setMsg((e as Error).message); } })}
    >
      <Label htmlFor="s-name">Website name<Input id="s-name" name="name" defaultValue={workspace.name} required /></Label>
      <Label htmlFor="s-url">URL<Input id="s-url" name="url" defaultValue={workspace.url ?? ""} /></Label>
      <Label htmlFor="s-client">Client<Input id="s-client" name="clientName" defaultValue={workspace.clientName ?? ""} /></Label>
      <Label htmlFor="s-status">Status
        <Select id="s-status" name="status" defaultValue={workspace.status}>
          <option value="planning">Planning</option><option value="building">Building</option><option value="review">In review</option><option value="live">Live</option>
        </Select>
      </Label>
      <Label className="sm:col-span-2">Accent colour<AccentPicker name="accent" defaultValue={workspace.accent} /></Label>
      <div className="flex items-center gap-3 sm:col-span-2">
        <Button type="submit" variant="primary" disabled={pending}>{pending ? "Saving…" : "Save changes"}</Button>
        {msg && <span className={msg === "Saved" ? "text-done" : "text-late"}>{msg}</span>}
      </div>
    </form>
  );
}
