import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Page } from "@playwright/test";

import { TEST_MANAGE_TOKEN, TEST_ORG_SLUG } from "../src/test/constants";

async function expectNoSeriousViolations(page: Page) {
  const results = await new AxeBuilder({ page })
    .withTags(["wcag2a", "wcag2aa"])
    .exclude(".bf-marketing-preview")
    .analyze();
  const serious = results.violations.filter(
    (v) => v.impact === "serious" || v.impact === "critical",
  );
  expect(serious, serious.map((v) => `${v.id}: ${v.help}`).join("\n")).toEqual(
    [],
  );
}

test.describe("accessibility", () => {
  test.beforeEach(async ({ page }) => {
    await page.emulateMedia({ reducedMotion: "reduce" });
  });

  test("marketing home has no serious a11y violations", async ({ page }) => {
    await page.goto("/");
    await expectNoSeriousViolations(page);
  });

  test("public booking page has no serious a11y violations", async ({
    page,
  }) => {
    await page.goto(`/book/${TEST_ORG_SLUG}`);
    await expect(
      page.getByRole("heading", { name: "E2E Test Shop" }),
    ).toBeVisible();
    await expectNoSeriousViolations(page);
  });

  test("manage appointment page has no serious a11y violations", async ({
    page,
  }) => {
    await page.goto(`/book/manage/${TEST_MANAGE_TOKEN}`);
    await expect(
      page.getByRole("heading", { name: "E2E Test Shop" }),
    ).toBeVisible();
    await expectNoSeriousViolations(page);
  });
});
