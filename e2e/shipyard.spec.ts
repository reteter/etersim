import { test, expect, type Page } from '@playwright/test';
import { applyCommand, createWorld, generateShipName, type Ship, type World } from '../src/sim';
import { SAVE_VERSION } from '../src/store/persistence';

/**
 * PortPanel Shipyard section + map refit bubble + "w przebudowie" status E2E
 * (#276). Mirrors `headquarters.spec.ts`'s save-injection harness: the
 * default starting purse can't afford a Headquarters within a test's time
 * budget, so these tests seed the autosave slot with a hand-built World
 * before booting the app, then drive commission/Refit through the same UI a
 * player uses.
 */

const AUTOSAVE_KEY = 'etersim.autosave';
const S0_NAME = generateShipName(0);

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

/** A funded World with the Headquarters already founded — thalers bumped so
 *  commissioning the Shipyard and rushing its full Recipe are affordable
 *  within a test. */
function foundedWorld(seed: string, thalers = 200_000): World {
  const w0 = createWorld(seed);
  const funded: World = { ...w0, company: { ...w0.company, thalers } };
  const portId = funded.region.ports[0].id;
  return applyCommand(funded, { kind: 'foundHeadquarters', portId });
}

/** A founded World with a fully-built (activated, `site` cleared) Shipyard
 *  at its second port, and s0 docked there — everything a Refit needs, built
 *  through real Commands (not the UI) so the Refit tests themselves can
 *  focus on what #276 actually adds. Mirrors `src/sim/shipyard.test.ts`'s
 *  `richWithShipyard` fixture. */
function worldWithBuiltShipyard(seed: string, thalers = 200_000): { world: World; shipyardPortId: string } {
  const founded = foundedWorld(seed, thalers);
  const shipyardPortId = founded.region.ports[1].id;
  let w = applyCommand(founded, { kind: 'commissionShipyard', portId: shipyardPortId });
  let guard = 0;
  while (w.company.shipyard?.site && guard++ < 500) {
    w = applyCommand(w, { kind: 'rushShipyard' });
    if (w.company.shipyard?.site) w = { ...w, tick: w.tick + 24 }; // let auto-draw's daily cap replenish
  }
  const s0: Ship = { ...w.company.ships[0], location: { kind: 'docked', portId: shipyardPortId } };
  w = { ...w, company: { ...w.company, ships: [s0] } };
  return { world: w, shipyardPortId };
}

test.describe('Shipyard commission — PortPanel section (#276)', () => {
  test('commission from PortPanel → progress renders; rush completes it and the Refit picker takes over', async ({
    page,
  }) => {
    await continueWithWorld(page, foundedWorld('shipyard-commission'));

    await page.locator('g.port').nth(1).click({ force: true });
    const commissionBtn = page.getByRole('button', { name: /Zbuduj stocznię — ₸\d/ });
    await expect(commissionBtn).toBeEnabled();
    await commissionBtn.click();

    const confirmBtn = page.getByRole('button', { name: /Potwierdź — ₸\d/ });
    await expect(confirmBtn).toBeVisible();
    await confirmBtn.click();
    await expect(commissionBtn).toHaveCount(0); // pre-commission branch gone once commissioned

    // Per-good progress bars render, one per good.
    await expect(page.locator('.shipyard-section .headquarters-progress__row')).toHaveCount(5);

    // Rush shows a live quote and executes: the purse drops by exactly the
    // quoted amount, same guarantee as the Headquarters rush (#84).
    const rushBtn = page.getByRole('button', { name: /Rush the rest — ₸\d/ });
    await expect(rushBtn).toBeVisible();
    const rushLabel = (await rushBtn.textContent()) ?? '';
    const quoted = Number(rushLabel.replace(/[^\d]/g, ''));
    expect(quoted).toBeGreaterThan(0);
    const beforeThalers = Number((await page.locator('.top-bar__thalers').innerText()).replace(/[^\d]/g, ''));
    await rushBtn.click();
    const afterThalers = Number((await page.locator('.top-bar__thalers').innerText()).replace(/[^\d]/g, ''));
    expect(beforeThalers - afterThalers).toBe(quoted);

    // Deep purse rushes the whole Recipe in one shot — the site activates,
    // and this port's own panel (the Shipyard's port) now shows the Refit
    // picker instead of build progress.
    await expect(page.locator('.shipyard-section .headquarters-progress__row')).toHaveCount(0);
    await expect(page.locator('.shipyard-section')).toContainText(/kwalifikujących się do przebudowy|Wybierz statek/);
  });

  test('while the Shipyard is under construction, HQ "Zleć budowę" is disabled with a reason (#293 F1)', async ({
    page,
  }) => {
    const founded = foundedWorld('shipyard-hq-gate');
    const w = applyCommand(founded, {
      kind: 'commissionShipyard',
      portId: founded.region.ports[1].id,
    });
    await continueWithWorld(page, w);

    await page.getByRole('button', { name: /^Headquarters$/ }).click();
    const dialog = page.getByRole('dialog', { name: /headquarters/i });
    const placeBtn = dialog.getByRole('button', { name: /Zleć budowę/ });
    await expect(placeBtn).toBeDisabled();
    await expect(placeBtn).toHaveAttribute('title', /stoczni/);
  });

  test('while a ship build is active at the HQ, Shipyard commission names ship construction (#293 F2)', async ({
    page,
  }) => {
    const founded = foundedWorld('shipyard-hq-buildorder');
    const w = applyCommand(founded, { kind: 'placeBuildOrder' });
    await continueWithWorld(page, w);

    await page.locator('g.port').nth(1).click({ force: true });
    const commissionBtn = page.getByRole('button', { name: /Zbuduj stocznię — ₸\d/ });
    await expect(commissionBtn).toBeDisabled();
    await expect(commissionBtn).toHaveAttribute('title', /statku/);
  });

  test('commission is gated on an existing Headquarters and the labor fee + Reserve (#122)', async ({ page }) => {
    const w0 = createWorld('shipyard-nohq');
    await continueWithWorld(page, w0);
    await page.locator('g.port').first().click({ force: true });
    const commissionBtn = page.getByRole('button', { name: /Zbuduj stocznię — ₸\d/ });
    await expect(commissionBtn).toBeDisabled();
    await expect(commissionBtn).toHaveAttribute('title', /siedziby/);
  });
});

test.describe('Refit — PortPanel picker, progress, map bubble, fleet status, sail lock (#276)', () => {
  test('start a Refit → progress + per-good remaining render; map bubble shows progress; FleetList shows "w przebudowie"; Sail is locked; rushing completes it', async ({
    page,
  }) => {
    const { world } = worldWithBuiltShipyard('shipyard-refit');
    await continueWithWorld(page, world);

    await page.locator(`g.port[data-archetype]`).nth(1).click({ force: true }); // the Shipyard's own port (index 1, same as the fixture)
    const picker = page.getByLabel('Wybierz statek do przebudowy');
    await expect(picker).toBeVisible();
    await picker.selectOption({ label: S0_NAME });

    // Estimate renders before confirming (computeBuildEstimate pattern).
    await expect(page.locator('.shipyard-section')).toContainText(/Szacunkowy koszt: ₸\d+/);
    const startBtn = page.getByRole('button', { name: /Rozpocznij przebudowę — ₸\d/ });
    await expect(startBtn).toBeEnabled();
    await startBtn.click();
    await expect(page.getByRole('button', { name: /Potwierdź — ₸\d/ })).toBeVisible();
    await page.getByRole('button', { name: /Potwierdź — ₸\d/ }).click();

    // Progress renders (per-good rows, one per good) and the picker is gone.
    await expect(page.locator('.shipyard-section .headquarters-progress__row')).toHaveCount(5);
    await expect(picker).toHaveCount(0);

    // Map bubble (spec: "a bubble with a small progress bar" + tooltip with
    // target Hold + per-good remaining) — right after starting, progress is
    // 0/required (nothing delivered yet).
    const bubble = page.locator('.refit-bubble');
    await expect(bubble).toBeVisible();
    const bar = bubble.locator('[role="progressbar"]');
    await expect(bar).toHaveAttribute('aria-valuenow', '0');
    const maxAttr = await bar.getAttribute('aria-valuemax');
    expect(Number(maxAttr)).toBeGreaterThan(0);
    await expect(bubble).toHaveAttribute('data-target-hold', '100'); // baseHold 50 -> first rung 100
    const remainingAttr = await bubble.getAttribute('data-remaining');
    expect(remainingAttr).toContain('grain:');

    // FleetList status (#276 AC3).
    await expect(page.locator('.fleet-list__item').first()).toContainText('W przebudowie');
    await expect(page.locator('.fleet-list__status--refit')).toHaveCount(1);

    // Sail is locked while under Refit — same PortPanel, s0's own port.
    const sailBtn = page.getByRole('button', { name: new RegExp(`Sail ${S0_NAME} here`) });
    await expect(sailBtn).toBeDisabled();
    await expect(sailBtn).toHaveAttribute('title', /przebudowie/);

    // Rush completes it: the bubble disappears, the lock lifts, and the
    // ShipPanel's own status line clears. The Sail button stays disabled
    // (s0 is still docked right here, at the Shipyard's own port — "already
    // docked" is a different, unrelated disabled reason), but the Refit
    // lock's reason is gone.
    const rushBtn = page.getByRole('button', { name: /Rush the rest — ₸\d/ });
    await rushBtn.click();
    await expect(bubble).toHaveCount(0);
    await expect(page.locator('.fleet-list__status--refit')).toHaveCount(0);
    await expect(sailBtn).not.toHaveAttribute('title', /przebudowie/);
  });

  test('a ship not docked at the Shipyard port is not offered in the Refit picker', async ({ page }) => {
    const { world, shipyardPortId } = worldWithBuiltShipyard('shipyard-refit-elsewhere');
    const otherPortId = world.region.ports.find((p) => p.id !== shipyardPortId)?.id ?? world.region.ports[0].id;
    const relocated: World = {
      ...world,
      company: {
        ...world.company,
        ships: [{ ...world.company.ships[0], location: { kind: 'docked', portId: otherPortId } }],
      },
    };
    await continueWithWorld(page, relocated);

    await page.locator(`g.port`).nth(1).click({ force: true });
    await expect(page.locator('.shipyard-section')).toContainText(/kwalifikujących się do przebudowy/);
    await expect(page.getByLabel('Wybierz statek do przebudowy')).toHaveCount(0);
  });
});
