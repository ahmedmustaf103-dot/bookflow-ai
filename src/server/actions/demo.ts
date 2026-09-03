"use server";

import { redirect } from "next/navigation";

import { onboardingCopy } from "@/lib/onboarding/copy";
import { err, type ActionResult } from "@/lib/result";
import { getOptionalClerkUserId } from "@/server/auth/clerk-id";
import {
  clearDemoSessionCookie,
  loadDemoOrganization,
  setDemoSessionCookie,
} from "@/server/demo/session";

export async function enterDemoAction(): Promise<ActionResult<void>> {
  const userId = await getOptionalClerkUserId();
  if (userId) {
    return err(onboardingCopy.tryDemo.signedInBody);
  }

  const organization = await loadDemoOrganization();
  if (!organization) {
    return err(onboardingCopy.tryDemo.missingShop);
  }

  await setDemoSessionCookie();
  redirect("/dashboard");
}

export async function exitDemoAction(): Promise<void> {
  await clearDemoSessionCookie();
  redirect("/");
}
