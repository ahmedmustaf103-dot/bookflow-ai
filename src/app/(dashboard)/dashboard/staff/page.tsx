import { ActionForm } from "@/components/forms/action-form";
import { createResourceAction } from "@/server/actions/tenant";
import { db } from "@/server/db";
import { requireOrgRole } from "@/server/tenant/context";

export default async function StaffPage() {
  const ctx = await requireOrgRole("ADMIN");

  const [resources, locations] = await Promise.all([
    db.resource.findMany({
      where: { organizationId: ctx.organization.id },
      include: { location: true },
      orderBy: { createdAt: "asc" },
    }),
    db.location.findMany({
      where: { organizationId: ctx.organization.id, isActive: true },
      orderBy: { name: "asc" },
    }),
  ]);

  return (
    <div className="flex flex-col gap-8">
      <div>
        <h1 className="font-display text-3xl tracking-tight">
          Staff & resources
        </h1>
        <p className="mt-2 text-[var(--color-ink)]/70">
          Bookable capacity units — chairs, rooms, or people.
        </p>
      </div>

      <ul className="divide-y divide-[var(--color-border)] rounded-lg border border-[var(--color-border)]">
        {resources.map((r) => (
          <li
            key={r.id}
            className="flex items-center justify-between gap-4 px-4 py-3"
          >
            <div>
              <p className="font-medium">{r.name}</p>
              <p className="text-sm text-[var(--color-ink)]/60">
                {r.type} · {r.location.name}
              </p>
            </div>
          </li>
        ))}
      </ul>

      <section className="max-w-md">
        <h2 className="text-lg font-semibold">Add resource</h2>
        <ActionForm
          action={createResourceAction}
          submitLabel="Add resource"
          className="mt-4 flex flex-col gap-3"
        >
          <input
            name="name"
            required
            placeholder="Chair 2"
            className="rounded-md border border-[var(--color-border)] bg-white px-3 py-2 text-sm"
          />
          <select
            name="locationId"
            required
            className="rounded-md border border-[var(--color-border)] bg-white px-3 py-2 text-sm"
            defaultValue={locations[0]?.id}
          >
            {locations.map((l) => (
              <option key={l.id} value={l.id}>
                {l.name}
              </option>
            ))}
          </select>
          <select
            name="type"
            defaultValue="STAFF"
            className="rounded-md border border-[var(--color-border)] bg-white px-3 py-2 text-sm"
          >
            <option value="STAFF">Staff</option>
            <option value="ROOM">Room</option>
            <option value="EQUIPMENT">Equipment</option>
            <option value="OTHER">Other</option>
          </select>
        </ActionForm>
      </section>
    </div>
  );
}
