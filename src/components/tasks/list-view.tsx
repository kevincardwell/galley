"use client";
import { useDroppable } from "@dnd-kit/core";
import { SortableContext, verticalListSortingStrategy } from "@dnd-kit/sortable";
import { clsx } from "@/lib/clsx";
import { SectionHeader } from "./section-header";
import { SortableTaskRow } from "./task-row";
import { AddTaskInput } from "./add-task-input";
import { AddSection } from "./add-section";
import { sectionDropId } from "./dnd";
import type { SectionWithTasks } from "./types";

export function ListView({ sections }: { sections: SectionWithTasks[] }) {
  return (
    <div className="flex flex-1 flex-col px-6 pb-16 pt-1">
      {sections.map((s, i) => <ListSection key={s.id} section={s} index={i} count={sections.length} />)}
      <AddSection className="mt-5 self-start" />
    </div>
  );
}

function ListSection({ section, index, count }: { section: SectionWithTasks; index: number; count: number }) {
  const { setNodeRef, isOver } = useDroppable({ id: sectionDropId(section.id) });
  return (
    <section ref={setNodeRef} className="pt-5" aria-label={section.name}>
      <SectionHeader section={section} index={index} count={count} className="mb-1 px-2" />
      <SortableContext items={section.tasks.map((t) => t.id)} strategy={verticalListSortingStrategy}>
        <div className={clsx("flex flex-col rounded-r transition-colors duration-150", isOver && section.tasks.length === 0 && "bg-surface-2")}>
          {section.tasks.map((t) => <SortableTaskRow key={t.id} task={t} />)}
          {section.tasks.length === 0 && <p className="m-0 px-2 py-1.5 text-[13px] text-ink-3">Nothing here.</p>}
        </div>
      </SortableContext>
      <AddTaskInput sectionId={section.id} className="mt-0.5" />
    </section>
  );
}
