import { test, expect, type Page } from '@playwright/test';
import { createWorld, GOODS, type Ship, type World } from '../src/sim';
// e2e is allowed to reach past the barrel for a UI/sim-shared computation
// check (unlike src/ui, which must go through '../sim') — see completion
// report deviation note: unitMargin/effectiveBase aren't both in the barrel
// (effectiveBase is; unitMargin isn't) — imported together here for symmetry
// with the test's own expected-margin computation.
import { effectiveBase, unitMargin } from '../src/sim/market';
import { SAVE_VERSION } from '../src/store/persistence';

/**
 * E9.1 wave 2 (#263) UI: qty + Margin Gate inputs in the route editor, the
 * inactive-gate warning, and the Fleet list's "czeka na marżę" indicator.
 * Reuses the save-injection harness pattern from headquarters.spec.ts (a
 * funded World with s0 docked at one end of a lane) since the default
 * starting purse can't found a Headquarters within a test's time budget.
 */

const AUTOSAVE_KEY = 'etersim.autosave';

function fundedWorld(seed: string, thalers = 100_000): World {
  const w = createWorld(seed);
  return { ...w, company: { ...w.company, thalers } };
}

function routeReadyWorld(seed: string): { world: World; a: string; b: string; c: string } {
  const w0 = fundedWorld(seed);
  const lane = [...w0.region.lanes].sort((x, y) => x.voyageTicks - y.voyageTicks)[0];
  const ship: Ship = { ...w0.company.ships[0], location: { kind: 'docked', portId: lane.a } };
  const world: World = { ...w0, company: { ...w0.company, ships: [ship] } };
  const c = world.region.ports.find((p) => p.id !== lane.a && p.id !== lane.b)!.id;
  return { world, a: lane.a, b: lane.b, c };
}

function saveJson(world: World): string {
  return JSON.stringify({ version: SAVE_VERSION, world });
}

async function continueWithWorld(page: Page, world: World) {
  await page.addInitScript(
    ({ key, json }) => {
      window.localStorage.setItem(key, json);
    },
    { key: AUTOSAVE_KEY, json: saveJson(world) },
  );
  await page.goto('/');
  await page.getByRole('button', { name: /continue/i }).click();
  await expect(page.locator('svg.region-map')).toBeVisible();
}

async function openTrasyTab(page: Page) {
  await page.locator('g.port').first().click({ force: true });
  await page.getByRole('button', { name: /Załóż siedzibę/ }).click();
  await page.getByRole('button', { name: /^Headquarters$/ }).click();
  const dialog = page.getByRole('dialog', { name: /headquarters/i });
  await dialog.getByRole('tab', { name: 'Trasy' }).click();
  return dialog;
}

test.describe('Route editor — qty + Margin Gate inputs (#263)', () => {
  test('qty input shows for active buy/sell, not for deliver; minMargin shows only for buy; both persist into the saved route', async ({
    page,
  }) => {
    const { world, a, b } = routeReadyWorld('e91-qty-persist');
    await continueWithWorld(page, world);
    const dialog = await openTrasyTab(page);

    await dialog.getByRole('button', { name: /^New route$/ }).click();
    await dialog.getByRole('button', { name: /^Add stop$/ }).click();
    await dialog.getByRole('button', { name: /^Add stop$/ }).click();
    const stopRows = dialog.locator('.stop-row');
    await stopRows.nth(0).locator('select').selectOption(a);
    await stopRows.nth(1).locator('select').selectOption(b);

    // Stop 1: buy grain, qty = 5, minMargin = 3.
    await stopRows
      .nth(0)
      .getByRole('button', { name: new RegExp(`^${GOODS.grain.name} buy at Stop 1$`) })
      .click();
    const qtyBuy = stopRows.nth(0).getByLabel(`${GOODS.grain.name} qty at Stop 1`);
    const marginInput = stopRows.nth(0).getByLabel(`${GOODS.grain.name} min margin at Stop 1`);
    await expect(qtyBuy).toBeVisible();
    await expect(marginInput).toBeVisible();
    await qtyBuy.fill('5');
    await marginInput.fill('3');

    // Deliver never shows qty — switch the same good's cell to deliver and
    // confirm neither input remains.
    await stopRows
      .nth(0)
      .getByRole('button', { name: new RegExp(`^${GOODS.grain.name} deliver at Stop 1$`) })
      .click();
    await expect(stopRows.nth(0).getByLabel(`${GOODS.grain.name} qty at Stop 1`)).toHaveCount(0);
    await expect(
      stopRows.nth(0).getByLabel(`${GOODS.grain.name} min margin at Stop 1`),
    ).toHaveCount(0);

    // Switch back to buy — a fresh order (qty/minMargin cleared, matching
    // setOrder's replace-not-merge semantics) — then re-set both.
    await stopRows
      .nth(0)
      .getByRole('button', { name: new RegExp(`^${GOODS.grain.name} buy at Stop 1$`) })
      .click();
    await stopRows.nth(0).getByLabel(`${GOODS.grain.name} qty at Stop 1`).fill('5');
    await stopRows.nth(0).getByLabel(`${GOODS.grain.name} min margin at Stop 1`).fill('3');

    // Stop 2: sell grain, qty = 2 — minMargin must never show for sell.
    await stopRows
      .nth(1)
      .getByRole('button', { name: new RegExp(`^${GOODS.grain.name} sell at Stop 2$`) })
      .click();
    const qtySell = stopRows.nth(1).getByLabel(`${GOODS.grain.name} qty at Stop 2`);
    await expect(qtySell).toBeVisible();
    await expect(
      stopRows.nth(1).getByLabel(`${GOODS.grain.name} min margin at Stop 2`),
    ).toHaveCount(0);
    await qtySell.fill('2');

    await dialog.getByRole('button', { name: /^Save route$/ }).click();

    // Re-open the saved Route: qty/minMargin round-tripped through the
    // createRoute Command, not just local editor state.
    await dialog.locator('.route-row').first().getByRole('button', { name: /^Edit$/ }).click();
    const reopenedRows = dialog.locator('.stop-row');
    await expect(reopenedRows.nth(0).getByLabel(`${GOODS.grain.name} qty at Stop 1`)).toHaveValue(
      '5',
    );
    await expect(
      reopenedRows.nth(0).getByLabel(`${GOODS.grain.name} min margin at Stop 1`),
    ).toHaveValue('3');
    await expect(reopenedRows.nth(1).getByLabel(`${GOODS.grain.name} qty at Stop 2`)).toHaveValue(
      '2',
    );
  });

  test('a blank qty (greedy) round-trips as absent — no stray 0/NaN value on reopen', async ({
    page,
  }) => {
    const { world, a, b } = routeReadyWorld('e91-qty-blank');
    await continueWithWorld(page, world);
    const dialog = await openTrasyTab(page);

    await dialog.getByRole('button', { name: /^New route$/ }).click();
    await dialog.getByRole('button', { name: /^Add stop$/ }).click();
    await dialog.getByRole('button', { name: /^Add stop$/ }).click();
    const stopRows = dialog.locator('.stop-row');
    await stopRows.nth(0).locator('select').selectOption(a);
    await stopRows.nth(1).locator('select').selectOption(b);

    await stopRows
      .nth(0)
      .getByRole('button', { name: new RegExp(`^${GOODS.grain.name} buy at Stop 1$`) })
      .click();
    await stopRows
      .nth(1)
      .getByRole('button', { name: new RegExp(`^${GOODS.grain.name} sell at Stop 2$`) })
      .click();
    await dialog.getByRole('button', { name: /^Save route$/ }).click();

    await dialog.locator('.route-row').first().getByRole('button', { name: /^Edit$/ }).click();
    const reopenedRows = dialog.locator('.stop-row');
    await expect(reopenedRows.nth(0).getByLabel(`${GOODS.grain.name} qty at Stop 1`)).toHaveValue(
      '',
    );
    await expect(
      reopenedRows.nth(0).getByLabel(`${GOODS.grain.name} min margin at Stop 1`),
    ).toHaveValue('');
  });

  test('inactive-gate warning: shows when the buy has no sell-stop for the good anywhere on the route, clears once one exists', async ({
    page,
  }) => {
    const { world, a, b } = routeReadyWorld('e91-gate-warning');
    await continueWithWorld(page, world);
    const dialog = await openTrasyTab(page);

    await dialog.getByRole('button', { name: /^New route$/ }).click();
    await dialog.getByRole('button', { name: /^Add stop$/ }).click();
    await dialog.getByRole('button', { name: /^Add stop$/ }).click();
    const stopRows = dialog.locator('.stop-row');
    await stopRows.nth(0).locator('select').selectOption(a);
    await stopRows.nth(1).locator('select').selectOption(b);

    // Stop 1: buy grain + minMargin, Stop 2: deliver grain (never a
    // reference — no sell anywhere on the route) ⇒ gate inactive.
    await stopRows
      .nth(0)
      .getByRole('button', { name: new RegExp(`^${GOODS.grain.name} buy at Stop 1$`) })
      .click();
    await stopRows.nth(0).getByLabel(`${GOODS.grain.name} min margin at Stop 1`).fill('3');
    await stopRows
      .nth(1)
      .getByRole('button', { name: new RegExp(`^${GOODS.grain.name} deliver at Stop 2$`) })
      .click();

    const warning = stopRows.nth(0).locator('.stop-row__gate-warning');
    await expect(warning).toBeVisible();
    await expect(warning).toContainText(/brak przystanku sprzedaży/i);

    // Add a sell-stop for the same good elsewhere on the route — the warning
    // must clear (resolveReferencePort now resolves).
    await stopRows
      .nth(1)
      .getByRole('button', { name: new RegExp(`^${GOODS.grain.name} sell at Stop 2$`) })
      .click();
    await expect(warning).toHaveCount(0);
  });
});

test.describe('Fleet list — "czeka na marżę" indicator (#263)', () => {
  test('a waiting ship shows the live margin, derived via the shared sim functions', async ({
    page,
  }) => {
    const { world, a, b } = routeReadyWorld('e91-waiting-fleet');
    const minMargin = 1; // low bar: any positive spread clears it, keeps the seed non-brittle
    const route = {
      id: 'e91-route',
      name: 'Margin Gate Loop',
      stops: [
        { portId: a, orders: [{ kind: 'buy' as const, good: 'grain' as const, minMargin }] },
        { portId: b, orders: [{ kind: 'sell' as const, good: 'grain' as const }] },
      ],
    };
    const waitingShip: Ship = {
      ...world.company.ships[0],
      location: { kind: 'docked', portId: a },
      assignment: { routeId: route.id, nextStopIndex: 0, suspended: false, waiting: true },
    };
    const waitingWorld: World = {
      ...world,
      company: { ...world.company, ships: [waitingShip], routes: [route] },
    };

    const portA = waitingWorld.region.ports.find((p) => p.id === a)!;
    const portB = waitingWorld.region.ports.find((p) => p.id === b)!;
    const expectedMargin = unitMargin(
      portA.market.grain,
      effectiveBase(portA, 'grain'),
      portB.market.grain,
      effectiveBase(portB, 'grain'),
    );
    expect(expectedMargin).not.toBeNull();

    await continueWithWorld(page, waitingWorld);

    const status = page.locator('.fleet-list__item').first().locator('.fleet-list__status');
    await expect(status).toContainText(`czeka na marżę ≥ ₸${minMargin}`);
    await expect(status).toContainText(`teraz ₸${expectedMargin}`);
    await expect(page.locator('.fleet-list__status--waiting')).toHaveCount(1);
  });
});
