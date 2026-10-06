# One-card approved passes

Implemented 2026-10-06. Click a resident or Agent card. Read Last result, Checks, Uncertain or unfinished, and Proposed next pass. Confirm the exact instruction and select Run next pass, or use Change direction / Pause. One approved pass runs at a time; its follow-up is a proposal requiring another human decision. Approval of a pass does not accept previous work.

History holds execution details and the previous project workflow. Existing tasks, reviews and journals remain saved. Reported results are distinct from observed activity. The card labels its observation as captured at card open.

## Runner and persistence

`npm run dev` enables the separate runner inside the bridge; `AGENT_WORLD_RUNNER=0 npm run dev` disables it. Demo disables execution. The installed signed-in Codex CLI runs a fresh session in an explicitly approved existing local project, using workspace-write sandboxing and structured output. It does not continue the resident's original conversation. Claude CLI and cloud-only projects are not supported in this version.

Proposals/runs persist in `~/.agent-world/passes.json`; private structured result files live in `pass-runs/`. APIs validate proposal versions, pin the approved real project path, serialize claims and refuse automatic replay. A runner lock prevents two runners sharing one home. A 30-minute timeout terminates the process. Interrupted execution requires inspecting the project and acknowledging the interruption; an alive recorded child blocks resolution. Malformed reports and process failures remain visible.

POST `/api/pass-proposal` records a proposal. POST `/api/pass-decision` approves or pauses the exact id/version; approval requires confirmed=true and an enabled runner. POST `/api/pass-resolve` acknowledges an inspected interrupted run. Agents may propose; they must not call approval or resolution on the human's behalf. Local-origin checks and explicit confirmation are workflow safeguards, not authenticated access control against a malicious local process. The model's instructions are also not a security boundary for all local files.

## Evidence and limits

95 automated tests and the production build passed. Tests cover stale approvals, exact instruction persistence, duplicate claims, queued pause, interrupted runs, active child resolution, malformed reports, missing CLI and canonical project paths. Browser QA used an isolated AGENT_WORLD_HOME and temporary project. Actual Codex created marker.txt, checked exact contents and returned a next proposal; an independent read verified 25 bytes. There was one run, no automatic follow-up. UI confirmation, Pause and Change direction were verified. Evidence: `ONE_CARD_TEST_EVIDENCE.json` and `screenshots/one-card-qa.png`.

Completed records mean execution returned a valid report; correctness and human acceptance remain separate. No measured productivity gain, full Retina performance, authenticated approval or original-chat continuation is claimed. No real follow-up was approved during development.

## Completion feedback (2026-10-06)

A persistent notice identifies finished, failed or interrupted passes, including after reload. Opening the result acknowledges the browser notice without accepting work. The card shows run title/status/time and Open this run in Codex. The CLI reports its exact thread identity through thread.started; the runner retains only that ID, discarding raw event contents. A resident observed in that runner conversation opens the launching resident's result card. This preserves actual desk/session assignment while connecting execution and feedback. Unresolved interrupted runs block claims across projects. Next must be null or a valid proposal object.
