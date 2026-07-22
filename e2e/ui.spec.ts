import { test, expect, type Locator, type Page } from '@playwright/test';
import { createWorld, type Ship, type World } from '../src/sim';
import { SAVE_VERSION } from '../src/store/persistence';

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

  test('digit hotkeys switch speed; space pauses and resumes to the previous speed (#56)', async ({
    page,
  }) => {
    const rate = (label: string) => page.getByRole('button', { name: label });
    await expect(rate('1x')).toHaveAttribute('aria-pressed', 'true'); // default after newGame

    // Set speed via hotkeys so no rate button holds focus (space would else
    // both activate the button and toggle pause — preventDefault guards that,
    // but driving purely by keyboard keeps the assertion unambiguous).
    await page.keyboard.press('3');
    await expect(rate('100x')).toHaveAttribute('aria-pressed', 'true');

    await page.keyboard.press('Space'); // pause
    await expect(rate('⏸')).toHaveAttribute('aria-pressed', 'true');

    await page.keyboard.press('Space'); // resume — to 100x, not 1x (#123 lastActiveSpeed)
    await expect(rate('100x')).toHaveAttribute('aria-pressed', 'true');

    await page.keyboard.press('2');
    await expect(rate('10x')).toHaveAttribute('aria-pressed', 'true');
    await page.keyboard.press('1');
    await expect(rate('1x')).toHaveAttribute('aria-pressed', 'true');
  });

  test('speed hotkeys are ignored while typing in a text field (#56)', async ({ page }) => {
    const rate = (label: string) => page.getByRole('button', { name: label });
    await page.locator('.fleet-list__item--controlled').click();
    const nameInput = page.getByRole('textbox', { name: /ship name/i });
    await nameInput.click(); // focus a text input

    await page.keyboard.press('3'); // would be 100x if the guard were absent
    await expect(rate('1x')).toHaveAttribute('aria-pressed', 'true');
    await page.keyboard.press('Space'); // would pause if the guard were absent
    await expect(rate('1x')).toHaveAttribute('aria-pressed', 'true');
  });

  test('Options → Keybinds tab lists the fixed bindings read-only (#56)', async ({ page }) => {
    await page.getByRole('button', { name: /^Options$/ }).click();
    const dialog = page.getByRole('dialog', { name: /options/i });

    // Default tab is "General" — the auto-pause toggle is first-class.
    await expect(dialog.getByRole('checkbox', { name: /auto-pause on arrival/i })).toBeVisible();

    await dialog.getByRole('tab', { name: /keybinds/i }).click();
    await expect(dialog.getByText('Pause / resume')).toBeVisible();
    await expect(dialog.getByText('Speed 1x / 10x / 100x')).toBeVisible();
    await expect(dialog.getByText('Price Board')).toBeVisible();
    await expect(dialog.getByText('Sail to selected port')).toBeVisible(); // #217
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

  test('HEARTLAND v2: map renders 7-9 ports with matching orbit rings, and exactly one Free port (#146/#147/#148)', async ({
    page,
  }) => {
    const map = page.locator('svg.region-map');
    const ports = map.locator('g.port');
    const portCount = await ports.count();
    expect(portCount).toBeGreaterThanOrEqual(7);
    expect(portCount).toBeLessThanOrEqual(9);
    await expect(map.locator('.orbit-ring')).toHaveCount(portCount);

    // Free port (E12): exactly one per region, own disc/icon, and tinted
    // with the neutral freeport token — never gold (ADR-0006/incident-0002:
    // gold is reserved for the Controlled Ship).
    const freeports = map.locator('g.port[data-archetype="freeport"]');
    await expect(freeports).toHaveCount(1);
    const freeport = freeports.first();
    await expect(freeport.locator('.port__disc')).toHaveCount(1);
    await expect(freeport.locator('.port__icon')).toHaveCount(1);

    const discFill = await freeport.locator('.port__disc').evaluate((el) => getComputedStyle(el).fill);
    expect(discFill).not.toBe('rgb(224, 168, 64)'); // gold, reserved for the Controlled Ship

    // PortPanel shows the Free port archetype label. `toHaveText` compares
    // raw textContent (CSS text-transform doesn't apply, unlike `innerText`
    // — see openDockedPortMarket's note above on the same class), so this
    // checks the underlying string PortPanel renders, not the visually
    // capitalized "Free Port".
    await freeport.click({ force: true });
    await expect(page.locator('.market')).toBeVisible();
    await expect(page.locator('.side-panel__subtitle')).toHaveText('Free port');
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

  test('ship panel: the docked port name is a keyboard-operable link that opens that port\'s panel (#196)', async ({
    page,
  }) => {
    await openControlledShip(page);

    const subtitle = page.locator('.side-panel__subtitle');
    const portLink = subtitle.locator('.port-link');
    await expect(portLink).toBeVisible();
    const dockedPortName = await portLink.innerText();

    // Real button semantics: focusable, Enter activates (not just clickable).
    await portLink.focus();
    await expect(portLink).toBeFocused();
    await page.keyboard.press('Enter');

    // Opens the same port panel a map click would — the market table, headed
    // by the docked port's own name.
    await expect(page.locator('.market')).toBeVisible();
    await expect(page.locator('.side-panel__title')).toHaveText(dockedPortName);
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

  test('good icons render before every good name, and the archetype icon before the port subtitle (#74)', async ({
    page,
  }) => {
    await page.locator('g.port').first().click({ force: true });
    await expect(page.locator('.market')).toBeVisible();

    // One icon per good row (5 goods).
    await expect(page.locator('.market-row__name svg.market-row__icon')).toHaveCount(5);

    // The archetype icon sits before the archetype label under the port name.
    await expect(page.locator('.side-panel__subtitle svg.side-panel__subtitle-icon')).toHaveCount(
      1,
    );
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

    // Port count varies by seed (portCountRange is [7, 9], src/sim/template.ts);
    // row count must match whatever the map shows, not a hardcoded count.
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

  test('shows the trend legend explaining the last-day-boundary comparison (#127)', async ({
    page,
  }) => {
    await page.getByRole('button', { name: /price board/i }).click();
    const dialog = page.getByRole('dialog', { name: /price board/i });

    // A fresh player misread the glyphs as "vs the starting price" — the
    // legend must state the real window and explicitly rule that out.
    await expect(dialog.locator('.price-board__legend')).toContainText('ostatniej granicy dnia');
    await expect(dialog.locator('.price-board__legend')).toContainText('nie ceny początkowej');

    const glyphTitle = await dialog.locator('.price-board__trend').first().getAttribute('title');
    expect(glyphTitle).toContain('ostatniej granicy dnia');
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

  test('clicking the backdrop closes the overlay; clicking inside the panel does not (#126)', async ({
    page,
  }) => {
    await page.getByRole('button', { name: /price board/i }).click();
    const dialog = page.getByRole('dialog', { name: /price board/i });
    await expect(dialog).toBeVisible();

    // `dialog` is the `.overlay` backdrop itself (role="dialog" sits on the
    // outer div); a position near its corner lands outside the centered
    // `.overlay__panel`, unlike a plain .click() which hits the panel.
    await dialog.locator('.overlay__title').click();
    await expect(dialog).toBeVisible();

    await dialog.click({ position: { x: 5, y: 5 } });
    await expect(dialog).not.toBeVisible();
  });

  test('Esc closes the overlay (#126)', async ({ page }) => {
    await page.getByRole('button', { name: /price board/i }).click();
    const dialog = page.getByRole('dialog', { name: /price board/i });
    await expect(dialog).toBeVisible();

    await page.keyboard.press('Escape');
    await expect(dialog).not.toBeVisible();
  });

  test('"," / "." cycle the tabs, wrapping around (#218)', async ({ page }) => {
    await page.getByRole('button', { name: /price board/i }).click();
    const dialog = page.getByRole('dialog', { name: /price board/i });
    const ceny = page.getByRole('tab', { name: 'Ceny' });
    const kontrakty = page.getByRole('tab', { name: 'Kontrakty' });

    await expect(ceny).toHaveAttribute('aria-selected', 'true');
    await expect(kontrakty).toHaveAttribute('aria-selected', 'false');

    // "." advances Ceny -> Kontrakty, then wraps back to Ceny (only 2 tabs).
    await page.keyboard.press('.');
    await expect(kontrakty).toHaveAttribute('aria-selected', 'true');
    await expect(ceny).toHaveAttribute('aria-selected', 'false');

    await page.keyboard.press('.');
    await expect(ceny).toHaveAttribute('aria-selected', 'true');

    // "," retreats Ceny -> Kontrakty (wrapping the other way).
    await page.keyboard.press(',');
    await expect(kontrakty).toHaveAttribute('aria-selected', 'true');

    await dialog.getByRole('button', { name: /close/i }).click();
  });
});

test.describe('price board — port-centric route authoring (#394, docs/specs/E16-workbench.md)', () => {
  test.beforeEach(async ({ page }) => {
    await startNewGame(page);
  });

  test('default (no draft) row-click still opens the port panel — the coexistence rule holds', async ({
    page,
  }) => {
    await page.getByRole('button', { name: /price board/i }).click();
    const dialog = page.getByRole('dialog', { name: /price board/i });
    const rows = dialog.locator('.price-board__row:not(.price-board__row--header)');
    const portName = await rows.first().locator('.price-board__port-name').innerText();
    await rows.first().click();

    await expect(dialog).not.toBeVisible();
    await expect(page.locator('.side-panel__title')).toHaveText(portName);
  });

  test('port-row click appends a Stop; a second port-row click appends the second Stop and shows the ribbon loop', async ({
    page,
  }) => {
    await page.getByRole('button', { name: /price board/i }).click();
    const dialog = page.getByRole('dialog', { name: /price board/i });

    await dialog.getByRole('button', { name: 'Nowa trasa' }).click();
    const rows = dialog.locator('.price-board__row:not(.price-board__row--header)');
    await expect(rows.nth(0)).not.toHaveClass(/price-board__row--in-draft/);

    await rows.nth(0).click();
    await expect(dialog).toBeVisible(); // authoring click never closes the board
    await expect(rows.nth(0)).toHaveClass(/price-board__row--in-draft/);

    // A single Stop doesn't clear the isValidRoute bar yet — Save stays
    // disabled and the ribbon (>=2 nodes) doesn't render.
    await expect(dialog.getByRole('button', { name: 'Zapisz trasę' })).toBeDisabled();
    await expect(dialog.locator('.route-ribbon')).toHaveCount(0);

    await rows.nth(1).click();
    await expect(rows.nth(1)).toHaveClass(/price-board__row--in-draft/);
    await expect(dialog.getByRole('button', { name: 'Zapisz trasę' })).toBeEnabled();

    // The ribbon shows the loop closure (↻) for the 2-Stop draft.
    await expect(dialog.locator('.route-ribbon')).toBeVisible();
    await expect(dialog.locator('.route-ribbon__return-arc')).toBeVisible();
    await expect(dialog.getByText('↻')).toBeVisible();
  });

  test('good-cell click attaches an order with the context-inferred kind, and the pairing highlight appears on the best-bid port', async ({
    page,
  }) => {
    await page.getByRole('button', { name: /price board/i }).click();
    const dialog = page.getByRole('dialog', { name: /price board/i });
    await dialog.getByRole('button', { name: 'Nowa trasa' }).click();

    const rows = dialog.locator('.price-board__row:not(.price-board__row--header)');
    const firstRow = rows.first();
    await firstRow.click(); // Stop 1

    // Click the first cell button in the newly-in-draft row — attaches an
    // order with an inferred kind (buy or sell), visible as an order chip.
    const cellBtn = firstRow.locator('.price-board__cell-btn').first();
    await cellBtn.click();
    const chip = firstRow.locator('.price-board__order-chip').first();
    await expect(chip).toBeVisible();
    await expect(chip.locator('.price-board__order-chip-label')).toHaveText(/Kup|Sprzedaj/);

    // If the attached order was a buy, its good's best-bid port row now
    // carries the highlight-only pairing suggestion (a ★ marker) — never an
    // auto-added Stop (the suggested row is not marked in-draft).
    const label = await chip.locator('.price-board__order-chip-label').innerText();
    if (label.startsWith('Kup')) {
      const suggestedRow = dialog.locator('.price-board__row--suggested');
      await expect(suggestedRow).toHaveCount(1);
      await expect(suggestedRow).not.toHaveClass(/price-board__row--in-draft/);

      // Clicking that suggested port adds it as the second Stop — the
      // player still has to click; nothing auto-wires. Re-locate by port
      // name after the click: `.price-board__row--suggested` no longer
      // matches once the class flips to `--in-draft`, so the original
      // locator would resolve to nothing.
      const suggestedPortName = await suggestedRow.locator('.price-board__port-name').innerText();
      await suggestedRow.click();
      const nowStop = rows.filter({ hasText: suggestedPortName.replace(/\s*★\s*$/, '') });
      await expect(nowStop).toHaveClass(/price-board__row--in-draft/);
      await expect(dialog.locator('.price-board__row--suggested')).toHaveCount(0);
    }
  });

  test('the order chip flip button overrides the inferred kind', async ({ page }) => {
    await page.getByRole('button', { name: /price board/i }).click();
    const dialog = page.getByRole('dialog', { name: /price board/i });
    await dialog.getByRole('button', { name: 'Nowa trasa' }).click();

    const rows = dialog.locator('.price-board__row:not(.price-board__row--header)');
    const firstRow = rows.first();
    await firstRow.click();
    await firstRow.locator('.price-board__cell-btn').first().click();

    const chip = firstRow.locator('.price-board__order-chip').first();
    const before = await chip.locator('.price-board__order-chip-label').innerText();
    await chip.getByRole('button', { name: /zmień na/ }).click();
    const after = await chip.locator('.price-board__order-chip-label').innerText();
    expect(after.startsWith('Kup')).toBe(!before.startsWith('Kup'));
  });

  test('"Anuluj" discards the draft without dispatching a Route', async ({ page }) => {
    await page.getByRole('button', { name: /price board/i }).click();
    const dialog = page.getByRole('dialog', { name: /price board/i });
    await dialog.getByRole('button', { name: 'Nowa trasa' }).click();

    const rows = dialog.locator('.price-board__row:not(.price-board__row--header)');
    await rows.nth(0).click();
    await rows.nth(1).click();
    await dialog.getByRole('button', { name: 'Anuluj' }).click();

    await expect(dialog.getByRole('button', { name: 'Nowa trasa' })).toBeVisible();
    await expect(dialog.locator('.route-ribbon')).toHaveCount(0);
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

    // The destination port name is a link too (#196): opens that port's
    // panel, same as the docked case above.
    const destLink = page.locator('.side-panel__subtitle .port-link');
    const destName = await destLink.innerText();
    await destLink.click();
    await expect(page.locator('.market')).toBeVisible();
    await expect(page.locator('.side-panel__title')).toHaveText(destName);
  });

  test('underway Controlled Ship shows an accented, directional course with a tick label (#45)', async ({
    page,
  }) => {
    // Seed is random (blank seed → Date.now(), src/ui/StartScreen.tsx), so
    // the home port index varies; probe ports until a remote one shows the
    // Sail control (portCountRange is [7, 9], src/sim/template.ts, so one
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

test.describe('keybind <g> sails the Controlled Ship to the selected port (#217)', () => {
  test.beforeEach(async ({ page }) => {
    await startNewGame(page);
  });

  test('no-op with no selection', async ({ page }) => {
    await page.keyboard.press('g');
    await openControlledShip(page);
    await expect(page.locator('.side-panel__subtitle')).toContainText(/^Docked at/i);
  });

  test('no-op when a ship (not a port) is selected', async ({ page }) => {
    await openControlledShip(page);
    await page.keyboard.press('g');
    await expect(page.locator('.side-panel__subtitle')).toContainText(/^Docked at/i);
  });

  test('no-op when the sailability gate is disabled (already docked here)', async ({ page }) => {
    await openDockedPortMarket(page);
    await page.keyboard.press('g');
    await openControlledShip(page);
    await expect(page.locator('.side-panel__subtitle')).toContainText(/^Docked at/i);
  });

  test('sails the Controlled Ship to the selected port, mirroring the Sail button (#33)', async ({
    page,
  }) => {
    // Select a remote, reachable port the same way the Sail-button test does
    // (ui.spec.ts "sail button (#33)"): probe ports until one shows the
    // enabled Sail control.
    const portGroups = page.locator('g.port');
    const count = await portGroups.count();
    const enabledSailBtn = page.getByRole('button', { name: /^Sail .+ here \(~\d+ ticks\)$/ });
    let selected = false;
    for (let i = 0; i < count; i++) {
      await portGroups.nth(i).click({ force: true });
      if (await enabledSailBtn.count()) {
        selected = true;
        break;
      }
    }
    expect(selected).toBe(true);
    const destinationName = await page.locator('.side-panel__title').innerText();

    await page.keyboard.press('g');

    // The gate flips to "Underway" — the same disabled state the Sail button
    // shows after a manual click — proving the keydown actually dispatched
    // sailTo, not just a visual no-op.
    const disabledSailBtn = page.getByRole('button', { name: /^Sail .+ here$/ });
    await expect(disabledSailBtn).toBeDisabled();
    await expect(disabledSailBtn).toHaveAttribute('title', 'Underway — dock to sail elsewhere.');

    await openControlledShip(page);
    await expect(page.locator('.side-panel__subtitle')).toContainText('Underway');
    // The course actually targets the port that was selected, not just any
    // port (portId: selection.id — belt-and-suspenders on top of the
    // disabled-Underway check above).
    await expect(page.locator('.side-panel__subtitle .port-link')).toHaveText(destinationName);
  });
});

test.describe('ambient osmosis skiffs on the map (#161, replaces the pulses #63)', () => {
  async function startAtSeed66(page: Page) {
    await page.goto('/');
    // Seed "66" (createWorld hashes the string, src/sim/world.ts): worldgen's
    // stock jitter (± 25% of equilibrium, src/sim/worldgen.ts) leaves one
    // lane's price gap wide enough that osmosis crosses the display
    // threshold within the first few ticks, while the rest of the lanes stay
    // under it for hundreds of ticks — a stable active + quiet mix (verified
    // by running the sim standalone for this PR; not asserted elsewhere).
    await page.getByLabel(/seed/i).fill('66');
    await page.getByRole('button', { name: /new game/i }).click();
  }

  /** Locates the first skiff of whichever lane is currently active, pinned by
   *  `data-lane-id` so repeated reads over time track the *same* physical
   *  skiff — an unpinned "first `.osmosis-skiff`" read can silently swap to a
   *  different lane's skiff between reads as osmosis magnitudes shift (a
   *  different lane's group can become first in DOM order), producing a
   *  spurious "it moved" false positive unrelated to the freeze/motion
   *  behavior under test. Index 0 of a lane's skiffs sits at phase 0 (the
   *  lane's `from` endpoint) whenever motion is frozen — src/ui/skiffPosition.ts
   *  `skiffFrac` — so it stays put even if that lane's skiff *count* shifts. */
  async function firstActiveSkiff(map: Locator): Promise<Locator> {
    const laneId = await map.locator('.osmosis-lane').first().getAttribute('data-lane-id');
    return map.locator(`.osmosis-lane[data-lane-id="${laneId}"] .osmosis-skiff`).first();
  }

  test('active flow renders skiffs; quiet lanes render none (seeded)', async ({ page }) => {
    await startAtSeed66(page);

    const map = page.locator('svg.region-map');
    await expect(map).toBeVisible();

    // Fresh world: osmosisPulse starts at 0 on every lane (World.osmosisPulse,
    // src/sim/world.ts) — no skiffs before the sim has ticked.
    await expect(map.locator('.osmosis-skiff')).toHaveCount(0);

    await page.getByRole('button', { name: '100x' }).click();
    await expect(map.locator('.osmosis-skiff').first()).toBeVisible();
    await page.getByRole('button', { name: '⏸' }).click();

    const activeLaneCount = await map.locator('.osmosis-lane').count();
    const totalLaneCount = await map.locator('.lane').count();
    expect(activeLaneCount).toBeGreaterThan(0);
    expect(activeLaneCount).toBeLessThan(totalLaneCount);
  });

  test('frozen under pause: sim-time anchoring, not wall-clock (#72)', async ({ page }) => {
    await startAtSeed66(page);
    const map = page.locator('svg.region-map');

    await page.getByRole('button', { name: '100x' }).click();
    await expect(map.locator('.osmosis-skiff').first()).toBeVisible();
    const skiff = await firstActiveSkiff(map);

    await page.getByRole('button', { name: '⏸' }).click();
    const frozenAt = await skiff.getAttribute('transform');
    // A real-time wait while paused: a wall-clock-driven glyph (like the old
    // CSS-animated pulses) would keep moving here — the #72 misreading this
    // glyph is meant to resolve. Sim ticks don't advance while paused, so a
    // tick-derived position must not move either.
    await page.waitForTimeout(700);
    await expect(skiff).toHaveAttribute('transform', frozenAt!);
  });

  test('speed scales skiff motion: running (not paused) visibly advances position', async ({
    page,
  }) => {
    // Positive control for the pause/reduced-motion freeze assertions above
    // and below: proves the position genuinely tracks ticks instead of being
    // a static value that would trivially pass a "stays the same" check
    // (a test that can't fail is not a test).
    await startAtSeed66(page);
    const map = page.locator('svg.region-map');

    await page.getByRole('button', { name: '100x' }).click();
    await expect(map.locator('.osmosis-skiff').first()).toBeVisible();
    const skiff = await firstActiveSkiff(map);

    const at1 = await skiff.getAttribute('transform');
    await page.waitForTimeout(700); // hundreds of ticks at 100x — well over one skiff cycle
    const at2 = await skiff.getAttribute('transform');
    expect(at2).not.toBe(at1);
  });

  test('prefers-reduced-motion: skiffs stay visible but freeze in place (#69 review precedent)', async ({
    page,
  }) => {
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await startAtSeed66(page);
    const map = page.locator('svg.region-map');

    await page.getByRole('button', { name: '100x' }).click();
    await expect(map.locator('.osmosis-skiff').first()).toBeVisible();
    const skiff = await firstActiveSkiff(map);
    const dateLabel = page.locator('.top-bar__date');
    const dateAt1 = await dateLabel.innerText();

    // Unlike the pause test, the sim keeps ticking here — only the *display*
    // freezes (src/ui/skiffPosition.ts skiffFrac: reduced motion pins the
    // fraction at the skiff's spawn phase). Switch down to 1x for the actual
    // observation window: at 100x, hundreds of ticks pass in under a second
    // and this seed's active lane can (correctly, per the live economy) flip
    // its flow direction within that span — a real position jump that would
    // masquerade as a broken freeze. At 1x for ~1 tick, that risk is
    // negligible while the world-date readout still proves ticks genuinely
    // advanced (not just "nothing happened").
    await page.getByRole('button', { name: '1x' }).click();
    const at1 = await skiff.getAttribute('transform');
    await page.waitForTimeout(1_200);
    const at2 = await skiff.getAttribute('transform');
    await expect(dateLabel).not.toHaveText(dateAt1); // proves real ticks elapsed
    expect(at2).toBe(at1);
  });
});

test.describe('pause-cause note (#130)', () => {
  const AUTOSAVE_KEY = 'etersim.autosave';
  const PAUSE_NOTE_TEXT = /auto-pauza: statek zacumował \(wyłączalna w Opcjach\)/;

  /** s0 one tick away from docking at the far end of its shortest lane — lets
   *  the test trigger arrival auto-pause without waiting out a full voyage.
   *  autoPauseOnArrival defaults to on (src/store/settings.ts), so no
   *  settings slot needs seeding. */
  function almostArrivedWorld(seed: string): World {
    const w0 = createWorld(seed);
    const lane = [...w0.region.lanes].sort((x, y) => x.voyageTicks - y.voyageTicks)[0];
    const ship: Ship = {
      ...w0.company.ships[0],
      location: {
        kind: 'underway',
        course: [{ laneId: lane.id, to: lane.b }],
        voyageIndex: 0,
        voyageProgressTicks: lane.voyageTicks - 1,
        destination: lane.b,
      },
    };
    return { ...w0, company: { ...w0.company, ships: [ship] } };
  }

  async function continueWithAlmostArrivedWorld(page: Page, seed: string) {
    const json = JSON.stringify({ version: SAVE_VERSION, world: almostArrivedWorld(seed) });
    await page.addInitScript(
      ({ key, json }) => window.localStorage.setItem(key, json),
      { key: AUTOSAVE_KEY, json },
    );
    await page.goto('/');
    await page.getByRole('button', { name: /continue/i }).click();
    await expect(page.locator('svg.region-map')).toBeVisible();
  }

  test('note appears on arrival auto-pause, absent on manual pause, gone on resume', async ({
    page,
  }) => {
    await continueWithAlmostArrivedWorld(page, 'pause-cause');
    const note = page.getByRole('status').filter({ hasText: PAUSE_NOTE_TEXT });

    // loadWorld always starts paused (no cause yet) — the note must not
    // appear just because the game happens to be stopped.
    await expect(note).not.toBeVisible();

    // Run at 1x: one tick (1000ms sim-time) later the ship docks and
    // arrival auto-pause fires.
    await page.getByRole('button', { name: '1x' }).click();
    await expect(page.getByRole('button', { name: '⏸' })).toHaveAttribute('aria-pressed', 'true', {
      timeout: 5_000,
    });
    await expect(note).toBeVisible();

    // Resume (space): the note is cleared along with the pause cause.
    await page.keyboard.press('Space');
    await expect(note).not.toBeVisible();

    // Manual pause (button): never shows the note.
    await page.getByRole('button', { name: '⏸' }).click();
    await expect(page.getByRole('button', { name: '⏸' })).toHaveAttribute('aria-pressed', 'true');
    await expect(note).not.toBeVisible();
  });

  test('the note appearing/disappearing never changes .top-bar height (#195)', async ({ page }) => {
    await continueWithAlmostArrivedWorld(page, 'pause-cause-height');
    const topBar = page.locator('.top-bar');
    const note = page.getByRole('status').filter({ hasText: PAUSE_NOTE_TEXT });

    const heightBefore = (await topBar.boundingBox())!.height;
    await expect(note).not.toBeVisible();

    await page.getByRole('button', { name: '1x' }).click();
    await expect(note).toBeVisible();
    const heightWithNote = (await topBar.boundingBox())!.height;

    await page.keyboard.press('Space'); // resume clears the note
    await expect(note).not.toBeVisible();
    const heightAfter = (await topBar.boundingBox())!.height;

    expect(heightWithNote).toBe(heightBefore);
    expect(heightAfter).toBe(heightBefore);
  });
});
