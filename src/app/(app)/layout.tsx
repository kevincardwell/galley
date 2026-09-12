import { requireUser } from "@/lib/auth/current";
import { Sidebar } from "@/components/shell/sidebar";
import { MobileNav } from "@/components/shell/mobile-nav";
import { InstallApp } from "@/components/shell/install-app";
import { CommandPalette } from "@/components/shell/command-palette";
import { ShortcutsSheet } from "@/components/shell/shortcuts-sheet";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const user = await requireUser();
  return (
    <div className="flex min-h-dvh flex-col md:h-full md:flex-row">
      <a
        href="#main"
        className="sr-only z-[70] rounded-r bg-accent px-3 py-1.5 font-medium text-accent-ink focus:not-sr-only focus:fixed focus:left-3 focus:top-3"
      >
        Skip to content
      </a>
      <MobileNav user={user} />
      <Sidebar user={user} />
      <main id="main" tabIndex={-1} className="flex min-w-0 flex-1 flex-col bg-surface outline-none">{children}</main>
      <CommandPalette />
      <InstallApp />
      <ShortcutsSheet />
    </div>
  );
}
