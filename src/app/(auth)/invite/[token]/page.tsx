import { and, eq, isNull } from "drizzle-orm";
import { db, schema } from "@/db/client";
import { acceptInviteAction } from "@/actions/auth";
import { AuthForm } from "@/components/auth-form";

export const metadata = { title: "Join" };

function findLiveInvite(token: string) {
  const invite = db
    .select()
    .from(schema.invites)
    .where(and(eq(schema.invites.token, token), isNull(schema.invites.acceptedAt), isNull(schema.invites.revokedAt)))
    .get();
  if (!invite || invite.expiresAt < Math.floor(Date.now() / 1000)) return null;
  return invite;
}

export default async function InvitePage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const invite = findLiveInvite(token);
  if (!invite) {
    return (
      <div>
        <h1 className="m-0 text-lg font-semibold">This invite has expired</h1>
        <p className="mb-0 text-ink-2">Ask the person who invited you to send a new link.</p>
      </div>
    );
  }
  const ws = invite.workspaceId ? db.select({ name: schema.workspaces.name }).from(schema.workspaces).where(eq(schema.workspaces.id, invite.workspaceId)).get() : null;
  return (
    <AuthForm
      action={acceptInviteAction}
      title={ws ? `Join ${ws.name}` : "Create your account"}
      intro="Choose a password to finish setting up your account."
      hidden={{ token }}
      fields={[
        { name: "email", label: "Email", type: "email", defaultValue: invite.email, readOnly: true },
        { name: "name", label: "Your name", autoComplete: "name", defaultValue: invite.name ?? "" },
        { name: "password", label: "Password", type: "password", autoComplete: "new-password" },
      ]}
      submit="Join"
    />
  );
}
