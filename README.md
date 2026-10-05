# Agent World

A low-poly, Sims-style world that **visualizes** the AI agents already working on your machine.
It never runs or controls an agent. It watches the events they leave behind and turns them into
characters walking to desks, bookshelves and terminals. See [CONCEPT.md](CONCEPT.md) for the design.

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

## Look and feel

- **Rendering:** ACES tone mapping, ambient occlusion (GTAO), bloom on emissive things only (plumbobs, lamps, screens), a tilt-shift "miniature" blur that grows as you zoom out, and a final color grade.
- **Time of day** follows your local clock: sunrise, golden hour, moonlit nights with lit windows and street lamps. You can preview other times from the dock.
- **Graphics:** High, Medium, Low, or Auto (starts high and steps down if the frame rate drops).
- **Walls:** Sims-style cutaway lowers walls that face the camera; you can also choose walls up or walls down.

## Controls

| Input | Action |
|---|---|
| `W` `A` `S` `D` / arrows | Walk your avatar (hold `Shift` to run) |
| `Q` / `E`, dock arrows, or right-drag | Rotate (drag up and down to tilt) |
| Scroll | Zoom |
| Click a Sim, or `Space` when near | Inspect: truth (observed events) vs. simulation (flavor) |
| "Needs you" list / edge arrows | Fly to agents waiting on you |
| Neighborhood panel | Every home and Sim with live status; click to fly there |
| Dock | Time of day, walls, graphics quality, sounds, help |
| 🔔 (dock) | Toggle chimes: ding-dong for permission/questions, soft arpeggio when a turn finishes, a gentle ping if still waiting after 2 min |

The tab title shows how many agents are waiting, e.g. `(2) Agent World`.

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
{ "privacy": "targets", "staleAfterMinutes": 180 }
```

- `privacy`: `state` (states only), `targets` (+ file/command names, the default), or `full` (+ prompt text).
  Adapters apply it **before writing**, so redacted data never touches disk.
- `staleAfterMinutes`: a session with no events for this long is treated as gone.

Character names live in `~/.agent-world/households.json`. Rename Sims from the inspect panel.

## Development

```bash
npm test          # truth model, Claude hook + Codex log mapping, pathfinding
npm run build     # production client into dist/
npm start         # build, then serve everything from the bridge on :4777
```
