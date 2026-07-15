import type { World } from "../sim";

/**
 * Persistence adapter (ADR-0004): the only place that touches localStorage.
 * The sim stays pure (ADR-0002) — it hands out plain, JSON-serializable
 * Worlds; this module wraps one in a versioned envelope and reads it back.
 */

/** Autosave slot key in localStorage (docs/specs/E2-trade-loop.md — Save/load). */
export const AUTOSAVE_KEY = "etersim.autosave";

/** Save envelope version. The field gates future migrations; only the
 *  current version is accepted and anything else is treated as unreadable.
 *  v2: E8 changed the Port shape (`priceBias`) with no migration (pre-1.0
 *  owner call) — v1 saves are cleanly rejected instead of loading NaNs.
 *  v3: E8 added `World.flowDrift` and `World.osmosisPulse` — again no
 *  migration; v2 saves are cleanly rejected.
 *  v4: E9 added `Company.routes`/`headquarters`, `Ship.name`/`assignment` (the
 *  E9 spec lists save migration as a non-goal, pre-1.0) — v3 saves would load
 *  missing `routes`/`headquarters` and crash the route pass, so reject them.
 *  v5: E9 added `World.ledger` (docs/specs/E9-fleet-and-routes.md — Ledger);
 *  again no migration — a v4 save would load with `ledger` undefined and
 *  every event-appending mutation would throw on the missing array.
 *  v6: E3 added `Company.guilds` (docs/specs/E3-contracts-and-guilds.md —
 *  Guild state, #92) — again no migration — a v5 save would load with
 *  `guilds` undefined and `enroll` would throw indexing into it.
 *  v7: E3 added `World.contractOffers` (docs/specs/E3-contracts-and-guilds.md
 *  — Contracts, #93) — again no migration — a v6 save would load with
 *  `contractOffers` undefined and the next day boundary's `refreshContractOffers`
 *  would throw filtering it.
 *  v8: E3 added `Company.contracts` (docs/specs/E3-contracts-and-guilds.md —
 *  Tech: Contracts, #94) — again no migration — a v7 save would load with
 *  `contracts` undefined and `acceptContract`/the sell path/`settleContracts`
 *  would throw indexing into it.
 *  v9: issue #203 — the Ledger grammar law ("every thaler-moving kind
 *  carries `thalers`") retrofits `enrollmentFee`, which previously moved
 *  ₸400 with no field. Unlike every prior bump, this one migrates: a v8
 *  save's `enrollmentFee` events are a flat, deterministic fee
 *  (`ENROLLMENT_FEE`), so `migrateV8ToV9` backfills `thalers: ENROLLMENT_FEE`
 *  onto them rather than rejecting the save outright.
 *  v10: issue #226 — the desperation clause adds `ContractOffer.requiredRank`,
 *  decoupled from `tier`. A v9 save's offers/active contracts have no
 *  `requiredRank` at all, so `migrateV9ToV10` backfills `requiredRank: tier`
 *  onto every `World.contractOffers` and `Company.contracts` entry — the
 *  same pre-clause behavior (access gated on tier) until the next day
 *  boundary's `refreshContractOffers` stamps the clause proper, so the save
 *  self-heals rather than needing its own clause computation here. Per the
 *  one-step-migration precedent (every prior bump but #203 rejected the
 *  version before it outright), v8 is no longer readable — only v9 carries
 *  forward now. */
export const SAVE_VERSION = 10;

/** Save envelope versions this adapter can still read, migrating forward to
 *  `SAVE_VERSION` on load (issue #226) — currently just the immediately
 *  preceding version; a save older than that is unreadable, same as every
 *  prior bump (v8 dropped here, matching that precedent — #203's chain
 *  never carried v8 through a second hop, and this bump doesn't start one). */
const READABLE_VERSIONS: ReadonlySet<number> = new Set([9, SAVE_VERSION]);

/** v9 -> v10 (issue #226): `ContractOffer`/`ActiveContract` gained a required
 *  `requiredRank` field (the desperation clause). A v9 offer's access rule
 *  was always "rank >= tier", so the backfill `requiredRank: tier` is exact,
 *  never a guess — it reproduces the old gate until the board's next refresh
 *  applies the clause. Operates on the raw, untyped parsed JSON (a v9 offer
 *  has no `requiredRank` at all, so treating it as `ContractOffer` before
 *  this pass would be a type lie) and returns a `World` only once every
 *  offer/active contract carries what the current `ContractOffer` shape
 *  requires. */
function migrateV9ToV10(rawWorld: {
  contractOffers?: unknown;
  company?: { contracts?: unknown };
}): World {
  const backfillRequiredRank = (offer: Record<string, unknown>) =>
    offer.requiredRank === undefined ? { ...offer, requiredRank: offer.tier } : offer;

  const contractOffers = Array.isArray(rawWorld.contractOffers)
    ? rawWorld.contractOffers.map((o: Record<string, unknown>) => backfillRequiredRank(o))
    : [];
  const contracts = Array.isArray(rawWorld.company?.contracts)
    ? (rawWorld.company.contracts as Record<string, unknown>[]).map((c) => backfillRequiredRank(c))
    : [];

  return {
    ...rawWorld,
    contractOffers,
    company: { ...rawWorld.company, contracts },
  } as unknown as World;
}

/** Autosave cadence in world ticks (spec: written every 24 ticks and on pause). */
export const AUTOSAVE_INTERVAL_TICKS = 24;

/** On-disk save format (docs/specs/E2-trade-loop.md — Save/load). */
export interface SaveFile {
  readonly version: typeof SAVE_VERSION;
  readonly world: World;
}

/** Minimal slice of the Web Storage API this adapter needs — lets tests
 *  inject an in-memory store instead of standing up a real browser. */
export interface StorageLike {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
}

/** localStorage when present (browser), otherwise null (e.g. Node tests that
 *  don't inject a storage). Resolved lazily per call, never at module load. */
function defaultStorage(): StorageLike | null {
  try {
    return globalThis.localStorage ?? null;
  } catch {
    return null;
  }
}

/** Serializes a world into the versioned save JSON used by export and autosave. */
export function exportWorldJson(world: World): string {
  const save: SaveFile = { version: SAVE_VERSION, world };
  return JSON.stringify(save, null, 2);
}

/** True for a parsed value that is a save envelope of a version we can
 *  read — the current version, or one `migrateV8ToV9` (etc.) can carry
 *  forward (issue #203). */
function isReadableEnvelopeShape(
  value: unknown,
): value is { version: number; world: Record<string, unknown> } {
  if (typeof value !== "object" || value === null) return false;
  const candidate = value as { version?: unknown; world?: unknown };
  return (
    typeof candidate.version === "number" &&
    READABLE_VERSIONS.has(candidate.version) &&
    typeof candidate.world === "object" &&
    candidate.world !== null
  );
}

/** Parses save JSON into a world, or null on bad/absent/unsupported input.
 *  Used by the tolerant autosave path where corruption must not throw. */
function deserialize(text: string | null): World | null {
  if (text === null) return null;
  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch {
    return null;
  }
  if (!isReadableEnvelopeShape(parsed)) return null;
  if (parsed.version === SAVE_VERSION) return parsed.world as unknown as World;
  return migrateV9ToV10(parsed.world); // the only older readable version (v9)
}

/**
 * Parses an imported save file's text into a world, throwing on anything that
 * is not a readable save (invalid JSON, wrong shape, unsupported version) —
 * so the import UI can surface the failure.
 */
export function parseWorldJson(text: string): World {
  const world = deserialize(text);
  if (world === null) {
    throw new Error("Not a readable etersim save file (bad JSON or unsupported version).");
  }
  return world;
}

/** Writes the autosave slot. Best-effort: a missing or full store is ignored. */
export function saveAutosave(world: World, storage: StorageLike | null = defaultStorage()): void {
  if (!storage) return;
  try {
    storage.setItem(AUTOSAVE_KEY, exportWorldJson(world));
  } catch {
    // Storage unavailable or quota exceeded — autosave is best-effort.
  }
}

/** Reads the autosave slot, or null if absent, unparseable or version-mismatched. */
export function loadAutosave(storage: StorageLike | null = defaultStorage()): World | null {
  if (!storage) return null;
  return deserialize(storage.getItem(AUTOSAVE_KEY));
}

/** True when a readable autosave exists (a corrupt slot counts as none). */
export function hasAutosave(storage: StorageLike | null = defaultStorage()): boolean {
  return loadAutosave(storage) !== null;
}

/** Clears the autosave slot. */
export function clearAutosave(storage: StorageLike | null = defaultStorage()): void {
  storage?.removeItem(AUTOSAVE_KEY);
}
