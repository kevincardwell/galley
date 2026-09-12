export default function Loading() {
  return (
    <div className="mx-auto flex w-full max-w-[1180px] flex-col gap-6 px-4 py-4 sm:px-6 sm:py-5" aria-busy="true" aria-label="Loading">
      <div className="grid grid-cols-2 rounded-lg border border-line sm:grid-cols-4">
        {[0, 1, 2, 3].map((i) => (
          <div key={i} className="flex flex-col gap-2 p-4">
            <div className="h-3 w-20 animate-pulse rounded-r bg-surface-2" />
            <div className="h-5 w-14 animate-pulse rounded-r bg-surface-2" />
          </div>
        ))}
      </div>
      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_320px]">
        <div className="flex flex-col gap-6">
          {[0, 1, 2].map((s) => (
            <div key={s} className="flex flex-col gap-2">
              <div className="h-4 w-24 animate-pulse rounded-r bg-surface-2" />
              <div className="h-4 w-3/4 animate-pulse rounded-r bg-surface-2" />
              <div className="h-4 w-1/2 animate-pulse rounded-r bg-surface-2" />
              <div className="h-4 w-2/3 animate-pulse rounded-r bg-surface-2" />
            </div>
          ))}
        </div>
        <aside className="flex flex-col gap-2">
          <div className="h-4 w-16 animate-pulse rounded-r bg-surface-2" />
          <div className="h-4 w-full animate-pulse rounded-r bg-surface-2" />
          <div className="h-4 w-5/6 animate-pulse rounded-r bg-surface-2" />
          <div className="h-4 w-2/3 animate-pulse rounded-r bg-surface-2" />
        </aside>
      </div>
    </div>
  );
}
