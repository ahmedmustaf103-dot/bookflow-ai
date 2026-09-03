import "server-only";

import { onboardingCopy } from "@/lib/onboarding/copy";
import { err, type ActionResult } from "@/lib/result";
import { isDemoGuest } from "@/server/demo/session";

export async function rejectIfDemo(): Promise<ActionResult<never> | null> {
  if (await isDemoGuest()) {
    return err(onboardingCopy.tryDemo.unavailable);
  }
  return null;
}
