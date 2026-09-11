import type { User } from "@/db/schema";
import { SidebarContent } from "./sidebar-content";

/** Desktop sidebar. Hidden below `md`; phones get the top bar + drawer from `MobileNav`. */
export function Sidebar({ user }: { user: User }) {
  return (
    <aside className="flex h-full w-[232px] shrink-0 flex-col gap-5 border-r border-line bg-surface-2 px-2.5 py-3.5 max-md:hidden">
      <SidebarContent user={user} />
    </aside>
  );
}
