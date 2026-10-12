"use client";
import { useEffect, useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import { Input, Label } from "@/components/ui/field";
import { Icon } from "@/components/ui/icon";
import { Pill } from "@/components/ui/pill";
import { toast } from "@/components/ui/toast";
import { clsx } from "@/lib/clsx";
import { revertSiteFile, sendForReview, siteDiff, type SiteStatus } from "@/actions/site";

const KIND = { modified: "changed", added: "new", deleted: "deleted", renamed: "renamed" } as const;

export function ChangesDialog({ open, onClose, workspaceId, status, onChanged }: { open: boolean; onClose: () => void; workspaceId: string; status: SiteStatus | null; onChanged: () => void }) {
  const list = status?.changes ?? [];
  const [selected, setSelected] = useState<string | null>(null);
  const [diff, setDiff] = useState<{ file: string; text: string } | null>(null);
  const [confirmFor, setConfirmFor] = useState<string | null>(null);
  const [message, setMessage] = useState("");
  const [busy, start] = useTransition();
  const file = selected && list.some((c) => c.file === selected) ? selected : (list[0]?.file ?? null);

  useEffect(() => {
    if (!open || !file) return;
    let cancelled = false;
    siteDiff(workspaceId, file).then(
      (text) => !cancelled && setDiff({ file, text }),
      (e: Error) => !cancelled && setDiff({ file, text: `Could not show the changes: ${e.message}` }),
    );
    return () => {
      cancelled = true;
    };
  }, [open, file, workspaceId, status]);

  const send = () =>
    start(async () => {
      try {
        const r = await sendForReview(workspaceId, message);
        setMessage("");
        onClose();
        toast(r.number ? `Sent for review: pull request #${r.number} is up to date.` : "Sent. Open a pull request on your git host to review it.", { tone: "done", duration: 8000 });
        if (r.url) window.open(r.url, "_blank", "noopener");
      } catch (e) {
        toast((e as Error).message, { tone: "late", duration: 9000 });
      }
      onChanged();
    });

  const revert = (f: string) =>
    start(async () => {
      try {
        await revertSiteFile(workspaceId, f);
        setConfirmFor(null);
        toast(`${f} is back to how it was`, { tone: "done" });
      } catch (e) {
        toast((e as Error).message, { tone: "late" });
      }
      onChanged();
    });

  const unsentCommits = status?.unsent ?? 0;
  const canSend = (list.length > 0 || unsentCommits > 0) && !busy;

  return (
    <Dialog open={open} onClose={onClose} title="Changes waiting for review" wide>
      {list.length === 0 ? (
        <p className="m-0 text-ink-2">
          {unsentCommits ? "Everything is saved and committed; send it to update the pull request." : "Nothing has changed since the last review. Click any text in the preview, or open Code, to start."}
        </p>
      ) : (
        <div className="grid gap-3 md:grid-cols-[220px_1fr]">
          <ul className="m-0 flex list-none flex-col gap-0.5 p-0" aria-label="Changed files">
            {list.map((c) => (
              <li key={c.file}>
                <button
                  type="button"
                  onClick={() => setSelected(c.file)}
                  aria-current={c.file === file ? "true" : undefined}
                  className={clsx("flex w-full cursor-pointer items-center gap-2 rounded-r px-2 py-1.5 text-left text-[13px]", c.file === file ? "bg-accent-soft" : "hover:bg-surface-2")}
                >
                  <span className="min-w-0 flex-1 truncate font-mono text-xs" title={c.file}>{c.file}</span>
                  <Pill tone={c.kind === "deleted" ? "late" : c.kind === "added" ? "done" : "review"} dot={false}>{KIND[c.kind]}</Pill>
                </button>
              </li>
            ))}
          </ul>
          <div className="min-w-0">
            <DiffView text={diff && diff.file === file ? diff.text : null} />
            {file && (
              <div className="mt-2 flex justify-end">
                {confirmFor === file ? (
                  <span className="flex items-center gap-2 text-[13px] text-ink-2">
                    Throw away the changes to {file}?
                    <Button size="sm" onClick={() => setConfirmFor(null)}>Keep</Button>
                    <Button size="sm" variant="danger" icon="undo" loading={busy} onClick={() => revert(file)}>Throw away</Button>
                  </span>
                ) : (
                  <Button size="sm" variant="ghost" icon="undo" onClick={() => setConfirmFor(file)}>Undo changes to this file</Button>
                )}
              </div>
            )}
          </div>
        </div>
      )}
      <form
        className="mt-5 flex flex-col gap-3 border-t border-line pt-4 sm:flex-row sm:items-end"
        onSubmit={(e) => {
          e.preventDefault();
          if (canSend) send();
        }}
      >
        <Label htmlFor="send-msg" className="flex-1">
          <span className="font-medium text-ink-2">What changed, in a few words</span>
          <Input id="send-msg" value={message} onChange={(e) => setMessage(e.target.value)} placeholder="New opening times on the home page" maxLength={200} />
        </Label>
        <Button type="submit" variant="primary" icon="pull-request" loading={busy} disabled={!canSend}>
          Send for review
        </Button>
      </form>
      {status && !status.hasToken && <p className="m-0 mt-2 text-xs text-review"><Icon name="warning" size={12} className="mr-1 inline" />A manager has to add an access token in Settings before anything can be sent.</p>}
    </Dialog>
  );
}

function DiffView({ text }: { text: string | null }) {
  if (text === null) return <div className="h-40 animate-pulse rounded-r bg-surface-2" />;
  const lines = text.split("\n");
  return (
    <pre className="m-0 max-h-[52dvh] overflow-auto rounded-r border border-line bg-surface-2 py-2 font-mono text-xs leading-relaxed" aria-label="Line by line changes">
      {lines.map((l, i) => (
        <div
          key={i}
          className={clsx(
            "px-3 whitespace-pre-wrap [overflow-wrap:anywhere]",
            l.startsWith("+") && "bg-done-soft text-done",
            l.startsWith("-") && "bg-late-soft text-late",
            l.startsWith("@@") && "mt-2 text-ink-3 first:mt-0",
          )}
        >
          {l.startsWith("@@") ? "···" : l || " "}
        </div>
      ))}
    </pre>
  );
}
