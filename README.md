> **Provider accounts:** Mayor Martin offers in-game sign-in for both Codex and Claude Code. Later, open Connections → Codex account or Claude Code account to see the CLI-reported email, authentication method and plan (when available), sign in, or Sign out. Signing out clears that provider’s CLI credentials on this computer, keeps projects/chats and historical town rewards, and is blocked while its approved, queued, running or interrupted game work remains. It does not promise to sign out desktop or browser sessions. Account details appear only in the local no-store account response; credentials, OAuth output and private codes are never returned or saved by Agent World. Codex linking now checks account authentication independently of usage/quota availability.

> **Chat composer:** conversation rows show names only. While a game prompt is active, an empty composer shows a square Stop button; typing switches it to the Send arrow. Sending a follow-up queues that exact message behind current work and continues the same owned conversation. Clearing the draft restores Stop. Queued messages stay visible, and a run must establish its conversation before dependent messages can execute.

> The main overlay no longer shows the yellow **Needs you** tag or the waiting-agent cards beside it. Click a resident in the world to open Watch activity and chat.

> **Agent-owned chats:** clicking a resident keeps that resident as the prompt recipient. Its prompter lists only its recorded and observed conversations, separated by provider. Send resumes the selected owned thread; New chat creates a conversation for that same resident. The API rejects another resident's thread, and game-launched observed activity stays with the requested resident. Earlier app messages are still not imported. Existing duplicated run history is preserved; the first recorded owner wins. Saved app links without an observed resident remain in Connections → Chats.

> The main overlay omits the chat, Prompt agent and All homes buttons. Open chat from an agent's activity view; open the conversation library through Connections → Chats or a home's shelf.

> Project cards show the project title and agent rows. Their Conversation shelf and Plan & briefing footer buttons have been removed.

> **Watch activity:** shows status, the animated screen, details and recent steps. The conversation card with Open in Codex and Shelf buttons has been removed from this view.

> **Rename chats:** use Rename beside a recorded chat in the prompter, edit its name and choose Save name (or press Enter). Cancel/Escape discards the edit. Names are saved locally in Agent World and shared with the conversation shelf; the original Codex app title is unchanged.

> Current primary workflow: click an agent to open **Watch activity**. Click the status card, **Prompt this agent**, or the animated screen to open chat for that observed conversation. Finished-turn attention entries open chat directly. Chat shows recorded message pairs, a conversation list and a pinned composer; **Enter** sends and **Shift + Enter** adds a line. Each game-launched reply automatically expands **Reasoning · live** for public Codex summaries during the run; arriving sections accumulate there and remain as **Reasoning summary** after completion. Command/file steps stay in **Watch activity**. Private internal reasoning is never imported; summary availability depends on the model. **New chat** starts fresh. Closing chat returns to Watch activity; sending keeps chat open while work runs. Returned reports appear in chat; the separate Results & history modal is removed. The lower-left **Account usage** button in chat and **Connected app usage** in Connections shows Codex account remaining percentages and reset times from the official read-only account endpoint. Unsupported or unavailable sources show no assumed balance. Errors remain inline, with no floating pass notices. Earlier app messages are not imported.

> Live Codex account usage is available after restarting the updated bridge. Each chat shows its last observed model. Use the model pill inside the composer (its menu opens upward) to choose **Next message model** to change the model when sending; **Keep conversation model** retains the existing choice. Preferences are per chat for this browser session, and never change a running turn. Claude usage and model selection remain unavailable.


# Agent World

**Claude action approvals:** the Claude composer defaults to **Ask for edits & commands**.
File edits and shell commands pause on an exact-action card with **Allow once / Deny**.
Choose **Allow edits this run**, **Allow edits & commands this run**, or **Read tools only**
for the next message. **Full access this run** is a separate explicit choice: Claude uses
its `bypassPermissions` mode and the private task browser skips per-action click/fill approvals.
It applies only to the prompt you send; Stop still terminates the run. No global settings are changed.
The other access choices retain configured Claude deny/ask and sandbox rules. Denial or a three-minute
expiry blocks subsequent edit/command requests in that run; **Stop** revokes pending actions
and terminates the process. Denied/stopped runs earn no XP and are not retried automatically.
A valid same-session failure report stays visible without next passes or handoffs. A successful,
acknowledged StructuredOutput tool report is also captured when the final CLI event omits it.
Exact approval arguments are transient and are not added to canonical events or saved chat state.

**Player-led care test (October 11):** Click a resident and scroll to Character.
Residents receive two persistent interests drawn from Encouragement, Snacks and
Reading; Choose interests allows one to three. Happiness starts at 50/100. Praise
and Give snack add 3 happiness, plus 5 when the interest matches. Read a book adds
5 after a ten-second simulated activity, requires Reading, and is interrupted by
real agent work. Each fulfilled action has a thirty-second cooldown. Free snacks
are an immediate simulated interaction without a consumption animation or inventory.
The history explains changes. No decay, autonomous gains, provider prompts, XP
changes or spending are included. The updated bridge and refreshed client must
both be loaded; rebuilding alone does not update running processes.

For a disposable town with provider execution disabled, after building run
`node scripts/care-fixture.mjs` and open http://127.0.0.1:4793. Its gameplay and
provider home are isolated under the system temporary directory; no real events
are invented. Stop the fixture server when finished. See
[the proposal](docs/INTERESTS_HAPPINESS_PROPOSAL.md) for later scope.

Local project imports start with one Personal Assistant owner, including projects
with saved teams or multiple observed sessions. Saved identities and history are
retained; `residentAgentIds` controls spawning, delegation and execution eligibility.

Temporary development Reset opens a confirmation modal, backs up town metadata,
clears Town Hall/home selection/customization and pauses future schedules. It keeps
project files, saved identities and chat/work history; queued/running work or live
voice/app connections prevent reset. Town Hall speed-up finishes the entire build
for 1 gem per remaining minute (rounded up), with the total shown on the button.

**Town Hall first, then your home (October 10):** Finish Town Hall construction with
Mayor Martin before building a local project home. Martin then helps you choose an
existing project or create a new one, and meet its Personal Assistant owner. New
homes start with one resident; existing households keep their residents and history.
New imported/created homes use the project registration flow, then five minutes of
construction. Home registration remains free; Speed up build finishes the remaining
time for 1 gem per minute, rounded up. One Personal Assistant moves in at completion.
Existing completed homes remain ready; re-import does not restart saved timers.
Recruitment and city services follow later.
Stable agent/home IDs and the parallel engineering contracts are documented in
[docs/FOUNDATION.md](docs/FOUNDATION.md). This supersedes automatic starter-team creation.

**Home levels:** each home's building tier follows its combined resident XP, capped at level 15: Cottage → Family House → Duplex → Townhouse Row → Small Apartment Building → Apartment Block → Residential Tower → Landmark Residence. Existing resident XP applies immediately. Returned game responses can upgrade the building and its decor eligibility; reached outcomes continue awarding gems separately.

**Agent and player XP:** completed game responses award 25 XP to the responding resident and to you. The top-bar level badge opens Levels & experience; resident chats show their own level, XP bar and points remaining. New responses show an XP notification, with level-up notices at increasing thresholds (100, then 150, then 200 XP). Existing saved responses count once; app restarts, archived chats and provider changes do not duplicate awards. Participation XP is independent from reviewed task rewards; home levels pool current residents’ XP.

A low-poly, Sims-style world that **visualizes** the AI agents already working on your machine.
Its activity layer watches the events agents leave behind and turns them into
characters walking to desks, bookshelves and terminals. A separate runner executes explicitly approved passes. See [CONCEPT.md](CONCEPT.md) for the design.

Works with any provider: Claude Code (hooks), Codex/ChatGPT (log tailer), and anything that can append a line of JSON.

## Quick start

```bash
npm install
npm run demo      # fake agents in an isolated home (.demo-home/); open http://localhost:5177
```

Watch your real agents:

```bash
npm run hooks:claude            # print the Claude Code hook config (changes nothing)
npm run hooks:claude -- --apply # add it to ~/.claude/settings.json (backup saved alongside)
npm run dev                     # bridge + Codex tailer + client on http://localhost:5177
```

Codex needs no setup. `npm run dev` tails `~/.codex/sessions` automatically (`npm run codex` runs only the tailer).

Remove the hooks any time with `npm run hooks:claude -- --remove`.

`npm start` / `yarn start` builds the client and serves it at http://127.0.0.1:4777/. If a normal Agent World instance already serves that address, startup reuses it without launching another observer or runner. Other port conflicts stop before starting child processes. Dev/demo and custom-home launches require a free port; check for approved, queued or running work before stopping an existing server.

## Desktop app (Electron)

**Applying source updates to the desktop app:** Every application code or UI update must include `npm run app:build` and package verification. the packaged app contains a snapshot of this checkout. Editing source or running `npm run build` does not refresh an already-running packaged app. After checking that no work is queued or running, quit Agent World, run `npm run app:build`, then reopen `release/mac-arm64/Agent World.app`. For checkout development, quit the packaged app and use `npm run app` instead. An existing bridge may be reused, so ensure the bridge also runs the updated code.


The same build as `npm start`, in its own window. The app starts the bridge (serving `dist/`) and the Codex tailer with Electron's bundled Node, so it doesn't need a separate Node install, and it stops them when you quit.

```bash
npm run app        # build the client and open the app from this checkout
npm run app:demo   # same, with fake agents in an isolated home (~/Library/Application Support/Agent World/demo-home)
npm run app:build  # package release/mac-arm64/Agent World.app (ad-hoc signed, not notarized)
```

- It uses `~/.agent-world` and port 4777 like `npm run dev`. If Agent World is already running (`npm run dev` or `npm start`), the app opens that instead of starting a second bridge over the same data.
- Opened from Finder, it borrows your login shell's `PATH` so approved passes can find `codex` and `claude`.
- Links to other apps and sites open outside the window. Logs are in `~/Library/Logs/Agent World/agent-world.log`.
- Electron is pinned to 39.x and electron-builder to 26.8.0 because newer releases need Node 20+ to install.

## Look and feel

- **Rendering:** ACES tone mapping, ambient occlusion (GTAO), bloom on emissive things only (plumbobs, lamps, screens), a tilt-shift "miniature" blur that grows as you zoom out, and a final color grade.
- **Time of day** follows your local clock: sunrise, golden hour, moonlit nights with lit windows and street lamps. You can preview other times from the dock.
- **Graphics:** High, Medium, Low, or Auto (starts high and steps down if the frame rate drops).
- **Walls:** Sims-style cutaway lowers walls that face the camera; you can also choose walls up or walls down.

## Controls

| Input | Action |
|---|---|
| Drag | Move around the map (there's no walking avatar) |
| `W` `A` `S` `D` / arrows | Pan (hold `Shift` for faster) |
| `Q` / `E`, dock arrows, or right-drag | Rotate (drag up and down to tilt) |
| Scroll | Zoom. The home in the middle of the screen lifts its roof as you get close; cutaway walls do the rest |
| Double-click a home | Glide in and look inside |
| Click a Sim, or `Space` for the one in view | Inspect: truth (observed events) vs. simulation (flavor) |
| **You** (top bar) | Your picture; click it to change your look |
| Edge arrows | Fly to agents waiting on you |
| Your agents (left panel) | Every agent with its status (Working, Needs your OK, Idle, Off duty, Traveling…) and when it was last seen; click one to fly there |
| Dock | Time of day, walls, graphics quality, sounds, help |
| 🔔 (dock) | Toggle chimes: ding-dong for permission/questions, a gentle ping if still waiting after 2 min |

The tab title shows how many agents are waiting, e.g. `(2) Agent World`.

## Customize your world (just for fun)

Everything here is cosmetic and never changes what is shown as true about agents. The rules and roadmap are in [docs/GAMEPLAY.md](docs/GAMEPLAY.md).

- **Build mode** (`B` or the hammer in the dock): choose a home, then place decor from the catalog (plants, lighting, rugs, seating, furniture, fun stuff, garden). Click to place, `R` to rotate, right-click or `Esc` to stop. Click a placed item to move, rotate or remove it. WASD pans the camera while building. Placement keeps every desk, waiting spot and doorway reachable; blocked spots show red with a reason.
- **Paint** (build mode, Paint tab): outside walls, wallpaper and floor style per home.
- **Wardrobe:** the shirt button in a resident's inspect drawer, or the **You** picture in the top bar (or the shirt in the dock) for your own look. Skin tone, hair, top, colors, shoes and an accessory, with a live preview.

Style is saved in `~/.agent-world/style.json`, separate from observed events and your task board.

**Mayor Martin and the Town Hall.** On your first visit, Mayor Martin appears as an animated 3D character in the town and speaks to you as Governor. Even if a CLI is already signed in, choose Codex or Claude Code in his dialogue to link that provider to the town and claim **50 gems**. Existing observed sessions and project history remain saved, but residents and their homes stay out of the game until this link is made. Before that claim Martin is a game character, not an attached AI session; his introductory lines are scripted. Build the Town Hall for 30 gems; construction takes five real minutes. A crane and hard-hat crew animate at the site, whose countdown sign opens the construction dialogue. Spend 5 gems to shorten the build by one minute. The link, build and gem spending persist in `~/.agent-world/gameplay.json`. Reopen the conversation by clicking Martin, the Town Hall sign, or Play → Mayor Martin.

**Progress (gems and home levels).** Click the gems chip in the top bar.
- Earn **+10 gems** at most once per project per local calendar day for new tasks you accept *with review notes* (existing accepted credits are preserved), and **+25** when you mark a project's outcome reached (Work → Now → *Reached*, with a confirmation).
- Homes level from pooled resident XP across eight tiers. Reached outcomes award gems separately. New building designs remain concept art for a later modeling pass.
- Spend gems in Build mode to unlock nicer decor. Some items also need a higher home level.
- Work rewards are recomputed from your board. Agents cannot grant gems by doing work or looking busy.

**Civic buildings: you build the city.** There is no automatic downtown. As your player level rises, city infrastructure unlocks and you place it yourself in Plan town (the landmark button in the dock, or tool `5`):
- Fire station (level 2), Police department (3), Library (4), School (5), Hospital (6), City dump (7), Water tower (8) and Power plant (10). One of each.
- Each has its own size (a 2 × 2 police station or water tower up to a 4 × 4 hospital or power plant; homes are 3 × 3), with its entrance on a street connected to Main Street. Move it with Move or the list, turn it with `R`, and remove it from the list (it can be placed again later).
- Zoom in and a building opens like a home: the roof lifts off and the near walls drop, showing its interior (engine bays, holding cells, classrooms, a hospital ward, turbines…).
- The list shows a picture of each building.
- They're scenery: nothing about them reflects agent work.

**Roles.** Residents get a job title (Tester, Designer, Researcher and so on) from the kind of work their sessions do most, counted once per day. Helper agents start as interns; a helper type that works in a home on 3 different days is hired and gets a name. Off-duty residents stay inside their home.

**Photos and gardens.**
- **Photo mode** (`P` or the camera in the dock): the interface hides, but alerts stay visible.
  - Pick a look with `1`–`5`, toggle tilt-shift with `T`, and press `Space` to take a photo.
  - Photos are saved locally in `~/.agent-world/photos`.
  - In the album you can download photos, delete them, or hang up to four on a home's wall.
- **Gardens:** place a garden bed in Build mode (Garden), then zoom in on it to plant tomatoes, sunflowers or, with a found seed packet, pumpkins.
  - Crops grow over real hours and never wilt.
  - Your first harvest of each crop unlocks a decor item in the Harvest catalog.
- **Weather you can see:** trees sway in the wind, roads get wet and shiny in rain, snow drifts build up outdoors, footprints show in snow, and ponds ripple.

**House styles.** Each home has an architecture style: cottage, craftsman, modern or red barn. Roofs show when you zoom out and lift away as you zoom in, so you can always see inside. Change it in Build mode, Paint tab, House style.

**Neighborhood.**
- **Plan town** (`M` or the map button): draw and remove streets, move or turn homes, and rename streets on a grid. See [Town planning and project permits](#town-planning-and-project-permits). Decorating a home's interior stays in Decorate (`B`).
- **Town square** (west of the first street): build the Town Hall with Mayor Martin. The park, café and plaza fountain open as your homes reach outcomes and you accept tasks with review notes. The Progress panel shows what each one needs.
- **Town Hall** (`web/src/town-hall.js`): a domed civic hall at the head of the square. Outside: a stone podium with grand steps, a six-column portico under a pediment with the town seal, two wings, a balustraded roof, and a drum and dome with a clock, lantern and gold finial; a forecourt with lamps, hedges, flower beds and flagpoles. Zoom in and the roof and dome lift away, the walls facing you lower and the partitions drop, showing five rooms: the entrance lobby (clerk's counter, benches, notice board), the domed rotunda with a model of the town, the records archive, the council chamber (a curved councillors' bench on a dais, a lectern and public benches), and Mayor Martin's office (his desk under the flags, visitor chairs, a fireside corner and the trophy cabinet with one cup per outcome you've reached). Martin walks up the steps, through the opening front doors and along the lobby to his desk. The hall's lit windows use their own materials, so nothing else in town glows with them. Scenery only: the hall never reflects agent activity.
- **Pets:** Build mode, Paint tab. Each home can have a cat, a dog or a bunny.
- **Seasons and weather** (cloud button in the dock): follow the calendar or pick a season, plus clear, rain or snow. Ambience only.
- **Finds:** a few collectibles sparkle in yards each day. Click one to pick it up. Your first of each kind unlocks a special decor item in the Found catalog. Finds never give gems.

## Town planning and project permits

Agent World borrows SimCity's road-first planning (streets create frontage, homes face a street, the network grows out from the entry street) and SimCity BuildIt's grid placement (snapped, rotatable footprints with a clear valid/invalid preview). The art, buildings and interface stay Agent World's own. A home is a real project and its residents are agents you recruited explicitly: planning never creates agents or projects, never starts provider work, and streets, parked cars and street life are scenery that say nothing about real activity.

**Permits.** Your player level sets how many projects can be active, and every active project has exactly one home: levels 1, 2 and 3 allow 1, 2 and 3 projects, then one more every two levels (level 5 → 4, 7 → 5, 9 → 6, …). Player XP is unchanged (25 per completed game response; going from level *n* to *n* + 1 takes 100 + 50·(*n* − 1) XP). A permit is capacity, not an item or a currency: homes under construction count, and removing a project frees its permit. The Projects drawer in Plan town shows *active / allowed* (the permit card), the next permit's player level and the exact XP remaining. At capacity, Build home and Existing project are locked with that explanation; you can remove a project or **Replace** one (the replaced project leaves only when the new home is confirmed, so the town never exceeds its permits). The bridge enforces this on every create, import and activation request, one at a time behind a lock, so simultaneous requests can't exceed capacity.

**Add project.** In Plan town's Projects drawer, **Build a home** → choose **Import existing project** (a local Codex project) or **Create new project** (name and folder) → Plan town opens in **Place home** with a ghost footprint on the best free plot → move it, press `R` to turn it, and click a plot (green marks show eligible frontage on connected streets) → **Build home here**. Only then is the folder/project created or imported, the project activated and home construction started; the bridge rechecks capacity and the plot first. Escape or Cancel changes nothing and uses no permit. If a new folder was created but a later step fails, the message says where the folder is; it is never deleted.

**Plan town tools** (hotkeys `1` Road, `2` Bulldoze, `3` Move, `4` Place, `5` Civic; `R` rotate/flip, `Enter` confirm, `Esc` cancel, `M` leave; drag or WASD pans anywhere on buildable land). Draw road (click a start tile and an end tile; one 90° turn that follows the longer leg first, `R` flips it; new streets must join an existing one; basic streets are free), Remove road (a straight stretch; Main Street stays and no home may lose its connection; affected homes are outlined red with the reason), Move building (pick a home, choose a plot, `R` to turn, confirm) and Place home (only while adding a project). Every action is a preview until Confirm or Enter; Escape cancels the preview, then leaves. Click a street sign to rename the street. Previews show green new street tiles, blue existing ones (crossing a street makes an intersection), red blocked tiles with the reason, the home's reserved footprint and its entrance arrow.

**Placement rules** (shared/town.mjs, used by the preview and again by the bridge): the whole footprint on buildable land; no overlap with streets, other homes, civic buildings or protected civic land (the town square with the Town Hall, and Main Street itself); the entrance faces a street tile; that street connects to Main Street.

**Inactive projects** stay saved (folder, Codex entry, households, residents, chats, runs, XP and decor) but leave the town: no home, roster, chats, prompts, schedules or delegation through the game, and observed activity never re-activates them or uses a permit. Removing a project pauses its schedules and cancels its queued prompts (recorded as cancelled). If game work, a voice call or an app connection is still running there, the project stays (marked *leaving*, starting nothing new) until that work settles, then leaves on its own; **Keep** cancels the removal.

**Saves over capacity** (more active projects than your level allows) keep every project, home and record. The Projects drawer in Plan town opens and asks you to choose which projects stay active; until you choose, no project starts new work (running work continues). The others then leave as above. Agent World never chooses for you.

**Moving a home** keeps its identity: project, residents, chats, history, XP and test-level adjustments, decor, paint, gardens, construction timer and upper-floor seats all live in lot-local coordinates and move and turn with it.

## Live provider status

The overlay Live button counts **distinct activity observers** (0, 1 or 2), separately from attached sessions. Click it for each provider's status and the supported meaning. Codex is connected while its log tailer has a readable sessions directory and a fresh five-second heartbeat (expires after 20 seconds, or when its process exits). Claude Code is connected for 30 seconds after a supported Agent World hook runs; SessionEnd clears that session's contact. Multiple contacts from one provider count once. Quiet Claude sessions can expire while still open because hooks do not provide a persistent health channel.

The bridge sends health every two seconds; a disconnected bridge or ten seconds without fresh health makes the count unavailable. Reconnection loads current evidence. Contacts are separate files under `AGENT_WORLD_HOME/connections`, never activity events or queue records. Installation, saved chats, authentication and historical/successful turns do not establish this status. This checks local observer contact, not cloud availability, desktop-app presence, account entitlement or an authenticated live session. Existing hooks must point to the updated adapter; no hook installation or authentication changes are made automatically. Demo agents do not establish provider connections.

## Projects and conversations

Open **Connections → Chats**, or click **Conversation shelf** on a home. Search by title, app or conversation ID; **Find resident** takes you to the person currently working on a conversation. Earlier observed conversations remain saved after their sessions end. The same residents pick up later conversations.

Expand **Add an app project or saved chat** to:

1. Register a ChatGPT or Claude project by pasting its project link and entering a display name. Choose a new home or explicitly link it to an existing one.
2. Paste a direct conversation link (`https://chatgpt.com/c/<id>` or `https://claude.ai/chat/<id>`) into a saved chat. Select its registered project, or leave it in that app's **Unsorted chats** home. ChatGPT project-scoped conversation routes are accepted too.
3. Optionally enter a title and check the consent box to save it locally. **Name conversation** lets you label observed coding conversations as well.

**Saved app chats are links, not a live connection to your account.** They show “current activity unavailable,” have no working resident and never trigger “needs you.” The existing adapters observe Claude Code and Codex, including coding sessions launched through their desktop apps. Ordinary ChatGPT and Claude chat activity needs an additional observer; it is not inferred from saved links.

Conversation links open the original website. Conversation content is not imported. The shelf and app project links live in `~/.agent-world/conversations.json` and stay out of the repository.

Custom observers can include `conversation: { id, title, url }` and `project_name` in canonical events. Use `project: "chatgpt:<registered-project-id>"` or `"claude:<registered-project-id>"` to honor explicit home links. Titles from adapters are removed before disk writes unless `conversationTitles` is explicitly `true`; legacy events fall back to a neutral conversation ID label.

## Work

Open **Work** in the top bar or click a house sign. Pick a home from the chips at the top.

- **Now:** the home's outcome and next step (✎ Edit, ⚑ Reached), then **Needs you** (one row per request with its one useful action: Open the chat, Copy ID, Show the resident, or Review), **Up next** when nothing needs you, and **Changed since last check** (collapsed). The footer counts accepted, in-review and blocked tasks; **Mark caught up** acknowledges what's shown and never dismisses open requests. Requests in other homes are one tap away. No uncollected chat content is summarized.
- **Tasks:** **Planned → In progress → Needs review → Accepted**, with counts on one line and lists only for stages that have tasks. Stages are your decisions; an agent finishing a turn never advances a task.
- **Reviews:** tasks marked Needs review, with compact summaries and expandable evidence. Accepting requires ticking “I reviewed this and accept it.” Recorded outputs are your notes, not proof that tests passed or work is correct.
- **Focus** (★): quiets routine finished-turn pings from other homes; questions, approvals and errors still show.

- **Work loop:** compare human-entered sessions with and without Agent World. Record notice/resume times, board upkeep, rework and review backlog. Missing values stay unknown; paired comparisons require the same project and pair name. Data stays in browser local storage (last 100 sessions) and can be exported or the last entry undone. No improvement is claimed without observations. See [the pilot report and protocol](docs/WORK_LOOP_REPORT.md).

Accepted tasks, review backlog and blocked task counts reflect your board; there is no activity-based productivity score. Live signals are labeled separately from your plan. A disconnected bridge makes activity stale, not complete.

Plans, tasks, acceptance timestamps and briefing checkpoints persist in `~/.agent-world/productivity.json`. Focus is a viewer setting in browser local storage. Everything is local: no task instructions or prompts are sent to agents. Ordinary ChatGPT/Claude saved chats still cannot establish current activity.

## How it fits together

```
Claude Code hooks ──┐
Codex log tailer  ──┼──► ~/.agent-world/events/*.jsonl ──► bridge (truth) ──SSE──► client (simulation)
your own script   ──┘
```

Sims find their way around furniture with A* on a per-lot grid (`web/src/nav.js`) and use the front door.

- **`adapters/`** turn provider-specific signals into canonical events (`shared/schema.mjs`).
- **`bridge/`** tails the inbox, keeps the truth model (households, slots, live sessions) and streams it.
- **`web/`** is the Three.js client. It renders lots and Sims, and adds flavor only when truth leaves room.

## Write your own adapter

Append one JSON object per line to `~/.agent-world/events/<source>-<session>.jsonl`:

```json
{"kind":"state","source":"my-bot","provider":"local","session":"run-42","project":"/abs/path/to/repo","state":"editing","detail":{"target":"src/app.ts"}}
```

States: `idle`, `thinking`, `reading`, `editing`, `running`, `searching`, `delegating`,
`waiting_for_user`, `error`, `done`. Start with `"kind":"session_start"` and finish with `"kind":"session_end"`.
Set `parent_session` to show a sub-agent as a visitor. `adapters/fake-agent.mjs` is a working example.

## Configuration

`~/.agent-world/config.json` (optional):

```json
{ "privacy": "targets", "conversationTitles": false, "staleAfterMinutes": 180 }
```

- `privacy`: `state` (states only), `targets` (+ file/command names, the default), or `full` (+ prompt text).
  Adapters apply it **before writing**, so redacted data never touches disk.
- `conversationTitles`: explicitly set `true` to allow adapter-provided conversation titles. Defaults to `false`, independently of the detail privacy level. Manually saved titles require consent in the library.
- `staleAfterMinutes`: a session with no events for this long is treated as gone.

Character names live in `~/.agent-world/households.json`. Rename Sims from the inspect panel.

## Development

### Agent guide and continued work

The shared [Agent World skill](skills/agent-world/SKILL.md) teaches navigation, project planning, attention triage, evidence recording and next-pass handoffs. Codex discovers it through `.agents/skills/agent-world` (invoke `$agent-world`); Claude Code discovers it through `.claude/skills/agent-world` (invoke `/agent-world`). These are links to the same repository source. Start a fresh session if a newly installed skill is not listed. This local installation does not install a skill in ordinary ChatGPT or Claude cloud chats.

Read [the next-pass handoff](docs/NEXT_PASS.md) before continued development. The helper `npm run world -- help` reads bridge state and updates authorized planning metadata; it never accepts tasks on the human's behalf. See the skill's [API reference](skills/agent-world/references/platform.md) before writes.

```bash
npm test          # truth model, Claude hook + Codex log mapping, pathfinding
npm run build     # production client into dist/
npm start         # build, then serve everything from the bridge on :4777
```

Work is the default view with a compact dock. **Play** opens the cosmetic activities as icon tiles; **Connections** (plug icon) shows what's observed (Codex, Claude Code, saved app chats) with last-seen times. Caveats live under each panel's “How it works” note. Pets have their own Build tab. Task details are optional; review evidence remains visible when editing existing work.

Reviews open a focused deliverable view. Preview recorded project-local text outputs, inspect reported checks, then explicitly accept or return with feedback. Return records feedback without messaging an agent. See [review workflow](docs/REVIEW_WORKFLOW.md) for supported formats and limits.

Connection becomes live after a snapshot arrives. Offline Sims pause and show last-known observations; observation age is not proof that an agent stopped. The top-bar focus chip opens Work or clears focus, and unavailable saved homes do not filter notifications. See [freshness and focus](docs/FRESHNESS_FOCUS.md).


Getting started in Work → Now follows recorded outcomes, tasks and review decisions; linking a chat is optional. Save & draft task opens an editable draft after saving the plan, and Cancel creates no task. A task's Handoff button previews recorded context and evidence for copying into the source app. Copy sends nothing and changes no task stage. Re-read current records before continuing, preserve newer changes, and leave completed work in Needs review for the human. Accepted tasks require explicit human authorization before further work.


Reviews show a recorded summary, outputs, reported checks and limitations; full notes stay available and decisions remain visible while evidence scrolls. Task details/helper support review summary and limitations. Valid Codex IDs offer Open in Codex with an ID fallback. The journal preserves project drafts and user-started timers, offers the next review and identifies unmatched condition records. Stop and inspect timer values before saving; baseline sessions use an external timer with Agent World closed. See `docs/REVIEW_PILOT_PASS.md` for the real pilot runbook. Never start human measurement timers or enter their notice/resumption times on their behalf.


### Approved pass runner

`npm run dev` enables the local runner; demo mode disables it. Use `AGENT_WORLD_RUNNER=0 npm run dev` to keep execution disabled. An installed, signed-in CLI for the selected provider is required. Codex uses `workspace-write`; Claude Code uses its configured permissions. Runs create a new conversation or resume the exact selected game chat, with a 30-minute limit. They preserve project instructions and uncommitted work, stop after one pass and return structured reported results. New proposals require fresh confirmation; approval does not accept previous work. Failed/interrupted runs require inspection rather than automatic retry. `passes.json` and private `pass-runs/` outputs live under AGENT_WORLD_HOME; no prompts are written to canonical activity events. API routes retain local-origin/JSON guards but are not an authenticated human-identity boundary.

### Prompting Claude Code

In an agent's chat, choose **Claude Code** beside the model control, type your instruction and select **Send**. Switching provider starts a new chat and preserves unsent text. Follow-up messages in a game-created Claude chat resume its exact Claude session; Codex and Claude histories remain separate. This routes to Claude Code CLI, not ordinary Claude desktop/web conversations. Existing external Claude sessions are not resumed.

The official Claude Code CLI is installed locally at `~/.agent-world/tools/claude-code/node_modules/.bin/claude`. Complete sign-in once in your terminal:

```sh
~/.agent-world/tools/claude-code/node_modules/.bin/claude auth login
```

The bridge discovers this local install or `claude` on PATH. Set `AGENT_WORLD_CLAUDE_COMMAND` before starting the bridge to use another executable. CLI detection confirms installation only, not sign-in. Claude uses its configured model; Claude model switching, quota reads and reasoning summaries are not implemented. Its usage control explicitly shows unavailable.

Claude runs use `dontAsk` plus a per-run PreToolUse approval hook for file edits and shell commands. The game supplies exact-action approvals in chat without a terminal prompt. Configured deny/ask rules remain effective and can still block an approved action; unrelated tools needing interactive permission remain denied. Full access explicitly selects the CLI permission bypass for that run only; other choices never bypass configured permission checks. Replies and errors return to the same game chat. Existing Claude hooks supply observed scene activity; absent hooks mean activity is unavailable, not invented. New recommended passes remain unapproved.

### Codex CLI discovery

The runner and read-only model/usage APIs use the same Codex executable discovery: `AGENT_WORLD_CODEX_COMMAND`, executable on PATH, then known official macOS Codex/ChatGPT app bundles. This supports Finder launches with a minimal PATH. Explicit overrides never silently fall back. Restart the bridge after installation or override changes. Missing executables disable Send and return an installation/path error before approving work; sign-in is a separate check. Failed prompts are not automatically replayed.

### Codex desktop ownership

A conversation opened in Codex may remain owned by its desktop writer even while waiting. An independent CLI cannot resume that thread until ownership is released. The game shows this error, preserves the failed prompt and never creates a fallback chat. Continue in Codex or explicitly choose New conversation. Direct prompting of a desktop-owned thread requires a future app integration; closing its visible view has not been verified to release ownership.

### Prompt tools (2026-10-07)

Click a resident → **Prompt this agent**. **Attach files** adds up to four PNG/JPEG/WebP images or UTF-8 text/code files. Each file is limited to 5 MB; text files are limited to 256 KB and the first 20,000 characters are passed. PDFs and binary documents are not supported. Private uploads are bound to the home/resident and integrity checked before execution. Only Send passes attachments to the selected provider; canonical activity events never contain their contents. Removing a draft attachment does not delete its retained private upload. Codex receives native image flags; Claude receives image paths for its permitted Read tool.

**Stop run** stops a game-launched CLI process group and records cancellation; edits already made remain. **Cancel queued prompt** prevents execution. These controls do not stop agents launched outside the game or automatically roll back files.

The backend retains isolated Git worktree support for previously created chats; the prompter no longer offers a worktree checkbox. An isolated worktree snapshots the Git root at execution time, including tracked changes and untracked files (excluding ignored files). A Git repository with a commit is required. Follow-ups stay in that worktree. Chat displays its branch, path and Open in VS Code link; changes are retained for review and never automatically merged or removed. Observed worktree activity belongs to the original resident/home while retaining its actual source path.

Each resident/provider list offers search, archive and restore alongside rename. Archive only hides a chat from Agent World's normal list; it does not archive/delete provider history. Active or queued chats cannot be archived. Restore a chat to send another message.

### Fixed execution policy (2026-10-07)

The prompter has no Run settings panel. Every new message uses Prompt workflow, with shell tools available, Codex workspace-write and shell networking enabled, Claude configured permissions (dontAsk), live Codex search and Claude WebSearch/WebFetch enabled where supported. Both providers inherit their CLI's MCP/plugin configuration; Codex supports this, so no off fallback is needed. Claude's existing sandbox/network/tool rules remain authoritative; Claude read-tools-only access disables shell, external MCP/plugins and the task browser for that run; other access choices leave configured provider rules effective.

The policy is enforced at proposal validation, queue claim and runner startup. Per-message overrides are rejected except the explicit Codex and Claude access selectors described above. Previously queued settings cannot restore review mode or different permissions; completed historical run records/findings remain readable. Existing model, provider and attachment controls remain. New prompter chats use the project checkout; existing worktree chats retain their recorded workspace. No running turn changes policy midway.

Configured services still need provider authentication/trust and permitted tools. These defaults describe requested capabilities, not proof they were used or connected. No global CLI settings, credentials or plugin installations are changed. Real provider/service execution requires separate verification.

### Connect an app from the game

In a Codex resident chat, choose **Connect an app**, enter an application name or bundle ID, and select **Request app access**. A dedicated ephemeral Codex app-server connection calls the native computer-use tool directly; it does not start a model turn or create a saved conversation. The game's dialog displays the actual provider approval request, including its app, warning and offered persistence choices. **Always allow** requests saved access for future Codex runs; **Allow once** applies only to this setup connection. Deny, close and Cancel never grant access. The game reports verification only when a native interface is returned; setup success does not establish that a later normal prompt can use the app. Saved approvals can be revoked in ChatGPT Settings → Computer use. OS permissions and provider/org restrictions still apply.

The normal prompt runner still uses `codex exec`; it cannot collect first-time app approvals. This dedicated setup flow handles the MCP elicitation through the supported app-server protocol and leaves the decision to the human. No provider permission files are edited. If an app has no visible window or tools are unavailable, the dialog reports that result. Demo mode disables real connections.

Current verification (2026-10-07): the real provider request appeared in Electron and the human selected Always allow. A fresh native-tool connection then returned the Agent World interface without another approval. First-use documentation before the window-state block is handled correctly. Local ad-hoc rebuilds can invalidate macOS Documents-folder approval; the human completed the requested consent and a fresh packaged Electron setup displayed “Native app access verified.” for Agent World without another approval. The ordinary game test could not execute because Codex desktop owns its conversation; native access in a normal game prompt remains unverified for that chat. Codex native-app approval and macOS folder access are separate permissions. See `docs/NEXT_PASS.md` for the exact pending test and evidence.

## Codex voice (experimental, 2026-10-08)

The Codex composer has a microphone button for the selected resident and conversation. It starts a thread-scoped app-server realtime session, captures mono PCM audio, plays returned audio, and shows provider-authored live transcripts. Mute and End voice controls are available during a call; closing the drawer ends the call and interrupts associated execution. Conversation/provider switching and text sends are locked during voice. Only one call can run, and approved/queued execution must finish first. Command/file permission requests require a human decision. Raw audio is held in memory, never saved by Agent World; returned transcript text is saved to that resident's chat.

**Current blocker:** the installed Codex CLI 0.160.0 rejected both default and v3 realtime connections with `realtime conversation requires API key auth`. Thread initialization succeeded but zero audio chunks were returned. ChatGPT sign-in alone has not worked for this route. No API-key login, paid fallback, or authentication change was performed. UI/transport wiring is implemented, but two-way audio, speech quality and microphone permission behavior are not verified end to end. This must not be described as working subscription-backed voice.

### Claude conversation models

In a resident's chat, select Claude Code in the model menu, then choose Claude Sonnet, Claude Opus, Claude Haiku or Use configured default. Choices are saved per provider/project/conversation in the local UI and pinned into the next authorized prompt. Resuming preserves the exact Claude session; changing a model does not create a new conversation. The runner supplies `--model` only for an explicit choice. The menu also shows the last model Claude reported, separately from the next-message selection. Claude checks account access when executing; these are CLI aliases, not an entitlement list. Claude effort can be selected per conversation; Default uses configured effort.

Claude's model menu also offers a requested-effort slider: Default, Low, Medium, High, Extra high and Max. It is saved per provider/project/conversation and applies to the next message on the same session. Default omits `--effort`; resetting effort leaves the chosen Claude model intact. Claude applies model support and organization limits, so requested effort is not proof of the effective level.

## Local Codex projects and homes

The sidebar lists your agents. Projects live in **Plan town** (`M`, or the map button): its **Projects** drawer holds the permit card, **Build a home** (then Import existing project or Create new project), Replace, each home's card (click to fly to it; move; remove) and the over-capacity chooser. Opening it reads the local Codex registry through the installed CLI's experimental app-server project/list method, then registers its available primary folders as homes. Each folder has one home and at least one persistent off-duty resident. Projects with unavailable folders are reported and skipped; multiple Codex projects sharing a canonical folder reuse its home. Existing observed folders are also listed. This does not import conversation contents or start work.

Add project takes a name and an absolute local folder (~/ is supported). Create folder if missing makes one folder under an existing parent; otherwise the folder must exist. The CLI project/create result must confirm the folder before Agent World reports success. Existing files are preserved. Repeated requests reuse an existing project for that canonical folder; retries keep the idempotency key while the form is unchanged. If Codex creation fails after the folder was created, the folder is retained and the error names it. Click a project row to focus its home.

This creates local Codex project records, not synced ChatGPT Projects. Multi-root projects use their first root as the home. Game prompts still route by the resident's folder and session; automatic assignment of game-created chats to the native Codex project's projectId is a separate integration, not verified or claimed here.

### Explicit project onboarding (2026-10-08)
Projects start empty with one vacant lot and Add your first project. Opening Projects only lists available Codex roots; Import existing adds a chosen project, while Create new registers a folder/project. (Since October 12, 2026 both first need a plot chosen in Plan town and a free permit; see Town planning and project permits.) selected-projects.json stores the explicit world selection independently from existing households, chats, files and the Codex registry. Existing automatically imported homes remain preserved but hidden until explicitly imported. Demo remains unchanged. No real projects were created/imported during QA.

Project cards include Remove: removes the selected project and its home/residents from Agent World only. Local folders, Codex registry entries, conversations and recorded history are retained for re-import. Running/queued game work and active voice must finish or stop before removal. Removing the last home restores the vacant onboarding lot.

## Scheduled prompts

Inside a resident’s prompter, Scheduled → New task opens a reference-style Schedule a task dialog. Run with explicitly chooses Codex or Claude Code for new tasks (installed providers only). A task keeps its provider when edited; create another task to change it. Once, Daily and Weekly use the displayed IANA time zone and calendar wall time. Advanced contains the task name and time zone. Create/Save explicitly authorizes the exact stored instruction at those times, with the selected provider/model/effort and resident. Every new task appears immediately as its own scheduled conversation in that resident’s chat list. Its first run creates a new provider conversation, without continuing the selected chat; repeat runs reuse that task’s conversation. The time picker offers 15-minute increments, enforced by the API for create/edit. Already dispatched one-time tasks keep their original chat; future legacy schedules acquire a dedicated conversation without changing their authorized time. Responses and public reasoning summaries use the normal chat/runner path. Attachments are not scheduled in this pass.

Schedules are persisted atomically alongside the pass queue in passes.json. The local scheduler checks every 10 seconds while the bridge/runner is running; the app must remain open and the computer awake. Missed times coalesce to one catch-up run. Only one pending occurrence per schedule is allowed. DST preserves wall time; nonexistent spring-forward times are skipped and duplicated fall-back times run once. A failed/interrupted/cancelled run pauses the schedule for explicit review/resume. Pausing cancels unstarted scheduled work; running work continues until stopped in chat. Edit/delete requires finishing/stopping an active occurrence. Removing a project pauses its schedules. No cloud account automation or background service is configured.

Agents must not create, resume or edit real schedules without scoped human authorization. QA uses an isolated AGENT_WORLD_HOME and CODEX_HOME and fixture CLIs; scheduled responses do not imply accepted work.

## Recruited household and scoped handoffs

Every new home starts with one Personal Assistant owner. Saved identities and chat ownership remain intact; only recruited household members spawn and participate in delegation. Assigned responsibilities are planning metadata, distinct from observed activity and activity-derived downtown specialties; no sessions/events are invented.

Sending a prompt to this team authorizes scoped delegation of that request within the project. The selected provider/model/effort are retained throughout the request. The runner gives each resident its responsibility and the roster. Agents choose relevant handoffs in a structured response: role, task title, scoped instruction and earlier prerequisite IDs. For example the Assistant can delegate website implementation to the Junior developer, optionally following a Researcher report. There is no keyword router or direct provider-to-provider messaging.

The first handoff to a recipient starts a separate resident-owned conversation; subsequent handoffs in the same request can reuse an established recipient conversation. Earlier unrelated resident chats are never resumed automatically. Queued handoffs appear in the receiving resident’s list. The original chat shows sender → recipient, status, reported results and Open chat links. Automatic instructions are attributed to a teammate or Team report request, never to the human. After all parts settle, one final pass resumes the original conversation with recorded reports to summarize changes, checks, failures and unfinished work. A returned report does not accept tasks or grant world rewards.

Runs remain sequential to avoid competing workspace edits. The graph is bounded to three handoffs per response, six per human request and two delegation levels, with no further delegation in the final report. Invalid/self/unknown-role handoffs are rejected atomically. Failed prerequisites pause dependent work; no automatic retry. Interrupted work still requires human inspection. Stop in the original or receiving chat cancels the remaining request queue and stops its active game-owned run; existing file changes remain. Publishing/pushing/spending are not included. New schedules in the starter team capture delegation authorization; existing schedules are not retroactively expanded. Isolated-worktree and voice runs do not enable this team workflow in this pass.

Fixture CLIs verify execution/routing for Codex and Claude without provider spending. Intelligent task decomposition by a real model remains to be evaluated with real user prompts.

Home progression now pools lifetime XP from every current resident in that home (unique slots, same project). Building thresholds are 100 / 750 / 2,000 / 4,000 / 7,000 / 11,000 / 16,000 total XP for Family House / Duplex / Townhouse Row / Small Apartment Building / Apartment Block / Residential Tower / Landmark Residence; fixed thresholds do not change with household size. Individual resident/player XP rules are unchanged. Rewards shows pooled XP and the remaining XP to the next home tier.

The six MP3s in `audio/` form the background soundtrack. Playback begins after a user interaction, shuffles every cycle, avoids immediate repeats between cycles and uses a quiet 20% volume. The existing Sound toggle controls music and chimes together and remembers mute. Assets are bundled by Vite into the Electron package; playback needs no external music service.

Town ambience: the user-supplied Meadows MP3 plays as a quiet (15%) continuous loop alongside the shuffled soundtrack, after the first interaction. It is excluded from the music playlist. The existing Sound toggle pauses/resumes both layers and agent chimes.

## Home overview and Suggest Roommates

Click the project/home sign by the mailbox to open Home overview: pooled home XP, level progress, resident roles and individual levels, and fifteen household slots, unlocking one per home level. Slot 1 belongs to the Personal Assistant. Home level 2 (100 pooled XP) unlocks slot 2 and Suggest Roommates. Slot 3 unlocks at home level 3 (350 pooled XP).

Suggest Roommates authorizes one fresh, read-only inspection conversation by the owner using the selected installed Codex or Claude CLI. The inspection reads project instructions and at most ten relevant files, with a five-minute timeout and no web, external integrations, editing, delegation or automatic follow-up. Codex reads files through its command tool inside the read-only sandbox; Claude exposes only Read/Grep/Glob. Builds and tests are outside the authorized inspection. The assistant reports up to three distinct catalog role IDs with reasons, inspected evidence and uncertainties, ordered from most helpful to least helpful for the inspected project. Each role produces one named candidate, displayed in that recommendation order. The home modal shows the candidates and short, general descriptions of their roles; the full inspection summary, checks and uncertainties remain in the Assistant chat. Saved reports retain their original order; request a new inspection for the explicit usefulness ranking. Recommendations are reports, not proof of competence. Matching named candidates are simulated game identities; click Recruit to choose one explicitly. Capacity and current recommendation IDs are rechecked by the API, and recruitment preserves saved resident/chat identity bindings. Suggestions remain available when current slots are full, with an upgrade explanation. Actual provider inspection quality still requires a real user run.

Delegation uses the household’s recruited catalog roles, including professions beyond the former fixed three-role roster. A solo owner cannot delegate to invented teammates. The inspection creates no team work; later normal prompts capture the actual recruited roster.

## Eight-tier home evolution

Each home level unlocks one resident slot, up to fifteen at Landmark Residence. Recruitment remains explicit. Total pooled XP thresholds are 0 / 100 / 350 / 750 / 1,250 / 2,000 / 3,000 / 4,000 / 5,500 / 7,000 / 9,000 / 11,000 / 13,000 / 14,500 / 16,000. Each tier is its own low-poly building modeled on [its concept image](docs/concepts/home-tiers/README.md): Cottage, two-storey Family House with porch and bay window, Duplex with twin gables and two doors, four-door Townhouse Row, balconied Small Apartment Building, U-shaped Apartment Block with a podium courtyard garden, Residential Tower with a rooftop pool deck, and the stepped Landmark Residence with its crown and spire. Each tier also has its own ground-floor plan, matched to the building type:

- **Cottage:** kitchen and dining, a fireplace living room, a bedroom and a study desk.
- **Family House:** hall with stairs, living room, kitchen, office and a study with a half-bath.
- **Duplex:** two mirrored homes behind a party wall, each with its own door.
- **Townhouse Row:** four narrow homes, each with its own door, kitchen, desk and stairs.
- **Small Apartment Building:** lobby with elevator, stairs and mailboxes, an apartment, and a residents' lounge with shared desks.
- **Apartment Block:** staffed lobby, fireplace lounge, laundry and parcel room, and co-working.
- **Residential Tower:** concierge lobby with two elevators, co-working, café lounge, mail room and mechanical room.
- **Landmark Residence:** grand lobby, two office suites, a fireplace library and a business center.

**Multi-floor homes.** Every storey above the ground floor is walkable and has its own plan (`web/src/home-floors.js`), and residents are spread across the floors as the household grows (the owner starts on the ground floor, then one new resident per floor in turn). Each resident's living space is a desk with their own bed nearby, where they rest while off duty:

- **Family House:** three bedrooms with desks, plus a bath and reading nook upstairs.
- **Duplex:** two bedroom-offices upstairs in each home.
- **Townhouse Row:** a bedroom and a two-desk study upstairs in each of the four homes.
- **Small Apartment Building:** three floors of four apartments around the elevator corridor.
- **Apartment Block:** five floors with a two-resident apartment in each wing.
- **Residential Tower:** nine floors of two apartments.
- **Landmark Residence:** a residents' club, seven floors of two suites and three penthouses.

Each building type seats at least its largest household (3, 5, 7, 9, 11, 13, 14 and 15 residents). Zoom into a multi-floor home and the floor picker on the right lists its floors with how many residents live on each, and a dot where someone needs you. Click a floor or press PgUp/PgDn to inspect it: the camera rises to that floor, its outer walls and partitions lower like the ground floor's, floors below stay closed under their ceilings, and only that floor's residents are shown and clickable. Selecting a resident anywhere opens the floor they live on. Visitors and new residents step out at their floor's stairs or elevator landing.

Residents, their seats and monitors, conversations, paint, floor, decor and pets carry over when a home upgrades; residents reappear at their spots in the new layout. Extra residents beyond a plan's desks get a desk wherever one fits without blocking a doorway or station. Plants, rugs and similar pieces step aside for your decor. Upper floors and roofs lift away together as you zoom in (like a roof); outer walls facing the camera and all interior partitions lower so residents stay easy to see and click. A tall home standing between the camera and the home you're looking at opens too. Zoom out fully and the camera pulls back and rises far enough to show the tallest home whole, including the one you're centered on. Upper floors are not walkable; residents use the ground floor. House style changes the roof treatment (slate gable, craftsman hip, modern flat or red barn) without changing the silhouette; yard landscaping skips any spot where you placed decor. Screenshots: [docs/screenshots/home-tiers](docs/screenshots/home-tiers).

Home overview includes **Home level · Testing**: choose levels 1–15 and Apply, or Use earned XP to remove the home-only adjustment. This changes building tier and recruitment capacity without modifying agent/player XP, recorded work, or existing residents. Future earned XP remains additive. Finish home construction and active work first.

**Current home progression (October 11, 2026):** 15 levels and resident slots, eight buildings at levels 1, 4, 6, 8, 10, 12, 14 and 15. Max remains 16,000 pooled XP; early slots unlock at 100 and 350 XP. No residents are added automatically. The testing selector supports all 15 levels. When the authored interior lacks enough seats, an open coworking floor provides 15 distinct work screens; shell designs remain unchanged. This supersedes older eight-level/capacity descriptions.

**Named handoffs:** In a resident chat, type @ to suggest active teammates in the same home. Click a suggestion, or use Up/Down and Enter/Tab; Escape dismisses it. For example: "Draft the plan, then have @Tyler design the mockup, then @Olive implement it." The coordinator returns structured handoffs with dependencies. Mentions identify recipients; they do not launch work on their own. Explicit instructions to handle everything yourself take precedence. Unknown/ambiguous recipients are rejected, and role-only routing requires one matching resident. No unrelated chats are resumed.

### Desktop build and Windows CLI compatibility

`npm run app:build` builds Vite through its JavaScript API and packages the current OS (macOS, Windows or Linux). Windows users can invoke `npm.cmd run app:build` when PowerShell blocks npm.ps1. Standard frontend settings are shared with the desktop build; it does not bundle a temporary Vite configuration in a restricted parent directory.

Codex and Claude discovery supports native executables and npm `.cmd` launchers, including the Windows `Path` environment spelling. Supported npm launchers run their Node entry script directly, with literal argument arrays and no command shell. Custom batch launchers with no Node entry script are rejected; configure a native executable or a `.js`/`.cjs`/`.mjs` CLI entry instead. Windows Stop terminates the provider process tree. Native Windows packaging, signing and real-provider smoke checks still require verification on Windows; cross-platform fixture tests do not establish those results.

### Agent browser feed

Codex and Claude game-run chats show **Watch browser**. In Electron, authorized browser work uses a private task browser that streams its viewport continuously over local MJPEG, capped at 15 rendered updates per second. Static pages may generate no new frames; the displayed rate is measured, not a promised video frame rate. The browser opens only when the agent uses its task-browser tools for a URL or local website. File edits, shell commands and plain web searches may have no browser activity. Hide browser frees the pane for chat; Show browser remains outside the hidden pane. The visibility choice survives ordinary chat updates. Expanding/showing the viewer resumes image transport; collapsing/hiding it pauses viewing without cancelling browser work. Completing/stopping the run closes the browser and expires its control token. Only the latest frame is retained temporarily; there is no recording, audio, invented cursor or personal Chrome-cookie import.

The built-in per-run MCP service permits read-only viewing under the CLI's `writes` approval mode; Electron-owned ordinary Codex turns use the app-server approval transport. Clicks and form entry display **Allow once / Deny** outside the hideable viewport, remaining visible while the browser pane is hidden, with the observed page, target and exact arguments. Approval applies only to that action, expires, and is rejected if the page or target changes. The pointer follows actual task-browser mouse inputs; a click pulse appears only after an actual click. Browser permissions, downloads and popups are denied. Browser tools and web pages do not authorize unrelated work. This continuous path requires the Electron-owned bridge; a reused standalone dev bridge and existing Chrome tools keep the tool-emitted screenshot fallback. Claude uses the same private task browser through a per-run MCP adapter. Its click/fill calls wait for the game’s exact-action approval gate; the CLI allowlist permits only this adapter’s named tools in addition to existing configured permissions, without a global permission bypass. Ordinary linked app chats have no continuous feed. Screenshots/video pixels are separate from canonical activity and saved chat metadata.

### Claude sign-in from the game

Mayor Martin’s **Sign in & link Claude Code** opens account setup, launches the installed CLI’s Claude-subscription browser sign-in when needed, and checks CLI authentication before continuing the first-town tutorial. If Claude requests a code, paste it in the private sign-in field. Already signed-in players skip another login. To add Claude after starting with Codex, use the top-bar **Connections & getting started → Connect Claude Code**; then choose Claude in a resident chat. Later setup does not reset your tutorial or grant another connection reward. Close hides setup; Cancel stops the pending login without logging out. Demo mode does not initiate account sign-in.

### Codex Full access (2026-10-14)

The Codex composer offers **Workspace access** (default) and **Full access this run**. Select before sending. Full uses approvalPolicy never and danger-full-access for app-server thread start/resume and turns, or the equivalent exec CLI settings. File/shell/MCP tools can act without per-tool approval; the private task browser also skips per-action click/fill cards while binding actions to its current page and target. Stop ends the run and expires browser capabilities. This is a run setting, not an OS permission grant or an account sign-in, and it does not alter global configuration or previous/queued work. Read-only roommate inspections retain their restrictions. Voice and app-connection setup retain their own configuration.
