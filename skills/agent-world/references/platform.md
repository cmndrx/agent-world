# Local API helper

Requires Node 18+ and the Agent World checkout (the helper imports its shared selectors). Use the helper from the canonical skill directory, or via the repository shortcut:

```bash
npm run world -- state
npm run world -- briefing --project '/absolute/project/path'
npm run world -- attention --project '/absolute/project/path'
```

From any directory use `node /absolute/path/to/agent-world/skills/agent-world/scripts/platform.mjs ...`. It defaults to :4777; `--base http://127.0.0.1:4791` selects an isolated local bridge. Only loopback HTTP is accepted, redirects are refused, and requests time out. It never launches a server or agent, writes fake events, changes privacy, accepts work, or uploads data.

Read commands use a fresh `/api/state` snapshot. `briefing` outputs the selected plan, same-home tasks, a prioritized next move and timestamp-derived briefing. Notes/checks remain recorded metadata, not independently verified facts. `attention` can be limited to a home; this API view does not change browser focus or suppress notifications. Do not commit raw snapshots containing personal local metadata.

## Authorized metadata writes

Use these only when the user has authorized maintaining that home's plan/task. Existing fields are preserved; updates fetch the current version and fail on concurrent changes. There are no automatic retries.

```bash
npm run world -- plan --project '/absolute/project/path' \
  --outcome 'Reviewable deliverable and concrete success criterion' \
  --next-action 'The next executable step'

npm run world -- task --project '/absolute/project/path' \
  --title 'Implement the selected feature' --status in_progress \
  --conversation 'EXACT_KEY_FROM_SNAPSHOT'

npm run world -- task --project '/absolute/project/path' --id 'RETURNED_TASK_ID' \
  --status needs_review \
  --evidence 'Recorded by Codex: exact artifact path; npm test result; actual browser check; unresolved limitation'
```

`EXACT_KEY_FROM_SNAPSHOT` is an opaque string; never reconstruct it by concatenating a title or session ID. Repeat `--conversation` to link several same-home conversations. `--clear-conversations` explicitly clears links. `--notes`, `--blocker` and `--evidence` patch task notes; passing an empty value clears that field. Existing accepted tasks are human-owned and refused by this helper. A new task defaults to Planned.

Evidence fields are text notes, not automatic verification. Include the recorder, exact outputs/checks and their limitations. Record blockers only when real work depends on an unresolved input, not because the agent has finished a turn.

`seen --project PROJECT --through ISO_TIMESTAMP` records a briefing cutoff only when the human asked to acknowledge it. Use the `observedThrough` timestamp returned by the viewed helper briefing; later activity remains new. This does not clear attention signals.

## API contracts to check before extending the helper

- GET `/api/state`: households, sessions, projects, conversations, plans, tasks.
- GET `/api/stream`: snapshot plus household/session/session_end/catalog/productivity SSE updates.
- POST `/api/plan`: project, outcome, nextAction, version.
- POST `/api/task`: project, optional id/version, title, status, notes, blocker, evidence, conversationKeys. Stages: planned, in_progress, needs_review, accepted. The last is a human UI action, not an agent-helper operation.
- POST `/api/briefing-seen`: project, through. Checkpoints cannot be future-dated or moved backward.
- Project/chat/title registration and resident rename are in `bridge/server.mjs`; prefer their UI so links, explicit grouping and title consent are visible.

`shared/productivity.mjs` derives queues and briefings; `bridge/productivity.mjs` validates writes. Plans live in `~/.agent-world/productivity.json`, separate from observed events. Use APIs, not direct JSON edits, to keep SSE and validation working. Browser requests require the permitted local origin and JSON; CLI requests omit Origin, but still require JSON.

## Structured handoff evidence

Task writes accept `--references-json` containing up to 20 records, for example:

```json
[{"kind":"output","value":"/absolute/project/docs/report.md","label":"Review report","recordedBy":"Codex"},{"kind":"check","value":"npm test","result":"passed","recordedBy":"Codex"}]
```

Record only checks you actually ran; leave result `unknown` when unavailable. The server stamps recordedAt. Recorder/result are reported metadata, not authenticated or independently observed truth. Omit this option to preserve existing records. Existing free-text evidence is retained. Read task `reviews` for dated return feedback and resolve it during authorized work. The helper does not expose acceptance or human review decisions. Human UI uses `/api/review`; agents must not call it to accept their work. Local text preview is restricted to recorded project files; it does not certify success.


Task updates optionally include `reviewSummary` (500 characters) and `limitations` (1000 characters). Omitted values preserve existing fields. The helper accepts `--review-summary` and `--limitations`. These are recorded claims, not observed outcomes; review decisions and human measurements remain separate.

## Proposed next passes

Use `propose --project KEY --slot NUMBER --title TEXT --instruction TEXT --recorder Codex` to save a bounded next instruction. The helper fetches the current proposal version and refuses stale replacement. It exposes no approval or interrupted-run resolution command. `/api/state` includes passes and runner; SSE includes passes updates. See `docs/ONE_CARD_WORKFLOW.md` for execution limits.
