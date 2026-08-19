import { ActionForm } from "@/components/forms/action-form";
import { ButtonLink } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { PageHeader } from "@/components/ui/page-header";
import { Surface } from "@/components/ui/surface";
import { formatMoney } from "@/lib/client-tags";
import { createServiceAction } from "@/server/actions/tenant";
import { requireOrgRole } from "@/server/tenant/context";

export default async function ServicesPage() {
  const ctx = await requireOrgRole("ADMIN");

  const [services, resources] = await Promise.all([
    ctx.db.service.findMany({
      include: { resources: { include: { resource: true } } },
      orderBy: [{ isActive: "desc" }, { createdAt: "asc" }],
    }),
    ctx.db.resource.findMany({
      orderBy: { name: "asc" },
    }),
  ]);

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Services"
        description="Sellable offerings with duration, price, and assigned resources."
      />

      {services.length === 0 ? (
        <EmptyState
          title="No services yet"
          description="Add your first cut or treatment so customers can book."
          action={
            <ButtonLink href="#add-service" variant="primary" size="sm">
              Add service
            </ButtonLink>
          }
        />
      ) : (
        <Surface padding="none" className="overflow-hidden">
          <ul className="divide-y divide-[var(--border)]">
            {services.map((s) => (
              <li key={s.id} className="px-4 py-3">
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="text-sm font-medium">{s.name}</p>
                      <span
                        className={`inline-flex items-center rounded-md px-2 py-0.5 text-[11px] font-medium tracking-wide uppercase ${
                          s.isActive
                            ? "bg-[var(--accent-soft)] text-[var(--accent)]"
                            : "bg-[var(--muted)] text-[var(--ink-secondary)]"
                        }`}
                      >
                        {s.isActive ? "Active" : "Inactive"}
                      </span>
                    </div>
                    <p className="text-xs text-[var(--ink-tertiary)]">
                      {s.durationMin} min
                      {s.bufferAfter
                        ? ` · +${s.bufferAfter}m buffer`
                        : ""} · {formatMoney(s.priceCents, s.currency)}
                    </p>
                    <p className="mt-1 text-xs text-[var(--ink-tertiary)]">
                      {s.resources.length > 0
                        ? s.resources.map((sr) => sr.resource.name).join(", ")
                        : "No resources assigned"}
                    </p>
                  </div>
                  <ButtonLink
                    href={`/dashboard/services/${s.id}`}
                    size="sm"
                    variant="secondary"
                  >
                    Edit
                  </ButtonLink>
                </div>
              </li>
            ))}
          </ul>
        </Surface>
      )}

      <Surface id="add-service" className="max-w-md scroll-mt-6">
        <h2 className="text-sm font-semibold">Add service</h2>
        <ActionForm
          action={createServiceAction}
          submitLabel="Add service"
          className="mt-4 flex flex-col gap-3"
        >
          <div>
            <Label htmlFor="service-name">Name</Label>
            <Input
              id="service-name"
              name="name"
              required
              placeholder="Haircut"
            />
          </div>
          <div className="grid grid-cols-3 gap-2">
            <div>
              <Label htmlFor="service-duration">Duration (min)</Label>
              <Input
                id="service-duration"
                name="durationMin"
                type="number"
                min={5}
                defaultValue={30}
              />
            </div>
            <div>
              <Label htmlFor="service-price">Price</Label>
              <Input
                id="service-price"
                name="price"
                type="number"
                min={0}
                step="0.01"
                defaultValue={35}
              />
            </div>
            <div>
              <Label htmlFor="service-buffer">Buffer after</Label>
              <Input
                id="service-buffer"
                name="bufferAfter"
                type="number"
                min={0}
                defaultValue={5}
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
                  <input type="checkbox" name="resourceIds" value={r.id} />
                  {r.name}
                </label>
              ))}
            </fieldset>
          ) : null}
        </ActionForm>
      </Surface>
    </div>
  );
}
