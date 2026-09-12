"use client";
import { useEffect, useRef, useState, useTransition, type KeyboardEvent } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { clsx } from "@/lib/clsx";
import { Icon, IconButton } from "@/components/ui/icon";
import { Meter } from "@/components/ui/meter";
import { createPage, createSection, deletePage, deleteSection, renamePage, renameSection } from "@/actions/copy";
import { STATUS_LABEL, pageTone, statusTone, type PageRow, type SectionRow } from "@/lib/copy/types";
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

const PAGE_TONE_LABEL = { done: "All sections approved", review: "Some sections in review", draft: "Still in draft" } as const;

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
          const tone = pageTone(p.counts);
          return (
            <li key={p.id} className="mb-0.5">
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
                  className={clsx(
                    "flex cursor-pointer flex-col gap-1 rounded-r px-2 py-1.5 transition-colors duration-150 ease-out",
                    current ? "bg-accent-soft text-ink" : "text-ink-2 hover:bg-surface-2 hover:text-ink",
                  )}
                  aria-current={current ? "page" : undefined}
                  title={readOnly ? undefined : "Double-click to rename"}
                >
                  <span className="flex items-center gap-2">
                    <Icon name="text" size={14} className={current ? "text-accent" : "text-ink-3"} />
                    <span className="min-w-0 flex-1 truncate">{p.title}</span>
                    <StatusDot tone={tone} title={PAGE_TONE_LABEL[tone]} />
                  </span>
                  {p.counts.total > 0 && (
                    <div className="flex items-center gap-1.5 pl-[22px]">
                      <Meter
                        value={p.counts.approved}
                        max={p.counts.total}
                        tone={p.counts.approved === p.counts.total ? "done" : "accent"}
                        label={`${p.title}: ${p.counts.approved} of ${p.counts.total} sections approved`}
                        className="min-w-0 flex-1"
                        height={3}
                      />
                      <span className="tnum text-[11px] text-ink-3">{p.counts.approved}/{p.counts.total}</span>
                    </div>
                  )}
                </Link>
              )}
              {current && (
                <ul className="mt-1 mb-1 ml-3 list-none border-l border-line-2 p-0">
                  {sections.map((s) => {
                    const active = s.id === activeId;
                    return (
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
                            className={clsx(
                              "-ml-px flex w-full cursor-pointer items-center justify-between gap-2 rounded-r border-l-2 px-2 py-1 text-left text-[13px] transition-colors duration-150 ease-out",
                              active ? "border-accent bg-accent-soft font-medium text-ink" : "border-transparent text-ink-2 hover:bg-surface-2 hover:text-ink",
                            )}
                            aria-current={active ? "true" : undefined}
                          >
                            <span className="truncate">{s.title}</span>
                            <StatusDot tone={statusTone(s.status)} title={STATUS_LABEL[s.status]} />
                          </button>
                        )}
                      </li>
                    );
                  })}
                  {!readOnly && (
                    <li>
                      {adding === "section" ? (
                        <InlineInput small placeholder="Section title" onCommit={(v) => commitAdd("section", v)} onCancel={() => setAdding(null)} />
                      ) : (
                        <button
                          type="button"
                          disabled={pending}
                          onClick={() => setAdding("section")}
                          className="ml-0.5 flex w-full cursor-pointer items-center gap-1.5 rounded-r px-2 py-1 text-left text-[13px] text-ink-3 transition-colors duration-150 ease-out hover:bg-surface-2 hover:text-ink disabled:cursor-not-allowed disabled:opacity-50"
                        >
                          <Icon name="plus" size={13} />
                          Add section
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
            <button
              type="button"
              disabled={pending}
              onClick={() => setAdding("page")}
              className="flex w-full cursor-pointer items-center gap-2 rounded-r px-2 py-1.5 text-left text-ink-3 transition-colors duration-150 ease-out hover:bg-surface-2 hover:text-ink disabled:cursor-not-allowed disabled:opacity-50"
            >
              <Icon name="plus" size={14} />
              Add page
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
        className={clsx("min-w-0 flex-1 rounded-r border border-accent-line bg-surface px-1.5 py-0.5 text-ink outline-none focus:ring-2 focus:ring-accent", small && "text-[13px]")}
        aria-label={placeholder ?? "Rename"}
      />
      {onDelete && (
        <IconButton name="trash" size={13} tone="danger" label="Delete" title="Delete" onMouseDown={(e) => e.preventDefault()} onClick={onDelete} />
      )}
    </div>
  );
}
