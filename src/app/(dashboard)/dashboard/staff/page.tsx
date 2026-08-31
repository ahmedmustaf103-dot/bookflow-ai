import { ActionForm } from "@/components/forms/action-form";
import { ButtonLink } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { Input, Select } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { PageHeader } from "@/components/ui/page-header";
import { Surface } from "@/components/ui/surface";
import { createResourceAction } from "@/server/actions/tenant";
import { requireOrgRole } from "@/server/tenant/context";

export default async function StaffPage() {
  const ctx = await requireOrgRole("ADMIN");

  const [resources, locations] = await Promise.all([
    ctx.db.resource.findMany({
      include: { location: true },
      orderBy: [{ isActive: "desc" }, { createdAt: "asc" }],
    }),
    ctx.db.location.findMany({
      where: { isActive: true },
      orderBy: { name: "asc" },
    }),
  ]);

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Staff & resources"
        description="Bookable people and chairs. New staff are added to your services and hours automatically. Uncheck Active on Edit to hide them from booking — past appointments stay."
      />

      {resources.length === 0 ? (
        <EmptyState
          title="No staff or resources yet"
          description="Add the people or chairs customers can book. Inactive staff stay on this list and keep existing appointments, but they will not appear on the public page."
          action={
            <ButtonLink href="#add-resource" variant="primary" size="sm">
              Add resource
            </ButtonLink>
          }
        />
      ) : (
        <Surface padding="none" className="overflow-hidden">
          <ul className="divide-y divide-[var(--border)]">
            {resources.map((r) => (
              <li
                key={r.id}
                className={`flex flex-wrap items-center justify-between gap-3 px-4 py-3 ${
                  r.isActive ? "" : "opacity-70"
                }`}
              >
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="text-sm font-medium">{r.name}</p>
                    <span
                      className={`inline-flex items-center rounded-md px-2 py-0.5 text-[11px] font-medium tracking-wide uppercase ${
                        r.isActive
                          ? "bg-[var(--accent-soft)] text-[var(--accent)]"
                          : "bg-[var(--muted)] text-[var(--ink-secondary)]"
                      }`}
                    >
                      {r.isActive ? "Active" : "Inactive"}
                    </span>
                  </div>
                  <p className="text-xs text-[var(--ink-tertiary)]">
                    {r.type} · {r.location.name}
                  </p>
                </div>
                <ButtonLink
                  href={`/dashboard/staff/${r.id}`}
                  size="sm"
                  variant="secondary"
                  className="min-h-11 sm:h-8"
                >
                  Edit
                </ButtonLink>
              </li>
            ))}
          </ul>
        </Surface>
      )}

      <Surface id="add-resource" className="max-w-md scroll-mt-6">
        <h2 className="text-sm font-semibold">Add staff</h2>
        <p className="mt-1 text-xs text-[var(--ink-tertiary)]">
          They appear on booking, Hours, Calendar, and Analytics right away.
          Link a dashboard login later on Edit, or invite them from Team.
        </p>
        <ActionForm
          action={createResourceAction}
          submitLabel="Add resource"
          className="mt-4 flex flex-col gap-3"
        >
          <div>
            <Label htmlFor="resource-name">Name</Label>
            <Input
              id="resource-name"
              name="name"
              required
              placeholder="Chair 2"
            />
          </div>
          <div>
            <Label htmlFor="resource-location">Location</Label>
            <Select
              id="resource-location"
              name="locationId"
              required
              defaultValue={locations[0]?.id}
            >
              {locations.map((l) => (
                <option key={l.id} value={l.id}>
                  {l.name}
                </option>
              ))}
            </Select>
          </div>
          <div>
            <Label htmlFor="resource-type">Type</Label>
            <Select id="resource-type" name="type" defaultValue="STAFF">
              <option value="STAFF">Staff</option>
              <option value="ROOM">Room</option>
              <option value="EQUIPMENT">Equipment</option>
              <option value="OTHER">Other</option>
            </Select>
          </div>
        </ActionForm>
      </Surface>
    </div>
  );
}
