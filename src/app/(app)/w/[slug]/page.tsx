import Link from "next/link";
import { and, asc, count, desc, eq, ne, sum } from "drizzle-orm";
import { requireUser } from "@/lib/auth/current";
import { requireAccess } from "@/lib/permissions";
import { db, schema } from "@/db/client";
import { recentActivity } from "@/lib/queries/workspaces";
import { formatBytes } from "@/lib/format";
import { Icon } from "@/components/ui/icon";
import { Meter } from "@/components/ui/meter";
import { Screen, Section } from "@/components/ui/page";
import { Stat } from "@/components/ui/stat";
import { ActivityFeed } from "@/components/overview/activity-feed";
import { CopyProgress, type PageProgress } from "@/components/overview/copy-progress";
import { FirstSteps, type Step } from "@/components/overview/first-steps";
import { UpNext } from "@/components/overview/up-next";

const MS_DAY = 86400000;

function More({ href, children }: { href: string; children: React.ReactNode }) {
  return (
    <Link
      href={href}
      className="inline-flex cursor-pointer items-center gap-1 text-xs font-medium text-ink-3 transition-colors duration-150 ease-out hover:text-ink"
    >
      {children}
      <Icon name="chevron-right" size={13} />
    </Link>
  );
}

export default async function OverviewPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const user = await requireUser();
  const { workspace: ws } = requireAccess(user, slug);

  const openTasks = db
    .select({ id: schema.tasks.id, title: schema.tasks.title, dueOn: schema.tasks.dueOn })
    .from(schema.tasks)
    .where(and(eq(schema.tasks.workspaceId, ws.id), ne(schema.tasks.status, "done")))
    .orderBy(asc(schema.tasks.dueOn), asc(schema.tasks.position))
    .all();
  const taskTotal = db.select({ n: count() }).from(schema.tasks).where(eq(schema.tasks.workspaceId, ws.id)).get()?.n ?? 0;

  const pages: PageProgress[] = db
    .select({ page: schema.pages })
    .from(schema.pages)
    .where(eq(schema.pages.workspaceId, ws.id))
    .orderBy(asc(schema.pages.position))
    .all()
    .map(({ page }) => {
      const secs = db.select({ status: schema.sections.status }).from(schema.sections).where(eq(schema.sections.pageId, page.id)).all();
      return {
        id: page.id,
        slug: page.slug,
        title: page.title,
        total: secs.length,
        approved: secs.filter((s) => s.status === "approved").length,
        review: secs.filter((s) => s.status === "review").length,
      };
    });

  const recentAssets = db.select().from(schema.assets).where(eq(schema.assets.workspaceId, ws.id)).orderBy(desc(schema.assets.createdAt)).limit(8).all();
  const assetTotals = db
    .select({ n: count(), bytes: sum(schema.assets.bytes) })
    .from(schema.assets)
    .where(eq(schema.assets.workspaceId, ws.id))
    .get();
  const assetCount = assetTotals?.n ?? 0;
  const assetBytes = Number(assetTotals?.bytes ?? 0);
  const feed = recentActivity(ws.id, 14);

  const sectionsTotal = pages.reduce((n, p) => n + p.total, 0);
  const sectionsApproved = pages.reduce((n, p) => n + p.approved, 0);

  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const dayDiff = (iso: string) => Math.round((new Date(`${iso}T00:00:00`).getTime() - today.getTime()) / MS_DAY);
  const dated = openTasks.map((t) => t.dueOn).filter((d): d is string => Boolean(d)).sort();
  const overdue = dated.filter((d) => dayDiff(d) < 0).length;
  const nearest = dated[0] ?? null;
  const nearestDays = nearest ? dayDiff(nearest) : null;

  const steps: Step[] = [
    { href: `/w/${slug}/tasks`, icon: "checklist", label: "Add the first task", hint: "give the plan a shape", done: taskTotal > 0 },
    { href: `/w/${slug}/copy`, icon: "text", label: "Write the home page copy", hint: "a rough draft is enough", done: sectionsTotal > 0 },
    { href: `/w/${slug}/assets`, icon: "image", label: "Drop in the logo and a few photos", hint: "so the pages have something to hold", done: assetCount > 0 },
  ];

  return (
    <Screen className="flex flex-col gap-6">
      <FirstSteps steps={steps} />

      <div className="grid grid-cols-2 divide-line-2 rounded-lg border border-line bg-surface sm:grid-cols-4 sm:divide-x">
        <div className="border-b border-line-2 p-4 sm:border-b-0">
          <Stat
            icon="checklist"
            label="Open tasks"
            value={openTasks.length}
            hint={overdue > 0 ? `${overdue} overdue` : openTasks.length > 0 ? "None overdue" : "All clear"}
          />
        </div>
        <div className="border-b border-line-2 p-4 sm:border-b-0">
          <Stat
            icon="text"
            label="Copy approved"
            value={sectionsTotal === 0 ? "—" : `${sectionsApproved} of ${sectionsTotal}`}
            hint={sectionsTotal === 0 ? "No sections yet" : `${Math.round((sectionsApproved / sectionsTotal) * 100)}% signed off`}
          />
          <Meter
            className="mt-2"
            value={sectionsApproved}
            max={sectionsTotal}
            tone={sectionsTotal > 0 && sectionsApproved === sectionsTotal ? "done" : "accent"}
            label={`Copy approved: ${sectionsApproved} of ${sectionsTotal} sections`}
          />
        </div>
        <div className="p-4">
          <Stat icon="image" label="Files" value={assetCount} hint={assetCount === 0 ? "Nothing uploaded" : formatBytes(assetBytes)} />
        </div>
        <div className="p-4">
          <Stat
            icon="calendar"
            label="Next due"
            value={nearestDays === null ? "—" : nearestDays < 0 ? `${-nearestDays}d late` : nearestDays === 0 ? "Today" : `${nearestDays}d`}
            hint={nearest ? new Date(`${nearest}T00:00:00`).toLocaleDateString("en-GB", { day: "numeric", month: "short" }) : "Nothing dated"}
          />
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_320px]">
        <div className="flex min-w-0 flex-col gap-6">
          <Section title="Up next" action={<More href={`/w/${slug}/tasks`}>All tasks</More>}>
            <UpNext slug={slug} tasks={openTasks.slice(0, 6)} />
          </Section>

          <Section title="Copy progress" action={<More href={`/w/${slug}/copy`}>Open editor</More>}>
            <CopyProgress slug={slug} pages={pages} />
          </Section>

          <Section title="Recent files" action={<More href={`/w/${slug}/assets`}>All files</More>}>
            {recentAssets.length === 0 ? (
              <p className="m-0 flex items-center gap-2 rounded-r border border-line-2 bg-surface-2 px-3 py-2.5 text-[13px] text-ink-2">
                <Icon name="upload" size={15} className="text-ink-3" />
                Nothing uploaded yet.
              </p>
            ) : (
              <ul className="m-0 grid list-none grid-cols-[repeat(auto-fill,minmax(88px,1fr))] gap-2 p-0">
                {recentAssets.map((a) => (
                  <li key={a.id}>
                    <Link
                      href={`/w/${slug}/assets?asset=${a.id}`}
                      className="block aspect-square cursor-pointer overflow-hidden rounded-r border border-line-2 bg-surface-2 transition-colors duration-150 ease-out hover:border-ink-3"
                      title={a.filename}
                    >
                      {a.kind === "pdf" ? (
                        <span className="grid h-full place-items-center text-ink-3">
                          <Icon name="file" size={18} />
                        </span>
                      ) : (
                        <img src={`/api/file/${a.id}/thumb`} alt="" className="size-full object-cover" />
                      )}
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </Section>
        </div>

        <aside className="min-w-0">
          <Section title="Activity">
            <ActivityFeed
              items={feed.map(({ a, actorName }) => ({
                id: a.id,
                verb: a.verb,
                subjectType: a.subjectType,
                subjectTitle: a.subjectTitle,
                createdAt: a.createdAt,
                actorName,
              }))}
            />
          </Section>
        </aside>
      </div>
    </Screen>
  );
}
