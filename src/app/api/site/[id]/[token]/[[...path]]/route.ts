import fs from "node:fs";
import fsp from "node:fs/promises";
import { Readable } from "node:stream";
import { db, schema } from "@/db/client";
import { eq } from "drizzle-orm";
import { timingSafeEqualStr } from "@/lib/secure-compare";
import { mimeFor, resolveServed, siteRoot } from "@/lib/site/files";
import { previewHtml, rewriteCss } from "@/lib/site/html";
import { previewPrefix } from "@/lib/site";

/**
 * The preview of a site's working copy.
 *
 * The site's own JavaScript runs here, and any member can change it, so it must never run as the
 * person looking at it: the `sandbox` policy gives every page an opaque origin, which cannot read
 * Galley's cookies or call its actions with them. That is also why this route cannot use the
 * session and is guarded by an unguessable token in the path instead. Galley's global headers skip
 * this path (next.config.ts) so nothing here is merged with the app's own policy.
 */
const HEADERS = {
  "content-security-policy": "sandbox allow-scripts allow-forms allow-popups allow-modals; frame-ancestors 'self'",
  "x-frame-options": "SAMEORIGIN",
  "x-content-type-options": "nosniff",
  // The token is in the URL; never hand it to another site in a Referer.
  "referrer-policy": "no-referrer",
  // An opaque origin makes fonts, module scripts and fetch() cross-origin requests.
  "access-control-allow-origin": "*",
  "cache-control": "no-store",
};

const notFound = () => new Response("Not found", { status: 404, headers: { ...HEADERS, "content-type": "text/plain; charset=utf-8" } });

type Params = { params: Promise<{ id: string; token: string; path?: string[] }> };

export async function GET(req: Request, { params }: Params) {
  const { id, token, path = [] } = await params;
  const site = db.select().from(schema.sites).where(eq(schema.sites.workspaceId, id)).get();
  if (!site || !timingSafeEqualStr(site.previewToken, token)) return notFound();
  const ws = db.select({ archivedAt: schema.workspaces.archivedAt }).from(schema.workspaces).where(eq(schema.workspaces.id, id)).get();
  if (!ws || ws.archivedAt) return notFound();

  const urlPath = path.join("/");
  if (/\.php$/i.test(urlPath)) {
    return new Response("PHP doesn't run in the preview.", { status: 503, headers: { ...HEADERS, "content-type": "text/plain; charset=utf-8" } });
  }
  const root = siteRoot(site);
  const hit = await resolveServed(root, urlPath);
  if (!hit) {
    const custom = await resolveServed(root, "404.html");
    if (!custom) return notFound();
    return html(await fsp.readFile(custom.file, "utf8"), site, custom.rel, undefined, 404);
  }

  const type = mimeFor(hit.file);
  if (type.startsWith("text/html")) {
    // A folder's index.html reached without its trailing slash: Next drops the slash, so tell
    // relative links where they are.
    const isIndex = hit.rel !== urlPath && hit.rel.endsWith("index.html");
    const base = isIndex ? `${previewPrefix(site)}/${hit.rel.slice(0, -"index.html".length)}` : undefined;
    return html(await fsp.readFile(hit.file, "utf8"), site, hit.rel, base);
  }
  if (type.startsWith("text/css")) {
    const css = rewriteCss(await fsp.readFile(hit.file, "utf8"), previewPrefix(site));
    return new Response(css, { headers: { ...HEADERS, "content-type": type } });
  }
  const stat = await fsp.stat(hit.file);
  const body = req.method === "HEAD" ? null : (Readable.toWeb(fs.createReadStream(hit.file)) as ReadableStream);
  return new Response(body, { headers: { ...HEADERS, "content-type": type, "content-length": String(stat.size) } });
}

function html(src: string, site: { workspaceId: string; previewToken: string }, rel: string, base?: string, status = 200) {
  const page = previewHtml(src, { prefix: previewPrefix(site), file: rel, base, script: "/site-editor.js" });
  return new Response(page, { status, headers: { ...HEADERS, "content-type": "text/html; charset=utf-8" } });
}

export const HEAD = GET;
