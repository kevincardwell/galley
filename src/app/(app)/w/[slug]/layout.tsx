import { sql, eq, and, ne } from "drizzle-orm";
import { requireUser } from "@/lib/auth/current";
import { requireAccess } from "@/lib/permissions";
import { db, schema } from "@/db/client";
import { Pill } from "@/components/ui/pill";
import { Icon } from "@/components/ui/icon";
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
      <header className="min-w-0 border-b border-line px-4 pt-3 sm:px-6" style={{ background: "linear-gradient(to bottom, var(--accent-soft), var(--surface) 78%)" }}>
        <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
          <span className="grid size-7 shrink-0 place-items-center overflow-hidden rounded-r bg-accent font-serif text-[13px] font-semibold text-accent-ink">
            {ws.faviconPath ? <img src={`/api/favicon/${ws.id}`} alt="" className="size-4" /> : ws.name[0]}
          </span>
          <h1 className="m-0 max-w-full truncate text-[19px] leading-tight font-semibold tracking-tight">{ws.name}</h1>
          <div className="flex min-w-0 flex-wrap items-center gap-x-3 gap-y-1 text-[13px] text-ink-2">
            {ws.url && (
              <a
                href={ws.url}
                target="_blank"
                rel="noreferrer"
                className="inline-flex cursor-pointer items-center gap-1 truncate transition-colors duration-150 ease-out hover:text-ink"
              >
                {ws.url.replace(/^https?:\/\//, "").replace(/\/$/, "")}
                <Icon name="external" size={12} className="text-ink-3" />
              </a>
            )}
            {ws.clientName && <span className="truncate">{ws.clientName}</span>}
            <Pill tone="accent">{STATUS_LABEL[ws.status]}</Pill>
          </div>
          <div className="ml-auto shrink-0"><WorkspaceHeaderActions workspaceId={ws.id} slug={ws.slug} shareToken={ws.shareToken} canManage={canManage} shareReview={ws.shareReview} /></div>
        </div>
        <WorkspaceTabs slug={ws.slug} counts={{ open: counts.open, approved: counts.approved, sections: counts.sections, assets: counts.assets }} canManage={canManage} />
      </header>
      <div className="flex min-h-0 min-w-0 flex-1 flex-col">{children}</div>
    </div>
  );
}
