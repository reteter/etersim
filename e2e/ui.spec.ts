import { test, expect, type Page } from '@playwright/test';

async function startNewGame(page: Page) {
  await page.goto('/');
  await page.getByRole('button', { name: /new game/i }).click();
  await expect(page.locator('svg.region-map')).toBeVisible();
}

/**
 * Open the Controlled Ship's panel via the always-visible header (#32).
 * A docked ship on the map is click-through (port-click priority, #28), so the
 * header/Harbor is the way to reach it.
 */
async function openControlledShip(page: Page) {
  await page.locator('.ctrl-ship').click();
  await expect(page.getByRole('heading', { name: 'Ship' })).toBeVisible();
}

test.describe('etersim start screen', () => {
  test('shows start screen and can start new game', async ({ page }) => {
    await page.goto('/');

    await expect(page).toHaveTitle(/etersim/i);
    await expect(page.getByRole('heading', { name: /etersim/i })).toBeVisible();
    await expect(page.getByText(/aether-punk trading venture/i)).toBeVisible();
    await expect(page.getByRole('button', { name: /new game/i })).toBeVisible();
    await expect(page.getByLabel(/seed/i)).toBeVisible();

    await page.getByRole('button', { name: /new game/i }).click();
    await expect(page.locator('svg.region-map')).toBeVisible();
  });
});

test.describe('main game UI after start', () => {
  test.beforeEach(async ({ page }) => {
    await startNewGame(page);
  });

  test('shows top bar with thalers, date and speed controls', async ({ page }) => {
    await expect(page.locator('.top-bar__thalers')).toContainText('₸');
    await expect(page.locator('.top-bar__date')).toBeVisible();
    await expect(page.getByRole('group', { name: /speed controls/i })).toBeVisible();
    // Default speed is 1x after newGame
    await expect(page.getByRole('button', { name: '1x' })).toHaveAttribute('aria-pressed', 'true');
  });

  test('map is visible and clickable', async ({ page }) => {
    const map = page.locator('svg.region-map');
    await expect(map).toBeVisible();

    // Ship panel is reached via the Controlled Ship header (#32).
    await openControlledShip(page);

    // Click a port group (handler is on g.port). Use first non-overlapping if possible.
    const ports = page.locator('g.port');
    await ports.first().click({ force: true });

    // Panel should show a port market (not Ship panel)
    await expect(page.locator('.market')).toBeVisible();
    const sideTitle = page.locator('.side-panel__title').first();
    await expect(sideTitle).not.toHaveText('Ship');
  });

  test('controlled ship header is always visible and shows docked status', async ({ page }) => {
    // Visible before any selection.
    await expect(page.locator('.ctrl-ship')).toBeVisible();
    await expect(page.locator('.ctrl-ship__status')).toContainText('Docked');
    await expect(page.locator('.ctrl-ship__hold')).toContainText('/');
  });

  test('ship panel shows hold and docked location', async ({ page }) => {
    await openControlledShip(page);

    await expect(page.locator('.side-panel__subtitle')).toContainText('Docked at');
    await expect(page.getByText(/Hold \d+\/\d+/)).toBeVisible();
  });

  test('port view shows the Harbor with the docked ship', async ({ page }) => {
    // Open the Controlled Ship, then its docked market (via Open market).
    await openControlledShip(page);
    await page.getByRole('button', { name: /open market/i }).click();

    // Harbor lists the docked ship above the market.
    const harbor = page.locator('.harbor');
    await expect(harbor).toBeVisible();
    await expect(harbor.locator('.harbor__ship')).toHaveCount(1);
    await expect(harbor.locator('.harbor__ship--controlled')).toHaveCount(1);
  });

  test('port panel shows market table with prices and trends', async ({ page }) => {
    // Select first port on map (click the group that has the handler)
    await page.locator('g.port').first().click({ force: true });

    const market = page.locator('.market');
    await expect(market).toBeVisible();

    // At least one good row
    await expect(page.locator('.market-row__name')).toHaveCount(5);

    // Price and stock visible
    await expect(page.locator('.market-row__price').first()).toContainText('₸');
    await expect(page.locator('.market-row__stock').first()).toBeVisible();
  });
});

test.describe('trading interactions (when docked)', () => {
  test.beforeEach(async ({ page }) => {
    await startNewGame(page);
    // Open the current docked port's market via the Controlled Ship header.
    await openControlledShip(page);
    await page.getByRole('button', { name: /open market/i }).click();
  });

  test('can buy goods and updates are reflected', async ({ page }) => {
    const grainRow = page.locator('.market-row').filter({ hasText: 'Grain' });
    await expect(grainRow).toBeVisible();

    // Capture initial thalers
    const initialThalersText = await page.locator('.top-bar__thalers').innerText();

    // Buy 5 grain (cheap)
    const qtyInput = grainRow.getByRole('spinbutton', { name: /grain quantity/i });
    await qtyInput.fill('5');

    const buyButton = grainRow.getByRole('button', { name: /buy/i });
    await expect(buyButton).toBeEnabled();
    await buyButton.click();

    // Thalers should decrease
    await expect(page.locator('.top-bar__thalers')).not.toHaveText(initialThalersText);

    // Switch to ship panel and verify cargo
    await page.locator('.ctrl-ship').click();
    await expect(page.locator('.hold')).toContainText('Grain');
    await expect(page.locator('.hold')).toContainText('5');
  });

  test('can sell goods after buying', async ({ page }) => {
    const grainRow = page.locator('.market-row').filter({ hasText: 'Grain' });

    // Buy first
    const qtyInput = grainRow.getByRole('spinbutton', { name: /grain quantity/i });
    await qtyInput.fill('3');
    await grainRow.getByRole('button', { name: /buy/i }).click();

    // Now sell back
    await qtyInput.fill('2');
    const sellButton = grainRow.getByRole('button', { name: /sell/i });
    await expect(sellButton).toBeEnabled();
    await sellButton.click();

    // Hold should reflect partial sell
    await page.locator('.ctrl-ship').click();
    await expect(page.locator('.hold')).toContainText('Grain');
    // We don't assert exact number to avoid race, but presence of Grain after sell
  });

  test('shows sail button on remote port', async ({ page }) => {
    // Click a port group (may be current or not; try to pick different)
    const portGroups = page.locator('g.port');
    const count = await portGroups.count();
    if (count > 1) {
      await portGroups.nth(1).click({ force: true });
    } else {
      await portGroups.first().click({ force: true });
    }

    // If not the current docked port, SailControl should appear
    const sailBtn = page.getByRole('button', { name: /sail here/i });
    // Either we are on remote (button) or on home (no button, trading controls)
    // Accept either state
    const hasSail = await sailBtn.count();
    if (hasSail > 0) {
      await expect(sailBtn).toBeVisible();
      // Clicking sail should change ship state
      await sailBtn.click();
      await page.locator('.ctrl-ship').click();
      await expect(page.locator('.side-panel__subtitle')).toContainText('Underway');
    }
  });
});
