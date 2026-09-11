export const dynamic = "force-dynamic";
import { redirect } from "next/navigation";
import { hasAnyUser } from "@/lib/settings";
import { currentUser } from "@/lib/auth/current";
import { loginAction } from "@/actions/auth";
import { AuthForm } from "@/components/auth-form";

export const metadata = { title: "Sign in" };

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ next?: string }> }) {
  if (!hasAnyUser()) redirect("/setup");
  if (await currentUser()) redirect("/");
  const { next = "" } = await searchParams;
  return (
    <AuthForm
      action={loginAction}
      title="Sign in"
      hidden={{ next }}
      fields={[
        { name: "email", label: "Email", type: "email", autoComplete: "email" },
        { name: "password", label: "Password", type: "password", autoComplete: "current-password" },
      ]}
      submit="Sign in"
    />
  );
}
