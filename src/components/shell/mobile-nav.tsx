import type { User } from "@/db/schema";
import { SidebarContent } from "./sidebar-content";
import { MobileDrawer } from "./mobile-drawer";

/** Mobile top bar + slide-in drawer. Server component so the drawer body can be the same `SidebarContent`. */
export function MobileNav({ user }: { user: User }) {
  return (
    <MobileDrawer>
      <SidebarContent user={user} />
    </MobileDrawer>
  );
}
