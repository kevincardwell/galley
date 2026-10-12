"use client";
import { useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { Input, Label } from "@/components/ui/field";
import { Icon } from "@/components/ui/icon";
import { disconnectSite, updateSiteSettings } from "@/actions/site";
import { DeploySecrets } from "./deploy-secrets";

const Name = ({ children }: { children: React.ReactNode }) => <span className="font-medium text-ink-2">{children}</span>;
const Hint = ({ children }: { children: React.ReactNode }) => <span className="text-xs text-ink-3">{children}</span>;

export function SiteSettings({ workspaceId, site }: { workspaceId: string; site: { repoUrl: string; baseBranch: string; workBranch: string; root: string; hasToken: boolean; github: boolean } }) {
  const [pending, start] = useTransition();
  const [msg, setMsg] = useState<string | null>(null);
  const [confirm, setConfirm] = useState(false);
  const ok = msg === "Saved";
  return (
    <div className="flex flex-col gap-4">
      <p className="m-0 text-[13px] text-ink-2">
        <a href={site.repoUrl} target="_blank" rel="noreferrer" className="font-mono text-xs">{site.repoUrl}</a>
        <span className="text-ink-3">: changes go to <code>{site.workBranch}</code> and are reviewed into <code>{site.baseBranch}</code>.</span>
      </p>
      <form
        className="grid gap-4 sm:grid-cols-2"
        action={(fd) => start(async () => { setMsg(null); try { await updateSiteSettings(workspaceId, fd); setMsg("Saved"); } catch (e) { setMsg((e as Error).message); } })}
      >
        <Label htmlFor="site-token">
          <Name>Access token</Name>
          <Input id="site-token" name="token" type="password" autoComplete="off" placeholder={site.hasToken ? "Saved. Leave empty to keep it." : "github_pat_…"} />
          <Hint>Contents and Pull requests: Read and write. Actions: Read. Secrets: Read and write, for the deploy details below.</Hint>
        </Label>
        <Label htmlFor="site-root">
          <Name>Website folder</Name>
          <Input id="site-root" name="root" defaultValue={site.root} placeholder="the whole repository" spellCheck={false} />
          <Hint>Only this folder is shown and editable.</Hint>
        </Label>
        <div className="flex items-center gap-3 sm:col-span-2">
          <Button type="submit" variant="primary" icon="check" loading={pending}>Save</Button>
          {msg && (
            <span role="status" className={`inline-flex items-center gap-1.5 text-[13px] ${ok ? "text-done" : "text-late"}`}>
              <Icon name={ok ? "check-circle" : "alert"} size={14} />
              {msg}
            </span>
          )}
        </div>
      </form>
      {site.github && site.hasToken && <DeploySecrets workspaceId={workspaceId} />}
      <div className="flex flex-wrap items-center gap-2 text-[13px] text-ink-2">
        {confirm ? (
          <>
            Disconnecting deletes Galley&rsquo;s copy, including edits nobody has sent yet. The repository itself is not touched.
            <Button size="sm" onClick={() => setConfirm(false)}>Keep it</Button>
            <Button size="sm" variant="danger" icon="trash" loading={pending} onClick={() => start(async () => { await disconnectSite(workspaceId); })}>Disconnect</Button>
          </>
        ) : (
          <Button size="sm" variant="ghost" icon="x" onClick={() => setConfirm(true)}>Disconnect this repository</Button>
        )}
      </div>
    </div>
  );
}
