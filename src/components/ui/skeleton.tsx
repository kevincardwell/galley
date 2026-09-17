import { clsx } from "@/lib/clsx";

function Block({ className }: { className: string }) {
  return <div aria-hidden className={clsx("animate-pulse rounded-r bg-surface-2", className)} />;
}

/**
 * The grey shape a screen shows while its data loads, per kind of screen. Each route's
 * loading.tsx picks the variant that looks like what is coming, so the layout does not jump.
 */
export function PageSkeleton({ variant = "list", padded = true }: { variant?: "list" | "grid" | "board" | "editor" | "form"; padded?: boolean }) {
  return (
    <div className={clsx("mx-auto w-full max-w-[1180px]", padded && "px-4 py-4 sm:px-6 sm:py-5")} aria-busy="true" aria-label="Loading">
      <Block className="mb-5 h-6 w-40" />
      {variant === "list" && (
        <div className="flex flex-col gap-2">
          {[0, 1, 2, 3, 4, 5].map((i) => (
            <Block key={i} className="h-12 w-full rounded-r border border-line-2" />
          ))}
        </div>
      )}
      {variant === "grid" && (
        <div className="grid grid-cols-[repeat(auto-fill,minmax(180px,1fr))] gap-3">
          {[0, 1, 2, 3, 4, 5].map((i) => (
            <Block key={i} className="h-[152px] rounded-lg border border-line" />
          ))}
        </div>
      )}
      {variant === "board" && (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {[0, 1, 2].map((i) => (
            <div key={i} className="flex flex-col gap-2 rounded-lg border border-line p-3">
              <Block className="h-4 w-24" />
              <Block className="h-16 w-full" />
              <Block className="h-16 w-full" />
            </div>
          ))}
        </div>
      )}
      {variant === "editor" && (
        <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_320px]">
          <div className="flex flex-col gap-3">
            <Block className="h-5 w-36" />
            {[0, 1, 2, 3, 4].map((i) => (
              <Block key={i} className={i % 2 ? "h-4 w-2/3" : "h-4 w-full"} />
            ))}
          </div>
          <aside className="flex flex-col gap-2">
            <Block className="h-4 w-20" />
            <Block className="h-9 w-full" />
            <Block className="h-9 w-full" />
          </aside>
        </div>
      )}
      {variant === "form" && (
        <div className="flex max-w-lg flex-col gap-5">
          {[0, 1, 2].map((i) => (
            <div key={i} className="flex flex-col gap-2">
              <Block className="h-3.5 w-24" />
              <Block className="h-9 w-full" />
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
