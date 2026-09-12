"use client";
import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { clsx } from "@/lib/clsx";
import { Icon } from "@/components/ui/icon";
import { useBoard, isTempId } from "./board-context";
import { TaskCheckbox } from "./task-checkbox";
import { TaskMeta, firstLine } from "./task-meta";
import { splitListeners } from "./dnd";
import type { TaskItem } from "./types";

type RowProps = { task: TaskItem; grip?: React.ReactNode; highlighted?: boolean; open?: boolean; placeholder?: boolean; overlay?: boolean; className?: string };

function RowContent({ task, grip, highlighted, open, placeholder, overlay, className }: RowProps) {
  const board = useBoard();
  const done = task.status === "done";
  const subtitle = firstLine(task.body);
  return (
    <div
      className={clsx(
        "group relative grid grid-cols-[18px_16px_minmax(0,1fr)_auto] items-center gap-2.5 rounded-r px-2 py-1.5 transition-colors duration-150 ease-out",
        !overlay && !placeholder && "hover:bg-surface-2",
        highlighted && !placeholder && "bg-surface-2",
        open && !placeholder && "bg-accent-soft",
        placeholder && "border border-dashed border-line bg-surface-2 [&>*]:invisible",
        overlay && "border border-line bg-surface shadow-panel",
        className,
      )}
    >
      {highlighted && !placeholder && <span className="absolute inset-y-1 -left-2 w-0.5 rounded-full bg-accent" aria-hidden="true" />}
      <span className="grid place-items-center">{grip}</span>
      <TaskCheckbox done={done} disabled={!board.canEdit || isTempId(task.id)} label={done ? `Reopen ${task.title}` : `Complete ${task.title}`} onToggle={() => board.toggleDone(task.id)} />
      <span className="min-w-0">
        <span className={clsx("block truncate font-medium", done ? "text-ink-3 line-through decoration-ink-3/60" : "text-ink")}>{task.title}</span>
        {subtitle && <span className={clsx("mt-px block truncate text-[13px]", done ? "text-ink-3/70" : "text-ink-3")}>{subtitle}</span>}
      </span>
      <TaskMeta task={task} />
    </div>
  );
}

export function SortableTaskRow({ task }: { task: TaskItem }) {
  const board = useBoard();
  const disabled = !board.canEdit || isTempId(task.id);
  const { setNodeRef, setActivatorNodeRef, attributes, listeners, transform, transition, isDragging } = useSortable({ id: task.id, disabled, data: { sectionId: task.sectionId } });
  const { pointer, onKeyDown } = splitListeners(listeners);
  return (
    <div
      ref={setNodeRef}
      style={{ transform: CSS.Translate.toString(transform), transition }}
      data-task-id={task.id}
      onClick={() => board.open(task.id)}
      onMouseEnter={() => board.setHighlight(task.id)}
      className={clsx("cursor-pointer", isTempId(task.id) && "opacity-60")}
      {...pointer}
    >
      <RowContent
        task={task}
        highlighted={board.highlightId === task.id}
        open={board.openId === task.id}
        placeholder={isDragging}
        grip={
          !disabled && (
            <button
              ref={setActivatorNodeRef}
              {...attributes}
              onKeyDown={onKeyDown}
              onClick={(e) => e.stopPropagation()}
              aria-label={`Move ${task.title}`}
              title="Drag to reorder"
              className="grid size-5 cursor-grab place-items-center rounded text-ink-3 opacity-0 transition-opacity duration-150 ease-out hover:text-ink group-hover:opacity-100 focus-visible:opacity-100 active:cursor-grabbing"
            >
              <Icon name="grip" size={14} />
            </button>
          )
        }
      />
    </div>
  );
}

export function TaskRowOverlay({ task }: { task: TaskItem }) {
  return <RowContent task={task} overlay grip={<span className="grid size-5 place-items-center text-ink-3"><Icon name="grip" size={14} /></span>} />;
}
