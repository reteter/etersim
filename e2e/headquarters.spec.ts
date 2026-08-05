import { test, expect, type Page } from '@playwright/test';
import { generateShipName, type World } from '../src/sim';
import { GOOD_NAME_PL } from '../src/store/goodDisplay';
import { SAVE_VERSION } from '../src/store/persistence';
import { DEFAULT_SETTINGS, SETTINGS_KEY, SETTINGS_VERSION, type Settings } from '../src/store/settings';
import {
  attachOrder,
  loadRouteTab,
  openBoard,
  qtyInput,
  removeStop,
  saveRoute,
  startNewRoute,
  toggleOrderDrawer,
} from './boardAuthoring';
import { fundedWorld, routeReadyWorld } from './worldFixtures';

/** The first ship's display name (src/sim/world.ts createWorld: `id: "s0"`,
 *  `name: generateShipName(0)`) — ship ids and display names diverged once
 *  #54/#118 shipped named ships, so UI-facing assertions (dropdown labels,
 *  panel text) must match the *name*, not the id. */
const S0_NAME = generateShipName(0);

/**
 * Headquarters panel E2E (#84, #472). The default starting purse (₸500,
 * src/sim/world.ts STARTING_THALERS) can't afford the Headquarters
 * (₸2,500) or produce a fast route loop within a test's time budget, so
 * these tests seed the autosave slot with a hand-built World (funded purse,
 * s0 docked at a known port) before booting the app, then drive founding /
 * route creation / assignment through the same UI a player uses. This
 * matches the save format exactly (src/store/persistence.ts SaveFile
 * envelope), so `Continue` on the StartScreen loads it like any other save.
 *
 * **#472 rewrite note:** the Headquarters' own "Trasy" tab is gone
 * (docs/specs/E16-workbench.md §Trasy roster → the board owns Routes
 * entirely, owner directive 2026-07-30 point 8) — Route authoring, the
 * roster and the operational controls (assign/suspend/resume/metrics,
 * `RouteOpsStrip`) all moved to the Price Board. Route-authoring tests below
 * now go through `./boardAuthoring`'s shared driver instead of this file's
 * old `createGrainRoute` (removed — its `Nowa trasa` → `Dodaj przystanek` →
 * chip-table sequence has no equivalent on the board). Headquarters itself
 * also gained a second tab, "Wartość firmy" (absorbs the retired Księga),
 * which is now the **default** tab on open (point 4) — tests that only need
 * "Budowa" must select it explicitly, where before it was the only tab and
 * needed no click.
 */

const AUTOSAVE_KEY = 'etersim.autosave';

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
  await page.getByRole('button', { name: /kontynuuj/i }).click();
  await expect(page.locator('svg.region-map')).toBeVisible();
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

test.describe('Founding progress bar (#157)', () => {
  test('pre-founding the bar reflects the purse against the ₸3,000 gate at every port', async ({
    page,
  }) => {
    await continueWithWorld(page, fundedWorld('founding-bar', 1_500));
    await page.locator('g.port').first().click({ force: true });

    const bar = page.getByRole('progressbar', { name: 'Postęp oszczędności na założenie' });
    await expect(bar).toBeVisible();
    await expect(bar).toHaveAttribute('aria-valuenow', '1500');
    await expect(bar).toHaveAttribute('aria-valuemax', '3000'); // the real gate, never ₸2,500
    await expect(page.locator('.founding-goal__count')).toContainText('₸1500 / ₸3000');
    await expect(page.getByRole('button', { name: /Załóż siedzibę/ })).toBeDisabled();

    // Same purse, same bar at any other port (one company-wide goal).
    await page.locator('g.port').nth(1).click({ force: true });
    await expect(bar).toHaveAttribute('aria-valuenow', '1500');
  });

  test('a purse above the gate clamps the bar at 100%; founding removes it', async ({ page }) => {
    await continueWithWorld(page, fundedWorld('founding-bar-full'));
    await page.locator('g.port').first().click({ force: true });

    const bar = page.getByRole('progressbar', { name: 'Postęp oszczędności na założenie' });
    await expect(bar).toHaveAttribute('aria-valuenow', '3000'); // clamped at the gate
    await expect(page.locator('.founding-goal__count')).toContainText('₸3000 / ₸3000');

    await page.getByRole('button', { name: /Załóż siedzibę/ }).click();
    await expect(bar).toHaveCount(0); // pre-founding branch gone once founded
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
    const headquartersBtn = page.getByRole('button', { name: /^Siedziba$/ });
    await expect(headquartersBtn).toBeVisible();

    // "Wartość firmy" is the default tab since the 2026-07-30 relocation
    // (point 4, the retired Księga's absorption) — Budowa needs an explicit
    // click, unlike before when it was the panel's only tab.
    await headquartersBtn.click();
    const dialog = page.getByRole('dialog', { name: /siedziba/i });
    await expect(dialog).toBeVisible();
    await dialog.getByRole('tab', { name: 'Budowa' }).click();
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
    await dialog.getByRole('button', { name: /^Zamknij$/ }).click();
    await page.locator('g.port').first().click({ force: true });
    await expect(page.locator('.headquarters-section .headquarters-progress__row')).toHaveCount(5);
    await page.getByRole('button', { name: /^Siedziba$/ }).click();
    const dialog2 = page.getByRole('dialog', { name: /siedziba/i });
    await dialog2.getByRole('tab', { name: 'Budowa' }).click();

    // Rush shows a live quote (nonzero — deep purse, nothing bought yet)
    // and executes: the purse drops by exactly the quoted amount.
    const rushBtn = dialog2.getByRole('button', { name: /Dokup resztę — ₸\d/ });
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
    await page.getByRole('button', { name: /^Siedziba$/ }).click();
    const dialog = page.getByRole('dialog', { name: /siedziba/i });
    await dialog.getByRole('tab', { name: 'Budowa' }).click();

    await dialog.getByRole('button', { name: /Zleć budowę/ }).click();
    await expect(dialog.locator('.headquarters-stall')).toContainText(/stanie na rezerwie ₸500/);
    await dialog.getByRole('button', { name: /Potwierdź — ₸\d/ }).click();

    // The order is placed; auto-draw will now spend down to the Reserve and
    // the Budowa tab shows the reserve stall reason once it gets there — the
    // sim-side floor itself is pinned by unit tests (building.test.ts #122).
    await expect(dialog.getByRole('button', { name: /Zleć budowę/ })).toBeDisabled();
  });
});

test.describe('Headquarters — board owns Routes (#472, docs/specs/E16-workbench.md §Trasy roster)', () => {
  test('author a Route on the board → assign via RouteOpsStrip → ship loops in a seeded scenario; last-loop result updates after a loop', async ({
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

    // Author a two-Stop Route on the board: buy grain at A, sell grain at B.
    const dialog = await openBoard(page);
    await startNewRoute(dialog);
    await attachOrder(dialog, a, 'grain', 'buy');
    await attachOrder(dialog, b, 'grain', 'sell');

    const saveBtn = dialog.getByRole('button', { name: /^Zapisz trasę$/ });
    await expect(saveBtn).toBeEnabled();
    await saveBtn.click();

    // Reload the saved Route via its own tab — RouteOpsStrip (the retired
    // Trasy tab's operational half) renders only for an *existing* Route.
    await loadRouteTab(dialog, 'Trasa 1');
    const ops = dialog.locator('.route-ops');
    await expect(ops).toBeVisible();
    await expect(ops.locator('.route-ops__result')).toContainText('brak jeszcze pętli');

    // Assign s0.
    await ops.locator('.route-ops__assign select').selectOption({ label: S0_NAME });
    await ops.getByRole('button', { name: /^Przypisz$/ }).click();
    await expect(ops.locator('.route-ops__ship')).toContainText(S0_NAME);

    // Map: loading a Route selects it, highlighting its Stop ports.
    await expect(page.locator('svg.region-map .port--route-stop')).toHaveCount(2);

    // Run the sim fast enough to close at least one full loop — close the
    // modal first, since the overlay covers the TopBar.
    await dialog.getByRole('button', { name: /^Zamknij$/ }).click();
    await page.getByRole('button', { name: '100x' }).click();

    const dialog2 = await openBoard(page);
    await loadRouteTab(dialog2, 'Trasa 1');
    const ops2 = dialog2.locator('.route-ops');
    await expect(ops2.locator('.route-ops__result')).not.toContainText('brak jeszcze pętli', {
      timeout: 30_000,
    });

    // Loop metrics are populated: total Course ticks and last-loop result
    // both render a number (docking fees may legitimately be 0 or a
    // positive figure — asserting presence, not a specific value).
    await expect(ops2.locator('.route-ops__metrics')).toContainText(/Kurs: \d+t\/pętla/);
    await expect(ops2.locator('.route-ops__metrics')).toContainText(/Opłaty dokowe\/pętla: \d+/);
  });

  test('a routed greedy sell shows a runtime note at the Stop it emptied the hold at (#398)', async ({
    page,
  }) => {
    test.setTimeout(60_000);
    const { world, a, b } = routeReadyWorld('hq-398');
    const bName = world.region.ports.find((p) => p.id === b)!.name;
    await continueWithWorld(page, world);

    await page.locator('g.port').first().click({ force: true });
    await page.getByRole('button', { name: /Załóż siedzibę/ }).click();

    // buy grain (Stop 1, A) → sell grain (Stop 2, B), both greedy (no qty).
    const dialog = await openBoard(page);
    await startNewRoute(dialog);
    await attachOrder(dialog, a, 'grain', 'buy');
    await attachOrder(dialog, b, 'grain', 'sell');
    await saveRoute(dialog);

    await loadRouteTab(dialog, 'Trasa 1');
    const ops = dialog.locator('.route-ops');
    await ops.locator('.route-ops__assign select').selectOption({ label: S0_NAME });
    await ops.getByRole('button', { name: /^Przypisz$/ }).click();

    await dialog.getByRole('button', { name: /^Zamknij$/ }).click();
    await page.getByRole('button', { name: '100x' }).click();

    // Once the ship's greedy sell at Stop 2 (B) fires, the TopBar's routed-
    // sale note (#398, pause-cause kin — #130) records it: legible in the
    // moment, not a silent cargo wipe.
    await expect(page.locator('.top-bar__routed-sale-note')).toContainText(
      `${bName}: sprzedano całość — ${GOOD_NAME_PL.grain} ×`,
      { timeout: 30_000 },
    );
    await expect(page.locator('.top-bar__routed-sale-note')).toContainText('— przystanek 2');
  });

  test('edit propagates from the next Stop: an in-flight ship redirects to the edited Stop port', async ({
    page,
  }) => {
    test.setTimeout(60_000);
    const { world, a, b } = routeReadyWorld('hq-edit');
    const c = world.region.ports.find((p) => p.id !== a && p.id !== b)!.id;
    const bName = world.region.ports.find((p) => p.id === b)!.name;
    const cName = world.region.ports.find((p) => p.id === c)!.name;
    await continueWithWorld(page, world);

    await page.locator('g.port').first().click({ force: true });
    await page.getByRole('button', { name: /Załóż siedzibę/ }).click();

    // Route: buy grain at A, sell grain at B.
    const dialog = await openBoard(page);
    await startNewRoute(dialog);
    await attachOrder(dialog, a, 'grain', 'buy');
    await attachOrder(dialog, b, 'grain', 'sell');
    await saveRoute(dialog);

    await loadRouteTab(dialog, 'Trasa 1');
    const ops = dialog.locator('.route-ops');
    await ops.locator('.route-ops__assign select').selectOption({ label: S0_NAME });
    await ops.getByRole('button', { name: /^Przypisz$/ }).click();

    // Un-pause: the ship executes Stop 0 at A (still paused when we assigned,
    // so nothing ran yet — src/store/gameStore.ts dispatch() applies commands
    // immediately but ticks only advance while un-paused), then departs
    // toward B on its already-computed Course.
    await dialog.getByRole('button', { name: /^Zamknij$/ }).click();
    await page.getByRole('button', { name: '100x' }).click();
    await page.locator('.fleet-list__item--controlled').click();
    await expect(page.locator('.side-panel__subtitle')).toContainText('W drodze', { timeout: 30_000 });

    // Pause and edit the Route while the ship is genuinely in flight toward
    // B: replace Stop 2 (B) with a third port C. The board has no "reassign
    // this Stop's port" control (a Stop's port IS its identity — chosen by
    // clicking that port's cell) — the equivalent edit is remove the Stop,
    // then re-attach at the same (last) position via C's own cell.
    await page.getByRole('button', { name: '⏸' }).click();
    const dialog2 = await openBoard(page);
    await loadRouteTab(dialog2, 'Trasa 1');
    await removeStop(dialog2, 1, bName);
    await attachOrder(dialog2, c, 'grain', 'sell');
    await saveRoute(dialog2);
    await dialog2.getByRole('button', { name: /^Zamknij$/ }).click();

    // Resume: the ship reaches B (the stale destination, no trade — Stop 2
    // there is no longer part of the template) then redirects onward toward
    // the *edited* Stop, C — proving the template edit propagated to an
    // in-flight ship's next Stop. It's a loop, so C is itself transient
    // (serviced, then the ship wraps back to Stop 0) — asserting the
    // redirect (not a lasting dock) is the robust, non-flaky signal.
    await page.getByRole('button', { name: '100x' }).click();
    await page.locator('.fleet-list__item--controlled').click();
    await expect(page.locator('.side-panel__subtitle')).toContainText(`W drodze do ${cName}`, {
      timeout: 30_000,
    });
  });
});

test.describe('Board overlay scroll (#176, via OverlayShell #181)', () => {
  test('the board panel stays within a small viewport; Save is reachable by scrolling the body', async ({
    page,
  }) => {
    // #176's original reproduction (a 12-Stop Trasy list, one row per Stop)
    // has no equivalent on the board: the ribbon is fixed-height, independent
    // of Stop count (§Visual contract D6 — "ten Stops do not make a taller
    // ribbon"), so Stop count alone can no longer grow the panel past the
    // viewport. The regression this test actually guards is OverlayShell's
    // own contract (#181: the panel is bounded, `.overlay__body` is the one
    // scroll region) — reproduced here by shrinking the viewport instead of
    // manufacturing Stops, which is test-side and touches no app code.
    const { world, a, b } = routeReadyWorld('hq-overlay-scroll');
    await continueWithWorld(page, world);
    await page.setViewportSize({ width: 1000, height: 480 });

    await page.locator('g.port').first().click({ force: true });
    await page.getByRole('button', { name: /Załóż siedzibę/ }).click();

    const dialog = await openBoard(page);
    await startNewRoute(dialog);
    await attachOrder(dialog, a, 'grain', 'buy');
    await attachOrder(dialog, b, 'grain', 'sell');

    const viewport = page.viewportSize()!;
    const panelBox = await dialog.locator('.overlay__panel').boundingBox();
    expect(panelBox).not.toBeNull();
    expect(panelBox!.height).toBeLessThanOrEqual(viewport.height + 1);

    // The body actually needs to scroll — makes "reachable by scrolling" a
    // real claim rather than one that would pass whether or not scrolling
    // happened to be necessary.
    const body = dialog.locator('.overlay__body');
    const overflows = await body.evaluate((el) => el.scrollHeight > el.clientHeight);
    expect(overflows).toBe(true);

    const saveBtn = dialog.getByRole('button', { name: /^Zapisz trasę$/ });
    await saveBtn.scrollIntoViewIfNeeded();
    await expect(saveBtn).toBeInViewport();
    await expect(saveBtn).toBeEnabled();
    await saveBtn.click();

    await expect(dialog.getByRole('tab', { name: 'Trasa 1' })).toBeVisible();
  });
});

test.describe('Headquarters overlay dismissal (#126)', () => {
  test('clicking the backdrop closes the overlay; clicking inside the panel does not', async ({
    page,
  }) => {
    await continueWithWorld(page, fundedWorld('hq-dismiss-backdrop'));
    await page.locator('g.port').first().click({ force: true });
    await page.getByRole('button', { name: /Załóż siedzibę/ }).click();

    await page.getByRole('button', { name: /^Siedziba$/ }).click();
    const dialog = page.getByRole('dialog', { name: /siedziba/i });
    await expect(dialog).toBeVisible();

    // `dialog` is the `.overlay` backdrop itself (role="dialog" sits on the
    // outer div); a position near its corner lands outside the centered
    // `.overlay__panel`, unlike a plain .click() which hits the panel.
    await dialog.locator('.overlay__title').click();
    await expect(dialog).toBeVisible();
    // Clicking a tab (deep inside the panel) must not close it either.
    await dialog.getByRole('tab', { name: 'Budowa' }).click();
    await expect(dialog).toBeVisible();

    await dialog.click({ position: { x: 5, y: 5 } });
    await expect(dialog).not.toBeVisible();
  });

  test('Esc closes the overlay', async ({ page }) => {
    await continueWithWorld(page, fundedWorld('hq-dismiss-esc'));
    await page.locator('g.port').first().click({ force: true });
    await page.getByRole('button', { name: /Załóż siedzibę/ }).click();

    await page.getByRole('button', { name: /^Siedziba$/ }).click();
    const dialog = page.getByRole('dialog', { name: /siedziba/i });
    await expect(dialog).toBeVisible();

    await page.keyboard.press('Escape');
    await expect(dialog).not.toBeVisible();
  });

  test('"," / "." cycle Wartość firmy/Budowa, wrapping, and are ignored while typing in a text field (#218)', async ({
    page,
  }) => {
    const { world, a, b } = routeReadyWorld('hq-tab-cycle');
    await continueWithWorld(page, world);
    await page.locator('g.port').first().click({ force: true });
    await page.getByRole('button', { name: /Załóż siedzibę/ }).click();

    await page.getByRole('button', { name: /^Siedziba$/ }).click();
    const dialog = page.getByRole('dialog', { name: /siedziba/i });
    const wartosc = dialog.getByRole('tab', { name: 'Wartość firmy' });
    const budowa = dialog.getByRole('tab', { name: 'Budowa' });

    await expect(wartosc).toHaveAttribute('aria-selected', 'true');

    // "." advances Wartość firmy -> Budowa, then wraps back (only 2 tabs).
    await page.keyboard.press('.');
    await expect(budowa).toHaveAttribute('aria-selected', 'true');
    await page.keyboard.press('.');
    await expect(wartosc).toHaveAttribute('aria-selected', 'true');

    // "," retreats the other way, wrapping straight to Budowa.
    await page.keyboard.press(',');
    await expect(budowa).toHaveAttribute('aria-selected', 'true');

    await dialog.getByRole('button', { name: /^Zamknij$/ }).click();

    // Typing "," / "." inside a real text field must reach the field, not
    // cycle the tab (the guard `Tabs.tsx`'s `isTypingTarget` implements).
    // Siedziba itself has no text input left to type into — the Trasy tab's
    // route-name field left with Routes (§Trasy roster) — so this half
    // re-points at the board's own qty "więcej" input. `Tabs.tsx` is shared,
    // generic code: proving the guard on one of its instances proves it for
    // all (ui.spec.ts's own "cycle the tabs" test already covers the bare
    // cycling on the board's Ceny/Kontrakty tabs without a text field).
    const board = await openBoard(page);
    await startNewRoute(board);
    await attachOrder(board, a, 'grain', 'buy');
    await attachOrder(board, b, 'grain', 'sell');
    await toggleOrderDrawer(board, 0, 'grain');
    const qty = qtyInput(board, 0, 'grain');
    const ceny = board.getByRole('tab', { name: 'Ceny · Trasa' });

    await qty.fill('5');
    await qty.pressSequentially(',.');
    await expect(ceny).toHaveAttribute('aria-selected', 'true');
  });
});
