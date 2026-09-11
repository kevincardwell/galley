"use client";
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toggleDone } from "@/actions/tasks";
import { TaskCheckbox } from "@/components/tasks/task-checkbox";

export function QuickToggle({ taskId, title, done = false }: { taskId: string; title: string; done?: boolean }) {
  const router = useRouter();
  const [checked, setChecked] = useState(done);
  const [pending, startTransition] = useTransition();
  return (
    <TaskCheckbox
      done={checked}
      disabled={pending}
      label={checked ? `Reopen ${title}` : `Complete ${title}`}
      onToggle={() => {
        const next = !checked;
        setChecked(next);
        startTransition(async () => {
          try {
            await toggleDone(taskId);
            router.refresh();
          } catch {
            setChecked(!next);
          }
        });
      }}
    />
  );
}
