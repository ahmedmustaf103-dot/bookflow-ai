import { ActionForm } from "@/components/forms/action-form";
import { DemoUnavailable } from "@/components/dashboard/demo-unavailable";
import { ButtonLink } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { Input, Select } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { PageHeader } from "@/components/ui/page-header";
import { Surface } from "@/components/ui/surface";
import {
  inviteTeamMemberAction,
  provisionChairForMemberAction,
  removeTeamMemberAction,
  revokeInviteAction,
} from "@/server/actions/team";
import {
  canAssignInviteRole,
  canRemoveTeamMember,
  INVITEABLE_ROLES,
} from "@/server/team/roles";
import { inviteAcceptUrl } from "@/server/team/team";
import { requireOrgRole } from "@/server/tenant/context";
import { onboardingCopy } from "@/lib/onboarding/copy";

export default async function TeamSettingsPage() {
  const ctx = await requireOrgRole("ADMIN");
  const readOnly = ctx.isDemo;
  const actorRole = ctx.membership.role;
  const assignable = INVITEABLE_ROLES.filter((role) =>
    canAssignInviteRole(actorRole, role),
  );

  const [members, invites, resources] = await Promise.all([
    ctx.db.membership.findMany({
      where: { status: "ACTIVE" },
      include: {
        user: {
          select: {
            id: true,
            email: true,
            firstName: true,
            lastName: true,
          },
        },
      },
      orderBy: { createdAt: "asc" },
    }),
    ctx.db.organizationInvite.findMany({
      where: { status: "PENDING", expiresAt: { gt: new Date() } },
      include: { resource: { select: { name: true } } },
      orderBy: { createdAt: "desc" },
    }),
    ctx.db.resource.findMany({
      where: { isActive: true },
      select: { id: true, name: true, userId: true },
      orderBy: { name: "asc" },
    }),
  ]);

  const chairsByUserId = new Map<string, string[]>();
  for (const resource of resources) {
    if (!resource.userId) continue;
    const names = chairsByUserId.get(resource.userId) ?? [];
    names.push(resource.name);
    chairsByUserId.set(resource.userId, names);
  }

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Team"
        description="Optional. If you work alone, skip this. Invite people when you hire — they join this same business, they do not create a new one."
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
              const chairs = chairsByUserId.get(m.user.id) ?? [];
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
                    <p className="mt-0.5 text-xs text-[var(--ink-tertiary)]">
                      {chairs.length > 0
                        ? `On booking as ${chairs.join(", ")}`
                        : m.role === "OWNER"
                          ? "Owner login — add them as staff if they take bookings"
                          : "Not on the booking page yet"}
                    </p>
                  </div>
                  <div className="flex shrink-0 flex-col items-end gap-2">
                    <span className="inline-flex items-center rounded-md bg-[var(--muted)] px-2 py-0.5 text-[11px] font-medium tracking-wide text-[var(--ink-secondary)] uppercase">
                      {m.role}
                    </span>
                    {chairs.length === 0 && m.role !== "VIEWER" && !readOnly ? (
                      <ActionForm
                        action={provisionChairForMemberAction}
                        submitLabel="Add to booking"
                        submitVariant="secondary"
                        submitSize="sm"
                        successMessage="Added to booking"
                        resetOnSuccess={false}
                        className="flex items-center"
                      >
                        <input type="hidden" name="membershipId" value={m.id} />
                      </ActionForm>
                    ) : null}
                    {!readOnly &&
                    canRemoveTeamMember(
                      actorRole,
                      m.role,
                      ctx.user.id,
                      m.user.id,
                    ) ? (
                      <ActionForm
                        action={removeTeamMemberAction}
                        submitLabel="Remove"
                        submitVariant="danger"
                        submitSize="sm"
                        successMessage="Removed from team"
                        resetOnSuccess={false}
                        confirmMessage="Remove this person from the team? They lose dashboard access. Their staff profile and past appointments stay unless you hide them on Staff."
                        className="flex items-center"
                      >
                        <input type="hidden" name="membershipId" value={m.id} />
                      </ActionForm>
                    ) : null}
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </Surface>

      <Surface className="max-w-lg">
        <h2 className="text-sm font-semibold">Pending invites</h2>
        <p className="mt-1 text-xs text-[var(--ink-tertiary)]">
          If the email does not arrive, copy the link below and send it
          yourself.
        </p>
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
                    {invite.resource
                      ? ` · books as ${invite.resource.name}`
                      : ""}
                  </p>
                  <p className="mt-1 text-[11px] break-all text-[var(--ink-tertiary)]">
                    {inviteAcceptUrl(invite.token)}
                  </p>
                </div>
                {!readOnly ? (
                  <ActionForm
                    action={revokeInviteAction}
                    submitLabel="Revoke"
                    successMessage="Invite revoked"
                    resetOnSuccess={false}
                    className="flex items-center"
                  >
                    <input type="hidden" name="inviteId" value={invite.id} />
                  </ActionForm>
                ) : null}
              </li>
            ))}
          </ul>
        )}
      </Surface>

      {readOnly ? (
        <DemoUnavailable title={onboardingCopy.tryDemo.unavailableTeam} />
      ) : (
        <Surface className="max-w-lg">
          <h2 className="text-sm font-semibold">Invite member</h2>
          <p className="mt-1 text-xs text-[var(--ink-tertiary)]">
          Staff and admin invites create a bookable person (hours + your
          services) so they show on booking, Staff, Hours, Calendar, and
          insights. Pick an existing staff member only if they should share that
          calendar.
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
            <div>
              <Label htmlFor="invite-chair">Staff member</Label>
              <Select id="invite-chair" name="resourceId" defaultValue="">
                <option value="">Create a new staff member for them</option>
                {resources.map((resource) => (
                  <option key={resource.id} value={resource.id}>
                    {resource.name}
                    {resource.userId ? " (already linked)" : ""}
                  </option>
                ))}
              </Select>
            </div>
          </ActionForm>
        )}
        </Surface>
      )}
    </div>
  );
}
