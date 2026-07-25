import type { OrganizationPlan } from "@/generated/prisma/client";

export type PlanLimits = {
  locations: number | null;
  resources: number | null;
  bookingsPerMonth: number | null;
};

const LIMITS: Record<OrganizationPlan, PlanLimits> = {
  TRIAL: { locations: 1, resources: 2, bookingsPerMonth: 50 },
  STARTER: { locations: 1, resources: 2, bookingsPerMonth: 300 },
  GROWTH: { locations: 3, resources: 10, bookingsPerMonth: 2000 },
  BUSINESS: { locations: null, resources: null, bookingsPerMonth: null },
};

export function getPlanLimits(plan: OrganizationPlan): PlanLimits {
  return LIMITS[plan];
}

export function priceIdToPlan(
  priceId: string | null | undefined,
  env: {
    STRIPE_PRICE_STARTER?: string;
    STRIPE_PRICE_GROWTH?: string;
    STRIPE_PRICE_BUSINESS?: string;
  },
): OrganizationPlan | null {
  if (!priceId) return null;
  if (env.STRIPE_PRICE_STARTER && priceId === env.STRIPE_PRICE_STARTER) {
    return "STARTER";
  }
  if (env.STRIPE_PRICE_GROWTH && priceId === env.STRIPE_PRICE_GROWTH) {
    return "GROWTH";
  }
  if (env.STRIPE_PRICE_BUSINESS && priceId === env.STRIPE_PRICE_BUSINESS) {
    return "BUSINESS";
  }
  return null;
}
