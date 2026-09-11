"use client";
import Link from "next/link";
import { useEffect } from "react";
import { Button } from "@/components/ui/button";

export default function ErrorPage({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    console.error(error);
  }, [error]);
  return (
    <main className="grid min-h-dvh place-items-center px-4">
      <div className="w-full max-w-sm rounded-[10px] border border-line bg-surface p-5 text-center">
        <h1 className="m-0 text-lg font-semibold">Something went wrong</h1>
        <p className="mb-4 mt-1 text-ink-2">The page hit an error it could not recover from. Trying again usually fixes it.</p>
        {error.digest && <p className="mb-4 mt-0 font-mono text-xs text-ink-3">{error.digest}</p>}
        <div className="flex items-center justify-center gap-3">
          <Button variant="primary" onClick={() => reset()}>Try again</Button>
          <Link href="/" className="underline underline-offset-[3px]">Back to your workspaces</Link>
        </div>
      </div>
    </main>
  );
}
