import { expect, type Page } from "@playwright/test";

/** Next.js App Router `notFound()` UI — status may be 200 under `next start`. */
export async function expectNotFoundPage(page: Page) {
  await expect(
    page.getByRole("heading", { name: "This page doesn't exist" }),
  ).toBeVisible();
  await expect(page.getByText("Not found", { exact: true })).toBeVisible();
  await expect(page.getByRole("link", { name: "Go home" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "500" })).toHaveCount(0);
  await expect(page.getByText("Internal Server Error.")).toHaveCount(0);
}
