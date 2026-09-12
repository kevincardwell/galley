"use client";
import { useDroppable } from "@dnd-kit/core";
import { SortableContext, verticalListSortingStrategy } from "@dnd-kit/sortable";
import { clsx } from "@/lib/clsx";
import { useBoard } from "./board-context";
import { SectionHeader } from "./section-header";
import { SortableTaskRow } from "./task-row";
import { AddTaskInput } from "./add-task-input";
import { AddSection } from "./add-section";
import { useCollapsed } from "./use-collapsed";
import { sectionDropId } from "./dnd";
import type { SectionWithTasks } from "./types";

export function ListView({ sections }: { sections: SectionWithTasks[] }) {
  const { isCollapsed, toggle } = useCollapsed();
  return (
    <div className="flex flex-1 flex-col px-4 pt-1 pb-16 sm:px-6">
      {sections.map((s, i) => (
        <ListSection key={s.id} section={s} index={i} count={sections.length} collapsed={isCollapsed(s.id)} onToggleCollapse={() => toggle(s.id)} />
      ))}
      <AddSection className="mt-5 self-start" />
    </div>
  );
}

function ListSection({ section, index, count, collapsed, onToggleCollapse }: { section: SectionWithTasks; index: number; count: number; collapsed: boolean; onToggleCollapse: () => void }) {
  const board = useBoard();
  const { setNodeRef, isOver } = useDroppable({ id: sectionDropId(section.id) });
  const dragging = board.draggingId !== null;
  return (
    <section ref={setNodeRef} className="pt-5" aria-label={section.name}>
      <SectionHeader section={section} index={index} count={count} collapsed={collapsed} onToggleCollapse={onToggleCollapse} className="mb-1 px-2" />
      {!collapsed && (
        <>
          <SortableContext items={section.tasks.map((t) => t.id)} strategy={verticalListSortingStrategy}>
            <div
              className={clsx(
                "flex flex-col rounded-r border border-transparent transition-colors duration-150 ease-out",
                dragging && section.tasks.length === 0 && "border-dashed border-line",
                isOver && section.tasks.length === 0 && "border-accent-line bg-accent-soft",
              )}
            >
              {section.tasks.map((t) => <SortableTaskRow key={t.id} task={t} />)}
              {section.tasks.length === 0 && <p className="m-0 px-2 py-1.5 text-[13px] text-ink-3">{dragging ? "Drop here" : "Nothing here."}</p>}
            </div>
          </SortableContext>
          <AddTaskInput sectionId={section.id} className="mt-0.5" />
        </>
      )}
    </section>
  );
}
