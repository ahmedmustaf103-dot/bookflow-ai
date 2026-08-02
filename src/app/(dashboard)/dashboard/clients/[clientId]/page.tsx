import Link from "next/link";
import { notFound } from "next/navigation";
import { formatInTimeZone } from "date-fns-tz";

import { ActionForm } from "@/components/forms/action-form";
import { updateClientAction } from "@/server/actions/ops";
import { db } from "@/server/db";
import { requireOrgRole } from "@/server/tenant/context";

export default async function ClientDetailPage({
  params,
}: {
  params: Promise<{ clientId: string }>;
}) {
  const ctx = await requireOrgRole("STAFF");
  const { clientId } = await params;

  const client = await db.client.findFirst({
    where: { id: clientId, organizationId: ctx.organization.id },
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
    <div className="flex flex-col gap-8">
      <div>
        <Link
          href="/dashboard/clients"
          className="text-sm text-[var(--color-ink)]/60 hover:text-[var(--color-ink)]"
        >
          ← Clients
        </Link>
        <h1 className="font-display mt-2 text-3xl tracking-tight">
          {client.name}
        </h1>
        <p className="mt-2 text-sm text-[var(--color-ink)]/65">
          Lifetime value (completed):{" "}
          {new Intl.NumberFormat("en-US", {
            style: "currency",
            currency: "USD",
          }).format(lifetimeValueCents / 100)}
          {" · "}
          {noShows} no-show{noShows === 1 ? "" : "s"}
        </p>
      </div>

      <section className="max-w-lg">
        <h2 className="text-lg font-semibold">Profile</h2>
        <ActionForm
          action={updateClientAction}
          submitLabel="Save client"
          resetOnSuccess={false}
          className="mt-4 flex flex-col gap-3"
        >
          <input type="hidden" name="clientId" value={client.id} />
          <input
            name="name"
            required
            defaultValue={client.name}
            className="rounded-md border border-[var(--color-border)] bg-white px-3 py-2 text-sm"
          />
          <input
            name="email"
            type="email"
            defaultValue={client.email ?? ""}
            placeholder="Email"
            className="rounded-md border border-[var(--color-border)] bg-white px-3 py-2 text-sm"
          />
          <input
            name="phone"
            defaultValue={client.phone ?? ""}
            placeholder="Phone"
            className="rounded-md border border-[var(--color-border)] bg-white px-3 py-2 text-sm"
          />
          <input
            name="tags"
            defaultValue={client.tags.join(", ")}
            placeholder="Tags (comma-separated)"
            className="rounded-md border border-[var(--color-border)] bg-white px-3 py-2 text-sm"
          />
          <textarea
            name="notes"
            rows={4}
            defaultValue={client.notes ?? ""}
            placeholder="Internal notes"
            className="rounded-md border border-[var(--color-border)] bg-white px-3 py-2 text-sm"
          />
        </ActionForm>
      </section>

      <section>
        <h2 className="text-lg font-semibold">History</h2>
        <ul className="mt-3 divide-y divide-[var(--color-border)] rounded-lg border border-[var(--color-border)]">
          {client.bookings.map((b) => (
            <li key={b.id} className="px-4 py-3 text-sm">
              <p className="font-medium">
                {formatInTimeZone(
                  b.startAt,
                  b.location.timezone,
                  "EEE MMM d · HH:mm",
                )}{" "}
                · {b.service.name}
              </p>
              <p className="text-[var(--color-ink)]/60">
                {b.resource.name} · {b.status}
              </p>
            </li>
          ))}
          {client.bookings.length === 0 ? (
            <li className="px-4 py-6 text-[var(--color-ink)]/60">
              No bookings yet.
            </li>
          ) : null}
        </ul>
      </section>
    </div>
  );
}
