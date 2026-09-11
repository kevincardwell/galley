export default function Loading() {
  return (
    <div className="grid gap-6 px-6 py-5 lg:grid-cols-[1fr_320px]" aria-busy="true" aria-label="Loading">
      <div className="flex flex-col gap-7">
        {[0, 1, 2].map((s) => (
          <div key={s}>
            <div className="mb-3 h-4 w-24 animate-pulse rounded-r bg-surface-2" />
            <div className="flex flex-col gap-2.5">
              <div className="h-4 w-3/4 animate-pulse rounded-r bg-surface-2" />
              <div className="h-4 w-1/2 animate-pulse rounded-r bg-surface-2" />
              <div className="h-4 w-2/3 animate-pulse rounded-r bg-surface-2" />
            </div>
          </div>
        ))}
      </div>
      <aside>
        <div className="mb-3 h-4 w-16 animate-pulse rounded-r bg-surface-2" />
        <div className="flex flex-col gap-2.5">
          <div className="h-4 w-full animate-pulse rounded-r bg-surface-2" />
          <div className="h-4 w-5/6 animate-pulse rounded-r bg-surface-2" />
          <div className="h-4 w-2/3 animate-pulse rounded-r bg-surface-2" />
        </div>
      </aside>
    </div>
  );
}
