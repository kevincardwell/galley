import "server-only";
import { and, desc, eq, sql } from "drizzle-orm";
import { db, schema } from "@/db/client";
import { newId } from "@/lib/ids";
import { logActivity } from "@/lib/activity";
import { asDoc, tiptapToText, wordCount } from "@/lib/copy/serialize";
import type { TiptapDoc } from "@/lib/copy/serialize";

const MAX_VERSIONS = 100;
const ACTIVITY_GAP_SEC = 5 * 60;

export type Snapshot = { version: number; updatedAt: number; changed: boolean };

// "updated" activity is noisy for a live document, so it is rate-limited per
// section per user. The map lives on globalThis to survive dev-mode reloads.
const g = globalThis as unknown as { __galleyActivityStamp?: Map<string, number> };
const lastLogged = (g.__galleyActivityStamp ??= new Map<string, number>());

/**
 * Writes the current Yjs-derived content of a section into the classic
 * columns (content, plain_text, word_count, version) and the version history.
 * The collaboration hub calls this whenever it persists; the rest of the app
 * (search, share view, versions, exports) keeps reading these columns.
 *
 * This lives outside src/actions on purpose: a "use server" export would be a
 * publicly callable endpoint, and this must only run from trusted server code.
 * Callers are expected to wrap it in a transaction together with the ydoc write.
 */
export function snapshotSection(sectionId: string, content: TiptapDoc, userId: string | null): Snapshot {
  const section = db.select().from(schema.sections).where(eq(schema.sections.id, sectionId)).get();
  if (!section) throw new Error("Not found");
  const doc = asDoc(content);
  if (JSON.stringify(doc) === JSON.stringify(asDoc(section.content))) {
    return { version: section.version, updatedAt: section.updatedAt, changed: false };
  }
  const plainText = tiptapToText(doc);
  const words = wordCount(plainText);
  const version = section.version + 1;
  const updatedAt = Math.floor(Date.now() / 1000);

  db.update(schema.sections)
    .set({ content: doc, plainText, wordCount: words, version, updatedBy: userId ?? section.updatedBy, updatedAt })
    .where(eq(schema.sections.id, sectionId))
    .run();
  db.insert(schema.sectionVersions).values({ id: newId(), sectionId, version, content: doc, plainText, wordCount: words, createdBy: userId }).run();
  pruneVersions(sectionId);

  if (userId) {
    const key = `${sectionId}:${userId}`;
    const last = lastLogged.get(key) ?? 0;
    if (updatedAt - last >= ACTIVITY_GAP_SEC) {
      lastLogged.set(key, updatedAt);
      logActivity({ workspaceId: section.workspaceId, actorId: userId, verb: "updated", subjectType: "section", subjectId: sectionId, subjectTitle: section.title });
    }
  }
  return { version, updatedAt, changed: true };
}

function pruneVersions(sectionId: string) {
  const keep = db
    .select({ id: schema.sectionVersions.id })
    .from(schema.sectionVersions)
    .where(eq(schema.sectionVersions.sectionId, sectionId))
    .orderBy(desc(schema.sectionVersions.version))
    .limit(MAX_VERSIONS)
    .all()
    .map((r) => r.id);
  if (keep.length < MAX_VERSIONS) return;
  db.delete(schema.sectionVersions)
    .where(and(eq(schema.sectionVersions.sectionId, sectionId), sql`${schema.sectionVersions.id} not in (${sql.join(keep.map((k) => sql`${k}`), sql`, `)})`))
    .run();
}
