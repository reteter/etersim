import { test, expect, type Locator, type Page } from '@playwright/test';
import { createWorld, generateShipName, GOODS, type Ship, type World } from '../src/sim';
import { SAVE_VERSION } from '../src/store/persistence';
import { DEFAULT_SETTINGS, SETTINGS_KEY, SETTINGS_VERSION, type Settings } from '../src/store/settings';

/** The first ship's display name (src/sim/world.ts createWorld: `id: "s0"`,
 *  `name: generateShipName(0)`) — ship ids and display names diverged once
 *  #54/#118 shipped named ships, so UI-facing assertions (dropdown labels,
 *  panel text) must match the *name*, not the id. */
const S0_NAME = generateShipName(0);

/**
 * Headquarters panel E2E (#84, #85). The default starting purse (₸500,
 * src/sim/world.ts STARTING_THALERS) can't afford the Headquarters
 * (₸2,500) or produce a fast route loop within a test's time budget, so
 * these tests seed the autosave slot with a hand-built World (funded purse,
 * s0 docked at a known port) before booting the app, then drive founding /
 * route creation / assignment through the same UI a player uses. This
 * matches the save format exactly (src/store/persistence.ts SaveFile
 * envelope), so `Continue` on the StartScreen loads it like any other save.
 */

const AUTOSAVE_KEY = 'etersim.autosave';

/** A funded World: default worldgen, thalers bumped so founding + a Build
 *  Order + a rush are all affordable within the test. */
function fundedWorld(seed: string, thalers = 100_000): World {
  const w = createWorld(seed);
  return { ...w, company: { ...w.company, thalers } };
}

/** A funded World with s0 docked at one end of its shortest lane, and a
 *  ready-to-assign two-Stop Route already created (buy grain at `a`, sell
 *  grain at `b`) — the route is still *assigned* through the UI so #85's
 *  ACs (assign, suspend/resume visibility, loop metrics) exercise the real
 *  Command path; only the setup that a player can't reach in reasonable
 *  test time (thalers, ship placement) is hand-built. */
function routeReadyWorld(seed: string): { world: World; a: string; b: string; laneTicks: number } {
  const w0 = fundedWorld(seed);
  const lane = [...w0.region.lanes].sort((x, y) => x.voyageTicks - y.voyageTicks)[0];
  const ship: Ship = { ...w0.company.ships[0], location: { kind: 'docked', portId: lane.a } };
  const world: World = { ...w0, company: { ...w0.company, ships: [ship] } };
  return { world, a: lane.a, b: lane.b, laneTicks: lane.voyageTicks };
}

function saveJson(world: World): string {
  return JSON.stringify({ version: SAVE_VERSION, world });
}

/** Seeds the autosave slot before the app boots, then loads it via the
 *  StartScreen's real Continue button (never bypasses the store's own
 *  load path). Pass `settings` to also seed the `etersim.settings` slot
 *  (loaded once at store init) — used to pin a player preference like
 *  auto-pause off for a scenario whose subject is something else. */
async function continueWithWorld(page: Page, world: World, settings?: Partial<Settings>) {
  const settingsJson = settings
    ? JSON.stringify({
        version: SETTINGS_VERSION,
        settings: { ...DEFAULT_SETTINGS, ...settings },
      })
    : null;
  await page.addInitScript(
    ({ key, json, settingsKey, settingsJson }) => {
      window.localStorage.setItem(key, json);
      if (settingsJson) window.localStorage.setItem(settingsKey, settingsJson);
    },
    { key: AUTOSAVE_KEY, json: saveJson(world), settingsKey: SETTINGS_KEY, settingsJson },
  );
  await page.goto('/');
  await page.getByRole('button', { name: /continue/i }).click();
  await expect(page.locator('svg.region-map')).toBeVisible();
}

/** Drives the Trasy tab's editor through the canonical two-Stop route —
 *  buy grain at `a` (Stop 1), sell grain at `b` (Stop 2) — and saves it. */
async function createGrainRoute(dialog: Locator, a: string, b: string) {
  await dialog.getByRole('button', { name: /^New route$/ }).click();
  await dialog.getByRole('button', { name: /^Add stop$/ }).click();
  await dialog.getByRole('button', { name: /^Add stop$/ }).click();

  const stopRows = dialog.locator('.stop-row');
  await expect(stopRows).toHaveCount(2);
  await stopRows.nth(0).locator('select').selectOption(a);
  await stopRows
    .nth(0)
    .getByRole('button', { name: new RegExp(`^${GOODS.grain.name} buy at Stop 1$`) })
    .click();
  await stopRows.nth(1).locator('select').selectOption(b);
  await stopRows
    .nth(1)
    .getByRole('button', { name: new RegExp(`^${GOODS.grain.name} sell at Stop 2$`) })
    .click();

  const saveBtn = dialog.getByRole('button', { name: /^Save route$/ });
  await expect(saveBtn).toBeEnabled();
  await saveBtn.click();
}

test.describe('save-injection harness smoke test', () => {
  test('a funded World loads via Continue with the founding button enabled', async ({ page }) => {
    await continueWithWorld(page, fundedWorld('hq-smoke'));
    await page.locator('g.port').first().click({ force: true });
    await expect(page.getByRole('button', { name: /Załóż siedzibę/ })).toBeEnabled();
  });

  test('founding is gated at cost + Reserve: ₸2,999 disables the button (#122)', async ({ page }) => {
    await continueWithWorld(page, fundedWorld('hq-gate', 2_999));
    await page.locator('g.port').first().click({ force: true });
    const foundBtn = page.getByRole('button', { name: /Załóż siedzibę/ });
    await expect(foundBtn).toBeDisabled();
    await expect(foundBtn).toHaveAttribute('title', /rezerwa/);
  });
});

test.describe('Headquarters — Budowa tab (#84)', () => {
  test('found from PortPanel → TopBar shortcut appears; place order → progress renders; rush shows quote and executes', async ({
    page,
  }) => {
    await continueWithWorld(page, fundedWorld('hq-budowa'));

    // Found from a port's own panel — every port shows the button pre-founding.
    await page.locator('g.port').first().click({ force: true });
    const foundBtn = page.getByRole('button', { name: /Załóż siedzibę — ₸2,?500/ });
    await expect(foundBtn).toBeEnabled();
    await foundBtn.click();
    await expect(foundBtn).toHaveCount(0); // founding button gone once founded

    // TopBar shortcut appears once founded.
    const headquartersBtn = page.getByRole('button', { name: /^Headquarters$/ });
    await expect(headquartersBtn).toBeVisible();

    // PortPanel's Headquarters section shows a build progress bar once a
    // build exists — place one from the panel first.
    await headquartersBtn.click();
    const dialog = page.getByRole('dialog', { name: /headquarters/i });
    await expect(dialog).toBeVisible();
    const placeBtn = dialog.getByRole('button', { name: /Zleć budowę/ });
    await expect(placeBtn).toBeEnabled();

    // Pre-build estimate breakdown renders "at today's prices" (#122).
    await expect(dialog.locator('.build-estimate__lines li')).toHaveCount(6); // 5 goods + labor fee
    await expect(dialog).toContainText(/Szacunkowy koszt: ₸\d+ \(przy dzisiejszych cenach\)/);

    // Placing goes through a confirmation step (#122) — no warning here:
    // the purse (₸100,000) comfortably covers the estimate.
    await placeBtn.click();
    const confirmBtn = dialog.getByRole('button', { name: /Potwierdź — ₸\d/ });
    await expect(confirmBtn).toBeVisible();
    await expect(dialog.locator('.headquarters-stall')).toHaveCount(0);
    await confirmBtn.click();
    await expect(placeBtn).toBeDisabled(); // disabled while a build runs

    // Per-good progress bars render, one per good.
    await expect(dialog.locator('.headquarters-progress__row')).toHaveCount(5);

    // The HQ port's own PortPanel also shows the progress section (design:
    // "readable from the port level") — checked *before* rushing, since a
    // deep-purse rush can complete the whole recipe in one shot and launch
    // the ship, clearing buildOrder (and this section along with it).
    await dialog.getByRole('button', { name: /^Close$/ }).click();
    await page.locator('g.port').first().click({ force: true });
    await expect(page.locator('.headquarters-section .headquarters-progress__row')).toHaveCount(5);
    await page.getByRole('button', { name: /^Headquarters$/ }).click();
    const dialog2 = page.getByRole('dialog', { name: /headquarters/i });

    // Rush shows a live quote (nonzero — deep purse, nothing bought yet)
    // and executes: the purse drops by exactly the quoted amount.
    const rushBtn = dialog2.getByRole('button', { name: /Rush the rest — ₸\d/ });
    await expect(rushBtn).toBeVisible();
    const rushLabel = (await rushBtn.textContent()) ?? '';
    const quoted = Number(rushLabel.replace(/[^\d]/g, ''));
    expect(quoted).toBeGreaterThan(0);

    const beforeThalers = Number((await page.locator('.top-bar__thalers').innerText()).replace(/[^\d]/g, ''));
    await rushBtn.click();
    const afterThalers = Number((await page.locator('.top-bar__thalers').innerText()).replace(/[^\d]/g, ''));
    expect(beforeThalers - afterThalers).toBe(quoted);
  });

  test('thin purse: the confirmation step warns the build will stall at the Reserve (#122)', async ({
    page,
  }) => {
    // ₸4,000: founding (₸2,500) and the labor fee (₸800) both clear their
    // Reserve gates, but the estimate (≈₸8,000) far exceeds what remains.
    await continueWithWorld(page, fundedWorld('hq-thin', 4_000));
    await page.locator('g.port').first().click({ force: true });
    await page.getByRole('button', { name: /Załóż siedzibę/ }).click();
    await page.getByRole('button', { name: /^Headquarters$/ }).click();
    const dialog = page.getByRole('dialog', { name: /headquarters/i });

    await dialog.getByRole('button', { name: /Zleć budowę/ }).click();
    await expect(dialog.locator('.headquarters-stall')).toContainText(/stanie na rezerwie ₸500/);
    await dialog.getByRole('button', { name: /Potwierdź — ₸\d/ }).click();

    // The order is placed; auto-draw will now spend down to the Reserve and
    // the Budowa tab shows the reserve stall reason once it gets there — the
    // sim-side floor itself is pinned by unit tests (building.test.ts #122).
    await expect(dialog.getByRole('button', { name: /Zleć budowę/ })).toBeDisabled();
  });
});

test.describe('Headquarters — Trasy tab (#85)', () => {
  test('create route → assign → ship loops in a seeded scenario; last-loop result updates after a loop', async ({
    page,
  }) => {
    test.setTimeout(60_000);
    const { world, a, b } = routeReadyWorld('hq-trasy');
    // autoPauseOnArrival stays at its on-by-default value here on purpose: a
    // ship under active route autopilot is exempt from arrival auto-pause
    // (#151), so the loop must close even at 100x. This is the end-to-end
    // guard for that fix — before it, this exact seed froze on its first Stop.
    await continueWithWorld(page, world);

    // Found the Headquarters (any port — s0's home port is convenient).
    await page.locator('g.port').first().click({ force: true });
    await page.getByRole('button', { name: /Załóż siedzibę/ }).click();

    await page.getByRole('button', { name: /^Headquarters$/ }).click();
    const dialog = page.getByRole('dialog', { name: /headquarters/i });
    await dialog.getByRole('tab', { name: 'Trasy' }).click();

    // Create a two-Stop route: buy grain at A, sell grain at B.
    await createGrainRoute(dialog, a, b);

    // Route now shows in the list with a placeholder last-loop result.
    const routeRow = dialog.locator('.route-row').first();
    await expect(routeRow).toBeVisible();
    await expect(routeRow.locator('.route-row__result')).toContainText('no loop yet');

    // Assign s0.
    await routeRow.locator('.route-row__assign select').selectOption({ label: S0_NAME });
    await routeRow.getByRole('button', { name: /^Assign$/ }).click();
    await expect(routeRow.locator('.route-row__ship')).toContainText(S0_NAME);

    // Map: saving a new route selects it (Trasy tab), highlighting its Stop
    // ports — clicking the name again would *toggle it off* (RouteRow's
    // onSelect), so this checks the post-save state directly.
    await expect(page.locator('svg.region-map .port--route-stop')).toHaveCount(2);

    // Run the sim fast enough to close at least one full loop (two Stop-0
    // visits) — close the modal first, since the overlay covers the TopBar.
    await dialog.getByRole('button', { name: /^Close$/ }).click();
    await page.getByRole('button', { name: '100x' }).click();

    await page.getByRole('button', { name: /^Headquarters$/ }).click();
    const dialog2 = page.getByRole('dialog', { name: /headquarters/i });
    await dialog2.getByRole('tab', { name: 'Trasy' }).click();
    await expect(dialog2.locator('.route-row__result')).not.toContainText('no loop yet', {
      timeout: 30_000,
    });

    // Loop metrics are populated: total Course ticks and last-loop result
    // both render a number (docking fees may legitimately be 0 or a
    // positive figure — asserting presence, not a specific value).
    await expect(dialog2.locator('.route-row__metrics')).toContainText(/Course: \d+t\/loop/);
    await expect(dialog2.locator('.route-row__metrics')).toContainText(/Docking fees\/loop: \d+/);
  });

  test('edit propagates from the next Stop: an in-flight ship redirects to the edited Stop port', async ({
    page,
  }) => {
    test.setTimeout(60_000);
    const { world, a, b } = routeReadyWorld('hq-edit');
    const c = world.region.ports.find((p) => p.id !== a && p.id !== b)!.id;
    const cName = world.region.ports.find((p) => p.id === c)!.name;
    await continueWithWorld(page, world);

    await page.locator('g.port').first().click({ force: true });
    await page.getByRole('button', { name: /Załóż siedzibę/ }).click();
    await page.getByRole('button', { name: /^Headquarters$/ }).click();
    const dialog = page.getByRole('dialog', { name: /headquarters/i });
    await dialog.getByRole('tab', { name: 'Trasy' }).click();

    // Route: buy grain at A, sell grain at B.
    await createGrainRoute(dialog, a, b);

    const routeRow = dialog.locator('.route-row').first();
    await routeRow.locator('.route-row__assign select').selectOption({ label: S0_NAME });
    await routeRow.getByRole('button', { name: /^Assign$/ }).click();

    // Un-pause: the ship executes Stop 0 at A (still paused when we assigned,
    // so nothing ran yet — src/store/gameStore.ts dispatch() applies commands
    // immediately but ticks only advance while un-paused), then departs
    // toward B on its already-computed Course.
    await dialog.getByRole('button', { name: /^Close$/ }).click();
    await page.getByRole('button', { name: '100x' }).click();
    await page.locator('.fleet-list__item--controlled').click();
    await expect(page.locator('.side-panel__subtitle')).toContainText('Underway', { timeout: 30_000 });

    // Pause and edit the Route while the ship is genuinely in flight toward
    // B: move Stop 2 from B to a third port C.
    await page.getByRole('button', { name: '⏸' }).click();
    await page.getByRole('button', { name: /^Headquarters$/ }).click();
    const dialog2 = page.getByRole('dialog', { name: /headquarters/i });
    await dialog2.getByRole('tab', { name: 'Trasy' }).click();
    await dialog2
      .locator('.route-row')
      .first()
      .getByRole('button', { name: /^Edit$/ })
      .click();
    const editRows = dialog2.locator('.stop-row');
    await editRows.nth(1).locator('select').selectOption(c);
    await dialog2.getByRole('button', { name: /^Save route$/ }).click();
    await dialog2.getByRole('button', { name: /^Close$/ }).click();

    // Resume: the ship reaches B (the stale destination, no trade — Stop 2
    // there is no longer part of the template) then redirects onward toward
    // the *edited* Stop, C — proving the template edit propagated to an
    // in-flight ship's next Stop. It's a loop, so C is itself transient
    // (serviced, then the ship wraps back to Stop 0) — asserting the
    // redirect (not a lasting dock) is the robust, non-flaky signal.
    await page.getByRole('button', { name: '100x' }).click();
    await page.locator('.fleet-list__item--controlled').click();
    await expect(page.locator('.side-panel__subtitle')).toContainText(`Underway to ${cName}`, {
      timeout: 30_000,
    });
  });
});

test.describe('Headquarters overlay dismissal (#126)', () => {
  test('clicking the backdrop closes the overlay; clicking inside the panel does not', async ({
    page,
  }) => {
    await continueWithWorld(page, fundedWorld('hq-dismiss-backdrop'));
    await page.locator('g.port').first().click({ force: true });
    await page.getByRole('button', { name: /Załóż siedzibę/ }).click();

    await page.getByRole('button', { name: /^Headquarters$/ }).click();
    const dialog = page.getByRole('dialog', { name: /headquarters/i });
    await expect(dialog).toBeVisible();

    // `dialog` is the `.overlay` backdrop itself (role="dialog" sits on the
    // outer div); a position near its corner lands outside the centered
    // `.overlay__panel`, unlike a plain .click() which hits the panel.
    await dialog.locator('.overlay__title').click();
    await expect(dialog).toBeVisible();
    // Clicking a tab (deep inside the panel) must not close it either.
    await dialog.getByRole('tab', { name: 'Trasy' }).click();
    await expect(dialog).toBeVisible();

    await dialog.click({ position: { x: 5, y: 5 } });
    await expect(dialog).not.toBeVisible();
  });

  test('Esc closes the overlay', async ({ page }) => {
    await continueWithWorld(page, fundedWorld('hq-dismiss-esc'));
    await page.locator('g.port').first().click({ force: true });
    await page.getByRole('button', { name: /Załóż siedzibę/ }).click();

    await page.getByRole('button', { name: /^Headquarters$/ }).click();
    const dialog = page.getByRole('dialog', { name: /headquarters/i });
    await expect(dialog).toBeVisible();

    await page.keyboard.press('Escape');
    await expect(dialog).not.toBeVisible();
  });
});
