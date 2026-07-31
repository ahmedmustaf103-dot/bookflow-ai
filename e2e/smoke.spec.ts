import { expect, test } from "@playwright/test";

test.describe("smoke", () => {
  test("marketing home loads", async ({ page }) => {
    await page.goto("/");
    await expect(page.getByRole("heading", { name: "BookFlow AI" })).toBeVisible();
  });

  test("sign-in route is reachable", async ({ page }) => {
    await page.goto("/sign-in");
    await expect(page).toHaveURL(/sign-in/);
  });

  test("unknown booking slug does not render the wizard", async ({ page }) => {
    const res = await page.goto("/book/this-org-does-not-exist-xyz");
    // 404 when Postgres is up; may be 5xx in CI without a real DB.
    expect(res?.status()).toBeGreaterThanOrEqual(400);
    await expect(page.getByText(/Pick a service/i)).toHaveCount(0);
  });

  test("optional seeded booking page", async ({ page }) => {
    const slug = process.env.SMOKE_ORG_SLUG;
    test.skip(!slug, "Set SMOKE_ORG_SLUG to exercise a real public book page");

    const res = await page.goto(`/book/${slug}`);
    expect(res?.ok()).toBeTruthy();
    await expect(page.getByText(/Book online/i)).toBeVisible();
  });
});
