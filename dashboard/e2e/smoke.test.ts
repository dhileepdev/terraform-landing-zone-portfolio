import { test, expect } from "@playwright/test";

test("renders pipeline, drift, and cost cards", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByRole("heading", { name: "Pipeline" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Drift" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Cloud Cost" })).toBeVisible();
});
