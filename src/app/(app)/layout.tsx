import { requireUser } from "@/lib/auth/current";
import { Sidebar } from "@/components/shell/sidebar";
import { MobileNav } from "@/components/shell/mobile-nav";
import { CommandPalette } from "@/components/shell/command-palette";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const user = await requireUser();
  return (
    <div className="flex min-h-dvh flex-col md:h-full md:flex-row">
      <MobileNav user={user} />
      <Sidebar user={user} />
      <main className="flex min-w-0 flex-1 flex-col bg-surface">{children}</main>
      <CommandPalette />
    </div>
  );
}
