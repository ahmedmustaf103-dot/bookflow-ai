import { redirect } from "next/navigation";

import { ButtonLink } from "@/components/ui/button";
import { Surface } from "@/components/ui/surface";
import { requireDbUser } from "@/server/auth/session";
import { acceptOrganizationInvite } from "@/server/team/team";
import { setActiveOrganizationId } from "@/server/tenant/context";

export const dynamic = "force-dynamic";

export default async function AcceptInvitePage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const user = await requireDbUser();
  const { token } = await params;

  const result = await acceptOrganizationInvite({
    token,
    userId: user.id,
    userEmail: user.email,
  });

  if (result.ok) {
    await setActiveOrganizationId(result.data.organizationId);
    redirect("/dashboard");
  }

  return (
    <Surface className="max-w-md p-6">
      <h1 className="text-lg font-semibold">Invite</h1>
      <p className="mt-2 text-sm text-[var(--danger)]" role="alert">
        {result.error}
      </p>
      <p className="mt-3 text-sm text-[var(--ink-secondary)]">
        Signed in as {user.email}. Use the email the invite was sent to, then
        open the link again.
      </p>
      <div className="mt-4">
        <ButtonLink href="/dashboard" size="sm" variant="secondary">
          Go to dashboard
        </ButtonLink>
      </div>
    </Surface>
  );
}
