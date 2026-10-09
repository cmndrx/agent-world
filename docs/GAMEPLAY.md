# Gameplay: customization and progression

Agent World's fun comes from making the world yours: decorating homes, dressing residents, shaping the
neighborhood, and watching projects' houses grow as you accept real work. It never comes from agents looking busy.

## Ground rules

1. **Observed work shapes *what exists*, by kind and never by amount** (changed 2026-10-05 with the human's
   approval). Downtown businesses appear from the *kinds* of work agents were observed doing, each kind
   counted at most once per day. No rewards for tool calls, tokens, session counts or time running: that
   would reward waste and let an agent farm progress. Nothing decays and there are no streaks. Synthetic
   (fake demo) events never count outside demo mode. Businesses also **upgrade by use**, which the human
   asked for and is measured in different days of that kind of work, never volume. Gems, home levels and
   catalog unlocks still come only from human decisions (rule 2).
2. **Rewards follow human decisions and play.** Only tasks you accept with review notes, outcomes you mark
   reached, and in-game play (exploring, decorating) count. Agents cannot accept tasks
   (`skills/agent-world` refuses it), so they cannot earn rewards for themselves.
3. **Cosmetic only.** Customization lives in the simulation layer. It never hides, recolors or softens truth:
   plumbobs, bubbles, screens, "needs you", toasts and the roster stay legible in every style.
4. **No pressure mechanics.** No streaks to lose, timers, loot boxes or reward notifications. Approving a
   permission quickly earns nothing (no incentive to rubber-stamp).
5. **Local and separate.** Style and unlocks live in `~/.agent-world/style.json`, apart from observed events
   (`events/`), households and the task board (`productivity.json`).

## City (downtown)

`shared/city.mjs`, `web/src/downtown.js` and `web/src/census.js`. The bridge folds observed events into a ledger of kinds of work by
day (`~/.agent-world/city.json`). It is a union with what it rebuilds from `events/`, so deleting event files
never removes buildings. The ledger keeps only categories, never file names, paths or commands.

| Kind of work (observed) | Business |
| --- | --- |
| Running tests | QA lab |
| Using git | Post office |
| `git push`, deploy or containers | Shipping depot |
| Searching the web | Library |
| Editing frontend files (needs the "targets" privacy level) | Design studio |
| Editing docs (needs "targets") | Print shop |
| Notebooks, CSV, SQL or a database | Research lab |
| Starting helper agents | Coworking space |

- Each business goes from a surveyed lot (day 1) to construction (day 2) to open (day 3), on any days; nothing is lost by waiting.
- Main street fills in the order each kind of work first appeared, so cities differ by player.
- Every building has a "why it's here" card, and the City census (the building button in the dock) explains the rules.

**People and jobs** (step 3, shipped):
- The bridge attributes each event to a person: a resident (home + desk slot) or a helper type (home + what it was delegated as, e.g. "Explore").
- A resident's **role** is their most common kind of work, by days (ties go to the most recent). Tester, Clerk, Shipper, Researcher, Designer, Writer, Analyst and Manager each map to a downtown workplace.
- (Work clothes were removed on 2026-10-09; roles no longer change what a resident wears.) Roles previously showed as an apron in the workplace color (darkened when it's close to the shirt color, and placed below the provider badge), plus a role card in the inspect drawer that explains why. The wardrobe can hide the work clothes per resident (`uniform: false`).
- **Helper types start as interns** (a lanyard with an ID card). After working on 3 different days in a home they are **hired**: they get a stable staff name ("Eli · Explore helper"; the observed helper type stays visible) and a role of their own.
- The City census lists everyone's job.

**Upgrades by use** (step 4, shipped). The more different days a business's kind of work happens, the bigger it gets:

| Tier | Days of use | What changes |
| --- | --- | --- |
| Open | 3 | The storefront |
| Expanded | 7 | A second floor |
| Flagship | 14 | Three floors, a rooftop billboard and flags |
| Landmark | 30 | Its own building |

The eight landmarks:

| Business | Landmark |
| --- | --- |
| QA lab | Glass testing tower |
| Post office | Clock tower post office (the clock shows local time) |
| Shipping depot | Freight terminal with containers and a gantry |
| Library | Grand library with columns and a dome |
| Design studio | Art gallery with a rainbow sculpture |
| Print shop | Newspaper building with a lit marquee |
| Research lab | Observatory |
| Coworking space | Innovation hub with terraced gardens |

- An upgrade that happens while you're watching gets quiet confetti and a toast, with no sound.
- Signs show the tier and the days to the next one, and the census shows progress bars.

**Street life** (step 5, shipped; made up). `web/src/streetlife.js`.
- While a resident's agent is off duty and their workplace is open, they sometimes walk from home to the business door and back:
  - along their row's sidewalk, through the east gap (x = 64) for later rows, then along main street;
  - they wait about 40 seconds before leaving, stay 45–95 seconds, and rest 2.5–5 minutes afterward;
  - at most 4 walkers at once.
- While away, the real Sim stays at home hidden and keeps simulating. A walker figure in the same look walks with a dashed "Just for fun · their agent is off duty" tag.
- **Truth wins at once.** The moment a session attaches (or you select the resident), the walk ends and the real Sim is visible at home, going to its desk.
- Toggle it in the Walls menu under "Street life" (`settings.streetLife`). It's paused in Build and Map mode.

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
- **House levels** (Cottage, House, Villa, Manor, Estate) rise when you mark a project's
  outcome reached. Higher levels unlock exterior upgrades and decor tiers for that home.
- **Catalog:** basics stay free, nicer items cost gems, and milestone items are exclusive.
- A small in-world celebration plays when you accept a task. It is derived from your action, not from agent activity.

As built (`shared/progression.mjs`):
- **Gems:** +50 once for the first verified provider connection; +10 at most once per project per server-local calendar day for newly accepted tasks with review notes (accepted without notes earns 0; existing accepted credits are preserved); +25 per outcome you mark reached. Work rewards are recomputed from `productivity.json`; the connection grant and construction spending live in `gameplay.json`. Un-accepting removes that task's gems. Unlocked items remain owned, but a negative balance blocks new spending.
- **Levels:** 1 + outcomes reached (capped at 5): Cottage, House (porch, awning, porch lights), Villa (garden arch, hedge), Manor (fountain, flag), Estate (lantern path, golden plumbob statue). Shown on the house sign.
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
  | Town Hall | 30 gems and five minutes of construction; 5 gems expedites one minute |

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
