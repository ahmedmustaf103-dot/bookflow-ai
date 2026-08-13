import { expect, type Page } from "@playwright/test";

import {
  TEST_ORG_NAME,
  TEST_ORG_SLUG,
  TEST_SERVICE_NAME,
  TEST_STAFF_NAME,
} from "../../src/test/constants";

export function uniqueEmail(prefix = "jordan") {
  return `${prefix}+${Date.now()}@example.test`;
}

export async function completePublicBooking(
  page: Page,
  input?: { email?: string; name?: string; marketingOptIn?: boolean },
) {
  const email = input?.email ?? uniqueEmail();
  const name = input?.name ?? "Jordan Cole";

  await page.goto(`/book/${TEST_ORG_SLUG}`);
  await expect(
    page.getByRole("heading", { name: TEST_ORG_NAME }),
  ).toBeVisible();

  const serviceGroup = page.getByRole("radiogroup", { name: "Service" });
  if (await serviceGroup.isVisible().catch(() => false)) {
    await serviceGroup
      .getByRole("radio", { name: new RegExp(TEST_SERVICE_NAME) })
      .click();
  } else {
    const serviceChip = page.getByRole("button", { name: /Service/i });
    if (await serviceChip.isVisible().catch(() => false)) {
      await serviceChip.click();
      await page
        .getByRole("radiogroup", { name: "Service" })
        .getByRole("radio", { name: new RegExp(TEST_SERVICE_NAME) })
        .click();
    }
  }

  const staffGroup = page.getByRole("radiogroup", { name: "Staff" });
  if (await staffGroup.isVisible().catch(() => false)) {
    await staffGroup.getByRole("radio", { name: TEST_STAFF_NAME }).click();
  }

  const timeGroup = page.getByRole("radiogroup", { name: "Appointment time" });
  await expect(timeGroup).toBeVisible({ timeout: 20_000 });
  const slot = timeGroup.getByRole("radio").first();
  await expect(slot).toBeVisible();
  await slot.click();

  await page.getByLabel("Full name").fill(name);
  await page.getByRole("textbox", { name: "Email" }).fill(email);
  if (input?.marketingOptIn) {
    await page.getByRole("checkbox").check();
  }

  await page.getByRole("button", { name: "Confirm booking" }).click();
  await expect(
    page.getByRole("heading", { name: /You're booked/i }),
  ).toBeVisible({
    timeout: 20_000,
  });

  return { email, name };
}
