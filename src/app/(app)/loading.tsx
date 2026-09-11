export default function Loading() {
  return (
    <div className="px-6 py-5" aria-busy="true" aria-label="Loading">
      <div className="mb-5 h-7 w-40 animate-pulse rounded-r bg-surface-2" />
      <div className="grid grid-cols-[repeat(auto-fill,minmax(260px,1fr))] gap-3">
        {[0, 1, 2].map((i) => (
          <div key={i} className="h-28 animate-pulse rounded-[10px] bg-surface-2" />
        ))}
      </div>
    </div>
  );
}
