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

// Deliberately a hand-written subset shape, not `import type { World } from
// '../src/sim'`: `e2e/**` isn't in either tsconfig project (tsconfig.app.json
// only includes `src`, tsconfig.node.json only `vite.config.ts`), so `tsc -b`
// never type-checks this file either way — a real-type import would buy no
// compile-time drift protection today, while `Company`/`Ship` declare their
// fields `readonly`, so building the mutated save below (reassigning
// `ships`/`routes`, not just editing in place) would need an `as`-cast or a
// full object rebuild for every field touched. If `e2e/` ever joins a
// tsconfig project, switching to real sim types here is worth revisiting.
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
    // The starting ship's name is generator-suggested — `generateShipName(0)`
    // draws no RNG (src/sim/building.ts), so it's always the pool's first
    // entry regardless of seed: pin the exact value, not just "isn't s0".
    await expect(items.first().locator('.fleet-list__name')).toHaveText('Aether Wing');
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
    const { secondShipName, otherPortName, routeName } = await loadTwoShipFleet(page);

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
    // Re-read the badge's own text (not just visibility) — pins the actual
    // status word the AC asks for, not merely "some element exists".
    await expect(routedRow.locator('.fleet-list__status')).toHaveText(/^Suspended —/);
    // Still assigned — a manual sailTo suspends the Route, never destroys it.
    await expect(routedRow.locator('.fleet-list__route')).toHaveText(routeName);
  });
});

/**
 * Ship name — editable in ShipPanel (#54 AC). Each case checks the input
 * *and* the Fleet list row, so a "commit never dispatches" regression (local
 * React state changes, no `renameShip` Command actually sent) can't pass:
 * the Fleet list only reflects a rename once it round-trips through the
 * store/world, never from the input's own local state.
 */
test.describe('ship name — editable in ShipPanel (#54)', () => {
  // The starting ship's name is generator-suggested and RNG-free
  // (`generateShipName(0)`, src/sim/building.ts) — always the pool's first
  // entry, regardless of seed.
  const STARTING_NAME = 'Aether Wing';

  test.beforeEach(async ({ page }) => {
    await startNewGame(page);
    await page.locator('.fleet-list__item--controlled').click();
    await expect(page.getByLabel('Ship name')).toHaveValue(STARTING_NAME);
  });

  test('editing the name and blurring commits — the new name shows in the fleet list too', async ({
    page,
  }) => {
    const nameInput = page.getByLabel('Ship name');
    await nameInput.fill('Windrunner');
    await nameInput.press('Tab'); // moves focus away — fires blur, which commits

    await expect(nameInput).toHaveValue('Windrunner');
    await expect(page.locator('.fleet-list__item--controlled .fleet-list__name')).toHaveText(
      'Windrunner',
    );
  });

  test('pressing Enter commits the same as blur', async ({ page }) => {
    const nameInput = page.getByLabel('Ship name');
    await nameInput.fill('Skybreaker');
    await nameInput.press('Enter');

    await expect(nameInput).toHaveValue('Skybreaker');
    await expect(page.locator('.fleet-list__item--controlled .fleet-list__name')).toHaveText(
      'Skybreaker',
    );
  });

  test('Escape reverts an in-progress edit without committing', async ({ page }) => {
    const nameInput = page.getByLabel('Ship name');
    await nameInput.fill('Discarded Name');
    await nameInput.press('Escape');
    await nameInput.press('Tab'); // blur after Escape must not commit

    await expect(nameInput).toHaveValue(STARTING_NAME);
    await expect(page.locator('.fleet-list__item--controlled .fleet-list__name')).toHaveText(
      STARTING_NAME,
    );
  });

  test('a blank (or whitespace-only) name reverts instead of committing', async ({ page }) => {
    const nameInput = page.getByLabel('Ship name');
    await nameInput.fill('   ');
    await nameInput.press('Tab');

    await expect(nameInput).toHaveValue(STARTING_NAME);
    await expect(page.locator('.fleet-list__item--controlled .fleet-list__name')).toHaveText(
      STARTING_NAME,
    );
  });
});
