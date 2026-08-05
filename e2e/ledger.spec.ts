import { readFileSync } from 'node:fs';
import { test, expect, type Page } from '@playwright/test';
import { applyCommand, createWorld, type World } from '../src/sim';
import { SAVE_VERSION } from '../src/store/persistence';

/**
 * The Ledger's own overlay ("Księga") was retired 2026-07-30: its content —
 * the company value chart and the transaction log — is now the Siedziba
 * panel's default `Wartość firmy` tab, reached behind a Headquarters
 * (`HeadquartersPanel` renders nothing without `world.company.headquarters`),
 * with a `Wykres`/`Transakcje` toggle standing where the old tab pair used to.
 * See docs/specs/E16-workbench.md §Visual contract, points 3-6.
 */

const AUTOSAVE_KEY = 'etersim.autosave';

async function startNewGame(page: Page) {
  await page.goto('/');
  await page.getByRole('button', { name: /nowa gra/i }).click();
  await expect(page.locator('svg.region-map')).toBeVisible();
}

/** Buys `qty` grain at the Controlled Ship's docked port market — cheap,
 *  always tradable, and the fastest way to put a `trade` Ledger event on
 *  the books. Assumes the market panel for that port is already open. */
async function buyGrain(page: Page, qty: number) {
  const grainRow = page.locator('.market-row').filter({ hasText: 'Zboże' });
  await grainRow.getByRole('spinbutton', { name: /zboże ilość/i }).fill(String(qty));
  await grainRow.getByRole('button', { name: 'Kup: Zboże', exact: true }).click();
}

function escapeRegExp(text: string): string {
  return text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/** Opens the named port's market panel via the map (#33: port selection is
 *  the only market path). Exact match on the label — two procedurally
 *  generated port names could otherwise collide as substrings. */
async function openMarket(page: Page, portName: string) {
  const exact = new RegExp(`^${escapeRegExp(portName)}$`);
  await page
    .locator('g.port')
    .filter({ has: page.locator('.port__label', { hasText: exact }) })
    .click({ force: true });
  await expect(page.locator('.market')).toBeVisible();
}

/** The Controlled Ship's docked port at World creation (always true right
 *  after createWorld). */
function homePort(world: World): { portId: string; name: string } {
  const location = world.company.ships[0].location;
  if (location.kind !== 'docked') throw new Error('ship not docked in a freshly created World');
  const port = world.region.ports.find((p) => p.id === location.portId)!;
  return { portId: port.id, name: port.name };
}

/** A funded World with a generous default purse override, so founding is
 *  always affordable within a test's time budget. */
function fundedWorld(seed: string, thalers = 100_000): World {
  const w = createWorld(seed);
  return { ...w, company: { ...w.company, thalers } };
}

/** A funded, already-founded World: most of this file's tests need the
 *  Siedziba panel reachable but aren't themselves testing the founding flow
 *  (that's the dedicated first test below), so they inject a Headquarters
 *  directly via `applyCommand` — same pattern e2e/_proto-shot.spec.ts used —
 *  rather than driving the UI through it every time. Founded at the ship's
 *  own home port, so nothing sails and no `dockingFee` event lands in the
 *  Ledger unasked for. */
function foundedWorld(seed: string, thalers = 100_000): World {
  const funded = fundedWorld(seed, thalers);
  const { portId } = homePort(funded);
  return applyCommand(funded, { kind: 'foundHeadquarters', portId });
}

function saveJson(world: World): string {
  return JSON.stringify({ version: SAVE_VERSION, world });
}

/** Seeds the autosave slot before the app boots, then loads it via the
 *  StartScreen's real Continue button (never bypasses the store's own
 *  load path). */
async function continueWithWorld(page: Page, world: World) {
  await page.addInitScript(
    ({ key, json }) => {
      window.localStorage.setItem(key, json);
    },
    { key: AUTOSAVE_KEY, json: saveJson(world) },
  );
  await page.goto('/');
  await page.getByRole('button', { name: /kontynuuj/i }).click();
  await expect(page.locator('svg.region-map')).toBeVisible();
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
 * non-trivial data to assert on. Under the daily roll-up (owner directive
 * 2026-07-30, point 7) the 11 transaction events fold into exactly 2 world
 * days: Day 1 (the tick-0 trade alone) and Day 6 (everything at tick 128-129
 * — the sail, the founding, the build and the launch).
 */
async function importLedgerScenario(page: Page) {
  await startNewGame(page);
  const json = readFileSync('./e2e/fixtures/ledger-scenario.json', 'utf-8');
  await page.locator('input[aria-label="Importuj plik zapisu"]').setInputFiles({
    name: 'ledger-scenario.json',
    mimeType: 'application/json',
    buffer: Buffer.from(json),
  });
}

test.describe('Siedziba — Wartość firmy tab (#86, relocated 2026-07-30)', () => {
  test('founding targets the selected port: the top-bar button is disabled with no selection, then opens Siedziba on Wartość firmy', async ({
    page,
  }) => {
    await continueWithWorld(page, fundedWorld('ledger-founding-flow'));

    const foundBtn = page.getByRole('button', { name: /Załóż siedzibę/ });
    // Adversarial: with no port selected, the button must be disabled and
    // explain why — proves the target really is the current selection
    // (owner directive 2026-07-30, points 1-2), not a fixed/default port a
    // happy-path click could pass against by accident.
    await expect(foundBtn).toBeDisabled();
    await expect(foundBtn).toHaveAttribute('title', /wybierz port/);

    await page.locator('g.port').first().click({ force: true });
    await expect(foundBtn).toBeEnabled();
    await foundBtn.click();

    await expect(foundBtn).toHaveCount(0);
    await page.getByRole('button', { name: /^Siedziba$/ }).click();
    const dialog = page.getByRole('dialog', { name: /siedziba/i });
    await expect(dialog).toBeVisible();
    await expect(dialog.getByRole('tab', { name: 'Wartość firmy' })).toHaveAttribute(
      'aria-selected',
      'true',
    );
    await expect(dialog.getByRole('button', { name: 'Wykres' })).toBeVisible();
    await expect(dialog.getByRole('button', { name: 'Transakcje' })).toBeVisible();

    await dialog.getByRole('button', { name: /zamknij/i }).click();
    await expect(dialog).not.toBeVisible();
  });

  test('ship-filtered transactions list multiple events newest-first', async ({ page }) => {
    const world = foundedWorld('ledger-multi-trade');
    const { name } = homePort(world);
    await continueWithWorld(page, world);
    await openMarket(page, name);
    await buyGrain(page, 5);
    await buyGrain(page, 3);

    await page.getByRole('button', { name: /^Siedziba$/ }).click();
    const dialog = page.getByRole('dialog', { name: /siedziba/i });
    await dialog.getByRole('button', { name: 'Transakcje' }).click();

    // Both buys land on the same world day — under "Wszystkie statki" they
    // would fold into a single saldo-dnia row (owner directive 2026-07-30,
    // point 7), which would prove nothing about ordering. A ship filter is
    // what keeps row-per-event detail, so it's applied first — the trap
    // this package names: asserting this on the day row instead would
    // silently stop testing the thing this test was written for.
    await dialog.locator('#ledger-ship-filter').selectOption({ value: 's0' });

    const rows = dialog.locator('.ledger-list__row');
    // Two distinct trades — the more recent (qty 3) must render above the
    // older one (qty 5), proving actual chronological ordering rather than
    // trivially passing with a single row.
    await expect(rows).toHaveCount(2);
    await expect(rows.nth(0).locator('.ledger-list__desc')).toContainText('Kupiono: Zboże ×3');
    await expect(rows.nth(1).locator('.ledger-list__desc')).toContainText('Kupiono: Zboże ×5');
  });

  test("ship filter keeps only the selected ship's events, across every shipId-carrying kind", async ({
    page,
  }) => {
    await importLedgerScenario(page);

    await page.getByRole('button', { name: /^Siedziba$/ }).click();
    const dialog = page.getByRole('dialog', { name: /siedziba/i });
    await dialog.getByRole('button', { name: 'Transakcje' }).click();
    const rows = dialog.locator('.ledger-list__row');

    // All ships (default filter): the daily roll-up folds the fixture's 11
    // raw events into 2 world-day rows — the exact deltas are pinned by the
    // dedicated daily-shape test below; this one only checks the shape
    // doesn't leak into the ship-filtered assertions that follow.
    await expect(rows).toHaveCount(2);

    const filter = dialog.locator('#ledger-ship-filter');

    // s1 (the launched ship) only appears in its own launch event — per-event
    // detail survives under a ship filter (owner directive 2026-07-30, point
    // 7 — "the per-ship log is unchanged").
    await filter.selectOption({ value: 's1' });
    await expect(rows).toHaveCount(1);
    await expect(rows.first().locator('.ledger-list__desc')).toContainText('Zwodowano');

    // s0 (the original ship) appears in its trade, its dockingFee (sailing
    // to found the Headquarters elsewhere) and its delivery — three
    // shipId-carrying kinds, newest first. founding/laborFee/rush are
    // company-wide and must not leak in under either ship filter.
    await filter.selectOption({ value: 's0' });
    await expect(rows).toHaveCount(3);
    await expect(rows.nth(0).locator('.ledger-list__desc')).toContainText('Dostarczono');
    await expect(rows.nth(1).locator('.ledger-list__desc')).toContainText('Opłata dokowa');
    await expect(rows.nth(2).locator('.ledger-list__desc')).toContainText('Kupiono: Zboże ×5');

    await filter.selectOption({ value: 'all' });
    await expect(rows).toHaveCount(2);
  });

  test('the all-ships log reads one row per world day, carrying the net thaler delta (owner directive 2026-07-30, point 7)', async ({
    page,
  }) => {
    await importLedgerScenario(page);

    await page.getByRole('button', { name: /^Siedziba$/ }).click();
    const dialog = page.getByRole('dialog', { name: /siedziba/i });
    await dialog.getByRole('button', { name: 'Transakcje' }).click();

    const rows = dialog.locator('.ledger-list__row');
    // 11 raw transaction events fold into exactly 2 world-day rows — tick 0
    // (Day 1) and ticks 128-129 (Day 6) are the only ticks any transaction
    // fires at in this fixture — newest day first.
    await expect(rows).toHaveCount(2);

    await expect(rows.nth(0).locator('.ledger-list__date')).toHaveText('Dzień 6');
    await expect(rows.nth(0).locator('.ledger-list__desc')).toHaveText('saldo dnia');
    // dockingFee(-20) + founding(-2500) + laborFee(-800) + rush×5(-2511-729
    // -1984-982-4050) = -13576; delivery/launch are goods-only and
    // contribute 0 — cross-checked independently against the fixture's own
    // netWorth snapshots: thalers went from ₸19,935 (tick 120) to ₸6,359
    // (tick 144), and 19935 − 13576 = 6359.
    await expect(rows.nth(0).locator('.ledger-list__delta')).toHaveText('−₸13576');

    await expect(rows.nth(1).locator('.ledger-list__date')).toHaveText('Dzień 1');
    await expect(rows.nth(1).locator('.ledger-list__desc')).toHaveText('saldo dnia');
    // The single tick-0 trade: buy 5 grain @ ₸65.
    await expect(rows.nth(1).locator('.ledger-list__delta')).toHaveText('−₸65');
  });

  test('company value chart plots the deterministic snapshot series, with a founding/build dip', async ({
    page,
  }) => {
    await importLedgerScenario(page);

    await page.getByRole('button', { name: /^Siedziba$/ }).click();
    const dialog = page.getByRole('dialog', { name: /siedziba/i });
    // Wartość firmy is the panel's default tab and its default lens is the
    // chart, so both are already showing — nothing else to select.
    await expect(dialog.getByRole('tab', { name: 'Wartość firmy' })).toHaveAttribute(
      'aria-selected',
      'true',
    );

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

    // The headline now reads above the chart (owner directive 2026-07-30,
    // point 5.1) — `.company-value__total`, not the generic `.overlay__text`
    // the old caption-under-the-chart layout used.
    await expect(dialog.locator('.company-value__total')).toContainText('₸6359');
  });

  test('company value chart starts empty and gains points as world days pass (live)', async ({
    page,
  }) => {
    await continueWithWorld(page, foundedWorld('ledger-chart-live'));

    await page.getByRole('button', { name: /^Siedziba$/ }).click();
    const dialog = page.getByRole('dialog', { name: /siedziba/i });
    // Day 1, before any day boundary — no netWorth snapshot exists yet.
    await expect(dialog.locator('.ledger-chart__point')).toHaveCount(0);
    await dialog.getByRole('button', { name: /zamknij/i }).click();

    await page.getByRole('button', { name: '100x' }).click();
    await expect
      .poll(async () => page.locator('.top-bar__date').innerText(), { timeout: 15000 })
      .toMatch(/Day [4-9]|Day \d{2,}/);
    await page.getByRole('button', { name: '⏸' }).click();

    await page.getByRole('button', { name: /^Siedziba$/ }).click();
    await expect(dialog.locator('.ledger-chart__point').first()).toBeVisible();
  });

  test('clicking the backdrop closes the overlay; clicking inside the panel does not (#126)', async ({
    page,
  }) => {
    await continueWithWorld(page, foundedWorld('ledger-dismiss-backdrop'));

    await page.getByRole('button', { name: /^Siedziba$/ }).click();
    const dialog = page.getByRole('dialog', { name: /siedziba/i });
    await expect(dialog).toBeVisible();

    // `dialog` is the `.overlay` backdrop itself (role="dialog" sits on the
    // outer div); a position near its corner lands outside the centered
    // `.overlay__panel`, unlike a plain .click() which hits the panel.
    await dialog.locator('.overlay__title').click();
    await expect(dialog).toBeVisible();

    await dialog.click({ position: { x: 5, y: 5 } });
    await expect(dialog).not.toBeVisible();
  });

  test('Esc closes the overlay (#126)', async ({ page }) => {
    await continueWithWorld(page, foundedWorld('ledger-dismiss-esc'));

    await page.getByRole('button', { name: /^Siedziba$/ }).click();
    const dialog = page.getByRole('dialog', { name: /siedziba/i });
    await expect(dialog).toBeVisible();

    await page.keyboard.press('Escape');
    await expect(dialog).not.toBeVisible();
  });
});
