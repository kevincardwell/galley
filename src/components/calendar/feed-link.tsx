"use client";
import { useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { Icon } from "@/components/ui/icon";
import { toast } from "@/components/ui/toast";
import { toggleCalendarFeed } from "@/actions/workspaces";

/** The subscribable feed for a project. Its token is separate from the client share link. */
export function FeedLink({ url, workspaceId, canManage }: { url: string | null; workspaceId: string; canManage: boolean }) {
  const [copied, setCopied] = useState(false);
  const [pending, start] = useTransition();
  if (!url) {
    if (!canManage) return null;
    return (
      <div className="mb-4 flex flex-wrap items-center gap-3 rounded-lg border border-line bg-surface-2 px-3 py-2.5">
        <Icon name="calendar" className="text-ink-3" />
        <div className="min-w-0 flex-1">
          <p className="m-0 text-[13px] font-medium">Follow this schedule in your own calendar</p>
          <p className="m-0 text-xs text-ink-3">Creates a private link that shows deadlines and schedule entries. Separate from the client share link.</p>
        </div>
        <Button size="sm" icon="link" loading={pending} onClick={() => start(async () => { await toggleCalendarFeed(workspaceId, true); })}>Create feed link</Button>
      </div>
    );
  }
  return (
    <div className="mb-4 flex flex-wrap items-center gap-3 rounded-lg border border-line bg-surface-2 px-3 py-2.5">
      <Icon name="calendar" className="text-ink-3" />
      <div className="min-w-0 flex-1">
        <p className="m-0 text-[13px] font-medium">Subscribe to this schedule</p>
        <p className="m-0 truncate text-xs text-ink-3">{url}</p>
      </div>
      <Button
        size="sm"
        icon="copy"
        onClick={() => {
          navigator.clipboard
            .writeText(url)
            .then(() => {
              setCopied(true);
              setTimeout(() => setCopied(false), 1500);
              toast("Feed link copied");
            })
            .catch(() => toast("Could not copy", { tone: "late" }));
        }}
      >
        {copied ? "Copied" : "Copy feed"}
      </Button>
    </div>
  );
}
