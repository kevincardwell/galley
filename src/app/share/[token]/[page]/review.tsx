"use client";
import { useState, useTransition, type FormEvent, type KeyboardEvent } from "react";
import { Button } from "@/components/ui/button";
import { Input, Textarea } from "@/components/ui/field";
import { Icon } from "@/components/ui/icon";
import { toast } from "@/components/ui/toast";
import { clsx } from "@/lib/clsx";
import { timeAgo } from "@/lib/format";
import { guestApprove, guestComment } from "@/actions/share";
import type { ShareSectionReview } from "@/lib/copy/types";
import { useGuestName } from "@/components/share/guest-name";

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

  const count = review.comments.length;
  return (
    <div className="mt-6 flex flex-col gap-3.5 rounded-lg border border-line bg-surface-2 p-4 font-ui text-[13px]">
      <p className="m-0 flex items-center gap-1.5 text-xs font-medium text-ink-3">
        <Icon name="message" size={13} />
        {count === 0 ? "Your feedback" : count === 1 ? "1 comment" : `${count} comments`}
      </p>

      {count > 0 && (
        <ul className="m-0 flex list-none flex-col gap-2 p-0">
          {review.comments.map((c) => (
            <li key={c.id} className="rounded-r border border-line bg-surface px-3 py-2">
              <div className="mb-1 flex items-baseline gap-2 text-ink-2">
                <span className="truncate font-medium text-ink">{c.name}</span>
                <span className="tnum ml-auto shrink-0 text-xs text-ink-3">{timeAgo(c.createdAt)}</span>
              </div>
              <p className="m-0 whitespace-pre-wrap text-ink">{c.body}</p>
            </li>
          ))}
        </ul>
      )}

      <form onSubmit={submit} className="flex flex-col gap-2 border-t border-line-2 pt-3.5">
        <div className="flex flex-wrap items-center gap-2">
          <label htmlFor={`name-${sectionId}`} className="text-xs font-medium text-ink-2">Your name</label>
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
        <div className="mt-0.5 flex flex-wrap items-center justify-between gap-2">
          <div className={clsx("flex items-center gap-2", approving && "opacity-60")}>
            {approved ? (
              <span className="inline-flex flex-wrap items-center gap-x-2 gap-y-1 text-done">
                <span className="inline-flex items-center gap-1.5 rounded-full bg-done-soft px-2 py-0.5 text-xs font-medium">
                  <Icon name="check" size={12} strokeWidth={2.5} />
                  Approved by {approved.by} · {timeAgo(approved.at)}
                </span>
                <button
                  type="button"
                  disabled={approving}
                  onClick={() => setApproval(false)}
                  className="cursor-pointer rounded-r px-1 text-xs text-ink-3 underline-offset-2 transition-colors duration-150 hover:text-ink hover:underline"
                >
                  Undo
                </button>
              </span>
            ) : (
              <Button type="button" size="sm" variant="primary" icon="check" loading={approving} onClick={() => setApproval(true)}>
                Approve this section
              </Button>
            )}
          </div>
          {body.trim() && (
            <Button type="submit" size="sm" icon="message" loading={pending}>
              {pending ? "Sending…" : "Send comment"}
            </Button>
          )}
        </div>
      </form>
    </div>
  );
}
