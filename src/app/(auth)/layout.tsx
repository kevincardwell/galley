export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <main className="min-h-full grid place-items-center px-4 py-12">
      <div className="w-full max-w-sm">
        <div className="mb-6 flex items-center gap-2 font-semibold tracking-tight">
          <span className="relative inline-block size-[18px] rounded bg-ink after:absolute after:inset-[5px] after:border-b-2 after:border-l-2 after:border-surface" />
          Galley
        </div>
        <div className="rounded-[10px] border border-line bg-surface p-6 shadow-panel">{children}</div>
      </div>
    </main>
  );
}
