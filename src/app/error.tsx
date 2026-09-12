"use client";
import Link from "next/link";
import { useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Icon } from "@/components/ui/icon";

export default function ErrorPage({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    console.error(error);
  }, [error]);
  return (
    <main className="grid min-h-dvh place-items-center px-4 py-10">
      <div className="flex w-full max-w-[400px] flex-col items-center rounded-lg border border-line bg-surface p-6 text-center sm:p-7">
        <span className="mb-3 grid size-10 place-items-center rounded-full bg-late-soft text-late">
          <Icon name="warning" size={18} />
        </span>
        <h1 className="m-0 text-lg leading-tight font-semibold tracking-tight">Something went wrong</h1>
        <p className="m-0 mt-1.5 text-[13px] text-ink-2">The page hit an error it could not recover from. Trying again usually fixes it.</p>
        {error.digest && <p className="tnum m-0 mt-3 font-mono text-xs text-ink-3">{error.digest}</p>}
        <div className="mt-5 flex flex-wrap items-center justify-center gap-2">
          <Button variant="primary" icon="refresh" onClick={() => reset()}>Try again</Button>
          <Link
            href="/"
            className="inline-flex cursor-pointer items-center gap-1.5 rounded-r px-3 py-1.5 font-medium text-ink-2 transition-colors duration-150 hover:bg-surface-2 hover:text-ink"
          >
            <Icon name="arrow-left" size={15} />
            Back to your workspaces
          </Link>
        </div>
      </div>
    </main>
  );
}
