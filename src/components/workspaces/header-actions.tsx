"use client";
import { useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import { setShareReview, setShareUploads, toggleShareLink } from "@/actions/workspaces";
import { toast } from "@/components/ui/toast";

type Props = {
  workspaceId: string;
  slug: string;
  shareToken: string | null;
  canManage: boolean;
  /** workspace.shareReview: whether the share link lets the client comment and approve. */
  shareReview?: boolean;
  /** workspace.shareUploads: whether the share link lets the client send files in. */
  shareUploads?: boolean;
};

/**
 * A checkbox that flips at once and puts itself back if the server refuses.
 * Both share switches behave the same way, so the behaviour lives here once.
 */
function useShareToggle(initial: boolean, save: (next: boolean) => Promise<void>, message: (next: boolean) => string) {
  const [on, setOn] = useState(initial);
  const [prev, setPrev] = useState(initial);
  const [pending, start] = useTransition();
  if (prev !== initial) {
    setPrev(initial);
    setOn(initial);
  }
  const toggle = (next: boolean) => {
    setOn(next);
    start(async () => {
      try {
        await save(next);
        toast(message(next));
      } catch {
        setOn(!next);
        toast("Could not save", { tone: "late" });
      }
    });
  };
  return { on, pending, toggle };
}

export function WorkspaceHeaderActions({ workspaceId, slug, shareToken, canManage, shareReview = false, shareUploads = false }: Props) {
  const [open, setOpen] = useState(false);
  const [pending, start] = useTransition();
  const [copied, setCopied] = useState(false);
  const review = useShareToggle(
    shareReview,
    (next) => setShareReview(workspaceId, next),
    (next) => (next ? "Clients can now comment and approve" : "Client review turned off"),
  );
  const uploads = useShareToggle(
    shareUploads,
    (next) => setShareUploads(workspaceId, next),
    (next) => (next ? "Clients can now send files in" : "Client uploads turned off"),
  );
  const url = typeof window !== "undefined" && shareToken ? `${window.location.origin}/share/${shareToken}` : "";
  return (
    <div className="flex gap-2">
      {canManage && (
        <Button icon="share" size="sm" onClick={() => setOpen(true)} title="Share a read-only link with the client">
          Share
        </Button>
      )}
      <Button
        icon="download"
        size="sm"
        title="Download a zip of the copy, tasks and files"
        onClick={() => {
          // A route handler, not a page: hand it to the browser as a download.
          const a = document.createElement("a");
          a.href = `/api/export/${slug}`;
          a.download = "";
          a.click();
        }}
      >
        Export
      </Button>
      <Dialog open={open} onClose={() => setOpen(false)} title="Share with client">
        <p className="m-0 mb-3 text-ink-2">Anyone with the link can read the copy and browse the files. They cannot edit anything or see tasks.</p>
        {shareToken ? (
          <div className="flex flex-col gap-3">
            <div className="flex gap-2">
              <input id="share-url" readOnly value={url} aria-label="Share link" className="min-w-0 flex-1 rounded-r border border-line bg-surface-2 px-2.5 py-1.5 text-[13px]" />
              <Button
                icon={copied ? "check" : "copy"}
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
              <input type="checkbox" checked={review.on} disabled={review.pending} onChange={(e) => review.toggle(e.target.checked)} className="mt-0.5 accent-[var(--accent)]" />
              <span>
                Let the client comment and approve sections
                <span className="block text-xs text-ink-2">They give a name, no account needed. Comments and approvals show up in the editor and your inbox.</span>
              </span>
            </label>
            <label className="flex cursor-pointer items-start gap-2 text-[13px] text-ink">
              <input type="checkbox" checked={uploads.on} disabled={uploads.pending} onChange={(e) => uploads.toggle(e.target.checked)} className="mt-0.5 accent-[var(--accent)]" />
              <span>
                Let the client send files in
                <span className="block text-xs text-ink-2">Their logo, photographs, the old brochure. Files land in this project&rsquo;s library and you get told who sent them.</span>
              </span>
            </label>
            <div className="flex justify-between">
              <Button variant="danger" icon="link" loading={pending} onClick={() => start(() => toggleShareLink(workspaceId, false))}>Turn off link</Button>
              <Button onClick={() => setOpen(false)}>Done</Button>
            </div>
          </div>
        ) : (
          <div className="flex justify-end gap-2">
            <Button onClick={() => setOpen(false)}>Cancel</Button>
            <Button variant="primary" icon="link" loading={pending} onClick={() => start(() => toggleShareLink(workspaceId, true))}>Create link</Button>
          </div>
        )}
      </Dialog>
    </div>
  );
}
