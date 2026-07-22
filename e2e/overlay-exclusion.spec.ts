import { test, expect, type Page } from '@playwright/test';

/**
 * Names the #320 delta the characterization net deliberately leaves unpinned:
 * TopBar's overlays (Price Board, Ledger, Headquarters) are mutually exclusive
 * — opening one closes any other, so at most one overlay dialog is ever
 * mounted — and Esc closes whichever overlay is active.
 *
 * RED on the frozen net-baseline (1f33866): there the overlays are independent
 * `useState` booleans in TopBar with nothing preventing them from stacking, so
 * reaching for a second overlay while one is open mounts BOTH dialogs. GREEN
 * once #320 routes all overlays through a single `activeOverlay` field.
 *
 * The second overlay is reached with the "b" hotkey rather than a TopBar button
 * click on purpose: an open overlay is `aria-modal` with a full-screen backdrop
 * over the TopBar, so the buttons behind it are unclickable by construction —
 * only a keyboard route can exercise "open B while A is open" in either the RED
 * (stacks) or the GREEN (replaces) world.
 */
async function startNewGame(page: Page) {
  await page.goto('/');
  await page.getByRole('button', { name: /new game/i }).click();
  await expect(page.locator('svg.region-map')).toBeVisible();
}

test.describe('Overlay mutual exclusion (#320)', () => {
  test('opening a second overlay closes the first — two overlays never stack', async ({ page }) => {
    await startNewGame(page);

    const priceBoard = page.getByRole('dialog', { name: /price board/i });
    const ledger = page.getByRole('dialog', { name: /ledger/i });

    await page.getByRole('button', { name: /^Ledger$/ }).click();
    await expect(ledger).toBeVisible();

    // "b" opens the Price Board. With one shared `activeOverlay` field the
    // Ledger must yield rather than stack; on the baseline both dialogs mount.
    await page.keyboard.press('b');
    await expect(priceBoard).toBeVisible();
    await expect(ledger).not.toBeVisible();
    await expect(page.getByRole('dialog')).toHaveCount(1);
  });

  test('Esc closes the active overlay', async ({ page }) => {
    await startNewGame(page);

    const priceBoard = page.getByRole('dialog', { name: /price board/i });

    await page.getByRole('button', { name: /^Price Board$/ }).click();
    await expect(priceBoard).toBeVisible();

    await page.keyboard.press('Escape');
    await expect(priceBoard).not.toBeVisible();
    await expect(page.getByRole('dialog')).toHaveCount(0);
  });
});
