"use client";
import { useCallback, useEffect, useMemo, useRef, useState, useTransition } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import {
  DndContext,
  DragOverlay,
  KeyboardSensor,
  MouseSensor,
  TouchSensor,
  closestCorners,
  pointerWithin,
  useSensor,
  useSensors,
  type CollisionDetection,
  type DragEndEvent,
  type DragOverEvent,
  type DragStartEvent,
} from "@dnd-kit/core";
import { arrayMove, sortableKeyboardCoordinates } from "@dnd-kit/sortable";
import * as actions from "@/actions/tasks";
import { Button } from "@/components/ui/button";
import { Empty } from "@/components/ui/empty";
import { XIcon } from "./icons";
import { BoardProvider, type BoardApi, type FocusRequest } from "./board-context";
import { Toolbar } from "./toolbar";
import { ListView } from "./list-view";
import { BoardView } from "./board-view";
import { TaskRowOverlay } from "./task-row";
import { TaskCardOverlay } from "./task-card";
import { TaskDetail } from "./task-detail";
import { useViewPref } from "./use-view-pref";
import { SECTION_PREFIX, containerOf } from "./dnd";
import type { Member, SectionWithTasks, TaskItem, TaskPatch, TaskView } from "./types";

type Props = {
  workspaceId: string;
  slug: string;
  initialSections: SectionWithTasks[];
  members: Member[];
  currentUserId: string;
  canEdit: boolean;
  initialView: TaskView | null;
  openTaskId: string | null;
};

const tempId = () => `tmp-${Math.random().toString(36).slice(2, 10)}`;
const nowSec = () => Math.floor(Date.now() / 1000);

const isTypingTarget = (el: EventTarget | null) => {
  if (!(el instanceof HTMLElement)) return false;
  return el.tagName === "INPUT" || el.tagName === "TEXTAREA" || el.tagName === "SELECT" || el.isContentEditable;
};
const isPressable = (el: EventTarget | null) => el instanceof HTMLElement && (el.tagName === "BUTTON" || el.tagName === "A" || el.tagName === "SUMMARY" || el.getAttribute("role") === "button");

const collision: CollisionDetection = (args) => {
  const inside = pointerWithin(args);
  return inside.length > 0 ? inside : closestCorners(args);
};

export function TaskBoard(props: Props) {
  const { workspaceId, slug, members, currentUserId, canEdit } = props;
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [, startTransition] = useTransition();

  // Server data is the source of truth; local copies absorb optimistic edits until the next server render.
  const [prevInitial, setPrevInitial] = useState(props.initialSections);
  const [sections, setSections] = useState(props.initialSections);
  if (prevInitial !== props.initialSections) {
    setPrevInitial(props.initialSections);
    setSections(props.initialSections);
  }
  const [prevOpen, setPrevOpen] = useState(props.openTaskId);
  const [openId, setOpenId] = useState(props.openTaskId);
  if (prevOpen !== props.openTaskId) {
    setPrevOpen(props.openTaskId);
    setOpenId(props.openTaskId);
  }

  const [storedView, setStoredView] = useViewPref();
  const [pickedView, setPickedView] = useState<TaskView | null>(props.initialView);
  const view: TaskView = pickedView ?? storedView ?? "list";

  const [mine, setMine] = useState(false);
  const [highlightId, setHighlightId] = useState<string | null>(null);
  const [focusRequest, setFocusRequest] = useState<FocusRequest | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [activeId, setActiveId] = useState<string | null>(null);
  const dragOrigin = useRef<{ sectionId: string; snapshot: SectionWithTasks[] } | null>(null);
  // Drag handlers and keyboard helpers read the latest sections without re-subscribing on every change.
  const sectionsRef = useRef(sections);
  useEffect(() => {
    sectionsRef.current = sections;
  }, [sections]);

  const run = useCallback(
    (fn: () => Promise<unknown>) => {
      startTransition(async () => {
        try {
          await fn();
        } catch (e) {
          setError(e instanceof Error && e.message ? e.message : "That did not save. Try again.");
          router.refresh();
        }
      });
    },
    [router],
  );

  const setParam = useCallback(
    (key: string, value: string | null) => {
      const q = new URLSearchParams(searchParams.toString());
      if (value) q.set(key, value);
      else q.delete(key);
      const qs = q.toString();
      router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false });
    },
    [searchParams, pathname, router],
  );

  const patchLocal = useCallback((id: string, fn: (t: TaskItem) => TaskItem) => {
    setSections((prev) => prev.map((s) => ({ ...s, tasks: s.tasks.map((t) => (t.id === id ? fn(t) : t)) })));
  }, []);

  // ---- Task mutations (optimistic, then server) ----
  const open = useCallback((id: string | null) => {
    setOpenId(id);
    if (id) setHighlightId(id);
    setParam("task", id);
  }, [setParam]);

  const toggleDone = useCallback((id: string) => {
    patchLocal(id, (t) => (t.status === "done" ? { ...t, status: "todo", completedAt: null } : { ...t, status: "done", completedAt: nowSec() }));
    run(() => actions.toggleDone(id));
  }, [patchLocal, run]);

  const updateTask = useCallback((id: string, patch: TaskPatch) => {
    setSections((prev) => {
      const from = prev.find((s) => s.tasks.some((t) => t.id === id));
      const task = from?.tasks.find((t) => t.id === id);
      if (!from || !task) return prev;
      const status = patch.status ?? task.status;
      const next: TaskItem = {
        ...task,
        ...patch,
        status,
        completedAt: status === task.status ? task.completedAt : status === "done" ? nowSec() : null,
        assigneeName: patch.assigneeId === undefined ? task.assigneeName : (members.find((m) => m.id === patch.assigneeId)?.name ?? null),
        sectionId: patch.sectionId ?? task.sectionId,
      };
      if (next.sectionId === from.id) return prev.map((s) => (s.id === from.id ? { ...s, tasks: s.tasks.map((t) => (t.id === id ? next : t)) } : s));
      return prev.map((s) => {
        if (s.id === from.id) return { ...s, tasks: s.tasks.filter((t) => t.id !== id) };
        if (s.id === next.sectionId) return { ...s, tasks: [...s.tasks, next] };
        return s;
      });
    });
    run(() => actions.updateTask(id, patch));
  }, [members, run]);

  const createTask = useCallback((sectionId: string, title: string) => {
    const id = tempId();
    const draft: TaskItem = {
      id, workspaceId, sectionId, title, body: "", status: "todo", assigneeId: null, assigneeName: null, dueOn: null,
      position: Number.MAX_SAFE_INTEGER, createdAt: nowSec(), completedAt: null, checklist: [], attachments: [], comments: [],
    };
    setSections((prev) => prev.map((s) => (s.id === sectionId ? { ...s, tasks: [...s.tasks, draft] } : s)));
    run(() => actions.createTask(workspaceId, sectionId, title));
  }, [workspaceId, run]);

  const deleteTask = useCallback((id: string) => {
    setSections((prev) => prev.map((s) => ({ ...s, tasks: s.tasks.filter((t) => t.id !== id) })));
    setHighlightId((h) => (h === id ? null : h));
    if (openId === id) open(null);
    run(() => actions.deleteTask(id));
  }, [openId, open, run]);

  // ---- Sections ----
  const createSection = useCallback((name: string) => {
    const id = tempId();
    setSections((prev) => [...prev, { id, name, position: prev.length, tasks: [] }]);
    run(() => actions.createSection(workspaceId, name));
  }, [workspaceId, run]);

  const renameSection = useCallback((id: string, name: string) => {
    setSections((prev) => prev.map((s) => (s.id === id ? { ...s, name } : s)));
    run(() => actions.renameSection(id, name));
  }, [run]);

  const deleteSection = useCallback((id: string) => {
    setSections((prev) => {
      const gone = prev.find((s) => s.id === id);
      const rest = prev.filter((s) => s.id !== id);
      if (!gone || rest.length === 0) return prev;
      const [first, ...others] = rest;
      return [{ ...first, tasks: [...first.tasks, ...gone.tasks.map((t) => ({ ...t, sectionId: first.id }))] }, ...others];
    });
    run(() => actions.deleteSection(id));
  }, [run]);

  const moveSection = useCallback((id: string, dir: -1 | 1) => {
    const current = sectionsRef.current;
    const i = current.findIndex((s) => s.id === id);
    const j = i + dir;
    if (i < 0 || j < 0 || j >= current.length) return;
    const next = arrayMove(current, i, j);
    setSections(next);
    run(() => actions.reorderSections(workspaceId, next.map((s) => s.id)));
  }, [workspaceId, run]);

  // ---- Checklist ----
  const addChecklistItem = useCallback((taskId: string, text: string) => {
    const id = tempId();
    patchLocal(taskId, (t) => ({ ...t, checklist: [...t.checklist, { id, text, done: false, position: t.checklist.length }] }));
    run(() => actions.addChecklistItem(taskId, text));
  }, [patchLocal, run]);
  const toggleChecklistItem = useCallback((taskId: string, itemId: string) => {
    patchLocal(taskId, (t) => ({ ...t, checklist: t.checklist.map((c) => (c.id === itemId ? { ...c, done: !c.done } : c)) }));
    run(() => actions.toggleChecklistItem(itemId));
  }, [patchLocal, run]);
  const renameChecklistItem = useCallback((taskId: string, itemId: string, text: string) => {
    patchLocal(taskId, (t) => ({ ...t, checklist: t.checklist.map((c) => (c.id === itemId ? { ...c, text } : c)) }));
    run(() => actions.renameChecklistItem(itemId, text));
  }, [patchLocal, run]);
  const deleteChecklistItem = useCallback((taskId: string, itemId: string) => {
    patchLocal(taskId, (t) => ({ ...t, checklist: t.checklist.filter((c) => c.id !== itemId) }));
    run(() => actions.deleteChecklistItem(itemId));
  }, [patchLocal, run]);

  // ---- Comments ----
  const addComment = useCallback((taskId: string, body: string) => {
    const id = tempId();
    const me = members.find((m) => m.id === currentUserId);
    patchLocal(taskId, (t) => ({ ...t, comments: [...t.comments, { id, body, authorId: currentUserId, authorName: me?.name ?? "You", createdAt: nowSec(), resolvedAt: null }] }));
    run(() => actions.addComment(taskId, body));
  }, [members, currentUserId, patchLocal, run]);
  const resolveComment = useCallback((taskId: string, commentId: string, resolved: boolean) => {
    patchLocal(taskId, (t) => ({ ...t, comments: t.comments.map((c) => (c.id === commentId ? { ...c, resolvedAt: resolved ? nowSec() : null } : c)) }));
    run(() => actions.resolveComment(commentId, resolved));
  }, [patchLocal, run]);

  // ---- View, filter, new task ----
  const changeView = useCallback((v: TaskView) => {
    setPickedView(v);
    setStoredView(v);
    if (searchParams.has("view")) setParam("view", v);
  }, [setStoredView, searchParams, setParam]);

  const requestNewTask = useCallback((sectionId?: string) => {
    const target = sectionId ?? sectionsRef.current[0]?.id;
    if (!target) return;
    setFocusRequest((f) => ({ sectionId: target, nonce: (f?.nonce ?? 0) + 1 }));
  }, []);
  const cancelNewTask = useCallback(() => setFocusRequest(null), []);

  const visible = useMemo(
    () => (mine ? sections.map((s) => ({ ...s, tasks: s.tasks.filter((t) => t.assigneeId === currentUserId) })) : sections),
    [sections, mine, currentUserId],
  );
  const flatIds = useMemo(() => visible.flatMap((s) => s.tasks.map((t) => t.id)), [visible]);
  const totalTasks = sections.reduce((n, s) => n + s.tasks.length, 0);
  const openTask = useMemo(() => (openId ? sections.flatMap((s) => s.tasks).find((t) => t.id === openId) ?? null : null), [sections, openId]);

  // ---- Keyboard ----
  useEffect(() => {
    function move(dir: -1 | 1) {
      if (flatIds.length === 0) return;
      const i = highlightId ? flatIds.indexOf(highlightId) : -1;
      const next = i < 0 ? (dir === 1 ? flatIds[0] : flatIds[flatIds.length - 1]) : flatIds[Math.max(0, Math.min(flatIds.length - 1, i + dir))];
      if (!next) return;
      setHighlightId(next);
      document.querySelector<HTMLElement>(`[data-task-id="${next}"]`)?.scrollIntoView({ block: "nearest" });
    }
    function onKey(e: KeyboardEvent) {
      if (e.metaKey || e.ctrlKey || e.altKey || activeId) return;
      if (isTypingTarget(e.target) || document.querySelector("dialog[open]")) return;
      switch (e.key) {
        case "n":
          if (!canEdit) return;
          e.preventDefault();
          requestNewTask();
          break;
        case "j": case "ArrowDown":
          e.preventDefault();
          move(1);
          break;
        case "k": case "ArrowUp":
          e.preventDefault();
          move(-1);
          break;
        case " ":
          if (isPressable(e.target) || !highlightId || !canEdit) return;
          e.preventDefault();
          toggleDone(highlightId);
          break;
        case "Enter":
          if (isPressable(e.target) || !highlightId) return;
          e.preventDefault();
          open(highlightId);
          break;
        case "Escape":
          if (openId) open(null);
          else setHighlightId(null);
          break;
      }
    }
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [flatIds, highlightId, openId, activeId, canEdit, requestNewTask, toggleDone, open]);

  // ---- Drag and drop ----
  const sensors = useSensors(
    useSensor(MouseSensor, { activationConstraint: { distance: 5 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 200, tolerance: 6 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  const onDragStart = ({ active }: DragStartEvent) => {
    const id = String(active.id);
    const from = containerOf(sectionsRef.current, id);
    if (!from) return;
    dragOrigin.current = { sectionId: from, snapshot: sectionsRef.current };
    setActiveId(id);
    setHighlightId(id);
  };

  const onDragOver = ({ active, over }: DragOverEvent) => {
    if (!over) return;
    const activeKey = String(active.id);
    const overKey = String(over.id);
    const current = sectionsRef.current;
    const from = containerOf(current, activeKey);
    const to = containerOf(current, overKey);
    if (!from || !to || from === to) return;
    const fromS = current.find((s) => s.id === from);
    const toS = current.find((s) => s.id === to);
    const task = fromS?.tasks.find((t) => t.id === activeKey);
    if (!fromS || !toS || !task) return;
    const overIndex = toS.tasks.findIndex((t) => t.id === overKey);
    let insertAt = toS.tasks.length;
    if (overIndex >= 0) {
      const dragged = active.rect.current.translated;
      const below = dragged ? dragged.top > over.rect.top + over.rect.height / 2 : false;
      insertAt = overIndex + (below ? 1 : 0);
    }
    setSections(
      current.map((s) => {
        if (s.id === from) return { ...s, tasks: s.tasks.filter((t) => t.id !== activeKey) };
        if (s.id === to) return { ...s, tasks: [...s.tasks.slice(0, insertAt), { ...task, sectionId: to }, ...s.tasks.slice(insertAt)] };
        return s;
      }),
    );
  };

  const onDragEnd = ({ active, over }: DragEndEvent) => {
    const activeKey = String(active.id);
    const origin = dragOrigin.current;
    dragOrigin.current = null;
    setActiveId(null);
    if (!origin) return;
    let next = sectionsRef.current;
    const to = containerOf(next, activeKey);
    if (!to) return;
    const overKey = over ? String(over.id) : null;
    if (overKey && overKey !== activeKey && !overKey.startsWith(SECTION_PREFIX) && containerOf(next, overKey) === to) {
      next = next.map((s) => {
        if (s.id !== to) return s;
        const oldIndex = s.tasks.findIndex((t) => t.id === activeKey);
        const newIndex = s.tasks.findIndex((t) => t.id === overKey);
        return oldIndex === newIndex ? s : { ...s, tasks: arrayMove(s.tasks, oldIndex, newIndex) };
      });
      setSections(next);
    }
    const ids = next.find((s) => s.id === to)?.tasks.map((t) => t.id) ?? [];
    const before = origin.snapshot.find((s) => s.id === to)?.tasks.map((t) => t.id) ?? [];
    const unchanged = origin.sectionId === to && ids.length === before.length && ids.every((id, i) => id === before[i]);
    if (unchanged) return;
    if (origin.sectionId !== to) run(() => actions.moveTask(activeKey, to, ids.indexOf(activeKey)));
    else run(() => actions.reorderTasks(workspaceId, to, ids));
  };

  const onDragCancel = () => {
    if (dragOrigin.current) setSections(dragOrigin.current.snapshot);
    dragOrigin.current = null;
    setActiveId(null);
  };

  const activeTask = activeId ? sections.flatMap((s) => s.tasks).find((t) => t.id === activeId) ?? null : null;

  const api: BoardApi = {
    workspaceId, slug, currentUserId, canEdit, members, openId, highlightId, focusRequest,
    open, setHighlight: setHighlightId, requestNewTask, cancelNewTask,
    createTask, updateTask, toggleDone, deleteTask,
    createSection, renameSection, deleteSection, moveSection,
    addChecklistItem, toggleChecklistItem, renameChecklistItem, deleteChecklistItem,
    addComment, resolveComment,
  };

  const showEmpty = totalTasks === 0 && focusRequest === null;

  return (
    <BoardProvider value={api}>
      <div className="flex min-h-0 flex-1">
        <div className="flex min-w-0 flex-1 flex-col">
          <Toolbar view={view} onView={changeView} mine={mine} onMine={setMine} canEdit={canEdit} onNew={() => requestNewTask()} />
          {error && (
            <div role="alert" className="mx-6 mt-3 flex items-center gap-3 rounded-r border border-late/30 bg-late-soft px-3 py-2 text-[13px] text-late">
              <span className="flex-1">{error}</span>
              <button onClick={() => setError(null)} aria-label="Dismiss" className="grid size-5 place-items-center rounded hover:bg-late/10"><XIcon /></button>
            </div>
          )}
          {sections.length === 0 ? (
            <div className="px-6 py-8">
              <Empty title="No sections yet" hint="Tasks live in sections. Add one to get going." action={canEdit && <Button variant="primary" onClick={() => createSection("To do")}>Add a section</Button>} />
            </div>
          ) : showEmpty ? (
            <div className="px-6 py-8">
              <Empty title="No tasks yet" hint="Add the first thing that needs doing." action={canEdit && <Button variant="primary" onClick={() => requestNewTask()}>New task</Button>} />
            </div>
          ) : (
            <DndContext sensors={sensors} collisionDetection={collision} onDragStart={onDragStart} onDragOver={onDragOver} onDragEnd={onDragEnd} onDragCancel={onDragCancel}>
              {view === "list" ? <ListView sections={visible} /> : <BoardView sections={visible} />}
              <DragOverlay dropAnimation={null}>
                {activeTask ? (view === "list" ? <TaskRowOverlay task={activeTask} /> : <TaskCardOverlay task={activeTask} />) : null}
              </DragOverlay>
            </DndContext>
          )}
        </div>
        {openTask && <TaskDetail key={openTask.id} task={openTask} sections={sections.map((s) => ({ id: s.id, name: s.name }))} />}
      </div>
    </BoardProvider>
  );
}
