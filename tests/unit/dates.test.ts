// The calendar counts days in the machine's own timezone, so pin one for the assertions below.
process.env.TZ = "Europe/London";

import { describe, expect, it } from "vitest";
import {
  addDays,
  addMonths,
  daysBetween,
  formatDate,
  formatDayLabel,
  formatMonthLabel,
  formatRange,
  formatTime,
  formatWeekLabel,
  isoDate,
  layoutDayColumn,
  monthGrid,
  overlaps,
  parseIsoDate,
  parseLocalDateTime,
  startOfDay,
  startOfWeek,
  toInputValue,
  toUnix,
  weekDays,
} from "@/lib/dates";

const at = (y: number, m: number, d: number, h = 0, min = 0) => new Date(y, m - 1, d, h, min);
const unix = (y: number, m: number, d: number, h = 0, min = 0) => toUnix(at(y, m, d, h, min));

describe("timezone", () => {
  it("runs in Europe/London so the DST cases below mean something", () => {
    expect(Intl.DateTimeFormat().resolvedOptions().timeZone).toBe("Europe/London");
  });
});

describe("startOfDay / addDays", () => {
  it("strips the time", () => {
    expect(isoDate(startOfDay(at(2026, 9, 12, 23, 45)))).toBe("2026-09-12");
    expect(startOfDay(at(2026, 9, 12, 23, 45)).getHours()).toBe(0);
  });
  it("moves whole days forwards and backwards", () => {
    expect(isoDate(addDays(at(2026, 9, 12), 5))).toBe("2026-09-17");
    expect(isoDate(addDays(at(2026, 9, 12), -13))).toBe("2026-08-30");
  });
  it("crosses month and year ends", () => {
    expect(isoDate(addDays(at(2026, 12, 31), 1))).toBe("2027-01-01");
    expect(isoDate(addDays(at(2028, 3, 1), -1))).toBe("2028-02-29");
  });
});

describe("addMonths", () => {
  it("clamps to the last day of a shorter month", () => {
    expect(isoDate(addMonths(at(2026, 1, 31), 1))).toBe("2026-02-28");
    expect(isoDate(addMonths(at(2026, 3, 31), -1))).toBe("2026-02-28");
  });
  it("keeps the day where it exists", () => {
    expect(isoDate(addMonths(at(2026, 9, 12), 4))).toBe("2027-01-12");
  });
});

describe("startOfWeek", () => {
  it("defaults to Monday", () => {
    expect(isoDate(startOfWeek(at(2026, 9, 12)))).toBe("2026-09-07"); // Saturday -> Monday
    expect(isoDate(startOfWeek(at(2026, 9, 13)))).toBe("2026-09-07"); // Sunday belongs to the week before
    expect(isoDate(startOfWeek(at(2026, 9, 7)))).toBe("2026-09-07"); // Monday is already the start
  });
  it("honours another first day", () => {
    expect(isoDate(startOfWeek(at(2026, 9, 12), 0))).toBe("2026-09-06");
    expect(isoDate(startOfWeek(at(2026, 9, 12), 6))).toBe("2026-09-12");
  });
  it("gives seven days in order", () => {
    expect(weekDays(at(2026, 9, 12)).map(isoDate)).toEqual([
      "2026-09-07", "2026-09-08", "2026-09-09", "2026-09-10", "2026-09-11", "2026-09-12", "2026-09-13",
    ]);
  });
});

describe("monthGrid", () => {
  const flat = (year: number, month: number, now?: Date) => monthGrid(year, month, now).flat();

  it("is always six weeks of seven days", () => {
    const grid = monthGrid(2026, 8, at(2026, 9, 12));
    expect(grid).toHaveLength(6);
    for (const week of grid) expect(week).toHaveLength(7);
  });

  it("starts every week on a Monday", () => {
    for (const week of monthGrid(2026, 10, at(2026, 9, 12))) expect(week[0]!.date.getDay()).toBe(1);
  });

  it("handles a month that starts on a Sunday", () => {
    // 1 November 2026 is a Sunday: the first row is six days of October, then the 1st.
    const grid = monthGrid(2026, 10, at(2026, 11, 3));
    expect(grid[0]!.map((d) => d.iso)).toEqual([
      "2026-10-26", "2026-10-27", "2026-10-28", "2026-10-29", "2026-10-30", "2026-10-31", "2026-11-01",
    ]);
    expect(grid[0]!.slice(0, 6).every((d) => !d.inMonth)).toBe(true);
    expect(grid[0]![6]!.inMonth).toBe(true);
    expect(grid.flat().filter((d) => d.inMonth)).toHaveLength(30);
    // Six weeks still reach past the month rather than stopping short.
    expect(grid[5]![6]!.iso).toBe("2026-12-06");
  });

  it("marks today, the weekend and days outside the month", () => {
    const days = flat(2026, 8, at(2026, 9, 12));
    const today = days.filter((d) => d.isToday);
    expect(today).toHaveLength(1);
    expect(today[0]!.iso).toBe("2026-09-12");
    expect(days.find((d) => d.iso === "2026-09-13")!.isWeekend).toBe(true);
    expect(days.find((d) => d.iso === "2026-09-14")!.isWeekend).toBe(false);
    expect(days.find((d) => d.iso === "2026-08-31")!.inMonth).toBe(false);
  });

  it("has no repeated or skipped day across a clock change", () => {
    const isos = flat(2026, 2, at(2026, 3, 10)).map((d) => d.iso);
    expect(new Set(isos).size).toBe(42);
    const march = isos.indexOf("2026-03-29");
    expect(march).toBeGreaterThan(-1);
    expect(isos[march - 1]).toBe("2026-03-28");
    expect(isos[march + 1]).toBe("2026-03-30");
    // Every cell is still local midnight, even the 23-hour day.
    expect(flat(2026, 2).every((d) => d.date.getHours() === 0)).toBe(true);
  });
});

describe("British summer time", () => {
  // Clocks go forward 01:00 GMT on Sunday 29 March 2026 and back 02:00 BST on Sunday 25 October.
  it("keeps the wall-clock time when a 23-hour day is added", () => {
    const before = at(2026, 3, 28, 12, 0);
    const after = addDays(before, 1);
    expect(isoDate(after)).toBe("2026-03-29");
    expect(after.getHours()).toBe(12);
    expect(after.getTime() - before.getTime()).toBe(23 * 3_600_000);
  });

  it("keeps the wall-clock time when a 25-hour day is added", () => {
    const before = at(2026, 10, 24, 12, 0);
    const after = addDays(before, 1);
    expect(isoDate(after)).toBe("2026-10-25");
    expect(after.getHours()).toBe(12);
    expect(after.getTime() - before.getTime()).toBe(25 * 3_600_000);
  });

  it("counts calendar days, not 86400-second blocks", () => {
    expect(daysBetween(at(2026, 3, 28), at(2026, 3, 30))).toBe(2);
    expect(daysBetween(at(2026, 10, 24), at(2026, 10, 26))).toBe(2);
    expect(daysBetween(at(2026, 3, 30), at(2026, 3, 28))).toBe(-2);
  });

  it("puts the start of a short day at midnight and the next at midnight too", () => {
    const short = startOfDay(at(2026, 3, 29, 13, 0));
    expect(short.getHours()).toBe(0);
    expect(isoDate(short)).toBe("2026-03-29");
    expect(isoDate(addDays(short, 1))).toBe("2026-03-30");
  });

  it("formats BST times in local hours", () => {
    // 09:30 UTC is 10:30 BST.
    expect(formatTime(Math.floor(Date.UTC(2026, 5, 1, 9, 30) / 1000))).toBe("10:30");
    // 09:30 UTC in winter is 09:30 GMT.
    expect(formatTime(Math.floor(Date.UTC(2026, 0, 12, 9, 30) / 1000))).toBe("09:30");
  });
});

describe("iso dates", () => {
  it("round-trips", () => {
    expect(isoDate(parseIsoDate("2026-09-12")!)).toBe("2026-09-12");
    expect(parseIsoDate("2026-09-12")!.getHours()).toBe(0);
  });
  it("rejects nonsense", () => {
    expect(parseIsoDate("2026-02-30")).toBeNull();
    expect(parseIsoDate("12/09/2026")).toBeNull();
    expect(parseIsoDate("")).toBeNull();
    expect(parseIsoDate(null)).toBeNull();
  });
  it("parses what a datetime-local input sends", () => {
    const d = parseLocalDateTime("2026-09-12T14:30")!;
    expect(isoDate(d)).toBe("2026-09-12");
    expect(d.getHours()).toBe(14);
    expect(d.getMinutes()).toBe(30);
    expect(parseLocalDateTime("2026-09-12")!.getHours()).toBe(0);
    expect(parseLocalDateTime("2026-09-12T25:00")).toBeNull();
    expect(parseLocalDateTime("nope")).toBeNull();
  });
  it("renders input values back", () => {
    expect(toInputValue(unix(2026, 9, 12, 9, 5), false)).toBe("2026-09-12T09:05");
    expect(toInputValue(unix(2026, 9, 12, 9, 5), true)).toBe("2026-09-12");
  });
});

describe("labels", () => {
  const now = at(2026, 9, 12);
  it("names the day in relative terms first", () => {
    expect(formatDayLabel(at(2026, 9, 12), now)).toBe("Today");
    expect(formatDayLabel(at(2026, 9, 13), now)).toBe("Tomorrow");
    expect(formatDayLabel(at(2026, 9, 11), now)).toBe("Yesterday");
    expect(formatDayLabel(at(2026, 9, 17), now)).toBe("Thu 17 Sep");
    expect(formatDayLabel(at(2027, 1, 4), now)).toBe("Mon 4 Jan 2027");
  });
  it("names dates, months and weeks", () => {
    expect(formatDate(at(2026, 9, 16), now)).toBe("16 Sep");
    expect(formatMonthLabel(at(2026, 9, 16))).toBe("September 2026");
    expect(formatWeekLabel(at(2026, 9, 16))).toBe("14 – 20 Sep 2026");
    expect(formatWeekLabel(at(2026, 10, 1))).toBe("28 Sep – 4 Oct 2026");
    expect(formatWeekLabel(at(2026, 12, 31))).toBe("28 Dec 2026 – 3 Jan 2027");
  });
  it("formats a range", () => {
    expect(formatRange(unix(2026, 9, 12, 10, 0), unix(2026, 9, 12, 11, 30), true)).toBe("All day");
    expect(formatRange(unix(2026, 9, 12, 10, 0), null, false)).toBe("10:00");
    expect(formatRange(unix(2026, 9, 12, 10, 0), unix(2026, 9, 12, 11, 30), false)).toBe("10:00–11:30");
    expect(formatRange(unix(2026, 9, 12, 22, 0), unix(2026, 9, 13, 1, 0), false)).toBe("22:00 – 13 Sep 01:00");
  });
});

describe("overlaps", () => {
  const a = { start: unix(2026, 9, 12, 10, 0), end: unix(2026, 9, 12, 11, 0) };
  it("is half-open: touching is not overlapping", () => {
    expect(overlaps(a, { start: a.end, end: a.end + 3600 })).toBe(false);
    expect(overlaps({ start: a.start - 3600, end: a.start }, a)).toBe(false);
  });
  it("catches partial and total cover", () => {
    expect(overlaps(a, { start: a.start + 1800, end: a.end + 1800 })).toBe(true);
    expect(overlaps(a, { start: a.start - 1800, end: a.end + 1800 })).toBe(true);
    expect(overlaps(a, { start: a.start + 600, end: a.start + 900 })).toBe(true);
  });
  it("treats a missing end as a point in time", () => {
    expect(overlaps(a, { start: a.start + 600, end: null })).toBe(true);
    expect(overlaps(a, { start: a.end, end: null })).toBe(false);
  });
});

describe("layoutDayColumn", () => {
  const span = (h: number, m: number, h2: number, m2: number) => ({ start: unix(2026, 9, 12, h, m), end: unix(2026, 9, 12, h2, m2) });

  it("gives a lone entry the whole width", () => {
    const [only] = layoutDayColumn([span(9, 0, 10, 0)]);
    expect(only).toMatchObject({ column: 0, columns: 1 });
  });

  it("splits two overlapping entries", () => {
    const laid = layoutDayColumn([span(9, 0, 10, 30), span(9, 30, 10, 0)]);
    expect(laid.map((l) => l.column)).toEqual([0, 1]);
    expect(laid.every((l) => l.columns === 2)).toBe(true);
  });

  it("reuses a column once the earlier entry has finished", () => {
    const laid = layoutDayColumn([span(9, 0, 10, 0), span(9, 30, 11, 0), span(10, 0, 10, 30)]);
    expect(laid.map((l) => l.column)).toEqual([0, 1, 0]);
    expect(laid.every((l) => l.columns === 2)).toBe(true);
  });

  it("keeps separate clusters at their own widths", () => {
    const laid = layoutDayColumn([span(9, 0, 10, 0), span(9, 15, 9, 45), span(14, 0, 15, 0)]);
    expect(laid.map((l) => l.columns)).toEqual([2, 2, 1]);
    expect(laid[2]!.column).toBe(0);
  });

  it("sorts by start and handles an empty day", () => {
    const laid = layoutDayColumn([span(14, 0, 15, 0), span(9, 0, 10, 0)]);
    expect(laid.map((l) => l.item.start)).toEqual([unix(2026, 9, 12, 9, 0), unix(2026, 9, 12, 14, 0)]);
    expect(layoutDayColumn([])).toEqual([]);
  });

  it("keeps the original object so a renderer can read its fields", () => {
    const item = { ...span(9, 0, 10, 0), title: "Site visit" };
    expect(layoutDayColumn([item])[0]!.item.title).toBe("Site visit");
  });
});
