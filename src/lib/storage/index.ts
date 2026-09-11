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
