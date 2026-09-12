"use client";
import { useEffect, useRef, useState } from "react";
import { clsx } from "@/lib/clsx";
import { timeAgo } from "@/lib/format";
import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import { Icon } from "@/components/ui/icon";
import { Input, Label, Select, Textarea } from "@/components/ui/field";
import { Meter } from "@/components/ui/meter";
import { AttachPicker } from "@/components/assets/attach-picker";
import { useBoard, isTempId } from "./board-context";
import { TaskCheckbox } from "./task-checkbox";
import { Checklist } from "./checklist";
import { Comments } from "./comments";
import type { TaskItem, TaskStatus } from "./types";

const STATUS_LABEL: Record<TaskStatus, string> = { todo: "To do", doing: "Doing", done: "Done" };

export function TaskDetail({ task, sections }: { task: TaskItem; sections: { id: string; name: string }[] }) {
  const board = useBoard();
  const readOnly = !board.canEdit || isTempId(task.id);
  const [title, setTitle] = useState(task.title);
  const [body, setBody] = useState(task.body);
  const [confirm, setConfirm] = useState(false);
  const panelRef = useRef<HTMLElement>(null);
  const done = task.status === "done";
  const ticked = task.checklist.filter((c) => c.done).length;

  // Focus the panel itself so Esc closes it and j/k keep working; the title is one Tab away.
  useEffect(() => {
    panelRef.current?.focus({ preventScroll: true });
  }, []);

  const saveTitle = () => {
    const next = title.trim();
    if (!next) { setTitle(task.title); return; }
    if (next !== task.title) board.updateTask(task.id, { title: next });
  };
  const saveBody = () => {
    if (body !== task.body) board.updateTask(task.id, { body });
  };

  return (
    <>
      <div className="fixed inset-0 z-20 bg-ink/20 lg:hidden" onClick={() => board.open(null)} aria-hidden="true" />
      <aside
        ref={panelRef}
        role="dialog"
        aria-label="Task details"
        tabIndex={-1}
        onKeyDown={(e) => {
          if (e.key !== "Escape") return;
          const el = e.target;
          if (el instanceof HTMLInputElement || el instanceof HTMLTextAreaElement || el instanceof HTMLSelectElement) { e.stopPropagation(); el.blur(); return; }
          e.stopPropagation();
          board.open(null);
        }}
        className="fixed inset-y-0 right-0 z-30 flex w-[380px] max-w-full flex-col overflow-y-auto border-l border-line bg-surface-2 outline-none lg:sticky lg:inset-auto lg:top-0 lg:z-auto lg:max-h-dvh lg:shrink-0"
      >
        <div className="flex items-start gap-2 px-5 pt-4 pb-4">
          <TaskCheckbox className="mt-[7px]" done={done} disabled={readOnly} label={done ? "Reopen" : "Complete"} onToggle={() => board.toggleDone(task.id)} />
          <input
            value={title}
            readOnly={readOnly}
            onChange={(e) => setTitle(e.target.value)}
            onBlur={saveTitle}
            onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); e.currentTarget.blur(); } }}
            aria-label="Title"
            className={clsx("-mx-1 min-w-0 flex-1 rounded-[4px] border border-transparent bg-transparent px-1 py-0.5 text-base leading-snug font-semibold tracking-tight outline-none transition-colors duration-150 ease-out hover:border-line focus:border-line focus:bg-surface focus-visible:ring-2 focus-visible:ring-accent", done && "text-ink-3 line-through decoration-ink-3/60")}
          />
          <button
            type="button"
            onClick={() => board.open(null)}
            aria-label="Close task details"
            title="Close"
            className="grid size-7 shrink-0 cursor-pointer place-items-center rounded-r text-ink-3 transition-colors duration-150 ease-out hover:bg-surface hover:text-ink"
          >
            <Icon name="x" size={16} />
          </button>
        </div>

        <Block title="Details">
          <div className="grid grid-cols-2 gap-3">
            <Label>Status
              <Select value={task.status} disabled={readOnly} onChange={(e) => board.updateTask(task.id, { status: e.target.value as TaskStatus })}>
                {(Object.keys(STATUS_LABEL) as TaskStatus[]).map((s) => <option key={s} value={s}>{STATUS_LABEL[s]}</option>)}
              </Select>
            </Label>
            <Label>Assignee
              <Select value={task.assigneeId ?? ""} disabled={readOnly} onChange={(e) => board.updateTask(task.id, { assigneeId: e.target.value || null })}>
                <option value="">Unassigned</option>
                {board.members.map((m) => <option key={m.id} value={m.id}>{m.name}</option>)}
              </Select>
            </Label>
            <Label>Due
              <Input type="date" className="tnum" value={task.dueOn ?? ""} disabled={readOnly} onChange={(e) => board.updateTask(task.id, { dueOn: e.target.value || null })} />
            </Label>
            <Label>Section
              <Select value={task.sectionId} disabled={readOnly} onChange={(e) => board.updateTask(task.id, { sectionId: e.target.value })}>
                {sections.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
              </Select>
            </Label>
            <Label className="col-span-2">Description
              <Textarea
                value={body}
                readOnly={readOnly}
                placeholder="Notes, links, what done looks like…"
                onChange={(e) => setBody(e.target.value)}
                onBlur={saveBody}
                className="min-h-28 resize-y leading-relaxed"
              />
            </Label>
          </div>
        </Block>

        <Block
          title="Checklist"
          aside={task.checklist.length > 0 && (
            <>
              <span className="inline-block w-12 shrink-0"><Meter value={ticked} max={task.checklist.length} tone={ticked === task.checklist.length ? "done" : "accent"} label={`Checklist ${ticked} of ${task.checklist.length} done`} /></span>
              <span className="tnum text-xs text-ink-3">{ticked} of {task.checklist.length}</span>
            </>
          )}
        >
          <Checklist task={task} readOnly={readOnly} />
        </Block>

        <Block title="Attachments" aside={task.attachments.length > 0 && <span className="tnum text-xs text-ink-3">{task.attachments.length}</span>}>
          <AttachPicker workspaceId={board.workspaceId} taskId={task.id} attached={task.attachments} readOnly={readOnly} />
        </Block>

        <Block title="Comments" aside={task.comments.length > 0 && <span className="tnum text-xs text-ink-3">{task.comments.length}</span>}>
          <Comments task={task} readOnly={readOnly} />
        </Block>

        <div className="mt-auto flex items-center justify-between gap-3 border-t border-line-2 px-5 py-3 text-xs text-ink-3">
          <span>{done && task.completedAt ? `Done ${timeAgo(task.completedAt)}` : `Added ${timeAgo(task.createdAt)}`}</span>
          {!readOnly && (
            <Button size="sm" variant="quiet" icon="trash" className="hover:text-late" onClick={() => setConfirm(true)}>Delete task</Button>
          )}
        </div>
      </aside>

      <Dialog open={confirm} onClose={() => setConfirm(false)} title="Delete this task?">
        <p className="m-0 text-ink-2">“{task.title}” and its checklist and comments go for good.</p>
        <div className="mt-5 flex justify-end gap-2">
          <Button onClick={() => setConfirm(false)}>Cancel</Button>
          <Button variant="danger" onClick={() => { setConfirm(false); board.deleteTask(task.id); }}>Delete task</Button>
        </div>
      </Dialog>
    </>
  );
}

/** One labelled part of the inspector: eyebrow, optional figure on the right, content. */
function Block({ title, aside, children }: { title: string; aside?: React.ReactNode; children: React.ReactNode }) {
  return (
    <section className="border-t border-line-2 px-5 py-4">
      <div className="mb-2 flex items-center gap-2">
        <h3 className="m-0 text-xs font-medium text-ink-3">{title}</h3>
        {aside && <div className="ml-auto flex items-center gap-2">{aside}</div>}
      </div>
      {children}
    </section>
  );
}
