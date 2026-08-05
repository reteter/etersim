import { test, expect, type Page } from '@playwright/test';
import { effectiveBase, unitMargin, type Ship, type World } from '../src/sim';
import { SAVE_VERSION } from '../src/store/persistence';
import {
  attachOrder,
  loadRouteTab,
  minMarginInput,
  openBoard,
  pickOrderKind,
  qtyInput,
  saveRoute,
  startNewRoute,
  toggleOrderDrawer,
} from './boardAuthoring';
import { routeReadyWorld } from './worldFixtures';

/**
 * E9.1 wave 2 (#263) UI: qty + Margin Gate inputs on the board's "więcej"
 * drawer, and the Fleet list's "czeka na marżę" indicator. Reuses the
 * save-injection harness pattern from headquarters.spec.ts (a funded World
 * with s0 docked at one end of a lane) since the default starting purse
 * can't found a Headquarters within a test's time budget. `routeReadyWorld`
 * itself lives in ./worldFixtures (#272), shared with headquarters.spec.ts.
 *
 * **#472 rewrite note:** the Trasy tab's list editor (`Nowa trasa` →
 * `Dodaj przystanek` → per-Stop chip table) is gone
 * (docs/specs/E16-workbench.md §Trasy roster → the board owns Routes
 * entirely). `qty`/`minMargin` are unchanged in *substance* (still
 * progressive-disclosure fields, D7's own as-built home — §Attaching orders)
 * but now live in the board's ribbon-chip "więcej" drawer, reached via
 * `./boardAuthoring`.
 */

const AUTOSAVE_KEY = 'etersim.autosave';

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
  await page.getByRole('button', { name: /kontynuuj/i }).click();
  await expect(page.locator('svg.region-map')).toBeVisible();
}

async function foundHeadquarters(page: Page): Promise<void> {
  await page.locator('g.port').first().click({ force: true });
  await page.getByRole('button', { name: /Załóż siedzibę/ }).click();
}

test.describe('Board "więcej" drawer — qty + Margin Gate inputs (#263)', () => {
  test('qty input shows for active buy/sell, not for deliver; minMargin shows only for buy; both persist into the saved route', async ({
    page,
  }) => {
    const { world, a, b } = routeReadyWorld('e91-qty-persist');
    await continueWithWorld(page, world);
    await foundHeadquarters(page);

    const dialog = await openBoard(page);
    await startNewRoute(dialog);
    await attachOrder(dialog, a, 'grain', 'buy');
    await attachOrder(dialog, b, 'grain', 'sell');

    // Stop 1 (A): buy grain, qty = 5, minMargin = 3.
    await toggleOrderDrawer(dialog, 0, 'grain');
    const qtyBuy = qtyInput(dialog, 0, 'grain');
    const marginInput = minMarginInput(dialog, 0, 'grain');
    await expect(qtyBuy).toBeVisible();
    await expect(marginInput).toBeVisible();
    await qtyBuy.fill('5');
    await marginInput.fill('3');

    // Deliver never shows qty — switch the same good's Stop-1 order to
    // deliver via the drawer's kind picker and confirm neither input remains.
    await pickOrderKind(dialog, 0, 'grain', 'deliver');
    await expect(qtyInput(dialog, 0, 'grain')).toHaveCount(0);
    await expect(minMarginInput(dialog, 0, 'grain')).toHaveCount(0);

    // Switch back to buy — a fresh order (qty/minMargin cleared, matching
    // `setStopOrderKind`'s always-drop semantics) — then re-set both.
    await pickOrderKind(dialog, 0, 'grain', 'buy');
    await qtyInput(dialog, 0, 'grain').fill('5');
    await minMarginInput(dialog, 0, 'grain').fill('3');

    // Stop 2 (B): sell grain, qty = 2 — minMargin must never show for sell.
    await toggleOrderDrawer(dialog, 1, 'grain');
    const qtySell = qtyInput(dialog, 1, 'grain');
    await expect(qtySell).toBeVisible();
    await expect(minMarginInput(dialog, 1, 'grain')).toHaveCount(0);
    await qtySell.fill('2');

    await saveRoute(dialog);

    // Re-open the saved Route: qty/minMargin round-tripped through the
    // createRoute Command, not just local editor state.
    await loadRouteTab(dialog, 'Trasa 1');
    await toggleOrderDrawer(dialog, 0, 'grain');
    await toggleOrderDrawer(dialog, 1, 'grain');
    await expect(qtyInput(dialog, 0, 'grain')).toHaveValue('5');
    await expect(minMarginInput(dialog, 0, 'grain')).toHaveValue('3');
    await expect(qtyInput(dialog, 1, 'grain')).toHaveValue('2');
  });

  test('a blank qty (greedy) round-trips as absent — no stray 0/NaN value on reopen', async ({
    page,
  }) => {
    const { world, a, b } = routeReadyWorld('e91-qty-blank');
    await continueWithWorld(page, world);
    await foundHeadquarters(page);

    const dialog = await openBoard(page);
    await startNewRoute(dialog);
    await attachOrder(dialog, a, 'grain', 'buy');
    await attachOrder(dialog, b, 'grain', 'sell');
    await saveRoute(dialog);

    await loadRouteTab(dialog, 'Trasa 1');
    await toggleOrderDrawer(dialog, 0, 'grain');
    await expect(qtyInput(dialog, 0, 'grain')).toHaveValue('');
    await expect(minMarginInput(dialog, 0, 'grain')).toHaveValue('');
  });

  // SKIPPED — the Trasy list editor's inactive-gate warning
  // (`.stop-row__gate-warning`, "brak przystanku sprzedaży") has **no board
  // equivalent**: `RoutesTab.tsx` (and its `StopRow`) is deleted wholesale
  // (docs/specs/E16-workbench.md §Trasy roster → the board owns Routes
  // entirely), and nothing in `PriceBoardOverlay.tsx`/`RouteRibbon.tsx`
  // renders an inactive-Margin-Gate warning on the ribbon chip or its
  // drawer. This is a genuine capability gap, not a relocation — #472's
  // package explicitly forbids inventing UI to make a spec assertion pass,
  // so this is flagged in the completion report for the Orchestrator rather
  // than silently re-homed or dropped.
  test.skip('inactive-gate warning: shows when the buy has no sell-stop for the good anywhere on the route, clears once one exists', async ({
    page,
  }) => {
    const { world, a, b } = routeReadyWorld('e91-gate-warning');
    await continueWithWorld(page, world);
    await foundHeadquarters(page);

    const dialog = await openBoard(page);
    await startNewRoute(dialog);
    await attachOrder(dialog, a, 'grain', 'buy');
    await attachOrder(dialog, b, 'grain', 'deliver');
    await toggleOrderDrawer(dialog, 0, 'grain');
    await minMarginInput(dialog, 0, 'grain').fill('3');

    const warning = dialog.locator('.stop-row__gate-warning');
    await expect(warning).toBeVisible();
    await expect(warning).toContainText(/brak przystanku sprzedaży/i);

    await pickOrderKind(dialog, 1, 'grain', 'sell');
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
