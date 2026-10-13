"use client";
import { errorText } from "@/lib/user-error";
import { useMemo, useState, useTransition, type FormEvent, type KeyboardEvent } from "react";
import type { SectionStatus } from "@/db/schema";
import { Button } from "@/components/ui/button";
import { Input, Textarea } from "@/components/ui/field";
import { Icon } from "@/components/ui/icon";
import { toast } from "@/components/ui/toast";
import { ChangedParagraphs } from "@/components/copy/diff-text";
import { clsx } from "@/lib/clsx";
import { timeAgo } from "@/lib/format";
import { diffPlainText, diffSummary } from "@/lib/copy/diff";
import { guestApprove, guestApprovePage, guestComment, guestSuggest } from "@/actions/share";
import type { ShareSectionReview } from "@/lib/copy/types";
import { askForName, useGuestName } from "@/components/share/guest-name";

const message = errorText;

type Props = {
  token: string;
  sectionId: string;
  status: SectionStatus;
  /** The section's words as editable plain text: what a suggestion starts from. */
  text: string;
  /** False for a section handed to the client to write, which has its own box. */
  canSuggest: boolean;
  review: ShareSectionReview;
};

/** Under each section when client review is on: what has been said so far, then approve, suggest wording or comment. */
export function SectionReview({ token, sectionId, status, text, canSuggest, review }: Props) {
  const [name] = useGuestName();
  const [mode, setMode] = useState<"comment" | "suggest" | null>(null);
  const [body, setBody] = useState("");
  const [draft, setDraft] = useState(text);
  const [pending, start] = useTransition();
  const [approving, startApprove] = useTransition();
  // Local echo so the button flips at once; the server value arrives after revalidation.
  const [approved, setApproved] = useState<{ at: number; by: string } | null>(review.clientApprovedAt ? { at: review.clientApprovedAt, by: review.clientApprovedBy ?? "the client" } : null);
  const [prevAt, setPrevAt] = useState(review.clientApprovedAt);
  if (prevAt !== review.clientApprovedAt) {
    setPrevAt(review.clientApprovedAt);
    setApproved(review.clientApprovedAt ? { at: review.clientApprovedAt, by: review.clientApprovedBy ?? "the client" } : null);
  }
  const changes = useMemo(() => diffPlainText(text, draft), [text, draft]);

  const open = (next: "comment" | "suggest") => {
    setMode(mode === next ? null : next);
    if (next === "suggest") setDraft(text);
  };
  const close = () => {
    setMode(null);
    setBody("");
  };

  const send = (e?: FormEvent) => {
    e?.preventDefault();
    if (!name.trim()) return askForName();
    if (mode === "comment" && !body.trim()) return;
    if (mode === "suggest" && !changes.changed) return;
    start(async () => {
      try {
        if (mode === "suggest") await guestSuggest(token, sectionId, name.trim(), draft, body);
        else await guestComment(token, sectionId, name.trim(), body.trim());
        toast(mode === "suggest" ? "Suggestion sent to the studio" : "Comment sent", { tone: "done" });
        close();
      } catch (err) {
        toast(message(err, "Could not send that"), { tone: "late" });
      }
    });
  };

  const onKey = (e: KeyboardEvent<HTMLElement>) => {
    if ((e.metaKey || e.ctrlKey) && e.key === "Enter") {
      e.preventDefault();
      send();
    }
  };

  const setApproval = (next: boolean) => {
    if (!name.trim()) return askForName();
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
    <div className="mt-5 flex flex-col gap-3 font-ui text-[13px]">
      {review.comments.length > 0 && (
        <ul className="m-0 flex list-none flex-col gap-2 p-0">
          {review.comments.map((c) => (
            <li key={c.id} className="rounded-r border border-line bg-surface-2 px-3 py-2">
              <div className="mb-1 flex items-baseline gap-2 text-ink-2">
                <span className="truncate font-medium text-ink">{c.name}</span>
                {c.suggestion != null && <span className="shrink-0 text-xs text-ink-3">suggested new wording · with the studio</span>}
                <span className="tnum ml-auto shrink-0 text-xs text-ink-3">{timeAgo(c.createdAt)}</span>
              </div>
              {c.suggestion != null && (
                <div className="mb-1">
                  <ChangedParagraphs from={c.suggestionBase ?? ""} to={c.suggestion} className="font-serif text-[15px] leading-relaxed" />
                </div>
              )}
              {c.body && <p className="m-0 whitespace-pre-wrap text-ink">{c.body}</p>}
            </li>
          ))}
        </ul>
      )}

      <div className="flex flex-wrap items-center gap-2">
        {status === "draft" ? (
          <span className="mr-1 text-xs text-ink-3">Still being written, so there is nothing to approve yet.</span>
        ) : approved ? (
          <span className={clsx("mr-1 inline-flex flex-wrap items-center gap-x-2 gap-y-1 text-done", approving && "opacity-60")}>
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
          <Button size="sm" variant="primary" icon="check" loading={approving} onClick={() => setApproval(true)}>
            Approve
          </Button>
        )}
        {canSuggest && (
          <Button size="sm" variant={mode === "suggest" ? "default" : "ghost"} icon="pencil" aria-expanded={mode === "suggest"} onClick={() => open("suggest")}>
            Suggest wording
          </Button>
        )}
        <Button size="sm" variant={mode === "comment" ? "default" : "ghost"} icon="message" aria-expanded={mode === "comment"} onClick={() => open("comment")}>
          Comment
        </Button>
      </div>

      {mode === "comment" && (
        <form onSubmit={send} className="flex flex-col gap-2">
          <Textarea autoFocus value={body} onChange={(e) => setBody(e.target.value)} onKeyDown={onKey} maxLength={2000} placeholder="What would you like to say about this section?" aria-label="Your comment" className="min-h-20 text-[13px]" />
          <div className="flex justify-end gap-2">
            <Button type="button" size="sm" variant="ghost" onClick={close}>Cancel</Button>
            <Button type="submit" size="sm" variant="primary" icon="message" loading={pending} disabled={!body.trim()}>Send comment</Button>
          </div>
        </form>
      )}

      {mode === "suggest" && (
        <form onSubmit={send} className="flex flex-col gap-2">
          <p className="m-0 text-xs text-ink-2">Change the words below the way you want them. The studio sees exactly what you changed and decides whether to use it.</p>
          <Textarea autoFocus value={draft} onChange={(e) => setDraft(e.target.value)} onKeyDown={onKey} maxLength={20000} aria-label="Your wording" className="min-h-40 bg-surface font-serif text-[15px] leading-relaxed" />
          {changes.changed && (
            <div className="rounded-r border border-line bg-surface-2 px-3 py-2">
              <p className="tnum m-0 mb-1 text-xs text-ink-3">Your changes · {diffSummary(changes)}</p>
              <ChangedParagraphs from={text} to={draft} className="font-serif text-[15px] leading-relaxed" />
            </div>
          )}
          <Input value={body} onChange={(e) => setBody(e.target.value)} onKeyDown={onKey} maxLength={2000} placeholder="Why the change? (optional)" aria-label="Why the change" className="text-[13px]" />
          <div className="flex justify-end gap-2">
            <Button type="button" size="sm" variant="ghost" onClick={close}>Cancel</Button>
            <Button type="submit" size="sm" variant="primary" icon="pencil" loading={pending} disabled={!changes.changed}>Send suggestion</Button>
          </div>
        </form>
      )}
    </div>
  );
}

/** "Approve all" in the page header, for a client who has read the page and is happy with every section on it. */
export function ApprovePage({ token, pageSlug, count }: { token: string; pageSlug: string; count: number }) {
  const [name] = useGuestName();
  const [pending, start] = useTransition();
  const approveAll = () => {
    if (!name.trim()) return askForName();
    start(async () => {
      try {
        const { approved } = await guestApprovePage(token, pageSlug, name.trim());
        toast(approved ? `Approved ${approved === 1 ? "1 section" : `${approved} sections`}` : "Nothing left to approve here", { tone: "done" });
      } catch (err) {
        toast(message(err, "Could not approve"), { tone: "late" });
      }
    });
  };
  return (
    <Button size="sm" icon="check-circle" loading={pending} onClick={approveAll}>
      Approve all {count}
    </Button>
  );
}
