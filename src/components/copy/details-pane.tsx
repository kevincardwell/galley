"use client";
import { useState, useTransition, type KeyboardEvent } from "react";
import type { SectionStatus } from "@/db/schema";
import { clsx } from "@/lib/clsx";
import { timeAgo } from "@/lib/format";
import { Avatar } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Icon } from "@/components/ui/icon";
import { Pill } from "@/components/ui/pill";
import { Stat } from "@/components/ui/stat";
import { Textarea } from "@/components/ui/field";
import { toast } from "@/components/ui/toast";
import { AttachPicker } from "@/components/assets/attach-picker";
import { VersionDiff } from "./version-diff";
import { tiptapToText } from "@/lib/copy/serialize";
import { addComment, renameSection, resolveComment, restoreVersion, setSectionClientWrite, setSectionStatus } from "@/actions/copy";
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

const PANE = "details flex min-w-0 flex-col overflow-x-hidden border-line bg-surface-2 min-[900px]:min-h-0 min-[900px]:overflow-y-auto min-[900px]:border-l max-[899px]:border-t";

/** Right column: everything about the active section that is not the words themselves. */
export function DetailsPane({ workspaceId, section, details, saveState, stats, readOnly, selfName, onCopyMarkdown, onSaveNow }: Props) {
  const [pending, start] = useTransition();
  const [copied, setCopied] = useState(false);
  // Optimistic so the box flips at once; the server value wins after revalidation.
  const [clientWrites, setClientWrites] = useState(!!details?.clientCanWrite);
  const [prevWrites, setPrevWrites] = useState(!!details?.clientCanWrite);
  if (prevWrites !== !!details?.clientCanWrite) {
    setPrevWrites(!!details?.clientCanWrite);
    setClientWrites(!!details?.clientCanWrite);
  }

  if (!section) {
    return (
      <aside className={PANE}>
        <p className="m-0 p-4 text-ink-3">Pick a section to see its status, history and comments.</p>
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
      toast("Copied as Markdown");
    } else {
      toast("Could not copy", { tone: "late" });
    }
  };

  const toggleClientWrite = (next: boolean) => {
    setClientWrites(next);
    start(async () => {
      try {
        await setSectionClientWrite(section.id, next);
      } catch {
        setClientWrites(!next);
      }
    });
  };

  const setStatus = (status: SectionStatus) => {
    if (status === section.status) return;
    start(async () => {
      await onSaveNow();
      await setSectionStatus(section.id, status);
    });
  };

  return (
    <aside className={PANE}>
      <div className="flex items-baseline justify-between gap-2 px-4 py-3.5">
        <TitleField key={section.id} id={section.id} title={section.title} readOnly={readOnly} />
        <span className={clsx("tnum shrink-0 text-xs", saveState === "conflict" || saveState === "error" ? "text-review" : "text-ink-3")} aria-live="polite">
          {SAVE_LABEL[saveState]}
        </span>
      </div>

      <Block title="Status">
        {readOnly ? (
          <Pill tone={statusTone(section.status)}>{STATUS_LABEL[section.status]}</Pill>
        ) : (
          <div role="radiogroup" aria-label="Status" className="flex w-full overflow-hidden rounded-r border border-line bg-surface">
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
                    "flex flex-1 cursor-pointer items-center justify-center gap-1.5 border-r border-line px-2 py-1 text-xs font-medium whitespace-nowrap transition-colors duration-150 ease-out last:border-r-0 disabled:cursor-not-allowed",
                    on ? (tone === "done" ? "bg-done-soft text-done" : tone === "review" ? "bg-review-soft text-review" : "bg-surface-2 text-ink") : "text-ink-2 hover:bg-surface-2 hover:text-ink",
                  )}
                >
                  <span className={clsx("size-1.5 rounded-full", on ? "bg-current" : "bg-ink-3")} />
                  {STATUS_LABEL[s]}
                </button>
              );
            })}
          </div>
        )}
        {details?.shareReview && (
          <div className="mt-2.5 min-w-0">
            <p className="m-0 mb-1 text-xs text-ink-3">Client</p>
            {details.clientApprovedAt ? (
              <Pill tone="done" className="max-w-full">
                <span className="truncate">Approved by {details.clientApprovedBy ?? "the client"}, {timeAgo(details.clientApprovedAt)}</span>
              </Pill>
            ) : (
              <p className="m-0 text-[13px] text-ink-3">Not yet approved by client</p>
            )}
            {!readOnly && (
              <label className="mt-2 flex cursor-pointer items-start gap-2 text-[13px]">
                <input
                  type="checkbox"
                  checked={clientWrites}
                  disabled={pending}
                  onChange={(e) => toggleClientWrite(e.target.checked)}
                  className="mt-0.5 size-3.5 shrink-0 cursor-pointer accent-accent"
                />
                <span>
                  They write this one
                  <span className="block text-xs text-ink-3">A box on the share page for their words. Formatting here is replaced by what they type.</span>
                </span>
              </label>
            )}
          </div>
        )}
      </Block>

      <Block title="Progress">
        <div className="flex gap-6">
          <Stat label="Words" value={words} />
          <Stat label="Characters" value={chars} />
        </div>
        <p className="m-0 mt-2.5 flex items-center gap-1.5 text-xs text-ink-3">
          <Icon name="clock" size={13} />
          <span className="truncate">Last edit by {who}, {timeAgo(section.updatedAt)}</span>
        </p>
      </Block>

      <Block title="Versions">
        <Versions key={`v-${section.id}`} sectionId={section.id} current={section.version} currentText={tiptapToText(section.content)} versions={details?.versions ?? []} readOnly={readOnly} selfName={selfName} />
      </Block>

      <Block title="Comments" aside={details?.comments.length ? <span className="tnum text-xs text-ink-3">{details.comments.length}</span> : undefined}>
        <Comments key={`c-${section.id}`} sectionId={section.id} comments={details?.comments ?? []} readOnly={readOnly} selfName={selfName} />
      </Block>

      <Block title="Attachments" aside={details?.attachments.length ? <span className="tnum text-xs text-ink-3">{details.attachments.length}</span> : undefined}>
        <AttachPicker workspaceId={workspaceId} sectionId={section.id} attached={details?.attachments ?? []} readOnly={readOnly} />
        {(details?.attachments.length ?? 0) === 0 && readOnly && <p className="m-0 text-[13px] text-ink-3">No files attached.</p>}
      </Block>

      <div className="mt-auto flex flex-wrap gap-2 border-t border-line-2 bg-surface-2 px-4 py-3 min-[900px]:sticky min-[900px]:bottom-0">
        <Button className="min-w-0 flex-1 basis-32" icon={copied ? "check" : "copy"} onClick={copyMd}><span className="truncate">{copied ? "Copied" : "Copy as Markdown"}</span></Button>
        {!readOnly && (
          <Button className="min-w-0 flex-1 basis-28" variant={approved ? "default" : "primary"} icon={approved ? "undo" : "check"} disabled={pending} onClick={() => setStatus(approved ? "draft" : "approved")}>
            <span className="truncate">{approved ? "Back to draft" : "Approve"}</span>
          </Button>
        )}
      </div>
    </aside>
  );
}

/** One labelled part of the pane: eyebrow, optional figure on the right, content. */
function Block({ title, aside, children }: { title: string; aside?: React.ReactNode; children: React.ReactNode }) {
  return (
    <section className="border-t border-line-2 px-4 py-4">
      <div className="mb-2 flex items-center gap-2">
        <h3 className="m-0 text-xs font-medium text-ink-3">{title}</h3>
        {aside && <div className="ml-auto flex items-center gap-2">{aside}</div>}
      </div>
      {children}
    </section>
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
      className="-mx-1.5 min-w-0 flex-1 rounded-r border border-transparent bg-transparent px-1.5 py-0.5 text-sm font-semibold text-ink outline-none transition-colors duration-150 ease-out hover:border-line focus:border-accent-line focus:bg-surface"
    />
  );
}

function Versions({ sectionId, current, currentText, versions, readOnly, selfName }: { sectionId: string; current: number; currentText: string; versions: SectionDetails["versions"]; readOnly: boolean; selfName: string }) {
  const [pending, start] = useTransition();
  const [confirmId, setConfirmId] = useState<string | null>(null);
  const [openId, setOpenId] = useState<string | null>(null);
  const name = (n: string | null) => (n === selfName ? "You" : n ?? "Someone");
  const opened = openId ? versions.find((v) => v.id === openId) ?? null : null;
  // The newest saved version is the current copy; prefer its stored text so the diff matches what is in history.
  const latest = versions[0];
  const nowText = latest && latest.version === current ? latest.plainText : currentText;
  return (
    <>
      {versions.length === 0 ? (
        <p className="m-0 text-[13px] text-ink-3">No saves yet.</p>
      ) : (
        <ul className="m-0 flex list-none flex-col gap-1.5 p-0 text-[13px] text-ink-2">
          {versions.map((v, i) => {
            const isCurrent = i === 0 || v.version === current;
            return (
              <li key={v.id} className="flex min-h-6 items-center justify-between gap-2">
                {isCurrent ? (
                  <span className="truncate font-medium text-ink">Current</span>
                ) : (
                  <button
                    type="button"
                    onClick={() => setOpenId(v.id)}
                    title={`Compare version ${v.version} with the current copy`}
                    className="-mx-1 min-w-0 cursor-pointer truncate rounded-r px-1 text-left text-ink-2 transition-colors duration-150 ease-out hover:bg-surface hover:text-ink"
                  >
                    <span className="tnum text-ink-3">v{v.version}</span> {name(v.authorName)}
                  </button>
                )}
                <span className="tnum flex shrink-0 items-center gap-2 text-ink-3">
                  <span>{timeAgo(v.createdAt)}</span>
                  {!isCurrent && !readOnly && (
                    confirmId === v.id ? (
                      <span className="flex items-center gap-1">
                        <button
                          type="button"
                          disabled={pending}
                          onClick={() => start(async () => { await restoreVersion(sectionId, v.id); setConfirmId(null); })}
                          className="cursor-pointer font-medium text-accent hover:underline"
                        >
                          Restore?
                        </button>
                        <button type="button" onClick={() => setConfirmId(null)} className="cursor-pointer text-ink-3 hover:text-ink">No</button>
                      </span>
                    ) : (
                      <button type="button" onClick={() => setConfirmId(v.id)} className="cursor-pointer text-ink-3 transition-colors duration-150 ease-out hover:text-accent">Restore</button>
                    )
                  )}
                </span>
              </li>
            );
          })}
        </ul>
      )}
      <VersionDiff sectionId={sectionId} version={opened} currentText={nowText} open={opened !== null} onClose={() => setOpenId(null)} readOnly={readOnly} selfName={selfName} />
    </>
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
        {c.guestName ? (
          <span className="shrink-0 rounded-full border border-line bg-surface-2 px-1.5 text-[10px] font-medium tracking-wide text-ink-3">Client</span>
        ) : (
          <Avatar name={c.authorName ?? "?"} size={18} muted={c.authorName !== selfName} />
        )}
        <span className="truncate">{c.guestName ?? c.authorName ?? "Someone"}</span>
        <span className="tnum ml-auto shrink-0 text-xs text-ink-3">{timeAgo(c.createdAt)}</span>
      </div>
      <p className="m-0 whitespace-pre-wrap">{c.body}</p>
      {!readOnly && (
        <div className="mt-2 flex gap-2.5 text-xs font-medium">
          <button type="button" disabled={pending} onClick={() => start(() => resolveComment(c.id))} className="cursor-pointer text-accent hover:underline disabled:cursor-not-allowed">
            {c.resolvedAt ? "Reopen" : "Resolve"}
          </button>
        </div>
      )}
    </li>
  );
  return (
    <>
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
    </>
  );
}
