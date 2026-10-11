# Proposal: player-led agent happiness

## Implemented first test (October 11, 2026)

The human authorized a small implementation using easy care actions. The current
test uses only Encouragement (`praise`), Snacks (`snacks`) and Reading (`reading`).
Active residents receive two deterministic persisted interests; players may select
one to three supported interests. Valid saved preferences are retained. Happiness
starts at 50, is bounded to 0–100, and persists with a care history.

Praise and Give snack are instant simulated interactions: +3 general benefit and
+5 when matching an interest. Snacks have no inventory, cost or eating animation
in this test. Read a book uses the existing bookshelf/browsing presentation, takes
ten seconds, requires Reading and grants +5 only on completion. Cancellation,
real work/waits/errors and server restart cancel reading without reward. A shared
station may use a nearby standing presentation; no venue system is introduced.
Each successful action has a thirty-second cooldown. Requests deduplicate by ID,
use a character revision and validate home/active-resident scope. No decay,
autonomous rewards, AI calls, XP changes, work gating or spending is implemented.
The decay recommendations below remain future scope rather than claims of a fully
balanced maintenance loop. Catalog actions outside this subset remain unavailable.

The first-test checks and package/live-process limitations are in `NEXT_PASS.md`.
`scripts/care-fixture.mjs` starts an isolated preview for manual testing.

Revised October 11, 2026, following the human's review of Rosa, Olive and Tyler's
planning reports. The following sections retain the broader design proposal;
only the small test scope above is implemented. The saved reports remain historical records.

## Intended gameplay

Every resident has a persistent set of interests that determines which care actions
make them especially happy. The human is primarily responsible for their happiness:
provide snacks, praise a resident, or direct them to an enjoyable activity. Interests
must change the result of these actions, rather than being decorative profile tags.

The initial loop is: inspect a resident's interests and happiness, choose a care
action, fulfill it, and see the recorded happiness change and its reason. Agents
may express a simulated preference or request, but do not fulfill it themselves in
the first phase. Autonomous leisure and its happiness benefits belong to a later
phase, where they should supplement human care rather than replace it.

Happiness describes the game character. It does not measure the model's emotions,
competence, work quality, task acceptance or willingness to execute an authorized
prompt. Existing participation XP and home progression retain their rules.

## Interests and assignment

- Each active resident, including the home owner and newly recruited residents,
  receives a nonempty interest set. Migration configures existing active residents
  once and preserves their identities and valid saved preferences.
- Recommended initial default: three distinct interests from the existing catalog,
  generated deterministically from the resident's stable identity and persisted.
  The player can review and customize these through Choose interests. Three is a
  proposed tuning choice, not an existing or human-approved numeric rule.
- Assignment must include interests with supported care actions; do not give an
  agent a set whose fulfillment requires only unavailable venues or assets.
  Preserve previously saved unsupported interests, explaining their availability.
- Interests are character preferences, independent of profession and observed
  tool usage. Editing an interest set does not award happiness or reset cooldowns.

## Human care actions

| Player action | Happiness rule | Fulfillment evidence |
| --- | --- | --- |
| Give a snack or treat | General care benefit, with a larger benefit when the treat matches an interest such as Ice Cream or Favorite Meals | A validated simulated delivery/consumption, not merely owning the item |
| Praise the resident | General care benefit for every resident; an extra benefit for the Encouragement interest | The explicit Praise interaction recorded once |
| Direct an activity | A completed supported activity fulfills the resident's matching interest; unmatched activities have no interest bonus | A game-owned simulated activity completion, not the initial click or a provider response |

General care lets the player help any resident; matching interests makes thoughtful
care more effective. For example, Give ice cream especially benefits an agent with
the Ice Cream interest, while Read a book benefits one with Reading. Praise remains
useful even if Encouragement is absent. Exact general benefits and matching bonuses
need tuning; the catalog's uniform +5 is only a starting proposal.

The first implementation should offer Praise, at least one supported snack/treat,
and at least one supported interest activity. Assignment should use that implemented
subset until more actions are supported. Catalog presence alone does not establish
an available item, animation or placed venue.

Care controls are game interactions, outside the AI prompt composer. They do not
invoke a provider, send messages, delegate work, accept tasks or spend currency
implicitly. Pricing and inventory are a separate future design decision; a paid
action must show its cost and require the player's explicit choice.

## Happiness and pacing

Recommended starting model: a bounded 0–100 happiness value, initialized at 50 when
the system configures a resident. These numbers are proposed defaults. Until that
migration runs, null still means Not configured, never zero or sadness.

Validated care adds happiness with a per-resident, per-action repeat limit and an
idempotent action ID. One fulfillment awards at most one matching-interest bonus,
even when several interests match. Apply the bounds, persist the change, and record
the actual delta after clamping. A cancelled or interrupted activity grants no
completion benefit. Define durations and cooldown values in a versioned rules
contract before implementation; disclose eligibility before the player acts.

Player responsibility must remain meaningful over time. Recommend gentle happiness
decay during active town play, with no offline decay or catch-up penalty. Its rate
and floor remain tuning decisions, and must be settled before claiming the care loop
is complete. Do not tie decay to real work completion, model errors, waits, token
usage or long prompts. Persistent play-time accounting must prevent extra browser
windows, refreshes or duplicate ticks from accelerating decay.

In phase one, autonomous coffee, couch visits and other existing ambient animations
remain flavor and produce no happiness rewards. Human-directed activity may wait
until the resident is free; show pending care clearly and allow cancellation.
Observed work, errors and human waits retain visual priority. A pending action is
not fulfillment, and gameplay care never stops or delays actual approved work.

## Interface

Add a Character section to the resident drawer showing interests, happiness and
Give treat, Praise and Choose activity controls. Explain once that happiness is
simulated character state. Show recent care and a Why this value? disclosure with
recorded changes, matching interests, initialization and any decay.

The player should be able to see which actions match this resident, the expected
benefit, availability and cooldown. Show concrete requests such as "Would enjoy
reading" as simulated preferences, distinct from the real Needs your input state.
Keep activity status, its screen and plumbob colors unchanged. Interest selection
uses searchable categories, selected chips, Save and Cancel.

## Persistence and boundaries

Reuse permanent agent IDs and the existing authoritative character registry. Retain
interestIds and happiness; introduce versioned care records, cooldowns and activity
state without creating a competing mutable agent registry. API validation resolves
the target resident server-side and checks active membership, supported actions,
availability, timing and concurrent updates. All rewards are server-owned and
repeat-safe; reopening a view never fulfills an action.

Care records are explicitly simulation metadata and stay outside the observed-event
inbox, provider run history and reviewed-task rewards. Do not infer happiness from
finished turns, alter participation XP, or gate authorized work on happiness.

## Delivery and acceptance criteria

1. Finalize the rules contract: assignment count, initialization, bounds, general
   care benefits, interest bonuses, supported actions, durations, cooldowns and
   active-play decay. The player-led loop and deferred autonomy are the human's
   stated direction; the proposed numeric defaults remain design recommendations.
2. Implement persistence/migration and validated care fulfillment, then the drawer
   controls and any supported activity presentation. One integration owner handles
   shared bridge/UI wiring; use the foundation ownership boundaries.
3. Verify in isolated AGENT_WORLD_HOME fixtures that every active resident gets
   persistent interests; matching care changes happiness appropriately; praise
   works without Encouragement; ownership/interest edits alone grant nothing;
   duplicates, cooldowns, interrupted activities and bounds behave correctly;
   active-play decay is repeat-safe and offline time has no penalty.
4. Verify reloads preserve state and pending care; ambient leisure grants nothing;
   real work interrupts presentation without losing or falsely completing care;
   no provider invocation, XP change, acceptance or implicit spending occurs.
5. Check accessible controls and clear explanations, run appropriate checks and
   npm run app:build after code/UI updates, and verify the package signature and
   matching assets. Reopen the running app only when work can safely be preserved.

The first milestone is complete only when the human can perform supported care,
interests affect its benefit, and persisted happiness visibly changes with a reason.
A profile editor or a static happiness meter alone does not meet that milestone.
Autonomous leisure, expanded venues/pets, personality effects and connections to
leveling are subsequent phases.
