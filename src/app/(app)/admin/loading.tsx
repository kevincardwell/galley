export default function Loading() {
  return (
    <div className="px-6 py-5" aria-busy="true" aria-label="Loading">
      <div className="mb-4 h-4 w-32 animate-pulse rounded-r bg-surface-2" />
      <div className="flex flex-col gap-2.5">
        <div className="h-4 w-full animate-pulse rounded-r bg-surface-2" />
        <div className="h-4 w-5/6 animate-pulse rounded-r bg-surface-2" />
        <div className="h-4 w-3/4 animate-pulse rounded-r bg-surface-2" />
        <div className="h-4 w-2/3 animate-pulse rounded-r bg-surface-2" />
      </div>
    </div>
  );
}
