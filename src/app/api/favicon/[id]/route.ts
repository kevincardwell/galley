import fs from "node:fs";
import path from "node:path";
import { eq } from "drizzle-orm";
import { db, schema, DATA_DIR } from "@/db/client";
import { currentUser } from "@/lib/auth/current";
import { accessFor } from "@/lib/permissions";

const TYPES: Record<string, string> = { ".png": "image/png", ".svg": "image/svg+xml", ".jpg": "image/jpeg", ".ico": "image/x-icon" };

export async function GET(_: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const user = await currentUser();
  if (!user || !accessFor(user, id)) return new Response(null, { status: 404 });
  const ws = db.select({ faviconPath: schema.workspaces.faviconPath }).from(schema.workspaces).where(eq(schema.workspaces.id, id)).get();
  if (!ws?.faviconPath) return new Response(null, { status: 404 });
  const abs = path.join(DATA_DIR, ws.faviconPath);
  if (!fs.existsSync(abs)) return new Response(null, { status: 404 });
  return new Response(fs.readFileSync(abs), { headers: { "content-type": TYPES[path.extname(abs)] ?? "application/octet-stream", "cache-control": "private, max-age=86400" } });
}
