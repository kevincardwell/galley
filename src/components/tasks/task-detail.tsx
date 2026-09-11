"use client";
import { useEffect, useRef, useState } from "react";
import { clsx } from "@/lib/clsx";
import { timeAgo } from "@/lib/format";
import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import { Input, Label, Select, Textarea } from "@/components/ui/field";
import { AttachPicker } from "@/components/assets/attach-picker";
import { useBoard, isTempId } from "./board-context";
import { TaskCheckbox } from "./task-checkbox";
import { Checklist } from "./checklist";
import { Comments } from "./comments";
import { XIcon } from "./icons";
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
        <div className="flex items-start gap-2 px-5 pt-4">
          <TaskCheckbox className="mt-[7px]" done={done} disabled={readOnly} label={done ? "Reopen" : "Complete"} onToggle={() => board.toggleDone(task.id)} />
          <input
            value={title}
            readOnly={readOnly}
            onChange={(e) => setTitle(e.target.value)}
            onBlur={saveTitle}
            onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); e.currentTarget.blur(); } }}
            aria-label="Title"
            className={clsx("min-w-0 flex-1 rounded-[4px] border border-transparent bg-transparent px-1 py-0.5 text-base font-semibold leading-snug tracking-tight outline-none transition-colors duration-150 -mx-1 hover:border-line focus:border-line focus:bg-surface", done && "text-ink-3 line-through decoration-ink-3/60")}
          />
          <button onClick={() => board.open(null)} aria-label="Close" className="grid size-7 shrink-0 place-items-center rounded-r text-ink-3 hover:bg-surface hover:text-ink"><XIcon /></button>
        </div>

        <div className="grid grid-cols-2 gap-x-3 gap-y-3 px-5 pt-4">
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
            <Input type="date" value={task.dueOn ?? ""} disabled={readOnly} onChange={(e) => board.updateTask(task.id, { dueOn: e.target.value || null })} />
          </Label>
          <Label>Section
            <Select value={task.sectionId} disabled={readOnly} onChange={(e) => board.updateTask(task.id, { sectionId: e.target.value })}>
              {sections.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
            </Select>
          </Label>
        </div>

        <div className="px-5 pt-4">
          <Label>Description
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

        <Section title="Checklist" count={task.checklist.length ? `${task.checklist.filter((c) => c.done).length}/${task.checklist.length}` : undefined}>
          <Checklist task={task} readOnly={readOnly} />
        </Section>

        <Section title="Attachments" count={task.attachments.length ? String(task.attachments.length) : undefined}>
          <AttachPicker workspaceId={board.workspaceId} taskId={task.id} attached={task.attachments} readOnly={readOnly} />
        </Section>

        <Section title="Comments" count={task.comments.length ? String(task.comments.length) : undefined}>
          <Comments task={task} readOnly={readOnly} />
        </Section>

        <div className="mt-auto flex items-center justify-between gap-3 px-5 py-4 text-xs text-ink-3">
          <span>{done && task.completedAt ? `Done ${timeAgo(task.completedAt)}` : `Added ${timeAgo(task.createdAt)}`}</span>
          {!readOnly && <Button size="sm" variant="ghost" className="text-late hover:bg-late-soft hover:text-late" onClick={() => setConfirm(true)}>Delete</Button>}
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

function Section({ title, count, children }: { title: string; count?: string; children: React.ReactNode }) {
  return (
    <section className="mt-5 border-t border-line-2 px-5 pt-4">
      <h3 className="m-0 mb-2 flex items-baseline gap-2 text-xs font-semibold uppercase tracking-wide text-ink-2">
        {title}
        {count && <span className="tnum font-normal normal-case tracking-normal text-ink-3">{count}</span>}
      </h3>
      {children}
    </section>
  );
}
