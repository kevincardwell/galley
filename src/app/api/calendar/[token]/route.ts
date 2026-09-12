import { eq } from "drizzle-orm";
import { db, schema } from "@/db/client";
import { resolveBaseUrl } from "@/lib/queries/admin";
import { workspaceFeed } from "@/lib/queries/schedule";
import { addDays, fromUnix, isoDate, parseIsoDate } from "@/lib/dates";

const PRODID = "-//Galley//Schedule//EN";

const pad = (n: number) => String(n).padStart(2, "0");

/** RFC 5545 text: backslash, semicolon, comma and newlines all have to be escaped. */
function esc(value: string): string {
  return value.replace(/\\/g, "\\\\").replace(/;/g, "\\;").replace(/,/g, "\\,").replace(/\r\n|\r|\n/g, "\\n");
}

/** UTC date-time, e.g. 20260912T093000Z. */
function utcStamp(unix: number): string {
  const d = fromUnix(unix);
  return (
    `${d.getUTCFullYear()}${pad(d.getUTCMonth() + 1)}${pad(d.getUTCDate())}` +
    `T${pad(d.getUTCHours())}${pad(d.getUTCMinutes())}${pad(d.getUTCSeconds())}Z`
  );
}

/** Floating date, e.g. 20260912, taken from the local day the instant falls in. */
const dateStamp = (date: Date): string => isoDate(date).replace(/-/g, "");

/**
 * Fold to 75 octets with a leading space on continuations, never splitting a UTF-8
 * character across the break.
 */
function fold(line: string): string {
  const bytes = Buffer.from(line, "utf8");
  if (bytes.length <= 75) return line;
  const parts: string[] = [];
  let i = 0;
  let limit = 75;
  while (i < bytes.length) {
    let take = Math.min(limit, bytes.length - i);
    while (take > 1 && i + take < bytes.length && (bytes[i + take]! & 0xc0) === 0x80) take--;
    parts.push(bytes.subarray(i, i + take).toString("utf8"));
    i += take;
    limit = 74; // the continuation's leading space counts towards the 75
  }
  return parts.join("\r\n ");
}

export async function GET(_req: Request, { params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const ws = token
    ? db.select().from(schema.workspaces).where(eq(schema.workspaces.calendarToken, token)).get()
    : undefined;
  if (!ws) return new Response("Not found", { status: 404 });

  const base = await resolveBaseUrl();
  const { items, tasks } = workspaceFeed(ws.id);
  const stamp = utcStamp(Math.floor(Date.now() / 1000));
  const lines: string[] = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    `PRODID:${PRODID}`,
    "CALSCALE:GREGORIAN",
    "METHOD:PUBLISH",
    `X-WR-CALNAME:${esc(ws.name)}`,
    `NAME:${esc(ws.name)}`,
    "X-PUBLISHED-TTL:PT1H",
    "REFRESH-INTERVAL;VALUE=DURATION:PT1H",
  ];

  for (const item of items) {
    const start = fromUnix(item.startsAt);
    lines.push("BEGIN:VEVENT");
    lines.push(`UID:item-${item.id}@galley`);
    lines.push(`DTSTAMP:${utcStamp(item.createdAt)}`);
    if (item.allDay) {
      const last = item.endsAt === null ? start : fromUnix(item.endsAt);
      lines.push(`DTSTART;VALUE=DATE:${dateStamp(start)}`);
      lines.push(`DTEND;VALUE=DATE:${dateStamp(addDays(last, 1))}`); // DTEND is exclusive
    } else {
      lines.push(`DTSTART:${utcStamp(item.startsAt)}`);
      if (item.endsAt !== null && item.endsAt > item.startsAt) lines.push(`DTEND:${utcStamp(item.endsAt)}`);
    }
    lines.push(`SUMMARY:${esc(item.title)}`);
    if (item.location) lines.push(`LOCATION:${esc(item.location)}`);
    if (item.notes) lines.push(`DESCRIPTION:${esc(item.notes)}`);
    lines.push(`URL:${base}/w/${ws.slug}/calendar?date=${isoDate(start)}&item=${item.id}`);
    lines.push(`CATEGORIES:${esc(ws.name)}`);
    lines.push(`LAST-MODIFIED:${stamp}`);
    lines.push("END:VEVENT");
  }

  for (const task of tasks) {
    const due = parseIsoDate(task.dueOn);
    if (!due) continue;
    lines.push("BEGIN:VEVENT");
    lines.push(`UID:task-${task.id}@galley`);
    lines.push(`DTSTAMP:${utcStamp(task.createdAt)}`);
    lines.push(`DTSTART;VALUE=DATE:${dateStamp(due)}`);
    lines.push(`DTEND;VALUE=DATE:${dateStamp(addDays(due, 1))}`);
    lines.push(`SUMMARY:${esc(task.title)}`);
    lines.push(`DESCRIPTION:${esc(task.assigneeName ? `Task due — ${task.assigneeName}` : "Task due")}`);
    lines.push(`URL:${base}/w/${ws.slug}/tasks?task=${task.id}`);
    lines.push("CATEGORIES:Task");
    lines.push(`STATUS:${task.status === "done" ? "COMPLETED" : "CONFIRMED"}`);
    lines.push(`LAST-MODIFIED:${stamp}`);
    lines.push("END:VEVENT");
  }

  lines.push("END:VCALENDAR");
  const body = lines.map(fold).join("\r\n") + "\r\n";

  return new Response(body, {
    headers: {
      "Content-Type": "text/calendar; charset=utf-8",
      "Content-Disposition": `inline; filename="${ws.slug}.ics"`,
      "Cache-Control": "no-store",
    },
  });
}
