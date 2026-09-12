import type { TaskStatus } from "@/db/schema";

export const CALENDAR_VIEWS = ["month", "week", "agenda"] as const;
export type CalendarView = (typeof CALENDAR_VIEWS)[number];

export type EntryKind = "task" | "item";

/** One dated thing on the calendar: a task due date, or a run-sheet entry. Times are unix seconds. */
export type CalendarEntry = {
  kind: EntryKind;
  id: string;
  title: string;
  workspaceId: string;
  workspaceName: string;
  workspaceSlug: string;
  accent: string;
  start: number;
  end: number | null;
  allDay: boolean;
  location?: string;
  ownerName?: string;
  status?: TaskStatus;
  href: string;
};

export type CalendarPerson = { id: string; name: string };
export type CalendarSupplier = { id: string; name: string };

/** Everything the edit dialog needs about one schedule item. */
export type ScheduleItemDetail = {
  id: string;
  workspaceId: string;
  workspaceSlug: string;
  title: string;
  notes: string | null;
  start: number;
  end: number | null;
  allDay: boolean;
  location: string | null;
  supplierId: string | null;
  ownerId: string | null;
};

/**
 * What the client sends. Times are local strings exactly as `<input type="datetime-local">`
 * and `<input type="date">` produce them; the server turns them into unix seconds.
 */
export type ScheduleItemInput = {
  title: string;
  start: string;
  end?: string | null;
  allDay?: boolean;
  location?: string | null;
  notes?: string | null;
  supplierId?: string | null;
  ownerId?: string | null;
};

export type ScheduleItemPatch = Partial<ScheduleItemInput>;

/** Drag-to-reschedule: drop an entry on a day. */
export type MoveEntryInput = { kind: EntryKind; id: string; toIsoDate: string; keepTime?: boolean };
