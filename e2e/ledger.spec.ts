import { readFileSync } from 'node:fs';
import { test, expect, type Page } from '@playwright/test';

async function startNewGame(page: Page) {
  await page.goto('/');
  await page.getByRole('button', { name: /new game/i }).click();
  await expect(page.locator('svg.region-map')).toBeVisible();
}

/** Buys `qty` grain at the Controlled Ship's docked port market — cheap,
 *  always tradable, and the fastest way to put a `trade` Ledger event on
 *  the books. Assumes the market panel for that port is already open. */
async function buyGrain(page: Page, qty: number) {
  const grainRow = page.locator('.market-row').filter({ hasText: 'Grain' });
  await grainRow.getByRole('spinbutton', { name: /grain quantity/i }).fill(String(qty));
  await grainRow.getByRole('button', { name: 'Buy Grain', exact: true }).click();
}

/** Opens the docked port's market for the Controlled Ship (mirrors the
 *  helper in e2e/ui.spec.ts). */
async function openDockedPortMarket(page: Page) {
  await page.locator('.fleet-list__item--controlled').click();
  await expect(page.getByRole('heading', { name: 'Ship' })).toBeVisible();
  const subtitle = await page.locator('.side-panel__subtitle').innerText();
  const portName = subtitle.replace(/^Docked at /i, '');
  const exact = new RegExp(`^${portName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`);
  await page
    .locator('g.port')
    .filter({ has: page.locator('.port__label', { hasText: exact }) })
    .click({ force: true });
  await expect(page.locator('.market')).toBeVisible();
}

/**
 * Imports the scripted save fixture (seed 1, `src/sim` commands only — see
 * the generating script in this PR's history for reproduction). Timeline:
 *   1. ship `s0` buys 5 grain (`trade`, shipId s0)
 *   2. 3 quiet baseline days (3 `netWorth` snapshots, ~₸20,000 flat)
 *   3. `s0` sails to a second port and docks there (`dockingFee`, shipId s0)
 *   4. Headquarters founded at that port (`founding`, company-wide)
 *   5. build order placed (`laborFee`, company-wide)
 *   6. `s0`'s 5 grain hand-delivered to the build site (`delivery`, shipId s0)
 *   7. `rushBuild` completes the recipe (5× `rush`, company-wide) and launches
 *      ship `s1` "Lumen Trader" (`launch`, shipId s1)
 *   8. 5 more quiet days
 * 11 transaction events (3 tagged s0, 1 tagged s1, 7 company-wide with no
 * shipId) and 11 netWorth snapshots, dipping from ₸20,013 (tick 120, last
 * pre-founding snapshot) to ₸6,359 (tick 144, first post-build snapshot)
 * then flat — covers every shipId-carrying kind (trade, dockingFee,
 * delivery, launch) and gives the ship filter and the chart's dip real,
 * non-trivial data to assert on.
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

  test('transactions tab lists multiple events newest-first', async ({ page }) => {
    await startNewGame(page);
    await openDockedPortMarket(page);
    await buyGrain(page, 5);
    await buyGrain(page, 3);

    await page.getByRole('button', { name: /^Ledger$/ }).click();
    const dialog = page.getByRole('dialog', { name: /ledger/i });
    const rows = dialog.locator('.ledger-list__row');

    // Two distinct trades — the more recent (qty 3) must render above the
    // older one (qty 5), proving actual chronological ordering rather than
    // trivially passing with a single row.
    await expect(rows).toHaveCount(2);
    await expect(rows.nth(0).locator('.ledger-list__desc')).toContainText('Bought 3 Grain');
    await expect(rows.nth(1).locator('.ledger-list__desc')).toContainText('Bought 5 Grain');
  });

  test('ship filter keeps only the selected ship\'s events, across every shipId-carrying kind', async ({
    page,
  }) => {
    await importLedgerScenario(page);

    await page.getByRole('button', { name: /^Ledger$/ }).click();
    const dialog = page.getByRole('dialog', { name: /ledger/i });
    const rows = dialog.locator('.ledger-list__row');

    // All ships: every event from the fixture (see importLedgerScenario),
    // newest first — the launch is last in insertion order, so it's the top
    // row.
    await expect(rows).toHaveCount(11);
    await expect(rows.first().locator('.ledger-list__desc')).toContainText('Launched');

    const filter = dialog.locator('#ledger-ship-filter');

    // s1 (the launched ship) only appears in its own launch event.
    await filter.selectOption({ label: 'Lumen Trader' });
    await expect(rows).toHaveCount(1);
    await expect(rows.first().locator('.ledger-list__desc')).toContainText('Launched');

    // s0 (the original ship) appears in its trade, its dockingFee (sailing
    // to found the Headquarters elsewhere) and its delivery — three
    // shipId-carrying kinds, newest first. founding/laborFee/rush are
    // company-wide and must not leak in under either ship filter.
    await filter.selectOption({ label: 's0' });
    await expect(rows).toHaveCount(3);
    await expect(rows.nth(0).locator('.ledger-list__desc')).toContainText('Delivered');
    await expect(rows.nth(1).locator('.ledger-list__desc')).toContainText('Docking fee');
    await expect(rows.nth(2).locator('.ledger-list__desc')).toContainText('Bought 5 Grain');

    await filter.selectOption({ value: 'all' });
    await expect(rows).toHaveCount(11);
  });

  test('company value chart plots the deterministic snapshot series, with a founding/build dip', async ({
    page,
  }) => {
    await importLedgerScenario(page);

    await page.getByRole('button', { name: /^Ledger$/ }).click();
    const dialog = page.getByRole('dialog', { name: /ledger/i });
    await dialog.getByRole('tab', { name: 'Wartość firmy' }).click();

    const chart = dialog.locator('svg.ledger-chart');
    await expect(chart).toBeVisible();

    // Pins the plotted series itself, not just "some points exist" — the
    // fixture has exactly 11 daily netWorth snapshots.
    const points = chart.locator('.ledger-chart__point');
    await expect(points).toHaveCount(11);

    // AC: "builds/foundings read as dips on the curve" — pinned by e2e
    // instead of a screenshot. Point index 4 (tick 120) is the last
    // pre-founding snapshot (₸20,013); index 5 (tick 144) is the first
    // snapshot after founding + placeBuildOrder + rushBuild + launch
    // (₸6,359) — a real, asserted drop, not an inferred one.
    const titles = await points.locator('title').allTextContents();
    expect(titles[4]).toContain('₸20013');
    expect(titles[5]).toContain('₸6359');
    const preFounding = Number(/₸(\d+)/.exec(titles[4])![1]);
    const postBuild = Number(/₸(\d+)/.exec(titles[5])![1]);
    expect(postBuild).toBeLessThan(preFounding);

    await expect(dialog.locator('.overlay__text')).toContainText('₸6359');
  });

  test('company value chart starts empty and gains points as world days pass (live)', async ({
    page,
  }) => {
    await startNewGame(page);

    await page.getByRole('button', { name: /^Ledger$/ }).click();
    const dialog = page.getByRole('dialog', { name: /ledger/i });
    await dialog.getByRole('tab', { name: 'Wartość firmy' }).click();
    // Day 1, before any day boundary — no netWorth snapshot exists yet.
    await expect(dialog.locator('.ledger-chart__point')).toHaveCount(0);
    await dialog.getByRole('button', { name: /close/i }).click();

    await page.getByRole('button', { name: '100x' }).click();
    await expect
      .poll(async () => page.locator('.top-bar__date').innerText(), { timeout: 15000 })
      .toMatch(/Day [4-9]|Day \d{2,}/);
    await page.getByRole('button', { name: '⏸' }).click();

    await page.getByRole('button', { name: /^Ledger$/ }).click();
    await dialog.getByRole('tab', { name: 'Wartość firmy' }).click();
    await expect(dialog.locator('.ledger-chart__point').first()).toBeVisible();
  });
});
