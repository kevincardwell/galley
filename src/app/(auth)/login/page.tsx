export const dynamic = "force-dynamic";
import { redirect } from "next/navigation";
import { hasAnyUser } from "@/lib/settings";
import { currentUser } from "@/lib/auth/current";
import { loginAction } from "@/actions/auth";
import { AuthForm } from "@/components/auth-form";

export const metadata = { title: "Sign in" };

/**
 * Why a proxy sign-in did not work, said plainly. Anyone who gets here has
 * already been let through by the proxy, so this is a configuration problem on
 * the Galley side and the message should point at it.
 */
const SSO_REASON: Record<string, string> = {
  "unknown-user": "Your proxy signed you in, but nobody with that email address has been invited to Galley yet. Ask an admin to invite you.",
  deactivated: "That account has been switched off. Ask an admin to turn it back on.",
  "no-header": "Your proxy did not pass an email address, so Galley could not tell who you are.",
  disabled: "This Galley is not set up to accept sign-ins from a proxy.",
};

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ next?: string; sso?: string }> }) {
  if (!hasAnyUser()) redirect("/setup");
  if (await currentUser()) redirect("/");
  const { next = "", sso } = await searchParams;
  return (
    <AuthForm
      action={loginAction}
      title="Sign in"
      intro={(sso && SSO_REASON[sso]) || "Use the email and password your studio set up for you."}
      hidden={{ next }}
      fields={[
        { name: "email", label: "Email", type: "email", autoComplete: "email" },
        { name: "password", label: "Password", type: "password", autoComplete: "current-password" },
      ]}
      submit="Sign in"
    />
  );
}
