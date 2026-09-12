"use client";
import { useDraggable, useDroppable } from "@dnd-kit/core";
import type { SyntheticEvent } from "react";
import { clsx } from "@/lib/clsx";
import { WEEKDAYS, type MonthDay } from "@/lib/dates";
import { IconButton } from "@/components/ui/icon";
import { EntryChip, type ChipDrag } from "./entry-chip";
import type { CalendarEntry } from "./types";

/** Chips a cell shows before it collapses the rest into "+n more". */
const MAX_CHIPS = 3;

export const DAY_DROP_PREFIX = "day:";
export const ENTRY_DRAG_PREFIX = "entry:";

export const dayDropId = (iso: string) => `${DAY_DROP_PREFIX}${iso}`;
export const entryDragId = (entry: CalendarEntry) => `${ENTRY_DRAG_PREFIX}${entry.kind}:${entry.id}`;

type Props = {
  weeks: MonthDay[][];
  byDay: Map<string, CalendarEntry[]>;
  /** Workspaces the caller may edit: only their entries can be dragged. */
  editable: ReadonlySet<string>;
  canAdd: boolean;
  onOpenItem?: (entry: CalendarEntry) => void;
  onOpenDay: (iso: string) => void;
  onAdd?: (iso: string) => void;
};

export function MonthView({ weeks, byDay, editable, canAdd, onOpenItem, onOpenDay, onAdd }: Props) {
  return (
    <div className="flex min-w-0 flex-col">
      <div className="grid grid-cols-7 px-px pb-1.5">
        {WEEKDAYS.map((d) => (
          <div key={d} className="text-xs font-medium text-ink-3">{d}</div>
        ))}
      </div>
      <div className="grid grid-cols-7 gap-px overflow-hidden rounded-lg border border-line bg-line">
        {weeks.flat().map((day) => (
          <DayCell
            key={day.iso}
            day={day}
            entries={byDay.get(day.iso) ?? []}
            editable={editable}
            canAdd={canAdd}
            onOpenItem={onOpenItem}
            onOpenDay={onOpenDay}
            onAdd={onAdd}
          />
        ))}
      </div>
    </div>
  );
}

type CellProps = {
  day: MonthDay;
  entries: CalendarEntry[];
  editable: ReadonlySet<string>;
  canAdd: boolean;
  onOpenItem?: (entry: CalendarEntry) => void;
  onOpenDay: (iso: string) => void;
  onAdd?: (iso: string) => void;
};

function DayCell({ day, entries, editable, canAdd, onOpenItem, onOpenDay, onAdd }: CellProps) {
  const { setNodeRef, isOver } = useDroppable({ id: dayDropId(day.iso), disabled: editable.size === 0 });
  const overflowing = entries.length > MAX_CHIPS;
  const shown = overflowing ? entries.slice(0, MAX_CHIPS - 1) : entries;
  const hidden = entries.length - shown.length;

  return (
    <div
      ref={setNodeRef}
      data-date={day.iso}
      className={clsx(
        "group/day flex min-h-[104px] flex-col gap-0.5 p-1.5 transition-colors duration-150",
        day.inMonth ? "bg-surface" : "bg-surface-2",
        isOver && "bg-accent-soft",
      )}
    >
      <div className="flex items-center gap-1">
        <span
          className={clsx(
            "tnum grid size-6 shrink-0 place-items-center rounded-full text-xs",
            day.isToday && "bg-accent font-semibold text-accent-ink",
            !day.isToday && (day.inMonth ? "text-ink-2" : "text-ink-3"),
          )}
        >
          {day.day}
        </span>
        {canAdd && onAdd && (
          <IconButton
            name="plus"
            label={`Add to ${day.iso}`}
            size={13}
            className="ml-auto size-6 opacity-0 group-hover/day:opacity-100 focus-visible:opacity-100"
            onClick={() => onAdd(day.iso)}
          />
        )}
      </div>
      {shown.map((entry) => (
        <MonthChip key={`${entry.kind}-${entry.id}`} entry={entry} canDrag={editable.has(entry.workspaceId)} onOpenItem={onOpenItem} />
      ))}
      {hidden > 0 && (
        <button
          type="button"
          onClick={() => onOpenDay(day.iso)}
          className="cursor-pointer rounded-[4px] px-1 py-px text-left text-xs font-medium text-ink-3 transition-colors duration-150 hover:bg-surface-2 hover:text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
        >
          +{hidden} more
        </button>
      )}
    </div>
  );
}

function MonthChip({ entry, canDrag, onOpenItem }: { entry: CalendarEntry; canDrag: boolean; onOpenItem?: (entry: CalendarEntry) => void }) {
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({
    id: entryDragId(entry),
    disabled: !canDrag,
    data: { entry },
  });
  const handlers: Record<string, (e: SyntheticEvent) => void> = {};
  for (const [name, fn] of Object.entries(listeners ?? {})) {
    // The keyboard sensor is deliberately left off: the dialog is the keyboard way to change a date.
    if (typeof fn === "function" && name !== "onKeyDown") handlers[name] = fn as (e: SyntheticEvent) => void;
  }
  const drag: ChipDrag = canDrag
    ? {
        ref: setNodeRef,
        handlers,
        // The element is already a button or a link: keep the screen-reader hints, drop dnd-kit's role.
        attributes: { "aria-roledescription": attributes["aria-roledescription"], "aria-describedby": attributes["aria-describedby"] },
        dragging: isDragging,
      }
    : {};
  return <EntryChip entry={entry} onOpen={onOpenItem} drag={drag} />;
}
