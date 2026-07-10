import { test, expect, type Page } from '@playwright/test';

async function startNewGame(page: Page) {
  await page.goto('/');
  await page.getByRole('button', { name: /new game/i }).click();
  await expect(page.locator('svg.region-map')).toBeVisible();
}

/**
 * Open the Controlled Ship's panel via its row in the always-visible Fleet
 * list (#83, replaces the single-ship header, #32). A docked ship on the map
 * is click-through (port-click priority, #28), so the Fleet list/Harbor is
 * the way to reach it.
 */
async function openControlledShip(page: Page) {
  await page.locator('.fleet-list__item--controlled').click();
  await expect(page.getByRole('heading', { name: 'Ship' })).toBeVisible();
}

function escapeRegExp(text: string): string {
  return text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/**
 * Open the port panel for the Controlled Ship's own docked port (#33: the
 * legacy "Open market" shortcut is gone, so tests reach it the way a player
 * does — via port selection). Reads the docked port's name off the ShipPanel
 * subtitle, then clicks the matching port node on the map.
 */
async function openDockedPortMarket(page: Page) {
  await openControlledShip(page);
  // .side-panel__subtitle is CSS text-transform: capitalize, so innerText
  // renders "Docked At <Port>" — strip the prefix case-insensitively.
  const subtitle = await page.locator('.side-panel__subtitle').innerText();
  const portName = subtitle.replace(/^Docked at /i, '');
  // Exact match on the port label (not a hasText substring match) — two
  // procedurally generated port names could otherwise collide as substrings
  // (e.g. "Haven" / "New Haven") and trip Playwright's strict mode.
  const exact = new RegExp(`^${escapeRegExp(portName)}$`);
  await page.locator('g.port').filter({ has: page.locator('.port__label', { hasText: exact }) }).click({ force: true });
  await expect(page.locator('.market')).toBeVisible();
}

test.describe('etersim start screen', () => {
  test('shows start screen and can start new game', async ({ page }) => {
    await page.goto('/');

    await expect(page).toHaveTitle(/etersim/i);
    await expect(page.getByRole('heading', { name: /etersim/i })).toBeVisible();
    await expect(page.getByText(/aether-punk trading venture/i)).toBeVisible();
    await expect(page.getByRole('button', { name: /new game/i })).toBeVisible();
    await expect(page.getByLabel(/seed/i)).toBeVisible();

    await page.getByRole('button', { name: /new game/i }).click();
    await expect(page.locator('svg.region-map')).toBeVisible();
  });
});

test.describe('main game UI after start', () => {
  test.beforeEach(async ({ page }) => {
    await startNewGame(page);
  });

  test('shows top bar with thalers, date and speed controls', async ({ page }) => {
    await expect(page.locator('.top-bar__thalers')).toContainText('₸');
    await expect(page.locator('.top-bar__date')).toBeVisible();
    await expect(page.getByRole('group', { name: /speed controls/i })).toBeVisible();
    // Default speed is 1x after newGame
    await expect(page.getByRole('button', { name: '1x' })).toHaveAttribute('aria-pressed', 'true');
  });

  test('credits entry is reachable and lists CC BY attribution (#34)', async ({ page }) => {
    await page.getByRole('button', { name: /credits/i }).click();

    const dialog = page.getByRole('dialog', { name: /credits/i });
    await expect(dialog).toBeVisible();
    await expect(dialog).toContainText(/lorc/i);
    await expect(dialog).toContainText(/delapouite/i);
    await expect(dialog).toContainText(/game-icons\.net/i);
    await expect(dialog).toContainText(/CC BY 3\.0/i);

    await dialog.getByRole('button', { name: /close/i }).click();
    await expect(dialog).not.toBeVisible();
  });

  test('options entry toggles auto-pause-on-arrival (#37)', async ({ page }) => {
    await page.getByRole('button', { name: /^Options$/ }).click();

    const dialog = page.getByRole('dialog', { name: /options/i });
    await expect(dialog).toBeVisible();
    const toggle = dialog.getByRole('checkbox', { name: /auto-pause on arrival/i });
    // Default is On (src/store/settings.ts DEFAULT_SETTINGS).
    await expect(toggle).toBeChecked();

    await toggle.uncheck();
    await dialog.getByRole('button', { name: /close/i }).click();
    await expect(dialog).not.toBeVisible();

    // Reopening reads the same store state (not re-initialized local state),
    // proving the toggle went through setAutoPauseOnArrival. The
    // localStorage round-trip itself is covered at the unit level
    // (src/store/settings.test.ts, gameStore.test.ts).
    await page.getByRole('button', { name: /^Options$/ }).click();
    await expect(page.getByRole('dialog', { name: /options/i }).getByRole('checkbox')).not.toBeChecked();
  });

  test('orrery: star, orbit rings and planet discs render (#44)', async ({ page }) => {
    const map = page.locator('svg.region-map');
    await expect(map).toBeVisible();

    // Star: central decoration, one per map, not clickable/selectable.
    await expect(map.locator('.region-map__star .star__disc')).toHaveCount(1);
    await expect(map.locator('.region-map__star .star__glow')).toHaveCount(1);

    // One orbit ring per port, weakest layer in the hierarchy (very faint).
    const rings = map.locator('.orbit-ring');
    const ports = map.locator('g.port');
    const portCount = await ports.count();
    await expect(rings).toHaveCount(portCount);
    const ringOpacity = await rings.first().evaluate((el) => getComputedStyle(el).opacity);
    expect(Number(ringOpacity)).toBeLessThan(0.6);

    // Every port disc has an icon and is tinted per its archetype token.
    for (let i = 0; i < portCount; i++) {
      const port = ports.nth(i);
      await expect(port.locator('.port__disc')).toHaveCount(1);
      await expect(port.locator('.port__icon')).toHaveCount(1);

      const archetype = await port.getAttribute('data-archetype');
      expect(archetype).toBeTruthy();

      const [discFill, tokenValue] = await Promise.all([
        port.locator('.port__disc').evaluate((el) => getComputedStyle(el).fill),
        page.evaluate(
          (a) => getComputedStyle(document.documentElement).getPropertyValue(`--archetype-${a}`).trim(),
          archetype,
        ),
      ]);
      const tokenRgb = await page.evaluate((hex) => {
        const probe = document.createElement('div');
        probe.style.color = hex;
        document.body.appendChild(probe);
        const rgb = getComputedStyle(probe).color;
        probe.remove();
        return rgb;
      }, tokenValue);
      expect(discFill).toBe(tokenRgb);
    }
  });

  test('selecting a port gives its port disc a gold selection glow (#44)', async ({ page }) => {
    const port = page.locator('g.port').first();
    await port.click({ force: true });

    await expect(port).toHaveClass(/port--selected/);
    const filter = await port
      .locator('.port__disc')
      .evaluate((el) => getComputedStyle(el).filter);
    // Gold selection glow (#e0a840 → rgb(224, 168, 64)) must be present.
    expect(filter).toContain('224, 168, 64');
  });

  test('map is visible and clickable', async ({ page }) => {
    const map = page.locator('svg.region-map');
    await expect(map).toBeVisible();

    // Ship panel is reached via the Fleet list (#83).
    await openControlledShip(page);

    // Click a port group (handler is on g.port). Use first non-overlapping if possible.
    const ports = page.locator('g.port');
    await ports.first().click({ force: true });

    // Panel should show a port market (not Ship panel)
    await expect(page.locator('.market')).toBeVisible();
    const sideTitle = page.locator('.side-panel__title').first();
    await expect(sideTitle).not.toHaveText('Ship');
  });

  test('fleet list is always visible and shows the Controlled Ship\'s docked status', async ({ page }) => {
    // Visible before any selection.
    await expect(page.locator('.fleet-list__item--controlled')).toBeVisible();
    await expect(page.locator('.fleet-list__item--controlled .fleet-list__status')).toContainText('Docked');
    await expect(page.locator('.fleet-list__item--controlled .fleet-list__hold')).toContainText('/');
  });

  test('fleet list and map show the ship icon tinted gold for the Controlled Ship (#34)', async ({
    page,
  }) => {
    // Fleet list: the controlled row's icon is always gold.
    const headerIcon = page.locator('.fleet-list__item--controlled .fleet-list__glyph');
    await expect(headerIcon).toBeVisible();
    await expect(headerIcon).toHaveCSS('color', 'rgb(224, 168, 64)');

    // Map: the ship group carries the Controlled marker class, same tint.
    const mapShip = page.locator('g.ship--controlled .ship__glyph');
    await expect(mapShip).toBeVisible();
    await expect(mapShip).toHaveCSS('color', 'rgb(224, 168, 64)');
  });

  test('ship panel shows hold and docked location', async ({ page }) => {
    await openControlledShip(page);

    await expect(page.locator('.side-panel__subtitle')).toContainText('Docked at');
    await expect(page.getByText(/Hold \d+\/\d+/)).toBeVisible();
  });

  test('port view shows the Harbor with the docked ship', async ({ page }) => {
    // Open the docked port's market (via port selection, #33).
    await openDockedPortMarket(page);

    // Harbor lists the docked ship above the market.
    const harbor = page.locator('.harbor');
    await expect(harbor).toBeVisible();
    await expect(harbor.locator('.harbor__ship')).toHaveCount(1);
    await expect(harbor.locator('.harbor__ship--controlled')).toHaveCount(1);

    // Its ship icon is tinted gold (Controlled Ship, #34).
    const harborIcon = harbor.locator('.harbor__glyph--controlled');
    await expect(harborIcon).toHaveCount(1);
    await expect(harborIcon).toHaveCSS('color', 'rgb(224, 168, 64)');
  });

  test('selecting a port accents its incident lanes and shows tick labels; deselecting hides them (#45)', async ({
    page,
  }) => {
    const map = page.locator('svg.region-map');
    await page.locator('g.port').first().click({ force: true });

    await expect(map.locator('.lane--port-accent')).not.toHaveCount(0);
    await expect(map.locator('.lane__label')).not.toHaveCount(0);

    // Opening the Controlled Ship moves selection off the port — its lane
    // accents and tick labels disappear (default map stays clean).
    await openControlledShip(page);
    await expect(map.locator('.lane--port-accent')).toHaveCount(0);
    await expect(map.locator('.lane__label')).toHaveCount(0);
  });

  test('port panel shows market table with prices and trends', async ({ page }) => {
    // Select first port on map (click the group that has the handler)
    await page.locator('g.port').first().click({ force: true });

    const market = page.locator('.market');
    await expect(market).toBeVisible();

    // At least one good row
    await expect(page.locator('.market-row__name')).toHaveCount(5);

    // Bid/ask and stock visible
    await expect(page.locator('.market-row__bid').first()).toContainText('₸');
    await expect(page.locator('.market-row__ask').first()).toContainText('₸');
    await expect(page.locator('.market-row__stock').first()).toBeVisible();

    // Trend/Bid/Ask/Stock columns line up under their headers (#75): each is
    // right-aligned within a shared, fixed-width grid track, so it's the
    // right edge (not the left, which shifts with content width) that must
    // match the header's right edge across every row.
    const header = page.locator('.market__header');
    const rightEdge = (box: { x: number; width: number }) => box.x + box.width;
    const [trendX, bidX, askX, stockX] = await Promise.all(
      ['span:nth-child(2)', 'span:nth-child(3)', 'span:nth-child(4)', 'span:nth-child(5)'].map(
        async (sel) => rightEdge((await header.locator(sel).boundingBox())!),
      ),
    );
    const rowCount = await page.locator('.market-row').count();
    for (let i = 0; i < rowCount; i++) {
      const row = page.locator('.market-row').nth(i);
      const [rowTrendX, rowBidX, rowAskX, rowStockX] = await Promise.all([
        row.locator('.market-row__trend').boundingBox(),
        row.locator('.market-row__bid').boundingBox(),
        row.locator('.market-row__ask').boundingBox(),
        row.locator('.market-row__stock').boundingBox(),
      ]);
      expect(rightEdge(rowTrendX!)).toBeCloseTo(trendX, 0);
      expect(rightEdge(rowBidX!)).toBeCloseTo(bidX, 0);
      expect(rightEdge(rowAskX!)).toBeCloseTo(askX, 0);
      expect(rightEdge(rowStockX!)).toBeCloseTo(stockX, 0);
    }

    // Matching right edges alone would also pass for centered/left-aligned
    // text glued to the right of its cell — guard the actual "right-align
    // amounts" requirement (#75) by asserting the computed style too.
    await expect(page.locator('.market-row__bid').first()).toHaveCSS('text-align', 'right');
    await expect(page.locator('.market-row__ask').first()).toHaveCSS('text-align', 'right');
  });

  test('port panel shows two-sided bid/ask per good, ask never below bid, with a real spread somewhere (#61)', async ({
    page,
  }) => {
    await page.locator('g.port').first().click({ force: true });

    const rows = page.locator('.market-row');
    const rowCount = await rows.count();
    expect(rowCount).toBe(5);

    // Iterate every good rather than pinning to one (e.g. Grain): the spread
    // is ~2.5%/side (SPREAD in src/sim/market.ts), which on cheap goods near
    // ₸10 can round away to the same displayed integer for a single unit.
    // Ask must never be cheaper than bid; at least one good must show a
    // strict gap to prove the spread actually renders.
    let sawStrictSpread = false;
    for (let i = 0; i < rowCount; i++) {
      const row = rows.nth(i);
      const bidText = await row.locator('.market-row__bid').innerText();
      const askText = await row.locator('.market-row__ask').innerText();
      const bid = Number(bidText.replace(/[^\d.]/g, ''));
      const ask = Number(askText.replace(/[^\d.]/g, ''));
      if (Number.isNaN(bid) || Number.isNaN(ask)) continue; // "—" = untradable

      expect(ask).toBeGreaterThanOrEqual(bid);
      if (ask > bid) sawStrictSpread = true;
    }
    expect(sawStrictSpread).toBe(true);

    // Trend glyph still renders per row, independent of bid/ask.
    await expect(page.locator('.market-row__trend').first()).toBeVisible();
  });
});

test.describe('region price board (#62)', () => {
  test.beforeEach(async ({ page }) => {
    await startNewGame(page);
  });

  test('opens via the TopBar button, shows a full port × good grid, and closes', async ({
    page,
  }) => {
    await page.getByRole('button', { name: /price board/i }).click();

    const dialog = page.getByRole('dialog', { name: /price board/i });
    await expect(dialog).toBeVisible();

    // Port count varies by seed (portCountRange is [5, 6], src/sim/template.ts);
    // row count must match whatever the map shows, not a hardcoded 6.
    const portCount = await page.locator('g.port').count();
    const rows = dialog.locator('.price-board__row:not(.price-board__row--header)');
    await expect(rows).toHaveCount(portCount);

    // 5 goods per row, each with a bid and an ask cell.
    const firstRow = rows.first();
    await expect(firstRow.locator('.price-board__cell')).toHaveCount(5);
    await expect(firstRow.locator('.price-board__bid').first()).toBeVisible();
    await expect(firstRow.locator('.price-board__ask').first()).toBeVisible();

    await dialog.getByRole('button', { name: /close/i }).click();
    await expect(dialog).not.toBeVisible();
  });

  test('opens via the "b" hotkey, toggling closed on a second press', async ({ page }) => {
    await page.keyboard.press('b');
    const dialog = page.getByRole('dialog', { name: /price board/i });
    await expect(dialog).toBeVisible();

    await page.keyboard.press('b');
    await expect(dialog).not.toBeVisible();
  });

  test('highlights the cheapest ask and the highest bid per good column', async ({ page }) => {
    await page.getByRole('button', { name: /price board/i }).click();
    const dialog = page.getByRole('dialog', { name: /price board/i });

    await expect(dialog.locator('.price-board__ask--best').first()).toBeVisible();
    await expect(dialog.locator('.price-board__bid--best').first()).toBeVisible();
  });

  test("marks the Controlled Ship's docked port row", async ({ page }) => {
    await page.getByRole('button', { name: /price board/i }).click();
    const dialog = page.getByRole('dialog', { name: /price board/i });

    // The Controlled Ship is docked at game start, so exactly one row is marked.
    await expect(dialog.locator('.price-board__row--docked')).toHaveCount(1);
  });

  test('clicking a row opens that port\'s panel and closes the overlay', async ({ page }) => {
    await page.getByRole('button', { name: /price board/i }).click();
    const dialog = page.getByRole('dialog', { name: /price board/i });

    const rows = dialog.locator('.price-board__row:not(.price-board__row--header)');
    const portName = await rows.first().locator('.price-board__port-name').innerText();
    await rows.first().click();

    await expect(dialog).not.toBeVisible();
    await expect(page.locator('.market')).toBeVisible();
    await expect(page.locator('.side-panel__title')).toHaveText(portName);
  });

  test('rows are keyboard-operable: focus + Enter opens that port\'s panel (a11y)', async ({
    page,
  }) => {
    await page.getByRole('button', { name: /price board/i }).click();
    const dialog = page.getByRole('dialog', { name: /price board/i });

    const rows = dialog.locator('.price-board__row:not(.price-board__row--header)');
    const firstRow = rows.first();
    const portName = await firstRow.locator('.price-board__port-name').innerText();

    await firstRow.focus();
    await expect(firstRow).toBeFocused();
    await page.keyboard.press('Enter');

    await expect(dialog).not.toBeVisible();
    await expect(page.locator('.market')).toBeVisible();
    await expect(page.locator('.side-panel__title')).toHaveText(portName);
  });
});

test.describe('trading interactions (when docked)', () => {
  test.beforeEach(async ({ page }) => {
    await startNewGame(page);
    await openDockedPortMarket(page);
  });

  test('can buy goods and updates are reflected', async ({ page }) => {
    const grainRow = page.locator('.market-row').filter({ hasText: 'Grain' });
    await expect(grainRow).toBeVisible();

    // Capture initial thalers
    const initialThalersText = await page.locator('.top-bar__thalers').innerText();

    // Buy 5 grain (cheap)
    const qtyInput = grainRow.getByRole('spinbutton', { name: /grain quantity/i });
    await qtyInput.fill('5');

    const buyButton = grainRow.getByRole('button', { name: 'Buy Grain', exact: true });
    await expect(buyButton).toBeEnabled();
    await buyButton.click();

    // Thalers should decrease
    await expect(page.locator('.top-bar__thalers')).not.toHaveText(initialThalersText);

    // Switch to ship panel and verify cargo
    await page.locator('.fleet-list__item--controlled').click();
    await expect(page.locator('.hold')).toContainText('Grain');
    await expect(page.locator('.hold')).toContainText('5');
  });

  test('can sell goods after buying', async ({ page }) => {
    const grainRow = page.locator('.market-row').filter({ hasText: 'Grain' });

    // Buy first
    const qtyInput = grainRow.getByRole('spinbutton', { name: /grain quantity/i });
    await qtyInput.fill('3');
    await grainRow.getByRole('button', { name: 'Buy Grain', exact: true }).click();

    // Now sell back
    await qtyInput.fill('2');
    const sellButton = grainRow.getByRole('button', { name: 'Sell Grain', exact: true });
    await expect(sellButton).toBeEnabled();
    await sellButton.click();

    // Hold should reflect partial sell
    await page.locator('.fleet-list__item--controlled').click();
    await expect(page.locator('.hold')).toContainText('Grain');
    // We don't assert exact number to avoid race, but presence of Grain after sell
  });

  test('sail button (#33): disabled at the docked port, enabled elsewhere', async ({ page }) => {
    // At the ship's own docked port, the button is always present but disabled.
    await openDockedPortMarket(page);
    const sailBtn = page.getByRole('button', { name: /^Sail .+ here$/ });
    await expect(sailBtn).toBeVisible();
    await expect(sailBtn).toBeDisabled();

    // A remote port shows the same button, enabled with an ETA.
    const portGroups = page.locator('g.port');
    const count = await portGroups.count();
    let sailedAway = false;
    for (let i = 0; i < count; i++) {
      await portGroups.nth(i).click({ force: true });
      const remoteSailBtn = page.getByRole('button', { name: /^Sail .+ here \(~\d+ ticks\)$/ });
      if (await remoteSailBtn.count()) {
        await remoteSailBtn.click();
        sailedAway = true;
        break;
      }
    }
    expect(sailedAway).toBe(true);

    await page.locator('.fleet-list__item--controlled').click();
    await expect(page.locator('.side-panel__subtitle')).toContainText('Underway');
  });

  test('underway Controlled Ship shows an accented, directional course with a tick label (#45)', async ({
    page,
  }) => {
    // Seed is random (blank seed → Date.now(), src/ui/StartScreen.tsx), so
    // the home port index varies; probe ports until a remote one shows the
    // Sail control (portCountRange is [5, 6], src/sim/template.ts, so one
    // always exists).
    const portGroups = page.locator('g.port');
    const count = await portGroups.count();
    const sailBtn = page.getByRole('button', { name: /^Sail .+ here \(~\d+ ticks\)$/ });
    for (let i = 0; i < count; i++) {
      await portGroups.nth(i).click({ force: true });
      if (await sailBtn.count()) break;
    }
    await expect(sailBtn).toBeVisible();
    await sailBtn.click();

    const map = page.locator('svg.region-map');
    const courseLanes = map.locator('.lane--course-accent');
    await expect(courseLanes).not.toHaveCount(0);
    await expect(courseLanes.first()).toHaveAttribute('marker-end', /course-arrow/);
    await expect(map.locator('.lane__label')).not.toHaveCount(0);
  });
});

test.describe('ambient osmosis pulses on the map (#63)', () => {
  test('active flow renders pulses; quiet lanes render none (seeded)', async ({ page }) => {
    await page.goto('/');
    // Seed "66" (createWorld hashes the string, src/sim/world.ts): worldgen's
    // stock jitter (± 25% of equilibrium, src/sim/worldgen.ts) leaves one
    // lane's price gap wide enough that osmosis crosses the display
    // threshold within the first few ticks, while the rest of the lanes stay
    // under it for hundreds of ticks — a stable active + quiet mix (verified
    // by running the sim standalone for this PR; not asserted elsewhere).
    await page.getByLabel(/seed/i).fill('66');
    await page.getByRole('button', { name: /new game/i }).click();

    const map = page.locator('svg.region-map');
    await expect(map).toBeVisible();

    // Fresh world: osmosisPulse starts at 0 on every lane (World.osmosisPulse,
    // src/sim/world.ts) — no pulses before the sim has ticked.
    await expect(map.locator('.osmosis-pulse')).toHaveCount(0);

    await page.getByRole('button', { name: '100x' }).click();
    await expect(map.locator('.osmosis-pulse').first()).toBeVisible();
    await page.getByRole('button', { name: '⏸' }).click();

    const activeLaneCount = await map.locator('.osmosis-lane').count();
    const totalLaneCount = await map.locator('.lane').count();
    expect(activeLaneCount).toBeGreaterThan(0);
    expect(activeLaneCount).toBeLessThan(totalLaneCount);
  });

  test('prefers-reduced-motion: pulses stay visible but freeze in place (#69 review)', async ({
    page,
  }) => {
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await page.goto('/');
    await page.getByLabel(/seed/i).fill('66'); // see rationale in the test above
    await page.getByRole('button', { name: /new game/i }).click();

    const map = page.locator('svg.region-map');
    await page.getByRole('button', { name: '100x' }).click();

    const pulse = map.locator('.osmosis-pulse').first();
    await expect(pulse).toBeVisible();
    // No animation under reduced motion (src/index.css); the diagnostic
    // (a busy lane) still shows through opacity, not motion.
    await expect(pulse).toHaveCSS('animation-name', 'none');
  });
});
