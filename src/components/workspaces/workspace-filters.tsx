"use client";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState, useTransition } from "react";
import { clsx } from "@/lib/clsx";
import { Icon, IconButton } from "@/components/ui/icon";
import { Input } from "@/components/ui/field";

export const WORKSPACE_FILTERS = [
  { value: "", label: "All" },
  { value: "planning", label: "Planning" },
  { value: "building", label: "Building" },
  { value: "review", label: "In review" },
  { value: "live", label: "Live" },
] as const;

/** Builds the index URL for a filter state. Everything here stays in the query string so it is linkable. */
export function workspacesHref({ q, status, archived }: { q?: string; status?: string; archived?: boolean }) {
  const p = new URLSearchParams();
  if (q) p.set("q", q);
  if (status) p.set("status", status);
  if (archived) p.set("archived", "1");
  const s = p.toString();
  return s ? `/?${s}` : "/";
}

const CHIP =
  "cursor-pointer rounded-full border px-2.5 py-1 text-xs font-medium transition-colors duration-150 ease-out focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent";
const CHIP_ON = "border-accent-line bg-accent-soft text-accent";
const CHIP_OFF = "border-line text-ink-2 hover:border-ink-3 hover:text-ink";

export function WorkspaceFilters({ q, status, archived }: { q: string; status: string; archived: boolean }) {
  const router = useRouter();
  const [, start] = useTransition();
  const [text, setText] = useState(q);
  // The URL is the source of truth: if it changes elsewhere (back button, chip click), follow it.
  const [seen, setSeen] = useState(q);
  if (seen !== q) {
    setSeen(q);
    setText(q);
  }

  useEffect(() => {
    if (text.trim() === q) return;
    const t = setTimeout(() => {
      start(() => router.replace(workspacesHref({ q: text.trim(), status, archived }), { scroll: false }));
    }, 250);
    return () => clearTimeout(t);
  }, [text, q, status, archived, router]);

  return (
    <form
      method="get"
      action="/"
      role="search"
      onSubmit={(e) => {
        e.preventDefault();
        start(() => router.replace(workspacesHref({ q: text.trim(), status, archived }), { scroll: false }));
      }}
      className="mb-4 flex flex-wrap items-center gap-x-3 gap-y-2"
    >
      <div className="relative min-w-52 flex-1 sm:max-w-72">
        <Icon name="search" size={15} className="pointer-events-none absolute top-1/2 left-2.5 -translate-y-1/2 text-ink-3" />
        <Input
          name="q"
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder="Search workspaces"
          aria-label="Search workspaces"
          className="pl-8 text-[13px]"
        />
        {text && (
          <IconButton
            name="x"
            label="Clear search"
            size={14}
            onClick={() => setText("")}
            className="absolute top-1/2 right-1 size-6 -translate-y-1/2"
          />
        )}
      </div>
      {status && <input type="hidden" name="status" value={status} />}
      {archived && <input type="hidden" name="archived" value="1" />}

      <div className="flex flex-wrap items-center gap-1">
        {WORKSPACE_FILTERS.map((f) => {
          const on = status === f.value;
          return (
            <Link
              key={f.value || "all"}
              href={workspacesHref({ q, status: f.value, archived })}
              scroll={false}
              aria-current={on ? "true" : undefined}
              className={clsx(CHIP, on ? CHIP_ON : CHIP_OFF)}
            >
              {f.label}
            </Link>
          );
        })}
      </div>

      <Link
        href={workspacesHref({ q, status, archived: !archived })}
        scroll={false}
        aria-current={archived ? "true" : undefined}
        className={clsx(CHIP, "inline-flex items-center gap-1.5", archived ? CHIP_ON : CHIP_OFF)}
      >
        <Icon name={archived ? "check" : "archive"} size={13} />
        Show archived
      </Link>
    </form>
  );
}
