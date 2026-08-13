import { expect, test } from "@playwright/test";

import { TEST_ORG_NAME, TEST_ORG_SLUG } from "../src/test/constants";

import { expectNotFoundPage } from "./helpers/not-found";

test.describe("smoke", () => {
  test("marketing home loads", async ({ page }) => {
    await page.goto("/");
    await expect(
      page.getByRole("heading", { name: "BookFlow AI" }),
    ).toBeVisible();
  });

  test("sign-in route is reachable", async ({ page }) => {
    await page.goto("/sign-in");
    await expect(page).toHaveURL(/sign-in/);
  });

  test("unknown booking slug does not render the wizard", async ({ page }) => {
    await page.goto("/book/this-org-does-not-exist-xyz");
    await expectNotFoundPage(page);
    await expect(page.getByText(/Pick a service/i)).toHaveCount(0);
  });

  test("seeded test booking page loads", async ({ page }) => {
    const res = await page.goto(`/book/${TEST_ORG_SLUG}`);
    expect(res?.ok()).toBeTruthy();
    await expect(
      page.getByRole("heading", { name: TEST_ORG_NAME }),
    ).toBeVisible();
  });
});
