"use client";
import { clsx } from "@/lib/clsx";
import { formatDue } from "@/lib/format";
import { Avatar } from "@/components/ui/avatar";
import { Icon } from "@/components/ui/icon";
import type { TaskItem } from "./types";

/** Due date, checklist, attachment and comment counts, assignee. Shared by rows and cards. */
export function TaskMeta({ task, className }: { task: TaskItem; className?: string }) {
  const done = task.status === "done";
  const due = formatDue(task.dueOn);
  const ticked = task.checklist.filter((c) => c.done).length;
  const openComments = task.comments.filter((c) => !c.resolvedAt).length;
  return (
    <div className={clsx("flex items-center gap-2.5 text-xs", done ? "text-ink-3" : "text-ink-2", className)}>
      {task.status === "doing" && !done && (
        <span aria-label="Status: doing" className="rounded-full border border-accent-line px-1.5 text-[11px] font-medium text-accent">Doing</span>
      )}
      {due.label && (
        <span
          aria-label={`Due ${due.label}`}
          className={clsx(
            "tnum inline-flex items-center gap-1 whitespace-nowrap",
            !done && due.tone === "late" && "font-medium text-late",
            !done && due.tone === "soon" && "font-medium text-review",
            (done || due.tone === "none") && "text-ink-3",
          )}
        >
          <Icon name="clock" size={13} />
          {due.label}
        </span>
      )}
      {task.checklist.length > 0 && (
        <span className="tnum inline-flex items-center gap-1 text-ink-3" title="Checklist" aria-label={`Checklist ${ticked} of ${task.checklist.length} done`}>
          <Icon name="checklist" size={13} />
          {ticked}/{task.checklist.length}
        </span>
      )}
      {task.attachments.length > 0 && (
        <span className="tnum inline-flex items-center gap-1 text-ink-3" title="Attachments" aria-label={`${task.attachments.length} attachment${task.attachments.length === 1 ? "" : "s"}`}>
          <Icon name="paperclip" size={13} />
          {task.attachments.length}
        </span>
      )}
      {openComments > 0 && (
        <span className="tnum inline-flex items-center gap-1 text-ink-3" title="Open comments" aria-label={`${openComments} open comment${openComments === 1 ? "" : "s"}`}>
          <Icon name="message" size={13} />
          {openComments}
        </span>
      )}
      {task.assigneeName ? <Avatar name={task.assigneeName} size={20} muted={done} /> : <span className="size-5 rounded-full border border-dashed border-line" aria-hidden="true" />}
    </div>
  );
}

export const firstLine = (body: string) => body.split(/\r?\n/).map((l) => l.trim()).find(Boolean) ?? "";
