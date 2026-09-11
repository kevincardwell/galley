import { sql, eq, and, ne } from "drizzle-orm";
import { requireUser } from "@/lib/auth/current";
import { requireAccess } from "@/lib/permissions";
import { db, schema } from "@/db/client";
import { Pill } from "@/components/ui/pill";
import { WorkspaceTabs } from "@/components/workspaces/tabs";
import { WorkspaceHeaderActions } from "@/components/workspaces/header-actions";

const STATUS_LABEL: Record<string, string> = { planning: "Planning", building: "Building", review: "In review", live: "Live", archived: "Archived" };

export default async function WorkspaceLayout({ children, params }: { children: React.ReactNode; params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const user = await requireUser();
  const access = requireAccess(user, slug);
  const ws = access.workspace;
  const counts = db
    .select({
      open: sql<number>`(select count(*) from tasks where workspace_id = ${ws.id} and status != 'done')`,
      approved: sql<number>`(select count(*) from sections where workspace_id = ${ws.id} and status = 'approved')`,
      sections: sql<number>`(select count(*) from sections where workspace_id = ${ws.id})`,
      assets: sql<number>`(select count(*) from assets where workspace_id = ${ws.id})`,
    })
    .from(schema.workspaces)
    .where(and(eq(schema.workspaces.id, ws.id), ne(schema.workspaces.id, "")))
    .get()!;
  const canManage = access.role === "admin" || access.role === "manager";
  return (
    <div className="flex min-h-full flex-col" style={{ ["--accent" as string]: ws.accent }}>
      <header className="min-w-0 border-b border-line px-6 pt-4" style={{ background: "linear-gradient(to bottom, var(--accent-soft), var(--surface) 78%)" }}>
        <div className="flex flex-wrap items-start gap-3.5">
          <span className="grid size-9 shrink-0 place-items-center overflow-hidden rounded-lg bg-accent font-serif text-base font-semibold text-accent-ink">
            {ws.faviconPath ? <img src={`/api/favicon/${ws.id}`} alt="" className="size-5" /> : ws.name[0]}
          </span>
          <div className="min-w-0">
            <h1 className="m-0 truncate text-xl font-semibold tracking-tight">{ws.name}</h1>
            <div className="mt-0.5 flex flex-wrap gap-3.5 text-ink-2">
              {ws.url && <a href={ws.url} target="_blank" rel="noreferrer" className="underline decoration-line underline-offset-[3px]">{ws.url.replace(/^https?:\/\//, "")}</a>}
              {ws.clientName && <span>Client: {ws.clientName}</span>}
              <Pill tone="accent">{STATUS_LABEL[ws.status]}</Pill>
            </div>
          </div>
          <div className="ml-auto"><WorkspaceHeaderActions workspaceId={ws.id} slug={ws.slug} shareToken={ws.shareToken} canManage={canManage} shareReview={ws.shareReview} /></div>
        </div>
        <WorkspaceTabs slug={ws.slug} counts={{ open: counts.open, approved: counts.approved, sections: counts.sections, assets: counts.assets }} canManage={canManage} />
      </header>
      <div className="flex min-h-0 min-w-0 flex-1 flex-col">{children}</div>
    </div>
  );
}
