import { test, expect, type Page } from '@playwright/test';
import {
  createWorld,
  effectiveBase,
  emptyCargo,
  quoteBuy,
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
  test('hold full: names "Hold full" near the trade line, Buy disabled', async ({ page }) => {
    let world = fundedWorld('market-cap-hold');
    const { name } = homePort(world);
    // Fill the hold with textiles so grain's own stock/thalers stay
    // abundant — hold space alone is the binding constraint.
    world = withFullHold(world, 'textiles');

    await continueWithWorld(page, world);
    await openMarket(page, name);

    const grainRow = page.locator('.market-row').filter({ hasText: 'Grain' });
    await expect(grainRow.locator('.market-row__cap-hint')).toHaveText('Hold full');
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

  test('empty purse: names the absolute "can\'t afford any" hint near the trade line, Buy disabled (#375)', async ({
    page,
  }) => {
    const world = fundedWorld('market-cap-thalers', 1);
    const { name } = homePort(world);

    await continueWithWorld(page, world);
    await openMarket(page, name);

    const grainRow = page.locator('.market-row').filter({ hasText: 'Grain' });
    await expect(grainRow.locator('.market-row__cap-hint')).toHaveText('Nie stać cię na żaden zakup');
    await expect(grainRow.getByRole('button', { name: 'Buy Grain', exact: true })).toBeDisabled();
  });

  test('thin purse: names the affordable cap when thalers bind but buyMax stays positive (#375)', async ({
    page,
  }) => {
    let world = fundedWorld('market-cap-thalers-partial');
    const { portId, name } = homePort(world);
    // Ample stock/equilibrium so hold/stock never bind — only thalers can.
    const entry: MarketGood = { stock: 1000, equilibrium: 1000 };
    world = withMarketGood(world, portId, 'grain', entry);
    const port = world.region.ports.find((p) => p.id === portId)!;
    const base = effectiveBase(port, 'grain');
    // Exactly afford 5 units of grain — buyMax > 0, thalers still bind
    // below the (far larger) structural cap.
    const affordable = 5;
    const purse = quoteBuy(entry, base, affordable)!;
    world = { ...world, company: { ...world.company, thalers: purse } };

    await continueWithWorld(page, world);
    await openMarket(page, name);

    const grainRow = page.locator('.market-row').filter({ hasText: 'Grain' });
    await expect(grainRow.locator('.market-row__cap-hint')).toHaveText(
      `Kasa ogranicza zakup do ${affordable}`,
    );
    await expect(grainRow.getByRole('button', { name: 'Buy Grain', exact: true })).toBeEnabled();
  });
});

test.describe('market: per-good row refresh (#73/#74/#127)', () => {
  test('qty defaults to the current max, and the player can dial it down', async ({ page }) => {
    const world = fundedWorld('market-qty-default');
    const { name } = homePort(world);

    await continueWithWorld(page, world);
    await openMarket(page, name);

    const grainRow = page.locator('.market-row').filter({ hasText: 'Grain' });
    const qtyInput = grainRow.getByRole('spinbutton', { name: /grain quantity/i });

    // Flush purse (100k) and an empty hold: buyMax is the binding max, well
    // above the old hardcoded default of 1.
    const initialValue = Number(await qtyInput.inputValue());
    expect(initialValue).toBeGreaterThan(1);

    // Player dials it down — Kup then acts on the lowered qty, not the max.
    await qtyInput.fill('4');
    const buyButton = grainRow.getByRole('button', { name: 'Buy Grain', exact: true });
    await expect(buyButton).toContainText('Kup');
    await buyButton.click();

    await page.locator('.fleet-list__item--controlled').click();
    await expect(page.locator('.hold')).toContainText('Grain');
    await expect(page.locator('.hold')).toContainText('4');
  });

  test('dedicated "Buy max"/"Sell max" buttons are gone from the trade line', async ({ page }) => {
    const world = fundedWorld('market-no-max-buttons');
    const { name } = homePort(world);

    await continueWithWorld(page, world);
    await openMarket(page, name);

    const grainRow = page.locator('.market-row').filter({ hasText: 'Grain' });
    await expect(grainRow.getByRole('button', { name: /buy max/i })).toHaveCount(0);
    await expect(grainRow.getByRole('button', { name: /sell max/i })).toHaveCount(0);
    // The Sell action's aria-label stays "Sell <good>" (existing selector
    // contract); its visible text is the Polish "Sprzedaj" label.
    await expect(grainRow.getByRole('button', { name: 'Sell Grain', exact: true })).toContainText(
      'Sprzedaj',
    );
  });

  test('in-hold marker shows the carried quantity for a good aboard the ship', async ({ page }) => {
    const world = fundedWorld('market-in-hold-marker');
    const { name } = homePort(world);

    await continueWithWorld(page, world);
    await openMarket(page, name);

    const grainRow = page.locator('.market-row').filter({ hasText: 'Grain' });
    // Nothing aboard yet — no marker.
    await expect(grainRow.locator('.market-row__held')).toHaveCount(0);

    const qtyInput = grainRow.getByRole('spinbutton', { name: /grain quantity/i });
    await qtyInput.fill('7');
    await grainRow.getByRole('button', { name: 'Buy Grain', exact: true }).click();

    await expect(grainRow.locator('.market-row__held')).toContainText('7');
  });

  test('trend glyph carries a legend explaining the last-day-boundary comparison (#127)', async ({
    page,
  }) => {
    const world = fundedWorld('market-trend-legend');
    const { name } = homePort(world);

    await continueWithWorld(page, world);
    await openMarket(page, name);

    // The Trend column header and every glyph carry the same tooltip; it
    // must state the real comparison (last day boundary) and explicitly
    // rule out the fresh-player misread ("initial price").
    const headerTitle = await page.locator('.market__header span', { hasText: 'Trend' }).getAttribute('title');
    expect(headerTitle).toContain('ostatniej granicy dnia');
    expect(headerTitle).toContain('nie ceny początkowej');

    const glyphTitle = await page.locator('.market-row__trend').first().getAttribute('title');
    expect(glyphTitle).toBe(headerTitle);
  });
});
