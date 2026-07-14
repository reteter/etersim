import { test, expect, type Page } from '@playwright/test';
import {
  ENROLLMENT_FEE,
  HEADQUARTERS_COST,
  type ActiveContract,
  type Company,
  type ContractOffer,
  type World,
} from '../src/sim';
import { createWorld } from '../src/sim';
import { SAVE_VERSION } from '../src/store/persistence';

/**
 * Kontrakty tab E2E (#96, docs/specs/E3-contracts-and-guilds.md — UX
 * skeleton). Offers/active contracts are hand-built directly onto the World
 * (same precedent as e2e/market.spec.ts, e2e/headquarters.spec.ts) rather than
 * ground out of `refreshContractOffers`/tick-grinding — precise control over
 * tier/rank/progress numbers is what a deterministic fixture gives that
 * natural play can't reliably give a test within its time budget.
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

async function openKontrakty(page: Page) {
  await page.getByRole('button', { name: 'Price Board' }).click();
  await expect(page.locator('.overlay__panel')).toBeVisible();
  await page.getByRole('tab', { name: 'Kontrakty' }).click();
}

/** A founded, enrolled-in-agrarian World with two hand-built offers on the
 *  board: a tier-1 offer (acceptable at rank 1) and a tier-2 offer (locked —
 *  the Company's agrarian rank is 1, points 0). Basis numbers mirror
 *  contract.test.ts's `twoPortRegion` fixture (roundTripTicks 80 ⇒ periodDays
 *  7, expectedTrips 2, quota 70) so the rendered basis line is exactly
 *  predictable. */
function boardWorld(seed: string): { world: World; homePortId: string; sourcePortId: string } {
  const w = createWorld(seed);
  const homePortId = w.region.ports[0].id;
  const sourcePortId = w.region.ports[1].id;

  const tier1Offer: ContractOffer = {
    id: 'agrarian:offer-tier1',
    guildId: 'agrarian',
    portId: homePortId,
    good: 'textiles',
    quotaPerPeriod: 70,
    periodDays: 7,
    minPeriods: 3,
    feePerPeriod: 105,
    tier: 1,
    basis: { sourcePortId, roundTripTicks: 80, expectedTrips: 2 },
  };
  const tier2Offer: ContractOffer = {
    id: 'agrarian:offer-tier2',
    guildId: 'agrarian',
    portId: homePortId,
    good: 'aetherSalt',
    quotaPerPeriod: 40,
    periodDays: 10,
    minPeriods: 4,
    feePerPeriod: 200,
    tier: 2,
    basis: { sourcePortId, roundTripTicks: 120, expectedTrips: 2 },
  };

  const company: Company = {
    ...w.company,
    thalers: HEADQUARTERS_COST + ENROLLMENT_FEE + 10_000,
    headquarters: { portId: homePortId },
    guilds: { agrarian: { points: 0 } },
  };
  const world: World = { ...w, company, contractOffers: [tier1Offer, tier2Offer] };
  return { world, homePortId, sourcePortId };
}

test.describe('Kontrakty tab (#96)', () => {
  test('the "b" hotkey opens the same overlay (default Ceny tab), and switching tabs keeps it open', async ({
    page,
  }) => {
    const { world } = boardWorld('kontrakty-tabs');
    await continueWithWorld(page, world);

    await page.keyboard.press('b');
    await expect(page.getByRole('tab', { name: 'Ceny' })).toHaveAttribute('aria-selected', 'true');
    await expect(page.locator('.price-board')).toBeVisible();

    await page.getByRole('tab', { name: 'Kontrakty' }).click();
    await expect(page.locator('.kontrakty-tab')).toBeVisible();

    // Same "b" hotkey still toggles the one overlay closed, even mid-Kontrakty
    // (#96 AC1: "same overlay, same B hotkey").
    await page.keyboard.press('b');
    await expect(page.locator('.overlay__panel')).toHaveCount(0);
  });

  test('offer renders with its basis line, and a higher-tier offer renders locked with the required rank', async ({
    page,
  }) => {
    const { world, sourcePortId } = boardWorld('kontrakty-offer');
    const sourceName = world.region.ports.find((p) => p.id === sourcePortId)!.name;
    await continueWithWorld(page, world);
    await openKontrakty(page);

    const tier1Row = page.locator('.kontrakty-offer').filter({ hasText: 'Textiles' });
    await expect(tier1Row).toBeVisible();
    await expect(tier1Row).toContainText(`Oczekiwane ~2 kursy/okres, najbliższe źródło: ${sourceName}`);
    await expect(tier1Row.getByRole('button', { name: 'Przyjmij kontrakt' })).toBeVisible();

    const tier2Row = page.locator('.kontrakty-offer').filter({ hasText: 'Aether Salt' });
    await expect(tier2Row).toHaveClass(/kontrakty-offer--locked/);
    await expect(tier2Row).toContainText('Wymaga rangi 2 w tej gildii');
    await expect(tier2Row.getByRole('button', { name: 'Przyjmij kontrakt' })).toHaveCount(0);
  });

  test('accepting an offer moves it into Aktywne kontrakty with period progress', async ({ page }) => {
    const { world } = boardWorld('kontrakty-accept');
    await continueWithWorld(page, world);
    await openKontrakty(page);

    const tier1Row = page.locator('.kontrakty-offer').filter({ hasText: 'Textiles' });
    await tier1Row.getByRole('button', { name: 'Przyjmij kontrakt' }).click();

    await expect(page.locator('.kontrakty-offer').filter({ hasText: 'Textiles' })).toHaveCount(0);
    const activeRow = page.locator('.kontrakty-contract').filter({ hasText: 'Textiles' });
    await expect(activeRow).toBeVisible();
    await expect(activeRow.locator('.kontrakty-contract__progress')).toHaveText(
      '0/70 — rozliczenie za 7 d',
    );
  });

  test('resign states the −3 rank cost before executing, then removes the contract', async ({
    page,
  }) => {
    const { world, homePortId } = boardWorld('kontrakty-resign');
    const active: ActiveContract = {
      id: 'agrarian:active-1',
      guildId: 'agrarian',
      portId: homePortId,
      good: 'textiles',
      quotaPerPeriod: 70,
      periodDays: 7,
      minPeriods: 3,
      feePerPeriod: 105,
      tier: 1,
      basis: { sourcePortId: world.region.ports[1].id, roundTripTicks: 80, expectedTrips: 2 },
      startTick: 0,
      periodIndex: 0,
      deliveredThisPeriod: 10,
      consecutiveMisses: 0,
    };
    const withActive: World = {
      ...world,
      contractOffers: [],
      company: { ...world.company, contracts: [active] },
    };
    await continueWithWorld(page, withActive);
    await openKontrakty(page);

    const row = page.locator('.kontrakty-contract').filter({ hasText: 'Textiles' });
    await row.getByRole('button', { name: 'Zrezygnuj (koszt: −3 rangi)' }).click();
    await expect(row).toContainText('Rezygnacja kosztuje −3 punkty rangi. Potwierdzić?');

    await row.getByRole('button', { name: 'Potwierdź rezygnację' }).click();
    await expect(page.locator('.kontrakty-contract')).toHaveCount(0);
    await expect(page.locator('.overlay__text').filter({ hasText: 'Brak aktywnych kontraktów.' })).toBeVisible();
  });
});
