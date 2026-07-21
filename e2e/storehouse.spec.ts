import { test, expect, type Page } from '@playwright/test';
import {
  applyCommand,
  createWorld,
  generateShipName,
  storeOf,
  tick,
  type CompanyBuilding,
  type Ship,
  type World,
} from '../src/sim';
import { SAVE_VERSION } from '../src/store/persistence';

const S0_NAME = generateShipName(0);

/**
 * Budowa commission choice + PortPanel Storehouse section + route editor
 * store/withdraw chips (#101, docs/specs/E13-guild-buildings.md — UX
 * skeleton). Mirrors `shipyard.spec.ts`'s save-injection harness: the
 * default starting purse/permit can't be reached within a test's time
 * budget, so these tests seed the autosave slot with a hand-built World
 * (rank-2 agrarian permit, funded purse, s0 docked at the Granary's port)
 * before booting the app, then drive commission/store/withdraw through the
 * same UI a player uses.
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
  await page.getByRole('button', { name: /continue/i }).click();
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

    await page.getByRole('button', { name: /^Headquarters$/ }).click();
    const dialog = page.getByRole('dialog', { name: /headquarters/i });
    await expect(dialog).toBeVisible();

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

    await page.getByRole('button', { name: /^Headquarters$/ }).click();
    const dialog = page.getByRole('dialog', { name: /headquarters/i });
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

    const storeBtn = page.getByRole('button', { name: /^Store Grain$/ });
    const withdrawBtn = page.getByRole('button', { name: /^Withdraw Grain$/ });
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

    const withdrawBtn = page.getByRole('button', { name: /^Withdraw Grain$/ });
    await expect(withdrawBtn).toBeDisabled();
    await expect(withdrawBtn).toHaveAttribute('title', /Ładownia pełna/);
  });
});

test.describe('Route editor — store/withdraw chips (#101)', () => {
  test('chips render only for a Stop at a storehouse port, and a store route executes in a seeded scenario', async ({
    page,
  }) => {
    test.setTimeout(60_000);
    const { world, agrarianPortId, otherPortId } = withActiveGranary('storehouse-route-store');
    await continueWithWorld(page, world);

    await page.getByRole('button', { name: /^Headquarters$/ }).click();
    const dialog = page.getByRole('dialog', { name: /headquarters/i });
    await dialog.getByRole('tab', { name: 'Trasy' }).click();

    await dialog.getByRole('button', { name: /^New route$/ }).click();
    await dialog.getByRole('button', { name: /^Add stop$/ }).click();
    await dialog.getByRole('button', { name: /^Add stop$/ }).click();
    const stopRows = dialog.locator('.stop-row');

    // Stop 1 at the non-storehouse port: no store/withdraw column at all.
    await stopRows.nth(0).locator('select').selectOption(otherPortId);
    await expect(stopRows.nth(0).getByRole('button', { name: /Grain store at Stop 1/ })).toHaveCount(0);

    // Stop 2 at the storehouse port: store/withdraw chips render.
    await stopRows.nth(1).locator('select').selectOption(agrarianPortId);
    const storeChip = stopRows.nth(1).getByRole('button', { name: /^Grain store at Stop 2$/ });
    await expect(storeChip).toBeVisible();

    // Buy grain at Stop 1, store it at Stop 2 — a two-Stop loop.
    await stopRows
      .nth(0)
      .getByRole('button', { name: /^Grain buy at Stop 1$/ })
      .click();
    await storeChip.click();

    const saveBtn = dialog.getByRole('button', { name: /^Save route$/ });
    await expect(saveBtn).toBeEnabled();
    await saveBtn.click();

    const routeRow = dialog.locator('.route-row').first();
    await routeRow.locator('.route-row__assign select').selectOption({ label: S0_NAME });
    await routeRow.getByRole('button', { name: /^Assign$/ }).click();

    await dialog.getByRole('button', { name: /^Close$/ }).click();
    await page.getByRole('button', { name: '100x' }).click();

    await page.getByRole('button', { name: /^Headquarters$/ }).click();
    const dialog2 = page.getByRole('dialog', { name: /headquarters/i });
    await dialog2.getByRole('tab', { name: 'Trasy' }).click();
    await expect(dialog2.locator('.route-row__result')).not.toContainText('no loop yet', {
      timeout: 30_000,
    });
    await dialog2.getByRole('button', { name: /^Close$/ }).click();

    // The Ledger carries a `store` event — proving the "store" Stop order
    // actually executed as part of the route loop, not just that the ship
    // completed one. (A map-click assertion here is flaky: the ship's own
    // marker can sit on top of the port marker mid-transit and steal the
    // click — the Ledger overlay is unambiguous.)
    await page.getByRole('button', { name: /^Ledger$/ }).click();
    const ledgerDialog = page.getByRole('dialog', { name: /ledger/i });
    await expect(
      ledgerDialog.locator('.ledger-list__desc').filter({ hasText: 'Stored' }).first(),
    ).toBeVisible();
  });

  test('a route with a withdraw chip executes: pre-stocked grain moves from the Storehouse into cargo and sells', async ({
    page,
  }) => {
    test.setTimeout(60_000);
    const { world, agrarianPortId, otherPortId } = withActiveGranary('storehouse-route-withdraw', {
      store: { grain: 40 },
    });
    await continueWithWorld(page, world);

    await page.getByRole('button', { name: /^Headquarters$/ }).click();
    const dialog = page.getByRole('dialog', { name: /headquarters/i });
    await dialog.getByRole('tab', { name: 'Trasy' }).click();

    await dialog.getByRole('button', { name: /^New route$/ }).click();
    await dialog.getByRole('button', { name: /^Add stop$/ }).click();
    await dialog.getByRole('button', { name: /^Add stop$/ }).click();
    const stopRows = dialog.locator('.stop-row');

    await stopRows.nth(0).locator('select').selectOption(agrarianPortId);
    await stopRows
      .nth(0)
      .getByRole('button', { name: /^Grain withdraw at Stop 1$/ })
      .click();
    await stopRows.nth(1).locator('select').selectOption(otherPortId);
    await stopRows
      .nth(1)
      .getByRole('button', { name: /^Grain sell at Stop 2$/ })
      .click();

    const saveBtn = dialog.getByRole('button', { name: /^Save route$/ });
    await expect(saveBtn).toBeEnabled();
    await saveBtn.click();

    const routeRow = dialog.locator('.route-row').first();
    await routeRow.locator('.route-row__assign select').selectOption({ label: S0_NAME });
    await routeRow.getByRole('button', { name: /^Assign$/ }).click();

    await dialog.getByRole('button', { name: /^Close$/ }).click();
    const beforeThalers = Number((await page.locator('.top-bar__thalers').innerText()).replace(/[^\d]/g, ''));
    await page.getByRole('button', { name: '100x' }).click();

    // Route-row loop metrics can't resolve here (a documented pre-existing
    // resolution limit, src/store/routeMetrics.ts `lastLoopWindow`: only a
    // `trade` event at Stop 0's own port tags a loop boundary, and this
    // route's Stop 0 is withdraw-only, no buy/sell) — the purse growing is
    // the direct, unambiguous proof the withdraw+sell loop actually ran.
    await expect
      .poll(
        async () => Number((await page.locator('.top-bar__thalers').innerText()).replace(/[^\d]/g, '')),
        { timeout: 30_000 },
      )
      .toBeGreaterThan(beforeThalers);

    // The Ledger carries the withdraw event that fed the sale.
    await page.getByRole('button', { name: /^Ledger$/ }).click();
    const ledgerDialog = page.getByRole('dialog', { name: /ledger/i });
    await expect(
      ledgerDialog.locator('.ledger-list__desc').filter({ hasText: 'Withdrew' }).first(),
    ).toBeVisible();
  });
});
