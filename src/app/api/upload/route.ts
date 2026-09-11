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
import { FileTooLargeError, NotMultipartError, parseMultipartUpload, type MultipartFile } from "@/lib/media/multipart";
import type { AssetSummary, UploadResponse } from "@/lib/media/types";
import type { Workspace } from "@/db/schema";

const notFound = () => new Response(null, { status: 404 });

/**
 * POST multipart: `workspaceId`, optional `folderId`, one or more `files`.
 * Fields must come before files (the upload client does this); each file is streamed to disk as it arrives.
 */
export async function POST(req: Request) {
  const user = await currentUser();
  if (!user) return notFound();

  const settings = getSettings();
  const maxBytes = settings.maxUploadMb * 1024 * 1024;
  const result: UploadResponse = { assets: [], errors: [] };

  // Resolved from the fields the first time a file shows up, so permission is checked before a byte hits disk.
  let target: { ws: Workspace; folderId: string | null } | null | undefined;
  const resolveTarget = (fields: Readonly<Record<string, string>>) => {
    if (target !== undefined) return target;
    const access = accessFor(user, fields.workspaceId ?? "", "edit");
    if (!access) return (target = null);
    const ws = access.workspace;
    let folderId: string | null = null;
    if (fields.folderId) {
      const folder = db
        .select({ id: schema.assetFolders.id })
        .from(schema.assetFolders)
        .where(and(eq(schema.assetFolders.id, fields.folderId), eq(schema.assetFolders.workspaceId, ws.id)))
        .get();
      folderId = folder?.id ?? null;
    }
    return (target = { ws, folderId });
  };

  let seenFiles = 0;
  const onFile = async (file: MultipartFile) => {
    const t = resolveTarget(file.fields);
    if (!t) return; // drained by the parser; the 404 goes out once the body is consumed
    const filename = safeFilename(file.filename);
    const desc = describeFile(filename);
    if (!desc) {
      seenFiles++;
      result.errors.push({ filename, error: "That file type is not accepted" });
      return;
    }
    const id = newId();
    try {
      await storage.writeOriginal(t.ws.id, id, desc.ext, file.stream);
    } catch (err) {
      await storage.remove(t.ws.id, id).catch(() => {});
      seenFiles++;
      if (err instanceof FileTooLargeError) {
        result.errors.push({ filename, error: `Larger than the ${settings.maxUploadMb} MB limit` });
      } else {
        console.error("[upload] write failed", err);
        result.errors.push({ filename, error: "Could not save the file" });
      }
      return;
    }
    const bytes = file.bytes;
    if (bytes === 0) {
      // An empty part is not a file, same as before.
      await storage.remove(t.ws.id, id).catch(() => {});
      return;
    }
    seenFiles++;
    db.insert(schema.assets)
      .values({ id, workspaceId: t.ws.id, folderId: t.folderId, kind: desc.kind, filename, mime: desc.mime, bytes, uploadedBy: user.id })
      .run();
    logActivity({ workspaceId: t.ws.id, actorId: user.id, verb: "uploaded", subjectType: "asset", subjectId: id, subjectTitle: filename, meta: { kind: desc.kind, bytes } });
    enqueueAsset(id);
    const created: AssetSummary = { id, filename, kind: desc.kind, width: null, height: null, processedAt: null };
    result.assets.push(created);
  };

  let fields: Record<string, string>;
  try {
    ({ fields } = await parseMultipartUpload(req, { onFile, maxBytes }));
  } catch (err) {
    if (err instanceof NotMultipartError) return Response.json({ error: "Expected multipart form data" }, { status: 400 });
    console.error("[upload] parse failed", err);
    return Response.json({ error: "Upload failed" }, { status: 400 });
  }

  // No file parts at all: the target is still checked so a stranger gets the same 404 as before.
  if (resolveTarget(fields) === null) return notFound();
  if (seenFiles === 0) return Response.json({ error: "No files" }, { status: 400 });

  return Response.json(result, { status: result.assets.length ? 201 : 422 });
}
