"use server";
import { and, eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { db, schema } from "@/db/client";
import { WORKSPACE_ROLES } from "@/db/schema";
import { requireUser } from "@/lib/auth/current";
import { assertAccess } from "@/lib/permissions";
import { logActivity, logAudit } from "@/lib/activity";

export async function addMember(workspaceId: string, userId: string, role: (typeof WORKSPACE_ROLES)[number]) {
  const user = await requireUser();
  const { workspace } = assertAccess(user, workspaceId, "manage");
  if (!WORKSPACE_ROLES.includes(role)) throw new Error("Unknown role");
  const target = db.select().from(schema.users).where(eq(schema.users.id, userId)).get();
  if (!target) throw new Error("Not found");
  db.insert(schema.memberships)
    .values({ workspaceId: workspace.id, userId, role, addedBy: user.id })
    .onConflictDoUpdate({ target: [schema.memberships.workspaceId, schema.memberships.userId], set: { role } })
    .run();
  logActivity({ workspaceId: workspace.id, actorId: user.id, verb: "added", subjectType: "member", subjectId: userId, subjectTitle: target.name, meta: { role } });
  logAudit({ actorId: user.id, action: "member.set", subjectType: "workspace", subjectId: workspace.id, meta: { userId, role } });
  revalidatePath("/", "layout");
}

export async function removeMember(workspaceId: string, userId: string) {
  const user = await requireUser();
  const { workspace } = assertAccess(user, workspaceId, "manage");
  db.delete(schema.memberships).where(and(eq(schema.memberships.workspaceId, workspace.id), eq(schema.memberships.userId, userId))).run();
  logAudit({ actorId: user.id, action: "member.removed", subjectType: "workspace", subjectId: workspace.id, meta: { userId } });
  revalidatePath("/", "layout");
}

export async function setMemberRole(workspaceId: string, userId: string, role: string) {
  const parsed = z.enum(WORKSPACE_ROLES).safeParse(role);
  if (!parsed.success) throw new Error("Unknown role");
  await addMember(workspaceId, userId, parsed.data);
}
