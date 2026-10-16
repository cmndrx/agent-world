# Town character pass evidence

October 15, 2026; Windows, Node 24.18.0. Implementation follows Tyler's specification. Human acceptance is pending.

Final focused command (56 passed, no failures/skips/cancellations):

```powershell
node --test test/town-characters.test.mjs test/home-activities.test.mjs test/home-activity-scene.test.mjs test/home-tiers.test.mjs test/nav.test.mjs test/care.test.mjs test/care-api.test.mjs test/content-catalogs.test.mjs test/activity.test.mjs test/foundation.test.mjs test/town.test.mjs
```

The town-character test registers the test-only raw asset hook in `scripts/test-web-assets.mjs` before dynamically importing CivicBuildings/Sim dependencies. The initial direct-import attempt failed on SVG assets; corrected runs test the actual classes. The helper uses Node 24 `registerHooks`. No full-suite result is claimed.

`focused.log` records the final run. Syntax checks passed for birds, civic-staff, click-reaction, civic, landscape, main, sim, town-character-fixture and both new scripts. `git diff --check` passed.

`preserved-hashes.json` is the pre-edit baseline; `preservation-results.json` confirms eight unchanged existing files. `preexisting-sim.diff` captures the pre-pass home-activity edits. The combined Sim diff was reviewed and existing home/care regressions passed.

## Browser evidence and reproduction

```powershell
node scripts/town-character-fixture.mjs
```

Only Vite runs on :4797. AGENT_WORLD_HOME and CODEX_HOME point to a disposable temporary directory. No bridge, observer, provider executable, queue endpoint or real town mutation is used. The server was stopped after QA.

Open `/town-character-fixture.html`. The report's in-memory assertions exercise actual Sim/scene classes: six work states keep activity/truth/station route, waiting/error reject a dismissive reaction, repeated starts coalesce, new work wins next update, disconnected state gets a bounded friendly response, home props/reservations clear on work, support/choreography remain through gestures, resident metadata and pending care receipt/timer remain unchanged. A separate scene verifies eight civic NPCs coexist with actual Town Hall and MayorCharacter, then removing civics leaves Martin attached.

Observed task-browser views:

- Default staff atlas and `?view=staff&rot=1`, `rot=2`, `rot=3`: all eight kinds, local furniture and staff anchors. `rot=3&closed=1`: closed-building occlusion. `rot=0&reduced=1`: stationary preference override. Power operator also inspected from inside its control room; outer solid partitions intentionally block exterior views.
- `?view=birds&angle=three&phase=.1`, `angle=top&phase=.28`, final tapered-wing `angle=top&phase=.14`, `angle=side&phase=.42`, `angle=three&phase=2.7&zoom=town`, and `reduced=1&night=1`. The previous two-triangle geometry remains on the left as a comparison; only the right-hand new bird is hidden by reduced/night flags. Normal fixture camera views can project left/right into top/bottom ordering. No complete night town/light integration or frame-rate benchmark is claimed.
- `?view=reaction&activity=read_a_book&level=6&slot=2&yaw=1.5708&poseTime=.65`: supported upper-floor seated wave with book. `state=editing&poseTime=.30`: low work palm while seated. `activity=sleep_in&level=6&slot=2&poseTime=.65` and `activity=take_a_bubble_bath&poseTime=.65`: lying/bath support and bounded acknowledgment. Reduced preference was overridden in the fixture rather than changing OS settings.
- `?view=reaction&activity=read_a_book&manual=1`: observed resident, moved actual task-browser pointer to the head, then requested one click. The click tool was declined; **no click ran**. No alternate automation was used. Actual pointer dispatch, production main selection/chat and native Electron remain unverified.

Screenshots were observed in the task-browser stream only. Early visual inspection caught helmet height and square wing-tip issues, corrected before final build. Automated civic tests cover all 32 kind/rotation combinations, identity preservation, move/rebuild/removal and open/closed lifecycle; rendered inspection is not exhaustive collision clearance for every animation phase, camera or character build.

## Package and runtime

`npm run app:build` was attempted after final production changes. Vite succeeded; Windows resource editing failed because the default electron-builder cache directory is inaccessible. `app-build.log` retains the failure. The previously declined cache escalation was not retried or bypassed. The executable is `NotSigned` with no signer (`signature.json`).

`node scripts/check-home-activity-package.mjs` returned exact partial-package asset parity (`package-parity.json`): dist 15, bridge 36, shared 46, adapters 8, Electron CJS 2. This is not signing or package completion.

`runtime.json` records a read-only live-state aggregate: HTTP 200, one running run/proposal, live Electron PID 18008. No restart/queue/account/task/reward writes occurred. The running app needs a safe reopen after active work and package repair. CIM command-line inspection was denied; the fixture was stopped only through its known exec session and :4797 listener absence was checked.
