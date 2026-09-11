import { and, eq } from "drizzle-orm";
import { db, schema } from "@/db/client";
import { currentUser } from "@/lib/auth/current";
import { accessFor } from "@/lib/permissions";
import { getSettings } from "@/lib/settings";
import { storage } from "@/lib/storage";
import { newId } from "@/lib/ids";
import { logActivity } from "@/lib/activity";
import { describeFile, safeFilename } from "@/lib/media/mime";
import { enqueueAsset } from "@/lib/media/process";
import type { AssetSummary, UploadResponse } from "@/lib/media/types";

const notFound = () => new Response(null, { status: 404 });

/**
 * POST multipart: `workspaceId`, optional `folderId`, one or more `files`.
 * Next buffers `formData()`; each File is still streamed from that buffer to disk rather than copied into a second Buffer.
 */
export async function POST(req: Request) {
  const user = await currentUser();
  if (!user) return notFound();

  let form: FormData;
  try {
    form = await req.formData();
  } catch {
    return Response.json({ error: "Expected multipart form data" }, { status: 400 });
  }

  const workspaceId = String(form.get("workspaceId") ?? "");
  const access = accessFor(user, workspaceId, "edit");
  if (!access) return notFound();
  const ws = access.workspace;

  let folderId: string | null = null;
  const requestedFolder = form.get("folderId");
  if (typeof requestedFolder === "string" && requestedFolder) {
    const folder = db
      .select({ id: schema.assetFolders.id })
      .from(schema.assetFolders)
      .where(and(eq(schema.assetFolders.id, requestedFolder), eq(schema.assetFolders.workspaceId, ws.id)))
      .get();
    folderId = folder?.id ?? null;
  }

  const files = form.getAll("files").filter((f): f is File => f instanceof File && f.size > 0);
  if (files.length === 0) return Response.json({ error: "No files" }, { status: 400 });

  const maxBytes = getSettings().maxUploadMb * 1024 * 1024;
  const result: UploadResponse = { assets: [], errors: [] };

  for (const file of files) {
    const filename = safeFilename(file.name);
    const desc = describeFile(filename);
    if (!desc) {
      result.errors.push({ filename, error: "That file type is not accepted" });
      continue;
    }
    if (file.size > maxBytes) {
      result.errors.push({ filename, error: `Larger than the ${getSettings().maxUploadMb} MB limit` });
      continue;
    }
    const id = newId();
    try {
      await storage.writeOriginal(ws.id, id, desc.ext, file.stream());
    } catch (err) {
      console.error("[upload] write failed", err);
      await storage.remove(ws.id, id).catch(() => {});
      result.errors.push({ filename, error: "Could not save the file" });
      continue;
    }
    db.insert(schema.assets)
      .values({ id, workspaceId: ws.id, folderId, kind: desc.kind, filename, mime: desc.mime, bytes: file.size, uploadedBy: user.id })
      .run();
    logActivity({ workspaceId: ws.id, actorId: user.id, verb: "uploaded", subjectType: "asset", subjectId: id, subjectTitle: filename, meta: { kind: desc.kind, bytes: file.size } });
    enqueueAsset(id);
    const created: AssetSummary = { id, filename, kind: desc.kind, width: null, height: null, processedAt: null };
    result.assets.push(created);
  }

  return Response.json(result, { status: result.assets.length ? 201 : 422 });
}
