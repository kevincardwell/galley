"use client";
import { useDroppable } from "@dnd-kit/core";
import { SortableContext, verticalListSortingStrategy } from "@dnd-kit/sortable";
import { clsx } from "@/lib/clsx";
import { SectionHeader } from "./section-header";
import { SortableTaskCard } from "./task-card";
import { AddTaskInput } from "./add-task-input";
import { AddSection } from "./add-section";
import { sectionDropId } from "./dnd";
import type { SectionWithTasks } from "./types";

export function BoardView({ sections }: { sections: SectionWithTasks[] }) {
  return (
    <div className="flex flex-1 items-start gap-3 overflow-x-auto px-6 pb-6 pt-4">
      {sections.map((s, i) => <BoardColumn key={s.id} section={s} index={i} count={sections.length} />)}
      <div className="w-56 shrink-0 pt-1"><AddSection className="w-full" /></div>
    </div>
  );
}

function BoardColumn({ section, index, count }: { section: SectionWithTasks; index: number; count: number }) {
  const { setNodeRef, isOver } = useDroppable({ id: sectionDropId(section.id) });
  return (
    <section
      ref={setNodeRef}
      aria-label={section.name}
      className={clsx("flex w-72 shrink-0 flex-col gap-2 rounded-r border border-line-2 bg-surface-2 p-2 transition-colors duration-150", isOver && "border-line")}
    >
      <SectionHeader section={section} index={index} count={count} className="px-1 pt-0.5" />
      <SortableContext items={section.tasks.map((t) => t.id)} strategy={verticalListSortingStrategy}>
        <div className="flex min-h-6 flex-col gap-1.5">
          {section.tasks.map((t) => <SortableTaskCard key={t.id} task={t} />)}
        </div>
      </SortableContext>
      <AddTaskInput sectionId={section.id} />
    </section>
  );
}
