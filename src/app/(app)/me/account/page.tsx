import { requireUser } from "@/lib/auth/current";
import { AccountForm } from "@/components/shell/account-form";

export const metadata = { title: "Account · Galley" };

export default async function AccountPage() {
  const user = await requireUser();
  return (
    <div className="mx-auto w-full max-w-xl px-6 py-6">
      <header className="mb-5">
        <h1 className="m-0 text-xl font-semibold tracking-tight">Account</h1>
        <p className="m-0 mt-1 text-ink-2">Your name, sign-in details and role on this instance.</p>
      </header>
      <AccountForm name={user.name} email={user.email} role={user.isAdmin ? "Admin" : "Member"} />
    </div>
  );
}
