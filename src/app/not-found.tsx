import Link from "next/link";

export default function NotFound() {
  return (
    <main className="grid min-h-dvh place-items-center px-4">
      <div className="text-center">
        <h1 className="m-0 text-lg font-semibold">That page could not be found</h1>
        <p className="mb-4 mt-1 text-ink-2">It may have been deleted, or you may not have been added to it.</p>
        <Link href="/" className="underline underline-offset-[3px]">Back to your workspaces</Link>
      </div>
    </main>
  );
}
