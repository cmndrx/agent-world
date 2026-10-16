# Interests, player care and household requirements

October 15, 2026 — Rosa coordination brief for this human request only.

## Verified starting point

- `shared/catalogs/intrests.js` contains 68 interests with happinessValue,
  relatedItems, relatedPets and relatedActivities. `interests.js` re-exports it.
- `shared/care.mjs` currently accepts only praise, snacks and reading. Its actions
  are praise, snack and timed read; revision/receipt/cooldown/history semantics
  already exist. `bridge/server.mjs` handles /api/care and completion ticks;
  `web/src/care.js` is the player panel.
- `web/src/home-activities.js` and `home-activity-scene.js` already animate 19
  home activities but can create temporary TV/bath/pet assets. These visuals are
  not evidence that the household owns the required item or animal.
- `shared/style.mjs` owns saved household pet choices (cat/dog/bunny) and decor,
  including aquarium. The current decor catalog has no TV entry. Authored furniture
  and floor plans supply some TVs and tubs. Catalog fish need explicit aquarium
  semantics; do not pretend fish is an existing selectable household pet type.
- Fresh read-only :4777 state exposed eight saved residents: Rosa, Olive, Tyler,
  Vera, Basil, Nell, Cleo and Tess. Their recorded interests remain old test values
  or empty. Some saved homes are inactive; do not activate them or alter permits.
  Re-read actual IDs, membership and preferences before making authorized updates.

## Requested outcome and boundaries

Player-invoked care should use interests and their activity scenes to increase
simulated happiness. Agents may also perform matching passive activities. Keep
passive animation distinct from player-invoked completion/reward: this request
does not specify automatic happiness gains for passive behavior.

Review every catalog interest, not just the existing 19 home scenes. Document
its activity, venue, needed persistent item/pet, reachable physical interaction
and player-care availability. Existing unsupported non-home activities must have
honest unavailable reasons; never label an unimplemented action complete, invent
its venue, silently expand home eligibility or award happiness for a placeholder.
Report reviewed versus implemented counts explicitly and identify remaining scope.

Pet-related behavior/care requires the matching actual household/project pet.
Do not conjure temporary replacement animals when ownership is absent. Aquarium
care needs the actual placed aquarium and an explicit policy consistent with its
existing fish rendering. Missing, busy or inaccessible resources give a clear
reason and no reward. Generalize this review to all item/venue dependencies.

Make a TV a player-addable persistent house item, including an above-fireplace
placement supported by the existing house/style system. Authored and player-added
TVs should satisfy the same capability check; a temporary screen must not. Respect
mounting, wall cutaway, floor, seat/sight-line and route constraints. No TV is added
to the human's actual house on their behalf and no currency is spent in this work.

Bubble baths must use an actual household tub when present, rather than spawning
a portable bath to bypass ownership. If absent or unreachable, explain that the
action requires an available tub. Handle existing tubs on upper floors honestly;
do not teleport residents, cross walls or claim availability from catalog IDs alone.

Replace current agents' Reading and Encouragement/praise interests with varied
supported alternatives. The latest human instruction supersedes the prior
keep-praise-for-everyone preference. Give all eight current saved residents distinct
interest combinations, respecting actual household prerequisites. Preserve IDs,
membership, happiness, history, cooldowns, work/chats and construction; reassignment
grants no reward. Use validated, revision-checked server-owned operations, not raw
personal JSON edits. Cover inactive saved residents without activating their homes
or bypassing care ownership checks. If running bridge/API limitations prevent this,
report exact unchanged residents rather than claiming all were reassigned.

## Team responsibilities

Tyler first: review all 68 interests and produce the full requirement/availability
matrix plus a concrete player-care interaction specification. Define clear labels,
missing-resource feedback, completion/cancellation states and TV mounting visuals
consistent with current assets. Document any catalog ambiguities. Do not implement
application integration or mutate real resident state; Olive owns those portions.

Olive after Tyler: implement the player care and shared capability/resource model,
integrate passive and player-invoked scenes, TV placement, real-pet/tub gating and
authorized current-resident reassignment. Derive authoritative resource eligibility
from validated saved style/home/pet state, not client claims. Preserve server-side
receipts, revisions, cooldowns, bounded happiness and once-only completion. Recheck
resource loss, observed-work interruption, cancellation, restart, disconnect and
blocked stations before rewarding. A wall-clock delay alone must not certify a
scene that never started or became unavailable. No provider prompts or real task
outcome/XP changes. Preserve recent bird/civic/click and home-animation work.

## Verification and handoff

Use isolated AGENT_WORLD_HOME/CODEX_HOME fixtures for tests. Cover all interest
matrix rows, present/missing/mismatched pets/items, TV persistence/mounting/removal,
tub selection and reachability, multiple floors/residents, interrupted care,
duplicate receipts, forged eligibility, cooldowns and no passive/assignment reward.
Visually inspect representative player-triggered scenes and missing-resource UI
through the authorized task browser (or existing screenshot fallback). Do not send
real care actions just to test reward behavior. Actual assignments are explicitly
authorized, but verify them with fresh reads and report before/after evidence without
committing private state snapshots.

Run appropriate focused/regression checks and npm run app:build after code changes;
verify package signature and asset parity. Existing Windows cache permission/signing
limitations remain until actually resolved; do not bypass a declined escalation.
Do not quit/restart while approved, queued or running work might be interrupted.
Record runtime/version limitations if changed APIs are not yet loaded. Update
docs/NEXT_PASS.md with actual evidence, assignment coverage and unfinished actions.

No publishing, pushing, spending, queue edits, acceptance, other-chat messaging,
future-pass approval or additional delegation. This brief is not implementation
evidence. Teammates are routed only through structured handoffs.
