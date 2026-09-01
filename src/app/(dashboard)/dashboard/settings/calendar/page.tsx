import { ButtonLink } from "@/components/ui/button";
import { PageHeader } from "@/components/ui/page-header";
import { GoogleCalendarCard } from "@/components/dashboard/google-calendar-card";
import { db } from "@/server/db";
import { isGoogleCalendarConfigured } from "@/server/integrations/google-calendar";
import { requireOrgRole } from "@/server/tenant/context";

export const dynamic = "force-dynamic";

export default async function GoogleCalendarSettingsPage({
  searchParams,
}: {
  searchParams: Promise<{ gcal?: string }>;
}) {
  const ctx = await requireOrgRole("STAFF");
  const { gcal } = await searchParams;
  const configured = isGoogleCalendarConfigured();
  const isAdmin =
    ctx.membership.role === "ADMIN" || ctx.membership.role === "OWNER";

  const [myConnection, teamRows] = await Promise.all([
    db.googleCalendarConnection.findUnique({
      where: {
        organizationId_userId: {
          organizationId: ctx.organization.id,
          userId: ctx.user.id,
        },
      },
      select: { accountEmail: true },
    }),
    isAdmin
      ? db.membership.findMany({
          where: { organizationId: ctx.organization.id, status: "ACTIVE" },
          include: {
            user: {
              select: {
                id: true,
                email: true,
                firstName: true,
                lastName: true,
                googleCalendarConnections: {
                  where: { organizationId: ctx.organization.id },
                  select: { accountEmail: true },
                },
              },
            },
          },
          orderBy: { createdAt: "asc" },
        })
      : Promise.resolve([]),
  ]);

  const teamConnections = teamRows.map((row) => {
    const name = [row.user.firstName, row.user.lastName]
      .filter(Boolean)
      .join(" ");
    return {
      memberName: name || row.user.email,
      memberEmail: row.user.email,
      accountEmail: row.user.googleCalendarConnections[0]?.accountEmail ?? null,
    };
  });

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Google Calendar"
        description="Each barber connects their own Google account. Appointments with that person sync to their calendar."
        actions={
          isAdmin ? (
            <ButtonLink href="/dashboard/settings" size="sm" variant="secondary">
              Back to settings
            </ButtonLink>
          ) : undefined
        }
      />
      <GoogleCalendarCard
        configured={configured}
        status={gcal}
        myConnection={myConnection}
        teamConnections={isAdmin ? teamConnections : undefined}
      />
    </div>
  );
}
