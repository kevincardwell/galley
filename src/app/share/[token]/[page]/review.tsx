"use client";
import { useState, useSyncExternalStore, useTransition, type FormEvent, type KeyboardEvent } from "react";
import { Button } from "@/components/ui/button";
import { Input, Textarea } from "@/components/ui/field";
import { toast } from "@/components/ui/toast";
import { clsx } from "@/lib/clsx";
import { timeAgo } from "@/lib/format";
import { guestApprove, guestComment } from "@/actions/share";
import type { ShareSectionReview } from "@/lib/copy/types";

const NAME_KEY = "galley.guestName";

function readName(): string {
  try {
    return window.localStorage.getItem(NAME_KEY) ?? "";
  } catch {
    return "";
  }
}

const listeners = new Set<() => void>();
const notify = () => listeners.forEach((l) => l());

function saveName(name: string) {
  try {
    window.localStorage.setItem(NAME_KEY, name);
  } catch {
    /* private mode; the name still lives for this page load */
  }
  notify();
}

function subscribe(l: () => void) {
  listeners.add(l);
  const onStorage = (e: StorageEvent) => {
    if (e.key === NAME_KEY) l();
  };
  window.addEventListener("storage", onStorage);
  return () => {
    listeners.delete(l);
    window.removeEventListener("storage", onStorage);
  };
}

/** One name shared by every section on the page, remembered in localStorage. */
function useGuestName() {
  const stored = useSyncExternalStore(subscribe, readName, () => "");
  // Typing is local until it is committed to storage, so a draft never fights the stored value.
  const [draft, setDraft] = useState<string | null>(null);
  const name = draft ?? stored;
  const update = (n: string) => {
    setDraft(n);
    saveName(n.trim());
  };
  const settle = () => setDraft(null);
  return [name, update, settle] as const;
}

const message = (e: unknown, fallback: string) => (e instanceof Error && e.message && !/server/i.test(e.message) ? e.message : fallback);

/** Under each section on the share page when client review is on: open comments, a comment form, and approve. */
export function SectionReview({ token, sectionId, review }: { token: string; sectionId: string; review: ShareSectionReview }) {
  const [name, setName, settleName] = useGuestName();
  const [body, setBody] = useState("");
  const [pending, start] = useTransition();
  const [approving, startApprove] = useTransition();
  // Local echo so the button flips at once; the server value arrives after revalidation.
  const [approved, setApproved] = useState<{ at: number; by: string } | null>(review.clientApprovedAt ? { at: review.clientApprovedAt, by: review.clientApprovedBy ?? "the client" } : null);
  const [prevAt, setPrevAt] = useState(review.clientApprovedAt);
  if (prevAt !== review.clientApprovedAt) {
    setPrevAt(review.clientApprovedAt);
    setApproved(review.clientApprovedAt ? { at: review.clientApprovedAt, by: review.clientApprovedBy ?? "the client" } : null);
  }

  const needName = () => {
    if (name.trim()) return false;
    toast("Add your name first", { tone: "late" });
    document.getElementById(`name-${sectionId}`)?.focus();
    return true;
  };

  const submit = (e?: FormEvent) => {
    e?.preventDefault();
    const text = body.trim();
    if (!text) return;
    if (needName()) return;
    start(async () => {
      try {
        await guestComment(token, sectionId, name.trim(), text);
        setBody("");
        toast("Comment sent", { tone: "done" });
      } catch (err) {
        toast(message(err, "Could not send your comment"), { tone: "late" });
      }
    });
  };

  const onKey = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if ((e.metaKey || e.ctrlKey) && e.key === "Enter") {
      e.preventDefault();
      submit();
    }
  };

  const setApproval = (next: boolean) => {
    if (needName()) return;
    const before = approved;
    setApproved(next ? { at: Math.floor(Date.now() / 1000), by: name.trim() } : null);
    startApprove(async () => {
      try {
        await guestApprove(token, sectionId, name.trim(), next);
        toast(next ? "Section approved" : "Approval removed", { tone: next ? "done" : "neutral" });
      } catch (err) {
        setApproved(before);
        toast(message(err, "Could not save"), { tone: "late" });
      }
    });
  };

  return (
    <div className="mt-5 flex flex-col gap-4 border-t border-dashed border-line-2 pt-4 font-ui text-[13px]">
      {review.comments.length > 0 && (
        <ul className="m-0 flex list-none flex-col gap-2 p-0">
          {review.comments.map((c) => (
            <li key={c.id} className="rounded-r border border-line bg-surface-2 px-3 py-2">
              <div className="mb-1 flex items-baseline gap-2 text-ink-2">
                <span className="truncate font-medium text-ink">{c.name}</span>
                <span className="tnum ml-auto shrink-0 text-xs text-ink-3">{timeAgo(c.createdAt)}</span>
              </div>
              <p className="m-0 whitespace-pre-wrap text-ink">{c.body}</p>
            </li>
          ))}
        </ul>
      )}

      <form onSubmit={submit} className="flex flex-col gap-2">
        <div className="flex flex-wrap items-center gap-2">
          <label htmlFor={`name-${sectionId}`} className="text-xs text-ink-2">Your name</label>
          <Input id={`name-${sectionId}`} value={name} onChange={(e) => setName(e.target.value)} onBlur={settleName} maxLength={60} placeholder="e.g. Holly" autoComplete="name" className="w-48 py-1 text-[13px]" />
        </div>
        <Textarea
          value={body}
          onChange={(e) => setBody(e.target.value)}
          onKeyDown={onKey}
          maxLength={2000}
          placeholder="Leave a comment on this section"
          aria-label="Leave a comment"
          className="min-h-16 text-[13px]"
        />
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className={clsx("flex items-center gap-2", approving && "opacity-60")}>
            {approved ? (
              <span className="inline-flex flex-wrap items-center gap-x-2 text-done">
                <span className="inline-flex items-center gap-1.5 rounded-full bg-done-soft px-2 py-px text-xs font-medium">
                  <span className="size-1.5 rounded-full bg-current" />
                  Approved by {approved.by} · {timeAgo(approved.at)}
                </span>
                <button type="button" disabled={approving} onClick={() => setApproval(false)} className="text-xs text-ink-3 underline-offset-2 hover:text-ink hover:underline">
                  Undo
                </button>
              </span>
            ) : (
              <Button type="button" size="sm" variant="primary" disabled={approving} onClick={() => setApproval(true)}>
                Approve this section
              </Button>
            )}
          </div>
          {body.trim() && (
            <Button type="submit" size="sm" disabled={pending}>
              {pending ? "Sending…" : "Send comment"}
            </Button>
          )}
        </div>
      </form>
    </div>
  );
}
