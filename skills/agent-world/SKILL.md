---
name: agent-world
description: Navigate Agent World and use its project command center to plan authorized work, link conversations, handle observed attention, record review evidence, and leave actionable next-pass handoffs. Use when operating or developing Agent World, not for unrelated games.
---

# Agent World

Help the human understand where attention is needed and advance real project work toward review. “Playing” means navigating the world and using its project tools, not scoring points or directing agents from the game.

## Orient

Find the Agent World checkout. In this installation it is `/Users/blacksatoshi/Documents/Projects/agent-world`; repository links and this skill's scripts resolve against that checkout. Read `CONCEPT.md` and `README.md` first. For continued development, also read `docs/NEXT_PASS.md` and current Git changes. Treat the dated handoff as a starting point, then verify live state.

The visual activity layer remains observation-only. The primary agent card also supports human-approved passes: a separate local runner uses the human-selected Codex or Claude Code CLI to execute exactly one displayed instruction after explicit approval. Previous task boards remain in history. Agents may propose a next pass but must never approve, resolve interrupted runs for the human, or launch their own follow-up. For an explicitly authorized starter-team request, return scoped handoffs through the provided structured response; only the game runner routes them. Do not message provider chats or edit the queue directly. Execution approval is separate from accepting previous work.

Read only the relevant reference:

- [Navigate the world](references/navigation.md): movement, camera, residents, conversations, command center and focus.
- [Use the local API](references/platform.md): deterministic reads and authorized plan/task writes with the bundled Node helper.
- [Complete a work pass](references/work-cycle.md): task progression, evidence and a handoff that another agent can execute.

## Keep the layers honest

- **Observed:** session state, tool/file/command labels, timestamps, attached conversations and real wait signals. A finished turn means a response is ready to read; it does not establish task completion.
- **User-maintained:** outcomes, next actions, task stages, labels, blockers and review references. If you record these on the human's behalf, identify yourself in the notes and describe the actual evidence; do not represent your record as a human review.
- **Simulation:** coffee, couch, ambient movement and time-of-day mood. These never establish progress or productivity.

Local Codex rollouts and Claude Code hooks are observed. Ordinary ChatGPT/Claude chats added by link are saved metadata with current activity unavailable; do not claim account synchronization. Titles are private by default and require explicit opt-in. Never fabricate events to make yourself appear busy or successful.

## Use the platform to advance the user's work

1. Read the selected home's briefing and attention queue. Resolve its exact project key and conversation keys from a fresh snapshot, rather than matching names or guessing IDs. Triage approvals, questions, errors and blockers before routine finished turns.
2. If the user authorized task management, reuse an existing appropriate task or create a narrowly scoped task with a concrete outcome. Link only observed/registered conversations from that home. Leave unrelated tasks and accepted work alone.
3. Move your task to `in_progress` when beginning the authorized work. Perform the work in the normal development or creative tools; the legacy board does not execute work; approved pass execution belongs to the separate runner.
4. Record exact output paths, commands and observed results. Distinguish automated checks, actual browser checks and unresolved external/app coverage. Set `needs_review` when the deliverable is reviewable and its checks are recorded. If blocked, name the specific dependency and the next action; an agent waiting for a reply is not automatically a blocked task.
5. Leave a next action and update the repository's handoff when this is a continuation/development pass. Make it useful to the next agent without requiring the chat history.

**Acceptance belongs to the human.** Do not check “I reviewed the work and accept this task,” submit `acceptedByUser`, or mark your own work `accepted`. The helper deliberately refuses accepted-task writes. Hand the reviewable result to the human. This does not prevent continuing authorized implementation or verification before that handoff.

The same applies to progression (docs/GAMEPLAY.md): only the human marks an outcome reached (`/api/milestone`) or spends bricks and customizes (`/api/style`). Rewards derive from human decisions; never call those endpoints to earn, spend or decorate on the human's behalf. Downtown grows from the kinds of work you were observed doing (shared/city.mjs); never run commands, searches, edits or helper agents just to grow the city, and never write events to the inbox yourself.

Do not automatically click “Mark caught up” for the human or change their focus setting merely because you read a briefing. Use those controls when asked to acknowledge or focus. Focus silences routine external turns, not urgent approvals/questions/errors.

## Operate without contaminating real state

Prefer a read-only API query for factual status, and the visible UI for navigation or visual QA. Before starting a server, check the listener identity and HTTP response; reuse the correct process. `npm run demo` shares the default ports with dev, so do not start both blindly. Keep fake events and sample tasks in an isolated `AGENT_WORLD_HOME` and visibly identify demos.

Only write plan/task metadata within the user's authorized project and task. A mutation conflict means refresh, inspect the intervening change and reconcile; do not blindly replay or overwrite another actor's status. If the bridge is unavailable, report stale/unavailable activity and continue independent authorized work with a repository handoff; do not manufacture live status.

Apply the session's existing authorization to publishing, Git pushes, deployment and account actions. Creating a handoff or updating the board is not new permission for those actions.

## Finish the pass

Report what changed, the checks actually performed, remaining gaps, and where to review. Use the completion checks in [work-cycle.md](references/work-cycle.md). Keep “implemented,” “verified,” “ready for human review,” and “accepted by the human” distinct. For development, update `docs/NEXT_PASS.md` with the evidence and the next smallest useful step; avoid treating a passing build as proof of complete app integration or release readiness.


## One-card continuation

Click a resident for Last result, Checks, Uncertain / unfinished and Recommended next pass. Read runner results as reported claims. At the end of authorized interactive work, record exact evidence and propose one bounded next pass through `npm run world -- propose --project KEY --slot NUMBER --title TEXT --instruction TEXT --recorder Codex`. Read the current state/version first; the helper refreshes and preserves optimistic concurrency. Never approve your own proposal or call decision/resolve routes. Runner invocations return `shared/pass-result.schema.json`: summary, actually performed checks, limitations and one next proposal or null. They stop after one pass. Only the human clicks Run next pass and confirms the displayed instruction. Pause applies to an unclaimed proposal; interrupted/failed work is never retried automatically.

## Direct prompt entry

The human clicks an agent to watch activity, then opens chat from its inactive status, animated screen or Prompt this agent, types a prompt and selects Send; that action authorizes one typed instruction without a separate proposal checkbox. Agents must not submit real prompts on the human's behalf without task authorization. The chat workspace shows recorded human prompts and returned responses from that exact Codex thread. It stays open while work runs; Watch activity explicitly opens the observed activity drawer. An automatically expanded per-reply Reasoning · live disclosure shows public CLI summary sections as they are emitted and retains them after completion. Observed state/tool/target steps stay in Watch activity. Neither exposes private internal reasoning. Closing chat returns to Watch activity. Earlier app messages are not imported. Returned reports stay in chat; Results & history has been removed. Connected app usage reads Codex account limits without starting a turn; missing quotas and unsupported sources remain unavailable. Human prompting does not accept previous work.

## Continuing conversations

Send now resumes the displayed Codex thread by exact UUID. The resident uses its latest game-launched chat, or its attached observed Codex chat if none. New conversation explicitly starts fresh. Human follow-up messages may be sent while work is active; queued work waits for it. An empty composer shows Stop for the displayed game-owned run or queued prompt; typing shows Send. Observed external sessions are never presented as stoppable game runs. Do not resume a real conversation or submit a prompt on the human's behalf without task authorization. Tests use isolated homes and projects. Claude resumes exact game-created sessions only; ordinary Claude app chats and external Claude Code sessions are not resumed.

## Models and usage

Chat shows Codex account quota and per-conversation last observed models. Next message model is a user preference, not observed activity; it is pinned into the next authorized run. Do not claim a chosen model has executed before observing it. Model/usage RPCs are read-only and never submit prompts. Restart stale bridges only after checking no approved/running work would be interrupted. Do not select/send real work as part of UI tests.

### Experimental voice
The Codex composer microphone starts a call in that resident's selected chat. Human controls mute/end and tool permission decisions. Closing the drawer ends voice and interrupts associated work. Raw audio is transient; returned speech transcripts are recorded. Installed CLI testing returned `realtime conversation requires API key auth`; never promise ChatGPT-subscription voice or infer success from realtime/start acceptance. No authentication or paid fallback changes without user authorization.

### Claude model selection
Claude game-owned chats can select Sonnet, Opus, Haiku or configured default for the next message. Selection passes `--model` on the same exact resumed session. Show last reported init-event model separately from requested aliases; the alias list does not establish account entitlement. Do not run real prompts merely to verify the picker.

Claude effort: Default or low/medium/high/xhigh/max requests are saved per conversation and passed to --effort on authorized sends. Default omits the flag. Requested effort is a preference; do not claim a confirmed effective level, and preserve the model when resetting effort.

### Local Codex projects
Use the sidebar Projects view to list local Codex project roots and register their homes; Add project connects an existing folder or creates one under an existing parent through the Codex project CLI protocol. A registered home receives an off-duty resident; never synthesize session events. Directory contents are preserved. Missing roots are skipped visibly and canonical duplicate folders reuse a home. CLI registry creation is distinct from cloud ChatGPT Projects and native conversation projectId membership. Tests must isolate both CODEX_HOME and AGENT_WORLD_HOME.

### Explicit project onboarding (2026-10-08)
Projects start empty with one vacant lot and Add your first project. Opening Projects only lists available Codex roots; Import existing adds a chosen project, while Create new registers a folder/project. selected-projects.json stores the explicit world selection independently from existing households, chats, files and the Codex registry. Existing automatically imported homes remain preserved but hidden until explicitly imported. Demo remains unchanged. No real projects were created/imported during QA.

Project cards include Remove: removes the selected project and its home/residents from Agent World only. Local folders, Codex registry entries, conversations and recorded history are retained for re-import. Running/queued game work and active voice must finish or stop before removal. Removing the last home restores the vacant onboarding lot.

## Scheduled prompts

Inside a resident’s prompter, Scheduled → New task opens a reference-style Schedule a task dialog. Run with explicitly chooses Codex or Claude Code for new tasks (installed providers only). A task keeps its provider when edited; create another task to change it. Once, Daily and Weekly use the displayed IANA time zone and calendar wall time. Advanced contains the task name and time zone. Create/Save explicitly authorizes the exact stored instruction at those times, with the selected provider/model/effort and resident. Every new task appears immediately as its own scheduled conversation in that resident’s chat list. Its first run creates a new provider conversation, without continuing the selected chat; repeat runs reuse that task’s conversation. The time picker offers 15-minute increments, enforced by the API for create/edit. Already dispatched one-time tasks keep their original chat; future legacy schedules acquire a dedicated conversation without changing their authorized time. Responses and public reasoning summaries use the normal chat/runner path. Attachments are not scheduled in this pass.

Schedules are persisted atomically alongside the pass queue in passes.json. The local scheduler checks every 10 seconds while the bridge/runner is running; the app must remain open and the computer awake. Missed times coalesce to one catch-up run. Only one pending occurrence per schedule is allowed. DST preserves wall time; nonexistent spring-forward times are skipped and duplicated fall-back times run once. A failed/interrupted/cancelled run pauses the schedule for explicit review/resume. Pausing cancels unstarted scheduled work; running work continues until stopped in chat. Edit/delete requires finishing/stopping an active occurrence. Removing a project pauses its schedules. No cloud account automation or background service is configured.

Agents must not create, resume or edit real schedules without scoped human authorization. QA uses an isolated AGENT_WORLD_HOME and CODEX_HOME and fixture CLIs; scheduled responses do not imply accepted work.

## Starter team and scoped handoffs

New home import/create now starts five minutes of construction. Progress and total
finish-now price are in Projects and Mayor guidance. One Personal Assistant spawns
only on completion; scheduling, prompts and runner dispatch wait for a ready home.
Home registration stays free; finishing costs one gem per remaining minute, rounded
up. `gameplay.homes` persists timers/spending independently of observation. Missing
records mean existing completed homes. Re-import must not reset a saved timer.
QA must isolate gameplay and must not spend gems or finish real player builds.

Town Hall is built first. Mayor Martin then guides building a local project home and meeting its Personal Assistant owner. Every new or imported local home starts with one Personal Assistant owner, not an automatic team. residentAgentIds separates active household members from saved observed identities. Names, slots, chats, schedules and XP remain stored; inactive identities do not spawn, receive new household work or participate in delegation. Observed sessions never recruit members. Assigned responsibilities are planning metadata, distinct from observed activity and activity-derived downtown specialties; no sessions/events are invented. Stable agent/home IDs supplement legacy bindings; see `docs/FOUNDATION.md` before extending recruitment, happiness or workplace assignment. Delegate only to roles present in the supplied roster; a solo owner has no teammates to invent. Recruitment and city-health simulation are not implemented by this foundation pass.

Sending a prompt to this team authorizes scoped delegation of that request within the project. The selected provider/model/effort are retained throughout the request. The runner gives each resident its responsibility and the roster. Agents choose relevant handoffs in a structured response: role, task title, scoped instruction and earlier prerequisite IDs. For example the Assistant can delegate website implementation to the Junior developer, optionally following a Researcher report. There is no keyword router or direct provider-to-provider messaging.

The first handoff to a recipient starts a separate resident-owned conversation; subsequent handoffs in the same request can reuse an established recipient conversation. Earlier unrelated resident chats are never resumed automatically. Queued handoffs appear in the receiving resident’s list. The original chat shows sender → recipient, status, reported results and Open chat links. Automatic instructions are attributed to a teammate or Team report request, never to the human. After all parts settle, one final pass resumes the original conversation with recorded reports to summarize changes, checks, failures and unfinished work. A returned report does not accept tasks or grant world rewards.

Runs remain sequential to avoid competing workspace edits. The graph is bounded to three handoffs per response, six per human request and two delegation levels, with no further delegation in the final report. Invalid/self/unknown-role handoffs are rejected atomically. Failed prerequisites pause dependent work; no automatic retry. Interrupted work still requires human inspection. Stop in the original or receiving chat cancels the remaining request queue and stops its active game-owned run; existing file changes remain. Publishing/pushing/spending are not included. New schedules in the starter team capture delegation authorization; existing schedules are not retroactively expanded. Isolated-worktree and voice runs do not enable this team workflow in this pass.

Fixture CLIs verify execution/routing for Codex and Claude without provider spending. Intelligent task decomposition by a real model remains to be evaluated with real user prompts.
