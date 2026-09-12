"use client";
import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { clsx } from "@/lib/clsx";
import { useBoard, isTempId } from "./board-context";
import { TaskCheckbox } from "./task-checkbox";
import { TaskMeta, firstLine } from "./task-meta";
import { splitListeners } from "./dnd";
import type { TaskItem } from "./types";

type CardProps = { task: TaskItem; highlighted?: boolean; open?: boolean; placeholder?: boolean; overlay?: boolean };

function CardContent({ task, highlighted, open, placeholder, overlay }: CardProps) {
  const board = useBoard();
  const done = task.status === "done";
  const subtitle = firstLine(task.body);
  return (
    <div
      className={clsx(
        "flex flex-col gap-2 rounded-r border px-3 py-2 transition-colors duration-150 ease-out",
        placeholder ? "border-dashed border-line bg-surface-2 [&>*]:invisible" : "border-line bg-surface",
        !overlay && !placeholder && "hover:border-ink-3/60",
        highlighted && !placeholder && "border-ink-3/60",
        open && !placeholder && "border-accent bg-accent-soft",
        overlay && "shadow-panel",
      )}
    >
      <div className="flex items-start gap-2">
        <TaskCheckbox className="mt-0.5" done={done} disabled={!board.canEdit || isTempId(task.id)} label={done ? `Reopen ${task.title}` : `Complete ${task.title}`} onToggle={() => board.toggleDone(task.id)} />
        <span className="min-w-0 flex-1">
          <span className={clsx("block font-medium leading-snug", done ? "text-ink-3 line-through decoration-ink-3/60" : "text-ink")}>{task.title}</span>
          {subtitle && <span className={clsx("mt-0.5 block truncate text-[13px]", done ? "text-ink-3/70" : "text-ink-3")}>{subtitle}</span>}
        </span>
      </div>
      <TaskMeta task={task} className="justify-end" />
    </div>
  );
}

export function SortableTaskCard({ task }: { task: TaskItem }) {
  const board = useBoard();
  const disabled = !board.canEdit || isTempId(task.id);
  const { setNodeRef, attributes, listeners, transform, transition, isDragging } = useSortable({ id: task.id, disabled, data: { sectionId: task.sectionId } });
  const { pointer, onKeyDown } = splitListeners(listeners);
  return (
    <div
      ref={setNodeRef}
      style={{ transform: CSS.Translate.toString(transform), transition }}
      data-task-id={task.id}
      onClick={() => board.open(task.id)}
      onMouseEnter={() => board.setHighlight(task.id)}
      onKeyDown={(e) => {
        if (e.key !== " " && e.key !== "Enter") return;
        // Shift+space/enter starts a keyboard drag; plain space/enter keep their board-wide meaning.
        if (e.shiftKey) { onKeyDown?.(e); return; }
        if (e.target !== e.currentTarget) return;
        e.preventDefault();
        if (e.key === "Enter") board.open(task.id);
        else if (!disabled) board.toggleDone(task.id);
      }}
      {...attributes}
      role="button"
      aria-roledescription="task card, shift+space to drag"
      className={clsx("cursor-pointer rounded-r outline-none focus-visible:ring-2 focus-visible:ring-accent", isTempId(task.id) && "opacity-60")}
      {...pointer}
    >
      <CardContent task={task} highlighted={board.highlightId === task.id} open={board.openId === task.id} placeholder={isDragging} />
    </div>
  );
}

export function TaskCardOverlay({ task }: { task: TaskItem }) {
  return <div className="w-72"><CardContent task={task} overlay /></div>;
}
