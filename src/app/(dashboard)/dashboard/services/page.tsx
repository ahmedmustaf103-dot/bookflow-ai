import { ActionForm } from "@/components/forms/action-form";
import { createServiceAction } from "@/server/actions/tenant";
import { db } from "@/server/db";
import { requireOrgRole } from "@/server/tenant/context";

function formatMoney(cents: number, currency: string) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency,
  }).format(cents / 100);
}

export default async function ServicesPage() {
  const ctx = await requireOrgRole("ADMIN");

  const [services, resources] = await Promise.all([
    db.service.findMany({
      where: { organizationId: ctx.organization.id },
      include: { resources: { include: { resource: true } } },
      orderBy: { createdAt: "asc" },
    }),
    db.resource.findMany({
      where: { organizationId: ctx.organization.id, isActive: true },
      orderBy: { name: "asc" },
    }),
  ]);

  return (
    <div className="flex flex-col gap-8">
      <div>
        <h1 className="font-display text-3xl tracking-tight">Services</h1>
        <p className="mt-2 text-[var(--color-ink)]/70">
          Sellable offerings with duration, price, and assigned resources.
        </p>
      </div>

      <ul className="divide-y divide-[var(--color-border)] rounded-lg border border-[var(--color-border)]">
        {services.map((s) => (
          <li key={s.id} className="px-4 py-3">
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="font-medium">{s.name}</p>
                <p className="text-sm text-[var(--color-ink)]/60">
                  {s.durationMin} min
                  {s.bufferAfter ? ` · +${s.bufferAfter}m buffer` : ""} ·{" "}
                  {formatMoney(s.priceCents, s.currency)}
                </p>
                <p className="mt-1 text-xs text-[var(--color-ink)]/50">
                  {s.resources.length > 0
                    ? s.resources.map((sr) => sr.resource.name).join(", ")
                    : "No resources assigned"}
                </p>
              </div>
            </div>
          </li>
        ))}
        {services.length === 0 ? (
          <li className="px-4 py-6 text-sm text-[var(--color-ink)]/60">
            No services yet — add your first cut or treatment.
          </li>
        ) : null}
      </ul>

      <section className="max-w-md">
        <h2 className="text-lg font-semibold">Add service</h2>
        <ActionForm
          action={createServiceAction}
          submitLabel="Add service"
          className="mt-4 flex flex-col gap-3"
        >
          <input
            name="name"
            required
            placeholder="Haircut"
            className="rounded-md border border-[var(--color-border)] bg-white px-3 py-2 text-sm"
          />
          <div className="grid grid-cols-3 gap-2">
            <label className="flex flex-col gap-1 text-xs">
              Duration (min)
              <input
                name="durationMin"
                type="number"
                min={5}
                defaultValue={30}
                className="rounded-md border border-[var(--color-border)] bg-white px-3 py-2 text-sm"
              />
            </label>
            <label className="flex flex-col gap-1 text-xs">
              Price
              <input
                name="price"
                type="number"
                min={0}
                step="0.01"
                defaultValue={35}
                className="rounded-md border border-[var(--color-border)] bg-white px-3 py-2 text-sm"
              />
            </label>
            <label className="flex flex-col gap-1 text-xs">
              Buffer after
              <input
                name="bufferAfter"
                type="number"
                min={0}
                defaultValue={5}
                className="rounded-md border border-[var(--color-border)] bg-white px-3 py-2 text-sm"
              />
            </label>
          </div>
          {resources.length > 0 ? (
            <fieldset className="flex flex-col gap-2 text-sm">
              <legend className="mb-1 text-xs font-medium">
                Who can deliver this?
              </legend>
              {resources.map((r) => (
                <label key={r.id} className="flex items-center gap-2">
                  <input type="checkbox" name="resourceIds" value={r.id} />
                  {r.name}
                </label>
              ))}
            </fieldset>
          ) : null}
        </ActionForm>
      </section>
    </div>
  );
}
