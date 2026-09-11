import "server-only";
import { db, schema } from "@/db/client";

export function logActivity(input: {
  workspaceId: string;
  actorId: string | null;
  verb: string;
  subjectType: string;
  subjectId?: string | null;
  subjectTitle?: string | null;
  meta?: unknown;
}) {
  db.insert(schema.activity)
    .values({
      workspaceId: input.workspaceId,
      actorId: input.actorId,
      verb: input.verb,
      subjectType: input.subjectType,
      subjectId: input.subjectId ?? null,
      subjectTitle: input.subjectTitle ?? null,
      meta: input.meta ?? null,
    })
    .run();
}

export function logAudit(input: { actorId: string | null; action: string; subjectType?: string; subjectId?: string; meta?: unknown }) {
  db.insert(schema.auditLog)
    .values({ actorId: input.actorId, action: input.action, subjectType: input.subjectType ?? null, subjectId: input.subjectId ?? null, meta: input.meta ?? null })
    .run();
}
