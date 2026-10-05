# Agent World — Concept

A Sims-style world that **visualizes** AI agents already working on your machine.
The game never runs, prompts, or controls an agent. It only watches.

## Principles

1. **Observer only.** Agents do real work elsewhere. Agent World reads what they leave behind.
2. **Truth vs. simulation.** Every on-screen thing is either *truth* (backed by an observed event) or *flavor* (invented by the game to look alive). Flavor can never write to truth, and the UI never presents flavor as fact.
3. **Provider-agnostic.** Claude, ChatGPT/Codex, or a shell script all look the same to the game. The provider is cosmetic.
4. **Private by default.** Show what an agent is doing, not the contents of your code or prompts, unless the user opts in.

## World model

| Sims | Agent World |
|---|---|
| Neighborhood | Your machine |
| Lot / house | A project directory |
| Household | The Sims who work on that project |
| Sim | A **persistent character** tied to a project |
| Visitor | A sub-agent spawned by a Sim (temporary, leaves when done) |
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

## The hero feature: "needs you"

An agent waiting on the human (permission prompt, question, finished turn) is the most useful thing to surface.

- Plumbob turns **yellow**, the Sim faces the camera and waves, and an edge-of-screen indicator points to it.
- Walking the avatar up to the Sim (or clicking it) shows *why* it is waiting.
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
- **Houses are project folders and Sims are sessions.** The help menu says so in plain words. Names are unique across the whole world.
- **Never pass the demo off as real.** Demo mode shows a "Demo · simulated agents" chip and uses obviously sample folders.
- **Helpers don't ask for your turn.** A sub-agent that finishes simply leaves.

## Simulation layer (flavor)

- Driven by a simple needs/utility system (energy, social, fun). These are **fake** and never shown as agent metrics.
- Runs only when truth leaves room (`idle`): coffee, couch, bookshelf, whiteboard doodles, globe, wandering. Room furniture is flavor; real work always happens at the desk.
- **Truth always interrupts flavor.** A state change cancels the current flavor action within a short, bounded delay (target < 1s plus walk time).
- Real metrics (session duration, wait time, and later context/token use) are shown in the inspect panel, never as Sims-style need bars, to avoid confusing them with flavor.

## Inspect panel

Click a Sim to see the no-flavor view: provider, session id, project, current state with timestamp, and the last N raw events. This is how a user checks what the agent actually did.

## Out of scope (for now)

- Controlling or prompting agents from the game
- Gameplay, goals, scoring
- Remote or multi-machine agents
- Choosing a tech stack (decide once the schema and adapters are proven)

## Decisions log

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
