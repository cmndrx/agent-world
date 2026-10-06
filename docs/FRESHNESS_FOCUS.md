# Freshness and focus — 2026-10-05

Connection and observation history are separate. The bridge becomes live in the client only after applying its snapshot. Reconnect snapshot replay stays silent; a connected bridge does not prove adapter health or ongoing agent work. Last-observed labels use lastEventAt/lastObservedAt, not time in the current state. Old observations never automatically mark an agent stopped.

Offline attached Sims retain their truth records but pause movement/work/screens, show grey plumbobs and Last known bubbles. The roster, inspect drawer, screen caption, requests strip, Chats and Work distinguish retained history from current activity. Offline reminders and edge arrows are suppressed. Simulated off-duty environment behavior remains flavor. Saved app links remain activity unavailable. Connections shows its connection summary outside folded caveats and updates while open without replacing focus or open details.

The top-bar focus chip opens Work and provides Clear focus. A valid home names the focus; an unavailable saved home is labeled and does not filter notifications. No focus shows All homes. Existing focus persistence and urgent-notification rules remain intact. Top-bar/request-strip/roster spacing adapts to wrapped headers so controls remain reachable.

## Verification

86 Node tests pass; production build passes with the existing large-client warning. New tests cover latest-event time precedence, missing/future observations and valid/unavailable/no focus. Existing notification, checkpoint, privacy, review and persistence tests remain passing.

Browser QA used separate AGENT_WORLD_HOME on port 4793 with one explicitly demo observed session and a sample planned task. Verified live labels, focused-home chip, offline Last known world/roster, open Connections updates, reconnect snapshot recovery with no replayed toasts, focus persistence across reload, Clear focus restoring All homes and task title/status/version preserved across bridge restarts. No browser errors. Reminder suppression follows the readiness gate; audible playback was not measured. No synthetic events were written to real metadata, and the real viewer's focus was not changed.

Real development task `348440ad-ec74-4bce-9377-518f09c57fcd` is handed back for human review. No task acceptance, milestone, reward spending, commit or push performed.

Next: reduce onboarding/board upkeep, then verify full Retina and keyboard/dark-mode accessibility. Adapter heartbeat/permission/account coverage remains unavailable; do not infer those from these labels. Human productivity gains remain unmeasured.
