# Gameplay: customization and progression

Town Hall remains the first construction milestone. After it finishes, Mayor Martin
guides building a local project home and meeting its Personal Assistant owner. Each
new or imported home starts with one resident; saved identities and history remain
stored separately from active membership (`residentAgentIds`). Observation does not recruit.

New homes take five minutes to build. Their Personal Assistant becomes available
only when construction finishes. Projects and Mayor Martin show progress and a
Speed up build button with total remaining cost: one gem per minute, rounded up.
Home registration remains free, and previously completed homes are not rebuilt.
The foundation adds persistent home/agent IDs without changing XP prices or inventing
happiness. Recruitment, zoning and city services are subsequent passes. See
[FOUNDATION.md](FOUNDATION.md) for contracts and parallel engineer ownership.

Agent World's fun comes from making the world yours: decorating homes, dressing residents, shaping the
neighborhood, and watching projects' houses grow as you accept real work. It never comes from agents looking busy.

## Ground rules

1. **Observed work shapes *what exists*, by kind and never by amount** (changed 2026-10-05 with the human's
   approval). Roles come from the *kinds* of work agents were observed doing, each kind
   counted at most once per day. No rewards for tool calls, tokens, session counts or time running: that
   would reward waste and let an agent farm progress. Nothing decays and there are no streaks. Synthetic
   (fake demo) events never count outside demo mode. (The downtown businesses that grew from this were removed on 2026-10-14; buildings are placed by the player.) Gems still follow
   human decisions. Resident participation XP now determines home tiers and decor level eligibility.
2. **Rewards follow human decisions and play.** Only tasks you accept with review notes, outcomes you mark
   reached, and in-game play (exploring, decorating) count toward reviewed-work and play rewards. The
   user separately authorized participation XP for returned game responses. Agents still cannot accept tasks.
3. **Cosmetic only.** Customization lives in the simulation layer. It never hides, recolors or softens truth:
   plumbobs, bubbles, screens, "needs you", toasts and the roster stay legible in every style.
4. **No pressure mechanics.** No streaks to lose, timers, loot boxes or reward notifications. Approving a
   permission quickly earns nothing (no incentive to rubber-stamp).
5. **Local and separate.** Style and unlocks live in `~/.agent-world/style.json`, apart from observed events
   (`events/`), households and the task board (`productivity.json`).

## Civic buildings and roles

**Civic buildings** (`shared/town.mjs` `CIVIC`, `web/src/civic.js`, the Civic tool in `web/src/town-planner.js`). The fixed
downtown strip, its eight work businesses, the City census and street-life walks were removed on 2026-10-14: the
player places every building. Civic infrastructure unlocks by player level, one of each:

| Building | Player level | Plot (tiles, front × depth) | Inside |
| --- | --- | --- | --- |
| Fire station | 2 | 3 × 2 | Two engine bays with fire engines, lockers, the pole, crew table; hose tower |
| Police department | 3 | 2 × 2 | Front counter, desks, filing cabinets, two barred holding cells; patrol car |
| Library | 4 | 3 × 2 | Portico, shelves, reading tables with lamps, librarian's desk, globe; dome |
| School | 5 | 4 × 3 | Two classrooms off a locker hallway, second storey, bell tower; playground and court |
| Hospital | 6 | 4 × 4 | Reception, waiting rows, a ward of beds with curtains, nurses' station; four storeys, helipad, ambulance |
| City dump | 7 | 4 × 3 | A fenced yard of heaps and skips; weighbridge office; bulldozer and truck |
| Water tower | 8 | 2 × 2 | Pump house with pumps, valves and a control panel; the tank on its legs |
| Power plant | 10 | 4 × 4 | Turbine hall with two generator sets and a control room; cooling towers, stack, switchyard |

Homes are 3 × 3. A building's entrance is the middle of its front edge (for an even width, the tile right of
centre as seen from the street). Zoomed in, a civic building opens like a home: the roof and any upper storeys
lift away and the walls facing the camera drop (the Walls setting applies), and its halls stay dry in rain and
snow. The build list shows a rendered picture of each building (made once in the browser, `civicPictures`).

- Stored in `town.json` as `civic: [{ id, kind, i, j, rot }]` ((i, j) is the north-west tile). A building uses its own plot and the entrance rule above; homes, streets and other civic buildings can't overlap it, and removing a street can't cut it off from Main Street.
- The bridge checks the player level on `place-civic` (moving an already placed building never needs the level again) and accepts `remove-civic`. A level never drops a placed building.
- The dock's landmark button opens Plan town on the Civic tool, with the list of buildings (Place / Move / Remove, or the level that unlocks it).
- Scenery only: nothing about civic buildings reflects agent work.

**Roles** (`shared/city.mjs`). The bridge still folds observed events into a ledger of kinds of work by day
(`~/.agent-world/city.json`, categories only), which gives people their roles:
- A resident's **role** is their most common kind of work, by days (ties go to the most recent): Tester, Clerk, Shipper, Researcher, Designer, Writer, Analyst or Manager.
- **Helper types start as interns**. After working on 3 different days in a home they are **hired**: they get a stable staff name ("Eli · Explore helper") and a role of their own.
- Off-duty residents stay inside their home (a bed when they have one, otherwise an indoor spot; never the yard).

Ideas for later:
- Click a walker to see the made-up explanation.
- Hired staff working at their business's door.
- Rush hours on a city clock.

## Phases

### 1. Build mode and wardrobe (everything free)

- **Build mode** (`B` or the dock's hammer): pick a home, then place, move, rotate (`R`) and delete
  (`Delete`) decor on a 0.25 m grid. Indoor items go inside the room, outdoor items inside the fence.
  Placement must keep every desk, waiting spot, couch seat and the front door reachable; invalid spots glow red.
- **Paint:** exterior color, interior wallpaper and floor style per home.
- **Wardrobe:** per resident (and for your own picture in the top bar): skin tone, hair style and color, top style and color,
  pants, and an accessory (glasses, cap, beanie, headphones, flower).
- Functional stations (desks, chairs) stay put so the activity view keeps working.

### 2. Progression (gems, house levels, catalog): shipped

- **Gems** come from your first verified Codex or Claude Code connection, tasks you accepted with review notes, and reached outcomes. Work rewards are derived from your task history.
- **House levels** (Cottage, House, Villa, Manor, Estate) follow the combined resident XP
  in that home, capped at level 5. Residents earn participation XP from completed game responses.
  Higher levels unlock exterior upgrades and decor tiers for that home; outcomes still award gems.
- **Catalog:** basics stay free, nicer items cost gems, and milestone items are exclusive.
- A small in-world celebration plays when you accept a task. It is derived from your action, not from agent activity.

As built (`shared/progression.mjs`):
- **Gems:** +50 once for the first verified provider connection; +10 at most once per project per server-local calendar day for newly accepted tasks with review notes (accepted without notes earns 0; existing accepted credits are preserved); +25 per outcome you mark reached. Work rewards are recomputed from `productivity.json`; the connection grant and construction spending live in `gameplay.json`. Un-accepting removes that task's gems. Unlocked items remain owned, but a negative balance blocks new spending.
- **Levels:** pooled resident XP (home thresholds: 300, 750, 1,350, 2,100 total XP): Cottage, House (porch, awning, porch lights), Villa (garden arch, hedge), Manor (fountain, flag), Estate (lantern path, golden plumbob statue). Shown on the house sign. An empty home starts at level 1.
- **Marking an outcome reached:** Work → Now → *Reached*, which needs a confirmation checkbox (`POST /api/milestone`, `confirmed: true`). *Undo the last one* corrects mistakes.
- **Catalog:** 10 free basics. Others cost 10 to 60 gems; aquarium, record player, snack fridge, bird bath and picnic table need a House, and the arcade needs a Villa. Unlocks are global (`style.unlocks`) and validated server-side against the derived balance. New placements must be unlocked and fit the home's level. Decor already in place is never removed.
- **UI:** the gems chip opens a Progress panel (balance, rules, homes and levels, a ledger with provenance). Confetti and a toast play when you accept a task; fireworks when a home levels up. These only trigger on live changes, never on page load.

### 3. Neighborhood: shipped

- Map mode: arrange houses and name streets.
- Public spaces unlocked by neighborhood milestones (park, plaza, café). The Town Hall is the first timed build, introduced through Mayor Martin's animated 3D game character. His initial dialogue is scripted; a verified provider claim links the town even if the CLI was already signed in. Observed agent data remains saved but residents, homes and downtown activity stay hidden until that claim, which does not create an observed work session. The active site has animated builders and a crane, with a countdown sign that opens build details.
- Pets per home (flavor), seasonal themes and weather.
- Exploration collectibles found while looking around (click to collect) (seed packets, gnomes, rare plants), unrelated to agents.

As built:
- **Map mode** (`M` or the map button; `web/src/mapmode.js`). A north-up, top-down view fitted to the viewport. Click a house, then any plot, to move it; houses on both plots swap. An empty row is always offered, and the camera refits when rows are added. Click a street name to rename it (40 characters max). Saved as `style.layout` (plot order) and `style.streets` (row to name). The server accepts only known homes, each placed once.
- **Town square** (`web/src/commons.js`), west of the first street. Open spaces come from `COMMONS` in `shared/progression.mjs`, counted across all homes:

  | Space | Opens at |
  | --- | --- |
  | Park | 1 reached outcome or 3 tasks |
  | Café | 5 tasks |
  | Plaza fountain | 3 outcomes |
  | Town Hall | 30 gems and five minutes of construction; finish now for 1 gem per remaining minute, rounded up |

  "Tasks" means credited reviews: new credits are limited to one per project per day, and legacy accepted credits are preserved. The town hall holds one trophy per reached outcome, up to 10. Locked spaces show a signpost with the requirement; signs fade when the camera is over another street.
- **Pets** (Build mode, Paint tab): none, cat, dog or bunny, per home (`home.pet`). Pets wander the lot on the nav grid, nap, and come say hi when you zoom in close. They never stand in for an agent.
- **Seasons and weather** (cloud button in the dock; `web/src/seasons.js`). The season follows the calendar or an override. Weather is a seeded daily pick (or chosen) of clear, rain or snow. Foliage, ground and terrain are recolored; rain, snow and autumn leaves fall; sky and fog go overcast. The menu says it is ambience only, not a forecast.
- **Finds** (`shared/collectibles.mjs`, `web/src/explore.js`):
  - Four finds a day sparkle in yards, placed deterministically from the date and the homes. Walk within about 1.3 m to pick one up.
  - The server checks that the id is one of today's spawns and not already collected. The first of each kind unlocks a Found decor item: veggie patch, blue tulips, clover patch, crystal lamp or golden gnome.
  - Finds never give gems.
  - The Progress panel lists the town square, your finds and how many are left today.

### 4. Play and polish: shipped

- **Photo mode** (`P` or the camera in the dock; `web/src/photo.js`).
  - Hides the interface except truth alerts ("Needs you" and toasts stay visible).
  - Five looks (Natural, Warm, Cool, Mono, Film) are applied in the final grade pass, so a photo matches the screen. Tilt-shift is available at high quality.
  - `Space` takes a photo. The bridge saves it as a JPEG in `~/.agent-world/photos` (`bridge/photos.mjs`; JPEG only, 6 MB and 300 photos max, local origin only).
- **Album:** browse, download, delete (with a confirmation), or hang up to 4 photos on a home's back wall as polaroids (`style.gallery`). The server only accepts photos that exist, and deleting a photo takes it off every wall.
- **Gardens** (`shared/garden.mjs`, `web/src/garden.js`).
  - Place a free garden bed (Build mode, Garden), then zoom in on it to plant:

    | Crop | Grows in | Needs |
    | --- | --- | --- |
    | Tomatoes | 12 h | — |
    | Sunflower | 20 h | — |
    | Pumpkin | 2 days | a found seed packet |

  - The bridge stamps the planting time, so the client can't backdate it.
  - Crops show four stages and never wilt. Harvest whenever you like.
  - The first harvest of each crop unlocks Harvest decor: a tomato crate, a sunflower vase and a pumpkin stack.
  - Gardens never give gems.
- **Visuals** (`web/src/fx.js`). Ambience only; all effects are patched into existing materials, so draw calls don't change.
  - Foliage sways in the wind, more in rain.
  - Outdoor surfaces that face up get patchy snow, or a wet sheen with sky-tinted puddles. Rooms stay dry.
  - Ponds, fountains and bird baths share a rippling, reflective water material that ripples more in rain.
  - Rain splashes on the ground.

Deferred: a "sticker book" of first-seen activity kinds (could tempt users to make agents do things to collect).

Home progression now pools lifetime XP from every current resident in that home (unique slots, same project). Building thresholds are 300 / 750 / 1,350 / 2,100 total XP for House / Villa / Manor / Estate; fixed thresholds do not change with household size. Individual resident/player XP rules are unchanged. Rewards shows pooled XP and the remaining XP to the next home tier.

The six MP3s in `audio/` form the background soundtrack. Playback begins after a user interaction, shuffles every cycle, avoids immediate repeats between cycles and uses a quiet 20% volume. The existing Sound toggle controls music and chimes together and remembers mute. Assets are bundled by Vite into the Electron package; playback needs no external music service.
