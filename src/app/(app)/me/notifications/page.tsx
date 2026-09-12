import { requireUser } from "@/lib/auth/current";
import { listNotifications } from "@/lib/queries/notifications";
import { PageHeader, Screen } from "@/components/ui/page";
import { NotificationList } from "@/components/notifications/list";

export const metadata = { title: "Notifications" };

export default async function NotificationsPage() {
  const user = await requireUser();
  const items = listNotifications(user.id);
  const unread = items.filter((n) => !n.readAt).length;
  return (
    <Screen width="narrow">
      <PageHeader
        eyebrow="You"
        title="Notifications"
        count={unread > 0 ? `${unread} unread` : undefined}
        description="Mentions, assignments and client activity that involve you. Open one to go to it."
      />
      <NotificationList items={items} />
    </Screen>
  );
}
