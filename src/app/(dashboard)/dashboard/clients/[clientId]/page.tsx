import Link from "next/link";
import { notFound } from "next/navigation";
import { formatInTimeZone } from "date-fns-tz";

import { ActionForm } from "@/components/forms/action-form";
import { EmptyState } from "@/components/ui/empty-state";
import { Input, Textarea } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { PageHeader } from "@/components/ui/page-header";
import { StatusPill } from "@/components/ui/status-pill";
import { Surface } from "@/components/ui/surface";
import { updateClientAction } from "@/server/actions/ops";
import { requireOrgRole } from "@/server/tenant/context";

export default async function ClientDetailPage({
  params,
}: {
  params: Promise<{ clientId: string }>;
}) {
  const ctx = await requireOrgRole("STAFF");
  const { clientId } = await params;

  const client = await ctx.db.client.findFirst({
    where: { id: clientId },
    include: {
      bookings: {
        include: {
          service: true,
          resource: true,
          location: true,
        },
        orderBy: { startAt: "desc" },
        take: 50,
      },
    },
  });

  if (!client) notFound();

  const completed = client.bookings.filter((b) => b.status === "COMPLETED");
  const lifetimeValueCents = completed.reduce(
    (sum, b) => sum + b.service.priceCents,
    0,
  );
  const noShows = client.bookings.filter((b) => b.status === "NO_SHOW").length;

  return (
    <div className="flex flex-col gap-6">
      <Link
        href="/dashboard/clients"
        className="text-sm text-[var(--ink-tertiary)] hover:text-[var(--ink)]"
      >
        ← Clients
      </Link>

      <PageHeader
        title={client.name}
        description={`Lifetime value (completed): ${new Intl.NumberFormat("en-US", {
          style: "currency",
          currency: "USD",
        }).format(lifetimeValueCents / 100)} · ${noShows} no-show${noShows === 1 ? "" : "s"}`}
      />

      <Surface className="max-w-lg">
        <h2 className="text-sm font-semibold">Profile</h2>
        <ActionForm
          action={updateClientAction}
          submitLabel="Save client"
          resetOnSuccess={false}
          className="mt-4 flex flex-col gap-3"
        >
          <input type="hidden" name="clientId" value={client.id} />
          <div>
            <Label htmlFor="client-name">Name</Label>
            <Input
              id="client-name"
              name="name"
              required
              defaultValue={client.name}
            />
          </div>
          <div>
            <Label htmlFor="client-email">Email</Label>
            <Input
              id="client-email"
              name="email"
              type="email"
              defaultValue={client.email ?? ""}
              placeholder="Email"
            />
          </div>
          <div>
            <Label htmlFor="client-phone">Phone</Label>
            <Input
              id="client-phone"
              name="phone"
              defaultValue={client.phone ?? ""}
              placeholder="Phone"
            />
          </div>
          <div>
            <Label htmlFor="client-tags">Tags</Label>
            <Input
              id="client-tags"
              name="tags"
              defaultValue={client.tags.join(", ")}
              placeholder="Tags (comma-separated)"
            />
          </div>
          <div>
            <Label htmlFor="client-notes">Notes</Label>
            <Textarea
              id="client-notes"
              name="notes"
              rows={4}
              defaultValue={client.notes ?? ""}
              placeholder="Internal notes"
            />
          </div>
        </ActionForm>
      </Surface>

      <div>
        <h2 className="mb-3 text-sm font-semibold">History</h2>
        {client.bookings.length === 0 ? (
          <EmptyState title="No bookings yet" />
        ) : (
          <Surface padding="none" className="overflow-hidden">
            <ul className="divide-y divide-[var(--border)]">
              {client.bookings.map((b) => (
                <li key={b.id} className="px-4 py-3 text-sm">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="font-medium">
                        {formatInTimeZone(
                          b.startAt,
                          b.location.timezone,
                          "EEE MMM d · HH:mm",
                        )}{" "}
                        · {b.service.name}
                      </p>
                      <p className="text-xs text-[var(--ink-tertiary)]">
                        {b.resource.name}
                      </p>
                    </div>
                    <StatusPill status={b.status} />
                  </div>
                </li>
              ))}
            </ul>
          </Surface>
        )}
      </div>
    </div>
  );
}
