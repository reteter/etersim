import { test, expect, type Page } from '@playwright/test';
import {
  createWorld,
  ENROLLMENT_FEE,
  HEADQUARTERS_COST,
  type ActiveContract,
  type Company,
  type Port,
  type World,
} from '../src/sim';
import { SAVE_VERSION } from '../src/store/persistence';

/**
 * Guildhouse section + notice strip E2E (#97, docs/specs/E3-contracts-and-guilds.md
 * — UX skeleton). Worlds are hand-built directly (same precedent as
 * e2e/market.spec.ts, e2e/headquarters.spec.ts) so enrollment preconditions
 * (Headquarters, funds) and an about-to-settle contract are exact and
 * deterministic rather than ground out over real play time.
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

function escapeRegExp(text: string): string {
  return text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/** Opens a port's panel via the map (#33: port selection is the only path). */
async function openPort(page: Page, portName: string) {
  const exact = new RegExp(`^${escapeRegExp(portName)}$`);
  await page
    .locator('g.port')
    .filter({ has: page.locator('.port__label', { hasText: exact }) })
    .click({ force: true });
  await expect(page.locator('.guildhouse-section')).toBeVisible();
}

/** The first non-freeport port in a World's region — every such port hosts a
 *  guildhouse (CONTEXT.md — Guildhouse); the Free port hosts none. */
function guildSeatPort(world: World): Port {
  const port = world.region.ports.find((p) => p.archetype !== 'freeport');
  if (!port) throw new Error('fixture region has no non-freeport port');
  return port;
}

function fundedWorld(seed: string, thalers: number): World {
  const w = createWorld(seed);
  return { ...w, company: { ...w.company, thalers } };
}

test.describe('Guildhouse section (#97)', () => {
  test('enroll is disabled pre-Headquarters with a Polish reason', async ({ page }) => {
    const world = fundedWorld('guildhouse-no-hq', 100_000);
    const port = guildSeatPort(world);
    await continueWithWorld(page, world);
    await openPort(page, port.name);

    const enrollBtn = page.getByRole('button', { name: `Wstąp do gildii — ₸${ENROLLMENT_FEE}` });
    await expect(enrollBtn).toBeDisabled();
    await expect(enrollBtn).toHaveAttribute('title', 'Wymaga założonej siedziby');
  });

  test('enroll is disabled when unaffordable, with a Polish reason', async ({ page }) => {
    const w = fundedWorld('guildhouse-poor', HEADQUARTERS_COST + 10_000);
    const port = guildSeatPort(w);
    const company: Company = {
      ...w.company,
      headquarters: { portId: port.id },
      thalers: ENROLLMENT_FEE - 1,
    };
    const world: World = { ...w, company };
    await continueWithWorld(page, world);
    await openPort(page, port.name);

    const enrollBtn = page.getByRole('button', { name: `Wstąp do gildii — ₸${ENROLLMENT_FEE}` });
    await expect(enrollBtn).toBeDisabled();
    await expect(enrollBtn).toHaveAttribute('title', `Za mało thalerów (₸${ENROLLMENT_FEE})`);
  });

  test('founded and funded: enroll executes and shows the rank badge + points progress', async ({
    page,
  }) => {
    const w = fundedWorld('guildhouse-enroll', HEADQUARTERS_COST + ENROLLMENT_FEE + 10_000);
    const port = guildSeatPort(w);
    const company: Company = { ...w.company, headquarters: { portId: port.id } };
    const world: World = { ...w, company };
    await continueWithWorld(page, world);
    await openPort(page, port.name);

    await page.getByRole('button', { name: `Wstąp do gildii — ₸${ENROLLMENT_FEE}` }).click();

    await expect(page.locator('.rank-badge')).toHaveText('1');
    await expect(page.locator('.rank-progress__count')).toHaveText('0 / 4 pkt');
  });

  test('an enrolled guild with mid-rank points renders the correct rank badge and progress', async ({
    page,
  }) => {
    const w = fundedWorld('guildhouse-rank2', HEADQUARTERS_COST + 10_000);
    const port = guildSeatPort(w);
    const company: Company = {
      ...w.company,
      headquarters: { portId: port.id },
      guilds: { [port.archetype as 'agrarian']: { points: 5 } },
    };
    const world: World = { ...w, company };
    await continueWithWorld(page, world);
    await openPort(page, port.name);

    await expect(page.locator('.rank-badge')).toHaveText('2');
    await expect(page.locator('.rank-progress__count')).toHaveText('5 / 10 pkt');
  });
});

test.describe('Notice strip (#97, 2026-07-14 UI grill lock 1)', () => {
  test('a settlement notice fires in a seeded fast scenario, and opening the board marks it seen', async ({
    page,
  }) => {
    const w = fundedWorld('guildhouse-notice', HEADQUARTERS_COST + 10_000);
    const port = guildSeatPort(w);
    const guildId = port.archetype as 'agrarian';
    // periodDays 1 (24 ticks) so a single day boundary settles it; delivered
    // == quota so the very first settlement is a "met" event (deterministic,
    // no player action needed to trigger the notice).
    const contract: ActiveContract = {
      id: `${guildId}:notice-contract`,
      guildId,
      portId: port.id,
      good: 'grain',
      quotaPerPeriod: 10,
      periodDays: 1,
      minPeriods: 1,
      feePerPeriod: 20,
      tier: 1,
      basis: { sourcePortId: port.id, roundTripTicks: 10, expectedTrips: 1 },
      startTick: 0,
      periodIndex: 0,
      deliveredThisPeriod: 10,
      consecutiveMisses: 0,
    };
    const company: Company = {
      ...w.company,
      headquarters: { portId: port.id },
      guilds: { [guildId]: { points: 0 } },
      contracts: [contract],
    };
    const world: World = { ...w, company };
    await continueWithWorld(page, world);

    await page.getByRole('button', { name: '100x' }).click();
    await page.waitForTimeout(700); // >> 24 ticks at 100x — crosses the day boundary

    await expect(page.locator('.notice-strip__badge')).toBeVisible();

    // Pause before marking seen — periodDays 1 means another boundary is only
    // ~240ms away at 100x; pausing first keeps the "marked seen" assertion
    // from racing a second settlement event.
    await page.getByRole('button', { name: '⏸' }).click();
    await page.getByRole('button', { name: 'Powiadomienia' }).click();
    await expect(page.locator('.overlay__panel')).toBeVisible();
    await expect(page.locator('.notice-strip__badge')).toHaveCount(0);
  });
});
