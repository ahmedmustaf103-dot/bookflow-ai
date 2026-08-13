import { expect, test } from "@playwright/test";

import { TEST_MANAGE_TOKEN, TEST_ORG_SLUG } from "../src/test/constants";
import { loadTestEnv } from "../src/test/load-test-env";

import { completePublicBooking } from "./helpers/journey";
import { findLatestBookingByEmail } from "./helpers/lookup";
import { expectNotFoundPage } from "./helpers/not-found";

loadTestEnv();

test.describe.configure({ mode: "serial" });

test.describe("customer journey", () => {
  let email = "";
  let manageToken = TEST_MANAGE_TOKEN;

  test("public booking happy path", async ({ page }) => {
    const result = await completePublicBooking(page);
    email = result.email;
    await expect(page.getByText(/Confirmation sent/i)).toBeVisible();
    await expect(page.getByText(/Ref:/i)).toBeVisible();

    const booking = await findLatestBookingByEmail(email);
    expect(booking).toBeTruthy();
    expect(booking?.status).toBe("CONFIRMED");
    expect(booking?.service.name).toBe("Haircut");
    expect(booking?.resource.name).toBe("Alex Rivera");
    manageToken = booking!.manageToken;
  });

  test("customer opens manage appointment and sees details", async ({
    page,
  }) => {
    await page.goto(`/book/manage/${manageToken}`);
    await expect(
      page.getByRole("heading", { name: "E2E Test Shop" }),
    ).toBeVisible();
    await expect(page.getByText("Haircut")).toBeVisible();
    await expect(page.getByText("Alex Rivera")).toBeVisible();
    await expect(
      page.getByRole("button", { name: "Reschedule" }),
    ).toBeVisible();
    await expect(
      page.getByRole("button", { name: "Cancel appointment" }),
    ).toBeVisible();
  });

  test("customer reschedules to another open slot", async ({ page }) => {
    await page.goto(`/book/manage/${manageToken}`);
    await page.getByRole("button", { name: "Reschedule" }).click();
    const slots = page.getByRole("radiogroup", {
      name: "New appointment time",
    });
    await expect(slots).toBeVisible({ timeout: 20_000 });
    await slots.getByRole("radio").nth(1).click();
    await page.getByRole("button", { name: "Confirm new time" }).click();
    await expect(
      page.getByText("Your appointment has been rescheduled."),
    ).toBeVisible({ timeout: 20_000 });
  });

  test("customer cancels the appointment", async ({ page }) => {
    await page.goto(`/book/manage/${manageToken}`);
    await page.getByRole("button", { name: "Cancel appointment" }).click();
    await page.getByRole("button", { name: "Yes, cancel" }).click();
    await expect(
      page.getByText("Your appointment has been cancelled."),
    ).toBeVisible({ timeout: 20_000 });
    await expect(
      page.getByText(/can no longer be changed online/i),
    ).toBeVisible();
  });

  test("invalid manage token does not render the appointment", async ({
    page,
  }) => {
    await page.goto("/book/manage/notfoundtoken99");
    await expectNotFoundPage(page);
    await expect(
      page.getByRole("heading", { name: "E2E Test Shop" }),
    ).toHaveCount(0);
    await expect(page.getByText("Haircut")).toHaveCount(0);
    await expect(page.getByText("Alex Rivera")).toHaveCount(0);
    await expect(page.getByRole("button", { name: "Reschedule" })).toHaveCount(
      0,
    );
    await expect(
      page.getByRole("button", { name: "Cancel appointment" }),
    ).toHaveCount(0);
  });

  test("unauthenticated dashboard redirects to sign-in", async ({ page }) => {
    await page.goto("/dashboard");
    await expect(page).toHaveURL(/sign-in/, { timeout: 20_000 });
  });
});

test("unknown booking slug still does not render the wizard", async ({
  page,
}) => {
  await page.goto("/book/this-org-does-not-exist-xyz");
  await expectNotFoundPage(page);
  await expect(page.getByText(/Pick a service/i)).toHaveCount(0);
  await expect(page.getByRole("heading", { name: TEST_ORG_SLUG })).toHaveCount(
    0,
  );
});
