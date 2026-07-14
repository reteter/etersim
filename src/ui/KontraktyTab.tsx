import { useState } from "react";
import {
  GOODS,
  rankOf,
  TICKS_PER_DAY,
  type ActiveContract,
  type ContractOffer,
  type World,
} from "../sim";
import { useGameStore } from "../store/gameStore";
import { GuildBadge } from "./guildDisplay";

/**
 * Kontrakty tab (#96, docs/specs/E3-contracts-and-guilds.md — UX skeleton,
 * Store & UI): the PriceBoardOverlay's second tab. Open offers of enrolled
 * guilds (rank-gated tiers render locked, never hidden — #94's accept-side
 * rule made visible here) plus active contracts with period progress and a
 * resign affordance that states its −3 rank cost before executing. All
 * strings Polish (2026-07-14 UI grill, lock 2).
 */

function portName(world: World, portId: string): string {
  return world.region.ports.find((p) => p.id === portId)?.name ?? portId;
}

/** Polish noun declension by count (wave-check finding: a hardcoded plural
 *  read wrong for n≥5 — "5 kursy" is ungrammatical, it must be "5 kursów").
 *  Standard three-way rule: 1 → singular; 2-4 (excluding the 12-14 teens) →
 *  few; everything else (0, 5-21 teens, 5+, ...) → many. */
function pluralPl(n: number, singular: string, few: string, many: string): string {
  if (n === 1) return singular;
  const lastDigit = n % 10;
  const lastTwo = n % 100;
  if (lastDigit >= 2 && lastDigit <= 4 && !(lastTwo >= 12 && lastTwo <= 14)) return few;
  return many;
}

/** One open offer: guild badge, good → port, quota/period, min periods, fee,
 *  the basis line (#93's `ContractOffer.basis`), and either an Accept button
 *  or — above the company's rank with that guild — a Polish lock label
 *  (#96 AC3: board-side gating consistent with #94's accept-side rule, never
 *  hidden). */
function OfferRow({ world, offer, rank }: { world: World; offer: ContractOffer; rank: number }) {
  const dispatch = useGameStore((s) => s.dispatch);
  const locked = rank < offer.tier;

  return (
    <div
      className={locked ? "kontrakty-offer kontrakty-offer--locked" : "kontrakty-offer"}
      data-testid="kontrakty-offer"
    >
      <GuildBadge guildId={offer.guildId} />
      <div className="kontrakty-offer__body">
        <p className="kontrakty-offer__route">
          {GOODS[offer.good].name} → {portName(world, offer.portId)}
        </p>
        <p className="kontrakty-offer__terms">
          Norma {offer.quotaPerPeriod}/okres ({offer.periodDays} dni), min. {offer.minPeriods} okr.,
          opłata ₸{offer.feePerPeriod}
        </p>
        <p className="kontrakty-offer__basis">
          Oczekiwane ~{offer.basis.expectedTrips}{" "}
          {pluralPl(offer.basis.expectedTrips, "kurs", "kursy", "kursów")}/okres, najbliższe źródło:{" "}
          {portName(world, offer.basis.sourcePortId)}
        </p>
        {locked ? (
          <p className="kontrakty-offer__lock">Wymaga rangi {offer.tier} w tej gildii</p>
        ) : (
          <button
            type="button"
            onClick={() => dispatch({ kind: "acceptContract", offerId: offer.id })}
          >
            Przyjmij kontrakt
          </button>
        )}
      </div>
    </div>
  );
}

/** One active contract: period progress ("42/50 — rozliczenie za 2 d"),
 *  a consecutive-miss warning, and a resign affordance that states the −3
 *  rank cost BEFORE confirming (#96 AC4). Period end is derived from the
 *  contract's own public fields (`startTick`, `periodIndex`, `periodDays`) —
 *  the same arithmetic contract.ts's private `periodEndTick` uses, kept here
 *  rather than exported to avoid growing that module's scope. */
function ContractRow({ world, contract }: { world: World; contract: ActiveContract }) {
  const dispatch = useGameStore((s) => s.dispatch);
  const [confirming, setConfirming] = useState(false);

  const periodEndTick =
    contract.startTick + (contract.periodIndex + 1) * contract.periodDays * TICKS_PER_DAY;
  const daysLeft = Math.max(0, Math.ceil((periodEndTick - world.tick) / TICKS_PER_DAY));

  return (
    <div className="kontrakty-contract" data-testid="kontrakty-contract">
      <GuildBadge guildId={contract.guildId} />
      <div className="kontrakty-contract__body">
        <p className="kontrakty-contract__route">
          {GOODS[contract.good].name} → {portName(world, contract.portId)}
        </p>
        <p className="kontrakty-contract__progress">
          {contract.deliveredThisPeriod}/{contract.quotaPerPeriod} — rozliczenie za {daysLeft} d
        </p>
        {contract.consecutiveMisses > 0 && (
          <p className="kontrakty-contract__warn">
            Uwaga: {contract.consecutiveMisses}{" "}
            {contract.consecutiveMisses === 1 ? "nieudany okres" : "nieudane okresy"} z rzędu —
            kolejny zakończy kontrakt
          </p>
        )}
        {confirming ? (
          <div className="kontrakty-contract__confirm">
            <p className="kontrakty-contract__confirm-text">
              Rezygnacja kosztuje −3 punkty rangi. Potwierdzić?
            </p>
            <button
              type="button"
              onClick={() => dispatch({ kind: "resignContract", contractId: contract.id })}
            >
              Potwierdź rezygnację
            </button>
            <button type="button" onClick={() => setConfirming(false)}>
              Anuluj
            </button>
          </div>
        ) : (
          <button type="button" onClick={() => setConfirming(true)}>
            Zrezygnuj (koszt: −3 rangi)
          </button>
        )}
      </div>
    </div>
  );
}

/** Kontrakty tab body: open offers of enrolled guilds, then active
 *  contracts. Offers of guilds the Company hasn't joined never appear here —
 *  the board only ever shows what enrollment already unlocked visibility
 *  into (spec: Contract board). */
export function KontraktyTab({ world }: { world: World }) {
  const offers = world.contractOffers.filter((o) => world.company.guilds[o.guildId] !== undefined);

  return (
    <div className="kontrakty-tab">
      <section>
        <h3 className="side-panel__heading">Otwarte oferty</h3>
        {offers.length === 0 ? (
          <p className="overlay__text">Brak ofert od gildii, do których należy firma.</p>
        ) : (
          offers.map((offer) => (
            <OfferRow
              key={offer.id}
              world={world}
              offer={offer}
              rank={rankOf(world.company.guilds[offer.guildId]!.points)}
            />
          ))
        )}
      </section>
      <section>
        <h3 className="side-panel__heading">Aktywne kontrakty</h3>
        {world.company.contracts.length === 0 ? (
          <p className="overlay__text">Brak aktywnych kontraktów.</p>
        ) : (
          world.company.contracts.map((contract) => (
            <ContractRow key={contract.id} world={world} contract={contract} />
          ))
        )}
      </section>
    </div>
  );
}
