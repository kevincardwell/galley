import Link from "next/link";
import { Icon, type IconName } from "@/components/ui/icon";
import { Meter } from "@/components/ui/meter";
import { Pill } from "@/components/ui/pill";
import { timeAgo } from "@/lib/format";

type Tone = "accent" | "review" | "done" | "draft" | "neutral";
export const WORKSPACE_STATUS: Record<string, { label: string; tone: Tone }> = {
  planning: { label: "Planning", tone: "neutral" },
  building: { label: "Building", tone: "accent" },
  review: { label: "In review", tone: "review" },
  live: { label: "Live", tone: "done" },
  archived: { label: "Archived", tone: "draft" },
};

export type WorkspaceCardData = {
  id: string;
  slug: string;
  name: string;
  accent: string;
  status: string;
  clientName: string | null;
  url: string | null;
  faviconPath: string | null;
  openTasks: number;
  approvedSections: number;
  totalSections: number;
  assetCount: number;
  lastActivity: number | null;
};

function Fact({ icon, value, label }: { icon: IconName; value: string; label: string }) {
  return (
    <span className="inline-flex min-w-0 items-center gap-1.5 text-xs text-ink-3" title={`${value} ${label}`}>
      <Icon name={icon} size={13} />
      <span className="tnum truncate text-ink-2">{value}</span>
      <span className="truncate max-sm:hidden">{label}</span>
    </span>
  );
}

/** One website on the index: who it is, how far the copy has got, three facts. */
export function WorkspaceCard({ ws }: { ws: WorkspaceCardData }) {
  const status = WORKSPACE_STATUS[ws.status] ?? WORKSPACE_STATUS.planning;
  const complete = ws.totalSections > 0 && ws.approvedSections === ws.totalSections;
  const sub = ws.clientName || ws.url?.replace(/^https?:\/\//, "").replace(/\/$/, "") || "No client yet";
  return (
    <Link
      href={`/w/${ws.slug}`}
      style={{ ["--accent" as string]: ws.accent }}
      className="group flex h-full cursor-pointer flex-col gap-3.5 rounded-lg border border-line bg-surface p-4 transition-colors duration-150 ease-out hover:border-ink-3 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 focus-visible:ring-offset-surface"
    >
      <div className="flex items-start gap-3">
        <span className="grid size-9 shrink-0 place-items-center overflow-hidden rounded-lg bg-accent font-serif text-base font-semibold text-accent-ink">
          {ws.faviconPath ? <img src={`/api/favicon/${ws.id}`} alt="" className="size-5" /> : ws.name[0]}
        </span>
        <span className="min-w-0 flex-1">
          {/* Two lines before truncating: project names are long and the card is narrow. */}
          <span className="line-clamp-2 font-semibold" title={ws.name}>{ws.name}</span>
          <span className="mt-0.5 flex items-center gap-2">
            <Pill tone={status.tone} className="shrink-0">{status.label}</Pill>
            <span className="truncate text-[13px] text-ink-2">{sub}</span>
          </span>
        </span>
      </div>

      <div className="flex flex-col gap-1.5">
        <div className="flex items-baseline justify-between gap-2">
          <span className="text-xs font-medium text-ink-3">Copy approved</span>
          <span className="tnum text-xs text-ink-2">
            {ws.totalSections === 0 ? "No sections yet" : `${ws.approvedSections} of ${ws.totalSections}`}
          </span>
        </div>
        <Meter
          value={ws.approvedSections}
          max={ws.totalSections}
          tone={complete ? "done" : "accent"}
          label={`Copy approved: ${ws.approvedSections} of ${ws.totalSections} sections`}
        />
      </div>

      <div className="mt-auto flex flex-wrap items-center gap-x-4 gap-y-1 border-t border-line-2 pt-3">
        <Fact icon="checklist" value={String(ws.openTasks)} label={ws.openTasks === 1 ? "open task" : "open tasks"} />
        <Fact icon="image" value={String(ws.assetCount)} label={ws.assetCount === 1 ? "file" : "files"} />
        <span className="ml-auto inline-flex items-center gap-1.5 text-xs text-ink-3">
          <Icon name="clock" size={13} />
          {ws.lastActivity ? timeAgo(ws.lastActivity) : "No activity"}
        </span>
      </div>
    </Link>
  );
}
