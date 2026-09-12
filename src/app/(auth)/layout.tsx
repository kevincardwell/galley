import Link from "next/link";

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <main className="grid min-h-full place-items-center px-4 py-10 sm:py-16">
      <div className="w-full max-w-[400px]">
        <div className="mb-7 text-center">
          <Link href="/" className="inline-flex cursor-pointer items-center gap-2 text-[17px] font-semibold tracking-tight">
            <span aria-hidden className="relative inline-block size-[22px] rounded bg-ink after:absolute after:inset-[6px] after:border-b-2 after:border-l-2 after:border-surface" />
            Galley
          </Link>
          <p className="m-0 mt-2.5 text-ink-2">Client websites, kept in one place: the tasks, the copy and the files for every project.</p>
        </div>
        <div className="rounded-lg border border-line bg-surface p-6 shadow-panel sm:p-7">{children}</div>
        <p className="m-0 mt-5 text-center text-xs text-ink-3">Self-hosted Galley. Ask whoever runs this instance if you cannot get in.</p>
      </div>
    </main>
  );
}
