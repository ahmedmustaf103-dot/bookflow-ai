import Link from "next/link";

import { ActionForm } from "@/components/forms/action-form";
import { createManualClientAction } from "@/server/actions/ops";
import { db } from "@/server/db";
import { requireOrgOrRedirect } from "@/server/tenant/context";

export default async function ClientsPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string }>;
}) {
  const ctx = await requireOrgOrRedirect();
  const { q } = await searchParams;
  const query = q?.trim() ?? "";

  const clients = await db.client.findMany({
    where: {
      organizationId: ctx.organization.id,
      ...(query
        ? {
            OR: [
              { name: { contains: query, mode: "insensitive" } },
              { email: { contains: query, mode: "insensitive" } },
              { phone: { contains: query, mode: "insensitive" } },
            ],
          }
        : {}),
    },
    include: {
      _count: { select: { bookings: true } },
    },
    orderBy: { updatedAt: "desc" },
    take: 100,
  });

  return (
    <div className="flex flex-col gap-8">
      <div>
        <h1 className="font-display text-3xl tracking-tight">Clients</h1>
        <p className="mt-2 text-[var(--color-ink)]/70">
          CRM-lite: search, notes, tags, and booking history.
        </p>
      </div>

      <form className="flex gap-2">
        <input
          name="q"
          defaultValue={query}
          placeholder="Search name, email, phone"
          className="w-full max-w-md rounded-md border border-[var(--color-border)] bg-white px-3 py-2 text-sm"
        />
        <button
          type="submit"
          className="rounded-md bg-[var(--color-ink)] px-4 py-2 text-sm text-[var(--color-paper)]"
        >
          Search
        </button>
      </form>

      <ul className="divide-y divide-[var(--color-border)] rounded-lg border border-[var(--color-border)]">
        {clients.map((c) => (
          <li key={c.id}>
            <Link
              href={`/dashboard/clients/${c.id}`}
              className="flex items-center justify-between gap-4 px-4 py-3 hover:bg-[var(--color-muted)]/40"
            >
              <div>
                <p className="font-medium">{c.name}</p>
                <p className="text-sm text-[var(--color-ink)]/60">
                  {[c.email, c.phone].filter(Boolean).join(" · ") ||
                    "No contact"}
                </p>
                {c.tags.length > 0 ? (
                  <p className="mt-1 text-xs text-[var(--color-accent)]">
                    {c.tags.join(", ")}
                  </p>
                ) : null}
              </div>
              <span className="text-sm text-[var(--color-ink)]/50">
                {c._count.bookings} booking{c._count.bookings === 1 ? "" : "s"}
              </span>
            </Link>
          </li>
        ))}
        {clients.length === 0 ? (
          <li className="px-4 py-8 text-sm text-[var(--color-ink)]/60">
            No clients yet — they appear when someone books.
          </li>
        ) : null}
      </ul>

      <section className="max-w-md">
        <h2 className="text-lg font-semibold">Add client</h2>
        <ActionForm
          action={createManualClientAction}
          submitLabel="Add client"
          className="mt-4 flex flex-col gap-3"
        >
          <input
            name="name"
            required
            placeholder="Full name"
            className="rounded-md border border-[var(--color-border)] bg-white px-3 py-2 text-sm"
          />
          <input
            name="email"
            type="email"
            placeholder="Email"
            className="rounded-md border border-[var(--color-border)] bg-white px-3 py-2 text-sm"
          />
          <input
            name="phone"
            placeholder="Phone"
            className="rounded-md border border-[var(--color-border)] bg-white px-3 py-2 text-sm"
          />
        </ActionForm>
      </section>
    </div>
  );
}
