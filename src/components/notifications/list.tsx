"use client";
import { useRouter } from "next/navigation";
import { useTransition } from "react";
import { markAllRead, markRead } from "@/actions/notifications";
import { Button } from "@/components/ui/button";
import { Empty } from "@/components/ui/empty";
import { toast } from "@/components/ui/toast";
import { clsx } from "@/lib/clsx";
import { timeAgo } from "@/lib/format";
import type { NotificationRow } from "@/lib/queries/notifications";

function startOfToday() {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return Math.floor(d.getTime() / 1000);
}

function Row({ n }: { n: NotificationRow }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const unread = !n.readAt;
  function open() {
    start(async () => {
      if (unread) await markRead(n.id);
      if (n.href) router.push(n.href);
      else router.refresh();
    });
  }
  return (
    <li>
      <button
        type="button"
        onClick={open}
        disabled={pending}
        className={clsx(
          "grid w-full grid-cols-[12px_minmax(0,1fr)_auto] items-start gap-x-2.5 rounded-r px-2 py-2.5 text-left transition-colors duration-150 ease-out hover:bg-surface-2 focus:outline-none focus-visible:ring-2 focus-visible:ring-accent",
          !unread && "text-ink-2",
        )}
      >
        <span className="flex h-5 items-center justify-center">
          {unread && <span aria-label="Unread" className="size-2 rounded-full bg-accent" />}
        </span>
        <span className="min-w-0">
          <span className={clsx("block truncate", unread ? "font-medium text-ink" : "text-ink")}>{n.title}</span>
          {n.body && <span className="mt-0.5 line-clamp-2 block text-[13px] text-ink-2">{n.body}</span>}
          {n.workspace && (
            <span className="mt-1 flex items-center gap-1.5 text-xs text-ink-3">
              <span aria-hidden className="inline-block size-2 rounded-full" style={{ background: n.workspace.accent }} />
              {n.workspace.name}
            </span>
          )}
        </span>
        <span className="tnum whitespace-nowrap text-xs text-ink-3">{timeAgo(n.createdAt)}</span>
      </button>
    </li>
  );
}

function Group({ label, items }: { label: string; items: NotificationRow[] }) {
  if (items.length === 0) return null;
  return (
    <section>
      <h2 className="m-0 mb-1 px-2 text-xs font-medium text-ink-3">{label}</h2>
      <ul className="m-0 flex list-none flex-col p-0">
        {items.map((n) => <Row key={n.id} n={n} />)}
      </ul>
    </section>
  );
}

export function NotificationList({ items }: { items: NotificationRow[] }) {
  const [pending, start] = useTransition();
  const cutoff = startOfToday();
  const today = items.filter((n) => n.createdAt >= cutoff);
  const earlier = items.filter((n) => n.createdAt < cutoff);
  const unread = items.filter((n) => !n.readAt).length;
  return (
    <div className="flex flex-col gap-5">
      <div className="flex items-center gap-3">
        <span className="tnum text-xs text-ink-3">{unread === 0 ? "All read" : `${unread} unread`}</span>
        <Button
          size="sm"
          className="ml-auto"
          disabled={pending || unread === 0}
          onClick={() =>
            start(async () => {
              const r = await markAllRead();
              if (r.ok) toast(r.data.count === 0 ? "Nothing to mark" : "All marked read", { tone: "done" });
              else toast(r.error, { tone: "late" });
            })
          }
        >
          {pending ? "Marking…" : "Mark all read"}
        </Button>
      </div>
      {items.length === 0 ? (
        <Empty title="Nothing here yet" hint="You are told here when someone @-mentions you, assigns you a task, or a client comments on or approves copy." />
      ) : (
        <>
          <Group label="Today" items={today} />
          <Group label="Earlier" items={earlier} />
        </>
      )}
    </div>
  );
}
