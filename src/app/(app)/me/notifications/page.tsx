import { requireUser } from "@/lib/auth/current";
import { listNotifications } from "@/lib/queries/notifications";
import { NotificationList } from "@/components/notifications/list";

export const metadata = { title: "Notifications" };

export default async function NotificationsPage() {
  const user = await requireUser();
  const items = listNotifications(user.id);
  return (
    <div className="mx-auto w-full max-w-2xl px-6 py-6">
      <header className="mb-5">
        <h1 className="m-0 text-xl font-semibold tracking-tight">Notifications</h1>
        <p className="m-0 mt-1 text-ink-2">Mentions, assignments and client activity that involve you. Open one to go to it.</p>
      </header>
      <NotificationList items={items} />
    </div>
  );
}
