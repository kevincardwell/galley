import "server-only";
import { eq } from "drizzle-orm";
import { db, schema } from "@/db/client";
import { newId } from "@/lib/ids";

type Tx = Parameters<Parameters<typeof db.transaction>[0]>[0];

/**
 * Copies the shape of an existing project into a new one: task sections and the
 * titles of their tasks, pages and the titles of their copy sections.
 *
 * Deliberately not copied — anything that belongs to the old project rather than
 * to the shape of the work: task bodies, assignees, due dates and done state,
 * the copy itself, files, suppliers, members, share links.
 */
export function copyStructure(tx: Tx, fromId: string, toId: string, userId: string) {
  for (const sec of db.select().from(schema.taskSections).where(eq(schema.taskSections.workspaceId, fromId)).orderBy(schema.taskSections.position).all()) {
    const sectionId = newId();
    tx.insert(schema.taskSections).values({ id: sectionId, workspaceId: toId, name: sec.name, position: sec.position }).run();
    for (const task of db.select().from(schema.tasks).where(eq(schema.tasks.sectionId, sec.id)).orderBy(schema.tasks.position).all()) {
      tx.insert(schema.tasks).values({ id: newId(), workspaceId: toId, sectionId, title: task.title, position: task.position, createdBy: userId }).run();
    }
  }
  for (const page of db.select().from(schema.pages).where(eq(schema.pages.workspaceId, fromId)).orderBy(schema.pages.position).all()) {
    const pageId = newId();
    tx.insert(schema.pages).values({ id: pageId, workspaceId: toId, title: page.title, slug: page.slug, position: page.position }).run();
    for (const sec of db.select().from(schema.sections).where(eq(schema.sections.pageId, page.id)).orderBy(schema.sections.position).all()) {
      tx.insert(schema.sections).values({ id: newId(), pageId, workspaceId: toId, title: sec.title, position: sec.position, updatedBy: userId }).run();
    }
  }
}
