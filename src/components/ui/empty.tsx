import { Icon, type IconName } from "./icon";

/** Every empty state: what goes here, and the one thing to do about it. */
export function Empty({ title, hint, action, icon = "sparkles" }: { title: string; hint?: string; action?: React.ReactNode; icon?: IconName }) {
  return (
    <div className="flex flex-col items-center rounded-lg border border-dashed border-line px-6 py-10 text-center">
      <span className="mb-3 grid size-10 place-items-center rounded-full bg-surface-2 text-ink-3">
        <Icon name={icon} size={18} />
      </span>
      <p className="m-0 font-medium">{title}</p>
      {hint && <p className="m-0 mt-1 max-w-[46ch] text-ink-2">{hint}</p>}
      {action && <div className="mt-4 flex justify-center gap-2">{action}</div>}
    </div>
  );
}
