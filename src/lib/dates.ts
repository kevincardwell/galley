/**
 * Local-time date helpers for the calendar. Pure: no date library, no server imports,
 * no UTC arithmetic. Every "day" is a day in the machine's own timezone, so a self-hosted
 * Galley in Europe/London counts days the way the people using it do — including the
 * 23- and 25-hour days either side of a clock change.
 */

export type WeekStart = 0 | 1 | 2 | 3 | 4 | 5 | 6;

/** A span of unix seconds. `end` may be missing: such an entry is treated as a point in time. */
export type Span = { start: number; end?: number | null };

export type MonthDay = {
  date: Date;
  iso: string;
  day: number;
  inMonth: boolean;
  isToday: boolean;
  isWeekend: boolean;
};

export type LaidOut<T> = { item: T; column: number; columns: number };

/** Monday-first weekday headings. */
export const WEEKDAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"] as const;

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"] as const;
const MONTHS_LONG = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
] as const;

const pad = (n: number) => String(n).padStart(2, "0");

// ---- Points in time ----

export const toUnix = (date: Date): number => Math.floor(date.getTime() / 1000);
export const fromUnix = (unix: number): Date => new Date(unix * 1000);

/** Midnight at the start of `date`'s local day. */
export function startOfDay(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}

/** Midnight at the start of the next local day (so a day is [startOfDay, endOfDay)). */
export function endOfDay(date: Date): Date {
  return addDays(startOfDay(date), 1);
}

/** Same wall-clock time, `days` later. 12:00 stays 12:00 across a clock change. */
export function addDays(date: Date, days: number): Date {
  const d = new Date(date.getTime());
  d.setDate(d.getDate() + days);
  return d;
}

/** Same day-of-month where it exists, clamped to the last day where it does not (31 Jan + 1 = 28 Feb). */
export function addMonths(date: Date, months: number): Date {
  const day = date.getDate();
  const d = new Date(date.getFullYear(), date.getMonth() + months, 1, date.getHours(), date.getMinutes(), date.getSeconds());
  const lastDay = new Date(d.getFullYear(), d.getMonth() + 1, 0).getDate();
  d.setDate(Math.min(day, lastDay));
  return d;
}

/** Midnight on the Monday (by default) of `date`'s week. */
export function startOfWeek(date: Date, weekStartsOn: WeekStart = 1): Date {
  const d = startOfDay(date);
  const back = (((d.getDay() - weekStartsOn) % 7) + 7) % 7;
  return addDays(d, -back);
}

export function isSameDay(a: Date, b: Date): boolean {
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
}

export function isToday(date: Date, now: Date = new Date()): boolean {
  return isSameDay(date, now);
}

/** Whole local days from `a`'s day to `b`'s day. DST-proof: counts calendar days, not 86400s blocks. */
export function daysBetween(a: Date, b: Date): number {
  const from = startOfDay(a);
  const to = startOfDay(b);
  return Math.round((to.getTime() - from.getTime()) / 86_400_000);
}

// ---- ISO dates (YYYY-MM-DD, always local) ----

export function isoDate(date: Date): string {
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

export const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;
export const ISO_DATE_TIME = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(:\d{2})?$/;

/** `YYYY-MM-DD` to local midnight. Returns null for anything that is not a real date. */
export function parseIsoDate(iso: string | null | undefined): Date | null {
  if (!iso || !ISO_DATE.test(iso)) return null;
  const [y, m, d] = iso.split("-").map(Number) as [number, number, number];
  const date = new Date(y, m - 1, d);
  return date.getFullYear() === y && date.getMonth() === m - 1 && date.getDate() === d ? date : null;
}

/** `YYYY-MM-DD` or `YYYY-MM-DDTHH:mm` (what `<input type="datetime-local">` sends) to a local Date. */
export function parseLocalDateTime(value: string | null | undefined): Date | null {
  if (!value) return null;
  if (ISO_DATE.test(value)) return parseIsoDate(value);
  if (!ISO_DATE_TIME.test(value)) return null;
  const [datePart, timePart] = value.split("T") as [string, string];
  const day = parseIsoDate(datePart);
  if (!day) return null;
  const [h, min, sec] = timePart.split(":").map(Number);
  if (h === undefined || min === undefined || h > 23 || min > 59) return null;
  return new Date(day.getFullYear(), day.getMonth(), day.getDate(), h, min, sec ?? 0);
}

/** The value a `<input type="datetime-local">` or `type="date"` wants for a stored instant. */
export function toInputValue(unix: number, allDay: boolean): string {
  const d = fromUnix(unix);
  return allDay ? isoDate(d) : `${isoDate(d)}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

// ---- Grids ----

/**
 * Six weeks of days covering `month` (0-indexed, as `Date` counts them), Monday first,
 * so the grid never changes height between months.
 */
export function monthGrid(year: number, month: number, now: Date = new Date()): MonthDay[][] {
  const first = new Date(year, month, 1);
  const y = first.getFullYear();
  const m = first.getMonth();
  const start = startOfWeek(first, 1);
  const weeks: MonthDay[][] = [];
  for (let w = 0; w < 6; w++) {
    const week: MonthDay[] = [];
    for (let i = 0; i < 7; i++) {
      const date = addDays(start, w * 7 + i);
      const weekday = date.getDay();
      week.push({
        date,
        iso: isoDate(date),
        day: date.getDate(),
        inMonth: date.getMonth() === m && date.getFullYear() === y,
        isToday: isSameDay(date, now),
        isWeekend: weekday === 0 || weekday === 6,
      });
    }
    weeks.push(week);
  }
  return weeks;
}

/** The seven days of `date`'s week, Monday first. */
export function weekDays(date: Date, weekStartsOn: WeekStart = 1): Date[] {
  const start = startOfWeek(date, weekStartsOn);
  return Array.from({ length: 7 }, (_, i) => addDays(start, i));
}

// ---- Formatting (British, 24-hour) ----

/** "14:30" */
export function formatTime(unix: number): string {
  const d = fromUnix(unix);
  return `${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

/** "16 Sep", with the year when it is not the current one. */
export function formatDate(date: Date, now: Date = new Date()): string {
  const base = `${date.getDate()} ${MONTHS[date.getMonth()]}`;
  return date.getFullYear() === now.getFullYear() ? base : `${base} ${date.getFullYear()}`;
}

/** "Today", "Tomorrow", "Yesterday", else "Mon 16 Sep". */
export function formatDayLabel(date: Date, now: Date = new Date()): string {
  const diff = daysBetween(now, date);
  if (diff === 0) return "Today";
  if (diff === 1) return "Tomorrow";
  if (diff === -1) return "Yesterday";
  return `${WEEKDAYS[(date.getDay() + 6) % 7]} ${formatDate(date, now)}`;
}

/** "All day", "14:30", "14:30–15:30", or "14:30 – 17 Sep 09:00" when it runs past midnight. */
export function formatRange(start: number, end: number | null | undefined, allDay: boolean): string {
  if (allDay) return "All day";
  const from = formatTime(start);
  if (end == null || end <= start) return from;
  const startDate = fromUnix(start);
  const endDate = fromUnix(end);
  if (isSameDay(startDate, endDate)) return `${from}–${formatTime(end)}`;
  return `${from} – ${formatDate(endDate, startDate)} ${formatTime(end)}`;
}

/** "September 2026" */
export function formatMonthLabel(date: Date): string {
  return `${MONTHS_LONG[date.getMonth()]} ${date.getFullYear()}`;
}

/** "14–20 Sep 2026", "28 Sep – 4 Oct 2026", "28 Dec 2026 – 3 Jan 2027" */
export function formatWeekLabel(start: Date, weekStartsOn: WeekStart = 1): string {
  const from = startOfWeek(start, weekStartsOn);
  const to = addDays(from, 6);
  const sameYear = from.getFullYear() === to.getFullYear();
  const left = sameYear
    ? from.getMonth() === to.getMonth()
      ? String(from.getDate())
      : `${from.getDate()} ${MONTHS[from.getMonth()]}`
    : `${from.getDate()} ${MONTHS[from.getMonth()]} ${from.getFullYear()}`;
  return `${left} – ${to.getDate()} ${MONTHS[to.getMonth()]} ${to.getFullYear()}`;
}

// ---- Overlap and column layout ----

const spanEnd = (s: Span): number => (s.end == null ? s.start : Math.max(s.end, s.start));

/** Half-open overlap: 10:00–11:00 and 11:00–12:00 do not overlap. */
export function overlaps(a: Span, b: Span): boolean {
  return a.start < spanEnd(b) && b.start < spanEnd(a);
}

/**
 * Side-by-side columns for the timed entries of one day. Entries that overlap share a cluster
 * and are dealt out into the fewest columns that keep them apart; `columns` is the width of the
 * cluster, so a renderer can size each box as `1 / columns` of the day.
 * Returned in start order, not input order.
 */
export function layoutDayColumn<T extends Span>(items: readonly T[]): LaidOut<T>[] {
  const sorted = [...items].sort((a, b) => a.start - b.start || spanEnd(a) - spanEnd(b));
  const out: LaidOut<T>[] = [];
  let cluster: LaidOut<T>[] = [];
  let columnEnds: number[] = [];

  const flush = () => {
    const columns = Math.max(1, columnEnds.length);
    for (const laid of cluster) out.push({ ...laid, columns });
    cluster = [];
    columnEnds = [];
  };

  for (const item of sorted) {
    // A gap across every column ends the cluster: nothing after it can overlap anything in it.
    if (columnEnds.length > 0 && item.start >= Math.max(...columnEnds)) flush();
    let column = columnEnds.findIndex((end) => end <= item.start);
    if (column === -1) {
      column = columnEnds.length;
      columnEnds.push(spanEnd(item));
    } else {
      columnEnds[column] = spanEnd(item);
    }
    cluster.push({ item, column, columns: 1 });
  }
  flush();
  return out;
}
