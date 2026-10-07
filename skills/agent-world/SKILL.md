---
name: agent-world
description: Navigate Agent World and use its project command center to plan authorized work, link conversations, handle observed attention, record review evidence, and leave actionable next-pass handoffs. Use when operating or developing Agent World, not for unrelated games.
---

# Agent World

Help the human understand where attention is needed and advance real project work toward review. “Playing” means navigating the world and using its project tools, not scoring points or directing agents from the game.

## Orient

Find the Agent World checkout. In this installation it is `/Users/blacksatoshi/Documents/Projects/agent-world`; repository links and this skill's scripts resolve against that checkout. Read `CONCEPT.md` and `README.md` first. For continued development, also read `docs/NEXT_PASS.md` and current Git changes. Treat the dated handoff as a starting point, then verify live state.

The visual activity layer remains observation-only. The primary agent card also supports human-approved passes: a separate local runner uses the human-selected Codex or Claude Code CLI to execute exactly one displayed instruction after explicit approval. Previous task boards remain in history. Agents may propose a next pass but must never approve, resolve interrupted runs for the human, or launch their own follow-up. Execution approval is separate from accepting previous work.

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

Send now resumes the displayed Codex thread by exact UUID. The resident uses its latest game-launched chat, or its attached observed Codex chat if none. New conversation explicitly starts fresh. Busy observed conversations block Send; queued work waits for them. Do not resume a real conversation or submit a prompt on the human's behalf without task authorization. Tests use isolated homes and projects. Claude resumes exact game-created sessions only; ordinary Claude app chats and external Claude Code sessions are not resumed.

## Models and usage

Chat shows Codex account quota and per-conversation last observed models. Next message model is a user preference, not observed activity; it is pinned into the next authorized run. Do not claim a chosen model has executed before observing it. Model/usage RPCs are read-only and never submit prompts. Restart stale bridges only after checking no approved/running work would be interrupted. Do not select/send real work as part of UI tests.
