import { useState } from "react";
import { type Route, type ShipId, type World } from "../sim";
import { useGameStore } from "../store/gameStore";
import { computeLoopMetrics } from "../store/routeMetrics";

/**
 * A Route's **operational** controls, docked next to the board's ribbon (owner
 * directive 2026-07-30, point 8): loop metrics, ship assignment, suspend/resume
 * and deletion — everything docs/specs/E9's Loop metrics + assignment ACs ask
 * for, moved verbatim off the retired Trasy tab.
 *
 * The split it makes explicit: the ribbon and grid author a Route's *geometry*
 * (which ports, which orders), this strip operates the Route that geometry
 * describes (which ship runs it, is it running, is it earning). Both now sit on
 * one surface, so "edit the Route" and "run the Route" stop being two panels
 * apart. Rendered only while an **existing** Route is loaded — a brand-new draft
 * has no ship to assign and no loop to have earned anything yet.
 */
export function RouteOpsStrip({
  world,
  route,
  onDelete,
}: {
  world: World;
  route: Route;
  onDelete: () => void;
}) {
  const dispatch = useGameStore((s) => s.dispatch);
  const metrics = computeLoopMetrics(world, route);
  const assignedShips = world.company.ships.filter((s) => s.assignment?.routeId === route.id);
  const unassignedShips = world.company.ships.filter((s) => s.assignment?.routeId !== route.id);
  const [assignShipId, setAssignShipId] = useState<ShipId | "">("");

  return (
    <div className="route-ops" aria-label={`Obsługa trasy ${route.name}`}>
      <div className="route-ops__metrics">
        <span>Kurs: {metrics.totalCourseTicks}t/pętla</span>
        <span>Opłaty dokowe/pętla: {metrics.lastLoopDockingFees ?? "—"}</span>
        <span className="route-ops__result">
          Ostatnia pętla:{" "}
          {metrics.lastLoopNet === null
            ? "brak jeszcze pętli"
            : `${metrics.lastLoopNet >= 0 ? "+" : "−"}₸${Math.abs(metrics.lastLoopNet)}`}
        </span>
      </div>
      <div className="route-ops__ships">
        {assignedShips.map((ship) => (
          <div key={ship.id} className="route-ops__ship">
            <span>{ship.name}</span>
            {ship.assignment!.suspended && (
              <>
                <span className="route-ops__suspended">wstrzymana</span>
                <button
                  type="button"
                  className="menu-btn"
                  onClick={() => dispatch({ kind: "resumeRoute", shipId: ship.id })}
                >
                  Wznów
                </button>
              </>
            )}
            <button
              type="button"
              className="menu-btn"
              onClick={() => dispatch({ kind: "unassignRoute", shipId: ship.id })}
            >
              Odepnij
            </button>
          </div>
        ))}
        {unassignedShips.length > 0 && (
          <div className="route-ops__assign">
            <select
              aria-label={`Przypisz statek do trasy ${route.name}`}
              value={assignShipId}
              onChange={(e) => setAssignShipId(e.target.value as ShipId | "")}
            >
              <option value="">Przypisz statek…</option>
              {unassignedShips.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                </option>
              ))}
            </select>
            <button
              type="button"
              className="menu-btn"
              disabled={!assignShipId}
              onClick={() => {
                if (!assignShipId) return;
                dispatch({ kind: "assignRoute", shipId: assignShipId, routeId: route.id });
                setAssignShipId("");
              }}
            >
              Przypisz
            </button>
          </div>
        )}
      </div>
      <button type="button" className="menu-btn route-ops__delete" onClick={onDelete}>
        Usuń trasę
      </button>
    </div>
  );
}
