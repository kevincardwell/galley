import "server-only";
import fsp from "node:fs/promises";
import path from "node:path";
import { eq } from "drizzle-orm";
import { db, schema, DATA_DIR } from "@/db/client";

/** Best-effort favicon fetch for the workspace card. Never throws to callers. */
export async function fetchFavicon(workspaceId: string, siteUrl: string) {
  try {
    const origin = new URL(siteUrl).origin;
    const candidates = [`${origin}/favicon.ico`, `${origin}/favicon.png`, `${origin}/apple-touch-icon.png`];
    for (const c of candidates) {
      const res = await fetch(c, { signal: AbortSignal.timeout(5000), redirect: "follow" });
      if (!res.ok) continue;
      const type = res.headers.get("content-type") ?? "";
      if (!type.startsWith("image/")) continue;
      const buf = Buffer.from(await res.arrayBuffer());
      if (buf.length < 64 || buf.length > 512 * 1024) continue;
      const ext = type.includes("png") ? ".png" : type.includes("svg") ? ".svg" : type.includes("jpeg") ? ".jpg" : ".ico";
      const dir = path.join(DATA_DIR, "favicons");
      await fsp.mkdir(dir, { recursive: true });
      const rel = `favicons/${workspaceId}${ext}`;
      await fsp.writeFile(path.join(DATA_DIR, rel), buf);
      db.update(schema.workspaces).set({ faviconPath: rel }).where(eq(schema.workspaces.id, workspaceId)).run();
      return;
    }
  } catch {
    /* ignore: the card falls back to the initial */
  }
}
