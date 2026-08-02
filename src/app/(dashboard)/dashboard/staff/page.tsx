import { ActionForm } from "@/components/forms/action-form";
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
      orderBy: { createdAt: "asc" },
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
        description="Bookable capacity units — chairs, rooms, or people."
      />

      {resources.length === 0 ? (
        <EmptyState
          title="No staff or resources yet"
          description="Add your first bookable resource below."
        />
      ) : (
        <Surface padding="none" className="overflow-hidden">
          <ul className="divide-y divide-[var(--border)]">
            {resources.map((r) => (
              <li
                key={r.id}
                className="flex items-center justify-between gap-4 px-4 py-3"
              >
                <div>
                  <p className="text-sm font-medium">{r.name}</p>
                  <p className="text-xs text-[var(--ink-tertiary)]">
                    {r.type} · {r.location.name}
                  </p>
                </div>
              </li>
            ))}
          </ul>
        </Surface>
      )}

      <Surface className="max-w-md">
        <h2 className="text-sm font-semibold">Add resource</h2>
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
