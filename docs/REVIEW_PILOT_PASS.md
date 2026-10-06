# Review, source navigation and real usage pilot — 2026-10-05

## Implemented

The review queue shows compact recorded summaries with evidence folded away; Review opens the complete deliverable in one action. Reviews now separate a recorded short summary, outputs, reported checks and known limitations. Full notes/evidence and provenance remain available in disclosures. Decisions stay visible while the body and previews scroll. Legacy tasks without new fields explicitly say that a summary/limitations were not recorded. Optional reviewSummary (500 characters) and limitations (1000 characters) survive omitted updates, review history and handoffs. Task details and the helper expose them through --review-summary and --limitations.

Five existing pending development tasks received Codex-attributed summaries and limitations without changing their stages or evidence. This pass adds a sixth reviewable deliverable. None was accepted or returned in the real home by Codex.

Work/review, Chats and the inspect drawer use one source-navigation resolver. Valid Codex UUIDs construct only codex://threads/<id>, the documented existing local-chat route. Supplied custom-protocol URLs are never used; new/prompt/settings routes cannot be constructed. Valid ChatGPT/Claude HTTPS links retain host/path validation. Coding chats without supported targets retain ID fallback. Native Codex navigation requires the installed app and browser protocol handling; opening does not send a prompt or change a task.

Official route reference: https://learn.chatgpt.com/docs/reference/commands#deep-links

The journal shows actual pending-review/recorded-decision counts, opens the next deliverable and offers explicit timers for notice/resume/upkeep/rework. Drafts/timer starts are browser-local and project-scoped. A running timer blocks session save. Stop adds elapsed wall time to the editable draft; time away is included and must be corrected when inappropriate. Without-condition start buttons are disabled: use an external timer with Agent World closed, then enter observations afterward. Backlog can be filled explicitly from the current board. Unmatched comparison names offer an opposite-condition draft, never an invented record. Accept/return confirmation leads to Review next task or the journal; no automatic decisions or dispatch.

## Verification and limits

91 tests pass; build passes with the existing bundle-size warning. Tests cover navigation allowlists, omitted-field preservation/return history, timer units/clock reversal and project-scoped pairing. Isolated port 4795 and AGENT_WORLD_HOME covered confirmation/feedback gates, return/next review, timer start/save rejection, reload persistence, explicit stop/save, current backlog, opposite-condition draft and undo. Synthetic journal records stay in that origin and were undone. No real measurements were entered. Real text preview and native-link presence/click were checked. Native destination could not be inspected because computer use blocks Codex app inspection; do not report end-to-end native routing as verified. No authenticated cloud-chat navigation, full Retina benchmark or complete keyboard/dark-mode audit.

## Run the first real pilot

1. In the real Agent World home, open Reviews and inspect this deliverable's summary, checks, limitations and report. The human accepts or returns it with concrete feedback. Review next task handles another task individually; it does not batch-accept.
2. Choose two comparable work sessions in this project. Use one pair name, e.g. `review evidence pair 1`. Record the actual task IDs, difficulty and interruptions in Context. With Agent World: use its briefing/review flow and explicit timers where meaningful. Stop resume timing at the first meaningful work action, not merely opening a panel.
3. Without Agent World: close the game, use the provider app and normal workflow, and measure with an external timer. Reopen the journal afterward, select Without and the identical pair name, and enter actual results. Do not use Agent World's timers during the baseline.
4. Record notice seconds, resume seconds, upkeep minutes, rework minutes and end-of-session pending reviews where actually observed; leave unavailable fields blank. Verify timer drafts before Save. No awareness timestamps can be inferred from a finished agent turn.
5. Repeat for at least three distinct pair names, alternating condition order. Compare each metric's paired medians and the upkeep cost. Export the journal to retain the evidence. Small, unmatched or substantially different sessions do not establish a productivity gain or causation.

Actual human decisions and real matched sessions remain pending. Implemented measurement support is not completion of the pilot. The agent may inspect and repair code, record its checks and leave Needs review; it cannot accept for the human or invent their observations.
