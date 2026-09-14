import "server-only";
import { and, eq, inArray } from "drizzle-orm";
import { db, schema } from "@/db/client";
import { notify } from "@/lib/notify";

export type ShareNotifyKind = "client_comment" | "client_approved" | "client_upload";

/**
 * One inbox row (and an email when mail is configured) per manager/editor of the
 * workspace. Everything a client does through the share link routes through
 * here, so the studio never has to go looking for it.
 */
export async function notifyShareTeam(
  workspaceId: string,
  kind: ShareNotifyKind,
  title: string,
  body: string | null,
  href: string,
): Promise<void> {
  const members = db
    .select({ userId: schema.memberships.userId })
    .from(schema.memberships)
    .where(and(eq(schema.memberships.workspaceId, workspaceId), inArray(schema.memberships.role, ["manager", "editor"])))
    .all();
  await Promise.all(members.map((m) => notify({ userId: m.userId, workspaceId, kind, title, body, href, email: true })));
}
