# Interest care: player interaction and resource design

Tyler · October 15, 2026 · design/review only, checkout `650f656` (`happiness`).
Companion: [complete 68-interest matrix](INTEREST_CARE_MATRIX.md). This is a specification for Olive, not implementation evidence or authorization for another pass.

## Review result and current boundary

Reviewed **68/68 interests and their 68 related activities**. Current source provides **19 home scene mappings**, **3 care actions** (`praise`, `snack`, `read`) and **3 care-editable interests**. The other **65 interests have no player-care implementation**. Of the 19 home scenes, 3 overlap current care interests and **16 are passive-only**; **49 interests have no mapped home scene**. A mapped scene does not establish ownership, accessibility or reward eligibility. No expanded care action is implemented by this pass.

The current snack/praise actions are immediate (+3 general, +5 matching); Reading requires its interest and ten seconds for +5. Existing cooldown is thirty seconds per completed action. Catalog `happinessValue: 5` is explicitly a draft, not a live universal rule. Source evidence: `shared/catalogs/intrests.js`, `activities.js`, `shared/care.mjs`, `bridge/server.mjs`, `web/src/care.js`, `home-activities.js`, `home-activity-scene.js`, `shared/style.mjs`, home plans/floors, furniture and style CSS. The matrix preserves exact catalog IDs, venues and links rather than silently correcting them.

Passive leisure stays labeled “simulated” and earns **zero happiness, XP, gems, task progress or acceptance**. A player care action can share its choreography, but must carry a separately validated player invocation and once-only receipt. Never treat an idle animation, elapsed timer, completed model reply or catalog relationship as proof of care completion. Both passive and care scenes must respect persistent TV/tub/pet ownership; passive mode must not conjure replacements either.

## Player controls in the current visual style

Keep the existing resident Character summary and anchored, nonmodal **Care for {name}** menu: 360px maximum width, 12px inset/gap rhythm, 16px rounded glass shell, 14px rounded action rows, plum happiness meter, dark readable ink, restrained teal/gold scene accents. Retain 44px minimum controls and 3px focus outline. Under 420px, rows stack. Use current font/tokens; do not add a dashboard, fullscreen scrim or new HUD. The source CSS has earlier 520px dialog rules overridden by the later anchored 360px rules; use the effective latter layout.

Order: resident name → **Happiness · simulated 62/100** → interest chips → Suggested care → active progress → history. Default list contains the resident's interests, with ready actions first and unavailable interests still visible with reasons. An expandable **All interests** section may show all 68 for inspection; unavailable entries cannot start placeholder scenes. Interest editing remains a separate deliberate Save/Cancel operation, grants no happiness and must never auto-select interests because a resource was added.

Each action row shows a plain verb, named station/pet and floor, expected bounded gain and duration, visible status/reason, and one **Start** button. Example: “Watch TV / Living room · ground floor / Up to +5 happiness · 10 seconds / Start”. Use exact supported action labels in the matrix; simulated achievement rows require the safe wording below. Unavailable action buttons are disabled, with the explanation as normal text and `aria-describedby`, never tooltip-only. Do not show a purchase button beside a care action. **View in Build mode** can navigate to an existing panel after a player's click; never place, unlock, adopt or spend automatically.

Proposed consistent first timed-care treatment is ten active scene seconds and thirty seconds cooldown after success; this is a design recommendation for supported integrations, not a change to current server rules. Matching interest actions propose +5, capped at 100, with actual delta reported. Preserve legacy +3/+5 praise/snack until Olive explicitly implements and documents any migration. Do not enable the catalog-wide +5 merely by loading rows. At 100 show “Already at 100/100”; a player may still run a supported scene if the product keeps this choice, but completion must say “Happiness unchanged · 100/100”, never +5. No silent automatic retry or queue of care actions.

## States, completion and cancellation

| State | Visible feedback | Reward/cancellation contract |
| --- | --- | --- |
| Ready | Station + duration + bounded gain; Start | Revalidate interest, home membership/readiness, resource identity, route, floor and occupancy on click. |
| Starting | “Finding a place for {name}…” | Disable double-send; hold one invocation/receipt, not one per retry. Cancel remains available. |
| Approaching | “Walking to the living-room TV” | Reserve station/pet; show progress as indeterminate until arrival. Approach never earns reward. |
| Active | “Watching TV · simulated · 8s remaining”; Cancel activity | Only active, continuously eligible scene time counts. Closing Care does not cancel; summary shows activity and reopen path. |
| Completed | “TV time finished · +5 happiness · 67/100” | Server acknowledges once-only completion, actual delta, matched interest and cooldown. One restrained heart near resident, no work-success confetti. |
| Cancelled | “Activity cancelled · no happiness added” | Release reservations, props and pose. No partial reward or success cooldown; retain deduplication/history. |
| Interrupted | “Activity stopped because {name} started working · no happiness added” | Observed work/wait/error wins immediately; cancel rather than displace work. |
| Lost resource | “TV removed during activity · no happiness added” | Cancel on removal/move invalidation, mismatched pet, blocked route/station or changed floor/home. |
| Disconnected/restarted | “Connection lost · completion unconfirmed” then authoritative cancelled/completed receipt | Disable new requests. Refresh receipt before displaying a result; never infer reward from a client timer. Restart cancels unfinished care, no offline catch-up. |
| Stale revision/rejected | “Care changed. Refresh and choose again.” | Preserve draft where possible, refresh authoritative status, no automatic resubmission. |

Escape/outside click closes the anchored menu without stopping activity; explicit **Cancel activity** stops it without an extra confirmation. Cancellation is idempotent and cannot reverse an already confirmed completion: if completion won the race, show that receipt. At most one care activity per resident and one exclusive reservation per physical station/pet. Two residents competing see “In use by {name}. Try again when free”; do not queue them. Acknowledgment clicks must not steal a reserved pet or reset timers. Changing interests during active care remains disabled.

Use polite live status for starts/results/errors, avoid announcing countdown every frame, and keep focus stable after updates. Text plus icon distinguishes states; purple/green alone is insufficient. Reduced motion removes hearts/bobbing but preserves progress, contact poses and status. No celebratory sound beyond existing user sound preference.

## Exact missing-resource messages

| Condition | Player copy |
| --- | --- |
| No matching interest | “Choose {interest} as an interest to use this care activity.” |
| Real observed activity | “Available when {name} is free.” |
| No household pet | “This home needs a {cat/dog/bunny} for this activity.” |
| Different pet | “This home has a bunny. This activity needs a cat.” |
| Pet on another inaccessible floor | “Your cat is on another floor. No supported route is available.” |
| No aquarium | “Place an aquarium in this home to watch its fish.” |
| Missing TV | “Place a TV in this home to watch TV.” |
| TV exists, no viewing station | “TV found, but no reachable seat faces it on this floor.” |
| No actual tub | “This home needs a bathtub for a bubble bath.” |
| Tub inaccessible | “Bathtub found upstairs. No supported route is available from this floor.” |
| Item missing / unimplemented item | “Requires a placed {item}.” / “{item} is not available to place yet.” |
| Venue not implemented | “Requires {venue}. Player care at this venue is not implemented yet.” |
| Blocked station | “Clear a path to the {station} and its interaction space.” |
| Inactive / building home | “Care is unavailable in inactive homes.” / “Care is available when this home's construction finishes.” |
| Cooldown / offline | “Ready in 24s.” / “Reconnect to use care.” |

If several reasons apply, prioritize disconnected/home state → unsupported action/venue → interest → missing resource → route/floor → occupancy → cooldown. Show the first actionable reason and expandable requirement list. Never call an unimplemented venue merely “locked”: that implies an obtainable feature.

## Persistent resource policy

The matrix's requirement column is the recommended explicit interpretation, not a claim that every related item exists in inventory. Catalog arrays do not specify AND/OR semantics. Define per-action predicates; `relatedItems` must not become a generic “all of these” test. Small consumable/held props (food, book, remote, pet wand, journal, board kit, brush) may be scene props only when the explicit row permits. They do not satisfy durable fixture, pet or venue requirements. There is no consumable stock or payment system proposed here; simulated takeout must say it places no real order. Snacks currently bypass the catalog fridge; preserve that documented legacy exception until replaced explicitly.

Olive should derive resource identities from validated saved home/style/pet state plus the current authored floor plan, not client-supplied booleans. Saved style is home/project scoped. Include resource ID, kind, floor, transform, approach, interaction envelope and occupancy in the design contract. Authored `tv` and added `television` map to one TV capability; authored `bath` maps to bathtub. Inventory/unlock ownership alone is insufficient: an item must be placed in this home. Recheck through approach, active scene and completion; an elapsed `readyAt` alone cannot prove arrival or scene continuity. Physical/client acknowledgments alone are not authoritative eligibility claims. Existing server timing needs integration beyond UI work; engineering details remain Olive's responsibility.

Keep residents on their actual supported floor and within their accessible unit/rooms; no teleport, wall crossing or borrowed workstation. If cross-floor traversal is not actually supported, report unavailable even if stairs/elevator are drawn. Exits, desks, waiting spots, landings, visitor routes and player decor remain protected. Layout change cancels and offers a fresh Start after revalidation; do not relocate furniture or resume automatically.

## Addable TV above the fireplace

Add one persistent **Television** catalog item under existing Fun decor. Keep price/unlock policy as an explicit implementation/product decision; this pass sets no price and authorizes no purchases. Build mode previews a normal TV with placement mode **Above fireplace**. Target the actual fireplace on the selected floor, highlight the mounting rectangle, snap to its local face and show the existing green valid/red invalid ghost plus text. R selects only valid local orientations; no free floating screen or accidental floor-coordinate placement. Escape/right click cancels preview with no saved item or charge.

Source fireplace: 1.9m body, 2.1m mantel at y=1.25, 1.3m chimney breast extending approximately to 2.695. Candidate screen: **1.12 × .63 × .08m**, dark charcoal flat frame, inset desaturated teal display, subtle lower indicator, no stand or photoreal/video texture. Candidate local center **(0, 1.92, .13)** relative to fireplace, front toward local +Z; bottom ~1.605 leaves ~.30m above mantel and top ~2.235 stays below typical ceiling. Calibrate these source-derived candidates against actual mesh bounds, wall height and all rotations before claiming fit. Do not hard-code world coordinates or add a second chimney/wall. Abstract colored program shapes may move slowly, with restrained emission; no fast flashes or personal/web content.

Persist a stable fireplace anchor, floor and mounting transform, and reject overlaps with windows, ceiling/roof, other wall fixtures and clearance envelopes. A small offset prevents z-fighting; screen must face into room. Stable mounting identity must survive save/reload and derived floor-plan upgrades; if anchor disappears, retain the owned item as unplaced with “Choose a new TV mount”, cancel care and grant no capability until placed again. Removing/moving must use existing player-controlled decor controls. Multiple TVs may exist, but one action reserves one reachable seat plus its specific screen.

Use authored fireplace/cutaway ancestry or equivalent explicit visibility policy: mounted TV lowers/hides with its support wall in cutaway, stays inside roof/floor masking, and never floats through hidden walls or appears on another storey. Authored standalone TVs count equally when actually present and accessible. Maintain the existing same-floor candidate viewing range (within 5m, forward of seat, lateral offset under 1.5m) as a starting filter, then add actual wall/occlusion and head-direction tests; distance alone is insufficient. Animate seated gaze at screen, remote in free hand, no television spawned by the activity. TV-only household does not unlock Movies: its current venue is `movie_theater`.

## Real household pets and aquarium

The saved style supports **one `pet` choice per home: cat, dog or bunny**. It does not support all three simultaneously, resident-owned pets or a fish selection. Interest assignment can include a pet interest only when that matching saved pet and usable scene are supported; another project's animal and an interest ID are never ownership. Reuse the single actual pet mesh/identity and reserve it exclusively. Approach it without instant relocation; if the existing pet controller cannot move to a reachable care station, explain unavailable. Restore ambient pose/controller and release ownership after cancellation/completion. Remove every temporary substitute animal path for both passive and invoked scenes. Ground-floor pets must not appear upstairs by reparenting.

Cat: crouch at reachable floor mat, wand in free hand, restrained cat reach/pounce; maintain separation. Bunny: kneel nearby with leaf/bowl prop, ears/head response; do not transform it into a cat routine. Dog walk remains unavailable until park/dog-park travel and return are implemented; owning a dog does not make its non-home activity a home petting action.

Recommended fish policy: an actual placed aquarium is a **populated aquarium fixture** containing its already-rendered simulated fish. Persisted placement is sufficient ownership of this fish habitat; do not invent a selectable `fish` pet or a new adoption transaction. Bind the watch scene to that aquarium's fish and approach space; no portable tank. If its rendered fish are only decorative and cannot be bound reliably, leave care unavailable with that specific limitation until integrated. Source aquarium rendering and capability mapping need verification by Olive. Do not create fish starvation, feeding inventory or death mechanics.

## Existing tubs

Select an actual `bath` fixture from the resident's floor and accessible unit. Family House includes a ground-floor bath and an upstairs bath; other upper plans must be resolved from current generated floor data, not tier names. The home scene planner already attempts a bath-side approach and can fall back to a temporary bath: remove this fallback for bath scenes. Reserve the fixture and side-entry/exit envelope, orient to local facing and calibrate pelvis/foam contact to the actual rim/water height, not portable-kit offsets. Bath fixtures are approximately 2.2 × .9m in plan; use actual obstacle bounds.

Approach at walking speed, short supported sit/settle behind opaque foam, head/shoulders visible, knees/legs hidden only while contained. Use the existing character materials/clothes policy; no undressing UI or new skin asset. Foam uses existing cream low-poly bubbles and blue water; no portable tub, room flood or particle fog. Exit at the reserved reachable side and restore legs/pose even on interruption. If no safe entry/exit choreography exists, report unavailable rather than teleport into the tub. Hidden bathroom/cutaway floors cannot leave floating foam. Two residents cannot share a tub. Upper-floor ownership alone does not establish cross-floor access.

## Catalog ambiguities and assignment review

All 49 non-home rows remain unavailable in the current home-care expansion unless their own venues and scenes are explicitly implemented; decorative park/café/library/civic models do not prove player-care support. Existing home arcade, record player, guitar, garden beds and picnic table do **not** override the venue catalog. Movies/TV, gardening/home yard, dog/home petting, and generic music/home listening need deliberate catalog changes in a separately authorized implementation, not inferred eligibility. Poolside chair requires an actual pool; swimwear does not create water; hot tub is not a bathtub. Skill/talent/personal-record/competition labels require defined simulations and must not invent actual skill or victory.

`complete_a_personal_goal`, `earn_an_award`, `celebrate_an_achievement` currently have home flavor scenes but no real achievement evidence. Safe care labels are **Enjoy goal time**, **Enjoy an award scene**, **Celebrate together**, always “simulated”; care reward would be for the shared activity only. Never create an award, accepted task, real personal goal or work outcome. Until this semantics mapping is implemented explicitly, keep these care buttons unavailable even though passive scenes exist. Encouragement remains cataloged but the human requested removing it and Reading from current residents' assignments.

Fresh API inspection in this pass confirms eight saved residents; no assignments changed. The brief's requested varied combinations must be handled by Olive with fresh IDs/revisions and validated server-owned operations, including inactive saved homes without activating them. Preserve all happiness/history/cooldowns. Prefer supported home choices after integration, mix food/rest/leisure/creative, and gate TV/pets/bath on actual household capability. Do not preassign specific pets/TVs from names or assume eight globally unique interests are feasible before resource checks. Require eight distinct combinations with neither `reading` nor `praise`; if unsupported coverage prevents that, report exact unchanged residents instead of silently reverting to legacy defaults. Changing interests earns zero reward.

## Review criteria for implementation (not executed here)

Olive's isolated fixtures should assert exact 68-row catalog coverage, 19 home mappings and explicit unavailability for all other venues; matching/missing/mismatched pets; populated aquarium presence/removal; authored and added TV parity, mount save/reload/rotation/cutaway/anchor loss; missing/occupied/upstairs tubs; blocked routes, separate units/floors and multiple residents. Verify Start → approach → active → once-only server result, cancellation at each phase, work interruption, duplicate/replayed/forged requests, stale revisions, resource loss, restart/disconnect and no passive or reassignment reward. Inspect representative actual player-triggered scenes, contact/exit poses and unavailable messages, keyboard/reduced motion and narrow menu layout. Use only isolated test homes; no real care reward clicks for QA.

Application implementation must run focused regressions, `npm run app:build`, signature and packaged-asset parity checks. Existing recorded Windows cache permission / unsigned-package limitations remain unresolved. A running window needs safe reopen only when no approved/queued/running work would be interrupted; never restart to make a design review look current.

## Evidence and limits of this pass

Read project concept, README, NEXT_PASS, agent-world skill/references and team brief; inspected current catalog/care/style/scene/plan/furniture/CSS and Git changes. `rg` is unavailable; used PowerShell/Node. Read-only :4777 `/api/state` returned HTTP 200; listener PID 47628 is checkout Electron. State showed one running run, one running proposal and one approved proposal. No server/app was started, stopped or reopened.

Actual task browser open/inspect/screenshot at :4777 showed a 1100×720 Mayor welcome overlay over Town Hall, existing resident statuses and simulated activity labels. No click, text entry or dismissal occurred. Image inspected in stream only; no saved PNG. This supports current visual vocabulary, not rendered TV/tub/pet/care verification. Designs and candidate mesh measurements remain unrendered. Documentation coverage/preservation/whitespace check results are recorded in NEXT_PASS after verification. No application code, UI, real assignments, care rewards, tasks, queue, spending, other chats, acceptance, publishing or push changed. No build/signature check is required or claimed for documentation-only edits.
