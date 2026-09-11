import Link from "next/link";
import { and, asc, desc, eq, ne } from "drizzle-orm";
import { requireUser } from "@/lib/auth/current";
import { requireAccess } from "@/lib/permissions";
import { db, schema } from "@/db/client";
import { recentActivity } from "@/lib/queries/workspaces";
import { formatDue, timeAgo } from "@/lib/format";
import { Pill } from "@/components/ui/pill";

export default async function OverviewPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const user = await requireUser();
  const { workspace: ws } = requireAccess(user, slug);
  const nextTasks = db.select().from(schema.tasks).where(and(eq(schema.tasks.workspaceId, ws.id), ne(schema.tasks.status, "done"))).orderBy(asc(schema.tasks.dueOn), asc(schema.tasks.position)).limit(6).all();
  const pages = db
    .select({ page: schema.pages })
    .from(schema.pages)
    .where(eq(schema.pages.workspaceId, ws.id))
    .orderBy(asc(schema.pages.position))
    .all()
    .map(({ page }) => {
      const secs = db.select({ status: schema.sections.status }).from(schema.sections).where(eq(schema.sections.pageId, page.id)).all();
      return { page, total: secs.length, approved: secs.filter((s) => s.status === "approved").length, review: secs.filter((s) => s.status === "review").length };
    });
  const recentAssets = db.select().from(schema.assets).where(eq(schema.assets.workspaceId, ws.id)).orderBy(desc(schema.assets.createdAt)).limit(8).all();
  const feed = recentActivity(ws.id, 12);
  const empty = nextTasks.length === 0 && pages.every((p) => p.total === 0) && recentAssets.length === 0;

  return (
    <div className="grid gap-6 px-6 py-5 lg:grid-cols-[1fr_320px]">
      <div className="flex flex-col gap-7">
        {empty && (
          <div className="rounded-[10px] border border-accent-line bg-accent-soft p-5">
            <p className="m-0 font-medium">Three things to do first</p>
            <ol className="mb-0 mt-2 flex flex-col gap-1 pl-5 text-ink-2">
              <li><Link href={`/w/${slug}/tasks`} className="underline underline-offset-[3px]">Add the first task</Link> so the plan has a shape.</li>
              <li><Link href={`/w/${slug}/copy`} className="underline underline-offset-[3px]">Write the Home page copy</Link>, even a rough draft.</li>
              <li><Link href={`/w/${slug}/assets`} className="underline underline-offset-[3px]">Drop in the logo and a few photos</Link>.</li>
            </ol>
          </div>
        )}
        <section>
          <h2 className="m-0 mb-2 flex items-baseline gap-2 text-sm font-semibold">Up next <Link href={`/w/${slug}/tasks`} className="text-xs font-normal text-ink-3 hover:text-ink">All tasks</Link></h2>
          {nextTasks.length === 0 ? <p className="m-0 text-ink-3">Nothing open.</p> : (
            <ul className="m-0 list-none divide-y divide-line-2 border-y border-line-2 p-0">
              {nextTasks.map((t) => { const due = formatDue(t.dueOn); return (
                <li key={t.id} className="flex items-center gap-3 py-2">
                  <span className="size-4 shrink-0 rounded border-[1.5px] border-ink-3" />
                  <Link href={`/w/${slug}/tasks?task=${t.id}`} className="min-w-0 flex-1 truncate hover:underline">{t.title}</Link>
                  {due.label && <span className={`tnum text-xs ${due.tone === "late" ? "text-late font-medium" : due.tone === "soon" ? "text-review font-medium" : "text-ink-2"}`}>{due.label}</span>}
                </li>
              ); })}
            </ul>
          )}
        </section>
        <section>
          <h2 className="m-0 mb-2 flex items-baseline gap-2 text-sm font-semibold">Copy <Link href={`/w/${slug}/copy`} className="text-xs font-normal text-ink-3 hover:text-ink">Open editor</Link></h2>
          <ul className="m-0 list-none divide-y divide-line-2 border-y border-line-2 p-0">
            {pages.map((p) => (
              <li key={p.page.id} className="flex items-center gap-3 py-2">
                <Link href={`/w/${slug}/copy/${p.page.slug}`} className="min-w-0 flex-1 truncate hover:underline">{p.page.title}</Link>
                {p.total === 0 ? <span className="text-xs text-ink-3">No sections yet</span> : (
                  <>
                    <span className="tnum text-xs text-ink-2">{p.approved}/{p.total} approved</span>
                    {p.review > 0 && <Pill tone="review">{p.review} in review</Pill>}
                    {p.approved === p.total && <Pill tone="done">Done</Pill>}
                  </>
                )}
              </li>
            ))}
          </ul>
        </section>
        <section>
          <h2 className="m-0 mb-2 flex items-baseline gap-2 text-sm font-semibold">Recent files <Link href={`/w/${slug}/assets`} className="text-xs font-normal text-ink-3 hover:text-ink">All files</Link></h2>
          {recentAssets.length === 0 ? <p className="m-0 text-ink-3">Nothing uploaded yet.</p> : (
            <ul className="m-0 grid list-none grid-cols-[repeat(auto-fill,minmax(96px,1fr))] gap-2 p-0">
              {recentAssets.map((a) => (
                <li key={a.id}>
                  <Link href={`/w/${slug}/assets?asset=${a.id}`} className="block aspect-square overflow-hidden rounded-r border border-line-2 bg-surface-2" title={a.filename}>
                    {a.kind === "pdf" ? <span className="grid h-full place-items-center text-xs text-ink-3">PDF</span> : <img src={`/api/file/${a.id}/thumb`} alt="" className="size-full object-cover" />}
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>
      <aside>
        <h2 className="m-0 mb-2 text-sm font-semibold">Activity</h2>
        {feed.length === 0 ? <p className="m-0 text-ink-3">Quiet so far.</p> : (
          <ul className="m-0 flex list-none flex-col gap-2.5 p-0 text-[13px]">
            {feed.map(({ a, actorName }) => (
              <li key={a.id} className="flex flex-col">
                <span><span className="font-medium">{actorName ?? "Someone"}</span> <span className="text-ink-2">{a.verb} {a.subjectType}</span>{a.subjectTitle && <span> “{a.subjectTitle}”</span>}</span>
                <span className="text-xs text-ink-3">{timeAgo(a.createdAt)}</span>
              </li>
            ))}
          </ul>
        )}
      </aside>
    </div>
  );
}
