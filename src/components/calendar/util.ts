import {
  addDays,
  addMonths,
  formatDate,
  formatMonthLabel,
  formatWeekLabel,
  fromUnix,
  isoDate,
  parseIsoDate,
  startOfDay,
  startOfWeek,
} from "@/lib/dates";
import type { CalendarEntry, CalendarView } from "./types";

/** How far ahead the agenda looks, and how far one press of "next" moves it. */
export const AGENDA_DAYS = 30;
/** A runaway span never paints more than this many day cells. */
const MAX_SPAN_DAYS = 62;

export type DayGroup = { iso: string; date: Date; entries: CalendarEntry[] };

/** The days a view needs loading, as a half-open [from, to) range of local dates. */
export function calendarWindow(view: CalendarView, anchor: Date): { from: Date; to: Date } {
  if (view === "week") {
    const from = startOfWeek(anchor);
    return { from, to: addDays(from, 7) };
  }
  if (view === "agenda") {
    const from = startOfDay(anchor);
    return { from, to: addDays(from, AGENDA_DAYS) };
  }
  const from = startOfWeek(new Date(anchor.getFullYear(), anchor.getMonth(), 1));
  return { from, to: addDays(from, 42) };
}

/** The `<h1>` for the current period. */
export function periodLabel(view: CalendarView, anchor: Date, now: Date = new Date()): string {
  if (view === "week") return formatWeekLabel(anchor);
  if (view === "agenda") {
    const { from, to } = calendarWindow(view, anchor);
    return `${formatDate(from, now)} – ${formatDate(addDays(to, -1), now)}`;
  }
  return formatMonthLabel(anchor);
}

/** Where previous / next land. */
export function stepAnchor(view: CalendarView, anchor: Date, direction: -1 | 1): Date {
  if (view === "week") return addDays(anchor, 7 * direction);
  if (view === "agenda") return addDays(anchor, AGENDA_DAYS * direction);
  return addMonths(new Date(anchor.getFullYear(), anchor.getMonth(), 1), direction);
}

/** The last local day an entry touches. A timed entry ending at midnight belongs to the day before. */
function lastDay(entry: CalendarEntry): Date {
  const first = startOfDay(fromUnix(entry.start));
  if (entry.end == null) return first;
  const raw = entry.allDay ? entry.end : Math.max(entry.start, entry.end - 1);
  const last = startOfDay(fromUnix(raw));
  return last < first ? first : last;
}

/** Every day each entry covers, keyed by ISO date and clamped to the window. */
export function entriesByDay(entries: readonly CalendarEntry[], from?: Date, to?: Date): Map<string, CalendarEntry[]> {
  const map = new Map<string, CalendarEntry[]>();
  const windowStart = from ? startOfDay(from) : null;
  const windowEnd = to ? addDays(startOfDay(to), -1) : null;
  for (const entry of entries) {
    const first = startOfDay(fromUnix(entry.start));
    let cursor = windowStart && first < windowStart ? windowStart : first;
    const last = windowEnd && lastDay(entry) > windowEnd ? windowEnd : lastDay(entry);
    for (let i = 0; cursor.getTime() <= last.getTime() && i < MAX_SPAN_DAYS; i++) {
      const key = isoDate(cursor);
      const list = map.get(key);
      if (list) list.push(entry);
      else map.set(key, [entry]);
      cursor = addDays(cursor, 1);
    }
  }
  return map;
}

/** Days with something on them, in date order. */
export function dayGroups(entries: readonly CalendarEntry[], from?: Date, to?: Date): DayGroup[] {
  return [...entriesByDay(entries, from, to).entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([iso, list]) => ({ iso, date: parseIsoDate(iso) ?? new Date(), entries: list }));
}

/** The hours a week column has to cover: 07:00–23:00 unless something falls outside it. */
export function hourRange(entries: readonly CalendarEntry[], from = 7, to = 23): { start: number; end: number } {
  let start = from;
  let end = to;
  for (const entry of entries) {
    if (entry.allDay) continue;
    const startsAt = fromUnix(entry.start);
    start = Math.min(start, startsAt.getHours());
    const endsAt = entry.end == null ? startsAt : fromUnix(entry.end);
    const sameDay = isoDate(endsAt) === isoDate(startsAt);
    end = Math.max(end, sameDay ? endsAt.getHours() + (endsAt.getMinutes() > 0 ? 1 : 0) : 24);
  }
  return { start: Math.max(0, Math.min(start, 23)), end: Math.min(24, Math.max(end, start + 1)) };
}

/** Seconds into the local day, clipped to it, for positioning a box in a week column. */
export function dayOffsets(entry: CalendarEntry, day: Date): { from: number; to: number } {
  const dayStart = startOfDay(day).getTime() / 1000;
  const dayEnd = addDays(startOfDay(day), 1).getTime() / 1000;
  const endUnix = entry.end == null ? entry.start + 1800 : Math.max(entry.end, entry.start + 900);
  return {
    from: Math.max(0, Math.min(entry.start, dayEnd) - dayStart),
    to: Math.max(0, Math.min(endUnix, dayEnd) - dayStart),
  };
}

/** A URL for this screen with one or two search params replaced. */
export function calendarHref(basePath: string, view: CalendarView, date: string, extra?: Record<string, string>): string {
  const q = new URLSearchParams({ view, date, ...extra });
  return `${basePath}?${q.toString()}`;
}
