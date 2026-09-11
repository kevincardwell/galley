export function Empty({ title, hint, action }: { title: string; hint?: string; action?: React.ReactNode }) {
  return (
    <div className="rounded-r border border-dashed border-line px-6 py-10 text-center">
      <p className="m-0 font-medium">{title}</p>
      {hint && <p className="m-0 mt-1 text-ink-2">{hint}</p>}
      {action && <div className="mt-4 flex justify-center">{action}</div>}
    </div>
  );
}
