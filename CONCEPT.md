# Agent World — Concept

A Sims-style world that **visualizes** AI agents already working on your machine.
The activity world watches observed agents. A separate local runner can now execute one explicitly human-approved next pass from the agent card. This supersedes the original observer-only product boundary; simulated flavor still never creates real activity.

## Principles

1. **Observed activity, explicit execution approval.** The world reads real events. The agent card may authorize one exact instruction to a separate local runner. Approval is never inferred from activity or task completion.
2. **Truth vs. simulation.** Every on-screen thing is either *truth* (backed by an observed event) or *flavor* (invented by the game to look alive). Flavor can never write to truth, and the UI never presents flavor as fact.
3. **Provider-agnostic.** Claude, ChatGPT/Codex, or a shell script all look the same to the game. The observed world uses a shared vocabulary; the prompt provider explicitly determines which CLI executes authorized work.
4. **Private by default.** Show what an agent is doing, not the contents of your code or prompts, unless the user opts in.

## World model

| Sims | Agent World |
|---|---|
| Neighborhood | Your machine |
| Lot / house | A project folder or app project |
| Household | The Sims who work on that project |
| Sim | A **persistent character** tied to a project |
| Visitor | A sub-agent spawned by a Sim (temporary, leaves when done) |
| Conversation card | The conversation currently attached to a resident |
| Conversation shelf | Saved conversations; existence does not imply activity |
| Objects | Tools: desk = edit, bookshelf = read/search code, terminal = run commands, window/radio = web |
| Thought bubble | Current task / action (**truth**) |
| Plumbob | Status at a glance (**truth**) |
| Free will | Idle and ambient behavior (**flavor**) |

### Identity: who is a Sim?

Sims are **persistent per project**, so the same characters show up every day.

- Each project (canonical absolute path) owns a household.
- When a session starts in a project, it **occupies a slot**: slot 1 if free, else slot 2, and so on. Slot N is always the same character (name, look), so sessions come and go but characters stay.
- Sub-agents (identified by `parent_session`) appear as **visitors** next to their parent and leave when they finish.
- A Sim with no live session is **off duty** (at home, asleep). That is shown clearly as "no agent attached", which is truth, not flavor.
- The Sim's look can reflect the provider (outfit or badge), but its behavior never depends on it.

## Projects and conversations

- A **home** can represent a local project folder or a manually registered ChatGPT/Claude project.
- Residents stay persistent per home + slot. Each attached primary session carries a **conversation card**; when it ends, that conversation remains on the shelf and the resident can pick up a different one.
- Conversation IDs are namespaced by source. Older canonical events use their session ID as the conversation ID. Helpers remain visitors and do not get separate shelf entries.
- Cards appear in the roster, above working residents and on monitor footers. A shelf button by the bookshelf and a Conversations button open a searchable library.
- Users add app projects and saved chats by link. Adding metadata does **not** start an agent, create a resident, indicate work, or trigger needs-you. An app project can explicitly share an existing home; matching names never merge projects.
- Saved conversations say **current activity unavailable**. Attached conversations show the observed activity and last observation time. A disconnected bridge is labeled; archived/saved chat existence cannot establish generation or a need for human action.
- Direct conversation links open the original app's website. No prompts are sent. Links are restricted to the selected app's HTTPS host and conversation routes; query strings and fragments are dropped.
- Titles may be sensitive. Adapter title ingestion is off by default (`conversationTitles: false`) and is redacted before writing events. Users can explicitly allow saving a title through the library. Project names and links entered by users are stored locally.
- `~/.agent-world/conversations.json` persists the project registry and conversation shelf, separate from live sessions and household characters.
- **Coverage:** Codex and Claude Code activity is observed today. Ordinary ChatGPT and Claude chats are saved links until a separate observer provides canonical events. Registration is not automatic synchronization with either account.

## The hero feature: "needs you"

An agent waiting on the human (permission prompt, question, finished turn) is the most useful thing to surface.

- Plumbob turns **yellow**, the Sim faces the camera and waves, and an edge-of-screen indicator points to it.
- Clicking the Sim (or pressing Space with it in view) shows *why* it is waiting.
- Wait time is shown and escalates visually (getting more impatient). This is truth: it is measured from the event timestamp.

## Truth layer

### Canonical states

| State | Meaning | Default visual |
|---|---|---|
| `idle` | Session alive, nothing happening | Free-will flavor |
| `thinking` | Model is generating / planning | At desk, thought bubble "…" |
| `reading` | Reading/searching files | Bookshelf |
| `editing` | Writing/modifying files | Desk, typing |
| `running` | Executing a command | Terminal / server rack |
| `searching` | Web search / fetch | Window / radio |
| `delegating` | Spawned a sub-agent | Visitor arrives |
| `waiting_for_user` | Blocked on the human | Yellow plumbob, waving |
| `error` | Something failed | Red plumbob |
| `done` | Turn/task finished | Brief celebration, then `idle` |

Plumbob: **green** = working, **yellow** = waiting for user, **red** = error, **grey** = off duty.

### Event schema (v1)

One JSON object per line (JSONL). Adapters write it; the game reads it.

```json
{
  "v": 1,
  "ts": "2026-10-05T14:03:22.120Z",
  "kind": "state",
  "source": "claude-code",
  "provider": "anthropic",
  "session": "8f2c1e",
  "parent_session": null,
  "project": "/Users/me/code/shop-api",
  "state": "editing",
  "detail": {
    "tool": "Edit",
    "target": "src/orders.ts",
    "summary": null
  }
}
```

- `kind`: `session_start` | `state` | `session_end`
- `app` (optional): where the session runs, in plain words: "Claude desktop app", "Claude Code CLI", "Codex app", "Codex CLI". Claude Code's adapter reads `CLAUDE_CODE_ENTRYPOINT`; Codex's reads the session's `originator`.
- `conversation` (optional): `{ id, title, url }`. Defaults to the session ID; titles require opt-in at adapter write time. Links are accepted only for `chatgpt` and `claude` sources.
- `project_name` (optional): observed display name for a new home. Registered app project keys use `chatgpt:<project-id>` or `claude:<project-id>`. Explicit links route events to the chosen home while retaining the source project.
- `state`: one of the canonical states (required when `kind` = `state`)
- `detail`: optional. `target` = file/command/URL; `summary` = human-readable text. Filled only at the privacy level the user picked.
- Unknown fields are ignored, so adapters can add `x_*` extras.

### Event bus: one local inbox

All adapters **append** to a single directory:

```
~/.agent-world/events/<source>-<session>.jsonl
```

The game watches only this directory. Adapters are small and separate: a hook script, a log tailer, or an agent writing directly. Adding a provider never touches the game.

### Privacy levels

| Level | Shows |
|---|---|
| `state` | State only ("editing") |
| `targets` (default) | + file names, command names, domains |
| `full` | + prompt/task text and summaries |

Adapters respect the level at write time, so sensitive data never reaches disk unless the user allowed it.

## Adapters

### 1. Generic status writer (first)

Anything can append events in the schema above. This is the escape hatch for custom agents and scripts, and it doubles as a test harness: a fake-agent script can drive the whole world.

### 2. Claude Code hooks (first real provider)

Hooks fire on real lifecycle events with `session_id`, `cwd`, and tool info, so no log parsing is needed.

| Hook | Event |
|---|---|
| `SessionStart` | `session_start` |
| `UserPromptSubmit` | `thinking` |
| `PreToolUse` Read / Grep / Glob | `reading` |
| `PreToolUse` Edit / Write / NotebookEdit | `editing` |
| `PreToolUse` Bash | `running` |
| `PreToolUse` WebSearch / WebFetch | `searching` |
| `PreToolUse` Task / Agent | `delegating` |
| `PostToolUse` | `thinking` |
| `Notification` (permission / idle prompt) | `waiting_for_user` |
| `Stop` | `waiting_for_user` (reason `turn_complete`) |
| `SubagentStop` | visitor leaves |
| `SessionEnd` | `session_end` |

### 3. Codex / ChatGPT (log tailer)

`adapters/codex/tail.mjs` follows `~/.codex/sessions/**/rollout-*.jsonl` and writes the same events.

| Codex log | Event |
|---|---|
| `session_meta` | `session_start` (sub-agent threads → visitor, via `parent_thread_id`) |
| `task_started`, `reasoning`, assistant messages, tool outputs | `thinking` |
| `exec_command` / `exec` running `rg`, `cat`, `sed`, `ls`, `git diff`… | `reading` |
| other shell commands, `write_stdin`, MCP tools | `running` |
| `apply_patch` | `editing` (target from the patch header) |
| `web_search_call`, `web.*` | `searching` |
| `collaboration.*` (spawn/wait agent) | `delegating` |
| `request_user_input` | `waiting_for_user` (reason `input`) |
| `task_complete` / `turn_aborted` | `waiting_for_user` (reason `turn_complete` / `interrupted`) |

Notes:
- Sub-agent rollouts start with forked parent history; lines before `subagent_history_start_ordinal` are skipped.
- On startup, only files written in the last 3 hours are considered, and only their latest state is emitted.
- Codex logs have no session-end record. A session that is **waiting on you with no writes for 30 minutes** is ended by the tailer (heuristic, `--idle-end-minutes`).
- Codex approval prompts are not visible in the logs today, so permission waits only show when Codex uses `request_user_input`.

## Activities: what the Sim visibly does

Agents work at a computer, so Sims do too. `web/src/activity.js` maps truth (state + tool + target) to an **activity**: a screen app, a window title, a human label, a body pose, and an optional lead-in move.

| Truth | Screen | Body |
|---|---|---|
| `editing` (Edit / Write / apply_patch) | Editor tabbed with the real file; diff or new-file mode; language from the extension | Typing (hands on keys via arm IK) |
| `reading` (Read) | Read-only editor scrolling the real file | Hand on mouse, scrolling, leaning in |
| `reading` (Grep / Glob / `rg`) | Code search with the real pattern | Types the query, then reads results |
| `running` (shell) | Terminal with the real command (`npm test`, `git commit`…) and kind-specific output | Types the command, then watches; leans in for tests/builds; leans back for dev servers |
| `running` (MCP tool) | App window named after the tool | Mouse work |
| `searching` (WebSearch) | Search engine; the query only if privacy allows | Types the query, then clicks results |
| `searching` (WebFetch / browser MCP) | Browser with the real domain or browser action | Mouse work, cursor clicking |
| `thinking` | Chat with the model reasoning ("Thinking about the Edit result") | Hand on chin, looking up |
| `thinking` (TodoWrite / update_plan) | Plan checklist | Slow typing with pauses |
| `delegating` | Sub-agent card with the helper's role | Turns to brief the helper, who arrives with a laptop |
| `waiting_for_user` | Permission dialog naming the tool / "Your turn" composer / question | Stands up, faces the camera, waves |
| `error` | Error window: "<tool> failed" | Facepalm |
| `idle` | Lock screen (local time, project) | Leaves for flavor activities |

Sub-agents (visitors) carry a laptop whose screen shows their own activity. The inspect drawer mirrors the live screen.

**Honesty rule for screens:** real text is always truth (file names, commands, domains, queries, tool names, project, provider, time). Code, terminal output and page content are abstract bars, and nothing claims an outcome the agent didn't report (no "tests passed").

Commands are reduced to a privacy-safe label by `shared/commands.mjs` (program + subcommand, e.g. `npm test`, `git commit`, `python -m pytest`). Arguments, paths, messages and secrets are dropped, even at the default `targets` privacy level.

## Copy: how the game talks

- **Say what the agent is doing, in the user's words.** "Committing changes", not "running · git". "Needs your OK to run a command", not "permission". Labels come from `activity.js`.
- **Then show the exact thing, smaller.** The command, file, pattern or domain appears as a detail line (`git commit`, `src/orders.ts`, "handleOrder").
- **Name the app.** Every Sim says which app it lives in ("Claude desktop app", "Codex app"), so you know where to go.
- **When it needs you, say where to act.** "Approve or deny it in Claude desktop app", "Reply in Codex app to keep it going".
- **Houses are projects and Sims are persistent residents who pick up conversations.** The help menu says so in plain words. Names are unique across the whole world.
- **Never pass the demo off as real.** Demo mode shows a "Demo · simulated agents" chip and uses obviously sample folders.
- **Helpers don't ask for your turn.** A sub-agent that finishes simply leaves.

## Simulation layer (flavor)

- Driven by a simple needs/utility system (energy, social, fun). These are **fake** and never shown as agent metrics.
- Runs only when truth leaves room (`idle`): coffee, couch, bookshelf, whiteboard doodles, globe, wandering. Room furniture is flavor; real work always happens at the desk.
- **Truth always interrupts flavor.** A state change cancels the current flavor action within a short, bounded delay (target < 1s plus walk time).
- Real metrics (session duration, wait time, and later context/token use) are shown in the inspect panel, never as Sims-style need bars, to avoid confusing them with flavor.

## Inspect panel

Click a Sim to see the no-flavor view: provider, session id, project, current state with timestamp, and the last N raw events. This is how a user checks what the agent actually did.

## Utility: project planning and attention

- Each home has a command center reached from the house sign, roster or top bar: Briefing, Tasks, Attention and Reviews.
- A user-maintained outcome and next action provide continuity between conversations. Tasks link to conversations within their home and move through Planned, In progress, Needs review and Accepted only through user edits. Acceptance requires an explicit review confirmation.
- Plans and task state are separate from observed agent truth. User notes, blockers and output/review references are labeled as recorded by the user; references never establish test success or correctness by themselves. A finished turn is a response ready to read, not accepted work.
- Attention derives questions, approvals, errors and finished turns from observed session states. User-recorded blockers and review tasks join that queue with separate provenance. Blocked review tasks appear once, prioritizing the blocker. Errors from helpers can be surfaced too.
- Return briefings compare conversation last-observation timestamps and task update timestamps to an explicit “Mark caught up” checkpoint. Saved-only chats do not count as new observed activity. Opening a briefing does not automatically mark it read, and catching up never dismisses unresolved attention items.
- Focus is a local viewer preference: routine external finished-turn signals are quiet, while questions, approvals, interruptions and errors remain visible. Users can show the full queue at any time.
- Counts measure accepted-by-user tasks, review backlog and blocked tasks. We do not score productivity by tool calls, animated activity or session duration.
- `~/.agent-world/productivity.json` persists user planning separately from households and conversation metadata. No prompts, commands or task instructions are sent to agents.

## Out of scope (for now)

- Controlling or prompting agents from the game
- Gameplay, goals, scoring
- Remote or multi-machine agents
- Choosing a tech stack (decide once the schema and adapters are proven)

## Decisions log

- **2026-10-05**: Share one repository skill between Codex and Claude Code for navigation, authorized planning and evidence-based handoffs. Agents can prepare work for review; acceptance remains human-only. Maintain `docs/NEXT_PASS.md` for verified state, gaps and the next useful slice. A local helper edits planning metadata without generating activity events.

- **2026-10-05**: Claude Code finishing a turn (`Stop`) counts as `waiting_for_user`.
- **2026-10-05**: Users can name their characters. Names are stored per project + slot.
- **2026-10-05**: The art style is **low poly** (flat-shaded, simple geometry, soft palette).
- **2026-10-05**: The first build uses a Node "bridge" (file watcher plus the truth model, streamed over SSE) and a browser client built with Three.js. The bridge owns the truth and the client owns the simulation.
- **2026-10-05**: Claude Code hooks were installed in the user settings. The Codex tailer runs with `npm run dev`.
- **2026-10-05**: Sims use A* pathfinding over furniture footprints and enter lots through a front door. The player's avatar collides with the same grid.
- **2026-10-05**: "Needs you" chimes are truth-triggered only: on entering `waiting_for_user`, plus one reminder after 2 minutes. They are muted during snapshot replay and can be toggled with 🔔.
- **2026-10-05**: The bridge collapses identical consecutive states in history (e.g. `thinking` after every tool call).
- **2026-10-05**: All agent work is shown at the computer (desk-centric activities with live screens). Room props are idle flavor only. Screens follow the honesty rule above.
- **2026-10-05**: Visual direction is "AAA stylized low poly" (Townscaper or Sims 4 toy-like), not photoreal. Time of day follows the viewer's local clock and is ambience only; it never implies anything about agents. Monitor code scrolling is decoration, but a screen being on is truth (a session is attached to that desk).

- **2026-10-05**: Persistent residents pick up different conversations over time. Conversation cards and a saved shelf preserve chat identity independently of the current resident. App projects may be explicitly linked to homes; saved chats do not imply live activity.

- **2026-10-05**: Add project outcomes, task boards, an attention queue, review queues, focus and explicit return-briefing checkpoints. Planning is user-maintained and acceptance is human-only; observed activity cannot establish task success.

- **2026-10-05**: Gamification is cosmetic and follows human decisions and play, never agent activity (see docs/GAMEPLAY.md). Phase 1 (shipped): build mode with free decor, paint and a wardrobe for residents and the player, stored in `~/.agent-world/style.json` and validated by `shared/style.mjs`. Customization never hides truth signals. Phase 2 (bricks from accepted tasks, house levels from reached outcomes) and Phase 3 (neighborhood) are planned. The sticker book is deferred.
- **2026-10-05**: Phase 2 progression shipped. Bricks are derived from human-accepted tasks with review notes (+10) and outcomes marked reached (+25, confirmed through `/api/milestone`); there is no stored balance. Home levels (1–5) come from reached outcomes and add exterior upgrades. Catalog unlocks are validated server-side. Celebrations react to the human's live decisions only. The agent skill forbids agents from marking outcomes, spending or decorating.
- **2026-10-05**: Phase 3 neighborhood shipped:
  - Map-mode layout and street names (`style.layout`, `style.streets`).
  - A town square whose spaces open from neighborhood-wide totals of human decisions.
  - Per-home pets, and calendar or chosen seasons with seeded daily weather (ambience, never a forecast).
  - Daily exploration finds. They are validated server-side against the day's deterministic spawns, unlock Found decor, and never give bricks.
  - Agent activity affects none of it.
- **2026-10-05**: Play and polish pass.
  - Photo mode and an album. Photos are local JPEGs in `~/.agent-world/photos` and can be hung on a home's wall.
  - Gardens grow over real hours from a bridge-stamped planting time and never wilt. Harvests unlock decor.
  - Shader-based wind, wet and snowy surfaces, rippling water, rain splashes and snow footprints, all ambience.
  - Photo mode hides the interface but keeps truth alerts visible.
  - The shutter sound is excluded from the "needs you" chime debounce, so it can never swallow an alert.
- **2026-10-05**: Rule change, approved by the human: observed work may shape *what exists* in the city, by kind, never by amount.
  - Downtown businesses come from a per-day ledger of kinds of observed work (`~/.agent-world/city.json`, categories only).
  - Each kind counts once per day; a business opens on its third day.
  - Nothing decays and there are no streaks.
  - Synthetic events are excluded outside demo mode; the fake agent tags its events `x_synthetic`.
  - Rewards for human decisions (bricks, levels) are unchanged.
  - The agent skill forbids doing work just to grow the city.
- **2026-10-05**: City step 3, roles and interns.
  - The ledger now keeps every day (unbounded) so replays never inflate counts.
  - Per-person records: residents by home and slot, helpers by home and type (from the parent's delegation target).
  - Roles come from the most common kind of work by days and show as an apron, which can be hidden.
  - Helper types are interns until they've worked 3 different days in a home, then hired with a stable name. The observed helper type always stays in the label.
- **2026-10-05**: City step 4: business upgrades by use, at the human's request. This replaces the earlier plan to gate landmarks on accepted outcomes.
  - Use is measured in different days of that kind of work (Open 3, Expanded 7, Flagship 14, Landmark 30), never volume, so looping agents gain nothing.
  - Each business has a unique landmark.
- **2026-10-05**: City step 5: street life (simulation layer).
  - Off-duty residents with an open workplace occasionally walk there and back as a separate walker figure with a dashed flavor tag. The real Sim stays home, hidden.
  - Any attached session, or selecting the resident, ends the walk immediately, so truth is never displaced.
  - Can be turned off.
- **2026-10-05**: Prove the core work loop before expanding gameplay. Return briefings combine recorded task notes/checks with observed attention, with direct known chat links and copyable local references. A browser-local, human-entered matched-session journal measures notice/resume times, upkeep, rework and backlog; no activity score or assumed productivity gain.

- **2026-10-05**: Work is the default compact view; Play offers labeled cosmetic shortcuts. Sources & guide exposes coverage and last received events without claiming adapter health or app-account sync. New-task optional details are collapsed; review evidence remains visible on existing tasks. Pets have a Build tab. Newly accepted tasks earn at most one review credit (+10) per project/server-local day; legacy accepted credits remain. Outcomes still drive home levels. City roles describe tool categories, not competence or success.

- **2026-10-05**: Focused reviews preserve evidence/context and record human accept/return decisions with feedback. Structured check results are reported claims, not observed success. Recorded local text outputs may be previewed within the real project under bounded file/type/size restrictions. Preview reads current content and never establishes correctness; no desktop app or agent is launched.

- **2026-10-05**: Visible observation freshness remains separate from bridge connection and adapter health. Offline attached Sims pause and show grey plumbobs/last-known labels without altering truth; reminders wait for a fresh snapshot. Focus is visible outside panels and unavailable saved homes never filter notifications.


### Guided setup and handoffs (2026-10-05)

Getting started follows recorded outcome, task and review decisions, never simulated activity or a finished turn. Returning with feedback counts as a review; optional chat links are separate. Save & draft task saves the plan and opens an editable draft without auto-creating a task. Handoffs expose recorded context, evidence provenance and feedback for explicit copy/paste into the source app. They do not dispatch agents or change stage. See docs/ONBOARDING_HANDOFF.md.


### Review and pilot support (2026-10-05)

Short recorded deliverable summaries/limitations aid review without summarizing uncollected chats. Decisions remain visible while evidence scrolls. Valid Codex UUIDs construct only the documented existing local-chat navigation route, never new/prompt routes. Pilot timers require explicit human start/stop; baseline measurements happen with the game closed and an external timer. Review counts, drafts and unmatched pairs aid the workflow but do not establish productivity gains. See docs/REVIEW_PILOT_PASS.md.


### One-card approved passes (2026-10-06)

The human authorized replacing the primary workflow with an agent card: last reported result, checks, limitations and one recommended next pass. Existing boards and reviews are retained behind Previous project workflow. Approval is version-bound and authorizes one local Codex CLI workspace-write run, not acceptance of prior work or automatic continuation. The runner polls approved queue records, claims once, records structured results and leaves the next proposal unapproved. Queues are metadata, not observed agent events. Codex logs still supply actual world activity. Local JSON confirmation is a workflow gate, not authenticated proof of human identity. Failed/interrupted work never auto-retries. CLI execution currently uses a fresh conversation and Codex only.

## Direct prompting and activity (2026-10-06)

At the user's correction, clicking an agent opens a prompt composer, not a next-pass review card. Send is the explicit execution action for that typed instruction. The composer switches to the original observed activity drawer when the runner thread is actually attached. Animated screens, tool details and scene poses remain driven by observed events. Results and proposals are secondary. New runs are fresh Codex conversations, not continuation of the clicked source conversation. The observer may assign the new conversation another resident while the previous one remains attached; navigation follows the exact observed runner session without replacing truth.

## Conversation continuity (2026-10-06)

Each resident's Send continues the latest game-launched Codex conversation, falling back to its observed attached Codex chat when no game-launched chat exists. A first prompt with no conversation starts one; New conversation is explicit. The exact thread ID is shown and pinned into approval/run records. Codex exec resume receives that UUID, never --last. Follow-up proposals retain the originating chat. Known busy conversations cannot receive another turn through the game; queued resumes wait while that conversation is observed working. No automatic fallback to a new chat on failure. Observed activity follows the resumed session.

- **2026-10-06**: Prompting uses a chat workspace with exact-thread local prompt/response pairs, conversation selection and a pinned composer. It stays open during execution; activity watching is explicit. Floating pass-result notices are removed; failures remain recorded and visible in the thread. Chat display never imports unobserved app messages or accepts work.

- **2026-10-06**: Agent selection defaults to Watch activity. Inactive status controls, finished-turn attention and the animated screen open the exact observed Codex chat. Thinking/activity details contain only canonical state/tool/target metadata, never private reasoning; disconnects show last-known activity. These viewer actions do not change execution or task records.

## Connected app usage

Connections and chat show Codex account remaining usage percentages, quota-window lengths and reset times through the official read-only `account/rateLimits/read` RPC. This account-wide truth is separate from observed activity, task progress and per-turn token counts. Reads are cached for 60 seconds; no inference, login flow, credit consumption or account change is requested. Expired windows await refresh instead of assuming a replenished allowance. Claude Code and saved ChatGPT/Claude links have no verified quota source and show usage unavailable. Returned reports remain in the chat; the separate Results & history modal has been removed.

## Conversation models and account usage (2026-10-06)

Codex quotas are authenticated account-wide limits, independent of any conversation. A stale bridge missing the new endpoint was restarted after its approved work completed. Per-chat model labels come from the latest observed turn_context.model, never from assumed defaults. A model selector records a separate user preference, passed as an explicit override only with the next authorized Send. Selection is not proof the model has run; last observed and next chosen model remain distinct. Available models come from Codex model/list. Claude remains unsupported for these controls.

### Chat control placement (2026-10-06)

Match the supplied ChatGPT references: the model pill belongs inside the bottom composer and opens a rounded, light menu upward. Account usage opens from a circular lower-left button, showing compact window / remaining percentage / reset rows. Neither occupies a panel above the messages. The account button denotes Codex usage, not an imported human profile. Last observed model remains separately labeled inside the picker; selecting a next-message override never implies it has run. Connections keeps its existing usage disclosure.

### Public reasoning summaries in game chat (2026-10-06)

The runner previously discarded reasoning items and the UI said internal reasoning was unavailable. Game-authorized CLI runs now request model_reasoning_summary=auto with raw reasoning display explicitly disabled. Only public CLI item reasoning text is retained, scoped to the exact run after thread identity is recorded; arbitrary stdout, rollout analysis, encrypted/raw content and tool output are never imported. Summaries are bounded, streamed through existing pass SSE updates, and attached to each reply, including completed/failed replies. While waiting, say Waiting for Codex's reasoning summary rather than claiming summaries cannot be shown. Some models emit no summary; never synthesize one. This explicit human request permits summary content for game-launched work, while the targets-only observer remains unchanged.

Official references: https://learn.chatgpt.com/docs/non-interactive-mode and https://learn.chatgpt.com/docs/config-file/config-reference.

## Chat names in the prompter

Recorded Codex chats expose an explicit Rename action that saves a local user title through the existing conversation-title route. The prompter and shelf share this metadata by exact source/project/thread identity; names never replace prompt/response content, change continuation IDs or start work. Save name is explicit consent to store the title locally. Unstarted messages and unsent new chats have no conversation to rename.

### Live reasoning hierarchy correction (2026-10-06)

The human's real run emitted nonempty public summary sections before turn completion, but chat displayed a second Thinking/command activity disclosure that obscured the intended distinction. Chat now gives the actual summary a single Reasoning · live disclosure, automatically expanded for pending replies. Summary updates preserve manual collapse/expansion and drafts; completion preserves the same content. Tool/file activity stays in Watch activity. codex exec JSONL delivers section/item updates; it must not be described as token-by-token streaming. App-server item/reasoning/summaryTextDelta is the documented route for finer summary deltas, but this pass does not migrate the runner or consume raw textDelta.

### No walking avatar (2026-10-06)

The player is no longer a character in the world. You're an animated picture in the top bar (drawn from your wardrobe look; click it to restyle), and you get around like a city builder: left-drag pans, right-drag turns and tilts, the wheel zooms, WASD/arrows pan. Looking inside a home works with the roof and wall layers: the home in the middle of the screen lifts its roof from farther out, every roof lifts when zoomed in close, cutaway walls lower toward the camera, and double-clicking a home glides in. Finds are clicked to collect, garden chips appear when you zoom in on a bed, and pets greet the spot you're zoomed in on. None of this touches the truth layer.


### Prompt provider routing (2026-10-06)

The composer now offers Codex and Claude Code. Provider changes start a new chat without discarding the draft; each recorded conversation stays pinned to its provider. Claude continuation is limited to exact game-created sessions in the same project, never ordinary Claude app chats or inferred recent sessions. The separate runner uses Claude print mode with structured results and configured permissions (`dontAsk`, no bypass), while installed hooks provide observed world activity. Only Send authorizes that instruction. CLI installation is not authentication; failed sign-in, tool denials and missing results produce inline failed replies without automatic retry. Claude quota, model switching and reasoning import remain unavailable.

Project cards in the roster contain the project title and resident/visitor rows; they omit the conversation shelf and Plan & briefing footer actions. Conversation metadata and planning remain available through their other existing entry points.
