import Link from "next/link";

import { ActionForm } from "@/components/forms/action-form";
import { Button, ButtonLink } from "@/components/ui/button";
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
              : "Clients appear when someone books — or add one manually."
          }
          action={
            query ? undefined : (
              <ButtonLink href="#add-client" variant="primary" size="sm">
                Add client
              </ButtonLink>
            )
          }
        />
      ) : (
        <Surface padding="none" className="overflow-hidden">
          <ul className="divide-y divide-[var(--border)]">
            {clients.map((c, i) => (
              <li
                key={c.id}
                className="bf-stagger-item"
                style={{ ["--bf-i" as string]: Math.min(i, 6) }}
              >
                <Link
                  href={`/dashboard/clients/${c.id}`}
                  className="bf-row-hover flex items-center justify-between gap-4 px-4 py-3 hover:bg-[var(--muted)]/70 focus-visible:bg-[var(--muted)] focus-visible:outline-none"
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

      <Surface id="add-client" className="max-w-md scroll-mt-6">
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
