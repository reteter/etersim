# Farewell-roadmap grill — 2026-07-15

Owner (Jakub) + frontier Analyst/Designer, evening session. Context: frontier access
may lapse after 2026-07-19 with no renewal promised; the session's goal was to turn
the owner's long-term fantasy into a durable roadmap any future orchestrator — of any
vendor — can execute against. Inputs: PRD (vision/pillars/roadmap as of 2026-07-09),
E13 issues (#99–#102), E11 draft spec, parking lot (#131/#132/#134/#202/#212/#227),
playtest 2026-07-15 outcomes.

## Locks

1. **The Lens ladder** (owner's fantasy, told in his own words first): Region →
   Multiregion → Galaxy → the Unknown; at each step the previous map becomes a node
   of the next, the player's job is delegated (optionally), a new mechanics layer
   arrives. Endgame question: **"Why is it so?"** — which is, delightfully, the
   Professor persona's own catchphrase. → PRD §Long-term fantasy, CONTEXT.md
   *Lens ladder*.
2. **1.0 horizon**: mature region + the *first recession of the lens as the finale*
   (second region opens, first administrator — credits roll). Chosen over
   "single-region-only 1.0" and "full multiregion 1.0".
3. **Events gradient**: hazards scale with the lens — in-region economic disturbances
   only; travel hazards on inter-region crossings; full wilderness (encounters,
   pirates per #131's opt-in pattern, civilizations) on open aether post-1.0. The E6
   draft dissolves into this gradient.
4. **Arcana split**: one distinct-behavior arcane good in-region (the taste, M4);
   full arcana as the Multiregion level's economic fuel — goods created by buildings,
   traded between regions (M6+). Aether currents ride the long crossings. The E5
   draft dissolves into these two installments.
5. **Great Work finale** (owner's synthesis of two offered options — grill-session
   working name "Super Budowa"): each level ends with a super-construction
   *commissioned by that level's institutions* — Region: the Guilds via contracts;
   Multiregion: regional politics; and so up the ladder. Fractal like the lens
   itself. → CONTEXT.md *Great Work*, PRD M5.
6. **Model-agnostic frames** (owner reframe: "the next frontier at this table may
   not be a Claude"): roles as capability-tier contracts with a one-line replaceable
   casting (WORKFLOW §Casting); `procedural` / `design-frontier` labels on every
   roadmap item (PRD §Roadmap labels); **milestone playtest law** — no milestone
   closes on green metrics alone, the owner playtest judges fun (WORKFLOW
   §Verification gates).
7. **Harness v1 unpark** (this session explicitly serves as the harness slice of the
   cluster-B grill named in #202's unpark trigger): E11 re-reviewed against E9/E12/E3
   and approved as **v1 = Batch core + `harness run` CLI**; `play`/`replay` deferred
   to v2. E11 v1 runs *before* M4 (owner directive: the sim is becoming the only
   viable way to balance the game; the harness keeps scarce playtests spent on fun).
   #202 and #115 fold in. Cluster B's UI slices (Price-Board dispatch, #227) stay
   parked for the M4 grill.

## Routing

- PRD: §Long-term fantasy (new), §Scope (1.0 redefinition), §Roadmap labels +
  playtest law, M3 statuses, M4 *Region mastery* / M5 *The Great Work* / M6 *First
  zoom-out* / Post-1.0 (all replacing the old M4/M5 drafts), E11 tooling entry,
  Horizon (multi-region entry graduated into the ladder; its E9 hooks carried to M6).
- CONTEXT.md: *Lens ladder*, *Great Work*; Harness section header + Direct play
  deferral; Orrery's stale "E5 candidate" pointer.
- specs/E11: status v1 approved, §Re-review 2026-07-15, CLI v2 markers, issue-cut
  update.
- WORKFLOW.md: §Casting is model-agnostic, milestone playtest law.
- INTERVIEW-NOTES.md: entry 9 (vendor-agnostic process), entry 7 refreshed.
- Issues: comments on #202/#115 (fold into E11 v1), #131 (gradient placement),
  #227 (unchanged — M4 cluster-B grill).

## Open (deliberately)

- **Recursion architecture** — does Multiregion re-instantiate the region sim
  (region as node)? First question of the M6 grill; hard to reverse; nothing before
  M6 depends on it.
- Level naming for Galaxy's "port" unit (system vs cluster) — vocabulary grill when
  its level approaches.
- E13 spec is approved but predates E3's shipping and three playtests — the next
  orchestrator should skim it against current `contract.ts`/`building.ts` reality
  before cutting the wave (expected: no drift; the Build Order generalization was
  designed for this).
