import { ActionForm } from "@/components/forms/action-form";
import { ConfirmActiveCheckbox } from "@/components/dashboard/confirm-active-checkbox";
import { ButtonLink } from "@/components/ui/button";
import { Input, Select } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { PageHeader } from "@/components/ui/page-header";
import { Surface } from "@/components/ui/surface";
import { updateResourceAction } from "@/server/actions/tenant";
import { requireOrgRole } from "@/server/tenant/context";
import { notFound } from "next/navigation";

export default async function EditStaffPage({
  params,
}: {
  params: Promise<{ resourceId: string }>;
}) {
  const ctx = await requireOrgRole("ADMIN");
  const { resourceId } = await params;

  const [resource, services, members] = await Promise.all([
    ctx.db.resource.findFirst({
      where: { id: resourceId },
      include: {
        location: true,
        services: true,
        _count: { select: { bookings: true } },
      },
    }),
    ctx.db.service.findMany({
      orderBy: { name: "asc" },
    }),
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
  ]);

  if (!resource) notFound();

  const assigned = new Set(resource.services.map((s) => s.serviceId));

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title={`Edit ${resource.name}`}
        description={`${resource.type} at ${resource.location.name}. Existing appointments stay assigned to this person.`}
        actions={
          <ButtonLink href="/dashboard/staff" size="sm" variant="secondary">
            Back to staff
          </ButtonLink>
        }
      />

      <Surface className="max-w-md">
        <div className="mb-4 flex items-center gap-2">
          <span
            className={`inline-flex items-center rounded-md px-2 py-0.5 text-[11px] font-medium tracking-wide uppercase ${
              resource.isActive
                ? "bg-[var(--accent-soft)] text-[var(--accent)]"
                : "bg-[var(--muted)] text-[var(--ink-secondary)]"
            }`}
          >
            {resource.isActive ? "Active" : "Inactive"}
          </span>
          <span className="text-xs text-[var(--ink-tertiary)]">
            {resource._count.bookings} appointment
            {resource._count.bookings === 1 ? "" : "s"} on file
          </span>
        </div>
        <ActionForm
          action={updateResourceAction}
          submitLabel="Save staff"
          resetOnSuccess={false}
          successMessage="Staff updated"
          className="flex flex-col gap-3"
        >
          <input type="hidden" name="resourceId" value={resource.id} />
          <div>
            <Label htmlFor="edit-staff-name">Name</Label>
            <Input
              id="edit-staff-name"
              name="name"
              required
              defaultValue={resource.name}
            />
          </div>
          <div>
            <Label htmlFor="edit-staff-login">Dashboard login</Label>
            <Select
              id="edit-staff-login"
              name="userId"
              defaultValue={resource.userId ?? ""}
            >
              <option value="">Not linked — booking profile only</option>
              {members.map((m) => {
                const name = [m.user.firstName, m.user.lastName]
                  .filter(Boolean)
                  .join(" ");
                return (
                  <option key={m.user.id} value={m.user.id}>
                    {name ? `${name} (${m.user.email})` : m.user.email} ·{" "}
                    {m.role}
                  </option>
                );
              })}
            </Select>
            <p className="mt-1 text-xs text-[var(--ink-tertiary)]">
              Link a team login so this person sees their own appointments and
              gets booking emails. Solo owners are linked automatically.
            </p>
          </div>
          {services.length > 0 ? (
            <fieldset className="flex flex-col gap-2">
              <legend className="mb-1 text-xs font-medium text-[var(--ink-secondary)]">
                Services they provide
              </legend>
              {services.map((s) => (
                <label
                  key={s.id}
                  className="flex items-center gap-2 text-sm text-[var(--ink)]"
                >
                  <input
                    type="checkbox"
                    name="serviceIds"
                    value={s.id}
                    defaultChecked={assigned.has(s.id)}
                  />
                  {s.name}
                  {!s.isActive ? (
                    <span className="text-xs text-[var(--ink-tertiary)]">
                      (inactive)
                    </span>
                  ) : null}
                </label>
              ))}
            </fieldset>
          ) : null}
          <ConfirmActiveCheckbox
            name="isActive"
            defaultChecked={resource.isActive}
            label="Active for new bookings"
            deactivateMessage="Stop new bookings for this staff member? Existing appointments stay on the calendar."
          />
        </ActionForm>
        <p className="mt-3 text-xs text-[var(--ink-tertiary)]">
          Uncheck Active to remove them from booking, Hours filters, and new
          appointments. Existing appointments stay. To take away their login,
          use Settings → Team → Remove.
        </p>
      </Surface>
    </div>
  );
}
