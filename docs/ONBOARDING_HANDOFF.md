# Guided setup and task handoffs

Implemented 2026-10-05. This is development verification, not a measured productivity gain.

Work → Now includes Getting started: set an outcome, add a task, review a deliverable. Progress uses saved project records only. A finished agent turn never counts as review; a recorded acceptance or return with feedback does. Chat linking is optional. The guide collapses once outcome and task are recorded and can be reopened from the footer.

Save & draft task saves the plan, then opens an editable Planned draft using the recorded next step as its title. The task is written only after explicit Save; Cancel preserves the plan without creating a task.

Handoff on a task opens a read-only preview with home, outcome, task ID/version, notes, blocker, latest review feedback, recorded evidence/check provenance and same-home chat links. Copy handoff writes to the clipboard only. The human pastes it into an authorized source conversation. It never dispatches work, changes stage, marks an outcome or accepts a deliverable. Accepted task handoffs explicitly restrict continuation until human authorization.

## Verification

- 88 node tests pass; production build passes with the existing large-client-chunk warning.
- Isolated AGENT_WORLD_HOME on port 4794: empty guide, plan-to-prefilled draft, Cancel without a task, explicit task save, collapsed 2/3 guide, footer reopen and clipboard handoff verified. Saved task remains Planned/version 1. No browser console errors.
- Tests cover recorded-only progress, return decisions, optional same-home links, evidence/recorder retention, latest feedback, exclusion of other-home chats and accepted-work guard.
- No real task accepted, outcome reached, reward spent, productivity measurement invented, commit or push.

## Next pass

Verify full-size Retina performance, keyboard-only workflows and dark-mode readability; address concrete failures before feature expansion. Collect matched real work-loop observations alongside development. Provider account sync, permission coverage and non-text output preview remain separate limitations.
