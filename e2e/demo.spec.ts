import { expect, test, type Page } from "@playwright/test";

import { DEMO_ORG_NAME } from "../src/test/demo-shop";

async function skipTourIfPresent(page: Page) {
  const dialog = page.getByRole("dialog");
  try {
    await dialog.waitFor({ state: "visible", timeout: 4000 });
    await page.getByRole("button", { name: /^Skip$/ }).click();
    await expect(dialog).toHaveCount(0);
  } catch {
    // Tour may already be closed.
  }
}

test.describe("try the demo", () => {
  test("visitor can open the sample dashboard without signing in", async ({
    page,
  }, testInfo) => {
    await page.goto("/");
    await page.getByRole("link", { name: "Try the Demo" }).first().click();
    await expect(
      page.getByRole("heading", { name: "Explore the BookFlow demo" }),
    ).toBeVisible();
    await page.getByRole("button", { name: "Continue to Demo" }).click();
    await expect(page).toHaveURL(/\/dashboard/);
    await expect(page.getByText("Demo mode")).toBeVisible();
    await expect(
      page.getByRole("heading", { name: DEMO_ORG_NAME }),
    ).toBeVisible();
    await skipTourIfPresent(page);

    await page.goto("/dashboard/appointments");
    await skipTourIfPresent(page);
    await expect(page.getByRole("heading", { name: "Calendar" })).toBeVisible();
    await expect(page.getByRole("option", { name: "James Carter" })).toHaveCount(
      1,
    );
    await expect(page.getByRole("button", { name: /Alex Morgan/ })).toBeVisible();

    await page.goto("/dashboard/clients");
    await skipTourIfPresent(page);
    await expect(page.getByText("Alex Morgan")).toBeVisible();

    await page.goto("/dashboard/ai");
    await skipTourIfPresent(page);
    await expect(page.getByText("Demo AI")).toBeVisible();
    await expect(page.getByRole("heading", { name: "Client summary" })).toBeVisible();
    await expect(page.getByText("AI is unavailable")).toHaveCount(0);

    await page.goto("/dashboard/settings/calendar");
    await skipTourIfPresent(page);
    await expect(
      page.getByText("Connect your own Google Calendar to sync appointments."),
    ).toBeVisible();

    await page.goto("/dashboard/billing");
    await skipTourIfPresent(page);
    await expect(
      page.getByText("Billing is unavailable in the demo."),
    ).toBeVisible();

    if (testInfo.project.name !== "mobile") {
      await page
        .getByRole("button", { name: "How it works" })
        .filter({ visible: true })
        .click();
      await expect(page.getByRole("dialog")).toBeVisible();
      await page.getByRole("button", { name: /^Skip$/ }).click();
      await expect(page.getByRole("dialog")).toHaveCount(0);
    }

    await page
      .getByRole("button", { name: "Exit Demo" })
      .filter({ visible: true })
      .click();
    await expect(page).toHaveURL(/\/$/);
    await expect(
      page.getByRole("heading", { name: "BookFlow AI" }),
    ).toBeVisible();
  });

  test("public demo booking starts on service, not staff", async ({ page }) => {
    await page.goto("/book/bookflow-demo");
    await skipTourIfPresent(page);
    await expect(
      page.getByRole("heading", { name: /Choose a service/ }),
    ).toBeVisible();
    await expect(page.getByRole("radio", { name: /Skin Fade/ })).toBeVisible();
    await expect(page.getByText("James Carter")).toHaveCount(0);

    const rail = page.getByRole("list", { name: "Booking steps" });
    await expect(rail.getByText("✓")).toHaveCount(0);

    await page.getByRole("radio", { name: /Skin Fade/ }).click();
    await expect(
      page.getByRole("heading", { name: /Choose who you’d like/ }),
    ).toBeVisible();
    await expect(page.getByText("James Carter").first()).toBeVisible();
    await expect(
      page.getByRole("heading", { name: /Choose a date and time/ }),
    ).toHaveCount(0);
  });

  test("demo AI shows a sample customer summary", async ({ page }) => {
    await page.goto("/demo");
    await page.getByRole("button", { name: "Continue to Demo" }).click();
    await expect(page).toHaveURL(/\/dashboard/);
    await skipTourIfPresent(page);
    await page.goto("/dashboard/ai");
    await skipTourIfPresent(page);
    await page.getByRole("button", { name: "Generate summary" }).click();
    await expect(
      page.getByPlaceholder("Results appear here. Edit drafts before sending to clients."),
    ).toHaveValue(/Alex Morgan has visited/, { timeout: 15_000 });
    await expect(page.getByRole("button", { name: "Send to client" })).toHaveCount(
      0,
    );
  });

  test("dashboard stays signed-out without a demo session", async ({ page }) => {
    await page.goto("/dashboard");
    await expect(page).toHaveURL(/sign-in/);
  });

  test("demo dashboard uses the phone agenda, not the desktop grid", async ({
    page,
  }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto("/demo");
    await page.getByRole("button", { name: "Continue to Demo" }).click();
    await expect(page).toHaveURL(/\/dashboard/);
    await skipTourIfPresent(page);
    await page.goto("/dashboard/appointments");
    await skipTourIfPresent(page);
    await expect(page.getByRole("heading", { name: "Calendar" })).toBeVisible();
    await expect(page.getByText("Walk-in / new appointment")).toHaveCount(0);
    await expect(page.getByText("Demo mode")).toBeVisible();
    await page
      .getByRole("button", { name: "Exit Demo" })
      .filter({ visible: true })
      .click();
    await expect(page).toHaveURL(/\/$/);
  });
});
