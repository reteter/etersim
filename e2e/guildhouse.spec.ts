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
    // 300ms at 100x (~30 ticks) crosses the first day boundary (24 ticks,
    // settling the "met" period and resetting deliveredThisPeriod to 0) but
    // stops short of the second (48 ticks) — past that, an unattended
    // contract starts missing periods and eventually breaches (removed from
    // company.contracts), which would make the assertion below flaky.
    await page.waitForTimeout(300);

    await expect(page.locator('.notice-strip__badge')).toBeVisible();

    // Pause before marking seen, to freeze the tick count the assertions below rely on.
    await page.getByRole('button', { name: '⏸' }).click();
    await page.getByRole('button', { name: 'Powiadomienia' }).click();
    // Opens straight on Kontrakty (initialTab), where the settlement lives —
    // not the default Ceny tab a plain "Price Board" click would land on.
    await expect(page.getByRole('tab', { name: 'Kontrakty' })).toHaveAttribute(
      'aria-selected',
      'true',
    );
    await expect(page.locator('.kontrakty-contract')).toBeVisible();
    await expect(page.locator('.notice-strip__badge')).toHaveCount(0);
  });

  test('wiring guard: Powiadomienia while the board is already open on Ceny still switches to Kontrakty and marks seen (#195 rider 1) — see reviewer-attention item on real-world reachability', async ({
    page,
  }) => {
    const w = fundedWorld('guildhouse-notice-retab', HEADQUARTERS_COST + 10_000);
    const port = guildSeatPort(w);
    const guildId = port.archetype as 'agrarian';
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
    await page.waitForTimeout(300); // crosses the first day boundary, same as above
    await expect(page.locator('.notice-strip__badge')).toBeVisible();
    await page.getByRole('button', { name: '⏸' }).click();

    // Open the board on its default Ceny tab first (the "Price Board"
    // button, unrelated entry point) — this is the state the rider fixes:
    // the board is already open, on the wrong tab, when the notice is clicked.
    await page.getByRole('button', { name: 'Price Board' }).click();
    await expect(page.getByRole('tab', { name: 'Ceny' })).toHaveAttribute('aria-selected', 'true');

    // dispatchEvent, not click() (reviewer-attention item — see completion
    // report): OverlayShell's backdrop (`.overlay { position: fixed; inset:
    // 0 }`, aria-modal="true") fully covers the viewport including the
    // TopBar behind it, so this exact mouse click is NOT reachable by a real
    // pointer today — `page.click()` times out ("overlay intercepts pointer
    // events") and even `{ force: true }` lands on the backdrop and closes
    // the board instead (Playwright still hit-tests the click coordinates).
    // dispatchEvent fires the click directly on the notice-strip element,
    // bubbling through its real ancestors (the overlay is a DOM *sibling*,
    // never reached) — a genuine regression guard on the controlled-tab
    // wiring, not a stand-in for the literal user-facing repro, which is
    // presently unreachable and flagged separately for the Orchestrator.
    await page.getByRole('button', { name: 'Powiadomienia' }).dispatchEvent('click');

    await expect(page.getByRole('tab', { name: 'Kontrakty' })).toHaveAttribute(
      'aria-selected',
      'true',
    );
    await expect(page.locator('.kontrakty-contract')).toBeVisible();
    await expect(page.locator('.notice-strip__badge')).toHaveCount(0);
  });
});
