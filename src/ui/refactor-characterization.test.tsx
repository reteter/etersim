// @vitest-environment jsdom
//
// Render-altitude characterization net for the three coupled UI/store surfaces
// about to be refactored by #319 (fleet-resolution selector), #320 (single
// `activeOverlay` replacing three booleans) and #321 (cleaving the route domain
// out of HeadquartersPanel). It pins what those refactors must PRESERVE, so a
// behaviour-preserving refactor stays green and a silent regression turns it red.
//
// Altitude is deliberately the rendered DOM only — never the store's internal
// shape. Each refactor rewires internal state (a new selector, an enum overlay
// field, a moved module), so any assertion reading store internals would block
// the very change under test. The tests drive the real components through a
// hydrated store and assert on what renders.
//
// Two behaviours are intentionally NOT pinned here because they are the deltas
// the tickets introduce (RED on this baseline, so they belong to the refactor,
// not the net): #320's overlay mutual-exclusion / Esc-closes-active, and #319's
// unification of the controlled-ship-missing fallback across call sites.
import { beforeEach, describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { createWorld, type PortId, type Route, type Ship, type World } from "../sim";
import { useGameStore } from "../store/gameStore";
import { PortPanel } from "./PortPanel";
import { TopBar } from "./TopBar";
import { HeadquartersPanel } from "./HeadquartersPanel";

/** The port a freshly-created ship is docked at (worldgen docks ship 0). */
function homePort(world: World): PortId {
  const loc = world.company.ships[0].location;
  if (loc.kind !== "docked") throw new Error("expected the starting ship docked");
  return loc.portId;
}

/** A two-ship fleet, both docked at the starting port, with distinct names so a
 *  render can reveal WHICH ship a surface resolved to. Ship `s1` is the second
 *  ship — so resolving to it (not the `ships[0]` fallback) is observable. */
function twoShipFleet(): { world: World; controlled: Ship } {
  const base = createWorld("characterization-fleet");
  const ship0: Ship = { ...base.company.ships[0], id: "s0", name: "Alpha Runner" };
  const ship1: Ship = { ...ship0, id: "s1", name: "Beta Runner", cargo: { ...ship0.cargo } };
  const world: World = { ...base, company: { ...base.company, ships: [ship0, ship1] } };
  return { world, controlled: ship1 };
}

beforeEach(() => {
  // The Zustand store is a module singleton; test-setup only clears the DOM.
  // Reset the render-relevant slice so tests never leak state into each other.
  useGameStore.setState({
    world: null,
    controlledShipId: null,
    selection: null,
    selectedRouteId: null,
    activeOverlay: null,
    speed: "paused",
  });
});

describe("PortPanel fleet resolution (#319)", () => {
  it("resolves the Controlled Ship, not ships[0], in a multi-ship fleet", () => {
    const { world, controlled } = twoShipFleet();
    useGameStore.getState().loadWorld(world);
    useGameStore.setState({ controlledShipId: controlled.id });

    render(<PortPanel portId={homePort(world)} />);

    // The Sail control is rendered for the RESOLVED ship and carries its name.
    // Controlled is the second ship (Beta), so the panel resolved past the
    // ships[0] fallback (Alpha) — the exact behaviour #319 must preserve.
    expect(screen.getByRole("button", { name: /Sail Beta Runner here/ })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /Sail Alpha Runner here/ })).toBeNull();
  });

  it("single-ship render is stable (preserved surface)", () => {
    const world = createWorld("characterization-single");
    useGameStore.getState().loadWorld(world);

    const { container } = render(<PortPanel portId={homePort(world)} />);

    expect(container).toMatchSnapshot();
  });
});

describe("TopBar overlays — single-overlay behaviour (#320)", () => {
  it("each menu entry opens its overlay; the price-board hotkey toggles it", async () => {
    const user = userEvent.setup();
    const base = createWorld("characterization-overlays");
    // Found a Headquarters so the persistent TopBar shortcut renders (E9).
    const world: World = {
      ...base,
      company: { ...base.company, headquarters: { portId: homePort(base) } },
    };
    useGameStore.getState().loadWorld(world);

    render(<TopBar />);

    // Nothing open initially.
    expect(screen.queryByRole("table", { name: "Region price board" })).toBeNull();

    // Button opens the Price Board; the "b" hotkey toggles it back closed.
    await user.click(screen.getByRole("button", { name: "Price Board" }));
    expect(screen.getByRole("table", { name: "Region price board" })).toBeInTheDocument();
    await user.keyboard("b");
    expect(screen.queryByRole("table", { name: "Region price board" })).toBeNull();

    // Ledger and Headquarters each open from their own button. We assert only
    // that the opened overlay is present — never a two-overlays-open state,
    // which #320 deliberately replaces with mutual exclusion.
    await user.click(screen.getByRole("button", { name: "Ledger" }));
    expect(screen.getByRole("table", { name: "Transactions" })).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Headquarters" }));
    expect(screen.getByRole("dialog", { name: /headquarters/i })).toBeInTheDocument();
  });
});

describe("Headquarters route panel — pure move (#321)", () => {
  it("routes tab render is stable", async () => {
    const user = userEvent.setup();
    const base = createWorld("characterization-routes");
    const [portA, portB] = base.region.ports;
    const route: Route = {
      id: "r-char",
      name: "Char Loop",
      stops: [
        { portId: portA.id, orders: [{ kind: "buy", good: "grain" }] },
        { portId: portB.id, orders: [{ kind: "sell", good: "grain" }] },
      ],
    };
    const world: World = {
      ...base,
      company: { ...base.company, headquarters: { portId: portA.id }, routes: [route] },
    };
    useGameStore.getState().loadWorld(world);

    const { container } = render(<HeadquartersPanel onClose={() => {}} />);
    await user.click(screen.getByRole("tab", { name: "Trasy" }));

    expect(container).toMatchSnapshot();
  });
});
