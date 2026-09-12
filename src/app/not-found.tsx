import Link from "next/link";
import { Icon } from "@/components/ui/icon";

export default function NotFound() {
  return (
    <main className="grid min-h-dvh place-items-center px-4 py-10">
      <div className="flex w-full max-w-[400px] flex-col items-center text-center">
        <span className="mb-3 grid size-10 place-items-center rounded-full bg-surface-2 text-ink-3">
          <Icon name="search" size={18} />
        </span>
        <h1 className="m-0 text-lg leading-tight font-semibold tracking-tight">That page could not be found</h1>
        <p className="m-0 mt-1.5 text-[13px] text-ink-2">It may have been deleted, or you may not have been added to it.</p>
        <Link
          href="/"
          className="mt-5 inline-flex cursor-pointer items-center gap-1.5 rounded-r border border-line bg-surface px-3 py-1.5 font-medium transition-colors duration-150 hover:bg-surface-2"
        >
          <Icon name="arrow-left" size={15} />
          Back to your workspaces
        </Link>
      </div>
    </main>
  );
}
