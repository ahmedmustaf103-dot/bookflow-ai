import { ActionForm } from "@/components/forms/action-form";
import { ButtonLink } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { Input, Select } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { PageHeader } from "@/components/ui/page-header";
import { Surface } from "@/components/ui/surface";
import {
  inviteTeamMemberAction,
  revokeInviteAction,
} from "@/server/actions/team";
import { canAssignInviteRole, INVITEABLE_ROLES } from "@/server/team/roles";
import { inviteAcceptUrl } from "@/server/team/team";
import { requireOrgRole } from "@/server/tenant/context";

export default async function TeamSettingsPage() {
  const ctx = await requireOrgRole("ADMIN");
  const actorRole = ctx.membership.role;
  const assignable = INVITEABLE_ROLES.filter((role) =>
    canAssignInviteRole(actorRole, role),
  );

  const [members, invites] = await Promise.all([
    ctx.db.membership.findMany({
      where: { status: "ACTIVE" },
      include: {
        user: {
          select: { email: true, firstName: true, lastName: true },
        },
      },
      orderBy: { createdAt: "asc" },
    }),
    ctx.db.organizationInvite.findMany({
      where: { status: "PENDING", expiresAt: { gt: new Date() } },
      orderBy: { createdAt: "desc" },
    }),
  ]);

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Team"
        description="Invite people who need a dashboard login. Bookable chairs stay on Staff."
        actions={
          <ButtonLink href="/dashboard/settings" size="sm" variant="secondary">
            Back to settings
          </ButtonLink>
        }
      />

      <Surface className="max-w-lg">
        <h2 className="text-sm font-semibold">Active members</h2>
        {members.length === 0 ? (
          <EmptyState
            className="mt-3"
            title="No members"
            description="You should always have at least the owner account."
          />
        ) : (
          <ul className="mt-3 divide-y divide-[var(--border)]">
            {members.map((m) => {
              const name = [m.user.firstName, m.user.lastName]
                .filter(Boolean)
                .join(" ");
              return (
                <li
                  key={m.id}
                  className="flex items-start justify-between gap-3 py-3"
                >
                  <div>
                    <p className="text-sm font-medium">
                      {name || m.user.email}
                    </p>
                    {name ? (
                      <p className="text-xs text-[var(--ink-tertiary)]">
                        {m.user.email}
                      </p>
                    ) : null}
                  </div>
                  <span className="inline-flex items-center rounded-md bg-[var(--muted)] px-2 py-0.5 text-[11px] font-medium tracking-wide text-[var(--ink-secondary)] uppercase">
                    {m.role}
                  </span>
                </li>
              );
            })}
          </ul>
        )}
      </Surface>

      <Surface className="max-w-lg">
        <h2 className="text-sm font-semibold">Pending invites</h2>
        {invites.length === 0 ? (
          <p className="mt-2 text-sm text-[var(--ink-tertiary)]">
            No outstanding invites.
          </p>
        ) : (
          <ul className="mt-3 divide-y divide-[var(--border)]">
            {invites.map((invite) => (
              <li
                key={invite.id}
                className="flex items-start justify-between gap-3 py-3"
              >
                <div>
                  <p className="text-sm font-medium">{invite.email}</p>
                  <p className="text-xs text-[var(--ink-tertiary)]">
                    {invite.role} · expires{" "}
                    {invite.expiresAt.toISOString().slice(0, 10)}
                  </p>
                  <p className="mt-1 break-all text-[11px] text-[var(--ink-tertiary)]">
                    {inviteAcceptUrl(invite.token)}
                  </p>
                </div>
                <ActionForm
                  action={revokeInviteAction}
                  submitLabel="Revoke"
                  successMessage="Invite revoked"
                  resetOnSuccess={false}
                  className="flex items-center"
                >
                  <input type="hidden" name="inviteId" value={invite.id} />
                </ActionForm>
              </li>
            ))}
          </ul>
        )}
      </Surface>

      <Surface className="max-w-lg">
        <h2 className="text-sm font-semibold">Invite member</h2>
        <p className="mt-1 text-xs text-[var(--ink-tertiary)]">
          They sign in with Clerk using this email, then join this business
          only. You cannot invite an owner.
        </p>
        {assignable.length === 0 ? (
          <p className="mt-3 text-sm text-[var(--ink-secondary)]">
            Your role cannot invite other members.
          </p>
        ) : (
          <ActionForm
            action={inviteTeamMemberAction}
            submitLabel="Send invite"
            successMessage="Invite created"
            className="mt-4 flex flex-col gap-3"
          >
            <div>
              <Label htmlFor="invite-email">Email</Label>
              <Input
                id="invite-email"
                name="email"
                type="email"
                required
                autoComplete="email"
              />
            </div>
            <div>
              <Label htmlFor="invite-role">Role</Label>
              <Select
                id="invite-role"
                name="role"
                defaultValue={
                  assignable.includes("STAFF") ? "STAFF" : assignable[0]
                }
              >
                {assignable.map((role) => (
                  <option key={role} value={role}>
                    {role}
                  </option>
                ))}
              </Select>
            </div>
          </ActionForm>
        )}
      </Surface>
    </div>
  );
}
