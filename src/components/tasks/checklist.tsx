"use client";
import { useState } from "react";
import { clsx } from "@/lib/clsx";
import { useBoard, isTempId } from "./board-context";
import { TaskCheckbox } from "./task-checkbox";
import { PlusIcon, XIcon } from "./icons";
import type { ChecklistItem, TaskItem } from "./types";

export function Checklist({ task, readOnly }: { task: TaskItem; readOnly: boolean }) {
  const board = useBoard();
  const [draft, setDraft] = useState("");
  const add = () => {
    const text = draft.trim();
    if (!text) return;
    board.addChecklistItem(task.id, text);
    setDraft("");
  };
  return (
    <div className="flex flex-col">
      {task.checklist.length === 0 && readOnly && <p className="m-0 text-[13px] text-ink-3">No steps.</p>}
      <ul className="m-0 flex list-none flex-col p-0">
        {task.checklist.map((item) => <Row key={item.id} item={item} taskId={task.id} readOnly={readOnly || isTempId(item.id)} />)}
      </ul>
      {!readOnly && (
        <div className="mt-1 flex items-center gap-2">
          <PlusIcon size={12} className="shrink-0 text-ink-3" />
          <input
            value={draft}
            placeholder="Add a step"
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); add(); } }}
            onBlur={add}
            aria-label="New checklist step"
            className="min-w-0 flex-1 rounded-[4px] border border-transparent bg-transparent px-1 py-1 text-[13px] placeholder:text-ink-3 focus:border-line focus:bg-surface focus:outline-none"
          />
        </div>
      )}
    </div>
  );
}

function Row({ item, taskId, readOnly }: { item: ChecklistItem; taskId: string; readOnly: boolean }) {
  const board = useBoard();
  const [text, setText] = useState(item.text);
  const commit = () => {
    const next = text.trim();
    if (!next) { setText(item.text); return; }
    if (next !== item.text) board.renameChecklistItem(taskId, item.id, next);
  };
  return (
    <li className="group flex items-center gap-2 py-0.5">
      <TaskCheckbox done={item.done} disabled={readOnly} label={item.text} onToggle={() => board.toggleChecklistItem(taskId, item.id)} />
      <input
        value={text}
        readOnly={readOnly}
        onChange={(e) => setText(e.target.value)}
        onBlur={commit}
        onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); e.currentTarget.blur(); } }}
        aria-label="Step"
        className={clsx("min-w-0 flex-1 rounded-[4px] border border-transparent bg-transparent px-1 py-1 text-[13px] focus:border-line focus:bg-surface focus:outline-none", item.done && "text-ink-3 line-through")}
      />
      {!readOnly && (
        <button onClick={() => board.deleteChecklistItem(taskId, item.id)} aria-label={`Remove ${item.text}`} className="grid size-5 place-items-center rounded text-ink-3 opacity-0 transition-opacity duration-150 hover:text-late group-hover:opacity-100 focus-visible:opacity-100"><XIcon size={12} /></button>
      )}
    </li>
  );
}
