import "server-only";
import fs from "node:fs";
import fsp from "node:fs/promises";
import path from "node:path";
import { pipeline } from "node:stream/promises";
import { Readable } from "node:stream";
import { UPLOAD_DIR } from "@/db/client";

export type Variant = "original" | "thumb" | "preview" | "poster";

/** Local-disk storage. Swap for S3 later by implementing the same four functions. */
export const storage = {
  dir(workspaceId: string, assetId: string) {
    return path.join(UPLOAD_DIR, workspaceId, assetId);
  },
  pathFor(workspaceId: string, assetId: string, variant: Variant, ext: string) {
    return path.join(this.dir(workspaceId, assetId), `${variant}${ext}`);
  },
  async writeOriginal(workspaceId: string, assetId: string, ext: string, body: ReadableStream<Uint8Array> | Readable) {
    const dir = this.dir(workspaceId, assetId);
    await fsp.mkdir(dir, { recursive: true });
    const dest = path.join(dir, `original${ext}`);
    const src = body instanceof Readable ? body : Readable.fromWeb(body as never);
    await pipeline(src, fs.createWriteStream(dest));
    return dest;
  },
  async remove(workspaceId: string, assetId: string) {
    await fsp.rm(this.dir(workspaceId, assetId), { recursive: true, force: true });
  },
  async removeWorkspace(workspaceId: string) {
    await fsp.rm(path.join(UPLOAD_DIR, workspaceId), { recursive: true, force: true });
  },
  exists(p: string) {
    return fs.existsSync(p);
  },
  /**
   * Finds an original that was stored under a different spelling of the same
   * type, and renames it to the canonical one.
   *
   * Uploads used to be written under the extension the file arrived with while
   * everything reading them derived the path from the stored mime, so a .jpeg
   * landed on disk as original.jpeg and was looked for as original.jpg. The
   * writer is fixed; this repairs what it already wrote, on first access, so
   * nobody has to re-upload. Returns true when it moved something.
   */
  healOriginal(workspaceId: string, assetId: string, canonical: string): boolean {
    if (fs.existsSync(canonical)) return false;
    const dir = this.dir(workspaceId, assetId);
    let found: string | undefined;
    try {
      found = fs.readdirSync(dir).find((f) => f.startsWith("original."));
    } catch {
      return false; // no directory at all: genuinely missing, not misnamed
    }
    if (!found) return false;
    try {
      fs.renameSync(path.join(dir, found), canonical);
      return true;
    } catch {
      return false;
    }
  },
  async usage(workspaceId?: string): Promise<number> {
    const root = workspaceId ? path.join(UPLOAD_DIR, workspaceId) : UPLOAD_DIR;
    let total = 0;
    async function walk(d: string) {
      let entries: fs.Dirent[] = [];
      try { entries = await fsp.readdir(d, { withFileTypes: true }); } catch { return; }
      for (const e of entries) {
        const p = path.join(d, e.name);
        if (e.isDirectory()) await walk(p);
        else total += (await fsp.stat(p)).size;
      }
    }
    await walk(root);
    return total;
  },
};
