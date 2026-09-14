import { and, eq } from "drizzle-orm";
import { db, schema } from "@/db/client";
import { currentUser } from "@/lib/auth/current";
import { accessFor } from "@/lib/permissions";
import { cleanGuestName, guestRateLimit, shareWorkspace } from "@/lib/share/guard";
import { notifyShareTeam } from "@/lib/share/notify";
import { getSettings } from "@/lib/settings";
import { storage } from "@/lib/storage";
import { newId } from "@/lib/ids";
import { logActivity } from "@/lib/activity";
import { describeFile, extForMime, safeFilename } from "@/lib/media/mime";
import { enqueueAsset } from "@/lib/media/process";
import { FileTooLargeError, NotMultipartError, parseMultipartUpload, type MultipartFile } from "@/lib/media/multipart";
import type { AssetSummary, UploadResponse } from "@/lib/media/types";
import type { Workspace } from "@/db/schema";

const notFound = () => new Response(null, { status: 404 });

/**
 * POST multipart: `workspaceId`, optional `folderId`, one or more `files`.
 * Fields must come before files (the upload client does this); each file is streamed to disk as it arrives.
 *
 * Two callers, one code path. A signed-in editor uploads into a workspace they
 * can edit. A client with a share link uploads by sending `shareToken` and
 * `guestName` instead, which only works while that workspace has opted in to
 * client uploads. Either way the target — and therefore the permission — is
 * resolved from the fields before the first byte reaches disk.
 */
export async function POST(req: Request) {
  const user = await currentUser();

  const settings = getSettings();
  const maxBytes = settings.maxUploadMb * 1024 * 1024;
  const result: UploadResponse = { assets: [], errors: [] };

  // Resolved from the fields the first time a file shows up, so permission is checked before a byte hits disk.
  type Target = { ws: Workspace; folderId: string | null; userId: string | null; guestName: string | null };
  let target: Target | null | undefined;
  const resolveTarget = (fields: Readonly<Record<string, string>>): Target | null => {
    if (target !== undefined) return target;

    // The token decides, not the session. Otherwise the one person most likely to
    // try the share link — the owner, previewing their own project while signed
    // in — falls through to the workspaceId branch, finds no workspaceId, and
    // gets a bare 404.
    if (fields.shareToken) {
      const ws = shareWorkspace(fields.shareToken, "shareUploads");
      if (!ws) return (target = null);
      let guestName: string;
      try {
        guestName = cleanGuestName(fields.guestName ?? "");
        // One bucket per token, counted per request rather than per file, so a
        // client sending twenty photos at once is not punished for it.
        guestRateLimit(`upload:${fields.shareToken}`, 20);
      } catch {
        return (target = null);
      }
      // A guest never chooses a folder: they drop files in, the studio files them.
      return (target = { ws, folderId: null, userId: null, guestName });
    }

    if (!user) return (target = null);
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
    return (target = { ws, folderId, userId: user.id, guestName: null });
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
      // extForMime, not desc.ext: two accepted extensions can share one mime
      // (.jpg and .jpeg), and everything that reads a file back derives the
      // path from the stored mime. Writing under the uploaded spelling left
      // .jpeg uploads on disk under a name nothing would ever look for.
      await storage.writeOriginal(t.ws.id, id, extForMime(desc.mime), file.stream);
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
      .values({ id, workspaceId: t.ws.id, folderId: t.folderId, kind: desc.kind, filename, mime: desc.mime, bytes, uploadedBy: t.userId, guestName: t.guestName })
      .run();
    logActivity({
      workspaceId: t.ws.id,
      actorId: t.userId,
      verb: "uploaded",
      subjectType: "asset",
      subjectId: id,
      subjectTitle: filename,
      meta: { kind: desc.kind, bytes, ...(t.guestName ? { guest: t.guestName } : {}) },
    });
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
  const resolved = resolveTarget(fields);
  if (resolved === null) return notFound();
  if (seenFiles === 0) return Response.json({ error: "No files" }, { status: 400 });

  // One notification for the batch, not one per file: a client sending twelve
  // photos should not fill the studio's inbox with twelve rows.
  if (resolved.guestName && result.assets.length) {
    const n = result.assets.length;
    await notifyShareTeam(
      resolved.ws.id,
      "client_upload",
      `${resolved.guestName} sent ${n === 1 ? "a file" : `${n} files`}`,
      result.assets.map((a) => a.filename).slice(0, 5).join(", "),
      `/w/${resolved.ws.slug}/assets`,
    );
  }

  return Response.json(result, { status: result.assets.length ? 201 : 422 });
}
