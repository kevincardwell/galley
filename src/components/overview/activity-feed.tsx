import { Icon, type IconName } from "@/components/ui/icon";
import { timeAgo } from "@/lib/format";

export type FeedItem = { id: number; verb: string; subjectType: string; subjectTitle: string | null; createdAt: number; actorName: string | null };

const VERB_ICON: Record<string, IconName> = {
  created: "plus",
  added: "plus",
  updated: "pencil",
  completed: "check-circle",
  approved: "check-circle",
  uploaded: "upload",
  attached: "paperclip",
  commented: "message",
  deleted: "trash",
  moved: "arrow-right",
  restored: "undo",
};

function dayLabel(unix: number) {
  const d = new Date(unix * 1000);
  const midnight = new Date();
  midnight.setHours(0, 0, 0, 0);
  const today = Math.floor(midnight.getTime() / 1000);
  if (unix >= today) return "Today";
  if (unix >= today - 86400) return "Yesterday";
  return d.toLocaleDateString("en-GB", { day: "numeric", month: "short" });
}

/** Who did what, newest first, grouped by day so a busy week still scans. */
export function ActivityFeed({ items }: { items: FeedItem[] }) {
  if (items.length === 0) return <p className="m-0 text-[13px] text-ink-3">Quiet so far. Anything you or the client do shows up here.</p>;

  const groups: { label: string; rows: FeedItem[] }[] = [];
  for (const it of items) {
    const label = dayLabel(it.createdAt);
    const last = groups.at(-1);
    if (last && last.label === label) last.rows.push(it);
    else groups.push({ label, rows: [it] });
  }

  return (
    <div className="flex flex-col gap-3">
      {groups.map((g) => (
        <div key={g.label} className="flex flex-col gap-1.5">
          <p className="m-0 text-xs font-medium text-ink-3">{g.label}</p>
          <ul className="m-0 flex list-none flex-col gap-1.5 p-0">
            {g.rows.map((a) => (
              <li key={a.id} className="flex items-start gap-2 text-[13px]">
                <span className="mt-0.5 grid size-5 shrink-0 place-items-center rounded-full bg-surface-2 text-ink-3">
                  <Icon name={VERB_ICON[a.verb] ?? "dot"} size={12} />
                </span>
                <span className="min-w-0 flex-1 leading-snug">
                  <span className="font-medium">{a.actorName ?? "Someone"}</span>{" "}
                  <span className="text-ink-2">
                    {a.verb} {a.subjectType}
                  </span>
                  {a.subjectTitle && <span className="text-ink"> “{a.subjectTitle}”</span>}
                  <span className="tnum ml-1.5 text-xs whitespace-nowrap text-ink-3">{timeAgo(a.createdAt)}</span>
                </span>
              </li>
            ))}
          </ul>
        </div>
      ))}
    </div>
  );
}
