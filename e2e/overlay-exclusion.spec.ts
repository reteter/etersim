import { test, expect, type Page } from '@playwright/test';
import { applyCommand, createWorld, type World } from '../src/sim';
import { SAVE_VERSION } from '../src/store/persistence';

/**
 * Names the #320 delta the characterization net deliberately leaves unpinned:
 * TopBar's overlays (Price Board, Siedziba) are mutually exclusive — opening
 * one closes any other, so at most one overlay dialog is ever mounted — and
 * Esc closes whichever overlay is active.
 *
 * RED on the frozen net-baseline (1f33866): there the overlays are independent
 * `useState` booleans in TopBar with nothing preventing them from stacking, so
 * reaching for a second overlay while one is open mounts BOTH dialogs. GREEN
 * once #320 routes all overlays through a single `activeOverlay` field.
 *
 * The `Overlay` union (`src/store/gameStore.ts`) still carries a third member,
 * `"ledger"`, from the retired Księga overlay (owner directive 2026-07-30) —
 * unreachable through any UI action now, but still a live consumer at the
 * store level (`src/store/gameStore.test.ts` calls `openOverlay("ledger")`
 * directly), so it is #470's cleanup to make, not this spec's fixture to keep
 * alive. The two overlays reachable through the UI today are Price Board and
 * Siedziba, so the stacking test below exercises that pair.
 *
 * The second overlay is reached with the "b" hotkey rather than a TopBar button
 * click on purpose: an open overlay is `aria-modal` with a full-screen backdrop
 * over the TopBar, so the buttons behind it are unclickable by construction —
 * only a keyboard route can exercise "open B while A is open" in either the RED
 * (stacks) or the GREEN (replaces) world.
 */
async function startNewGame(page: Page) {
  await page.goto('/');
  await page.getByRole('button', { name: /nowa gra/i }).click();
  await expect(page.locator('svg.region-map')).toBeVisible();
}

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
  await page.getByRole('button', { name: /kontynuuj/i }).click();
  await expect(page.locator('svg.region-map')).toBeVisible();
}

/** A funded, already-founded World — Siedziba (`HeadquartersPanel`) renders
 *  nothing without a Headquarters, and startNewGame's default purse can't
 *  afford founding within a test's time budget, so this seeds one directly
 *  (same `applyCommand` pattern as e2e/ledger.spec.ts's own `foundedWorld`). */
function foundedWorld(seed: string): World {
  const w = createWorld(seed);
  const funded: World = { ...w, company: { ...w.company, thalers: 100_000 } };
  const location = funded.company.ships[0].location;
  if (location.kind !== 'docked') throw new Error('ship not docked in a freshly created World');
  return applyCommand(funded, { kind: 'foundHeadquarters', portId: location.portId });
}

test.describe('Overlay mutual exclusion (#320)', () => {
  test('opening a second overlay closes the first — two overlays never stack', async ({ page }) => {
    await continueWithWorld(page, foundedWorld('overlay-exclusion-two'));

    const priceBoard = page.getByRole('dialog', { name: /tablica cen/i });
    const hq = page.getByRole('dialog', { name: /siedziba/i });

    await page.getByRole('button', { name: /^Siedziba$/ }).click();
    await expect(hq).toBeVisible();

    // "b" opens the Price Board. With one shared `activeOverlay` field
    // Siedziba must yield rather than stack; on the baseline both dialogs
    // mount.
    await page.keyboard.press('b');
    await expect(priceBoard).toBeVisible();
    await expect(hq).not.toBeVisible();
    await expect(page.getByRole('dialog')).toHaveCount(1);
  });

  test('Esc closes the active overlay', async ({ page }) => {
    await startNewGame(page);

    const priceBoard = page.getByRole('dialog', { name: /tablica cen/i });

    await page.getByRole('button', { name: /^Tablica cen$/ }).click();
    await expect(priceBoard).toBeVisible();

    await page.keyboard.press('Escape');
    await expect(priceBoard).not.toBeVisible();
    await expect(page.getByRole('dialog')).toHaveCount(0);
  });
});
