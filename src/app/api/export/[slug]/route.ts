import path from "node:path";
import { variantExt } from "@/lib/media/paths";
import { PassThrough, Readable } from "node:stream";
import { ZipArchive } from "archiver";
import { asc, eq } from "drizzle-orm";
import { db, schema } from "@/db/client";
import { currentUser } from "@/lib/auth/current";
import { accessFor } from "@/lib/permissions";
import { storage } from "@/lib/storage";
import { listPages, listSections } from "@/lib/queries/copy";
import { tiptapToMarkdown } from "@/lib/copy/serialize";

function csvCell(v: string | number | null | undefined): string {
  const s = v == null ? "" : String(v);
  return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

function safeName(name: string): string {
  return name.replace(/[\\/:*?"<>|\x00-\x1f]/g, "_").trim() || "file";
}

function pageMarkdown(title: string, sections: ReturnType<typeof listSections>): string {
  const parts = [`# ${title}`];
  for (const s of sections) {
    parts.push(`## ${s.title}\n<!-- status: ${s.status} -->\n\n${tiptapToMarkdown(s.content)}`.trimEnd());
  }
  return parts.join("\n\n") + "\n";
}

/** Streams `<slug>-export.zip`: copy as Markdown, tasks as CSV, and every original asset. */
export async function GET(_req: Request, { params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const user = await currentUser();
  if (!user) return new Response("Sign in first", { status: 401 });
  const access = accessFor(user, slug, "view");
  if (!access) return new Response("Not found", { status: 404 });
  const ws = access.workspace;

  const archive = new ZipArchive({ zlib: { level: 6 } });
  const out = new PassThrough();
  archive.on("warning", () => {});
  archive.on("error", (err: Error) => out.destroy(err));
  archive.pipe(out);

  // Copy
  const all: string[] = [];
  const usedNames = new Set<string>();
  for (const page of listPages(ws.id)) {
    const sections = listSections(page.id);
    const md = pageMarkdown(page.title, sections);
    let name = page.slug;
    let i = 2;
    while (usedNames.has(name)) name = `${page.slug}-${i++}`;
    usedNames.add(name);
    archive.append(md, { name: `copy/${name}.md` });
    all.push(md.trimEnd());
  }
  archive.append(all.join("\n\n---\n\n") + "\n", { name: "copy/all.md" });

  // Tasks
  const tasks = db
    .select({
      section: schema.taskSections.name,
      title: schema.tasks.title,
      status: schema.tasks.status,
      assignee: schema.users.name,
      due: schema.tasks.dueOn,
      created: schema.tasks.createdAt,
      sectionPos: schema.taskSections.position,
      pos: schema.tasks.position,
    })
    .from(schema.tasks)
    .innerJoin(schema.taskSections, eq(schema.taskSections.id, schema.tasks.sectionId))
    .leftJoin(schema.users, eq(schema.users.id, schema.tasks.assigneeId))
    .where(eq(schema.tasks.workspaceId, ws.id))
    .orderBy(asc(schema.taskSections.position), asc(schema.tasks.position))
    .all();
  const csv = [
    ["section", "title", "status", "assignee", "due", "created"].join(","),
    ...tasks.map((t) => [t.section, t.title, t.status, t.assignee ?? "", t.due ?? "", new Date(t.created * 1000).toISOString().slice(0, 10)].map(csvCell).join(",")),
  ].join("\r\n");
  archive.append(csv + "\r\n", { name: "tasks.csv" });

  // Assets: originals straight from disk, skipping anything not on the volume.
  const assets = db
    .select({ id: schema.assets.id, filename: schema.assets.filename, mime: schema.assets.mime })
    .from(schema.assets)
    .where(eq(schema.assets.workspaceId, ws.id))
    .orderBy(asc(schema.assets.createdAt))
    .all();
  const usedFiles = new Set<string>();
  for (const a of assets) {
    const file = storage.pathFor(ws.id, a.id, "original", variantExt(a, "original"));
    if (!storage.exists(file)) continue;
    let name = safeName(a.filename);
    if (usedFiles.has(name)) {
      const ext = path.extname(name);
      name = `${name.slice(0, name.length - ext.length)}-${a.id.slice(0, 6)}${ext}`;
    }
    usedFiles.add(name);
    archive.file(file, { name: `assets/${name}` });
  }

  void archive.finalize();

  // Readable.toWeb keeps backpressure: a slow download pauses archiver instead of buffering the zip in memory.
  const body = Readable.toWeb(out) as unknown as ReadableStream<Uint8Array>;

  return new Response(body, {
    headers: {
      "Content-Type": "application/zip",
      "Content-Disposition": `attachment; filename="${safeName(ws.slug)}-export.zip"`,
      "Cache-Control": "no-store",
    },
  });
}
