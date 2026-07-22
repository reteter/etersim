// @vitest-environment jsdom
//
// Component-level coverage for the read-only Route ribbon (E16 #392,
// docs/specs/E16-workbench.md — Route ribbon component). No app route mounts
// this component yet (the roster/board consume it in later E16 issues, (b)
// and (c)) so Playwright has nothing reachable to drive here — this is the
// unit-level half of the package's "Playwright/unit coverage" testing gate.
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import type { PortArchetype, PortId } from "../sim";
import { RouteRibbon, type RouteRibbonNode } from "./RouteRibbon";

/** Installs a controllable `window.matchMedia` mock (jsdom has none). */
function mockMatchMedia(reduced: boolean) {
  Object.defineProperty(window, "matchMedia", {
    writable: true,
    value: vi.fn().mockImplementation((query: string) => ({
      matches: reduced && query === "(prefers-reduced-motion: reduce)",
      media: query,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
    })),
  });
}

const NODES: readonly RouteRibbonNode[] = [
  { portId: "p1" as PortId, name: "Anchorhold", archetype: "agrarian" as PortArchetype },
  { portId: "p2" as PortId, name: "Ferrowick", archetype: "industrial" as PortArchetype },
  { portId: "p3" as PortId, name: "Bellemare", archetype: "urban" as PortArchetype },
];

beforeEach(() => mockMatchMedia(false));
afterEach(() => vi.restoreAllMocks());

describe("RouteRibbon (read-only)", () => {
  it("renders each Stop node in its port's archetype color, in order", () => {
    render(<RouteRibbon routeName="Trójkąt Zbożowy" nodes={NODES} />);
    const nodeEls = screen.getAllByTestId("route-ribbon__node");
    expect(nodeEls).toHaveLength(3);
    nodeEls.forEach((el, i) => {
      expect(el.getAttribute("data-archetype")).toBe(NODES[i].archetype);
      expect(el.getAttribute("style")).toContain(`var(--archetype-${NODES[i].archetype})`);
    });
  });

  it("renders the loop closure — a return arc plus a ↻ marker", () => {
    render(<RouteRibbon routeName="Trójkąt Zbożowy" nodes={NODES} />);
    expect(document.querySelector(".route-ribbon__return-arc")).toBeInTheDocument();
    expect(screen.getByText("↻")).toBeInTheDocument();
  });

  it("on a >2-Stop route, intermediate Stops dim while the Ship is on the return leg", () => {
    // 3 nodes -> segments [0,1) stop0->stop1, [1,2) stop1->stop2, [2,3) return
    // leg stop2->stop0. progress 2.5 sits mid-return.
    render(<RouteRibbon routeName="Trójkąt Zbożowy" nodes={NODES} ship={{ progress: 2.5 }} />);
    const nodeEls = screen.getAllByTestId("route-ribbon__node");
    // SVG elements' `.className` is an SVGAnimatedString in jsdom, not a
    // plain string — read the attribute directly.
    expect(nodeEls[0].getAttribute("class")).not.toContain("route-ribbon__node--dim"); // origin
    expect(nodeEls[1].getAttribute("class")).toContain("route-ribbon__node--dim"); // intermediate
    expect(nodeEls[2].getAttribute("class")).not.toContain("route-ribbon__node--dim"); // departure stop
  });

  it("does not dim intermediate Stops outside the return phase", () => {
    render(<RouteRibbon routeName="Trójkąt Zbożowy" nodes={NODES} ship={{ progress: 0.5 }} />);
    const nodeEls = screen.getAllByTestId("route-ribbon__node");
    nodeEls.forEach((el) =>
      expect(el.getAttribute("class")).not.toContain("route-ribbon__node--dim"),
    );
  });

  it("renders no authoring affordances — no buttons or inputs in read-only mode", () => {
    render(<RouteRibbon routeName="Trójkąt Zbożowy" nodes={NODES} ship={{ progress: 0.5 }} />);
    expect(screen.queryAllByRole("button")).toHaveLength(0);
    expect(document.querySelector("input")).toBeNull();
  });

  it("glides the Ship glyph with a CSS transition by default", () => {
    render(<RouteRibbon routeName="Trójkąt Zbożowy" nodes={NODES} ship={{ progress: 0.5 }} />);
    const ship = screen.getByTestId("route-ribbon__ship");
    expect(ship.getAttribute("data-animating")).toBe("true");
  });

  it("freezes the Ship glyph under prefers-reduced-motion (still visible, no motion)", () => {
    mockMatchMedia(true);
    render(<RouteRibbon routeName="Trójkąt Zbożowy" nodes={NODES} ship={{ progress: 0.5 }} />);
    const ship = screen.getByTestId("route-ribbon__ship");
    expect(ship.getAttribute("data-animating")).toBe("false");
  });

  it("freezes the Ship glyph while the game is paused (sim-time law, #161 precedent)", () => {
    render(<RouteRibbon routeName="Trójkąt Zbożowy" nodes={NODES} ship={{ progress: 0.5 }} paused />);
    const ship = screen.getByTestId("route-ribbon__ship");
    expect(ship.getAttribute("data-animating")).toBe("false");
  });

  it("renders no Ship glyph when no ship is assigned", () => {
    render(<RouteRibbon routeName="Trójkąt Zbożowy" nodes={NODES} />);
    expect(screen.queryByTestId("route-ribbon__ship")).toBeNull();
  });
});
