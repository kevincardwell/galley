import fs from "node:fs";
import fsp from "node:fs/promises";
import { Readable } from "node:stream";
import { currentUser } from "@/lib/auth/current";
import { backupPath, getBackup } from "@/lib/backup";

const notFound = () => new Response(null, { status: 404 });

/** Streams one backup zip to an instance admin. Anyone else gets 404, never 403. */
export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const user = await currentUser();
  if (!user?.isAdmin) return notFound();
  const { id } = await params;
  const row = getBackup(id);
  if (!row) return notFound();
  const file = backupPath(row);
  const stat = await fsp.stat(file).catch(() => null);
  if (!stat?.isFile()) return notFound();
  const body = Readable.toWeb(fs.createReadStream(file)) as ReadableStream;
  return new Response(body, {
    headers: {
      "content-type": "application/zip",
      "content-length": String(stat.size),
      "content-disposition": `attachment; filename="${row.filename.replace(/[^\w.-]/g, "_")}"`,
      "cache-control": "private, no-store",
    },
  });
}
