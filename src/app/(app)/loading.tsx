export default function Loading() {
  return (
    <div className="mx-auto w-full max-w-[1180px] px-4 py-4 sm:px-6 sm:py-5" aria-busy="true" aria-label="Loading">
      <div className="mb-5 h-7 w-40 animate-pulse rounded-r bg-surface-2" />
      <div className="mb-4 flex flex-wrap gap-2">
        <div className="h-8 w-64 animate-pulse rounded-r bg-surface-2" />
        <div className="h-7 w-52 animate-pulse rounded-full bg-surface-2" />
      </div>
      <div className="grid grid-cols-[repeat(auto-fill,minmax(272px,1fr))] gap-3">
        {[0, 1, 2, 3, 4, 5].map((i) => (
          <div key={i} className="h-[152px] animate-pulse rounded-lg border border-line bg-surface-2" />
        ))}
      </div>
    </div>
  );
}
