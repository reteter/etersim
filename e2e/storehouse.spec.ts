import { test, expect, type Page } from '@playwright/test';
import {
  applyCommand,
  createWorld,
  generateShipName,
  storeOf,
  tick,
  type CompanyBuilding,
  type Route,
  type Ship,
  type World,
} from '../src/sim';
import { SAVE_VERSION } from '../src/store/persistence';
import { chipLabel, cellSpan, loadRouteTab, openBoard, saveRoute } from './boardAuthoring';

const S0_NAME = generateShipName(0);

/**
 * Budowa commission choice + PortPanel Storehouse section + the board's
 * store/withdraw regression guard (#101, #404, #472,
 * docs/specs/E13-guild-buildings.md — UX skeleton;
 * docs/specs/E16-workbench.md §The market-free kinds). Mirrors
 * `shipyard.spec.ts`'s save-injection harness: the default starting
 * purse/permit can't be reached within a test's time budget, so these tests
 * seed the autosave slot with a hand-built World (rank-2 agrarian permit,
 * funded purse, s0 docked at the Granary's port) before booting the app,
 * then drive commission/store/withdraw through the same UI a player uses.
 *
 * **#472 rewrite note.** The Trasy tab's list editor — the only surface that
 * ever authored `store`/`withdraw` before this epic — is deleted
 * (§Trasy roster → the board owns Routes entirely). The two tests in
 * "Board — store/withdraw regression guard (#404)" below are that guard:
 * E16's ordering law ((h) merges before (b), §The market-free kinds) exists
 * because the board's `handleCellClick` used to fall through to
 * `inferOrderKind` for any kind it didn't recognize, silently turning a
 * `store`/`withdraw` order into a `buy`/`sell` the moment an existing Route
 * carrying one was loaded into the board editor. These tests build that
 * exact Route **directly** (never through the UI — authoring a fresh
 * market-free order goes through the ribbon chip's drawer instead, which is
 * a different code path) and load it via the board's own Route tab, which is
 * the historically dangerous path (h) closes.
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

/** A founded World, rank-2 in the agrarian guild (the Building permit —
 *  rankOf(4) === 2, storehouse.test.ts's `richWithPermit` precedent), s0
 *  docked at the agrarian port. Thalers bumped so commissioning + rushing a
 *  Granary is affordable within a test. `otherPortId` is the far end of the
 *  agrarian port's OWN shortest lane (`routeReadyWorld`'s precedent,
 *  worldFixtures.ts) — worldgen distances vary a lot by seed, and an
 *  arbitrary "first other port" can land on a multi-hop course long enough
 *  that a route loop never closes within a test's real-time budget even at
 *  100x (found the hard way: a ~700-tick leg is ~23s of real time at 100x's
 *  ~60-tick/s throughput, incident-adjacent — flagged in the completion
 *  report). */
function foundedWithPermit(seed: string, thalers = 200_000): { world: World; agrarianPortId: string; freeportId: string; otherPortId: string } {
  const w0 = createWorld(seed);
  const agrarianPortId = w0.region.ports.find((p) => p.archetype === 'agrarian')!.id;
  const freeportId = w0.region.ports.find((p) => p.archetype === 'freeport')!.id;
  const lanesFromAgrarian = w0.region.lanes.filter((l) => l.a === agrarianPortId || l.b === agrarianPortId);
  const shortestLane = [...lanesFromAgrarian].sort((x, y) => x.voyageTicks - y.voyageTicks)[0];
  const otherPortId = shortestLane.a === agrarianPortId ? shortestLane.b : shortestLane.a;
  const ship: Ship = { ...w0.company.ships[0], location: { kind: 'docked', portId: agrarianPortId } };
  const funded: World = {
    ...w0,
    company: { ...w0.company, thalers, ships: [ship], guilds: { agrarian: { points: 4 } } },
  };
  const world = applyCommand(funded, { kind: 'foundHeadquarters', portId: agrarianPortId });
  return { world, agrarianPortId, freeportId, otherPortId };
}

/** `foundedWithPermit` plus an already-activated Granary at the agrarian
 *  port (commissioned and rushed to completion through real Commands, not
 *  the UI), optionally pre-stocked. */
function withActiveGranary(
  seed: string,
  opts: { store?: Partial<Record<string, number>>; cargo?: Partial<Record<string, number>> } = {},
): { world: World; agrarianPortId: string; otherPortId: string } {
  const { world: w0, agrarianPortId, otherPortId } = foundedWithPermit(seed);
  let w = applyCommand(w0, {
    kind: 'commissionGuildBuilding',
    type: 'storehouse',
    variant: 'agrarian',
    portId: agrarianPortId,
  });
  let guard = 0;
  while (w.company.guildBuild && guard++ < 500) {
    w = applyCommand(w, { kind: 'rushGuildBuild' });
    if (w.company.guildBuild) w = tick(w, []);
  }
  const building: CompanyBuilding = {
    type: 'storehouse',
    variant: 'agrarian',
    portId: agrarianPortId,
    store: storeOf(opts.store ?? {}),
  };
  const ship: Ship = {
    ...w.company.ships[0],
    location: { kind: 'docked', portId: agrarianPortId },
    cargo: storeOf(opts.cargo ?? {}),
  };
  const world: World = { ...w, company: { ...w.company, buildings: [building], ships: [ship] } };
  return { world, agrarianPortId, otherPortId };
}

test.describe('Budowa tab — commission choice (#101)', () => {
  test('Budynek option: port dropdown limited to legal placements; commission → progress renders; rush completes it', async ({
    page,
  }) => {
    const { world, agrarianPortId, freeportId, otherPortId } = foundedWithPermit('storehouse-commission');
    await continueWithWorld(page, world);

    await page.getByRole('button', { name: /^Siedziba$/ }).click();
    const dialog = page.getByRole('dialog', { name: /siedziba/i });
    await expect(dialog).toBeVisible();

    // "Wartość firmy" is the default tab since the 2026-07-30 relocation
    // (point 4) — Budowa needs an explicit click.
    await dialog.getByRole('tab', { name: 'Budowa' }).click();
    await dialog.getByRole('button', { name: 'Budynek', exact: true }).click();

    const guildSelect = dialog.getByLabel('Gildia budynku');
    await expect(guildSelect).toBeVisible();
    const portSelect = dialog.getByLabel('Port budynku');
    const optionValues = await portSelect.locator('option').evaluateAll((opts) =>
      opts.map((o) => (o as HTMLOptionElement).value),
    );
    // Legal placements only: the agrarian port and the Free port — never the
    // third (non-agrarian, non-free) port.
    expect(optionValues).toContain(agrarianPortId);
    expect(optionValues).toContain(freeportId);
    expect(optionValues).not.toContain(otherPortId);

    await portSelect.selectOption(agrarianPortId);
    const commissionBtn = dialog.getByRole('button', { name: /Zleć budowę — ₸\d/ });
    await expect(commissionBtn).toBeEnabled();
    await commissionBtn.click();
    await dialog.getByRole('button', { name: /Potwierdź — ₸\d/ }).click();

    // Per-good progress bars render, one per good — the same widget the
    // ship side and the Shipyard use.
    await expect(dialog.locator('.headquarters-progress__row')).toHaveCount(5);

    const rushBtn = dialog.getByRole('button', { name: /Dokup resztę — ₸\d/ });
    await expect(rushBtn).toBeVisible();
    await rushBtn.click();
    // Deep purse rushes the whole Recipe in one shot — the Budowa tab
    // returns to the commission choice once the Building activates.
    await expect(dialog.locator('.headquarters-progress__row')).toHaveCount(0);
    await expect(dialog.getByRole('button', { name: 'Budynek', exact: true })).toBeVisible();
  });

  test('Budynek option is disabled with a reason with no guild permit', async ({ page }) => {
    const w0 = createWorld('storehouse-nopermit');
    const funded: World = { ...w0, company: { ...w0.company, thalers: 200_000 } };
    const world = applyCommand(funded, { kind: 'foundHeadquarters', portId: funded.region.ports[0].id });
    await continueWithWorld(page, world);

    await page.getByRole('button', { name: /^Siedziba$/ }).click();
    const dialog = page.getByRole('dialog', { name: /siedziba/i });
    await dialog.getByRole('tab', { name: 'Budowa' }).click();
    await dialog.getByRole('button', { name: 'Budynek', exact: true }).click();
    await expect(dialog).toContainText(/Brak uprawnień do budowy/);
  });
});

test.describe('PortPanel Storehouse section (#101)', () => {
  test('shows fill / capacity and store/withdraw for a docked ship', async ({ page }) => {
    const { world, agrarianPortId } = withActiveGranary('storehouse-portpanel', {
      store: { grain: 20 },
      cargo: { grain: 15 },
    });
    await continueWithWorld(page, world);

    const agrarianIdx = world.region.ports.findIndex((p) => p.id === agrarianPortId);
    await page.locator('g.port').nth(agrarianIdx).click({ force: true });

    await expect(page.locator('.storehouse-section')).toBeVisible();
    await expect(page.locator('.storehouse-row__label')).toContainText('20/200');

    const storeBtn = page.getByRole('button', { name: /^Złóż: Zboże$/ });
    const withdrawBtn = page.getByRole('button', { name: /^Pobierz: Zboże$/ });
    await expect(storeBtn).toBeEnabled();
    await expect(withdrawBtn).toBeEnabled();

    await storeBtn.click(); // 15 in cargo -> stored: 20 + 15 = 35
    await expect(page.locator('.storehouse-row__label')).toContainText('35/200');
    await expect(storeBtn).toBeDisabled(); // cargo now empty

    await withdrawBtn.click(); // withdraws all 35 back into cargo
    await expect(page.locator('.storehouse-row__label')).toContainText('0/200');
    await expect(withdrawBtn).toBeDisabled(); // store now empty
  });

  test('Withdraw is disabled with a reason when the ship\'s hold is already full (#124)', async ({
    page,
  }) => {
    const { world, agrarianPortId } = withActiveGranary('storehouse-hold-full', {
      store: { grain: 20 },
      cargo: { textiles: 50 }, // s0's hold is 50 — already full of a different good
    });
    await continueWithWorld(page, world);

    const agrarianIdx = world.region.ports.findIndex((p) => p.id === agrarianPortId);
    await page.locator('g.port').nth(agrarianIdx).click({ force: true });

    const withdrawBtn = page.getByRole('button', { name: /^Pobierz: Zboże$/ });
    await expect(withdrawBtn).toBeDisabled();
    await expect(withdrawBtn).toHaveAttribute('title', /Ładownia pełna/);
  });
});

/** `withActiveGranary` plus a pre-built, pre-assigned Route carrying a
 *  market-free order at the Storehouse Stop — the #404 regression's exact
 *  precondition ("the board only ever builds fresh drafts" was the bug's own
 *  reason it was unreachable; a pre-existing Route is what makes it
 *  reachable, per E16 §The market-free kinds "Why this was a blocking
 *  decision"). Built directly (never through the board's own authoring
 *  gesture) and the ship pre-assigned, so the test's only UI interaction is
 *  loading the Route via its tab — isolating the guard from the (already
 *  separately covered, `board-market-free-orders.spec.ts`) authoring flow. */
function withGuardRoute(
  seed: string,
  kind: 'store' | 'withdraw',
  opts: { store?: Partial<Record<string, number>> } = {},
): { world: World; agrarianPortId: string; otherPortId: string; routeName: string } {
  const { world: w0, agrarianPortId, otherPortId } = withActiveGranary(seed, opts);
  const routeName = 'Granary Loop';
  const route: Route =
    kind === 'store'
      ? {
          id: 'guard-route',
          name: routeName,
          stops: [
            { portId: otherPortId, orders: [{ kind: 'buy', good: 'grain' }] },
            { portId: agrarianPortId, orders: [{ kind: 'store', good: 'grain' }] },
          ],
        }
      : {
          id: 'guard-route',
          name: routeName,
          stops: [
            { portId: agrarianPortId, orders: [{ kind: 'withdraw', good: 'grain' }] },
            { portId: otherPortId, orders: [{ kind: 'sell', good: 'grain' }] },
          ],
        };
  const ship: Ship = {
    ...w0.company.ships[0],
    assignment: { routeId: route.id, nextStopIndex: 0, suspended: false },
  };
  const world: World = { ...w0, company: { ...w0.company, routes: [route], ships: [ship] } };
  return { world, agrarianPortId, otherPortId, routeName };
}

test.describe('Board — store/withdraw regression guard (#404, #472)', () => {
  test('a Route carrying a `store` order, loaded via its Route tab, renders the chip; a plain cell click leaves it unchanged; saving round-trips it', async ({
    page,
  }) => {
    test.setTimeout(60_000);
    const { world, agrarianPortId, routeName } = withGuardRoute('storehouse-guard-store', 'store');
    const agrarianName = world.region.ports.find((p) => p.id === agrarianPortId)!.name;
    await continueWithWorld(page, world);

    const dialog = await openBoard(page);
    await loadRouteTab(dialog, routeName);

    // Renders: Stop 2 (agrarian port) carries the `store` chip.
    await expect(chipLabel(dialog, 1, 'grain')).toHaveText('złóż · Zboże');

    // Inert: a plain click on that grid cell (not the chip, not the drawer)
    // must not touch the order — the #404 rule ("a cell already carrying a
    // market-free order is inert to the plain click").
    await cellSpan(dialog, agrarianName, 'grain').click();
    await expect(chipLabel(dialog, 1, 'grain')).toHaveText('złóż · Zboże');

    // Round-trips: saving and reloading the Route leaves the order unchanged.
    await saveRoute(dialog);
    await loadRouteTab(dialog, routeName);
    await expect(chipLabel(dialog, 1, 'grain')).toHaveText('złóż · Zboże');

    // Feature half (E13, #101): the Route actually runs — assign is already
    // baked into the seeded World, so un-pausing is enough to prove the
    // `store` Stop order executes, not just that it survives editing.
    await dialog.getByRole('button', { name: /^Zamknij$/ }).click();
    await page.getByRole('button', { name: '100x' }).click();

    // The all-ships Transakcje view rolls each day into one "saldo dnia" row
    // (point 7 — a daily net, not a per-event stream); per-event
    // descriptions ("Złożono"/"Pobrano"/…) only show once a specific ship is
    // selected in the filter, which is also what keeps this assertion
    // ship-specific (s0's own Route, not incidental to some other event).
    await page.getByRole('button', { name: /^Siedziba$/ }).click();
    const hq = page.getByRole('dialog', { name: /siedziba/i });
    await hq.getByRole('button', { name: 'Transakcje', exact: true }).click();
    await hq.locator('#ledger-ship-filter').selectOption({ label: S0_NAME });
    await expect(
      hq.locator('.ledger-list__desc').filter({ hasText: 'Złożono' }).first(),
    ).toBeVisible({ timeout: 30_000 });
  });

  test('a Route carrying a `withdraw` order, loaded via its Route tab, renders the chip; a plain cell click leaves it unchanged; saving round-trips it', async ({
    page,
  }) => {
    test.setTimeout(60_000);
    const { world, agrarianPortId, routeName } = withGuardRoute('storehouse-guard-withdraw', 'withdraw', {
      store: { grain: 40 },
    });
    const agrarianName = world.region.ports.find((p) => p.id === agrarianPortId)!.name;
    await continueWithWorld(page, world);

    const dialog = await openBoard(page);
    await loadRouteTab(dialog, routeName);

    // Renders: Stop 1 (agrarian port) carries the `withdraw` chip.
    await expect(chipLabel(dialog, 0, 'grain')).toHaveText('pobierz · Zboże');

    // Inert: a plain click on that grid cell leaves the order untouched.
    await cellSpan(dialog, agrarianName, 'grain').click();
    await expect(chipLabel(dialog, 0, 'grain')).toHaveText('pobierz · Zboże');

    // Round-trips: saving and reloading the Route leaves the order unchanged.
    await saveRoute(dialog);
    await loadRouteTab(dialog, routeName);
    await expect(chipLabel(dialog, 0, 'grain')).toHaveText('pobierz · Zboże');

    // Feature half: the withdraw+sell loop actually runs — the purse grows
    // (loop metrics can't resolve here, a documented pre-existing limit,
    // src/store/routeMetrics.ts `lastLoopWindow`: only a `trade` event at
    // Stop 0's own port tags a loop boundary, and Stop 0 here is
    // withdraw-only) — and the Ledger carries the withdraw event that fed it.
    await dialog.getByRole('button', { name: /^Zamknij$/ }).click();
    const beforeThalers = Number((await page.locator('.top-bar__thalers').innerText()).replace(/[^\d]/g, ''));
    await page.getByRole('button', { name: '100x' }).click();

    await expect
      .poll(
        async () => Number((await page.locator('.top-bar__thalers').innerText()).replace(/[^\d]/g, '')),
        { timeout: 30_000 },
      )
      .toBeGreaterThan(beforeThalers);

    await page.getByRole('button', { name: /^Siedziba$/ }).click();
    const hq = page.getByRole('dialog', { name: /siedziba/i });
    await hq.getByRole('button', { name: 'Transakcje', exact: true }).click();
    await hq.locator('#ledger-ship-filter').selectOption({ label: S0_NAME });
    await expect(
      hq.locator('.ledger-list__desc').filter({ hasText: 'Pobrano' }).first(),
    ).toBeVisible();
  });
});
