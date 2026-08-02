import Link from "next/link";

import { ActionForm } from "@/components/forms/action-form";
import { EmptyState } from "@/components/ui/empty-state";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { createManualClientAction } from "@/server/actions/ops";
import { requireOrgRole } from "@/server/tenant/context";

export default async function ClientsPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string }>;
}) {
  const ctx = await requireOrgRole("STAFF");
  const { q } = await searchParams;
  const query = q?.trim() ?? "";

  const clients = await ctx.db.client.findMany({
    where: query
      ? {
          OR: [
            { name: { contains: query, mode: "insensitive" } },
            { email: { contains: query, mode: "insensitive" } },
            { phone: { contains: query, mode: "insensitive" } },
          ],
        }
      : {},
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
        <div className="w-full max-w-md">
          <Label htmlFor="client-search" className="sr-only">
            Search clients
          </Label>
          <Input
            id="client-search"
            name="q"
            defaultValue={query}
            placeholder="Search name, email, phone"
          />
        </div>
        <button
          type="submit"
          className="rounded-md bg-[var(--color-ink)] px-4 py-2 text-sm text-[var(--color-paper)]"
        >
          Search
        </button>
      </form>

      {clients.length === 0 ? (
        <EmptyState
          title={query ? "No matching clients" : "No clients yet…"}
          description={
            query
              ? "Try a different search term."
              : "Clients appear when someone books or you add one below."
          }
        />
      ) : (
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
        </ul>
      )}

      <section className="max-w-md">
        <h2 className="text-lg font-semibold">Add client</h2>
        <ActionForm
          action={createManualClientAction}
          submitLabel="Add client"
          className="mt-4 flex flex-col gap-3"
        >
          <div>
            <Label htmlFor="client-name">Full name</Label>
            <Input id="client-name" name="name" required className="mt-1" />
          </div>
          <div>
            <Label htmlFor="client-email">Email</Label>
            <Input
              id="client-email"
              name="email"
              type="email"
              className="mt-1"
            />
          </div>
          <div>
            <Label htmlFor="client-phone">Phone</Label>
            <Input id="client-phone" name="phone" className="mt-1" />
          </div>
        </ActionForm>
      </section>
    </div>
  );
}
