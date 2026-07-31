import type { OrganizationPlan } from "@/generated/prisma/client";

export type PlanLimits = {
  locations: number | null;
  resources: number | null;
  bookingsPerMonth: number | null;
  /** Monthly AI token budget (in+out). null = unlimited */
  aiTokensPerMonth: number | null;
  /** SMS appointment reminders (Twilio) */
  smsReminders: boolean;
};

const LIMITS: Record<OrganizationPlan, PlanLimits> = {
  TRIAL: {
    locations: 1,
    resources: 2,
    bookingsPerMonth: 50,
    aiTokensPerMonth: 25_000,
    smsReminders: false,
  },
  STARTER: {
    locations: 1,
    resources: 2,
    bookingsPerMonth: 300,
    aiTokensPerMonth: 0,
    smsReminders: false,
  },
  GROWTH: {
    locations: 3,
    resources: 10,
    bookingsPerMonth: 2000,
    aiTokensPerMonth: 50_000,
    smsReminders: true,
  },
  BUSINESS: {
    locations: null,
    resources: null,
    bookingsPerMonth: null,
    aiTokensPerMonth: 500_000,
    smsReminders: true,
  },
};

export function getPlanLimits(plan: OrganizationPlan): PlanLimits {
  return LIMITS[plan];
}

export function planAllowsAi(plan: OrganizationPlan) {
  const limit = LIMITS[plan].aiTokensPerMonth;
  return limit === null || limit > 0;
}

export function planAllowsSms(plan: OrganizationPlan) {
  return LIMITS[plan].smsReminders;
}

export function planAllowsReminders(plan: OrganizationPlan) {
  return plan === "GROWTH" || plan === "BUSINESS" || plan === "TRIAL";
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
