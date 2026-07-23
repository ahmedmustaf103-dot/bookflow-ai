import { ActionForm } from "@/components/forms/action-form";
import { createLocationAction } from "@/server/actions/tenant";
import { db } from "@/server/db";
import { requireOrgOrRedirect } from "@/server/tenant/context";

export default async function LocationsPage() {
  const ctx = await requireOrgOrRedirect();
  const locations = await db.location.findMany({
    where: { organizationId: ctx.organization.id },
    orderBy: { createdAt: "asc" },
  });

  return (
    <div className="flex flex-col gap-8">
      <div>
        <h1 className="font-display text-3xl tracking-tight">Locations</h1>
        <p className="mt-2 text-[var(--color-ink)]/70">
          Physical or virtual sites. Each has its own timezone.
        </p>
      </div>

      <ul className="divide-y divide-[var(--color-border)] rounded-lg border border-[var(--color-border)]">
        {locations.map((loc) => (
          <li
            key={loc.id}
            className="flex items-center justify-between gap-4 px-4 py-3"
          >
            <div>
              <p className="font-medium">{loc.name}</p>
              <p className="text-sm text-[var(--color-ink)]/60">
                {loc.timezone}
              </p>
            </div>
            <span className="text-xs tracking-wide text-[var(--color-ink)]/50 uppercase">
              {loc.isActive ? "Active" : "Inactive"}
            </span>
          </li>
        ))}
        {locations.length === 0 ? (
          <li className="px-4 py-6 text-sm text-[var(--color-ink)]/60">
            No locations yet.
          </li>
        ) : null}
      </ul>

      <section className="max-w-md">
        <h2 className="text-lg font-semibold">Add location</h2>
        <ActionForm
          action={createLocationAction}
          submitLabel="Add location"
          className="mt-4 flex flex-col gap-3"
        >
          <input
            name="name"
            required
            placeholder="Downtown"
            className="rounded-md border border-[var(--color-border)] bg-white px-3 py-2 text-sm"
          />
          <input
            name="timezone"
            defaultValue={ctx.organization.timezoneDefault}
            placeholder="America/New_York"
            className="rounded-md border border-[var(--color-border)] bg-white px-3 py-2 text-sm"
          />
        </ActionForm>
      </section>
    </div>
  );
}
