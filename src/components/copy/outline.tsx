"use client";
import { useEffect, useRef, useState, useTransition, type KeyboardEvent } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { clsx } from "@/lib/clsx";
import { createPage, createSection, deletePage, deleteSection, renamePage, renameSection } from "@/actions/copy";
import { pageTone, statusTone, type PageRow, type SectionRow } from "@/lib/copy/types";
import { StatusDot } from "./status-dot";

type Editing = { kind: "page" | "section"; id: string } | null;
type Adding = "page" | "section" | null;

type Props = {
  slug: string;
  workspaceId: string;
  pages: PageRow[];
  currentPageId: string;
  sections: Pick<SectionRow, "id" | "title" | "status">[];
  activeId: string | null;
  readOnly: boolean;
  onSelect: (id: string) => void;
  onSectionCreated: (id: string) => void;
};

/** Left column: every page, with the current page's sections nested under it. */
export function Outline({ slug, workspaceId, pages, currentPageId, sections, activeId, readOnly, onSelect, onSectionCreated }: Props) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [editing, setEditing] = useState<Editing>(null);
  const [adding, setAdding] = useState<Adding>(null);

  const commitRename = (kind: "page" | "section", id: string, value: string, original: string) => {
    setEditing(null);
    const title = value.trim();
    if (!title || title === original) return;
    start(async () => {
      if (kind === "page") {
        const { slug: next } = await renamePage(id, title);
        if (id === currentPageId && next !== pages.find((p) => p.id === id)?.slug) router.replace(`/w/${slug}/copy/${next}`);
      } else {
        await renameSection(id, title);
      }
    });
  };

  const commitAdd = (kind: "page" | "section", value: string) => {
    setAdding(null);
    const title = value.trim();
    if (!title) return;
    start(async () => {
      if (kind === "page") {
        const { slug: next } = await createPage(workspaceId, title);
        router.push(`/w/${slug}/copy/${next}`);
      } else {
        const { id } = await createSection(currentPageId, title);
        onSectionCreated(id);
      }
    });
  };

  const remove = (kind: "page" | "section", id: string, title: string) => {
    if (!window.confirm(`Delete “${title}”? This cannot be undone.`)) return;
    setEditing(null);
    start(async () => {
      if (kind === "page") {
        await deletePage(id);
        const other = pages.find((p) => p.id !== id);
        router.replace(other ? `/w/${slug}/copy/${other.slug}` : `/w/${slug}/copy`);
      } else {
        await deleteSection(id);
      }
    });
  };

  return (
    <div className="outline border-line bg-surface px-2 py-4 min-[900px]:min-h-0 min-[900px]:overflow-y-auto min-[900px]:border-r max-[899px]:border-b">
      <h3 className="m-0 mb-2 px-2 text-xs font-medium text-ink-3">Pages</h3>
      <ul className="m-0 list-none p-0">
        {pages.map((p) => {
          const current = p.id === currentPageId;
          return (
            <li key={p.id}>
              {editing?.kind === "page" && editing.id === p.id ? (
                <InlineInput
                  defaultValue={p.title}
                  onCommit={(v) => commitRename("page", p.id, v, p.title)}
                  onCancel={() => setEditing(null)}
                  onDelete={pages.length > 1 ? () => remove("page", p.id, p.title) : undefined}
                />
              ) : (
                <Link
                  href={`/w/${slug}/copy/${p.slug}`}
                  onDoubleClick={(e) => {
                    if (readOnly) return;
                    e.preventDefault();
                    setEditing({ kind: "page", id: p.id });
                  }}
                  className={clsx("flex items-center justify-between gap-2 rounded-r px-2 py-[5px] transition-colors", current ? "bg-accent-soft text-ink" : "text-ink-2 hover:bg-surface-2 hover:text-ink")}
                  aria-current={current ? "page" : undefined}
                  title={readOnly ? undefined : "Double-click to rename"}
                >
                  <span className="truncate">{p.title}</span>
                  <StatusDot tone={pageTone(p.counts)} />
                </Link>
              )}
              {current && (
                <ul className="mb-1 ml-3 mt-0.5 list-none border-l border-line-2 p-0">
                  {sections.map((s) => (
                    <li key={s.id}>
                      {editing?.kind === "section" && editing.id === s.id ? (
                        <InlineInput
                          small
                          defaultValue={s.title}
                          onCommit={(v) => commitRename("section", s.id, v, s.title)}
                          onCancel={() => setEditing(null)}
                          onDelete={() => remove("section", s.id, s.title)}
                        />
                      ) : (
                        <button
                          type="button"
                          onClick={() => onSelect(s.id)}
                          onDoubleClick={() => !readOnly && setEditing({ kind: "section", id: s.id })}
                          className={clsx("flex w-full items-center justify-between gap-2 rounded-r px-2 py-[3px] text-left text-[13px] transition-colors", s.id === activeId ? "bg-accent-soft text-ink" : "text-ink-2 hover:bg-surface-2 hover:text-ink")}
                          aria-current={s.id === activeId ? "true" : undefined}
                        >
                          <span className="truncate">{s.title}</span>
                          <StatusDot tone={statusTone(s.status)} />
                        </button>
                      )}
                    </li>
                  ))}
                  {!readOnly && (
                    <li>
                      {adding === "section" ? (
                        <InlineInput small placeholder="Section title" onCommit={(v) => commitAdd("section", v)} onCancel={() => setAdding(null)} />
                      ) : (
                        <button type="button" disabled={pending} onClick={() => setAdding("section")} className="w-full rounded-r px-2 py-[3px] text-left text-[13px] text-ink-3 hover:bg-surface-2 hover:text-ink">
                          + Add section
                        </button>
                      )}
                    </li>
                  )}
                </ul>
              )}
            </li>
          );
        })}
      </ul>
      {!readOnly && (
        <div className="mt-2">
          {adding === "page" ? (
            <InlineInput placeholder="Page title" onCommit={(v) => commitAdd("page", v)} onCancel={() => setAdding(null)} />
          ) : (
            <button type="button" disabled={pending} onClick={() => setAdding("page")} className="w-full rounded-r px-2 py-[5px] text-left text-ink-3 hover:bg-surface-2 hover:text-ink">
              + Add page
            </button>
          )}
        </div>
      )}
    </div>
  );
}

function InlineInput({
  defaultValue = "",
  placeholder,
  small,
  onCommit,
  onCancel,
  onDelete,
}: {
  defaultValue?: string;
  placeholder?: string;
  small?: boolean;
  onCommit: (value: string) => void;
  onCancel: () => void;
  onDelete?: () => void;
}) {
  const ref = useRef<HTMLInputElement>(null);
  const done = useRef(false);
  useEffect(() => {
    ref.current?.focus();
    ref.current?.select();
  }, []);
  const finish = (commit: boolean) => {
    if (done.current) return;
    done.current = true;
    if (commit) onCommit(ref.current?.value ?? "");
    else onCancel();
  };
  const onKey = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter") finish(true);
    if (e.key === "Escape") finish(false);
  };
  return (
    <div className="flex items-center gap-1 px-1">
      <input
        ref={ref}
        defaultValue={defaultValue}
        placeholder={placeholder}
        onKeyDown={onKey}
        onBlur={() => setTimeout(() => finish(true), 0)}
        className={clsx("min-w-0 flex-1 rounded-r border border-accent-line bg-surface px-1.5 py-0.5 text-ink outline-none", small && "text-[13px]")}
        aria-label={placeholder ?? "Rename"}
      />
      {onDelete && (
        <button type="button" onMouseDown={(e) => e.preventDefault()} onClick={onDelete} title="Delete" aria-label="Delete" className="grid size-6 shrink-0 place-items-center rounded-r text-ink-3 hover:bg-late-soft hover:text-late">
          <svg width="12" height="12" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"><path d="M2 2l8 8M10 2l-8 8" /></svg>
        </button>
      )}
    </div>
  );
}
