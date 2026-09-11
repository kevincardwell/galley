import "server-only";
import { eq } from "drizzle-orm";
import { db, schema } from "@/db/client";
import { currentUser } from "@/lib/auth/current";
import { accessFor } from "@/lib/permissions";
import type { User } from "@/db/schema";

export type CollabAccess = { user: User; sectionId: string; workspaceId: string; canEdit: boolean };

/**
 * Resolves the caller and their rights on a section. Returns null for
 * anything the caller may not see (unknown section, non-member), which the
 * routes turn into a 404 so that section ids cannot be probed.
 */
export async function collabAccess(sectionId: string): Promise<CollabAccess | null> {
  const user = await currentUser();
  if (!user) return null;
  const section = db.select({ id: schema.sections.id, workspaceId: schema.sections.workspaceId }).from(schema.sections).where(eq(schema.sections.id, sectionId)).get();
  if (!section) return null;
  const view = accessFor(user, section.workspaceId, "view");
  if (!view) return null;
  const edit = accessFor(user, section.workspaceId, "edit");
  return { user, sectionId: section.id, workspaceId: section.workspaceId, canEdit: edit !== null };
}
