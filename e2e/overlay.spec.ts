import { expect, test } from "@playwright/test";

test("TopBar overlays are mutually exclusive and Esc closes the active overlay", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("button", { name: /new game/i }).click();
  await expect(page.locator("svg.region-map")).toBeVisible();

  await page.getByRole("button", { name: /^Ledger$/ }).click();
  await expect(page.getByRole("dialog", { name: /ledger/i })).toBeVisible();

  // The Price Board hotkey uses the same activeOverlay store field as the
  // buttons, so it replaces Ledger rather than opening above it.
  await page.keyboard.press("b");
  await expect(page.getByRole("dialog", { name: /ledger/i })).not.toBeVisible();
  await expect(page.getByRole("table", { name: "Region price board" })).toBeVisible();

  await page.keyboard.press("Escape");
  await expect(page.getByRole("table", { name: "Region price board" })).not.toBeVisible();
});
