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
 * E16 visual prototype (#468) — **screenshot harness, not a gate.**
 *
 * Deliberately left in the tree (the task package's second option) so the
 * owner can re-shoot the board after any tweak without reconstructing the
 * setup. It asserts almost nothing: its job is to drive the real app to the
 * four states the owner is judging and capture them at 1440×950. Delete it
 * (or fold it into a real spec) once the visual contract lands in
 * `docs/specs/E16-workbench.md`.
 *
 * Real rendering on purpose — the world comes from the same save-injection
 * harness `board-market-free-orders.spec.ts` uses, not a hardcoded fixture,
 * so what the owner judges is what the game actually draws.
 */

const AUTOSAVE_KEY = 'etersim.autosave';
const SHOTS =
  'C:/Users/jakub/AppData/Local/Temp/claude/D--code-claudeapp-etersim/acfb207e-6ada-48e6-8e98-98dbb7ae6fbd/scratchpad/shots2/';

test.use({ viewport: { width: 1440, height: 950 } });

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

/** A founded World with an activated Granary at the agrarian port, so the
 *  Storehouse marker and the drawer's market-free kinds are both reachable.
 *  Adapted from `board-market-free-orders.spec.ts`'s `withActiveGranary`. */
function protoWorld(seed: string): { world: World; agrarianPortId: string; otherPortId: string } {
  const w0 = createWorld(seed);
  const agrarianPortId = w0.region.ports.find((p) => p.archetype === 'agrarian')!.id;
  // Stop 2 is deliberately the **free port**, not the nearest neighbour: the
  // D3 role highlight reads off `ARCHETYPE_PROFILES`, and an agrarian port
  // produces-or-consumes four of the five goods, so selecting one dims a
  // single column and the effect is invisible in a screenshot. A free port
  // touches only grain and textiles, which shows what the highlight *does*.
  // (Worth the owner's attention on its own — see the completion report.)
  const otherPortId =
    w0.region.ports.find((p) => p.archetype === 'freeport')?.id ??
    w0.region.ports.find((p) => p.id !== agrarianPortId)!.id;
  const ship: Ship = { ...w0.company.ships[0], location: { kind: 'docked', portId: agrarianPortId } };
  const funded: World = {
    ...w0,
    company: {
      ...w0.company,
      thalers: 200_000,
      ships: [ship],
      guilds: { agrarian: { points: 4 } },
    },
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
  return { world: { ...w, company: { ...w.company, buildings: [building] } }, agrarianPortId, otherPortId };
}

/** Board open, authoring started, two Stops placed, one order on each — the
 *  state shots 11 and 12 both build on. Returns the dialog. */
async function boardWithTwoStopRoute(page: Page, world: World, aId: string, bId: string) {
  await page.getByRole('button', { name: /tablica cen/i }).click();
  const dialog = page.getByRole('dialog', { name: /tablica cen/i });
  await dialog.getByRole('button', { name: 'Nowa trasa' }).click();

  const rows = dialog.locator('.price-board__row:not(.price-board__row--header)');
  const aIdx = world.region.ports.findIndex((p) => p.id === aId);
  const bIdx = world.region.ports.findIndex((p) => p.id === bId);
  const rowA = rows.nth(aIdx);
  const rowB = rows.nth(bIdx);

  await rowA.click(); // Stop 1
  await rowB.click(); // Stop 2 — draft becomes valid

  // One order per Stop: grain at Stop 1, grain at Stop 2 (the market infers
  // opposite kinds at a producer and a consumer, which is the point).
  await rowA.locator('.price-board__cell-btn').nth(0).click();
  await rowB.locator('.price-board__cell-btn').nth(0).click();

  await expect(dialog.locator('.route-ribbon__chip')).toHaveCount(2);
  return { dialog, rowA, rowB };
}

test('proto shots — board reading, board authoring, role highlight, Trasy roster', async ({
  page,
}) => {
  test.setTimeout(120_000);
  const { world, agrarianPortId, otherPortId } = protoWorld('e16-visual-proto');
  await continueWithWorld(page, world);

  // ---- 10: reading mode, no route in progress ----
  await page.getByRole('button', { name: /tablica cen/i }).click();
  const dialog = page.getByRole('dialog', { name: /tablica cen/i });
  await expect(dialog.locator('.price-board')).toBeVisible();
  await page.waitForTimeout(400);
  await page.screenshot({ path: `${SHOTS}10-board-reading.png` });
  await dialog.getByRole('button', { name: /zamknij/i }).click();

  // ---- 11: authoring, ribbon visible, 2 Stops with orders ----
  const { dialog: d2 } = await boardWithTwoStopRoute(page, world, agrarianPortId, otherPortId);
  await page.waitForTimeout(600); // let the dock + action-row growth settle
  await page.screenshot({ path: `${SHOTS}11-board-authoring.png` });
  // Detail crops — not deliverables, but the only way to judge the rail and
  // a single cell at the size the owner will actually read them.
  await d2.locator('.route-ribbon').screenshot({ path: `${SHOTS}crop-ribbon.png` });
  await d2.locator('.price-board__row--header').screenshot({ path: `${SHOTS}crop-header.png` });

  // ---- 12: a Stop's port selected → its produced/consumed goods light up ----
  // Attaching an order also sets the *contextual focus* (#395) on that good,
  // which dims every other column on its own. Clear it first, or the role
  // highlight would be invisible under an identical-looking dimming — the
  // two effects share one channel by design.
  await d2.locator('.price-board__good-header').first().click();
  await expect(d2.locator('.price-board__good-header--dim')).toHaveCount(0);

  // Stop 2 is the industrial/consumer side of the pair, so its role set is
  // several goods wide — a more legible picture than a single-good producer.
  await d2.locator('.route-ribbon__disc--btn').last().click();
  await expect(d2.locator('.price-board__good-header--dim').first()).toBeVisible();
  await page.waitForTimeout(300);
  await page.screenshot({ path: `${SHOTS}12-board-role-highlight.png` });

  // Save the Route so the Trasy roster has something to render, then close.
  await d2.locator('.route-ribbon__disc--btn').last().click(); // deselect
  await d2.getByRole('button', { name: /^Zapisz trasę$/ }).click();
  await d2.getByRole('button', { name: /zamknij/i }).click();

  // ---- 13: Trasy tab, read-only ribbon roster ----
  await page.getByRole('button', { name: /^Siedziba$/ }).click();
  const hq = page.getByRole('dialog', { name: /siedziba/i });
  await hq.getByRole('tab', { name: 'Trasy' }).click();
  await expect(hq.locator('.route-row__ribbon .route-ribbon')).toHaveCount(1);
  await page.waitForTimeout(400);
  await page.screenshot({ path: `${SHOTS}13-trasy-roster.png` });
});

/**
 * D6's load-bearing claim, checked rather than asserted in prose: the ribbon
 * is fixed **horizontally**, so more Stops must not make it taller. This is
 * the one acceptance criterion a screenshot cannot show, because "did not
 * grow" is invisible.
 */
test('D6 — a 7-Stop route is exactly as tall as a 2-Stop route', async ({ page }) => {
  test.setTimeout(120_000);
  const { world } = protoWorld('e16-visual-proto-height');
  await continueWithWorld(page, world);

  await page.getByRole('button', { name: /tablica cen/i }).click();
  const dialog = page.getByRole('dialog', { name: /tablica cen/i });
  await dialog.getByRole('button', { name: 'Nowa trasa' }).click();
  const rows = dialog.locator('.price-board__row:not(.price-board__row--header)');

  await rows.nth(0).click();
  await rows.nth(1).click();
  await page.waitForTimeout(500);
  const twoStop = await dialog.locator('.route-ribbon').boundingBox();

  const portCount = world.region.ports.length;
  for (let i = 2; i < portCount; i++) await rows.nth(i).click();
  await page.waitForTimeout(500);
  const manyStop = await dialog.locator('.route-ribbon').boundingBox();

  expect(dialog.locator('[data-testid="route-ribbon__node"]')).toBeTruthy();
  await expect(dialog.locator('[data-testid="route-ribbon__node"]')).toHaveCount(portCount);
  expect(manyStop!.height).toBe(twoStop!.height);
  expect(manyStop!.width).toBe(twoStop!.width);
  await page.screenshot({ path: `${SHOTS}crop-many-stops.png` });
});
