import { currentUser } from "@/lib/auth/current";
import { db, schema, sqlite } from "@/db/client";
import { listWorkspacesFor } from "@/lib/queries/workspaces";
import { eq } from "drizzle-orm";

export async function GET(req: Request) {
  const user = await currentUser();
  if (!user) return new Response(null, { status: 401 });
  const q = (new URL(req.url).searchParams.get("q") ?? "").trim();
  const visible = listWorkspacesFor(user, true).map((r) => r.ws);
  const byId = new Map(visible.map((w) => [w.id, w]));
  const hits: { kind: string; title: string; subtitle?: string; href: string }[] = [];

  for (const w of visible) {
    if (!q || w.name.toLowerCase().includes(q.toLowerCase())) hits.push({ kind: "workspace", title: w.name, subtitle: w.clientName ?? undefined, href: `/w/${w.slug}` });
  }
  if (q && visible.length) {
    const ids = visible.map((w) => w.id);
    const match = q.replace(/["*]/g, " ").split(/\s+/).filter(Boolean).map((t) => `"${t}"*`).join(" ");
    const rows = sqlite
      .prepare(`select workspace_id, kind, subject_id, title from search_fts where search_fts match ? and workspace_id in (${ids.map(() => "?").join(",")}) order by rank limit 20`)
      .all(match, ...ids) as { workspace_id: string; kind: string; subject_id: string; title: string }[];
    for (const r of rows) {
      const w = byId.get(r.workspace_id)!;
      if (r.kind === "task") hits.push({ kind: "task", title: r.title, subtitle: w.name, href: `/w/${w.slug}/tasks?task=${r.subject_id}` });
      else if (r.kind === "asset") hits.push({ kind: "asset", title: r.title, subtitle: w.name, href: `/w/${w.slug}/assets?asset=${r.subject_id}` });
      else if (r.kind === "section") {
        const s = db.select({ pageSlug: schema.pages.slug, pageTitle: schema.pages.title }).from(schema.sections).innerJoin(schema.pages, eq(schema.pages.id, schema.sections.pageId)).where(eq(schema.sections.id, r.subject_id)).get();
        if (s) hits.push({ kind: "section", title: r.title, subtitle: `${w.name} › ${s.pageTitle}`, href: `/w/${w.slug}/copy/${s.pageSlug}#s-${r.subject_id}` });
      }
    }
  }
  return Response.json(hits.slice(0, 25));
}
