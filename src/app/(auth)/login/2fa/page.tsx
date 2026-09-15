export const dynamic = "force-dynamic";
import { redirect } from "next/navigation";
import { getPendingSession } from "@/lib/auth/session";
import { verifyTotpAction } from "@/actions/auth";
import { AuthForm } from "@/components/auth-form";

export const metadata = { title: "Two-factor" };

export default async function TwoFactorPage({ searchParams }: { searchParams: Promise<{ next?: string }> }) {
  // No pending sign-in means the password step has not happened (or it timed out).
  if (!(await getPendingSession())) redirect("/login");
  const { next = "" } = await searchParams;
  return (
    <AuthForm
      action={verifyTotpAction}
      title="Enter your code"
      intro="Open your authenticator app and type the six-digit code for this account. A recovery code works here too."
      hidden={{ next }}
      fields={[{ name: "code", label: "Authentication code", autoComplete: "one-time-code" }]}
      submit="Sign in"
    />
  );
}
