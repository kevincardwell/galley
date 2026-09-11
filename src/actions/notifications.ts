"use server";
import { and, eq, isNull } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { db, schema } from "@/db/client";
import { requireUser } from "@/lib/auth/current";

export type Result<T = undefined> = { ok: true; data: T } | { ok: false; error: string };

const nowS = () => Math.floor(Date.now() / 1000);

function refresh() {
  revalidatePath("/me/notifications");
  revalidatePath("/", "layout"); // the sidebar bell count
}

/** Marks one of the signed-in user's notifications read. Someone else's id is simply "Not found". */
export async function markRead(id: string): Promise<Result> {
  const user = await requireUser();
  const r = db
    .update(schema.notifications)
    .set({ readAt: nowS() })
    .where(and(eq(schema.notifications.id, id), eq(schema.notifications.userId, user.id), isNull(schema.notifications.readAt)))
    .run();
  if (r.changes > 0) refresh();
  return { ok: true, data: undefined };
}

export async function markAllRead(): Promise<Result<{ count: number }>> {
  const user = await requireUser();
  const r = db
    .update(schema.notifications)
    .set({ readAt: nowS() })
    .where(and(eq(schema.notifications.userId, user.id), isNull(schema.notifications.readAt)))
    .run();
  if (r.changes > 0) refresh();
  return { ok: true, data: { count: r.changes } };
}
