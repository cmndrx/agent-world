# Town simulation plan

Approved by the human on October 27, 2026. This file is the **source of truth for the town simulation work**:
where it is going, what each phase delivers and where it stands. `docs/NEXT_PASS.md` holds the dated log of each
pass with its evidence. A new agent should be able to continue from these two files alone.

## Start here (handoff)

### Status

| Phase | What it delivers | Status |
|---|---|---|
| 0 | Decisions, guardrails, docs | Done (Oct 27, 2026) |
| 1 | Influence grid (`shared/town-influence.mjs`) | Done (Oct 27, 2026) |
| 2 | Home satisfaction, markers, Town needs, Interests editor; care clicker retired | Done (Oct 27, 2026) |
| 3 | Heatmap overlays and placement preview in the town planner | Done (Oct 27, 2026) |
| 4 | Town tiers, Civic Pride, civic upgrades | Done (Oct 27, 2026) |
| 4b | Small town props bought with Civic Pride | Done (Oct 29, 2026) |
| 5 | Residents visit matching venues in range (flavor) | Done (Oct 29, 2026) |
| 6 | Street distance limits service and venue reach | Done (Oct 29, 2026) |
| 7 | Feel and balance pass | Done (Oct 29, 2026) |
| 6b | Street-aware coverage heatmap | Done (Oct 29, 2026) |

Validation checkpoint (October 30, 2026): current phases remain done; fresh full suite 468/468, packaged Mac build, strict ad-hoc signature and source/package parity passed before the human-authorized commit/push. No town simulation behavior added.

### Rules for every pass

1. Read this file, `docs/NEXT_PASS.md` (top entries), `AGENTS.md` and current `git status` first. Preserve existing
   uncommitted work; it is the human's.
2. Do one phase (or a clearly named slice of one) per pass. Ask the human before starting the next phase.
3. When the pass ends, **always**:
   - add a dated entry at the top of `docs/NEXT_PASS.md`: what changed (files), checks run with results, browser
     evidence, what is not done, and the next step;
   - update the **Status** table and **Next pass** brief in this file, and the phase section below;
   - update `docs/GAMEPLAY.md` / `README.md` when player-facing behaviour changes.
4. Clean room: no code, scripts, data, numbers, names or art from any other game. All tuning values are ours.
5. Truth vs. simulation: the town sim is flavor driven only by player placement. It never reads the amount of
   observed agent work, never gates real work, and never borrows truth styling (amber "waiting", red errors,
   plumbobs). Label it "town simulation" where it is shown.
6. No decay, timers, streaks or loot boxes (`docs/GAMEPLAY.md` ground rules).
7. Commit or push only when the human asks.

### How to verify

- Node 24 is required for the suite: `source ~/.nvm/nvm.sh && nvm use 24`.
- Run tests with `node --test test/*.test.mjs`. (`npm test` runs `node --test test/`, which fails to start on
  Node 24 because it treats the folder as a module.) Last full run: 468/468.
- Focused tests: `test/town-influence.test.mjs`, `test/home-satisfaction.test.mjs`, `test/town-preview.test.mjs`, `test/town-tiers.test.mjs`,
  `test/civic-pride.test.mjs`, `test/town-props.test.mjs`, `test/town-progress-api.test.mjs`, `test/town-migration-api.test.mjs`, `test/venue-visits.test.mjs`, `test/street-reach.test.mjs`, `test/town-balance.test.mjs`, `test/resident-interests.test.mjs`,
  `test/interests-api.test.mjs`, `test/card-layout.test.mjs`.
- Browser QA: `node scripts/town-sim-fixture.mjs [port]` (the `town-sim` entry in `.claude/launch.json` uses :4797)
  after `npm run build`. It is an isolated temporary town (one home, a near park, a distant fire station, a dump)
  with providers disabled. The dump (a tier-4 building) makes it start at tier 4 (no starting tier grants, so only a
  little Civic Pride from needs already met; edit its gameplay.json to test spending). Scenario `tier-up`
  (`node scripts/town-sim-fixture.mjs 4799 tier-up`, launch entry `town-sim-tier-up`): three residents, tier 2, every
  tier-2 building but the library; placing the library at i 6, j −2, turned west, triggers a live tier-up to 3.
  Scenario `street` (launch entry `town-sim-street`, :4798): a fire station right behind the home faces a back street
  joined far east (25 street tiles away, no cover, street hint on the sign); a street from i 6, j 1 to i 6, j 4 (draw
  it, or POST `/api/town` `add-road` with the town revision) brings it in range and lights the fire heat. The
  script sets its own port, so the preview tool's "port reassigned" note can be ignored; open the port it prints. Stop it and delete its `aw-town-sim-*` temp folder afterwards.
- After any app code change: `npm run app:build`, then `codesign --verify --deep --strict "release/mac-arm64/Agent World.app"`
  and `node scripts/check-home-activity-package.mjs 'release/mac-arm64/Agent World.app/Contents/Resources/app'`
  (expect parity true). Never quit or restart the running app while agent work is approved, queued or running; say
  when it still needs a safe reopen.

### Code map (as of Phase 6)

- `shared/town.mjs` — town grid, footprints (`homeTiles`, `extents`), `CIVIC`, `RECREATION` (venues and the interests
  each serves), `PUBLIC_BUILDINGS` (each with `townTier`), `connectedRoads`, `streetDistances(town, fromTile)` (BFS street-tile counts over connected streets), `placeCivic(town, kind, at, { tier })`.
  `TOWN_PROPS`, `PROP_KINDS`, `MAX_PROPS`, `checkProp`, `placeProp`, `moveProp`, `removeProp`; props live in
  `town.props` and block homes, buildings and roads through `occupancy()`. Player level (`town.permits.level`) now only
  sets project permits.
- `shared/town-influence.mjs` — `INFLUENCE_LAYERS` (fire, police, education, health, garbage, water, power by max;
  beauty and nuisance summed and clamped; one `venue:<kind>` layer per venue), `INFLUENCE_RULES` (the tuning table:
  amount, reach in tiles, curve per stamp), `buildInfluence(town, { cutOff })` (`cutOff`: building ids whose service
  and venue stamps are dropped, nuisance kept), `STREET_REACH_EXTRA` (4), `streetLimit(building)` (longest non-nuisance
  reach + 4 street tiles), `influenceAt`, `footprintInfluence`. Grid covers
  `BUILDABLE` (24 × 20 tiles) as Float64 layers.
- `shared/home-satisfaction.mjs` — `SERVICE_NEEDS`, `QUIET_NEED`, `needProgress`, `homeSatisfaction(...)` (each need has
  `target` and `progress`; the score is the weakest progress, so an all-good home scores 100),
  `townSatisfaction(town, households)` → Map project → `{ score, level, needs, worst }`. Phase 6: `streetReach(town,
  home)` → `{ far, cutOff }`; each home is judged on its own grid with too-far buildings cut off, and `far` /
  `baseGrid` let hints say "Fire station is 15 street tiles away · add a connecting street". Needs switch on when a
  building that meets them is unlocked or placed. Worst = most urgent level, then lowest value.
- `shared/town-tiers.mjs` — `TOWN_TIERS` (tuning), `tierUnlocks`, `tierStats(town, households, satisfaction)`,
  `tierRequirements`, `earnedTier`, `placedTier` (migration start), `tierStatus(stats, reached)`.
- `shared/civic-pride.mjs` — `PRIDE_REWARDS`, `UPGRADE_COSTS` (tuning), `prideMilestones(…, { startTier })`, `recordPride` (idempotent),
  `prideBalance`, `recentPride`, `nextUpgrade`, `buyUpgrade(town, pride, kind)`. Upgrade reach lives in
  `town-influence.mjs` (`UPGRADE_REACH`, `upgradeLevel`; nuisance never grows); the level is `upgrade` on the civic
  record in town.json. Props: `propRefund`, `buyProp`, `sellProp` (refund recorded as a negative spend). Prop stamps:
  `PROP_RULES`, `PROP_GREEN_CAP`, `PROP_BUFFER_CAP` in `town-influence.mjs` (full amount on a square of tiles within
  reach).
- `shared/venue-visits.mjs` — `VISIT_RULES` (tuning), `streetRoute(town, fromTile, toTile)` (BFS over connected
  streets), `metVenues(satisfaction, residentId)` (interest needs now carry `venues` in range), `chooseVisit(...)`.
- `web/src/visits.js` — `VenueVisits` controller (checks every 15 s, starts at most one visit, keeps venue sign
  visitor counts via `CivicBuildings.setVisitors`), `visitWaypoints(home, building, route)` (lot-local waypoints:
  gate, street, tiles, venue front, stand point). `Sim` in `web/src/sim.js`: `startVisit`, `updateVisit`, `endVisit`;
  `decide()` keeps a visit through idle/off-duty changes and ends it (snap home) when a truth target appears.
- `shared/resident-interests.mjs` — `VENUE_INTERESTS`, `HOME_INTERESTS`, `INTEREST_CHOICES`, `ensureInterests`,
  `editInterests` (1–3, receipts, revision in `interestPreferences`).
- `bridge/server.mjs` — seeds interests for active residents; `POST /api/care-preferences` edits interests.
  `townProgress()` / `syncTownProgress()` compute satisfaction, tier and milestones from `townStore.town` and active
  households; gameplay.json keeps `townTier.reached` and `pride` (`milestones`, `spent`). Sync runs at startup, in
  `broadcastTown()` and (debounced) after household broadcasts. `townView()` adds `tier` and `pride`. `/api/town`
  actions `place-civic` (tier-checked), `upgrade-civic`, `place-prop`, `move-prop`, `remove-prop` (spends and refunds
  recorded only after the town saves).
- `web/src/main.js` — `refreshSatisfaction()` on layout and household changes; passes results to lots and the
  home overview.
- `web/src/lot.js` — `setSatisfaction` (sign marker `.lot-need`). `web/src/home-overview.js` — `needsMarkup`
  (Town needs). `web/src/interests.js` — resident interests summary, `InterestsDialog` / `InterestsEditor`.
  `web/src/ui.js` — resident panel wiring. `web/src/style.css` — "Town simulation" block at the end.
- `shared/town-preview.mjs` — `HEAT_LAYERS` (picker list), `primaryLayer(kind)`, `heatColor`, `heatPixels(town, layer)`
  (RGBA per tile, north row first), `withBuilding(town, kind, at)`, `placementPreview(town, households, kind, at)`
  (per-home need changes and scores), `previewLines`, `previewHeadline`. Phase 6b: `streetAccess(town, grid)` (each
  tile's street access: a home's tiles use its entrance, others the nearest connected street tile) and
  `streetAwareLayer(town, layer)` (a building counts at a tile only within its street limit of that access; one
  `buildInfluence(…, { cutOff })` per distinct cut-off set); `heatPixels` uses it for cover layers, so heat on a home
  equals what that home feels. Nuisance heat stays straight-line. Palettes: mint→teal cover, sand→umber
  nuisance, satisfaction good/low/bad = green/grey/lilac.
- `web/src/town-planner.js` — Plan town UI: tools for streets, homes, Civic (`5`) and Leisure (`6`) placement with
  previews and checks. Coverage picker (`renderLayers`, `.tp-layers`, select stays mounted), heatmap
  (`heatMesh` / `updateHeat`: one DataTexture over `BUILDABLE`, rows flipped for the turned plane, keyed rebuilds),
  `candidate(town)` (heat shows the town with a valid civic draft), and `impact(town)` (memoised preview shown in
  the card as `.tp-impact`). Takes `households: () => Map` from `main.js`. Phase 4: banner Tier and Civic Pride
  stats, `tierMarkup` (next-tier checklist), tier-based locks and an Upgrade button per placed civic service
  (`upgradeCivicBuilding`). `main.js` cheers and fires fireworks on a live tier-up (never on load). Phase 4b: Props
  tool (`7`, `renderProps`, `pickProp`, `propAt`, `removePropDraft`), prop previews via `propPreview` / `withProp` in
  `shared/town-preview.mjs` (which also lists in-level progress such as "green space 36% → 41%"). Prop models:
  `web/src/props.js` (`TownProps`, one InstancedMesh per part per kind).

### Next pass: ask the human what is next

October 30 commit/push pass adds no phase authorization; the options below remain unapproved.

All planned phases (1–7, 4b) are done; the loop is playable, street-aware and tuned against the balance targets in
`test/town-balance.test.mjs`. There is no planned next phase. Ask the human what they want next. Candidates seen so
far (none approved):
- Land expansion as a Civic Pride sink (decision 8 "later").
- Upper-floor residents joining venue visits (needs stairs routing in `web/src/sim.js`).
- A per-revision cache for `townSatisfaction` if large towns feel slow (one BFS and at most one extra grid per home).

## Why

Agent World had plenty of town: eight civic buildings, ten recreation venues, homes with tiers, gems, XP, residents
with interests. Almost none of it interacted. Civic buildings and venues were "scenery only", and resident happiness
was a clicker (Praise, Give snack, Read a book) that no part of the town affected. Placement had no consequence, so
there were no decisions to make.

The goal is a town layer where **the layout is the game**: every placement visibly changes something, every problem
says how to fix it, and a healthy town unlocks more town. Generic city-builder mechanics are the reference.

## Reference mechanics (clean room)

Studied from a commercial mobile city builder for structure only.

1. **Influence on a grid.** Buildings add positive coverage or nuisance to grid layers around them, with a reach and
   a falloff.
2. **Weakest-link needs.** A building's satisfaction is its most urgent need; each need is a 0–1 value judged
   against low/high thresholds.
3. **Legible feedback.** Each unmet need shows a marker; overlays paint each layer as a heatmap.
4. **Connectivity.** Services only reach what the street network connects.
5. **Progress from a healthy town.** Town tiers unlock buildings and land.
6. **Data-driven tuning.** Reach, thresholds and costs live in tables, not code.

## Fit with Agent World's rules

| Reference mechanic | Agent World rule | Adaptation |
|---|---|---|
| Buildings decay or are abandoned over time | No decay, no pressure | Satisfaction is a pure function of the layout. Nothing changes while the player is away; every problem is fixed by moving or adding a building. |
| Timed income that fills and caps | No timers or reward notifications | No timed income. The town currency accrues without a cap or a deadline. |
| Randomized card packs | No loot boxes | Not used. Unlocks stay deterministic. |
| Simulation drives the economy | Truth vs. simulation | The town sim is flavor driven only by player placement. It never reads the amount of agent work and never gates real work. Observed work keeps counting by kind only. |

## Core loop

1. Real AI collaboration earns gems and XP (unchanged rules).
2. The player spends them on homes, civic buildings and venues.
3. The layout determines coverage; coverage determines each home's satisfaction.
4. Satisfied homes raise the town tier and earn town currency (Phase 4).
5. Tiers unlock new buildings, land and cosmetics, which create larger layout puzzles.

## Phases

### Phase 0 — Decisions and guardrails (done)
Decisions recorded below; `GAMEPLAY.md` ground rules and civic notes updated; clean-room rule recorded.

### Phase 1 — Influence grid (done)
`shared/town-influence.mjs` as described in the code map. Stamps start at a building's footprint and fall off with
straight-line distance (in tiles) to its nearest edge out to `reach`; curves are flat, linear or ease. Placeholder
values; park and garden green space were retuned in Phase 2 so a nearby park registers.

### Phase 2 — Home satisfaction (done)
- `shared/home-satisfaction.mjs`: service needs (footprint mean of a layer), quiet (1 − nuisance, only when nuisance
  reaches the home) and interest needs (a resident's interest met when a serving venue's layer reaches the home).
- Home sign marker, Town needs section in the home overview, Interests list and editor in the resident panel.
- Retired: care actions, cooldowns, resident happiness, `/api/care`, `/api/care-options`, care scenes and feedback,
  `shared/care.mjs`, `web/src/care.js`, `web/src/care-feedback.js`, old care fixtures. Saved `happiness` / `care`
  fields stay in households.json and are ignored.

### Phase 3 — Overlays and placement preview (done)
- Coverage picker in Plan town: Off (or "Building's own cover" while placing), Home satisfaction, each service, Noise
  and smell, each venue. While placing with the picker off, the building's own layer shows automatically.
- Heatmap: one texture over the buildable grid; it shows the candidate town while a civic draft is valid.
- Impact: the planner card lists the homes a placement would change ("Helps 1 home · Rosa's home: fire cover bad →
  good · 0 → 36") before confirming; nothing is saved until the player places.

### Phase 4 — Town tiers, Civic Pride and upgrades (done)
- Tiers per decision 6 (`shared/town-tiers.mjs`); `townTier` on every public building replaces the player-level
  unlock. Needs switch on by tier. The bridge stores the highest tier reached and the starting tier
  (`townTier.start`); an existing town starts at the tier of its placed buildings with no tier grants up to it.
- Civic Pride per decisions 7–9 (`shared/civic-pride.mjs`): milestones pay once (need first good for a home: 5; home
  first fully satisfied: 25; each tier: 40). Upgrades for civic services: level 2 (60) and 3 (150), each +2 tiles of
  service reach.
- Planner banner shows tier and Civic Pride; the civic and venue lists show tier locks, the next tier's checklist and
  Upgrade buttons. A live tier-up cheers and fires fireworks.
- Not done here: small props (Phase 4b). Not verified in the browser: the tier-up celebration (the one-home fixture
  cannot reach tier 5).

### Phase 4b — Small town props (done)
- Decision 10 implemented: seven props, prices and tiers as approved, 0.3 green cap, hedge noise buffer (capped at
  0.3), free moves, half refunds, 60-prop limit. Props Tool in Plan town with palette, preview and remove.
- Implementation note: each prop applies its full amount to every tile within its reach as a square (reach 1 = 3 × 3).
  A fading circle (tried first) let a reach-1 prop touch only one tile of a 3 × 3 home at half strength, so even twelve
  flower beds could not lift a home to "thin"; the square keeps the approved numbers and the stated intent.

### Phase 7 — Feel and balance (done)
- Balance targets as tests (`test/town-balance.test.mjs`): every provider placed well can make its need good for a
  neighbouring home; one home with a park and fire station reaches tier 2 and can afford the first upgrade; a
  single-project player reaches tier 3 by recruiting; reward ordering and prop affordability.
- Fixes found by the targets: home scores now measure each need against its own "good" target (before, a home whose
  needs all showed good scored ~59, so tiers 5–6 silently demanded more than "good"); the library's strength went
  from 0.6 to 0.9 (it could never make education good, blocking full satisfaction from tier 2 until the school).
- Feel: a confetti burst (scaled up for the planner's distance) where a building, upgrade or prop lands; building and
  prop lists make the Projects drawer step aside below 1500 px so the card stays readable; stale "player level" and
  "no happiness" comments fixed. Tier-up celebration seen live in the `tier-up` fixture.

### Phase 5 — Venue visits (done)
- Decision 11 implemented: occasional daytime visits to a venue meeting a resident's interest, along connected
  streets, one per home at a time, 10-minute cooldown, 30–60 s stay near the host; observed work snaps the resident
  back to their desk; "Walking to / At the … · simulated" in the bubble and resident panel; "N visiting" on the venue
  sign; nothing saved or rewarded. Ground-floor residents only (upper floors would need stairs routing).

### Phase 5 — Venue visits (details)
Residents walk to matching venues in range during idle time (flavor), using existing navigation and venue hosts
(`VENUE_STAFF` in `web/src/civic-staff.js`). Visits never create or imply observed work; observed work always wins.

### Phase 6 — Street distance (done)
- Decision 12 implemented. The literal "only reachable homes" rule was a no-op (every building and home must already
  connect to Main Street), so the human chose street distance: a civic building or venue serves a home only when the
  walk between their entrance tiles over connected streets is at most its street limit (longest service reach + 4).
- Too-far buildings are cut off per home (`buildInfluence(town, { cutOff })`); their noise and smell still spread
  through the air. Hints name the gap ("Fire station is 15 street tiles away · add a connecting street"; interests:
  "Rosa: arcade is … street tiles away · …"). Placement previews, markers, Town needs, tiers, Civic Pride and venue
  visits all follow, because they read `townSatisfaction`.
- Coverage heatmaps follow the same rule since Phase 6b (below). Balance targets held unchanged.
- Tests: `test/street-reach.test.mjs`; `test/town-preview.test.mjs` dump moved onto a Main Street plot.

### Phase 6b — Street-aware coverage heatmap (done)
- Human request (October 29, 2026). Each tile gets a street access point (home tiles: the home's entrance; other
  tiles: the nearest connected street tile, by a multi-source search outwards from the network). A building's cover
  counts at a tile only when that access point is within the building's street limit of its entrance, so the heat on a
  home matches its needs exactly and empty land shows what a home built there (entering from the nearest street)
  would roughly get. Noise and smell heat is unchanged. New `town-sim-street` fixture scenario.

## Decisions (accepted October 27, 2026)

1. **Effects for civic buildings and venues: yes.** They drive home satisfaction. They never reflect agent work.
2. **Nuisance: yes.** The dump and power plant lower nearby homes' satisfaction. Layout-based only.
3. **Currency: separate town currency.** Gems stay tied strictly to real work; the town currency comes from
   satisfied homes, with no cap or deadline.
4. **Tier unlocks: town tiers.** Town tiers replace player-level unlocks (Phase 4). Placed buildings are never removed.
5. **Happiness replaced** (human request, October 27, 2026): layout-based home satisfaction replaces care-based
   resident happiness.
6. **Tiers: size gate plus quality** (accepted October 27, 2026). Each tier needs a size gate (homes **or** active
   residents, whichever comes first) and a quality bar (no home with a bad need, town average at least X).
   Starting table: 1 Hamlet (start) · 2 Village (1 home, avg ≥ 40) · 3 Town (2 homes or 3 residents, avg ≥ 50) ·
   4 Borough (2 homes or 5 residents, avg ≥ 60) · 5 City (3 homes or 7 residents, avg ≥ 70) · 6 Metropolis (4 homes or
   10 residents, avg ≥ 75). Unlocks: 1 park, ice cream, fire station · 2 police, arcade, library · 3 school,
   restaurant, garden, gym · 4 hospital, dump, cinema · 5 water tower, music lounge, pool · 6 power plant, sports
   complex.
7. **Earning Civic Pride: one-time milestone grants** (accepted). Per need the first time it turns good for a home,
   per home the first time it is fully satisfied, per tier reached. Each pays once (no farming by moving buildings);
   never from agent work; no timers. Existing towns start at their placed buildings' tier with **no** tier grants up
   to it (human decision, October 28, 2026); only tiers reached afterwards pay.
8. **Spending Civic Pride: building upgrades and small props** (accepted). Civic buildings gain upgrade levels that
   add reach; small 1×1 town props (trees, plazas, fountains, benches) add green space. Land expansion later.
9. **Currency name: Civic Pride** (accepted).
10. **Props package** (accepted October 29, 2026): 1×1 props bought with Civic Pride — tree 10 (tier 1, green +0.15,
    reach 1), flower bed 15 (tier 1, +0.2, reach 1), bench 10 (tier 1, +0.1, reach 1), hedge row 15 (tier 2, +0.1,
    reach 1, noise buffer −0.15 on adjacent tiles), fountain 30 (tier 2, +0.3, reach 2), gazebo 35 (tier 3, +0.3,
    reach 2), statue 40 (tier 4, +0.35, reach 3). Green space from props is capped at 0.3 per tile (props alone reach
    "thin", never "good"). Moving is free; removing refunds half, rounded down. At most 60 props per town. Props take
    one tile, need no street and never sit on homes, buildings, streets or protected land.
11. **Venue visits package** (accepted October 29, 2026): occasional visits (at most one resident per home out at a
    time, about a 10-minute cooldown per resident), only for a venue that meets one of the resident's interests and is
    reachable over connected streets; walk along the streets, stay about 30–60 seconds near the host, walk home;
    daytime only; when observed work starts the resident fades out at the venue and reappears at their desk at once;
    shown as "At the arcade · simulated" in the bubble and resident panel and as a visitor count on the venue sign; no
    game effect. GAMEPLAY rule updated: idle residents may walk to a venue that meets one of their interests; observed
    work always brings them back.
12. **Street distance** (accepted October 29, 2026): services and venues reach a home along the streets, not through
    the air. A building serves a home only within its street limit (longest service reach + 4 street tiles between
    entrances); otherwise it gives that home no cover and the hint suggests a connecting street. Noise and smell still
    travel by straight-line distance.

## Acceptance for the plan as a whole

- Placing, moving or removing any public building visibly changes at least one home's satisfaction or an overlay.
- Every unsatisfied home names its worst need, and that need is fixable by layout.
- Nothing in the town sim reads the amount of observed agent work or gates real work; truth alerts keep their own
  styling.
- Old saves load without errors; retired happiness data is ignored, not deleted.
