import { expect, type Locator, type Page } from '@playwright/test';
import { GOOD_IDS, type GoodId, type PortId, type StopOrder } from '../src/sim';
import { GOOD_NAME_PL } from '../src/store/goodDisplay';

/**
 * Shared board-authoring driver (#472, docs/specs/E16-workbench.md
 * §Construction is port-centric, §Attaching orders — D1 cell-click + radial
 * menu, D7 "więcej" drawer). The Trasy tab's list editor — `Nowa trasa` →
 * `Dodaj przystanek` → per-Stop chip table — is **gone** (§Trasy roster → the
 * board owns Routes entirely); this is its replacement, written once and
 * consumed by every e2e file that authors or inspects a Route on the board
 * (`headquarters.spec.ts`, `route-qty-margin-gate.spec.ts`,
 * `storehouse.spec.ts`, `board-market-free-orders.spec.ts`, `ui.spec.ts`).
 *
 * The gesture (unchanged across every caller): a good's grid **cell** opens a
 * radial menu at the click point offering `kup`/`sprzedaj`/`dostarcz`;
 * picking one places the Stop (if the port isn't in the draft yet) *and*
 * attaches the order in one gesture. `store`/`withdraw` are never offered by
 * the radial menu (§The market-free kinds point 2) — they're reached by
 * attaching any market kind first, then switching it via the ribbon chip's
 * "więcej" drawer's kind picker (`pickOrderKind`).
 */

/** Polish labels the radial menu and the drawer's kind picker render
 *  (`PriceBoardOverlay.tsx`'s private `ORDER_KIND_LABEL` — duplicated here,
 *  matching this codebase's existing convention of embedding literal
 *  player-facing strings directly in e2e specs rather than importing
 *  UI-internal constants). */
const ORDER_KIND_LABEL: Record<StopOrder['kind'], string> = {
  buy: 'Kup',
  sell: 'Sprzedaj',
  deliver: 'Dostarcz',
  store: 'Złóż',
  withdraw: 'Pobierz',
};

const GOOD_INDEX: Record<GoodId, number> = Object.fromEntries(
  GOOD_IDS.map((g, i) => [g, i]),
) as Record<GoodId, number>;

function escapeRegExp(text: string): string {
  return text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/** Opens the Price Board overlay via the TopBar button and returns its
 *  dialog locator. */
export async function openBoard(page: Page): Promise<Locator> {
  await page.getByRole('button', { name: /tablica cen/i }).click();
  const dialog = page.getByRole('dialog', { name: /tablica cen/i });
  await expect(dialog).toBeVisible();
  return dialog;
}

/** Every port row (header excluded) — the board's authoring/reading grid. */
export function boardRows(dialog: Locator): Locator {
  return dialog.locator('.price-board__row:not(.price-board__row--header)');
}

/** Starts a brand-new draft via the authoring bar's "Nowa trasa" tab
 *  (`role="tab"` — the route tabs strip, not a plain button, since #468
 *  turned the roster into a tab row). */
export async function startNewRoute(dialog: Locator): Promise<void> {
  await dialog.getByRole('tab', { name: 'Nowa trasa' }).click();
}

/** Loads an existing Route into the board editor via its own authoring-bar
 *  tab — the "Edytuj →" seam's replacement (§Trasy roster → the board owns
 *  Routes entirely). `exact` avoids "Trasa 1" matching "Trasa 10". */
export async function loadRouteTab(dialog: Locator, routeName: string): Promise<void> {
  await dialog.getByRole('tab', { name: routeName, exact: true }).click();
}

/** A good's grid-cell button, addressed directly by the `data-cell-key`
 *  (`${portId}:${good}`) `PriceBoardOverlay.tsx` stamps on it — robust to
 *  port row order, unlike indexing rows positionally. Resolves to nothing
 *  once the cell holds a market-free order (#419 AC3: the cell renders no
 *  button at all, staying click-inert by construction). */
export function cellButton(dialog: Locator, portId: PortId, good: GoodId): Locator {
  return dialog.locator(`[data-cell-key="${portId}:${good}"]`);
}

/** A port's own row, matched by its exact port name anchored at the start of
 *  the row's own text content (`.price-board__port-name` may carry a
 *  storehouse/pairing marker or a "+" button as siblings, and the row's own
 *  text goes on to include the archetype caption and every good's quotes —
 *  anchoring at `^` is enough since the port name is always the row's first
 *  rendered text). */
export function portRow(dialog: Locator, portName: string): Locator {
  const exact = new RegExp(`^${escapeRegExp(portName)}`);
  return dialog.locator('.price-board__row:not(.price-board__row--header)').filter({ hasText: exact });
}

/** The plain, non-interactive cell `<span>` itself — present whether or not
 *  a button lives inside it. Locating and clicking *this* (rather than
 *  `cellButton`) is how the #404 regression guard simulates "a plain click
 *  on that cell": if a future regression re-adds a click handler where one
 *  must not exist, a real click here would reach it. */
export function cellSpan(dialog: Locator, portName: string, good: GoodId): Locator {
  return portRow(dialog, portName).locator('.price-board__cell').nth(GOOD_INDEX[good]);
}

/** Cell click → radial menu → pick `kind`. Places the Stop (if `portId`
 *  isn't in the draft yet) and attaches the order in one gesture (D1). Only
 *  `buy`/`sell`/`deliver` are ever offered by the radial menu. */
export async function attachOrder(
  dialog: Locator,
  portId: PortId,
  good: GoodId,
  kind: 'buy' | 'sell' | 'deliver',
): Promise<void> {
  await cellButton(dialog, portId, good).click();
  await dialog.getByRole('menuitem', { name: ORDER_KIND_LABEL[kind] }).click();
}

/** The Nth Stop's ribbon slot (0-based, matching `draft.stops` order) — every
 *  Stop's chip, drawer, qty/minMargin fields and remove control live here
 *  (§Visual contract — "every Stop's info and controls live in the ribbon").
 *  Below 2 Stops the board draws its own single-Stop mini-rail instead of
 *  `RouteRibbon`, which reuses the same `.route-ribbon__slot` class but never
 *  renders an action row — a chip/drawer is only reachable once a second Stop
 *  exists. */
export function ribbonSlot(dialog: Locator, stopIndex: number): Locator {
  return dialog.locator('.route-ribbon__slot').nth(stopIndex);
}

/** The order chip's own label element for `good` at the Stop `stopIndex`
 *  (`.route-ribbon__chip-label`) — one chip per (Stop, good), so scoping by
 *  slot is required once the same good appears at more than one Stop (e.g.
 *  bought at Stop 1, sold at Stop 2). */
export function chipLabel(dialog: Locator, stopIndex: number, good: GoodId): Locator {
  return ribbonSlot(dialog, stopIndex).locator('.route-ribbon__chip-label', {
    hasText: GOOD_NAME_PL[good],
  });
}

/** The whole `.route-ribbon__order` block (chip + its drawer) for `good` at
 *  the Stop `stopIndex` — scoping needed for class-named drawer content
 *  (`.price-board__order-kind-picker` etc.) shared markup across every
 *  good's drawer, where the aria-labelled helpers above are already precise
 *  enough on their own. */
export function orderBlock(dialog: Locator, stopIndex: number, good: GoodId): Locator {
  return ribbonSlot(dialog, stopIndex)
    .locator('.route-ribbon__order')
    .filter({ hasText: GOOD_NAME_PL[good] });
}

/** The drawer's kind-picker buttons for `good` at the Stop `stopIndex` —
 *  "the complete truth about kind" (#419 AC1): every kind legal in that
 *  cell, buy/sell included. Requires the drawer to already be open. */
export function orderKindPickerButtons(dialog: Locator, stopIndex: number, good: GoodId): Locator {
  return orderBlock(dialog, stopIndex, good).locator('.price-board__order-kind-picker button');
}

/** Opens (toggles) the "więcej" drawer for `good`'s chip at the Stop
 *  `stopIndex` — the drawer is the complete kind picker (#419 AC1) plus,
 *  buy/sell only, the qty/minMargin progressive-disclosure fields. */
export async function toggleOrderDrawer(
  dialog: Locator,
  stopIndex: number,
  good: GoodId,
): Promise<void> {
  await ribbonSlot(dialog, stopIndex)
    .getByRole('button', { name: `${GOOD_NAME_PL[good]}: więcej opcji` })
    .click();
}

/** The drawer's kind-picker gesture (`setStopOrderKind` — sets, never
 *  toggles off): the only way to reach `store`/`withdraw`, and the way to
 *  switch a Stop's good back to `buy`/`sell` from any kind. Requires the
 *  drawer to already be open (`toggleOrderDrawer`). */
export async function pickOrderKind(
  dialog: Locator,
  stopIndex: number,
  good: GoodId,
  kind: StopOrder['kind'],
): Promise<void> {
  await ribbonSlot(dialog, stopIndex)
    .getByRole('button', { name: `${GOOD_NAME_PL[good]}: ustaw zlecenie na ${ORDER_KIND_LABEL[kind]}` })
    .click();
}

export function qtyInput(dialog: Locator, stopIndex: number, good: GoodId): Locator {
  return ribbonSlot(dialog, stopIndex).getByLabel(`${GOOD_NAME_PL[good]} ile sztuk`);
}

export function minMarginInput(dialog: Locator, stopIndex: number, good: GoodId): Locator {
  return ribbonSlot(dialog, stopIndex).getByLabel(`${GOOD_NAME_PL[good]} próg marży`);
}

/** Removes the Stop at `stopIndex` (0-based) via its own ribbon edit control
 *  — the aria-label is 1-based, matching the ribbon's own player-facing
 *  numbering. */
export async function removeStop(dialog: Locator, stopIndex: number, portName: string): Promise<void> {
  await dialog.getByRole('button', { name: `Usuń przystanek ${stopIndex + 1}: ${portName}` }).click();
}

/** Saves the draft — "Zapisz trasę" for a brand-new Route, "Zapisz zmiany"
 *  when editing an existing one (`editingExisting`, PriceBoardOverlay.tsx). */
export async function saveRoute(dialog: Locator): Promise<void> {
  await dialog.getByRole('button', { name: /^Zapisz (trasę|zmiany)$/ }).click();
}
