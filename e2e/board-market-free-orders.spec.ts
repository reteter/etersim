import { test, expect, type Page } from '@playwright/test';
import {
  applyCommand,
  createWorld,
  storeOf,
  tick,
  type CompanyBuilding,
  type Ship,
  type World,
} from '../src/sim';
import { SAVE_VERSION } from '../src/store/persistence';

/**
 * Market-free order kinds on the price board (#419, docs/specs/E16-workbench.md
 * §The market-free kinds — deliver / store / withdraw). Mirrors
 * `storehouse.spec.ts`'s save-injection harness (own copy — each e2e file is
 * self-contained, matching that file's own precedent) so a `store`/`withdraw`-
 * capable Storehouse exists at game start without waiting out the real Budowa
 * flow within a test's time budget.
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

/** A founded, rank-2-agrarian-permitted World with an already-activated
 *  Granary (Storehouse, domain good = grain) at the agrarian port — s0
 *  docked there. `otherPortId` is a second, non-storehouse port for a
 *  2-Stop draft. Adapted from `storehouse.spec.ts`'s `withActiveGranary`. */
function withActiveGranary(seed: string): { world: World; agrarianPortId: string; otherPortId: string } {
  const w0 = createWorld(seed);
  const agrarianPortId = w0.region.ports.find((p) => p.archetype === 'agrarian')!.id;
  const lanesFromAgrarian = w0.region.lanes.filter((l) => l.a === agrarianPortId || l.b === agrarianPortId);
  const shortestLane = [...lanesFromAgrarian].sort((x, y) => x.voyageTicks - y.voyageTicks)[0];
  const otherPortId = shortestLane.a === agrarianPortId ? shortestLane.b : shortestLane.a;
  const ship: Ship = { ...w0.company.ships[0], location: { kind: 'docked', portId: agrarianPortId } };
  const funded: World = {
    ...w0,
    company: { ...w0.company, thalers: 200_000, ships: [ship], guilds: { agrarian: { points: 4 } } },
  };
  let w = applyCommand(funded, { kind: 'foundHeadquarters', portId: agrarianPortId });
  w = applyCommand(w, {
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
    store: storeOf({}),
  };
  const world: World = { ...w, company: { ...w.company, buildings: [building] } };
  return { world, agrarianPortId, otherPortId };
}

async function openBoardAuthoring(page: Page) {
  await page.getByRole('button', { name: /tablica cen/i }).click();
  const dialog = page.getByRole('dialog', { name: /tablica cen/i });
  await dialog.getByRole('button', { name: 'Nowa trasa' }).click();
  return dialog;
}

test.describe('price board — market-free order kinds (#419, docs/specs/E16-workbench.md §The market-free kinds)', () => {
  test('drawer authors a store order; a plain click leaves it unchanged; saving round-trips it into the Trasy editor', async ({
    page,
  }) => {
    const { world, agrarianPortId, otherPortId } = withActiveGranary('board-store-regression');
    await continueWithWorld(page, world);

    const dialog = await openBoardAuthoring(page);
    const rows = dialog.locator('.price-board__row:not(.price-board__row--header)');
    const agrarianIdx = world.region.ports.findIndex((p) => p.id === agrarianPortId);
    const otherIdx = world.region.ports.findIndex((p) => p.id === otherPortId);
    const agrarianRow = rows.nth(agrarianIdx);
    const otherRow = rows.nth(otherIdx);

    await agrarianRow.click(); // Stop 1
    await otherRow.click(); // Stop 2 — a second distinct port, draft becomes valid

    // Grain is GOOD_IDS[0] — the agrarian port's own domain good.
    const grainCell = agrarianRow.locator('.price-board__cell').nth(0);
    await grainCell.locator('.price-board__cell-btn').click(); // default click: buy or sell, market-inferred
    const chip = grainCell.locator('.price-board__order-chip');

    await grainCell.getByRole('button', { name: /więcej opcji/ }).click();
    await grainCell.getByRole('button', { name: 'Zboże: ustaw zlecenie na Złóż' }).click();

    // Chip now reads the market-free kind, with no ⇄ shortcut (AC4).
    await expect(chip.locator('.price-board__order-chip-label')).toHaveText('Złóż');
    await expect(chip.getByRole('button', { name: /zmień na/ })).toHaveCount(0);
    await expect(chip).toHaveCount(1);

    // AC3 — a plain click on a market-free cell is inert: label, kind, and
    // chip count all survive unchanged; `handleCellClick` must never reach
    // `inferOrderKind` for this cell.
    await grainCell.locator('.price-board__cell-btn').click();
    await expect(chip.locator('.price-board__order-chip-label')).toHaveText('Złóż');
    await expect(chip).toHaveCount(1);

    const saveBtn = dialog.getByRole('button', { name: /^Zapisz trasę$/ });
    await expect(saveBtn).toBeEnabled();
    await saveBtn.click();
    await dialog.getByRole('button', { name: /zamknij/i }).click();

    // Round-trip: the saved Route's Stop 1 (agrarian port, added first)
    // carries the `store` order, read through the Trasy editor's own
    // chip (independent rendering — this is not the board reading itself
    // back, it is the sim's stored Route confirmed via `RoutesTab`).
    await page.getByRole('button', { name: /^Siedziba$/ }).click();
    const hqDialog = page.getByRole('dialog', { name: /siedziba/i });
    await hqDialog.getByRole('tab', { name: 'Trasy' }).click();
    await hqDialog.locator('.route-row').first().getByRole('button', { name: /^Edytuj$/ }).click();

    const storeChip = hqDialog.getByRole('button', { name: /^Zboże: Złóż — przystanek 1$/ });
    await expect(storeChip).toBeVisible();
    await expect(storeChip).toHaveAttribute('aria-pressed', 'true');
  });

  test('the drawer offers store/withdraw only for storehouseFilter goods at a Storehouse port, and always offers deliver', async ({
    page,
  }) => {
    const { world, agrarianPortId, otherPortId } = withActiveGranary('board-drawer-legality');
    await continueWithWorld(page, world);

    const dialog = await openBoardAuthoring(page);
    const rows = dialog.locator('.price-board__row:not(.price-board__row--header)');
    const agrarianIdx = world.region.ports.findIndex((p) => p.id === agrarianPortId);
    const otherIdx = world.region.ports.findIndex((p) => p.id === otherPortId);
    const agrarianRow = rows.nth(agrarianIdx);
    const otherRow = rows.nth(otherIdx);

    await agrarianRow.click();
    await otherRow.click();

    // Storehouse port, its own domain good (grain, GOOD_IDS[0]): the drawer
    // lists all five kinds (AC1 — "the complete truth about kind").
    const grainCell = agrarianRow.locator('.price-board__cell').nth(0);
    await grainCell.locator('.price-board__cell-btn').click();
    await grainCell.getByRole('button', { name: /więcej opcji/ }).click();
    const grainPicker = grainCell.locator('.price-board__order-kind-picker button');
    await expect(grainPicker).toHaveCount(5);
    await expect(grainPicker.filter({ hasText: 'Złóż' })).toHaveCount(1);
    await expect(grainPicker.filter({ hasText: 'Pobierz' })).toHaveCount(1);

    // Same Storehouse port, a good OUTSIDE the Granary's own filter
    // (textiles, GOOD_IDS[1]) — no board-side loosening past `storehouseFilter`.
    const textilesCell = agrarianRow.locator('.price-board__cell').nth(1);
    await textilesCell.locator('.price-board__cell-btn').click();
    await textilesCell.getByRole('button', { name: /więcej opcji/ }).click();
    const textilesPicker = textilesCell.locator('.price-board__order-kind-picker button');
    await expect(textilesPicker).toHaveCount(3);
    await expect(textilesPicker.filter({ hasText: 'Złóż' })).toHaveCount(0);
    await expect(textilesPicker.filter({ hasText: 'Pobierz' })).toHaveCount(0);

    // A port with NO Storehouse and no active build site — deliver is still
    // offered (spec point 5: deliberately not gated on a build site).
    const otherCell = otherRow.locator('.price-board__cell').nth(0);
    await otherCell.locator('.price-board__cell-btn').click();
    await otherCell.getByRole('button', { name: /więcej opcji/ }).click();
    const otherPicker = otherCell.locator('.price-board__order-kind-picker button');
    await expect(otherPicker).toHaveCount(3);
    await expect(otherPicker.filter({ hasText: 'Dostarcz' })).toHaveCount(1);
    await expect(otherPicker.filter({ hasText: 'Złóż' })).toHaveCount(0);
  });

  test('the Storehouse marker appears on the port row header, in read mode and while authoring', async ({
    page,
  }) => {
    const { world, agrarianPortId, otherPortId } = withActiveGranary('board-storehouse-marker');
    await continueWithWorld(page, world);

    await page.getByRole('button', { name: /tablica cen/i }).click();
    const dialog = page.getByRole('dialog', { name: /tablica cen/i });
    const rows = dialog.locator('.price-board__row:not(.price-board__row--header)');
    const agrarianIdx = world.region.ports.findIndex((p) => p.id === agrarianPortId);
    const otherIdx = world.region.ports.findIndex((p) => p.id === otherPortId);

    // Read mode (no draft) — the marker is visible on the Storehouse's own
    // port row, absent from a port with none (§Signal boundary — "visible
    // always", a fact about the Company's holdings, not gated on authoring).
    await expect(rows.nth(agrarianIdx).locator('.price-board__storehouse-marker')).toHaveCount(1);
    await expect(rows.nth(otherIdx).locator('.price-board__storehouse-marker')).toHaveCount(0);

    // Authoring mode — still visible, port-level and unaffected by the draft.
    await dialog.getByRole('button', { name: 'Nowa trasa' }).click();
    await expect(rows.nth(agrarianIdx).locator('.price-board__storehouse-marker')).toHaveCount(1);
  });
});
