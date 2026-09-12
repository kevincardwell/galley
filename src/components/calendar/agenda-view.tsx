"use client";
import Link from "next/link";
import { clsx } from "@/lib/clsx";
import { Avatar } from "@/components/ui/avatar";
import { Icon } from "@/components/ui/icon";
import { formatDate, formatDayLabel, formatRange } from "@/lib/dates";
import type { DayGroup } from "./util";
import type { CalendarEntry } from "./types";

type Props = {
  groups: DayGroup[];
  today: Date;
  todayIso: string;
  showProject: boolean;
  onOpenItem?: (entry: CalendarEntry) => void;
  empty: React.ReactNode;
  /** Off inside the day dialog, where the dialog title already names the day. */
  headings?: boolean;
};

/** The list view: every day that has something on it, in order. Also the whole calendar below 700px. */
export function AgendaView({ groups, today, todayIso, showProject, onOpenItem, empty, headings = true }: Props) {
  if (groups.length === 0) return <>{empty}</>;
  return (
    <div className="flex flex-col gap-5">
      {groups.map((group) => (
        <section key={group.iso} className="flex flex-col gap-1">
          {headings && (
            <h2 className="m-0 flex items-baseline gap-2 text-sm font-semibold">
              <span className={clsx(group.iso === todayIso && "text-accent")}>{formatDayLabel(group.date, today)}</span>
              {["Today", "Tomorrow", "Yesterday"].includes(formatDayLabel(group.date, today)) && (
                <span className="text-xs font-normal text-ink-3">{formatDate(group.date, today)}</span>
              )}
            </h2>
          )}
          <ul className="m-0 flex list-none flex-col border-t border-line-2 p-0">
            {group.entries.map((entry) => (
              <li key={`${entry.kind}-${entry.id}`}>
                <AgendaRow entry={entry} showProject={showProject} onOpenItem={onOpenItem} />
              </li>
            ))}
          </ul>
        </section>
      ))}
    </div>
  );
}

function AgendaRow({ entry, showProject, onOpenItem }: { entry: CalendarEntry; showProject: boolean; onOpenItem?: (entry: CalendarEntry) => void }) {
  const classes =
    "flex w-full cursor-pointer items-center gap-3 border-b border-line-2 px-2 py-2.5 text-left transition-colors duration-150 hover:bg-surface-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent";
  const body = (
    <>
      <span className="tnum w-[104px] shrink-0 text-[13px] text-ink-2">{formatRange(entry.start, entry.end, entry.allDay)}</span>
      <span
        aria-hidden
        className={clsx("shrink-0", entry.kind === "task" ? "size-1.5 rounded-full" : "h-3.5 w-[3px] rounded-full")}
        style={{ background: entry.accent }}
      />
      <span className="flex min-w-0 flex-1 flex-col">
        <span className={clsx("truncate font-medium", entry.status === "done" && "text-ink-3 line-through")}>{entry.title}</span>
        <span className="flex min-w-0 items-center gap-2.5 text-xs text-ink-3">
          {showProject && <span className="truncate">{entry.workspaceName}</span>}
          {entry.kind === "task" && <span className="whitespace-nowrap">Task due</span>}
          {entry.location && (
            <span className="flex min-w-0 items-center gap-1">
              <Icon name="pin" size={11} />
              <span className="truncate">{entry.location}</span>
            </span>
          )}
        </span>
      </span>
      {entry.ownerName && <Avatar name={entry.ownerName} size={22} muted />}
      <Icon name="chevron-right" size={14} className="text-ink-3" />
    </>
  );
  if (entry.kind === "item" && onOpenItem) {
    return (
      <button type="button" className={classes} onClick={() => onOpenItem(entry)}>
        {body}
      </button>
    );
  }
  return (
    <Link href={entry.href} className={classes}>
      {body}
    </Link>
  );
}
