"use client";
import { useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import { toggleShareLink } from "@/actions/workspaces";

export function WorkspaceHeaderActions({ workspaceId, slug, shareToken, canManage }: { workspaceId: string; slug: string; shareToken: string | null; canManage: boolean }) {
  const [open, setOpen] = useState(false);
  const [pending, start] = useTransition();
  const [copied, setCopied] = useState(false);
  const url = typeof window !== "undefined" && shareToken ? `${window.location.origin}/share/${shareToken}` : "";
  return (
    <div className="flex gap-2">
      {canManage && <Button onClick={() => setOpen(true)}>Share with client</Button>}
      <Button variant="primary" onClick={() => { window.location.href = `/api/export/${slug}`; }}>Export</Button>
      <Dialog open={open} onClose={() => setOpen(false)} title="Share with client">
        <p className="m-0 mb-3 text-ink-2">Anyone with the link can read the copy and browse the files. They cannot edit anything or see tasks.</p>
        {shareToken ? (
          <div className="flex flex-col gap-3">
            <div className="flex gap-2">
              <input id="share-url" readOnly value={url} className="min-w-0 flex-1 rounded-r border border-line bg-surface-2 px-2.5 py-1.5 text-sm" />
              <Button onClick={() => { navigator.clipboard.writeText(url); setCopied(true); setTimeout(() => setCopied(false), 1500); }}>{copied ? "Copied" : "Copy"}</Button>
            </div>
            <div className="flex justify-between">
              <Button variant="danger" disabled={pending} onClick={() => start(() => toggleShareLink(workspaceId, false))}>Turn off link</Button>
              <Button onClick={() => setOpen(false)}>Done</Button>
            </div>
          </div>
        ) : (
          <div className="flex justify-end gap-2">
            <Button onClick={() => setOpen(false)}>Cancel</Button>
            <Button variant="primary" disabled={pending} onClick={() => start(() => toggleShareLink(workspaceId, true))}>Create link</Button>
          </div>
        )}
      </Dialog>
    </div>
  );
}
