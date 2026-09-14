"use client";
import { useRouter } from "next/navigation";
import { useTransition } from "react";
import { markAllRead, markRead } from "@/actions/notifications";
import { Button } from "@/components/ui/button";
import { Empty } from "@/components/ui/empty";
import { Icon, type IconName } from "@/components/ui/icon";
import { toast } from "@/components/ui/toast";
import { clsx } from "@/lib/clsx";
import { timeAgo } from "@/lib/format";
import type { NotificationRow } from "@/lib/queries/notifications";

const KIND_ICON: Record<string, IconName> = {
  client_comment: "message",
  client_approved: "check-circle",
  client_upload: "upload",
  assigned: "user",
  mention: "zap",
  invite: "mail",
};

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
          "grid w-full cursor-pointer grid-cols-[auto_minmax(0,1fr)_auto] items-start gap-x-2.5 rounded-r px-2 py-2.5 text-left transition-colors duration-150 ease-out hover:bg-surface-2 focus:outline-none focus-visible:ring-2 focus-visible:ring-accent disabled:cursor-wait",
          !unread && "text-ink-2",
        )}
      >
        <span
          className={clsx(
            "relative mt-px grid size-6 shrink-0 place-items-center rounded-full",
            unread ? "bg-accent-soft text-accent" : "bg-surface-2 text-ink-3",
          )}
        >
          <Icon name={KIND_ICON[n.kind] ?? "inbox"} size={13} />
          {unread && <span aria-label="Unread" className="absolute -top-0.5 -right-0.5 size-2 rounded-full bg-accent ring-2 ring-surface" />}
        </span>
        <span className="min-w-0">
          <span className={clsx("block truncate text-[13px]", unread ? "font-medium text-ink" : "text-ink")}>{n.title}</span>
          {n.body && <span className="mt-0.5 line-clamp-2 block text-[13px] text-ink-2">{n.body}</span>}
          {n.workspace && (
            <span className="mt-1 flex items-center gap-1.5 text-xs text-ink-3">
              <span aria-hidden className="inline-block size-2 rounded-full" style={{ background: n.workspace.accent }} />
              {n.workspace.name}
            </span>
          )}
        </span>
        <span className="tnum text-xs whitespace-nowrap text-ink-3">{timeAgo(n.createdAt)}</span>
      </button>
    </li>
  );
}

function Group({ label, items }: { label: string; items: NotificationRow[] }) {
  if (items.length === 0) return null;
  return (
    <section className="flex flex-col gap-1">
      <h2 className="m-0 px-2 text-xs font-medium text-ink-3">{label}</h2>
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
      {items.length > 0 && (
        <div className="flex items-center gap-3 border-b border-line-2 pb-3">
          <span className="tnum text-xs text-ink-3">{unread === 0 ? "All read" : `${unread} unread`}</span>
          <Button
            size="sm"
            icon="check"
            className="ml-auto"
            disabled={unread === 0}
            loading={pending}
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
      )}
      {items.length === 0 ? (
        <Empty
          icon="inbox"
          title="Nothing here yet"
          hint="You are told here when someone @-mentions you, assigns you a task, or a client comments on or approves copy."
        />
      ) : (
        <>
          <Group label="Today" items={today} />
          <Group label="Earlier" items={earlier} />
        </>
      )}
    </div>
  );
}
