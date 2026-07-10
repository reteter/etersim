import { readFileSync } from 'node:fs';
import { test, expect, type Page } from '@playwright/test';

async function startNewGame(page: Page) {
  await page.goto('/');
  await page.getByRole('button', { name: /new game/i }).click();
  await expect(page.locator('svg.region-map')).toBeVisible();
}

/**
 * Open the docked port's market for the Controlled Ship (mirrors the helper
 * in e2e/ui.spec.ts) and buy a small amount of grain — cheap, always
 * tradable, and the fastest way to put a `trade` Ledger event on the books.
 */
async function buySomeGrain(page: Page) {
  await page.locator('.ctrl-ship').click();
  await expect(page.getByRole('heading', { name: 'Ship' })).toBeVisible();
  const subtitle = await page.locator('.side-panel__subtitle').innerText();
  const portName = subtitle.replace(/^Docked at /i, '');
  const exact = new RegExp(`^${portName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`);
  await page
    .locator('g.port')
    .filter({ has: page.locator('.port__label', { hasText: exact }) })
    .click({ force: true });
  await expect(page.locator('.market')).toBeVisible();

  const grainRow = page.locator('.market-row').filter({ hasText: 'Grain' });
  await grainRow.getByRole('spinbutton', { name: /grain quantity/i }).fill('5');
  await grainRow.getByRole('button', { name: 'Buy Grain', exact: true }).click();
}

/**
 * Imports the scripted save fixture (seed 1, `src/sim` commands only — see
 * the fixture's own history in git for the generating script): ship `s0`
 * buys grain (one `trade` event tagged with `s0`), then a Headquarters is
 * founded and a hull built via `rushBuild` (company-wide `founding`,
 * `laborFee`, five `rush` events — no `shipId`), launching ship `s1` (one
 * `launch` event tagged with `s1`). Nine transaction events total, split
 * 1 / 1 / 7 across s0 / s1 / company-wide — enough to make the ship filter's
 * *count* assertion meaningful (it would fail if the filter matched on the
 * wrong field or was a no-op).
 */
async function importLedgerScenario(page: Page) {
  await startNewGame(page);
  const json = readFileSync('./e2e/fixtures/ledger-scenario.json', 'utf-8');
  await page.locator('input[aria-label="Import save file"]').setInputFiles({
    name: 'ledger-scenario.json',
    mimeType: 'application/json',
    buffer: Buffer.from(json),
  });
}

test.describe('Ledger overlay (#86)', () => {
  test('opens from the TopBar', async ({ page }) => {
    await startNewGame(page);

    await page.getByRole('button', { name: /^Ledger$/ }).click();
    const dialog = page.getByRole('dialog', { name: /ledger/i });
    await expect(dialog).toBeVisible();
    await expect(dialog.getByRole('tab', { name: 'Transakcje' })).toBeVisible();
    await expect(dialog.getByRole('tab', { name: 'Wartość firmy' })).toBeVisible();

    await dialog.getByRole('button', { name: /close/i }).click();
    await expect(dialog).not.toBeVisible();
  });

  test('transactions tab lists events newest-first', async ({ page }) => {
    await startNewGame(page);
    await buySomeGrain(page);

    await page.getByRole('button', { name: /^Ledger$/ }).click();
    const dialog = page.getByRole('dialog', { name: /ledger/i });
    await expect(dialog).toBeVisible();

    // Transakcje is the default tab. The manual buy is the only transaction
    // so far — it must be the (newest) first row.
    const rows = dialog.locator('.ledger-list__row');
    await expect(rows.first()).toBeVisible();
    await expect(rows.first().locator('.ledger-list__desc')).toContainText(/Bought \d+ Grain/);
  });

  test('ship filter drops company-wide events and keeps only the selected ship\'s', async ({
    page,
  }) => {
    await importLedgerScenario(page);

    await page.getByRole('button', { name: /^Ledger$/ }).click();
    const dialog = page.getByRole('dialog', { name: /ledger/i });
    const rows = dialog.locator('.ledger-list__row');

    // All ships: every event from the fixture (1 trade + founding + labor
    // fee + 5 rush buys + 1 launch = 9), newest first — the launch is last
    // in tick order, so it's the top row.
    await expect(rows).toHaveCount(9);
    await expect(rows.first().locator('.ledger-list__desc')).toContainText('Launched');

    const filter = dialog.locator('#ledger-ship-filter');

    // s1 (the launched ship) only appears in its own launch event.
    await filter.selectOption({ label: 'Lumen Trader' });
    await expect(rows).toHaveCount(1);
    await expect(rows.first().locator('.ledger-list__desc')).toContainText('Launched');

    // s0 (the original ship) only appears in the manual grain trade —
    // founding/laborFee/rush are company-wide and must not leak in under
    // either ship filter.
    await filter.selectOption({ label: 's0' });
    await expect(rows).toHaveCount(1);
    await expect(rows.first().locator('.ledger-list__desc')).toContainText('Bought 5 Grain');

    await filter.selectOption({ value: 'all' });
    await expect(rows).toHaveCount(9);
  });

  test('company value chart renders points after several world days', async ({ page }) => {
    await startNewGame(page);

    await page.getByRole('button', { name: '100x' }).click();
    await expect
      .poll(async () => page.locator('.top-bar__date').innerText(), { timeout: 15000 })
      .toMatch(/Day [4-9]|Day \d{2,}/);
    await page.getByRole('button', { name: '⏸' }).click();

    await page.getByRole('button', { name: /^Ledger$/ }).click();
    const dialog = page.getByRole('dialog', { name: /ledger/i });
    await dialog.getByRole('tab', { name: 'Wartość firmy' }).click();

    const chart = dialog.locator('svg.ledger-chart');
    await expect(chart).toBeVisible();
    const points = chart.locator('.ledger-chart__point');
    await expect(points.first()).toBeVisible();
    const count = await points.count();
    expect(count).toBeGreaterThan(0);
  });
});
