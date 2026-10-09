# Agent World working instructions

Read `CONCEPT.md` and `README.md` before changing the project. Read `docs/NEXT_PASS.md` for the latest handoff, then verify current files, Git changes and server state.

Use `skills/agent-world/SKILL.md` when navigating Agent World, managing its authorized project tasks or continuing development. Its references explain controls, the local API and evidence-based handoffs. The same skill is discoverable by Codex and Claude Code through repository skill links.

Preserve observed truth, user-maintained planning and simulated flavor as separate layers. Never synthesize real activity, infer success from a finished turn or accept your own task on the human's behalf. Keep fake events and test metadata in an isolated `AGENT_WORLD_HOME`.

Preserve existing uncommitted work. Run checks appropriate to the change, record results and update `docs/NEXT_PASS.md` before handing continued development back. Publishing and pushing require the user's authorization.

After each application code or UI update, run `npm run app:build` to refresh the packaged Electron app; `npm run build` alone is insufficient. Verify the package signature and that packaged assets match the new build. Do not quit or restart the app while approved, queued or running work would be interrupted; report when the running window still needs a safe reopen. This build requirement does not authorize additional work, queue changes or publishing.
