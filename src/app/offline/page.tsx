import { Icon } from "@/components/ui/icon";

export const metadata = { title: "Offline" };

export default function OfflinePage() {
  return (
    <main className="grid min-h-dvh place-items-center px-4">
      <div className="max-w-sm text-center">
        <span className="mx-auto mb-3 grid size-10 place-items-center rounded-full bg-surface-2 text-ink-3">
          <Icon name="alert" size={18} />
        </span>
        <h1 className="m-0 text-lg font-semibold">No connection</h1>
        <p className="mt-1 mb-4 text-ink-2">Galley keeps everything on your server, so it needs a connection to load. Try again once you are back online.</p>
        {/* eslint-disable-next-line @next/next/no-html-link-for-pages -- a full reload is the point: the client bundle may be stale */}
        <a href="/" className="inline-flex cursor-pointer items-center gap-1.5 rounded-r border border-line bg-surface px-3 py-1.5 font-medium transition-colors hover:bg-surface-2">
          <Icon name="refresh" size={15} />
          Try again
        </a>
      </div>
    </main>
  );
}
