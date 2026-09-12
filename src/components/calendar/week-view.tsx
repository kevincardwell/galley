"use client";
import Link from "next/link";
import { useEffect, useState } from "react";
import { clsx } from "@/lib/clsx";
import { Icon } from "@/components/ui/icon";
import { WEEKDAYS, formatRange, isoDate, layoutDayColumn } from "@/lib/dates";
import { dayOffsets } from "./util";
import type { CalendarEntry } from "./types";

const HOUR_PX = 48;
const GUTTER = 52;
const pad = (n: number) => String(n).padStart(2, "0");

type Props = {
  days: Date[];
  byDay: Map<string, CalendarEntry[]>;
  range: { start: number; end: number };
  todayIso: string;
  onOpenItem?: (entry: CalendarEntry) => void;
};

export function WeekView({ days, byDay, range, todayIso, onOpenItem }: Props) {
  const hours = Array.from({ length: range.end - range.start }, (_, i) => range.start + i);
  const height = hours.length * HOUR_PX;
  const columns = { gridTemplateColumns: `${GUTTER}px repeat(7, minmax(0, 1fr))` };
  const hasAllDay = days.some((d) => (byDay.get(isoDate(d)) ?? []).some((e) => e.allDay));

  return (
    <div className="overflow-x-auto rounded-lg border border-line">
      <div className="min-w-[680px]">
        <div className="grid border-b border-line bg-surface-2" style={columns}>
          <div />
          {days.map((day) => {
            const iso = isoDate(day);
            const today = iso === todayIso;
            return (
              <div key={iso} className="flex items-center gap-1.5 border-l border-line-2 px-2 py-1.5">
                <span className="text-xs font-medium text-ink-3">{WEEKDAYS[(day.getDay() + 6) % 7]}</span>
                <span className={clsx("tnum grid size-6 place-items-center rounded-full text-[13px]", today ? "bg-accent font-semibold text-accent-ink" : "text-ink")}>
                  {day.getDate()}
                </span>
              </div>
            );
          })}
        </div>

        {hasAllDay && (
          <div className="grid border-b border-line-2 bg-surface" style={columns}>
            <div className="px-2 py-1 text-right text-xs text-ink-3">All day</div>
            {days.map((day) => {
              const iso = isoDate(day);
              const all = (byDay.get(iso) ?? []).filter((e) => e.allDay);
              return (
                <div key={iso} className="flex min-w-0 flex-col gap-0.5 border-l border-line-2 p-1">
                  {all.map((entry) => (
                    <AllDayChip key={`${entry.kind}-${entry.id}`} entry={entry} onOpenItem={onOpenItem} />
                  ))}
                </div>
              );
            })}
          </div>
        )}

        <div className="grid bg-surface" style={columns}>
          <div className="relative" style={{ height }}>
            {hours.map((h) => (
              <span key={h} className="tnum absolute right-2 -translate-y-1/2 text-[11px] text-ink-3" style={{ top: (h - range.start) * HOUR_PX }}>
                {pad(h)}:00
              </span>
            ))}
          </div>
          {days.map((day) => (
            <DayColumn
              key={isoDate(day)}
              day={day}
              entries={(byDay.get(isoDate(day)) ?? []).filter((e) => !e.allDay)}
              range={range}
              height={height}
              hours={hours}
              isToday={isoDate(day) === todayIso}
              onOpenItem={onOpenItem}
            />
          ))}
        </div>
      </div>
    </div>
  );
}

function DayColumn({
  day, entries, range, height, hours, isToday, onOpenItem,
}: {
  day: Date;
  entries: CalendarEntry[];
  range: { start: number; end: number };
  height: number;
  hours: number[];
  isToday: boolean;
  onOpenItem?: (entry: CalendarEntry) => void;
}) {
  // Overlapping boxes share the column: `start`/`end` are seconds into this day, clipped to it.
  const laid = layoutDayColumn(
    entries.map((entry) => {
      const { from, to } = dayOffsets(entry, day);
      return { entry, from, to, start: from, end: to };
    }),
  );
  const nowTop = useNowOffset(isToday, range);

  return (
    <div className="relative border-l border-line-2" style={{ height }}>
      {hours.map((h) => (
        <div key={h} className="pointer-events-none absolute inset-x-0 border-t border-line-2" style={{ top: (h - range.start) * HOUR_PX }} />
      ))}
      {nowTop !== null && (
        <div aria-hidden className="pointer-events-none absolute inset-x-0 z-20 border-t border-accent" style={{ top: nowTop }}>
          <span className="absolute -top-[3px] left-0 size-1.5 rounded-full bg-accent" />
        </div>
      )}
      {laid.map(({ item, column, columns }) => {
        const top = (item.from / 3600 - range.start) * HOUR_PX;
        const boxHeight = Math.max(20, ((item.to - item.from) / 3600) * HOUR_PX);
        return (
          <TimedEntry
            key={`${item.entry.kind}-${item.entry.id}`}
            entry={item.entry}
            onOpenItem={onOpenItem}
            style={{
              top: Math.max(0, top),
              height: boxHeight,
              left: `calc(${(column / columns) * 100}% + 2px)`,
              width: `calc(${100 / columns}% - 4px)`,
            }}
          />
        );
      })}
    </div>
  );
}

/** Minutes since the top of the visible range, refreshed once a minute. Null until the client knows the time. */
function useNowOffset(enabled: boolean, range: { start: number; end: number }): number | null {
  const [minutes, setMinutes] = useState<number | null>(null);
  useEffect(() => {
    if (!enabled) return;
    const tick = () => {
      const now = new Date();
      setMinutes(now.getHours() * 60 + now.getMinutes());
    };
    tick();
    const timer = setInterval(tick, 60_000);
    return () => clearInterval(timer);
  }, [enabled]);
  if (!enabled || minutes === null) return null;
  const top = (minutes / 60 - range.start) * HOUR_PX;
  return top < 0 || top > (range.end - range.start) * HOUR_PX ? null : top;
}

function TimedEntry({ entry, style, onOpenItem }: { entry: CalendarEntry; style: React.CSSProperties; onOpenItem?: (entry: CalendarEntry) => void }) {
  const classes =
    "absolute flex cursor-pointer flex-col gap-px overflow-hidden rounded-[5px] border-l-2 px-1.5 py-1 text-left text-xs transition-[filter,background-color] duration-150 hover:brightness-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent";
  const boxStyle: React.CSSProperties = {
    ...style,
    borderLeftColor: entry.accent,
    background: `color-mix(in oklab, ${entry.accent} 14%, var(--surface))`,
  };
  const body = (
    <>
      <span className="tnum truncate text-[11px] text-ink-2">{formatRange(entry.start, entry.end, entry.allDay)}</span>
      <span className={clsx("truncate font-medium", entry.status === "done" && "text-ink-3 line-through")}>{entry.title}</span>
      {entry.location && (
        <span className="flex items-center gap-1 truncate text-[11px] text-ink-3">
          <Icon name="pin" size={11} />
          {entry.location}
        </span>
      )}
    </>
  );
  if (entry.kind === "item" && onOpenItem) {
    return (
      <button type="button" className={classes} style={boxStyle} onClick={() => onOpenItem(entry)} title={entry.title}>
        {body}
      </button>
    );
  }
  return (
    <Link href={entry.href} className={classes} style={boxStyle} title={entry.title}>
      {body}
    </Link>
  );
}

function AllDayChip({ entry, onOpenItem }: { entry: CalendarEntry; onOpenItem?: (entry: CalendarEntry) => void }) {
  const classes =
    "flex w-full cursor-pointer items-center gap-1.5 overflow-hidden rounded-[4px] border border-transparent px-1 py-px text-left text-xs transition-colors duration-150 hover:border-line hover:bg-surface-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent";
  const mark =
    entry.kind === "task" ? (
      <span aria-hidden className="size-1.5 shrink-0 rounded-full" style={{ background: entry.accent }} />
    ) : (
      <span aria-hidden className="h-3 w-[3px] shrink-0 rounded-full" style={{ background: entry.accent }} />
    );
  if (entry.kind === "item" && onOpenItem) {
    return (
      <button type="button" className={classes} onClick={() => onOpenItem(entry)} title={entry.title}>
        {mark}
        <span className="truncate">{entry.title}</span>
      </button>
    );
  }
  return (
    <Link href={entry.href} className={classes} title={entry.title}>
      {mark}
      <span className={clsx("truncate", entry.status === "done" && "text-ink-3 line-through")}>{entry.title}</span>
    </Link>
  );
}
