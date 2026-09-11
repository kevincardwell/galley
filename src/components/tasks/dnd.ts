import type { SectionWithTasks } from "./types";

export const SECTION_PREFIX = "section:";
export const sectionDropId = (sectionId: string) => `${SECTION_PREFIX}${sectionId}`;

/** The section id a droppable/sortable id belongs to: either a section container or the section holding that task. */
export function containerOf(sections: SectionWithTasks[], id: string): string | null {
  if (id.startsWith(SECTION_PREFIX)) return id.slice(SECTION_PREFIX.length);
  return sections.find((s) => s.tasks.some((t) => t.id === id))?.id ?? null;
}

type SyntheticListeners = Record<string, unknown> | undefined;
type Handlers = {
  /** Mouse/touch activators, spread on the whole row or card. */
  pointer: Record<string, (e: React.SyntheticEvent) => void>;
  /** Keyboard activator, attached only where a keyboard drag should start. */
  onKeyDown: ((e: React.KeyboardEvent) => void) | undefined;
};

/** dnd-kit types its listeners as bare Functions; split them so each lands on the right element with a real type. */
export function splitListeners(listeners: SyntheticListeners): Handlers {
  const pointer: Handlers["pointer"] = {};
  let onKeyDown: Handlers["onKeyDown"];
  for (const [name, fn] of Object.entries(listeners ?? {})) {
    if (typeof fn !== "function") continue;
    if (name === "onKeyDown") onKeyDown = fn as (e: React.KeyboardEvent) => void;
    else pointer[name] = fn as (e: React.SyntheticEvent) => void;
  }
  return { pointer, onKeyDown };
}
