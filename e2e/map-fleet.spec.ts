import { test, expect, type Page } from '@playwright/test';

/**
 * RegionMap fleet rendering (#174): App.tsx used to hard-code
 * `ship={world.company.ships[0]}`, so only the first Company ship ever got a
 * glyph — a second ship was invisible, and if it (not ships[0]) was the
 * Controlled Ship, gold never appeared anywhere on the map (ADR-0006). Fixed
 * by RegionMap taking `ships: readonly Ship[]` and rendering one `<g>` per
 * ship. A genuine two-ship save is injected the same way fleet.spec.ts does
 * it — mutating a real autosave export, then loading it through the app's
 * own Import control — never a raw localStorage poke.
 */

const AUTOSAVE_KEY = 'etersim.autosave';

async function startNewGame(page: Page) {
  await page.goto('/');
  await page.getByRole('button', { name: /new game/i }).click();
  await expect(page.locator('svg.region-map')).toBeVisible();
}

// Hand-written subset shape, same rationale as fleet.spec.ts's SaveFile:
// e2e/** isn't in either tsconfig project, so a real sim-type import buys no
// compile-time drift protection today.
interface SaveFile {
  readonly version: number;
  readonly world: {
    company: {
      ships: Array<{
        id: string;
        name: string;
        hold: number;
        cargo: Record<string, number>;
        location: {
          kind: string;
          portId?: string;
          destination?: string;
          course?: Array<{ laneId: string; to: string }>;
          voyageIndex?: number;
          voyageProgressTicks?: number;
        };
        assignment?: unknown;
      }>;
    };
    region: {
      ports: Array<{ id: string; name: string }>;
      lanes: Array<{ id: string; a: string; b: string; voyageTicks: number }>;
    };
  };
}

/**
 * Autosave, then mutate on a second ship underway on a lane out of the first
 * ship's home port (docked ships are click-through on the map — port-click
 * priority, #28 — so an underway second ship is what actually exercises
 * map-click designation), then load it back through the real Import file
 * input. Returns the second ship's name for assertions.
 */
async function loadTwoShipFleetWithUnderwayShip(page: Page) {
  await page.getByRole('button', { name: '⏸' }).click();
  const raw = await page.evaluate((key) => localStorage.getItem(key), AUTOSAVE_KEY);
  expect(raw).not.toBeNull();
  const save = JSON.parse(raw!) as SaveFile;

  const ship0 = save.world.company.ships[0];
  const homePortId = ship0.location.portId!;
  const lane = save.world.region.lanes.find((l) => l.a === homePortId || l.b === homePortId)!;
  const destination = lane.a === homePortId ? lane.b : lane.a;

  const secondShipName = 'Second Runner';
  const secondShip = {
    ...ship0,
    id: 's1',
    name: secondShipName,
    cargo: { ...ship0.cargo },
    location: {
      kind: 'underway',
      course: [{ laneId: lane.id, to: destination }],
      voyageIndex: 0,
      voyageProgressTicks: Math.floor(lane.voyageTicks / 2),
      destination,
    },
  };
  save.world.company.ships = [ship0, secondShip];

  const fileInput = page.getByLabel('Import save file');
  await fileInput.setInputFiles({
    name: 'e2e-map-fleet-save.json',
    mimeType: 'application/json',
    buffer: Buffer.from(JSON.stringify(save)),
  });

  return { secondShipName };
}

test.describe('RegionMap renders the whole fleet (#174)', () => {
  test('both the docked and the underway ship get a glyph', async ({ page }) => {
    await startNewGame(page);
    await loadTwoShipFleetWithUnderwayShip(page);

    // One glyph per Company ship — the bug rendered exactly one regardless
    // of fleet size.
    await expect(page.locator('g.ship')).toHaveCount(2);
    await expect(page.locator('g.ship.ship--docked')).toHaveCount(1);
    await expect(page.locator('g.ship:not(.ship--docked)')).toHaveCount(1);
  });

  test('exactly the Controlled Ship is gold; map-click designation switches it (ADR-0006)', async ({
    page,
  }) => {
    await startNewGame(page);
    const { secondShipName } = await loadTwoShipFleetWithUnderwayShip(page);

    // The original (loaded first) ship starts Controlled — docked, gold.
    await expect(page.locator('g.ship--controlled')).toHaveCount(1);
    await expect(page.locator('g.ship--docked.ship--controlled')).toHaveCount(1);

    // Click the underway ship's glyph on the map — designates it Controlled
    // (CONTEXT.md: designating happens via map click, Harbor, or Fleet list)
    // and opens its ShipPanel.
    await page.locator('g.ship:not(.ship--docked) .ship__hit-target').click();

    await expect(page.getByLabel('Ship name')).toHaveValue(secondShipName);
    // Gold moved: still exactly one Controlled Ship on the map, and it's now
    // the underway one, not the docked one.
    await expect(page.locator('g.ship--controlled')).toHaveCount(1);
    await expect(page.locator('g.ship--docked.ship--controlled')).toHaveCount(0);
    await expect(page.locator('g.ship:not(.ship--docked).ship--controlled')).toHaveCount(1);

    // Fleet list agrees — the two designation paths (map, Fleet list) share
    // one `controlledShipId` (CONTEXT.md — Controlled Ship).
    await expect(page.locator('.fleet-list__item--controlled')).toContainText(secondShipName);
  });

  test('a docked ship stays click-through: clicking its position opens the port, not its panel (#28)', async ({
    page,
  }) => {
    await startNewGame(page);
    await loadTwoShipFleetWithUnderwayShip(page);

    // The docked ship's hit-target circle (#174) sits exactly on the port
    // node — clicking it must still fall through to the port (#28
    // port-click priority), not open the ShipPanel, or the new hit-target
    // would have silently regressed docked-ship click-through.
    await page.locator('g.ship--docked .ship__hit-target').click({ force: true });

    await expect(page.locator('.market')).toBeVisible();
    await expect(page.getByLabel('Ship name')).not.toBeVisible();
  });
});
