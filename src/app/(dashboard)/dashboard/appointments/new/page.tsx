import { formatInTimeZone } from "date-fns-tz";

import { NewAppointmentForm } from "./new-appointment-form";
import { ButtonLink } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { PageHeader } from "@/components/ui/page-header";
import { Surface } from "@/components/ui/surface";
import { requireOrgRole } from "@/server/tenant/context";

export default async function NewAppointmentPage() {
  const ctx = await requireOrgRole("STAFF");
  const tz = ctx.organization.timezoneDefault;
  const defaultDay = formatInTimeZone(new Date(), tz, "yyyy-MM-dd");

  const [clients, services, staff] = await Promise.all([
    ctx.db.client.findMany({
      select: { id: true, name: true, email: true, phone: true },
      orderBy: { name: "asc" },
      take: 200,
    }),
    ctx.db.service.findMany({
      where: { isActive: true },
      include: { resources: { select: { resourceId: true } } },
      orderBy: { name: "asc" },
    }),
    ctx.db.resource.findMany({
      where: { isActive: true },
      select: { id: true, name: true },
      orderBy: { name: "asc" },
    }),
  ]);

  const bookableServices = services.filter((s) =>
    s.resources.some((r) => staff.some((member) => member.id === r.resourceId)),
  );

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="New appointment"
        description="Walk-in or phone booking. Uses the same availability engine as the public page."
        actions={
          <ButtonLink
            href="/dashboard/appointments"
            size="sm"
            variant="secondary"
          >
            Back to calendar
          </ButtonLink>
        }
      />

      {bookableServices.length === 0 || staff.length === 0 ? (
        <EmptyState
          title="Nothing to book yet"
          description="Add an active service linked to active staff first."
          action={
            <ButtonLink href="/dashboard/services" size="sm" variant="primary">
              Services
            </ButtonLink>
          }
        />
      ) : (
        <Surface>
          <NewAppointmentForm
            clients={clients}
            services={bookableServices.map((s) => ({
              id: s.id,
              name: s.name,
              durationMin: s.durationMin,
              resourceIds: s.resources.map((r) => r.resourceId),
            }))}
            staff={staff}
            defaultDay={defaultDay}
          />
        </Surface>
      )}
    </div>
  );
}
