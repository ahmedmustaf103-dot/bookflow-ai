import "server-only";

import Stripe from "stripe";

import { env } from "@/lib/env";

let stripe: Stripe | null = null;

export function getStripe(): Stripe | null {
  if (!env.STRIPE_SECRET_KEY) return null;
  if (!stripe) {
    stripe = new Stripe(env.STRIPE_SECRET_KEY, {
      apiVersion: "2025-12-15.clover" as Stripe.LatestApiVersion,
      typescript: true,
    });
  }
  return stripe;
}

export function requireStripe(): Stripe {
  const client = getStripe();
  if (!client) {
    throw new Error("Stripe is not configured (STRIPE_SECRET_KEY missing)");
  }
  return client;
}
