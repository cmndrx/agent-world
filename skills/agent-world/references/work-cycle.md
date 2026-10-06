# A useful work pass

## Choose an outcome and finish a slice

Read the task/home context before editing. Define the reviewable result, how to verify it and the specific limits of this pass. Keep the slice small enough to implement and verify; do not substitute another plan for an authorized implementation request.

For an Agent World development continuation, read `docs/NEXT_PASS.md`, inspect current diffs and recheck the running server. Preserve the conversation and productivity features already built; many files may be uncommitted. Work on the next selected gap rather than restarting the project.

Use a board task only when authorized to maintain the board. Find/reuse an appropriate task, mark In progress while doing real work, and link its actual conversations when available. The board does not control agents or authorize messaging other chats.

## Evidence and review

At the end of a code slice:

- Run the checks relevant to the changed behavior. The current project uses `npm test` and `npm run build`; verify changed UI paths in the actual browser.
- Record exact outputs and check results, including limitations. A passing build is not evidence of an authenticated connector, a correctly observed cloud conversation, performance at Retina size, or a successful human review.
- Exercise truth boundaries when touching them: saved chat metadata creates no live session; finished turns do not accept tasks; stale/disconnected data is labeled; helpers remain visitors; title consent precedes event storage; focus preserves urgent signals.
- Use an isolated home/port for sample events and board tasks. Keep the real user's home files, hooks and conversations intact. Stop temporary servers when finished.
- Put reviewable work in Needs review with the actual references. Do not invent passing output or mark Accepted. User acceptance is a separate event.

If a dependency remains, leave a concrete blocker and the next action needed to remove it. Continue independent authorized work where useful. Do not call the entire product complete merely because this slice passed.

## Leave the next agent an executable handoff

For development, update `docs/NEXT_PASS.md` rather than scattering competing status files. Use these fields where relevant:

- As-of date, branch/commit, local-change state and repository location.
- Implemented slice and the exact checks performed, distinguishing browser/API/automated evidence.
- Remaining gaps and the smallest next implementation step, with touched modules.
- Completion criteria for the next slice and what still requires human review.
- Runtime start/reuse instructions; personal state stays outside Git.
- Known risks, unresolved decisions, and scope/authorization for external actions.

Avoid transcript dumps, prompts, private account inventories and claims derived from animation. Store actual artifacts at concrete paths and refer to them. Keep `CONCEPT.md` for design decisions and `README.md` for current usage; revise them when behavior changes.

A reviewer should be able to open the result, reproduce relevant checks and decide whether to accept it. Stop the slice at that reviewable handoff, not halfway through verification. When instructed to push/release, verify the requested Git/deploy result separately; a future-work note is not a publishing instruction.

When continuing a returned task, inspect its latest `reviews` feedback before making changes. Include structured output/check references through `--references-json` with your recorder name, alongside the existing evidence notes. Report actual results only. Acceptance remains the human’s decision in the focused review dialog.


Getting started in Work → Now follows recorded outcomes, tasks and review decisions; linking a chat is optional. Save & draft task opens an editable draft after saving the plan, and Cancel creates no task. A task's Handoff button previews recorded context and evidence for copying into the source app. Copy sends nothing and changes no task stage. Re-read current records before continuing, preserve newer changes, and leave completed work in Needs review for the human. Accepted tasks require explicit human authorization before further work.


Reviews show a recorded summary, outputs, reported checks and limitations; full notes stay available and decisions remain visible while evidence scrolls. Task details/helper support review summary and limitations. Valid Codex IDs offer Open in Codex with an ID fallback. The journal preserves project drafts and user-started timers, offers the next review and identifies unmatched condition records. Stop and inspect timer values before saving; baseline sessions use an external timer with Agent World closed. See `docs/REVIEW_PILOT_PASS.md` for the real pilot runbook. Never start human measurement timers or enter their notice/resumption times on their behalf.

## One-card continuation

When finishing an authorized pass, report actual outputs/checks/limits and propose one bounded next pass for the resident slot. A runner result must follow `shared/pass-result.schema.json`. A next proposal never approves itself. The human decides in the card; the separate runner executes one approved instruction and stops. Previous board records remain available through History.
