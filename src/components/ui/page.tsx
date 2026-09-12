import { clsx } from "@/lib/clsx";

/** Screen heading: eyebrow, title, count, and the one primary action. */
export function PageHeader({ title, eyebrow, count, action, description, className }: {
  title: string; eyebrow?: string; count?: number | string; action?: React.ReactNode; description?: string; className?: string;
}) {
  return (
    <header className={clsx("mb-5 flex flex-wrap items-start gap-3", className)}>
      <div className="min-w-0 flex-1">
        {eyebrow && <p className="m-0 mb-0.5 text-xs font-medium text-ink-3">{eyebrow}</p>}
        <div className="flex items-baseline gap-2">
          <h1 className="m-0 text-[22px] leading-tight font-semibold tracking-tight text-balance">{title}</h1>
          {count !== undefined && <span className="tnum text-sm text-ink-3">{count}</span>}
        </div>
        {description && <p className="m-0 mt-1 max-w-[68ch] text-ink-2">{description}</p>}
      </div>
      {action && <div className="flex shrink-0 flex-wrap items-center gap-2">{action}</div>}
    </header>
  );
}

/** Section inside a screen: small heading, optional action on the right. */
export function Section({ title, action, children, className }: { title?: string; action?: React.ReactNode; children: React.ReactNode; className?: string }) {
  return (
    <section className={clsx("flex flex-col gap-2", className)}>
      {(title || action) && (
        <div className="flex items-center gap-3">
          {title && <h2 className="m-0 text-sm font-semibold">{title}</h2>}
          {action && <div className="ml-auto flex items-center gap-1.5">{action}</div>}
        </div>
      )}
      {children}
    </section>
  );
}

/** Centres and caps a screen so wide monitors do not stretch the content. */
export function Screen({ children, width = "wide", className }: { children: React.ReactNode; width?: "wide" | "narrow" | "full"; className?: string }) {
  return (
    <div className={clsx("w-full px-4 py-4 sm:px-6 sm:py-5", width === "wide" && "mx-auto max-w-[1180px]", width === "narrow" && "mx-auto max-w-[760px]", className)}>
      {children}
    </div>
  );
}
