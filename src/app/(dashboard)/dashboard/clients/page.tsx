import Link from "next/link";

import { ActionForm } from "@/components/forms/action-form";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { PageHeader } from "@/components/ui/page-header";
import { Surface } from "@/components/ui/surface";
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
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Clients"
        description="CRM-lite: search, notes, tags, and booking history."
      />

      <form className="flex flex-wrap gap-2">
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
        <Button type="submit" variant="secondary" size="sm">
          Search
        </Button>
      </form>

      {clients.length === 0 ? (
        <EmptyState
          title={query ? "No matching clients" : "No clients yet"}
          description={
            query
              ? "Try a different search term."
              : "Clients appear when someone books or you add one below."
          }
        />
      ) : (
        <Surface padding="none" className="overflow-hidden">
          <ul className="divide-y divide-[var(--border)]">
            {clients.map((c) => (
              <li key={c.id}>
                <Link
                  href={`/dashboard/clients/${c.id}`}
                  className="flex items-center justify-between gap-4 px-4 py-3 transition-colors hover:bg-[var(--muted)]/70 focus-visible:bg-[var(--muted)] focus-visible:outline-none"
                >
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium">{c.name}</p>
                    <p className="truncate text-xs text-[var(--ink-tertiary)]">
                      {[c.email, c.phone].filter(Boolean).join(" · ") ||
                        "No contact"}
                    </p>
                    {c.tags.length > 0 ? (
                      <p className="mt-1 text-xs text-[var(--accent)]">
                        {c.tags.join(", ")}
                      </p>
                    ) : null}
                  </div>
                  <span className="shrink-0 text-xs tabular-nums text-[var(--ink-tertiary)]">
                    {c._count.bookings} booking
                    {c._count.bookings === 1 ? "" : "s"}
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        </Surface>
      )}

      <Surface className="max-w-md">
        <h2 className="text-sm font-semibold">Add client</h2>
        <ActionForm
          action={createManualClientAction}
          submitLabel="Add client"
          className="mt-4 flex flex-col gap-3"
        >
          <div>
            <Label htmlFor="client-name">Full name</Label>
            <Input id="client-name" name="name" required />
          </div>
          <div>
            <Label htmlFor="client-email">Email</Label>
            <Input id="client-email" name="email" type="email" />
          </div>
          <div>
            <Label htmlFor="client-phone">Phone</Label>
            <Input id="client-phone" name="phone" />
          </div>
        </ActionForm>
      </Surface>
    </div>
  );
}
