import { requireUser } from "@/lib/auth/current";
import { PageHeader, Screen } from "@/components/ui/page";
import { AccountForm } from "@/components/shell/account-form";

export const metadata = { title: "Account" };

export default async function AccountPage() {
  const user = await requireUser();
  return (
    <Screen width="narrow">
      <PageHeader eyebrow="You" title="Account" description="Your name, sign-in details and role on this instance." />
      <AccountForm name={user.name} email={user.email} role={user.isAdmin ? "Admin" : "Member"} />
    </Screen>
  );
}
