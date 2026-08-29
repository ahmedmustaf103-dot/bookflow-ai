import Link from "next/link";
import { formatInTimeZone } from "date-fns-tz";
import type { Prisma } from "@/generated/prisma/client";

import { ActionForm } from "@/components/forms/action-form";
import { Button, ButtonLink } from "@/components/ui/button";
import { DataTable } from "@/components/ui/data-table";
import { Input, Textarea } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { PageHeader } from "@/components/ui/page-header";
import { Surface } from "@/components/ui/surface";
import { TagChip } from "@/components/ui/tag-chip";
import { formatMoney } from "@/lib/client-tags";
import { createManualClientAction } from "@/server/actions/ops";
import { canManage } from "@/server/auth/session";
import {
  bookingWhereForScope,
  resolveStaffResourceScope,
} from "@/server/staff/scope";
import { requireOrgRole } from "@/server/tenant/context";

type ClientRow = {
  id: string;
  name: string;
  email: string | null;
  phone: string | null;
  tags: string[];
  notes: string | null;
  bookingCount: number;
  isRepeat: boolean;
  ltvCents: number;
  currency: string;
  lastAt: Date | null;
  lastTz: string | null;
  nextAt: Date | null;
  nextTz: string | null;
  nextService: string | null;
};

function buildHref(params: {
  q?: string;
  tag?: string;
  repeat?: string;
}) {
  const sp = new URLSearchParams();
  if (params.q) sp.set("q", params.q);
  if (params.tag) sp.set("tag", params.tag);
  if (params.repeat) sp.set("repeat", params.repeat);
  const qs = sp.toString();
  return qs ? `/dashboard/clients?${qs}` : "/dashboard/clients";
}

export default async function ClientsPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; tag?: string; repeat?: string }>;
}) {
  const ctx = await requireOrgRole("STAFF");
  const params = await searchParams;
  const query = params.q?.trim() ?? "";
  const tag = params.tag?.trim() ?? "";
  const repeatOnly = params.repeat === "1";
  const tzDefault = ctx.organization.timezoneDefault;
  const scope = await resolveStaffResourceScope({
    organizationId: ctx.organization.id,
    userId: ctx.user.id,
    role: ctx.membership.role,
  });
  const showFinance = canManage(ctx.membership.role);

  const where: Prisma.ClientWhereInput = {
    AND: [
      query
        ? {
            OR: [
              { name: { contains: query, mode: "insensitive" } },
              { email: { contains: query, mode: "insensitive" } },
              { phone: { contains: query, mode: "insensitive" } },
              { notes: { contains: query, mode: "insensitive" } },
              { tags: { has: query } },
            ],
          }
        : {},
      tag ? { tags: { has: tag } } : {},
      scope.all
        ? {}
        : {
            bookings: {
              some: { resourceId: { in: scope.resourceIds } },
            },
          },
    ],
  };

  const [clients, tagSource] = await Promise.all([
    ctx.db.client.findMany({
      where,
      include: {
        _count: { select: { bookings: true } },
      },
      orderBy: { updatedAt: "desc" },
      take: 200,
    }),
    ctx.db.client.findMany({
      select: { tags: true },
      take: 500,
    }),
  ]);

  const allTags = [
    ...new Set(tagSource.flatMap((c) => c.tags).filter(Boolean)),
  ].sort((a, b) => a.localeCompare(b));

  const clientIds = clients.map((c) => c.id);
  const bookings =
    clientIds.length === 0
      ? []
      : await ctx.db.booking.findMany({
          where: {
            clientId: { in: clientIds },
            ...bookingWhereForScope(scope),
          },
          select: {
            clientId: true,
            startAt: true,
            status: true,
            service: { select: { priceCents: true, currency: true, name: true } },
            location: { select: { timezone: true } },
          },
          orderBy: { startAt: "desc" },
        });

  const now = Date.now();
  const byClient = new Map<string, typeof bookings>();
  for (const b of bookings) {
    const list = byClient.get(b.clientId) ?? [];
    list.push(b);
    byClient.set(b.clientId, list);
  }

  let rows: ClientRow[] = clients.map((c) => {
    const list = byClient.get(c.id) ?? [];
    const completed = list.filter((b) => b.status === "COMPLETED");
    const ltvCents = completed.reduce((sum, b) => sum + b.service.priceCents, 0);
    const currency =
      completed[0]?.service.currency ?? list[0]?.service.currency ?? "GBP";

    const past = list.filter(
      (b) =>
        b.startAt.getTime() < now &&
        b.status !== "CANCELLED",
    );
    const upcoming = list
      .filter(
        (b) =>
          b.startAt.getTime() >= now &&
          (b.status === "PENDING" || b.status === "CONFIRMED"),
      )
      .sort((a, b) => a.startAt.getTime() - b.startAt.getTime());

    const last = past[0] ?? null;
    const next = upcoming[0] ?? null;

    return {
      id: c.id,
      name: c.name,
      email: c.email,
      phone: c.phone,
      tags: c.tags,
      notes: c.notes,
      bookingCount: list.length,
      isRepeat: list.length >= 2,
      ltvCents,
      currency,
      lastAt: last?.startAt ?? null,
      lastTz: last?.location.timezone ?? null,
      nextAt: next?.startAt ?? null,
      nextTz: next?.location.timezone ?? null,
      nextService: next?.service.name ?? null,
    };
  });

  if (repeatOnly) {
    rows = rows.filter((r) => r.isRepeat);
  }
  rows = rows.slice(0, 100);

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Clients"
        description={
          showFinance
            ? "Search, filter, and open profiles — LTV, visits, and upcoming appointments at a glance."
            : "Customers who have booked with you."
        }
        actions={
          <ButtonLink href="#add-client" variant="secondary" size="sm">
            Add client
          </ButtonLink>
        }
      />

      <form className="flex flex-wrap items-end gap-2">
        {tag ? <input type="hidden" name="tag" value={tag} /> : null}
        {repeatOnly ? <input type="hidden" name="repeat" value="1" /> : null}
        <div className="w-full max-w-md">
          <Label htmlFor="client-search" className="sr-only">
            Search clients
          </Label>
          <Input
            id="client-search"
            name="q"
            defaultValue={query}
            placeholder="Search name, email, phone, notes, or tag"
          />
        </div>
        <Button type="submit" variant="secondary" size="sm">
          Search
        </Button>
        {query || tag || repeatOnly ? (
          <ButtonLink href="/dashboard/clients" variant="ghost" size="sm">
            Clear
          </ButtonLink>
        ) : null}
      </form>

      <div className="flex flex-wrap items-center gap-2">
        <span className="text-xs font-medium tracking-wide text-[var(--ink-tertiary)] uppercase">
          Filters
        </span>
        <TagChip
          label="Repeat customers"
          href={buildHref({
            q: query || undefined,
            tag: tag || undefined,
            repeat: repeatOnly ? undefined : "1",
          })}
          active={repeatOnly}
          muted={!repeatOnly}
        />
        {allTags.slice(0, 16).map((t) => (
          <TagChip
            key={t}
            label={t}
            href={buildHref({
              q: query || undefined,
              tag: tag === t ? undefined : t,
              repeat: repeatOnly ? "1" : undefined,
            })}
            active={tag === t}
          />
        ))}
      </div>

      <DataTable
        rows={rows}
        rowKey={(r) => r.id}
        emptyTitle={query || tag || repeatOnly ? "No matching clients" : "No clients yet"}
        emptyDescription={
          query || tag || repeatOnly
            ? "Try clearing filters or a different search."
            : "Clients appear when someone books — or add one manually."
        }
        emptyAction={
          query || tag || repeatOnly ? undefined : (
            <ButtonLink href="#add-client" variant="primary" size="sm">
              Add client
            </ButtonLink>
          )
        }
        columns={[
          {
            key: "name",
            header: "Client",
            cell: (r) => (
              <div className="min-w-0">
                <Link
                  href={`/dashboard/clients/${r.id}`}
                  className="font-medium hover:text-[var(--accent)]"
                >
                  {r.name}
                </Link>
                {r.isRepeat ? (
                  <span className="ml-2 inline-flex rounded-full bg-[var(--accent-soft)] px-1.5 py-0.5 text-[10px] font-semibold tracking-wide text-[var(--accent)] uppercase">
                    Repeat
                  </span>
                ) : null}
                <p className="truncate text-xs text-[var(--ink-tertiary)]">
                  {[r.email, r.phone].filter(Boolean).join(" · ") || "No contact"}
                </p>
              </div>
            ),
          },
          {
            key: "tags",
            header: "Tags",
            cell: (r) =>
              r.tags.length === 0 ? (
                <span className="text-xs text-[var(--ink-tertiary)]">—</span>
              ) : (
                <div className="flex max-w-[12rem] flex-wrap gap-1">
                  {r.tags.slice(0, 3).map((t) => (
                    <TagChip key={t} label={t} />
                  ))}
                  {r.tags.length > 3 ? (
                    <span className="text-[11px] text-[var(--ink-tertiary)]">
                      +{r.tags.length - 3}
                    </span>
                  ) : null}
                </div>
              ),
          },
          {
            key: "visits",
            header: "Visits",
            className: "w-20",
            cell: (r) => (
              <span className="tabular-nums">{r.bookingCount}</span>
            ),
          },
          ...(showFinance
            ? [
                {
                  key: "ltv" as const,
                  header: "LTV",
                  className: "w-24",
                  cell: (r: ClientRow) => (
                    <span className="tabular-nums">
                      {r.ltvCents > 0
                        ? formatMoney(r.ltvCents, r.currency)
                        : "—"}
                    </span>
                  ),
                },
              ]
            : []),
          {
            key: "last",
            header: "Last",
            cell: (r) =>
              r.lastAt ? (
                <span className="tabular-nums text-xs">
                  {formatInTimeZone(
                    r.lastAt,
                    r.lastTz ?? tzDefault,
                    "MMM d · HH:mm",
                  )}
                </span>
              ) : (
                <span className="text-xs text-[var(--ink-tertiary)]">—</span>
              ),
          },
          {
            key: "next",
            header: "Next",
            cell: (r) =>
              r.nextAt ? (
                <div>
                  <p className="tabular-nums text-xs font-medium">
                    {formatInTimeZone(
                      r.nextAt,
                      r.nextTz ?? tzDefault,
                      "MMM d · HH:mm",
                    )}
                  </p>
                  {r.nextService ? (
                    <p className="truncate text-[11px] text-[var(--ink-tertiary)]">
                      {r.nextService}
                    </p>
                  ) : null}
                </div>
              ) : (
                <span className="text-xs text-[var(--ink-tertiary)]">—</span>
              ),
          },
        ]}
      />

      <Surface id="add-client" className="max-w-md scroll-mt-6">
        <h2 className="text-sm font-semibold">Add client</h2>
        <ActionForm
          action={createManualClientAction}
          submitLabel="Add client"
          className="mt-4 flex flex-col gap-3"
        >
          <div>
            <Label htmlFor="client-name">Full name</Label>
            <Input id="client-name" name="name" required autoComplete="name" />
          </div>
          <div>
            <Label htmlFor="client-email">Email</Label>
            <Input id="client-email" name="email" type="email" />
          </div>
          <div>
            <Label htmlFor="client-phone">Phone</Label>
            <Input id="client-phone" name="phone" />
          </div>
          <div>
            <Label htmlFor="new-client-tags">Tags</Label>
            <Input
              id="new-client-tags"
              name="tags"
              placeholder="vip, colour, walk-in"
            />
          </div>
          <div>
            <Label htmlFor="new-client-notes">Notes</Label>
            <Textarea
              id="new-client-notes"
              name="notes"
              rows={2}
              placeholder="Preferences, allergies, how they found you…"
            />
          </div>
          <label className="flex items-start gap-2.5 text-sm text-[var(--ink-secondary)]">
            <input
              type="checkbox"
              name="marketingOptIn"
              value="on"
              className="mt-0.5"
            />
            <span>
              Allow marketing &amp; engagement emails (follow-ups, review asks,
              rebooking). Confirmations and reminders always send.
            </span>
          </label>
        </ActionForm>
      </Surface>
    </div>
  );
}
