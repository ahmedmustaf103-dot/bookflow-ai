import { Button, ButtonLink } from "@/components/ui/button";
import { Surface } from "@/components/ui/surface";
import { acceptInviteAction } from "@/server/actions/team";
import { requireDbUser } from "@/server/auth/session";
import {
  normalizeInviteEmail,
  peekOrganizationInvite,
} from "@/server/team/team";

export const dynamic = "force-dynamic";

export default async function AcceptInvitePage({
  params,
  searchParams,
}: {
  params: Promise<{ token: string }>;
  searchParams: Promise<{ error?: string }>;
}) {
  const user = await requireDbUser();
  const { token } = await params;
  const { error } = await searchParams;
  const invite = await peekOrganizationInvite(token);
  const emailMatch =
    invite != null &&
    normalizeInviteEmail(user.email) === normalizeInviteEmail(invite.email);

  if (!invite || invite.status === "REVOKED") {
    return (
      <Surface className="max-w-md p-6">
        <h1 className="text-lg font-semibold">Invite</h1>
        <p className="mt-2 text-sm text-[var(--danger)]" role="alert">
          This invite is no longer valid.
        </p>
        <div className="mt-4">
          <ButtonLink href="/dashboard" size="sm" variant="secondary">
            Go to dashboard
          </ButtonLink>
        </div>
      </Surface>
    );
  }

  if (invite.status === "ACCEPTED") {
    return (
      <Surface className="max-w-md p-6">
        <h1 className="text-lg font-semibold">
          Join {invite.organization.name}
        </h1>
        <p className="mt-2 text-sm text-[var(--ink-secondary)]">
          This invite was already accepted. If you are on the team, open the
          business.
        </p>
        {error ? (
          <p className="mt-3 text-sm text-[var(--danger)]" role="alert">
            {error}
          </p>
        ) : null}
        <form action={acceptInviteAction} className="mt-4">
          <input type="hidden" name="token" value={token} />
          <Button type="submit">Open {invite.organization.name}</Button>
        </form>
        <div className="mt-4">
          <ButtonLink href="/dashboard" size="sm" variant="secondary">
            Go to dashboard
          </ButtonLink>
        </div>
      </Surface>
    );
  }

  if (invite.expiresAt.getTime() <= Date.now()) {
    return (
      <Surface className="max-w-md p-6">
        <h1 className="text-lg font-semibold">Invite</h1>
        <p className="mt-2 text-sm text-[var(--danger)]" role="alert">
          This invite has expired. Ask the owner to send a new one.
        </p>
        <div className="mt-4">
          <ButtonLink href="/dashboard" size="sm" variant="secondary">
            Go to dashboard
          </ButtonLink>
        </div>
      </Surface>
    );
  }

  return (
    <Surface className="max-w-md p-6">
      <h1 className="text-lg font-semibold">Join {invite.organization.name}</h1>
      <p className="mt-2 text-sm text-[var(--ink-secondary)]">
        You were invited as {invite.role.toLowerCase()}. Signed in as{" "}
        {user.email}.
      </p>
      {error ? (
        <p className="mt-3 text-sm text-[var(--danger)]" role="alert">
          {error}
        </p>
      ) : null}
      {!emailMatch ? (
        <p className="mt-3 text-sm text-[var(--danger)]" role="alert">
          This invite was sent to {invite.email}. Sign in with that email, then
          open the link again.
        </p>
      ) : (
        <form action={acceptInviteAction} className="mt-4">
          <input type="hidden" name="token" value={token} />
          <Button type="submit">Accept invite</Button>
        </form>
      )}
      <div className="mt-4">
        <ButtonLink href="/dashboard" size="sm" variant="secondary">
          Go to dashboard
        </ButtonLink>
      </div>
    </Surface>
  );
}
