# Town character updates — scoped team plan

October 15, 2026. Rosa's coordination pass for the human's bird, civic NPC and
resident-click request. This document plans work; it does not establish implementation,
passing runtime checks or human acceptance.

## Grounding and scope

- Preserve the uncommitted home-activity implementation and design work. In particular,
  `web/src/sim.js` already owns home-scene interruption, reservations and held props.
- `web/src/landscape.js` currently renders nine bird instances from two flat wing
  triangles, with scale-based flapping. Improve their recognizable bird silhouette
  and motion within the existing low-poly world. Retain bounded flock size and
  scenery-only behavior. Tyler defines the actual shape and animation treatment.
- `shared/town.mjs` defines eight civic kinds: fire_station, police, library, school,
  hospital, city_dump, water_tower and power_plant. Provide one appropriate simulated
  staff NPC per placed building. Include all eight; utility sites need attendants too.
  Town Hall already has Mayor Martin: preserve him rather than duplicating him.
- `web/src/civic.js` owns placed-building creation, local transforms, cutaway and
  disposal; `web/src/mayor-character.js` and `models.js` provide existing character
  references. NPCs belong to scenery, never household membership, provider sessions,
  recruitment, real work, XP or staffing/service claims. Buildings absent from the
  town have no visible NPC. Do not place buildings in the real town to test this.
- The world click handler in `web/src/main.js` selects a picked Sim; `focusSim` is
  also used by other navigation. Trigger the reaction from an actual resident click,
  not every programmatic selection or focus update. Preserve opening the existing
  agent UI. Leave Mayor onboarding behavior intact.

## Resident-click behavior contract

The visible response begins on the next rendered update, without waiting for a walk
or home activity to finish. For an available idle/off-duty resident, briefly turn
toward the viewing camera, look upward toward the human and wave. Derive orientation
from camera/world transforms, including rotated lots and upper floors, rather than
using a fixed world heading. Tyler defines timing, posture and restrained variants.

Working residents keep their workstation, target and observed state and make a short
wave-off gesture. Working covers thinking, reading, editing, running, searching and
delegating based on the existing observed-state model. Waiting-for-user and error
remain urgent truth states: retain their existing attention signal and allow only a
compatible acknowledgment, never a dismissive busy response. Done/idle are available;
stale or unknown activity must not be promoted to a claim of current work.

Use a bounded transient animation overlay with clear priority and cleanup. No real
provider cancellation, fabricated state/event or happiness/care reward. New observed
work must immediately win over the friendly reaction. Repeated clicks refresh or
coalesce one reaction rather than queueing waves. Avoid held-prop collisions: safely
pause/end ambient scenes through existing cleanup, without completing pending care
early. Return to valid activity pose and reservations. Respect reduced motion.

## Team sequence and deliverables

1. Tyler: author a concrete visual specification for birds, all eight civic staff
   identities/role cues and small in-building routines, and both click reactions.
   Use existing models/material/style and authored building interiors as references.
   Specify safe anchors, look direction, hand contact, timing and reduced motion.
   This is the graphic-design portion; application integration belongs to Olive.
2. Olive, after Tyler: implement the three updates against that specification,
   reconciling current files rather than overwriting existing changes. Keep civic
   NPC lifecycle keyed to actual placements; move/rotate/remove/rebuild must update
   or dispose characters without duplicates, leaks or blocked entrances. Reuse
   existing walkable areas; no cross-wall roaming or new service/gameplay systems.
   Keep bird geometry/material counts bounded and avoid per-frame allocation growth.

## Evidence and completion criteria

- Exercise all eight civic kinds, placement rotations, cutaway, move/remove/rebuild,
  and Town Hall coexistence in isolated fixtures. NPCs must be visibly recognizable
  and their behavior must not create resident/session metadata.
- Check idle/off-duty clicks, all working states, urgent waiting/error, repeated
  clicks, mid-wave truth transitions, held items, rotated homes and upper floors.
  Verify existing selection/chat behavior and home-activity cleanup remain intact.
- Observe bird silhouette and flap/glide phases at normal town zoom and closer views;
  check existing day/night visibility and reduced motion. Use captured before/after
  evidence, reporting any unverified camera angles or transitions.
- Prefer authorized agent_world_browser observation/input with its approval rules;
  otherwise existing screenshot fallback. Use isolated AGENT_WORLD_HOME/CODEX_HOME
  for fixtures. No real town, queue, reward or provider prompt changes for QA.
- Run targeted behavioral/regression tests and relevant existing tests. Report full
  suite failures honestly. Run `npm run app:build` after application updates and
  verify signature plus source/build/package asset parity. The prior Windows build
  is blocked on Electron-builder cache access; do not bypass a declined escalation
  or call asset parity a successful signed package.
- Do not quit/restart while approved, queued or running work could be interrupted.
  Record when the window still needs a safe reopen. Update docs/NEXT_PASS.md with
  exact changed files, actual checks, evidence paths and remaining gaps.

No publishing, pushing, spending, messaging other chats, accepting work, queue edits,
future-pass approval or additional delegation. Structured handoffs route this request;
this plan does not itself launch teammates or authorize unrelated work.
