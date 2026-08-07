import "server-only";

import { tool } from "ai";
import { z } from "zod";
import { formatInTimeZone } from "date-fns-tz";

import { db } from "@/server/db";
import { getSlotsForServiceResource } from "@/server/availability/slots";

/**
 * Read-only tools bound to an organization.
 * AI must never mutate bookings directly — only propose.
 */
export function createOrgAiTools(organizationId: string) {
  return {
    listServices: tool({
      description: "List active services for this business",
      inputSchema: z.object({}),
      execute: async () => {
        const services = await db.service.findMany({
          where: { organizationId, isActive: true },
          select: {
            id: true,
            name: true,
            durationMin: true,
            priceCents: true,
            bufferAfter: true,
          },
          orderBy: { name: "asc" },
        });
        return services;
      },
    }),

    listResources: tool({
      description:
        "List active staff/resources, optionally filtered by service",
      inputSchema: z.object({
        serviceId: z.string().optional(),
      }),
      execute: async ({ serviceId }) => {
        if (serviceId) {
          const links = await db.serviceResource.findMany({
            where: {
              serviceId,
              service: { organizationId, isActive: true },
              resource: { isActive: true },
            },
            include: {
              resource: {
                select: { id: true, name: true, type: true, locationId: true },
              },
            },
          });
          return links.map((l) => l.resource);
        }

        return db.resource.findMany({
          where: { organizationId, isActive: true },
          select: { id: true, name: true, type: true, locationId: true },
          orderBy: { name: "asc" },
        });
      },
    }),

    searchClients: tool({
      description: "Search clients by name, email, or phone",
      inputSchema: z.object({
        query: z.string().min(1).max(100),
      }),
      execute: async ({ query }) => {
        const clients = await db.client.findMany({
          where: {
            organizationId,
            OR: [
              { name: { contains: query, mode: "insensitive" } },
              { email: { contains: query, mode: "insensitive" } },
              { phone: { contains: query, mode: "insensitive" } },
            ],
          },
          select: {
            id: true,
            name: true,
            email: true,
            phone: true,
            tags: true,
          },
          take: 10,
        });
        return clients;
      },
    }),

    getClientHistory: tool({
      description:
        "Get client notes, tags, status tallies, and recent bookings before recommending times",
      inputSchema: z.object({
        clientId: z.string(),
        limit: z.number().int().min(1).max(20).optional(),
      }),
      execute: async ({ clientId, limit = 8 }) => {
        const client = await db.client.findFirst({
          where: { id: clientId, organizationId },
          select: {
            id: true,
            name: true,
            notes: true,
            tags: true,
            bookings: {
              orderBy: { startAt: "desc" },
              take: Math.max(limit, 20),
              select: {
                id: true,
                startAt: true,
                status: true,
                service: { select: { name: true, durationMin: true } },
                resource: { select: { name: true } },
                location: { select: { timezone: true } },
              },
            },
          },
        });
        if (!client) return { error: "Client not found" };

        const tallies = {
          completed: 0,
          noShow: 0,
          cancelled: 0,
          upcoming: 0,
        };
        const now = Date.now();
        for (const b of client.bookings) {
          if (b.status === "COMPLETED") tallies.completed += 1;
          if (b.status === "NO_SHOW") tallies.noShow += 1;
          if (b.status === "CANCELLED") tallies.cancelled += 1;
          if (
            b.startAt.getTime() >= now &&
            (b.status === "PENDING" || b.status === "CONFIRMED")
          ) {
            tallies.upcoming += 1;
          }
        }

        return {
          id: client.id,
          name: client.name,
          notes: client.notes,
          tags: client.tags,
          tallies,
          bookings: client.bookings.slice(0, limit).map((b) => ({
            id: b.id,
            when: formatInTimeZone(
              b.startAt,
              b.location.timezone,
              "yyyy-MM-dd HH:mm",
            ),
            status: b.status,
            service: b.service.name,
            resource: b.resource.name,
          })),
        };
      },
    }),

    getAvailableSlots: tool({
      description:
        "Get open appointment slots for a service + resource (defaults to the next week). Always call this before proposeBooking.",
      inputSchema: z.object({
        serviceId: z.string(),
        resourceId: z.string(),
        fromDate: z
          .string()
          .regex(/^\d{4}-\d{2}-\d{2}$/)
          .optional(),
        toDate: z
          .string()
          .regex(/^\d{4}-\d{2}-\d{2}$/)
          .optional(),
      }),
      execute: async ({ serviceId, resourceId, fromDate, toDate }) => {
        const slots = await getSlotsForServiceResource({
          organizationId,
          serviceId,
          resourceId,
          fromDate,
          toDate,
        });
        const resource = await db.resource.findFirst({
          where: { id: resourceId, organizationId },
          include: { location: true },
        });
        const tz = resource?.location.timezone ?? "UTC";
        return slots.slice(0, 24).map((s) => ({
          startIso: s.start.toISOString(),
          label: formatInTimeZone(s.start, tz, "EEE MMM d · HH:mm"),
        }));
      },
    }),

    proposeBooking: tool({
      description:
        "Propose a booking for staff review. Does NOT create the booking. Return the proposal for human confirmation.",
      inputSchema: z.object({
        serviceId: z.string(),
        resourceId: z.string(),
        startIso: z.string(),
        clientName: z.string(),
        clientEmail: z.string().email().optional(),
        clientPhone: z.string().optional(),
        notes: z.string().optional(),
        rationale: z.string().optional(),
      }),
      execute: async (proposal) => {
        const [service, resource] = await Promise.all([
          db.service.findFirst({
            where: { id: proposal.serviceId, organizationId, isActive: true },
          }),
          db.resource.findFirst({
            where: { id: proposal.resourceId, organizationId, isActive: true },
            include: { location: true },
          }),
        ]);

        if (!service || !resource) {
          return { ok: false, error: "Service or resource not found" };
        }

        const startAt = new Date(proposal.startIso);
        if (Number.isNaN(startAt.getTime())) {
          return { ok: false, error: "Invalid startIso" };
        }

        return {
          ok: true,
          requiresHumanConfirmation: true,
          proposal: {
            serviceId: service.id,
            serviceName: service.name,
            resourceId: resource.id,
            resourceName: resource.name,
            startIso: startAt.toISOString(),
            label: formatInTimeZone(
              startAt,
              resource.location.timezone,
              "EEE MMM d · HH:mm",
            ),
            clientName: proposal.clientName,
            clientEmail: proposal.clientEmail ?? null,
            clientPhone: proposal.clientPhone ?? null,
            notes: proposal.notes ?? null,
            rationale: proposal.rationale ?? null,
          },
        };
      },
    }),
  } as const;
}
