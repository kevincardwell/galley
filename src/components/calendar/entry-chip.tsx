"use client";
import Link from "next/link";
import type { CSSProperties, HTMLAttributes, SyntheticEvent } from "react";
import { clsx } from "@/lib/clsx";
import { formatTime } from "@/lib/dates";
import type { CalendarEntry } from "./types";

/** dnd-kit's listeners are bare Functions; this is the shape a chip can actually spread on an element. */
export type ChipDrag = {
  ref?: (el: HTMLElement | null) => void;
  handlers?: Record<string, (e: SyntheticEvent) => void>;
  attributes?: HTMLAttributes<HTMLElement>;
  dragging?: boolean;
};

type Props = {
  entry: CalendarEntry;
  /** Given for schedule items on a project calendar, where a click opens the edit dialog. */
  onOpen?: (entry: CalendarEntry) => void;
  drag?: ChipDrag;
  className?: string;
};

const tint = (accent: string, mix: number): CSSProperties => ({
  ["--dot" as string]: accent,
  background: `color-mix(in oklab, ${accent} ${mix}%, var(--surface))`,
});

const base =
  "flex w-full cursor-pointer items-center gap-1.5 overflow-hidden rounded-[4px] border border-transparent px-1 py-[3px] text-left text-xs transition-[background-color,border-color,filter] duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent";

/** The mark that tells a due date from a booking at a glance: a dot for tasks, a bar for items. */
function Mark({ entry }: { entry: CalendarEntry }) {
  return entry.kind === "task" ? (
    <span aria-hidden className="size-1.5 shrink-0 rounded-full" style={{ background: entry.accent }} />
  ) : (
    <span aria-hidden className="h-3 w-[3px] shrink-0 rounded-full" style={{ background: entry.accent }} />
  );
}

function Body({ entry }: { entry: CalendarEntry }) {
  return (
    <>
      <Mark entry={entry} />
      {!entry.allDay && <span className="tnum shrink-0 text-ink-3">{formatTime(entry.start)}</span>}
      <span className={clsx("truncate", entry.status === "done" && "text-ink-3 line-through")}>{entry.title}</span>
    </>
  );
}

/** One entry in a month cell. Tasks link to the task; items open their dialog, or link to the project that owns them. */
export function EntryChip({ entry, onOpen, drag, className }: Props) {
  const item = entry.kind === "item";
  const style = item ? tint(entry.accent, 14) : undefined;
  const classes = clsx(
    base,
    item ? "hover:border-line hover:brightness-95" : "hover:bg-surface-2",
    drag?.dragging && "opacity-40",
    className,
  );
  const label = `${entry.title}, ${entry.workspaceName}`;

  if (item && onOpen) {
    return (
      <button
        type="button"
        ref={drag?.ref}
        style={style}
        className={classes}
        title={label}
        onClick={() => onOpen(entry)}
        {...drag?.attributes}
        {...drag?.handlers}
      >
        <Body entry={entry} />
      </button>
    );
  }
  return (
    <Link href={entry.href} ref={drag?.ref} style={style} className={classes} title={label} {...drag?.attributes} {...drag?.handlers}>
      <Body entry={entry} />
    </Link>
  );
}

/** What follows the cursor during a drag. */
export function ChipOverlay({ entry }: { entry: CalendarEntry }) {
  return (
    <span
      className={clsx(base, "w-48 cursor-grabbing border-line bg-surface shadow-panel")}
      style={entry.kind === "item" ? tint(entry.accent, 14) : undefined}
    >
      <Body entry={entry} />
    </span>
  );
}
