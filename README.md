> The main overlay omits the chat, Prompt agent and All homes buttons. Open chat from an agent's activity view; open the conversation library through Connections → Chats or a home's shelf.

> Project cards show the project title and agent rows. Their Conversation shelf and Plan & briefing footer buttons have been removed.

> **Watch activity:** shows status, the animated screen, details and recent steps. The conversation card with Open in Codex and Shelf buttons has been removed from this view.

> **Rename chats:** use Rename beside a recorded chat in the prompter, edit its name and choose Save name (or press Enter). Cancel/Escape discards the edit. Names are saved locally in Agent World and shared with the conversation shelf; the original Codex app title is unchanged.

> Current primary workflow: click an agent to open **Watch activity**. Click **Done, your turn** (or another inactive status), **Prompt this agent**, or the animated screen to open chat for that observed conversation. Finished-turn attention entries open chat directly. Chat shows recorded message pairs, a conversation list and a pinned composer; **Enter** sends and **Shift + Enter** adds a line. Each game-launched reply automatically expands **Reasoning · live** for public Codex summaries during the run; arriving sections accumulate there and remain as **Reasoning summary** after completion. Command/file steps stay in **Watch activity**. Private internal reasoning is never imported; summary availability depends on the model. **New chat** starts fresh. Closing chat returns to Watch activity; sending keeps chat open while work runs. Returned reports appear in chat; the separate Results & history modal is removed. The lower-left **Account usage** button in chat and **Connected app usage** in Connections shows Codex account remaining percentages and reset times from the official read-only account endpoint. Unsupported or unavailable sources show no assumed balance. Errors remain inline, with no floating pass notices. Earlier app messages are not imported.

> Live Codex account usage is available after restarting the updated bridge. Each chat shows its last observed model. Use the model pill inside the composer (its menu opens upward) to choose **Next message model** to change the model when sending; **Keep conversation model** retains the existing choice. Preferences are per chat for this browser session, and never change a running turn. Claude usage and model selection remain unavailable.


# Agent World

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

## Desktop app (Electron)

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
| "Needs you" list / edge arrows | Fly to agents waiting on you |
| Neighborhood panel | Every home and Sim with live status; click to fly there |
| Dock | Time of day, walls, graphics quality, sounds, help |
| 🔔 (dock) | Toggle chimes: ding-dong for permission/questions, soft arpeggio when a turn finishes, a gentle ping if still waiting after 2 min |

The tab title shows how many agents are waiting, e.g. `(2) Agent World`.

## Customize your world (just for fun)

Everything here is cosmetic and never changes what is shown as true about agents. The rules and roadmap are in [docs/GAMEPLAY.md](docs/GAMEPLAY.md).

- **Build mode** (`B` or the hammer in the dock): choose a home, then place decor from the catalog (plants, lighting, rugs, seating, furniture, fun stuff, garden). Click to place, `R` to rotate, right-click or `Esc` to stop. Click a placed item to move, rotate or remove it. WASD pans the camera while building. Placement keeps every desk, waiting spot and doorway reachable; blocked spots show red with a reason.
- **Paint** (build mode, Paint tab): outside walls, wallpaper and floor style per home.
- **Wardrobe:** the shirt button in a resident's inspect drawer, or the **You** picture in the top bar (or the shirt in the dock) for your own look. Skin tone, hair, top, colors, shoes and an accessory, with a live preview.

Style is saved in `~/.agent-world/style.json`, separate from observed events and your task board.

**Progress (bricks and home levels).** Click the bricks chip in the top bar.
- Earn **+10 bricks** at most once per project per local calendar day for new tasks you accept *with review notes* (existing accepted credits are preserved), and **+25** when you mark a project's outcome reached (Work → Now → *Reached*, with a confirmation).
- Each reached outcome grows that house a level: Cottage, House, Villa, Manor, Estate, with new porch, garden and yard details.
- Spend bricks in Build mode to unlock nicer decor. Some items also need a higher home level.
- Bricks are recomputed from your board, so agents can't earn them and how busy they look never counts.

**Downtown: a city that builds itself.** East of the homes, main street grows from the *kinds* of work your agents actually do.
- Running tests opens a QA lab, git a post office, web research a library, and helper agents a coworking space. There are 8 businesses.
- Each kind counts once per day: a lot is surveyed on day 1, built on day 2 and opens on day 3.
- How much your agents do never matters, nothing decays, and fake demo agents don't count.
- Click a building's sign to see why it's there. The building button in the dock opens the City census.
- Businesses grow with use: expanded at 7 days of that kind of work, flagship at 14, and their own landmark at 30. Landmarks include a glass testing tower, a clock tower post office and an observatory.
- Residents get a job (Tester, Designer, Researcher and so on) from the kind of work their sessions do most, and wear an apron in their workplace's color. The wardrobe can hide it.
- Helper agents start as interns with a lanyard. A helper type that works in a home on 3 different days is hired and gets a name.
- While their agent is off duty, residents sometimes stroll to their workplace and back, with a dashed "just for fun" tag. The moment their agent starts, they're back at their desk. You can turn this off in the Walls menu.

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
- **Map mode** (`M` or the map button): click a house, then a plot, to move it. Click a street name to rename it. WASD pans.
- **Town square** (west of the first street): the park, café, plaza fountain and town hall open as your homes reach outcomes and you accept tasks with review notes. The Progress panel shows what each one needs.
- **Pets:** Build mode, Paint tab. Each home can have a cat, a dog or a bunny.
- **Seasons and weather** (cloud button in the dock): follow the calendar or pick a season, plus clear, rain or snow. Ambience only.
- **Finds:** a few collectibles sparkle in yards each day. Click one to pick it up. Your first of each kind unlocks a special decor item in the Found catalog. Finds never give bricks.

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

Work is the default view with a compact dock. **Play** opens the cosmetic activities as icon tiles; **Connections** (plug icon) shows what's observed (Codex, Claude Code, saved app chats) with last-seen times and a three-step start. Caveats live under each panel's “How it works” note. Pets have their own Build tab. Task details are optional; review evidence remains visible when editing existing work.

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

Claude runs use `dontAsk`: existing approved tool permissions apply, and tools requiring an interactive permission prompt are denied. The game never bypasses permissions. Inspect reported denials and configure required permissions in Claude Code before retrying explicitly. Replies and errors return to the same game chat. Existing Claude hooks supply observed scene activity; absent hooks mean activity is unavailable, not invented. New recommended passes remain unapproved.

### Codex CLI discovery

The runner and read-only model/usage APIs use the same Codex executable discovery: `AGENT_WORLD_CODEX_COMMAND`, executable on PATH, then known official macOS Codex/ChatGPT app bundles. This supports Finder launches with a minimal PATH. Explicit overrides never silently fall back. Restart the bridge after installation or override changes. Missing executables disable Send and return an installation/path error before approving work; sign-in is a separate check. Failed prompts are not automatically replayed.

### Codex desktop ownership

A conversation opened in Codex may remain owned by its desktop writer even while waiting. An independent CLI cannot resume that thread until ownership is released. The game shows this error, preserves the failed prompt and never creates a fallback chat. Continue in Codex or explicitly choose New conversation. Direct prompting of a desktop-owned thread requires a future app integration; closing its visible view has not been verified to release ownership.
