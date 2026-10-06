# Core work-loop implementation and pilot

2026-10-05. Implemented and checked; ready for human review. Productivity improvement is not yet established.

## Real project pilot

The Agent World home now has a recorded outcome and next action. Codex created task `5ba7bf84-33c7-4943-b738-186c6ab23395` in progress, linked the currently observed coding conversation, performed the implementation, and recorded checks before moving it to Needs review. Notes identify Codex as the recorder. No human acceptance, milestone, currency spend or customization was performed.

This is one genuine agent-maintained work pass, not evidence of consistent adoption across sessions. The next pass should reuse this board and inspect the recorded task rather than rebuilding context from chat history.

## What changed

- The return briefing answers what should happen next, what needs the human, and what changed. Urgent observed requests and recorded blockers/reviews take priority. Changed tasks show their notes, stage and recorded output/check evidence. Observed conversation activity is separate; chat contents are never summarized without a source.
- Review notes are visible directly on task cards. Safe recorded web URLs are openable; local output paths can be copied into an editor. The platform does not expose arbitrary files over HTTP or establish that a referenced output exists.
- Known ChatGPT/Claude conversation links are available beside tasks, attention and observed-activity cards. Coding chats with no supported link explicitly show that limitation and offer the full conversation ID for use in the source app.
- The new Work loop tab records manual with/without session observations, keeps missing data unknown, compares matched project/pair names, and exports project measurements as visible, copyable JSON. Records are local to this browser, capped at 100, with an undo for correction. They never affect rewards or task stages.
- Briefing checkpoints acknowledge timestamps represented in the snapshot, not time elapsed while it is displayed. A focus home absent from the current neighborhood no longer selects a phantom project or filters routine notifications; its saved preference is preserved.

## Verification

- 77 Node tests pass, including return-action priority, saved-chat boundaries, safe references, checkpoint cutoff, unknown measurements and matched-pair arithmetic. Existing acceptance/privacy/persistence tests remain passing.
- Production build passes; existing large-chunk warning remains (about 945 KB minified client). Performance was not benchmarked in this pass.
- Browser QA uses an isolated home and port 4791. A saved Claude chat and Needs review task are sample metadata only, with no live agent event or acceptance manufactured.
- Verified actionable briefing, inline review evidence, direct conversation href, copy-path control, empty/unpaired comparison state, paired arithmetic using explicitly synthetic QA values, persistence on reload, JSON export preview, and undo of the QA entries. Clipboard-denial fallback for JSON remained usable through the visible text. Synthetic timings do not count as productivity observations.
- Screenshot of the real Needs review task: `/Users/blacksatoshi/.codex/visualizations/2026/10/05/01a10c07-5065-7023-8c40-bd848f749617/agent-world-work-loop-review.jpg`.
- Direct links were inspected; authenticated access to third-party outputs or conversations was not tested.

## Interaction count, not productivity measurement

From an already visible task card with a known source-chat URL:

| Action | Before | After |
| --- | --- | --- |
| Reach source-chat link | Open shelf, then open chat: 2 interactions | Open chat directly: 1 interaction |
| Read review evidence | Expand recorded references: 1 interaction | Evidence already visible: 0 interactions |

These counts come from the previous implementation and current DOM inspection. They establish shorter paths, not measured time savings, output quality or human adoption. Coding chats without URLs still require the provider app.

## Real comparison status and protocol

No real with/without matched sessions have been recorded. Notice latency, resumption time, rework, backlog and upkeep remain unknown. No percentage improvement is claimed.

Use the Work loop tab for comparable real sessions. Give each pair a unique name, use the same project and similar task complexity, and alternate which condition runs first. In the without condition, close Agent World and use the normal provider workflow; enter the measurements afterward. Measure request appearance to human notice, return to first meaningful work action, board-maintenance time, rework time, and end-of-session review backlog. Leave missing observations blank. Record interruptions and difficulty differences.

Collect several pairs before treating a change as informative. Review each metric and board-maintenance overhead rather than producing one productivity score. Human familiarity, task difficulty and order effects remain confounders; this journal is descriptive, not a controlled causal study.

## Next action

Human review of this task's outputs and evidence; then a real matched session pair. Continue authorized task maintenance through the shared skill. Acceptance remains the human's decision. No commit or push was performed in this pass.
