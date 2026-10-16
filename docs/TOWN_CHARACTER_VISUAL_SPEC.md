# Town character visual specification

Tyler, Graphic Design Assistant; October 15, 2026. Design only, for Olive's
application integration. Grounded at `650f656`, branch `happiness`, with existing
uncommitted home-activity work. This document is reviewable design, not implemented
behavior, human acceptance or authorization to execute another pass.

## Inspected baseline and visual direction

Read CONCEPT, README, NEXT_PASS, the Agent World skill/work-cycle reference and
TOWN_CHARACTER_UPDATES_PLAN. Inspected `landscape.js` bird creation/update;
all eight BUILD functions, Kit furniture, transforms, cutaway and lifecycle in
`civic.js`; CIVIC/civicTransform in `shared/town.mjs`; buildPerson/materials/rig
in `models.js`; `mayor-character.js`; resident click/focus/pick in `main.js`;
Sim work, wave, joints, IK, home cleanup and current uncommitted diff; and
`home-activity-scene.js` held-prop attachment. These are authored-source inspections.

Actual read-only browser open/inspect/screenshot of :4777 showed the 1100 x 720
Mayor Martin welcome overlay and Town Hall cutaway behind it. It supports the
faceted, warm toy-town direction, but does not verify civic interiors or birds.
No overlay dismissal, clicks, settings or town mutations were performed. The
image was observed in the tool stream, not saved as a screenshot artifact.

Keep the existing hand-cut rounded blocks, low-segment cylinders, large heads,
mitten hands, warm colors and matte materials. New details must read through
silhouette and broad color areas at town zoom, rather than tiny text. Reuse
buildPerson proportions and existing material helpers; do not replace the rig.
Mayor Martin retains his face, suit, label, portrait, route, office seating,
onboarding interactions and connection badge. No second mayor or Town Hall staff.

## Birds: small recognizable flying birds

Current geometry is only two flat triangles in the XZ plane; scaling Y cannot
produce a wingbeat because every vertex has Y=0. Replace that visual construction
with a charcoal-backed, pale-bellied small bird. Keep nine birds, existing daylight
visibility (`night > .5` hides), ~45-second flock cadence, 30-second crossing,
22-30 altitude and 10 units/second travel unless integration evidence requires
a bounded adjustment. This remains scenery, with no activity metadata.

Model frame: +X forward, +Y up, +/-Z wings. Nominal dimensions before the current
1.4 instance scale: 0.90 nose-to-tail, 1.35 wingspan, 0.22 body depth. Body is a
faceted tapered oval about .52 x .22 x .24, center X=0; a .19 head at X=.27;
a pointed .12 beak extending to X=.48; two short tail wedges extending to X=-.42
with a shallow central notch. Head/neck must join the body without a floating ball.
Each wing has a broad root at X=.05, Z=+/-.10, an elbow near X=-.04, Z=+/-.39,
and a swept tip near X=-.22, Z=+/-.67. Use a tapered 4-6 vertex planform, with
.025-.04 thickness or a closed shallow wedge so side views retain a silhouette.
No detached feather fingers, legs hanging in flight or paper-thin V-only outline.

Use back/upper wings #3A4150, underside #D8D2C6, beak #C89A68, with dark tips
optional within the same shared palette. No eye mesh is required at this size;
a tiny dark face mark may be baked into head geometry for close views. Matte,
flat shaded, no emission, outlines, textures or individual bird labels. Target
<=160 triangles per bird and <=4 shared material batches across the flock.
Keep geometries/materials shared and animation buffers reusable; no per-frame
mesh creation or expanding particle/feather population.

Wing motion pivots about each shoulder along the body X axis, mirrored across
the body: tips +30 degrees above horizontal to -20 below. Distal third lags
the root by 50-80 ms with <=10 degrees additional bend. Cycle .72-.90 seconds:
roughly 40% downstroke, 60% recovery. Two or three beats then a 1.2-2.0 second
glide with tips 5-10 degrees up; blend across .18 seconds. Offset each bird's
phase deterministically; do not synchronize a rigid arrow formation. Preserve
the loose existing V spacing and allow only .15-.25 altitude variation. Body
pitch <=4 degrees and bank <=8 degrees, with head stable relative to body.
Orient +X along actual flight velocity, never billboard to the camera. Verify
the existing quaternion convention before reuse: the head must lead, not fly
backwards. Readability should survive top, side and three-quarter views.

Reduced motion: no flap, bob, bank or periodic size changes; keep a fixed glide
shape. Hide the optional flock altogether under reduced motion to avoid repeated
full-screen crossings; do not freeze birds in midair. Normal daylight/night
behavior remains the baseline for non-reduced motion.

## Civic staff: one simulated attendant per placed kind

Use independent scenery characters, not Sim instances or household members.
No provider badges, plumbobs, sessions, roster/chat entries, care, XP, staffing
counts, service metrics or invented dispatch/emergency claims. Inspection copy,
if a label is needed, is role plus "simulated town staff". Role names below are
identities for art direction, not additions to the real resident roster. Use varied
skin/hair/builds independent of profession; clothing and props identify the job.

Keep scale 1, fixed buildPerson skeleton (hip .9, shoulders .62 above spine root,
upper arm .31, forearm .30), existing face and boots. Broad uniform color plus
one accessory and one restrained work prop per role. Custom helmets/vests are
small procedural additions; do not assume existing beanies are hard hats. Mitten
props attach near elbow-local `(0,-.30,.02)` as in HomeActivityScene; no wrist or
finger bones exist. Resting hands may use IK. Never stretch arms to reach distant
furniture; hold the clipboard/book in the free hand instead.

### Placement conventions and source-derived anchors

All coordinates below are **building-local** `(x,z)`, yaw radians, +Z forward;
floor height is root foot height, not hip height. Apply the civic root's complete
transform once, including rotation. Staff stays beneath the roof at ground level,
never parented to lifting roof or shrinking wall groups. `inside` is statically
merged today: add a separate dynamic staff child after static merging. Roof/wall
occlusion follows the existing cutaway; no x-ray through closed buildings.

Use .40 radius for a standing body, plus the actual arm/prop sweep; seated poses
use authored chair contact rather than a collision-free standing cylinder.
Protect doors with at least the full authored door width and 1.2 depth on either
side. No cross-room walks are required in this first specification: short routines
are turns, glances and hand actions in the listed clear patch. Do not invent
navigation through uncut partitions. Anchor coordinates are source-derived
candidates requiring rendered clearance checks, not a claim of runtime validation.

| Kind / staff | Role silhouette and palette | Authored reference, anchor and heading | Small routine (seconds) |
| --- | --- | --- | --- |
| `fire_station` / crew firefighter | Ochre helmet with short brim and rear lip; dark charcoal jacket/trousers with broad pale-yellow cuff/hem bands, heavy boots; compact equipment checklist | Crew room east of partition X=2.4. Stand `(6.2,-3.8)`, feet Y=.14, yaw PI toward lockers at Z=-6.05. Keep clear of pole `(7.4,-.4)`, kitchen table `(5.2,0)`, engines and crew entrance `(4.4,3.4)`. | 0-4 inspect checklist, 4-5 lower it, 5-6 look toward lockers, 6-10 relaxed hold. No pole slide, siren or emergency dispatch. |
| `police` / station officer | Navy #3C64B4 collared shirt and dark trousers, modest cap brim, pale shield-shaped chest patch; no weapon; paper pad | Reuse west desk `(-4.2,-.4)`, chair center `(-4.2,.25)`, feet Y=.14, yaw PI toward desk. Avoid front counter `(2.2,-1.4)`, door X=4 and rear holding-cell bars Z=-3.8. | 0-4 seated paperwork, 4-5 glance up, 5-7 review pad, 7-10 rest hands. No patrol route through cells. |
| `library` / librarian | Plum #7C6A9E cardigan over cream shirt, optional round glasses, small teal book; broad book cover readable at distance | Stand `(-5.6,.20)`, yaw 0 toward existing counter `(-5.6,1.2)`; hand rest target near `(-5.6,1.26,.80)` in XYZ. **Feet Y=.50**: exterior plinth top is .50 and overlaps the nominal .14 hall floor. Do not bury feet or alter the plinth in this scope. Shelves at X=-5.2 start farther back; doorway/portico remain free. | 0-3 hold open book, 3-4 one page turn, 4-6 lower to chest, 6-9 look across reading room within 20 degrees, 9-12 return. No reaching books off distant shelves. |
| `school` / teacher | Mustard #D8A24A cardigan, teal blouse, charcoal trousers; small cream lesson card with abstract colored bars | Stand `(-6,-8.4)`, feet Y=.14, yaw 0 toward pupil desks. Teacher desk is `(-6,-9.6)`, board at Z=-11.18, first pupil row Z=-7.2. Anchor is in the gap between those rows; stay put, no invented doorway through partitions X=1.5/6.5. | 0-3 consult card, 3-5 small open-hand presentation toward empty classroom, 5-7 look down, 7-11 neutral. Do not add students or teaching-progress claims. |
| `hospital` / ward nurse | Teal #4FB3A5 scrubs, cream ID patch and small clipboard; no red-cross costume or medical procedure animation | Nurse-station desk `(-6,-.8)`, chair `(-6,-.15)`, feet Y=.14, yaw PI. Existing station counter is at `(-6,-1.6)`; remain on chair side of desk. Ward divider X=-1.6 and bed/IV/curtain rows are excluded from routine. | 0-4 seated clipboard review, 4-6 glance across ward, 6-8 small pen/pad motion, 8-12 neutral. No patients, diagnosis or simulated treatment result. |
| `city_dump` / weighbridge attendant | Orange #D9883A safety vest with pale bands, dark green trousers, work boots, ochre hard hat and small docket | Gate office centered `(10,6.2)` because doorX=4. Desk `(10.6,5.4)`, chair `(10.6,6.05)`, feet Y=.14, yaw PI. Keep office door `(8.2,8.7)` clear. Routine stays inside office; no roaming near heaps, skips, weighbridge plate or bulldozer. | 0-3 check docket, 3-5 desk hand tap, 5-7 glance toward front window within 25 degrees, 7-11 rest. No truck weighing or collection-complete claim. |
| `water_tower` / pump technician | Blue #5AA3D9 coveralls, cream hard hat, one broad pale chest stripe, dark boots, compact gauge card | Pump house centered `(-3.6,2.4)`. Stand `(-2,.90)`, feet Y=.14, yaw PI toward panel centered `(-2,-.20)` with face Z=.02. Pumps occupy X=-5.2/-3.6, Z=1; stay east of them. Door is `(-2,5.4)`. No climbing tower or touching the feed main near X=-.6. | 0-4 look at panel, 4-6 check held gauge card, 6-7 small nod, 7-12 neutral. Do not turn valve wheels; they are offset from this safe patch. |
| `power_plant` / control operator | Charcoal coveralls, ochre #E8C547 shoulder/vest panel, cream hard hat and compact hearing-protection cups; no glowing accessories | `cr=4.4`; desk `(4.4,1.9)`, chair `(4.4,2.55)`, feet Y=.14, yaw PI. Control room is bounded by solid pale-blue mesh at X=2.4 and Z=4.0; retain occlusion. Turbine sets at Z=2.1/5.6 stay outside this routine. | 0-4 seated panel/desk monitoring, 4-6 short note, 6-8 look toward control console `(4.4,.3)`, 8-12 rest. No turbine touching, switchyard walk or generation-success signal. |

Desk chairs are at desk-local `(0,.65)` in XZ, transformed by desk yaw; all chosen
seated desks above use yaw 0. Staff yaw PI faces back toward their desktop. Apply
body drop about -.42 and bent legs as the existing rig, then visually calibrate
to civic chair seat Y=.63 (top), rather than blindly borrowing household desk IK
targets: civic desk top is about Y=.92. Civic screen fronts also face differently
from household workstations. Use actual civic mesh contact heights for hand/head
targets; no promise of readable simulated screen content.

Routine yaw offsets <=25 degrees, head pitch <=12 degrees, breathing <=.01; no
large arm sweeps into walls or furniture. Seed phase per building so staff does
not move in unison. Staff ordinarily faces its station, **not** the camera; only
brief local room glances are ambient. No automatic greetings or resident-click
behavior for these scenery NPCs. Normal scene occlusion is intentional, including
solid control-room walls. Never move staff through a wall merely to reveal them.

Reduced motion: choose one clear stationary held-book/card/desk pose per role,
no page turns, tapping, breathing bob or routine looping. Night does not add
emissive body materials or claim a staffed operating schedule.

Lifecycle design: absent building means absent staff. Existing town allows one
of each kind; bind staff ownership to the actual placed building, not a separate
global spawn list. Move/rotate/rebuild/remove updates or disposes staff with that
building, including custom attachments/contact shadows and owned materials.
Do not dispose shared buildPerson materials when removing one NPC. Build-list
thumbnails need no animated staff. Character naming/role labels never populate
household or provider data.

## Resident click: immediate acknowledgment with two meanings

The actual single-click handler currently calls `select(sim)`; `focusSim` is
also used by library, onboarding and double-click navigation. Trigger only from
a resident hit in the ordinary world click path, preserving the existing select,
Watch activity/chat UI and suppress-click/planner/build/photo policies. Do not
trigger from selection refresh, programmatic focus, roster navigation or Mayor
click. Double-click's two clicks coalesce to one bounded response.

### Friendly turn, look up, wave

For fresh idle/done, off-duty and unavailable/unknown activity: friendly visual
acknowledgment, without claiming a live session. Begin head turn and arm lift on
the next rendered update. Total 1.55 seconds: 0-.25 turn/lift; .25-.45 settle
facing; .45-1.05 two small hand sweeps; 1.05-1.30 lower; 1.30-1.55 blend to valid
base activity. Feet/root position stay on the current floor; no walk to camera.
Standing free residents turn the root by shortest yaw, reaching front-facing in
<=.35 seconds; no full-circle spin. Head begins first even during a large turn.

Use right arm raised beside head (existing rig `armRz` roughly -2.1 to -2.5,
elbow roughly -.5 to -.8, adjusted for build). Forearm/shoulder sway +/-12 degrees
twice; mitten reads palm-out through thumb silhouette. No wrist bone is assumed.
Left arm relaxed. Small smile, no shout/open-mouth loop or jumping. Upper body
may lean back <=5 degrees. Seated/bath/lying residents keep a supported base:
turn head and upper torso immediately (torso <=25 degrees, head <=55 yaw), raise
the available hand, and do not spin hips through a chair or stand inside a tub.
If camera is behind supported seating, this bounded over-shoulder acknowledgment
is the safe variant; do not contort to force full face visibility.

### Working wave-off

Fresh observed `thinking`, `reading`, `editing`, `running`, `searching` and
`delegating` use a restrained "one moment" palm instead. Total .85 seconds:
0-.15 lift; .15-.40 one outward sweep of 10-15 degrees; .40-.55 hold palm out;
.55-.85 return to the exact current work pose. Hand stays below eye height,
beside the shoulder, away from monitor/keyboard. Root, chair contact, navigation
target and work station stay unchanged. Brief head glance <=20 yaw and 8 degrees
up; torso twist <=10 degrees. Other hand stays at its existing work contact when
possible. Neutral focused face, no scowl, finger wag, head shake or dismissive
speech. If the near hand is obstructed, use the other; if neither clears, use a
short head acknowledgment with a held low palm. Observed state/screen/plumbob
stay authoritative throughout; a running task never stops or pauses because of
the gesture. Busy reactions must not imply a provider interruption happened.

### Camera aim, arbitration and cleanup

Compute direction from the actual head/world position to the viewing camera,
including parent/lot rotation and upper-floor elevation. Convert world direction
to the rig parent's frame before deriving yaw `atan2(dx,dz)`. Look-up elevation
uses head-to-camera height and horizontal distance, not fixed world Y or a
hardcoded compass direction. For friendly response clamp upward pitch to about
30 degrees and downward pitch to 10; in the existing rig negative head X looks
up, with spine lean compensated. Eyes have no independent gaze rig: orient the
head. Camera directly overhead retains last valid yaw to avoid jitter. Track
camera gently during the hold; sample current camera transforms while focus
flies, avoid turning back and forth across +/-PI. No forced camera orbit/zoom.

Priority, high to low:

1. Removal, layout/floor invalidation and leaving clean up the overlay safely.
2. Waiting-for-user/error truth retains its urgent signal and existing pose.
   A click only adds a compatible brief glance if it fits; no busy wave-off and
   no masking the error/permission indicator, urgent wave or UI details.
3. New observed work cancels a friendly reaction on the next update and resumes
   work pose/route; never finish a friendly wave first. Work-state changes during
   wave-off update its underlying pose without preserving obsolete hand contacts.
4. Human care timing/held-prop safety and supported furniture contact constrain
   the click overlay. A pending care read keeps its server-owned timer/receipt;
   use free-hand acknowledgment, never complete/reward/cancel it by animation.
5. One bounded click overlay overrides compatible idle ambient joints.
6. Ambient home routines resume or replan only after that overlay has ended.

Classify "working" using fresh observed activity/connection evidence, not a
travel animation or green appearance. Stale/disconnected/unknown data cannot
justify a busy claim. Never write truth events for a click. Keep a transient
overlay separate from `activity`, `act`, `truth`, screen and selection state;
compose joint targets before the existing easing/apply stage so base animation
does not erase the gesture. A render delay is not a requirement to dispatch work.

Repeated clicks never queue gestures: update aim within the current envelope;
allow at most one restart after completion and .30-second cooldown. Do not
indefinitely extend a pose under rapid clicking. No accumulated yaw/arm offsets.

For disposable ambient scenes, use existing stopHomeActivity/dispose/release
paths to remove held objects, temporary furniture, reservations and borrowed pet
ownership as appropriate; do not manually detach only visible props. A resident
supported by temporary seating keeps that support through the short response,
then tears down/replans from a valid free same-floor spot. Bath/sleep/lie poses
use the supported variant rather than deleting support underneath the body.
Freeze scene choreography while using a free hand; do not run its hand IK or
prop sweep concurrently. If a hand remains occupied, acknowledge with the other.
No props through the head, floating books or premature care completion. Cleanup
must also run on truth change, unselect/removal, scene disposal and floor rebuild;
unselect may blend out, but cannot leave claims or pose offsets behind.

Reduced motion: orientation updates on the next frame with no spinning root;
one small palm raise, no oscillation, body bob or head nod. Friendly held palm
.45 seconds, working low palm .25 seconds; blend in/out <=.10 seconds. Preserve
seated support and urgent truth signals. No extra text toast or color-flashing
effect is needed; current selection UI continues to explain real status.

## Review requirements and limits for Olive

This pass edits documentation only. No meshes, runtime integration, fixture
town changes, tests, build or package verification were performed. Existing
Windows cache/signature blockers in NEXT_PASS remain unresolved; a documentation
pass does not require rebuilding the app or establish current package parity.

Before considering implementation report-ready, use isolated fixtures to render
all eight staff kinds at rotations 0/1/2/3, open/closed cutaways, move/remove/rebuild
and Town Hall coexistence; confirm exactly one staff per placement and zero new
resident/session metadata. Check every anchor and complete prop sweep, library
plinth foot height, civic seat/table height mismatch and control-room occlusion.
Stationary routines intentionally avoid missing interior doorway navigation.

Capture birds from top/side/three-quarter views at normal and close zoom, including
flap extremes/glide and daylight/night. At normal town zoom the body/head/tail
must separate from the wing silhouette; close view must have no open seams.
Review all working states, idle/off-duty/unknown/stale, waiting/error, repeated
clicks, moving camera, truth mid-wave, seated/lying/bath/held-prop care, rotated
homes and upper floors, plus selection/chat/Martin behavior and reduced motion.
Verify disposal/shared-material safety and bounded geometry/memory. Use actual
before/after evidence and relevant existing regression checks; run app:build
after application updates and separately verify signature and asset parity.

Uncertainties: proposed geometry and contact positions are source-grounded, not
rendered prototypes; arm angles need calibration across builds; the live overlay
prevented bird/interior assessment without interaction. No runtime performance,
all-angle collision, reduced-motion OS behavior or native package result is
claimed. One possible next pass is Olive's scoped integration and isolated visual
verification against this spec and the coordination plan; it is not launched or
approved here. No delegation, queue writes, acceptance, spending or publication.
