import { redirect } from "next/navigation";
import { hasAnyUser } from "@/lib/settings";
import { setupAction } from "@/actions/auth";
import { AuthForm } from "@/components/auth-form";

export const metadata = { title: "Set up" };

export default function SetupPage() {
  if (hasAnyUser()) redirect("/login");
  return (
    <AuthForm
      action={setupAction}
      title="Create the admin account"
      intro="This is a fresh install. The first account is the instance admin and invites everyone else."
      fields={[
        { name: "name", label: "Your name", autoComplete: "name" },
        { name: "email", label: "Email", type: "email", autoComplete: "email" },
        { name: "password", label: "Password", type: "password", autoComplete: "new-password" },
      ]}
      submit="Create account"
    />
  );
}
