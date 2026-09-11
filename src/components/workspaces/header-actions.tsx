"use client";
import { useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import { setShareReview, toggleShareLink } from "@/actions/workspaces";
import { toast } from "@/components/ui/toast";

type Props = {
  workspaceId: string;
  slug: string;
  shareToken: string | null;
  canManage: boolean;
  /** workspace.shareReview: whether the share link lets the client comment and approve. */
  shareReview?: boolean;
};

export function WorkspaceHeaderActions({ workspaceId, slug, shareToken, canManage, shareReview = false }: Props) {
  const [open, setOpen] = useState(false);
  const [pending, start] = useTransition();
  const [copied, setCopied] = useState(false);
  // Optimistic so the box flips at once; the server value wins after revalidation.
  const [review, setReview] = useState(shareReview);
  const [prevReview, setPrevReview] = useState(shareReview);
  if (prevReview !== shareReview) {
    setPrevReview(shareReview);
    setReview(shareReview);
  }
  const toggleReview = (next: boolean) => {
    setReview(next);
    start(async () => {
      try {
        await setShareReview(workspaceId, next);
        toast(next ? "Clients can now comment and approve" : "Client review turned off");
      } catch {
        setReview(!next);
        toast("Could not save", { tone: "late" });
      }
    });
  };
  const url = typeof window !== "undefined" && shareToken ? `${window.location.origin}/share/${shareToken}` : "";
  return (
    <div className="flex gap-2">
      {canManage && <Button onClick={() => setOpen(true)}>Share with client</Button>}
      <a href={`/api/export/${slug}`} download className="inline-flex items-center rounded-r border border-accent bg-accent px-3 py-1.5 font-medium text-accent-ink hover:brightness-95">Export</a>
      <Dialog open={open} onClose={() => setOpen(false)} title="Share with client">
        <p className="m-0 mb-3 text-ink-2">Anyone with the link can read the copy and browse the files. They cannot edit anything or see tasks.</p>
        {shareToken ? (
          <div className="flex flex-col gap-3">
            <div className="flex gap-2">
              <input id="share-url" readOnly value={url} className="min-w-0 flex-1 rounded-r border border-line bg-surface-2 px-2.5 py-1.5 text-sm" />
              <Button
                onClick={() => {
                  navigator.clipboard
                    .writeText(url)
                    .then(() => { setCopied(true); setTimeout(() => setCopied(false), 1500); toast("Link copied"); })
                    .catch(() => toast("Could not copy", { tone: "late" }));
                }}
              >
                {copied ? "Copied" : "Copy"}
              </Button>
            </div>
            <label className="flex cursor-pointer items-start gap-2 text-[13px] text-ink">
              <input type="checkbox" checked={review} disabled={pending} onChange={(e) => toggleReview(e.target.checked)} className="mt-0.5 accent-[var(--accent)]" />
              <span>
                Let the client comment and approve sections
                <span className="block text-xs text-ink-2">They give a name, no account needed. Comments and approvals show up in the editor and your inbox.</span>
              </span>
            </label>
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
