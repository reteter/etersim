import { test, expect, type Page } from '@playwright/test';
import {
  createWorld,
  emptyCargo,
  type GoodId,
  type MarketGood,
  type World,
} from '../src/sim';
import { SAVE_VERSION } from '../src/store/persistence';

/**
 * Buy-cap-reason E2E (#124): fresh-eyes playtest (seed `watermelon`,
 * 2026-07-12) — a player with a full hold ("50/50") saw the Buy control
 * capped with no explanation and concluded the game was broken. These tests
 * drive each of the three constraints named by the issue (hold space, port
 * stock, thalers) through hand-built Worlds injected into the autosave slot
 * (mirrors e2e/headquarters.spec.ts's continueWithWorld pattern) — precise
 * control over which single constraint binds is what the default new-game
 * purse/hold/stock can't reliably give a test.
 */

const AUTOSAVE_KEY = 'etersim.autosave';

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
  await page.getByRole('button', { name: /continue/i }).click();
  await expect(page.locator('svg.region-map')).toBeVisible();
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

/** A funded World with a generous default purse override — scenarios that
 *  aren't testing the thalers constraint pass a large value so it never
 *  accidentally binds instead of the constraint under test. */
function fundedWorld(seed: string, thalers = 100_000): World {
  const w = createWorld(seed);
  return { ...w, company: { ...w.company, thalers } };
}

/** The Controlled Ship's docked port at World creation (always true right
 *  after createWorld). */
function homePort(world: World): { portId: string; name: string } {
  const location = world.company.ships[0].location;
  if (location.kind !== 'docked') throw new Error('ship not docked in a freshly created World');
  const port = world.region.ports.find((p) => p.id === location.portId)!;
  return { portId: port.id, name: port.name };
}

/** Overrides one good's market entry at the given port. */
function withMarketGood(world: World, portId: string, good: GoodId, entry: MarketGood): World {
  return {
    ...world,
    region: {
      ...world.region,
      ports: world.region.ports.map((p) =>
        p.id === portId ? { ...p, market: { ...p.market, [good]: entry } } : p,
      ),
    },
  };
}

/** Fills the Controlled Ship's hold to capacity with a good other than the
 *  one under test, so hold space is exactly 0 without touching the tested
 *  good's own stock or cargo. */
function withFullHold(world: World, fillGood: GoodId): World {
  const ship = world.company.ships[0];
  const cargo = { ...emptyCargo(), [fillGood]: ship.hold };
  return {
    ...world,
    company: {
      ...world.company,
      ships: world.company.ships.map((s) => (s.id === ship.id ? { ...s, cargo } : s)),
    },
  };
}

test.describe('market: Buy cap reason (#124)', () => {
  test('hold full: names "Hold full" near Buy max, which is disabled', async ({ page }) => {
    let world = fundedWorld('market-cap-hold');
    const { name } = homePort(world);
    // Fill the hold with textiles so grain's own stock/thalers stay
    // abundant — hold space alone is the binding constraint.
    world = withFullHold(world, 'textiles');

    await continueWithWorld(page, world);
    await openMarket(page, name);

    const grainRow = page.locator('.market-row').filter({ hasText: 'Grain' });
    await expect(grainRow.locator('.market-row__cap-hint')).toHaveText('Hold full');
    await expect(grainRow.getByRole('button', { name: /Buy max Grain/i })).toBeDisabled();
    await expect(grainRow.getByRole('button', { name: 'Buy Grain', exact: true })).toBeDisabled();
  });

  test('low stock: names "Only 12 in stock" near Buy max, matching the Stock column', async ({
    page,
  }) => {
    let world = fundedWorld('market-cap-stock');
    const { portId, name } = homePort(world);
    world = withMarketGood(world, portId, 'grain', { stock: 12, equilibrium: 12 });

    await continueWithWorld(page, world);
    await openMarket(page, name);

    const grainRow = page.locator('.market-row').filter({ hasText: 'Grain' });
    await expect(grainRow.locator('.market-row__cap-hint')).toHaveText('Only 12 in stock');
    await expect(grainRow.locator('.market-row__stock')).toHaveText('12');
  });

  test('empty purse: names "Not enough thalers" near Buy max', async ({ page }) => {
    const world = fundedWorld('market-cap-thalers', 1);
    const { name } = homePort(world);

    await continueWithWorld(page, world);
    await openMarket(page, name);

    const grainRow = page.locator('.market-row').filter({ hasText: 'Grain' });
    await expect(grainRow.locator('.market-row__cap-hint')).toHaveText('Not enough thalers');
    await expect(grainRow.getByRole('button', { name: /Buy max Grain/i })).toBeDisabled();
  });
});
