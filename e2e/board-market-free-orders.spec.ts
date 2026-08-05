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
import {
  attachOrder,
  cellSpan,
  chipLabel,
  loadRouteTab,
  openBoard,
  orderKindPickerButtons,
  pickOrderKind,
  saveRoute,
  startNewRoute,
  toggleOrderDrawer,
} from './boardAuthoring';

/**
 * Market-free order kinds on the price board (#419, docs/specs/E16-workbench.md
 * §The market-free kinds — deliver / store / withdraw). Mirrors
 * `storehouse.spec.ts`'s save-injection harness (own copy — each e2e file is
 * self-contained, matching that file's own precedent) so a `store`/`withdraw`-
 * capable Storehouse exists at game start without waiting out the real Budowa
 * flow within a test's time budget.
 *
 * **#472/#475 rewrite note.** The two tests below were suspended
 * (`test.skip`) at the E16 visual rebuild because they drove the "więcej"
 * drawer from inside a grid cell — the drawer rode along to the ribbon's
 * action row (D7), so they are re-pointed here rather than dropped. They
 * cover the **authoring** and **legality** halves of the market-free story;
 * the **regression-guard** half (a pre-existing Route carrying a
 * `store`/`withdraw` order surviving a board edit) is `storehouse.spec.ts`'s
 * "Board — store/withdraw regression guard (#404, #472)" — a deliberately
 * different scenario (an existing Route loaded via its tab, never authored
 * fresh), which is the historically dangerous path #404 closes.
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

test.describe('price board — market-free order kinds (#419, docs/specs/E16-workbench.md §The market-free kinds)', () => {
  test('the drawer authors a store order; a plain click leaves it unchanged; saving round-trips it through the board\'s own Route tab', async ({
    page,
  }) => {
    const { world, agrarianPortId, otherPortId } = withActiveGranary('board-store-regression');
    const agrarianName = world.region.ports.find((p) => p.id === agrarianPortId)!.name;
    await continueWithWorld(page, world);

    const dialog = await openBoard(page);
    await startNewRoute(dialog);
    await attachOrder(dialog, otherPortId, 'grain', 'buy'); // Stop 1
    await attachOrder(dialog, agrarianPortId, 'grain', 'sell'); // Stop 2, switched to `store` below

    // The drawer's kind picker is "the complete truth about kind" (#419
    // AC1/AC3) — switching to `store` here is the only authoring path to a
    // market-free kind (the radial menu never offers it).
    await toggleOrderDrawer(dialog, 1, 'grain');
    await pickOrderKind(dialog, 1, 'grain', 'store');

    // Chip now reads the market-free kind.
    await expect(chipLabel(dialog, 1, 'grain')).toHaveText('złóż · Zboże');

    // AC3 — a plain click on a market-free cell is inert: the order survives
    // unchanged; `openRadialMenu` must never reach `chooseRadialAction` for
    // this cell.
    await cellSpan(dialog, agrarianName, 'grain').click();
    await expect(chipLabel(dialog, 1, 'grain')).toHaveText('złóż · Zboże');

    await saveRoute(dialog);

    // Round-trip: reloading the saved Route via its own board tab reads the
    // `store` order back unchanged — the sim's stored Route, not the
    // board's own unsaved state.
    await loadRouteTab(dialog, 'Trasa 1');
    await expect(chipLabel(dialog, 1, 'grain')).toHaveText('złóż · Zboże');
  });

  test('the drawer offers store/withdraw only for storehouseFilter goods at a Storehouse port, and always offers deliver', async ({
    page,
  }) => {
    const { world, agrarianPortId, otherPortId } = withActiveGranary('board-drawer-legality');
    await continueWithWorld(page, world);

    const dialog = await openBoard(page);
    await startNewRoute(dialog);
    // Storehouse port, its own domain good (grain) and one outside its
    // filter (textiles) both attach to the same Stop; the non-Storehouse
    // port gets its own Stop with an unrelated good (electronics).
    await attachOrder(dialog, agrarianPortId, 'grain', 'buy');
    await attachOrder(dialog, agrarianPortId, 'textiles', 'buy');
    await attachOrder(dialog, otherPortId, 'electronics', 'deliver');

    // Storehouse port, its own domain good: the drawer lists all five kinds
    // (AC1 — "the complete truth about kind").
    await toggleOrderDrawer(dialog, 0, 'grain');
    const grainPicker = orderKindPickerButtons(dialog, 0, 'grain');
    await expect(grainPicker).toHaveCount(5);
    await expect(grainPicker.filter({ hasText: 'Złóż' })).toHaveCount(1);
    await expect(grainPicker.filter({ hasText: 'Pobierz' })).toHaveCount(1);

    // Same Storehouse port, a good OUTSIDE the Granary's own filter — no
    // board-side loosening past `storehouseFilter`.
    await toggleOrderDrawer(dialog, 0, 'textiles');
    const textilesPicker = orderKindPickerButtons(dialog, 0, 'textiles');
    await expect(textilesPicker).toHaveCount(3);
    await expect(textilesPicker.filter({ hasText: 'Złóż' })).toHaveCount(0);
    await expect(textilesPicker.filter({ hasText: 'Pobierz' })).toHaveCount(0);

    // A port with NO Storehouse and no active build site — deliver is still
    // offered (spec point 5: deliberately not gated on a build site).
    await toggleOrderDrawer(dialog, 1, 'electronics');
    const otherPicker = orderKindPickerButtons(dialog, 1, 'electronics');
    await expect(otherPicker).toHaveCount(3);
    await expect(otherPicker.filter({ hasText: 'Dostarcz' })).toHaveCount(1);
    await expect(otherPicker.filter({ hasText: 'Złóż' })).toHaveCount(0);
  });

  test('the Storehouse marker appears on the port row header, in read mode and while authoring', async ({
    page,
  }) => {
    const { world, agrarianPortId, otherPortId } = withActiveGranary('board-storehouse-marker');
    await continueWithWorld(page, world);

    const dialog = await openBoard(page);
    const rows = dialog.locator('.price-board__row:not(.price-board__row--header)');
    const agrarianIdx = world.region.ports.findIndex((p) => p.id === agrarianPortId);
    const otherIdx = world.region.ports.findIndex((p) => p.id === otherPortId);

    // Read mode (no draft) — the marker is visible on the Storehouse's own
    // port row, absent from a port with none (§Signal boundary — "visible
    // always", a fact about the Company's holdings, not gated on authoring).
    await expect(rows.nth(agrarianIdx).locator('.price-board__storehouse-marker')).toHaveCount(1);
    await expect(rows.nth(otherIdx).locator('.price-board__storehouse-marker')).toHaveCount(0);

    // Authoring mode — still visible, port-level and unaffected by the draft.
    // "Nowa trasa" is a `role="tab"` (the authoring bar's Route tabs strip),
    // not a plain button, since #468 turned the roster into a tab row.
    await startNewRoute(dialog);
    await expect(rows.nth(agrarianIdx).locator('.price-board__storehouse-marker')).toHaveCount(1);
  });
});
