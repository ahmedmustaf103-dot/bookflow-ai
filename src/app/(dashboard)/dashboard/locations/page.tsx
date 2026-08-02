import { ActionForm } from "@/components/forms/action-form";
import { EmptyState } from "@/components/ui/empty-state";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { PageHeader } from "@/components/ui/page-header";
import { Surface } from "@/components/ui/surface";
import { createLocationAction } from "@/server/actions/tenant";
import { requireOrgRole } from "@/server/tenant/context";

export default async function LocationsPage() {
  const ctx = await requireOrgRole("ADMIN");
  const locations = await ctx.db.location.findMany({
    orderBy: { createdAt: "asc" },
  });

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Locations"
        description="Physical or virtual sites. Each has its own timezone."
      />

      {locations.length === 0 ? (
        <EmptyState
          title="No locations yet"
          description="Add your first location below."
        />
      ) : (
        <Surface padding="none" className="overflow-hidden">
          <ul className="divide-y divide-[var(--border)]">
            {locations.map((loc) => (
              <li
                key={loc.id}
                className="flex items-center justify-between gap-4 px-4 py-3"
              >
                <div>
                  <p className="text-sm font-medium">{loc.name}</p>
                  <p className="text-xs text-[var(--ink-tertiary)]">
                    {loc.timezone}
                  </p>
                </div>
                <span className="text-xs tracking-wide text-[var(--ink-tertiary)] uppercase">
                  {loc.isActive ? "Active" : "Inactive"}
                </span>
              </li>
            ))}
          </ul>
        </Surface>
      )}

      <Surface className="max-w-md">
        <h2 className="text-sm font-semibold">Add location</h2>
        <ActionForm
          action={createLocationAction}
          submitLabel="Add location"
          className="mt-4 flex flex-col gap-3"
        >
          <div>
            <Label htmlFor="location-name">Name</Label>
            <Input
              id="location-name"
              name="name"
              required
              placeholder="Downtown"
            />
          </div>
          <div>
            <Label htmlFor="location-timezone">Timezone</Label>
            <Input
              id="location-timezone"
              name="timezone"
              defaultValue={ctx.organization.timezoneDefault}
              placeholder="America/New_York"
            />
          </div>
        </ActionForm>
      </Surface>
    </div>
  );
}
