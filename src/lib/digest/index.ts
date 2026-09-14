import "server-only";
import { and, desc, eq, gt, inArray, isNull, ne } from "drizzle-orm";
import { db, schema } from "@/db/client";
import { getSettings } from "@/lib/settings";
import { sendEmail } from "@/lib/email";
import { digestEmail } from "@/lib/email/templates";
import { resolveBaseUrl } from "@/lib/queries/admin";
import type { Workspace } from "@/db/schema";

/**
 * The weekly note to the client: what the studio did, and what it is waiting on.
 *
 * Only what a client can actually see through the share link counts — copy and
 * files. Tasks, suppliers and the calendar are the studio's business and never
 * appear here.
 */

export const DIGEST_WINDOW_DAYS = 7;
/**
 * How long after a send the project is considered done for this week. Longer
 * than the sending hour so sixty scheduler ticks, a restart, or an impatient
 * second click on "Send now" cannot mail the client twice.
 */
const ALREADY_SENT_SEC = 20 * 3600;

/** False when this project's digest has already gone out recently. */
export function dueForDigest(ws: Workspace, now = new Date()): boolean {
  if (!ws.digestSentAt) return true;
  return ws.digestSentAt <= Math.floor(now.getTime() / 1000) - ALREADY_SENT_SEC;
}

/** Verbs a client would recognise, mapped to how we say it to them. */
const SAID: Record<string, (title: string) => string> = {
  updated: (t) => `Rewrote ${t}`,
  created: (t) => `Started ${t}`,
  approved: (t) => `Marked ${t} as approved`,
  uploaded: (t) => `Added ${t}`,
};

export type Digest = {
  changes: string[];
  waitingOn: string[];
  /** Nothing to report means nothing is sent: an empty weekly email trains people to ignore it. */
  worthSending: boolean;
};

export function buildDigest(workspaceId: string, since: number): Digest {
  const rows = db
    .select()
    .from(schema.activity)
    .where(
      and(
        eq(schema.activity.workspaceId, workspaceId),
        gt(schema.activity.createdAt, since),
        inArray(schema.activity.subjectType, ["section", "asset"]),
        inArray(schema.activity.verb, Object.keys(SAID)),
      ),
    )
    .orderBy(desc(schema.activity.createdAt))
    .all();

  // One line per thing, newest first, no matter how many times it was touched.
  const seen = new Set<string>();
  const changes: string[] = [];
  for (const r of rows) {
    if (!r.subjectTitle) continue;
    // A file the client sent in is not news to the client.
    if (r.subjectType === "asset" && (r.meta as { guest?: string } | null)?.guest) continue;
    const key = `${r.subjectType}:${r.subjectId}`;
    if (seen.has(key)) continue;
    seen.add(key);
    changes.push((SAID[r.verb] ?? ((t: string) => t))(r.subjectTitle));
    if (changes.length >= 8) break;
  }

  const waitingOn = db
    .select({ title: schema.sections.title, page: schema.pages.title })
    .from(schema.sections)
    .innerJoin(schema.pages, eq(schema.pages.id, schema.sections.pageId))
    .where(
      and(
        eq(schema.sections.workspaceId, workspaceId),
        eq(schema.sections.status, "review"),
        isNull(schema.sections.clientApprovedAt),
      ),
    )
    .orderBy(schema.pages.position, schema.sections.position)
    .all()
    .map((r) => `${r.page} › ${r.title}`);

  return { changes, waitingOn, worthSending: changes.length > 0 || waitingOn.length > 0 };
}

/**
 * Sends one workspace's digest. Returns false when there was nothing to say, no
 * client address, or no share link to point at — none of which is an error.
 */
export async function sendWorkspaceDigest(ws: Workspace, now = new Date()): Promise<boolean> {
  if (!ws.clientEmail || !ws.shareToken || ws.archivedAt) return false;
  if (!dueForDigest(ws, now)) return false;
  const since = ws.digestSentAt ?? Math.floor(now.getTime() / 1000) - DIGEST_WINDOW_DAYS * 86400;
  const digest = buildDigest(ws.id, since);
  if (!digest.worthSending) return false;

  const { instanceName } = getSettings();
  const mail = digestEmail({
    instanceName,
    projectName: ws.name,
    changes: digest.changes,
    waitingOn: digest.waitingOn,
    shareUrl: `${await resolveBaseUrl()}/share/${ws.shareToken}`,
  });

  const res = await sendEmail({ to: ws.clientEmail, ...mail });
  if (!res.ok) return false;

  db.update(schema.workspaces)
    .set({ digestSentAt: Math.floor(now.getTime() / 1000) })
    .where(eq(schema.workspaces.id, ws.id))
    .run();
  return true;
}

/** Every live project with a client address. Exported for the admin "send now" button. */
export function digestCandidates(): Workspace[] {
  return db
    .select()
    .from(schema.workspaces)
    .where(and(isNull(schema.workspaces.archivedAt), ne(schema.workspaces.clientEmail, "")))
    .all()
    .filter((w) => !!w.clientEmail && !!w.shareToken);
}
