import { test, expect, type Page } from '@playwright/test';

/**
 * FleetList (#83/#54): every Company ship, its status and assigned Route;
 * clicking a row designates the Controlled Ship; a manual `sailTo` on a
 * routed ship shows up as "suspended". E2's UI never grows past one ship
 * (Headquarters/construction UI is #84/#85, out of this PR's scope), so a
 * second ship + a Route assignment is injected as a genuine save file — built
 * by mutating a real autosave export, then loaded through the app's own
 * Import control (`parseWorldJson`/`loadWorld`), never a raw localStorage
 * poke. `World` is proven JSON-round-trip-safe (src/sim/world.test.ts).
 */

const AUTOSAVE_KEY = 'etersim.autosave';

function escapeRegExp(text: string): string {
  return text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

async function startNewGame(page: Page) {
  await page.goto('/');
  await page.getByRole('button', { name: /new game/i }).click();
  await expect(page.locator('svg.region-map')).toBeVisible();
}

interface SaveFile {
  readonly version: number;
  readonly world: {
    company: {
      thalers: number;
      ships: Array<{
        id: string;
        name: string;
        hold: number;
        cargo: Record<string, number>;
        location: { kind: string; portId?: string; destination?: string };
        assignment?: { routeId: string; nextStopIndex: number; suspended: boolean };
      }>;
      routes: Array<{ id: string; name: string; stops: Array<{ portId: string; orders: unknown[] }> }>;
      headquarters?: unknown;
    };
    region: { ports: Array<{ id: string; name: string }> };
  };
}

/**
 * Autosave (via the pause button, which calls `saveAutosave`), mutate a
 * second ship + a 2-Stop Route assignment onto it, then load it back through
 * the real Import file input. Returns the new ship's name and the two Stop
 * port names for the caller's assertions.
 */
async function loadTwoShipFleet(page: Page) {
  await page.getByRole('button', { name: '⏸' }).click();
  const raw = await page.evaluate((key) => localStorage.getItem(key), AUTOSAVE_KEY);
  expect(raw).not.toBeNull();
  const save = JSON.parse(raw!) as SaveFile;

  const ship0 = save.world.company.ships[0];
  const homePortId = ship0.location.portId!;
  const otherPort = save.world.region.ports.find((p) => p.id !== homePortId)!;

  const secondShipName = 'Second Runner';
  const routeName = 'E2E Loop';
  const secondShip = {
    ...ship0,
    id: 's1',
    name: secondShipName,
    cargo: { ...ship0.cargo },
    location: { kind: 'docked', portId: homePortId },
    assignment: { routeId: 'e2e-route', nextStopIndex: 0, suspended: false },
  };
  save.world.company.ships = [ship0, secondShip];
  save.world.company.routes = [
    {
      id: 'e2e-route',
      name: routeName,
      stops: [
        { portId: homePortId, orders: [] },
        { portId: otherPort.id, orders: [] },
      ],
    },
  ];

  const fileInput = page.getByLabel('Import save file');
  await fileInput.setInputFiles({
    name: 'e2e-fleet-save.json',
    mimeType: 'application/json',
    buffer: Buffer.from(JSON.stringify(save)),
  });

  return {
    secondShipName,
    routeName,
    homePortName: save.world.region.ports.find((p) => p.id === homePortId)!.name,
    otherPortName: otherPort.name,
  };
}

test.describe('fleet list (#83/#54)', () => {
  test('renders every ship, docked status, name — no raw ship id anywhere', async ({ page }) => {
    await startNewGame(page);

    const items = page.locator('.fleet-list__item');
    await expect(items).toHaveCount(1);
    await expect(items.first().locator('.fleet-list__status')).toContainText('Docked');
    // The starting ship's name is generator-suggested, never a raw id like "s0".
    const name = await items.first().locator('.fleet-list__name').innerText();
    expect(name).not.toBe('s0');
    await expect(page.locator('.fleet-list__name')).not.toHaveText('s0');
  });

  test('shows two ships, one "on route" with its assigned Route name, after loading a save', async ({
    page,
  }) => {
    await startNewGame(page);
    const { secondShipName, routeName } = await loadTwoShipFleet(page);

    const items = page.locator('.fleet-list__item');
    await expect(items).toHaveCount(2);

    const routedRow = items.filter({ hasText: secondShipName });
    await expect(routedRow).toHaveCount(1);
    await expect(routedRow.locator('.fleet-list__status')).toContainText('On route');
    await expect(routedRow.locator('.fleet-list__route')).toHaveText(routeName);
  });

  test('clicking a ship row designates it the Controlled Ship and opens its panel', async ({
    page,
  }) => {
    await startNewGame(page);
    const { secondShipName } = await loadTwoShipFleet(page);

    // The original ship (loaded first) starts Controlled.
    await expect(page.locator('.fleet-list__item--controlled')).toHaveCount(1);
    await expect(page.locator('.fleet-list__item--controlled')).not.toContainText(secondShipName);

    const routedRow = page.locator('.fleet-list__item').filter({ hasText: secondShipName });
    await routedRow.click();

    // Controlled marker moved to the clicked row (mechanic unchanged, #28/#32).
    await expect(page.locator('.fleet-list__item--controlled')).toContainText(secondShipName);
    // The click also opens the ShipPanel for that ship (openShip mechanic).
    await expect(page.getByRole('heading', { name: 'Ship' })).toBeVisible();
    await expect(page.getByLabel('Ship name')).toHaveValue(secondShipName);
  });

  test('a manual sailTo on a routed ship shows "suspended" in the fleet list', async ({ page }) => {
    await startNewGame(page);
    const { secondShipName, otherPortName } = await loadTwoShipFleet(page);

    // Designate the routed ship Controlled.
    await page.locator('.fleet-list__item').filter({ hasText: secondShipName }).click();
    await expect(page.locator('.fleet-list__item--controlled')).toContainText(secondShipName);

    // Sail it manually to the Route's other Stop port — a real player command,
    // not a synthetic suspended flag (sailTo auto-suspends the assignment).
    const exactOtherPort = new RegExp(`^${escapeRegExp(otherPortName)}$`);
    const otherPortNode = page
      .locator('g.port')
      .filter({ has: page.locator('.port__label', { hasText: exactOtherPort }) });
    await otherPortNode.click({ force: true });
    const sailBtn = page.getByRole('button', { name: /^Sail .+ here \(~\d+ ticks\)$/ });
    await expect(sailBtn).toBeVisible();
    await sailBtn.click();

    const routedRow = page.locator('.fleet-list__item').filter({ hasText: secondShipName });
    await expect(routedRow.locator('.fleet-list__status')).toContainText('Suspended');
    // Still assigned — a manual sailTo suspends the Route, never destroys it.
    await expect(routedRow.locator('.fleet-list__route')).toBeVisible();
  });
});
