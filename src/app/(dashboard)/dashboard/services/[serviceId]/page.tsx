import { ActionForm } from "@/components/forms/action-form";
import { ConfirmActiveCheckbox } from "@/components/dashboard/confirm-active-checkbox";
import { ButtonLink } from "@/components/ui/button";
import { Input, Textarea } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { PageHeader } from "@/components/ui/page-header";
import { Surface } from "@/components/ui/surface";
import { formatMoney } from "@/lib/client-tags";
import { updateServiceAction } from "@/server/actions/tenant";
import { requireOrgRole } from "@/server/tenant/context";
import { notFound } from "next/navigation";

export default async function EditServicePage({
  params,
}: {
  params: Promise<{ serviceId: string }>;
}) {
  const ctx = await requireOrgRole("ADMIN");
  const { serviceId } = await params;

  const [service, resources] = await Promise.all([
    ctx.db.service.findFirst({
      where: { id: serviceId },
      include: { resources: true, _count: { select: { bookings: true } } },
    }),
    ctx.db.resource.findMany({
      orderBy: { name: "asc" },
    }),
  ]);

  if (!service) notFound();

  const assigned = new Set(service.resources.map((r) => r.resourceId));

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title={`Edit ${service.name}`}
        description="Changes apply to new bookings. Past appointments keep their original details."
        actions={
          <ButtonLink href="/dashboard/services" size="sm" variant="secondary">
            Back to services
          </ButtonLink>
        }
      />

      <Surface className="max-w-md">
        <div className="mb-4 flex items-center gap-2">
          <span
            className={`inline-flex items-center rounded-md px-2 py-0.5 text-[11px] font-medium tracking-wide uppercase ${
              service.isActive
                ? "bg-[var(--accent-soft)] text-[var(--accent)]"
                : "bg-[var(--muted)] text-[var(--ink-secondary)]"
            }`}
          >
            {service.isActive ? "Active" : "Inactive"}
          </span>
          <span className="text-xs text-[var(--ink-tertiary)]">
            {service._count.bookings} appointment
            {service._count.bookings === 1 ? "" : "s"} on file
          </span>
        </div>
        <ActionForm
          action={updateServiceAction}
          submitLabel="Save service"
          resetOnSuccess={false}
          successMessage="Service updated"
          className="flex flex-col gap-3"
        >
          <input type="hidden" name="serviceId" value={service.id} />
          <div>
            <Label htmlFor="edit-service-name">Name</Label>
            <Input
              id="edit-service-name"
              name="name"
              required
              defaultValue={service.name}
            />
          </div>
          <div>
            <Label htmlFor="edit-service-description">Description</Label>
            <Textarea
              id="edit-service-description"
              name="description"
              defaultValue={service.description ?? ""}
              rows={3}
            />
          </div>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
            <div>
              <Label htmlFor="edit-service-duration">Duration (min)</Label>
              <Input
                id="edit-service-duration"
                name="durationMin"
                type="number"
                min={5}
                defaultValue={service.durationMin}
              />
            </div>
            <div>
              <Label htmlFor="edit-service-price">
                Price ({service.currency})
              </Label>
              <Input
                id="edit-service-price"
                name="price"
                type="number"
                min={0}
                step="0.01"
                defaultValue={(service.priceCents / 100).toFixed(2)}
              />
            </div>
            <div>
              <Label htmlFor="edit-service-buffer-before">Buffer before</Label>
              <Input
                id="edit-service-buffer-before"
                name="bufferBefore"
                type="number"
                min={0}
                defaultValue={service.bufferBefore}
              />
            </div>
            <div>
              <Label htmlFor="edit-service-buffer-after">Buffer after</Label>
              <Input
                id="edit-service-buffer-after"
                name="bufferAfter"
                type="number"
                min={0}
                defaultValue={service.bufferAfter}
              />
            </div>
          </div>
          {resources.length > 0 ? (
            <fieldset className="flex flex-col gap-2">
              <legend className="mb-1 text-xs font-medium text-[var(--ink-secondary)]">
                Who can deliver this?
              </legend>
              {resources.map((r) => (
                <label
                  key={r.id}
                  className="flex items-center gap-2 text-sm text-[var(--ink)]"
                >
                  <input
                    type="checkbox"
                    name="resourceIds"
                    value={r.id}
                    defaultChecked={assigned.has(r.id)}
                  />
                  {r.name}
                  {!r.isActive ? (
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
            defaultChecked={service.isActive}
            label="Active on the public booking page"
            deactivateMessage="Hide this service from the public booking page? Existing appointments stay on the calendar."
          />
        </ActionForm>
        <p className="mt-3 text-xs text-[var(--ink-tertiary)]">
          Current list price:{" "}
          {formatMoney(service.priceCents, service.currency)}. Deactivating does
          not delete this service or its history.
        </p>
      </Surface>
    </div>
  );
}
