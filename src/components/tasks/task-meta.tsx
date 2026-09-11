"use client";
import { clsx } from "@/lib/clsx";
import { formatDue } from "@/lib/format";
import { Avatar } from "@/components/ui/avatar";
import { ChecklistIcon, CommentIcon, PaperclipIcon } from "./icons";
import type { TaskItem } from "./types";

/** Due date, checklist, attachment and comment counts, assignee. Shared by rows and cards. */
export function TaskMeta({ task, className }: { task: TaskItem; className?: string }) {
  const done = task.status === "done";
  const due = formatDue(task.dueOn);
  const ticked = task.checklist.filter((c) => c.done).length;
  const openComments = task.comments.filter((c) => !c.resolvedAt).length;
  return (
    <div className={clsx("flex items-center gap-3 text-xs", done ? "text-ink-3" : "text-ink-2", className)}>
      {task.status === "doing" && !done && <span className="rounded-full border border-accent-line px-1.5 text-[11px] font-medium text-accent">Doing</span>}
      {due.label && (
        <span className={clsx("tnum whitespace-nowrap", !done && due.tone === "late" && "font-medium text-late", !done && due.tone === "soon" && "font-medium text-review")}>{due.label}</span>
      )}
      {task.checklist.length > 0 && (
        <span className="tnum inline-flex items-center gap-1" title="Checklist"><ChecklistIcon size={13} />{ticked}/{task.checklist.length}</span>
      )}
      {task.attachments.length > 0 && (
        <span className="tnum inline-flex items-center gap-1" title="Attachments"><PaperclipIcon size={13} />{task.attachments.length}</span>
      )}
      {openComments > 0 && (
        <span className="tnum inline-flex items-center gap-1" title="Open comments"><CommentIcon size={13} />{openComments}</span>
      )}
      {task.assigneeName ? <Avatar name={task.assigneeName} size={20} muted={done} /> : <span className="size-5 rounded-full border border-dashed border-line" aria-hidden="true" />}
    </div>
  );
}

export const firstLine = (body: string) => body.split(/\r?\n/).map((l) => l.trim()).find(Boolean) ?? "";
