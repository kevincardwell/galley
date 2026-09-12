"use client";
import Link from "next/link";
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { clsx } from "@/lib/clsx";
import { formatDue } from "@/lib/format";
import { toggleDone } from "@/actions/tasks";
import { TaskCheckbox } from "./task-checkbox";
import { Icon } from "@/components/ui/icon";
import type { MyTaskGroup } from "./types";

const nowSec = () => Math.floor(Date.now() / 1000);

export function MyTasksList({ initialGroups }: { initialGroups: MyTaskGroup[] }) {
  const router = useRouter();
  const [, startTransition] = useTransition();
  const [prev, setPrev] = useState(initialGroups);
  const [groups, setGroups] = useState(initialGroups);
  if (prev !== initialGroups) {
    setPrev(initialGroups);
    setGroups(initialGroups);
  }
  const [error, setError] = useState<string | null>(null);

  const toggle = (id: string) => {
    setGroups((gs) =>
      gs.map((g) => ({
        ...g,
        tasks: g.tasks.map((t) => (t.id === id ? (t.status === "done" ? { ...t, status: "todo", completedAt: null } : { ...t, status: "done", completedAt: nowSec() }) : t)),
      })),
    );
    startTransition(async () => {
      try {
        await toggleDone(id);
      } catch (e) {
        setError(e instanceof Error && e.message ? e.message : "That did not save. Try again.");
        router.refresh();
      }
    });
  };

  return (
    <div className="flex flex-col gap-7">
      {error && <p role="alert" className="m-0 rounded-r border border-late/30 bg-late-soft px-3 py-2 text-[13px] text-late">{error}</p>}
      {groups.map((g) => (
        <section key={g.workspace.id} style={{ ["--accent" as string]: g.workspace.accent }}>
          <h2 className="m-0 mb-1.5 flex items-center gap-2 text-sm font-semibold">
            <span className="size-2 rounded-full" style={{ background: g.workspace.accent }} aria-hidden="true" />
            <Link href={`/w/${g.workspace.slug}/tasks`} className="hover:underline">{g.workspace.name}</Link>
            <span className="tnum text-xs font-normal text-ink-3">{g.tasks.filter((t) => t.status !== "done").length} open</span>
          </h2>
          <ul className="m-0 list-none divide-y divide-line-2 border-y border-line-2 p-0">
            {g.tasks.map((t) => {
              const done = t.status === "done";
              const due = formatDue(t.dueOn);
              return (
                <li key={t.id} className="group flex items-center gap-3 px-2 py-2 transition-colors duration-150 hover:bg-surface-2">
                  <TaskCheckbox done={done} label={done ? `Reopen ${t.title}` : `Complete ${t.title}`} onToggle={() => toggle(t.id)} />
                  <Link href={`/w/${g.workspace.slug}/tasks?task=${t.id}`} className="flex min-w-0 flex-1 items-baseline gap-2">
                    <span className={clsx("truncate", done && "text-ink-3 line-through decoration-ink-3/60")}>{t.title}</span>
                    <span className="hidden shrink-0 text-xs text-ink-3 sm:inline">{t.sectionName}</span>
                  </Link>
                  {due.label && (
                    <span className={clsx("tnum shrink-0 text-xs", done ? "text-ink-3" : due.tone === "late" ? "font-medium text-late" : due.tone === "soon" ? "font-medium text-review" : "text-ink-2")}>{due.label}</span>
                  )}
                  <Link href={`/w/${g.workspace.slug}/tasks?task=${t.id}`} aria-label={`Open ${t.title}`} className="grid size-6 cursor-pointer place-items-center rounded text-ink-3 opacity-0 transition-opacity duration-150 ease-out group-hover:opacity-100 hover:text-ink focus-visible:opacity-100"><Icon name="arrow-right" size={14} /></Link>
                </li>
              );
            })}
          </ul>
        </section>
      ))}
    </div>
  );
}
