import { test, expect, type Page } from '@playwright/test';
import {
  applyCommand,
  createWorld,
  GOODS,
  nextHoldStep,
  refitRecipe,
  type GoodId,
  type Ship,
  type World,
} from '../src/sim';
import { SAVE_VERSION } from '../src/store/persistence';

/**
 * Shipyard & Refit UI E2E (#276, docs/specs/E14-shipyard-and-refit.md). Same
 * save-injection harness as headquarters.spec.ts: seed the autosave slot with
 * a hand-built World, boot via the StartScreen's Continue, then drive the
 * flow under test through the real UI. The commission→build→activate→refit
 * chain is too long/flaky to run end-to-end in one test, so the slow
 * preconditions (a built Shipyard, an active RefitOrder) are hand-built while
 * the tested action always goes through a Command.
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

/** A funded World with a founded Headquarters at ports[0] and s0 docked
 *  there — the precondition for commissioning a Shipyard (needs an HQ). */
function foundedWorld(seed: string, thalers = 100_000): { world: World; portId: string } {
  const w0 = createWorld(seed);
  const portId = w0.region.ports[0].id;
  const funded: World = { ...w0, company: { ...w0.company, thalers } };
  const ship: Ship = { ...funded.company.ships[0], location: { kind: 'docked', portId } };
  const withShip: World = { ...funded, company: { ...funded.company, ships: [ship] } };
  return { world: applyCommand(withShip, { kind: 'foundHeadquarters', portId }), portId };
}

/** A funded World whose Shipyard is already built (no `site`) at ports[0],
 *  with s0 docked there — ready to start a Refit through the UI. */
function builtShipyardWorld(seed: string): { world: World; portId: string } {
  const { world: w, portId } = foundedWorld(seed);
  const world: World = {
    ...w,
    company: { ...w.company, shipyard: { portId } },
  };
  return { world, portId };
}

function emptySiteStore(): Record<GoodId, number> {
  return { grain: 0, textiles: 0, aetherSalt: 0, electronics: 0, timber: 0 };
}

/** A funded World with an active RefitOrder on s0 (docked at the Shipyard
 *  port), its site partly filled — grain 50 of the recipe's grain 100. */
function refitInProgressWorld(seed: string): {
  world: World;
  portId: string;
  ship: Ship;
  targetHold: number;
  required: number;
} {
  const { world: w, portId } = builtShipyardWorld(seed);
  const ship = w.company.ships[0];
  const targetHold = nextHoldStep(ship)!; // 50 -> 100
  const recipe = refitRecipe(ship);
  const required = (Object.values(recipe) as number[]).reduce((a, b) => a + b, 0);
  const siteStore = { ...emptySiteStore(), grain: 50 };
  const world: World = {
    ...w,
    company: {
      ...w.company,
      shipyard: { portId, refitOrder: { shipId: ship.id, targetHold, siteStore } },
    },
  };
  return { world, portId, ship, targetHold, required };
}

test.describe('Shipyard commission (#276)', () => {
  test('commission button at a port opens the estimate → confirm → the site progress renders', async ({
    page,
  }) => {
    const { world } = foundedWorld('shipyard-commission');
    await continueWithWorld(page, world);

    // Open the HQ port's panel — the Shipyard section offers the commission
    // button (HQ exists, no Shipyard yet).
    await page.locator('g.port').first().click({ force: true });
    const section = page.locator('.shipyard-section');
    await expect(section.getByRole('heading', { name: 'Stocznia' })).toBeVisible();

    const commissionBtn = section.getByRole('button', { name: /Zbuduj stocznię/ });
    await expect(commissionBtn).toBeEnabled();

    // Estimate breakdown: 5 goods + labor fee, "at today's prices".
    await expect(section.locator('.build-estimate__lines li')).toHaveCount(6);
    await expect(section).toContainText(/Szacunkowy koszt: ₸\d+ \(przy dzisiejszych cenach\)/);

    // Confirmation step, then the Shipyard's own build site takes over.
    await commissionBtn.click();
    await section.getByRole('button', { name: /Potwierdź — ₸\d/ }).click();
    await expect(section).toContainText('Stocznia w budowie');
    await expect(section.locator('.headquarters-progress__row')).toHaveCount(5);
    await expect(section.getByRole('button', { name: /Dokup resztę — ₸\d/ })).toBeVisible();
  });
});

test.describe('Refit start (#276)', () => {
  test('a built Shipyard offers the refit picker; starting shows target Hold + site progress', async ({
    page,
  }) => {
    const { world } = builtShipyardWorld('shipyard-refit-start');
    const s0Name = world.company.ships[0].name;
    await continueWithWorld(page, world);

    await page.locator('g.port').first().click({ force: true });
    const section = page.locator('.shipyard-section');
    await expect(section.getByRole('heading', { name: 'Stocznia' })).toBeVisible();

    // Pick s0 in the refit picker → target Hold (50 -> 100) + estimate appear.
    await section.locator('.shipyard-refit__ship').selectOption({ label: s0Name });
    await expect(section).toContainText('Ładownia: 50 → 100');
    await expect(section.locator('.build-estimate__lines li')).toHaveCount(6);

    // Start the Refit → the section flips to the active-refit view.
    await section.getByRole('button', { name: /Rozpocznij przebudowę — ₸500/ }).click();
    await expect(section).toContainText(`${s0Name} w przebudowie — ładownia → 100`);
    await expect(section.locator('.headquarters-progress__row')).toHaveCount(5);
    await expect(section.getByRole('button', { name: /Dokup resztę — ₸\d/ })).toBeVisible();
  });
});

test.describe('Refit — map bubble, fleet status, sail lock (#276)', () => {
  test('the map shows a refit bubble with progress + tooltip; the Fleet flags "w przebudowie"; sail is locked', async ({
    page,
  }) => {
    const { world, ship, targetHold, required } = refitInProgressWorld('shipyard-refit-live');
    await continueWithWorld(page, world);

    // Map bubble: an aria-labelled progressbar with the recipe's totals.
    const bubble = page.locator('svg.region-map .refit-bubble__track');
    await expect(bubble).toHaveAttribute('role', 'progressbar');
    await expect(bubble).toHaveAttribute('aria-valuenow', '50');
    await expect(bubble).toHaveAttribute('aria-valuemax', String(required));

    // Tooltip (<title>): target Hold + per-good remaining.
    const title = page.locator('svg.region-map .region-map__refit-bubble title');
    await expect(title).toContainText(`ładownia → ${targetHold}`);
    await expect(title).toContainText(`${GOODS.grain.name} 50`); // 100 needed, 50 in

    // Fleet list flags the refit state (its own status color).
    const status = page.locator('.fleet-list__item .fleet-list__status--refit');
    await expect(status).toContainText('w przebudowie');

    // Sail action is locked with a reason. Open a *different* port so the
    // normal path (docked elsewhere, course exists) would otherwise enable it.
    await page.locator('g.port').nth(1).click({ force: true });
    const sailBtn = page.getByRole('button', { name: new RegExp(`Sail ${ship.name} here`) });
    await expect(sailBtn).toBeDisabled();
    await expect(sailBtn).toHaveAttribute('title', /przebudowie/);
  });
});
