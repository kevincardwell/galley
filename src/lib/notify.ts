import "server-only";
import { and, eq, gt, isNull } from "drizzle-orm";
import { db, schema } from "@/db/client";
import { isEmailConfigured, sendEmail } from "@/lib/email";
import { notificationEmail } from "@/lib/email/templates";
import { newId } from "@/lib/ids";
import { getSettings } from "@/lib/settings";

export type NotificationKind = "mention" | "assigned" | "client_comment" | "client_approved" | "client_upload" | "invite";

export type NotifyInput = {
  userId: string;
  workspaceId?: string | null;
  kind: NotificationKind | (string & {});
  title: string;
  body?: string | null;
  /** App-relative path such as `/w/acme/tasks?task=abc`; also used to de-duplicate emails. */
  href?: string | null;
  /** Also email the person, when SMTP is set up and they were not emailed about this href in the last 10 minutes. */
  email?: boolean;
};

const EMAIL_DEDUPE_S = 10 * 60;
const nowS = () => Math.floor(Date.now() / 1000);

function absolute(href: string | null | undefined): string | null {
  if (!href) return null;
  const base = getSettings().baseUrl.trim().replace(/\/+$/, "");
  if (/^https?:\/\//.test(href)) return href;
  return base ? `${base}${href.startsWith("/") ? "" : "/"}${href}` : null;
}

/** Inserts an inbox row and optionally emails the person. Returns the notification id. */
export async function notify(input: NotifyInput): Promise<string> {
  const id = newId();
  const href = input.href ?? null;
  db.insert(schema.notifications)
    .values({ id, userId: input.userId, workspaceId: input.workspaceId ?? null, kind: input.kind, title: input.title, body: input.body ?? null, href })
    .run();

  if (!input.email || !isEmailConfigured()) return id;

  const user = db.select({ email: schema.users.email, deactivatedAt: schema.users.deactivatedAt }).from(schema.users).where(eq(schema.users.id, input.userId)).get();
  if (!user || user.deactivatedAt) return id;

  if (href) {
    const recent = db
      .select({ id: schema.notifications.id })
      .from(schema.notifications)
      .where(and(eq(schema.notifications.userId, input.userId), eq(schema.notifications.href, href), gt(schema.notifications.emailedAt, nowS() - EMAIL_DEDUPE_S)))
      .limit(1)
      .get();
    if (recent) return id;
  }

  const { instanceName } = getSettings();
  const mail = notificationEmail({ instanceName, title: input.title, body: input.body, url: absolute(href) });
  const sent = await sendEmail({ to: user.email, ...mail });
  if (sent.ok) db.update(schema.notifications).set({ emailedAt: nowS() }).where(eq(schema.notifications.id, id)).run();
  return id;
}

export type MentionCandidate = { id: string; name: string; email: string };

/** Active members of a workspace, for @-mention matching and future autocomplete. */
export function mentionCandidates(workspaceId: string): MentionCandidate[] {
  return db
    .select({ id: schema.users.id, name: schema.users.name, email: schema.users.email })
    .from(schema.memberships)
    .innerJoin(schema.users, eq(schema.users.id, schema.memberships.userId))
    .where(and(eq(schema.memberships.workspaceId, workspaceId), isNull(schema.users.deactivatedAt)))
    .orderBy(schema.users.name)
    .all();
}

/**
 * Finds the members mentioned in `text`. "@Ellie" and "@Ellie Finch" both hit Ellie Finch;
 * matching is case-insensitive and the longest candidate at each "@" wins.
 */
export function findMentions(text: string, candidates: MentionCandidate[]): MentionCandidate[] {
  const byName = new Map<string, MentionCandidate[]>();
  for (const c of candidates) {
    const full = c.name.trim();
    if (!full) continue;
    const first = full.split(/\s+/)[0]!;
    for (const n of new Set([full, first])) {
      const key = n.toLowerCase();
      byName.set(key, [...(byName.get(key) ?? []), c]);
    }
  }
  const names = [...byName.keys()].sort((a, b) => b.length - a.length);
  const hit = new Map<string, MentionCandidate>();
  const lower = text.toLowerCase();
  let at = lower.indexOf("@");
  while (at !== -1) {
    const rest = lower.slice(at + 1);
    for (const n of names) {
      if (!rest.startsWith(n)) continue;
      const next = rest[n.length];
      if (next !== undefined && /[\p{L}\p{N}_]/u.test(next)) continue; // "@Ellie" must not match inside "@Ellien"
      for (const c of byName.get(n)!) hit.set(c.id, c);
      at += n.length;
      break;
    }
    at = lower.indexOf("@", at + 1);
  }
  return [...hit.values()];
}

function actorName(actorId: string | null | undefined): string {
  if (!actorId) return "Someone";
  return db.select({ name: schema.users.name }).from(schema.users).where(eq(schema.users.id, actorId)).get()?.name ?? "Someone";
}

/**
 * Notifies every workspace member @-mentioned in `text` (never the actor).
 * `context` names where it happened, e.g. "the task Homepage hero" or "a comment on Copy › About".
 */
export async function notifyMentions(input: { text: string; workspaceId: string; actorId: string | null; href: string; context: string }): Promise<string[]> {
  const mentioned = findMentions(input.text, mentionCandidates(input.workspaceId)).filter((c) => c.id !== input.actorId);
  if (mentioned.length === 0) return [];
  const who = actorName(input.actorId);
  const snippet = input.text.trim().replace(/\s+/g, " ").slice(0, 200);
  return Promise.all(
    mentioned.map((c) =>
      notify({
        userId: c.id,
        workspaceId: input.workspaceId,
        kind: "mention",
        title: `${who} mentioned you in ${input.context}`,
        body: snippet,
        href: input.href,
        email: true,
      }),
    ),
  );
}

/** Tells the assignee a task landed on them. Skipped when they assigned it to themselves. */
export async function notifyAssigned(input: { taskId: string; taskTitle: string; workspaceId: string; assigneeId: string; actorId: string | null; href: string }): Promise<string | null> {
  if (!input.assigneeId || input.assigneeId === input.actorId) return null;
  const who = actorName(input.actorId);
  return notify({
    userId: input.assigneeId,
    workspaceId: input.workspaceId,
    kind: "assigned",
    title: `${who} assigned you: ${input.taskTitle}`,
    href: input.href,
    email: true,
  });
}
