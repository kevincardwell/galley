import Link from "next/link";
import { Icon, type IconName } from "@/components/ui/icon";

export type Step = { href: string; icon: IconName; label: string; hint: string; done: boolean };

/**
 * The nudge a brand-new project gets. Each step is a link and it drops off the
 * list the moment it is done, so the panel empties itself as the project starts.
 */
export function FirstSteps({ steps }: { steps: Step[] }) {
  const todo = steps.filter((s) => !s.done);
  if (todo.length === 0) return null;
  const done = steps.length - todo.length;
  return (
    <section className="rounded-lg border border-accent-line bg-accent-soft p-4">
      <div className="mb-2 flex items-baseline gap-2">
        <h2 className="m-0 text-sm font-semibold">Get this project going</h2>
        <span className="tnum text-xs text-ink-3">
          {done} of {steps.length} done
        </span>
      </div>
      <ul className="m-0 flex list-none flex-col gap-1 p-0">
        {todo.map((s) => (
          <li key={s.href}>
            <Link
              href={s.href}
              className="group flex cursor-pointer items-center gap-2.5 rounded-r px-2 py-1.5 transition-colors duration-150 ease-out hover:bg-surface"
            >
              <span className="grid size-6 shrink-0 place-items-center rounded-full bg-surface text-accent">
                <Icon name={s.icon} size={13} />
              </span>
              <span className="min-w-0 flex-1 text-[13px]">
                <span className="font-medium">{s.label}</span>
                <span className="text-ink-2"> — {s.hint}</span>
              </span>
              <Icon name="arrow-right" size={14} className="shrink-0 text-ink-3 transition-colors duration-150 ease-out group-hover:text-ink" />
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
}
