"use client";
import { useMemo, useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import { toast } from "@/components/ui/toast";
import { clsx } from "@/lib/clsx";
import { timeAgo } from "@/lib/format";
import { diffPlainText, diffSummary } from "@/lib/copy/diff";
import { restoreVersion } from "@/actions/copy";
import type { VersionRow } from "@/lib/copy/types";

type Props = {
  sectionId: string;
  /** The older version being compared. */
  version: VersionRow | null;
  /** Plain text of the section as it is now. */
  currentText: string;
  open: boolean;
  onClose: () => void;
  readOnly: boolean;
  selfName: string;
};

/** Compares one saved version against the current copy, word by word, and offers to bring it back. */
export function VersionDiff({ sectionId, version, currentText, open, onClose, readOnly, selfName }: Props) {
  const [pending, start] = useTransition();
  const [confirming, setConfirming] = useState(false);
  const diff = useMemo(() => diffPlainText(version?.plainText ?? "", currentText), [version, currentText]);

  const close = () => {
    setConfirming(false);
    onClose();
  };

  const restore = () => {
    if (!version) return;
    if (!confirming) {
      setConfirming(true);
      return;
    }
    start(async () => {
      try {
        await restoreVersion(sectionId, version.id);
        toast(`Restored version ${version.version}`, { tone: "done" });
        close();
      } catch {
        toast("Could not restore", { tone: "late" });
        setConfirming(false);
      }
    });
  };

  const who = version ? (version.authorName === selfName ? "you" : version.authorName ?? "someone") : "";

  return (
    <Dialog open={open} onClose={close} title={version ? `Version ${version.version}` : "Version"}>
      {version && (
        <div className="flex flex-col gap-4">
          <div className="tnum flex flex-wrap items-center gap-x-2 gap-y-1 text-[13px] text-ink-2">
            <span>
              Version {version.version} by {who}, {timeAgo(version.createdAt)}
            </span>
            <span aria-hidden className="text-ink-3">→</span>
            <span className="font-medium text-ink">Current</span>
          </div>

          <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-ink-2" aria-label="Legend">
            <span className="tnum">{diffSummary(diff)}</span>
            <span className="inline-flex items-center gap-1.5">
              <span className="rounded-[3px] bg-late-soft px-1 text-late line-through">removed</span>
              <span className="text-ink-3">in that version</span>
            </span>
            <span className="inline-flex items-center gap-1.5">
              <span className="rounded-[3px] bg-done-soft px-1 text-done">added</span>
              <span className="text-ink-3">since</span>
            </span>
          </div>

          <div className="max-h-[52dvh] overflow-y-auto rounded-r border border-line bg-surface-2 px-4 py-3">
            {diff.parts.length === 0 || (!diff.changed && !currentText.trim()) ? (
              <p className="m-0 text-[13px] text-ink-3">Both are empty.</p>
            ) : (
              <p className="m-0 whitespace-pre-wrap font-serif text-[17px] leading-relaxed text-ink">
                {diff.parts.map((p, i) => (
                  <span
                    key={i}
                    className={clsx(
                      p.removed && "rounded-[3px] bg-late-soft text-late line-through decoration-late/60",
                      p.added && "rounded-[3px] bg-done-soft text-done",
                    )}
                  >
                    {p.value}
                  </span>
                ))}
              </p>
            )}
          </div>

          <div className="flex flex-wrap items-center justify-between gap-2">
            {!readOnly ? (
              <span className="flex items-center gap-2">
                <Button variant={confirming ? "primary" : "default"} disabled={pending} onClick={restore}>
                  {confirming ? "Yes, restore it" : "Restore this version"}
                </Button>
                {confirming && (
                  <button type="button" onClick={() => setConfirming(false)} className="text-[13px] text-ink-3 hover:text-ink">
                    No
                  </button>
                )}
              </span>
            ) : (
              <span />
            )}
            <Button onClick={close}>Close</Button>
          </div>
          {confirming && <p className="m-0 -mt-2 text-xs text-ink-3">The current copy is kept in history as its own version, so nothing is lost.</p>}
        </div>
      )}
    </Dialog>
  );
}
