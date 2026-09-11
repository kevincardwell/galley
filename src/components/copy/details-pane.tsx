"use client";
import { useState, useTransition, type KeyboardEvent } from "react";
import type { SectionStatus } from "@/db/schema";
import { clsx } from "@/lib/clsx";
import { timeAgo } from "@/lib/format";
import { Avatar } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Pill } from "@/components/ui/pill";
import { Textarea } from "@/components/ui/field";
import { AttachPicker } from "@/components/assets/attach-picker";
import { addComment, renameSection, resolveComment, restoreVersion, setSectionStatus } from "@/actions/copy";
import { STATUS_LABEL, statusTone, type SectionDetails, type SectionRow } from "@/lib/copy/types";
import type { SaveState, Stats } from "./section-editor";

type Props = {
  workspaceId: string;
  section: SectionRow | null;
  details: SectionDetails | null;
  saveState: SaveState;
  stats: Stats | null;
  readOnly: boolean;
  selfName: string;
  onCopyMarkdown: () => Promise<boolean>;
  onSaveNow: () => Promise<void>;
};

const SAVE_LABEL: Record<SaveState, string> = { idle: "", dirty: "Unsaved", saving: "Saving…", saved: "Saved", conflict: "Conflict", error: "Could not save" };
const STATUSES: SectionStatus[] = ["draft", "review", "approved"];

/** Right column: everything about the active section that is not the words themselves. */
export function DetailsPane({ workspaceId, section, details, saveState, stats, readOnly, selfName, onCopyMarkdown, onSaveNow }: Props) {
  const [pending, start] = useTransition();
  const [copied, setCopied] = useState(false);

  if (!section) {
    return (
      <aside className="details border-line bg-surface-2 p-4 text-ink-3 min-[900px]:min-h-0 min-[900px]:overflow-y-auto min-[900px]:border-l max-[899px]:border-t">
        <p className="m-0">Pick a section to see its status, history and comments.</p>
      </aside>
    );
  }

  const words = stats?.words ?? section.wordCount;
  const chars = stats?.chars ?? 0;
  const who = section.updatedByName === selfName ? "You" : section.updatedByName ?? "Someone";
  const approved = section.status === "approved";

  const copyMd = async () => {
    if (await onCopyMarkdown()) {
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    }
  };

  const setStatus = (status: SectionStatus) => {
    if (status === section.status) return;
    start(async () => {
      await onSaveNow();
      await setSectionStatus(section.id, status);
    });
  };

  return (
    <aside className="details flex flex-col gap-5 border-line bg-surface-2 p-4 min-[900px]:min-h-0 min-[900px]:overflow-y-auto min-[900px]:border-l max-[899px]:border-t">
      <div>
        <div className="mb-2 flex items-baseline justify-between gap-2">
          <TitleField key={section.id} id={section.id} title={section.title} readOnly={readOnly} />
          <span className={clsx("tnum shrink-0 text-xs", saveState === "conflict" || saveState === "error" ? "text-review" : "text-ink-3")} aria-live="polite">
            {SAVE_LABEL[saveState]}
          </span>
        </div>
        <dl className="tnum m-0 grid grid-cols-[auto_1fr] gap-x-3 gap-y-1.5 text-[13px]">
          <dt className="m-0 text-ink-2">Status</dt>
          <dd className="m-0">
            {readOnly ? (
              <Pill tone={statusTone(section.status)}>{STATUS_LABEL[section.status]}</Pill>
            ) : (
              <div role="radiogroup" aria-label="Status" className="inline-flex overflow-hidden rounded-r border border-line bg-surface">
                {STATUSES.map((s) => {
                  const on = s === section.status;
                  const tone = statusTone(s);
                  return (
                    <button
                      key={s}
                      type="button"
                      role="radio"
                      aria-checked={on}
                      disabled={pending}
                      onClick={() => setStatus(s)}
                      className={clsx(
                        "flex items-center gap-1.5 border-r border-line px-2 py-[3px] text-xs font-medium transition-colors last:border-r-0",
                        on ? (tone === "done" ? "bg-done-soft text-done" : tone === "review" ? "bg-review-soft text-review" : "bg-surface-2 text-ink") : "text-ink-2 hover:bg-surface-2",
                      )}
                    >
                      <span className={clsx("size-1.5 rounded-full", on ? "bg-current" : "bg-ink-3")} />
                      {STATUS_LABEL[s]}
                    </button>
                  );
                })}
              </div>
            )}
          </dd>
          <dt className="m-0 text-ink-2">Words</dt>
          <dd className="m-0">{words}</dd>
          <dt className="m-0 text-ink-2">Characters</dt>
          <dd className="m-0">{chars}</dd>
          <dt className="m-0 text-ink-2">Last edit</dt>
          <dd className="m-0">
            {who}, {timeAgo(section.updatedAt)}
          </dd>
        </dl>
      </div>

      <Versions key={`v-${section.id}`} sectionId={section.id} current={section.version} versions={details?.versions ?? []} readOnly={readOnly} selfName={selfName} />

      <Comments key={`c-${section.id}`} sectionId={section.id} comments={details?.comments ?? []} readOnly={readOnly} selfName={selfName} />

      <div>
        <h3 className="m-0 mb-2 text-xs font-medium text-ink-3">Attachments</h3>
        <AttachPicker workspaceId={workspaceId} sectionId={section.id} attached={details?.attachments ?? []} readOnly={readOnly} />
        {(details?.attachments.length ?? 0) === 0 && readOnly && <p className="m-0 text-[13px] text-ink-3">No files attached.</p>}
      </div>

      <div className="mt-auto flex gap-2 pt-2">
        <Button className="flex-1" onClick={copyMd}>{copied ? "Copied" : "Copy as Markdown"}</Button>
        {!readOnly && (
          <Button className="flex-1" variant={approved ? "default" : "primary"} disabled={pending} onClick={() => setStatus(approved ? "draft" : "approved")}>
            {approved ? "Back to draft" : "Approve"}
          </Button>
        )}
      </div>
    </aside>
  );
}

function TitleField({ id, title, readOnly }: { id: string; title: string; readOnly: boolean }) {
  const [value, setValue] = useState(title);
  const [prevTitle, setPrevTitle] = useState(title);
  const [, start] = useTransition();
  if (prevTitle !== title) {
    // Renamed elsewhere (outline, another tab): adopt the new title.
    setPrevTitle(title);
    setValue(title);
  }
  const commit = () => {
    const t = value.trim();
    if (!t || t === title) {
      setValue(title);
      return;
    }
    start(() => renameSection(id, t));
  };
  const onKey = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter") (e.target as HTMLInputElement).blur();
    if (e.key === "Escape") {
      setValue(title);
      (e.target as HTMLInputElement).blur();
    }
  };
  if (readOnly) return <h3 className="m-0 truncate text-sm font-semibold">{title}</h3>;
  return (
    <input
      value={value}
      onChange={(e) => setValue(e.target.value)}
      onBlur={commit}
      onKeyDown={onKey}
      aria-label="Section title"
      className="-mx-1.5 min-w-0 flex-1 rounded-r border border-transparent bg-transparent px-1.5 py-0.5 text-sm font-semibold text-ink outline-none transition-colors hover:border-line focus:border-accent-line focus:bg-surface"
    />
  );
}

function Versions({ sectionId, current, versions, readOnly, selfName }: { sectionId: string; current: number; versions: SectionDetails["versions"]; readOnly: boolean; selfName: string }) {
  const [pending, start] = useTransition();
  const [confirmId, setConfirmId] = useState<string | null>(null);
  const name = (n: string | null) => (n === selfName ? "You" : n ?? "Someone");
  return (
    <div>
      <h3 className="m-0 mb-2 text-xs font-medium text-ink-3">Versions</h3>
      {versions.length === 0 ? (
        <p className="m-0 text-[13px] text-ink-3">No saves yet.</p>
      ) : (
        <ul className="m-0 flex list-none flex-col gap-1.5 p-0 text-[13px] text-ink-2">
          {versions.map((v, i) => {
            const isCurrent = i === 0 || v.version === current;
            return (
              <li key={v.id} className="flex min-h-6 items-center justify-between gap-2">
                <span className={clsx("truncate", isCurrent && "font-medium text-ink")}>{isCurrent ? "Current" : name(v.authorName)}</span>
                <span className="tnum flex shrink-0 items-center gap-2 text-ink-3">
                  <span>{timeAgo(v.createdAt)}</span>
                  {!isCurrent && !readOnly && (
                    confirmId === v.id ? (
                      <span className="flex items-center gap-1">
                        <button
                          type="button"
                          disabled={pending}
                          onClick={() => start(async () => { await restoreVersion(sectionId, v.id); setConfirmId(null); })}
                          className="font-medium text-accent hover:underline"
                        >
                          Restore?
                        </button>
                        <button type="button" onClick={() => setConfirmId(null)} className="text-ink-3 hover:text-ink">No</button>
                      </span>
                    ) : (
                      <button type="button" onClick={() => setConfirmId(v.id)} className="text-ink-3 hover:text-accent">Restore</button>
                    )
                  )}
                </span>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}

function Comments({ sectionId, comments, readOnly, selfName }: { sectionId: string; comments: SectionDetails["comments"]; readOnly: boolean; selfName: string }) {
  const [pending, start] = useTransition();
  const [body, setBody] = useState("");
  const open = comments.filter((c) => !c.resolvedAt);
  const resolved = comments.filter((c) => c.resolvedAt);
  const submit = () => {
    const text = body.trim();
    if (!text) return;
    start(async () => {
      await addComment(sectionId, text);
      setBody("");
    });
  };
  const onKey = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if ((e.metaKey || e.ctrlKey) && e.key === "Enter") {
      e.preventDefault();
      submit();
    }
  };
  const item = (c: SectionDetails["comments"][number]) => (
    <li key={c.id} className={clsx("rounded-r border border-line bg-surface p-2.5 text-[13px]", c.resolvedAt ? "opacity-60" : null)}>
      <div className="mb-1.5 flex items-center gap-2 text-ink-2">
        <Avatar name={c.authorName ?? "?"} size={18} muted={c.authorName !== selfName} />
        <span className="truncate">{c.authorName ?? "Someone"}</span>
        <span className="tnum ml-auto shrink-0 text-xs text-ink-3">{timeAgo(c.createdAt)}</span>
      </div>
      <p className="m-0 whitespace-pre-wrap">{c.body}</p>
      {!readOnly && (
        <div className="mt-2 flex gap-2.5 text-xs font-medium">
          <button type="button" disabled={pending} onClick={() => start(() => resolveComment(c.id))} className="text-accent hover:underline">
            {c.resolvedAt ? "Reopen" : "Resolve"}
          </button>
        </div>
      )}
    </li>
  );
  return (
    <div>
      <h3 className="m-0 mb-2 text-xs font-medium text-ink-3">Comments</h3>
      {comments.length === 0 && <p className="m-0 mb-2 text-[13px] text-ink-3">{readOnly ? "No comments." : "Nothing yet. Leave a note for the writer."}</p>}
      <ul className="m-0 flex list-none flex-col gap-2 p-0">
        {open.map(item)}
        {resolved.map(item)}
      </ul>
      {!readOnly && (
        <div className="mt-2 flex flex-col gap-1.5">
          <Textarea value={body} onChange={(e) => setBody(e.target.value)} onKeyDown={onKey} placeholder="Add a comment" className="min-h-16 text-[13px]" aria-label="New comment" />
          {body.trim() && (
            <div className="flex justify-end">
              <Button size="sm" disabled={pending} onClick={submit}>Comment</Button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
