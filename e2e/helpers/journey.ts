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

export async function dismissBookingTourIfPresent(page: Page) {
  const skip = page.getByRole("button", { name: /^Skip$/ });
  try {
    await skip.waitFor({ state: "visible", timeout: 4000 });
    await skip.click();
    await expect(page.getByRole("dialog")).toHaveCount(0);
  } catch {
    // First-time guide not shown (already completed in this browser).
  }
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
  await dismissBookingTourIfPresent(page);

  const serviceGroup = page.getByRole("radiogroup", { name: "Service" });
  await expect(serviceGroup).toBeVisible();
  await serviceGroup
    .getByRole("radio", { name: new RegExp(TEST_SERVICE_NAME) })
    .click();

  const staffGroup = page.getByRole("radiogroup", { name: "Staff" });
  await expect(staffGroup).toBeVisible();
  await staffGroup.getByRole("radio", { name: TEST_STAFF_NAME }).click();

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
