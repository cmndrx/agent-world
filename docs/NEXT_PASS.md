# GitHub PR #2 conflict resolution (October 10, 2026)

- User requested resolution of GitHub conflicts between `ai-features` and `gameplay-improvement`. PR #2 targets `gameplay-improvement`; prepared the resolution in an isolated checkout at `C:\Users\pawns\.codex\worktrees\resolve-ai-gameplay\agent-world`, branch `codex/resolve-ai-gameplay`, merging gameplay `733b966` into AI `215abf8`. Original gameplay checkout was clean and remains untouched. Delivery target is `ai-features`; the PR stays open for human review/merge.
- Resolved `web/src/main.js` with one resident-visibility calculation after project selection, retaining AI participation XP updates. Resolved `web/src/ui.js` with gameplay's corrected provider-health view handling, accessibility, stale roster labels and Projects guard, retaining the newer XP slot and soundtrack tooltip. Removed inherited commented conflict markers. Combined both branches' handoff entries, retaining gameplay startup reuse and regression tests. Extended the actual snapshot regression to verify XP run history and legacy snapshots without passes.
- Focused merge/startup/gameplay/connections/experience/progression tests: **26/26 passed**. Syntax checks and `git diff --check` passed. Standard `npm test` still fails directory discovery on Windows/Node 24.18.0. Explicit full enumeration: **217 tests, 184 passed, 33 failed**. Untouched gameplay baseline: **207 tests, 174 passed, 33 failed**; failure names are identical after normalizing checkout paths. No new failures; existing POSIX fixture/path/permission and CRLF-sensitive composer failures remain unresolved. Logs: `%TEMP%\agent-world-conflicts-{npm-test,merged,baseline}.log`.
- Actual built-renderer QA in hidden Electron windows, isolated temporary `AGENT_WORLD_HOME`/`CODEX_HOME`, runner disabled and nonexistent CLI commands: unlinked has zero residents/homes and mayor onboarding; linked has three off-duty residents and only the selected home; intro dismisses, Projects view remains selected, switching back to Agents works, bridge shutdown shows `Live · unavailable`. Both scenarios recorded zero renderer errors. Temporary servers/windows closed. Evidence: `%TEMP%\agent-world-conflicts-ui-evidence.log`; harness: `%TEMP%\agent-world-conflicts-ui-qa.cjs`. No real prompts, queue/schedule changes or provider spending.
- Required `npm run app:build`: Vite passed; configured macOS packaging is unsupported on Windows. Local fallback `npx electron-builder --win --dir '--config.win.signAndEditExecutable=false'` passed. SHA-256 parity: dist **15**, bridge **23**, shared **28**, adapters **8** files, all **74** match. Seven MP3 assets are present. Authenticode status is **NotSigned**; signed macOS package verification still requires macOS. Builder's incidental `yarn.lock` rewrite was reverted; no dependency changes are included.
- Existing real bridge on port 4777 was inspected read-only (zero proposals/runs) and left running. Original app/package was not replaced or restarted; adopting this isolated package requires a safe reopen after checking approved/queued/running work. No real planning changes, acceptance, rewards or authentication changes.
- Next action: review and merge PR #2 once GitHub reports it mergeable; validate signed macOS packaging on macOS if distributing that target. The Windows full-suite and signing limitations are separate work.

# Latest pass — Continuous meadow town ambience (October 10, 2026)

- Added the user-supplied Meadows Ambience MP3 as a separate looping audio layer at 15% volume. Excluded Meadows files from the shuffled song playlist; the six soundtrack songs remain unchanged. Starts after interaction and pauses/resumes with the existing persisted Sound toggle. Audio load failure leaves music/chimes functional without repeated ambience reloads.
- Targeted audio smoke verified gesture gating, separate continuous loop, music advancing without restarting ambience, shared mute/resume and failure isolation. Syntax and diff checks passed. `npm run app:build`, strict codesign and dist/bridge/shared/adapters parity passed; seven MP3s packaged. Packaged verification exposed a 404 for the filename with spaces. Fixed static URL decoding with a malformed-path 400 and root-boundary guard; added audio/mpeg MIME. New isolated static-audio API regression covers encoded names, malformed URL, missing file and traversal. Full Node 18 suite **216/216 passed** after the server fix. Final app build/signature/parity passed.
- Fresh safe-reopen check found no approved/queued/running/interrupted game work. Reopened the corrected app: encoded asset returned HTTP 200 audio/mpeg with exact byte parity. Native Electron Media diagnostics verified the meadow player uses FFmpegAudioDecoder, BUFFERING_HAVE_ENOUGH, kPlaying and kPlay. DevTools closed; app left open. No provider prompts, queue changes, rewards, acceptance, commit or push performed.

# Commit verification — participation levels, pooled home XP and soundtrack (October 10, 2026)

- User authorized committing and pushing the accumulated XP UI, pooled home progression and six-track soundtrack to `ai-features`.
- No application code changed during this shipping pass. Reused the immediately preceding **215/215** passing suite and native home/music verification. Fresh diff check, strict package signature and dist/bridge/shared/adapters parity passed.
- Packaged app is current; launch/open it without interrupting running work. No real provider prompt, game queue mutation, acceptance or spending performed.

# Latest pass — Pooled home XP and background soundtrack (October 10, 2026)

- Supersedes highest-resident leveling: homes pool lifetime participation XP from every current resident in the project, counting each slot once. Building upgrades require 300, then another 450, 600 and 750 XP (total thresholds 300/750/1,350/2,100); fixed requirements do not rise when residents join. Individual agent/player leveling and gem rewards are unchanged. Server decor eligibility and client exteriors use the same pure rule. Rewards shows pooled XP and XP remaining.
- Added all six user-supplied `audio/*.mp3` tracks via Vite asset imports. Quiet 20% volume, shuffled full cycles without immediate cycle-boundary repeats. Playback begins after interaction, obeys the existing persisted Sound toggle, resumes on unmute, and skips failed tracks with bounded retries. Updated the Sound tooltip. No external music service or audio permissions needed.
- Checks: standard Node 18 full suite **215/215 passed**, including pooled/deduplicated resident contributions, project isolation, failed-response exclusion, all home thresholds and tier cap. Soundtrack smoke passed for gesture gating, full shuffled cycle, no immediate repeat, mute/resume and finite failed-track handling. Syntax/diff checks passed. Final `npm run app:build`, strict codesign and dist/bridge/shared/adapters byte parity passed; all six MP3s are packaged.
- Current saved home history derives 550 XP, level 2 House, 200 XP remaining to Villa. Reopen was safe after a fresh check found no approved/queued/running/interrupted game work. Native UI verified ★★ House and Rewards: House · 550 XP · 200 to next level. Electron Media diagnostics verified the bundled Worlds_Unseen MP3 loaded with FFmpegAudioDecoder, BUFFERING_HAVE_ENOUGH, kPlaying and kPlay. Developer tools closed afterward; app left in normal game view. No paid prompt, fake event, queue mutation, acceptance, gem spending, commit or push.

# Latest pass — Homes follow resident levels (October 10, 2026)

- Home tier now follows its highest-level current resident, capped at five: Cottage, House, Villa, Manor, Estate. Existing completed-response XP applies immediately on load; outcomes still award gems but no longer raise buildings. Residents from other projects or absent character slots do not contribute.
- Client building upgrades and server decor eligibility share the same rule. Live XP changes refresh the home exterior and celebrate new tiers; initial historical load does not replay upgrade celebrations. Updated the building tooltip, progress help, CONCEPT, README and GAMEPLAY.
- Verification: Node 18 full suite **214/214 passed**, including resident isolation, tier cap and failed/completed response boundary checks. Syntax and diff checks passed. `npm run app:build`, strict codesign and packaged dist/bridge/shared/adapters parity passed.
- Read-only calculation from current saved runs gives the Agent World home **level 3 / Villa**. Native visual verification is pending: two game-owned runs were running at the safe-reopen check, so the app was deliberately left open. Safely reopen after work finishes to load the new server and packaged UI. No new provider prompt, fake event, acceptance, reward spending, commit or push performed.

# Latest pass — levels moved into the You button, You card, agent card and prompter (October 9, 2026)

- Removed the separate top-bar "You · Lv · XP" chip and its "Levels & experience" modal (`web/src/levels.js` rewritten; the XP rules in `shared/experience.mjs` are unchanged).
- **You button:** shows only the level number as a small gradient "Lv N" pill after "You" (`Player.setLevel`); tooltip and aria include the level.
- **You card (wardrobe for the player):** a level meter under the 3D preview — gradient level badge, "You · Level N", current/required XP, bar, "X XP to level N+1 · total". It re-renders live when XP changes.
- **Agent card (inspect drawer):** the same meter for the agent, above the role card (`ui.h.xpFor` → `levels.resident(project, slot)`).
- **Prompter header:** a compact meter (smaller badge, bar and XP count) replaces the plain text/bar.
- **New-XP toast:** now a glass pill with a sparkle icon, and awards are grouped per agent ("Nell +350 XP" instead of 14 repeats).
- **Debug handle:** `window.agentWorld.levels`.
- **QA:** isolated demo, with page-only fake completed runs fed to `levels.setData` (nothing persisted). Checked the You button (Lv 4), You card, Nell's card (day and night) and the prompter header. Contrast checker 0 failing after darkening the badge gradient.
- **Checks:** npm test passed (including the existing experience tests); app:build, strict codesign and dist parity passed. ⌘R in the running app. No commit or push.

# Latest pass — Resident and player participation XP (October 9, 2026)

- User authorized XP for completed game responses. Added `shared/experience.mjs`: 25 XP per completed run with a returned summary to the responding project/slot resident and player. Deduplicated by persisted run ID, including prior saved responses, scheduled work and team responses. Failed/cancelled/interrupted/no-response runs and external observed activity earn none. No new mutable XP balance or real queue edits; durable run history is the ledger.
- Growing per-level requirements: 100, 150, 200, 250… XP; overflow carries forward. This measures participation only, separate from human review, gems, home levels and acceptance.
- Added top-bar player level/XP badge, Levels & experience dialog with each resident's total XP/bar/next-level requirement, resident chat header XP, and live new-response/level-up notifications. Initial history load does not replay old notifications; rereads do not double-award.
- Verification: standard Node 18 suite **212/212 passed**. New tests cover increasing thresholds, overflow, resident/provider/project isolation, run deduplication and persisted reloads, excluded statuses. Syntax/diff checks passed. Final app build, strict codesign and dist/bridge/shared/adapters parity passed.
- Native Electron UI verified player level 4 (525 XP; 75/250 toward level 5), Otto level 3 (350 XP), Nell level 1 (50 XP), Milo level 2 (125 XP) from 21 saved completed responses. Opened Otto's chat and verified its 100/200 bar. No real prompt, acceptance, fake event or provider spending for QA. Live notification branch is implemented but not exercised with a paid real provider turn; next human prompt can evaluate it.
- Preserve existing Claude GUI-owned auth timeout limitation. Nothing committed or pushed in this pass.

# Commit verification (October 9, 2026)

- User authorized committing and pushing the accumulated visual, tutorial and auth-feedback updates on `ai-features`.
- Fresh standard Node 18 test suite: **209/209 passed**; `git diff --check` passed. Strict codesign verification passed and packaged dist/bridge/shared/adapters files match current assets/source. No new app code was changed during commit verification.
- Claude's GUI-owned auth status timeout remains unresolved as described below. No authentication, provider prompts, gameplay rewards or runtime-data changes were made for this commit.

# Latest pass — necks connected to bodies (October 9, 2026)

- **Bug:** after the low-poly rebuild the head sits at spine y 0.73 (scaled 1.16), and its 0.12-tall neck only reached down to about 0.66, while the torso top is at 0.62. That left a visible gap, which grew when heads tilted (dozing, looking at screens).
- **Fix (`buildPerson`, `web/src/models.js`):**
  - The head's neck is 0.28 tall (head-local −0.2…0.08), so it runs from inside the skull into the torso.
  - A fixed neck base on the spine (y 0.55–0.71) keeps it rooted whatever the head does.
  - The tee neckline ring is widened to sit around the thicker neck.
- **QA:** bust and waist portraits for tee, long, hoodie and collar (including the thinking tilt) plus an in-world close-up of a dozing Sim. Connected in all of them.
- **Checks:** npm test passed; app:build, strict codesign and dist parity passed. ⌘R in the running app. No commit or push.

# Latest adjustment — Tutorial sign-in without commands (October 9, 2026)

- User requested no copyable command in the tutorial. Removed sign-in commands from the auth response, command UI and Copy button. Signed-out feedback now says to open Claude Code, sign in and return to retry. Unverified status stays distinct from signed-out status. Claude desktop account login is not treated as proof of CLI authentication.
- Focused auth/gameplay tests **6/6 passed**; syntax and diff checks passed. `npm run app:build`, strict codesign and packaged dist/bridge/shared/adapters parity passed. The previously recorded GUI-owned auth timeout remains unresolved; no sign-in, reward claim or real provider prompt is performed.

# Latest pass — Claude tutorial sign-in feedback (October 9, 2026)

- Diagnosed the installed Claude Code using read-only `auth status --json`: `loggedIn: false`, exit 1. The tutorial's generic error concealed the actual sign-in prerequisite. No provider prompt, login, reward claim or account change was performed.
- Added `bridge/provider-auth.mjs`: asynchronous, bounded auth probe; distinguishes signed out, missing CLI and unverified status. Explicitly ends noninteractive stdin and records only safe failure diagnostics (exit code, timeout, output size). Returns only readiness and actionable guidance, never account details. Gameplay linking still requires successful verified sign-in before changing town state.
- Mayor displays the detected CLI's shell-quoted subscription login command with Copy, instructions to sign in in Terminal/browser and retry the existing Claude link. Desktop Claude sign-in is distinct. No automatic login or paid API fallback.
- Preserved existing uncommitted art, crew and mayor changes. Final standard Node 18 suite **209/209 passed**, syntax and diff checks passed. `npm run app:build` and strict codesign passed; packaged dist/bridge/shared/adapters matched source. Reopened safely after checking no queued/running/interrupted work. Native UI shows the command and retry controls; no link/reward was claimed.
- Remaining human step: complete Claude Code sign-in and retry Link Claude Code to town. Authenticated account flow is unverified; fixture tests cover ready/signed-out/missing/malformed/error cases without provider spending. Important unresolved runtime issue: the GUI-owned native Claude status process still times out (15 seconds, no stdout) despite closing stdin; the same binary with the app's environment returns signed-out from Terminal. The tutorial now shows recovery instructions instead of a generic error, but successful GUI-side verification after sign-in must still be checked. Do not report end-to-end Claude linking as verified.

# Latest pass — Town Hall construction crew animations (October 9, 2026)

- **New `web/src/crew.js`:** three construction workers on the shared rig, each with a looping job (game ambience only).
  - **Hammerer:** kneels on the deck (right knee down, left foot planted) over a beam with nail heads. Four quick strikes per loop (slow lift, fast drop via `armIK`), a dust puff on each impact, then sits back to inspect and reaches for the next nail. 3.2 s loop.
  - **Sawyer:** stands at a sawhorse with a board. The left hand holds the board, the right hand strokes the saw (blade angled down into the cut) with body sway, and sawdust drifts down. Pauses to check the line. 4.5 s loop.
  - **Carrier:** walks between a lumber pile and a delivery stack on the front slab. Squats to pick up a plank, carries it on the shoulder, sets it down, walks back empty. 11 s loop.
- **Details:**
  - Workers wear a faceted hard hat with a brim and ridge (replacing the beanie-with-pompom look).
  - Joints ease toward targets (faster during strikes and strokes).
  - Puffs use a small mesh pool per station.
- **`web/src/commons.js`:** the site builds the `Crew` (station groups and walkers kept dynamic; lumber piles merged static); the old wobble loop is removed. The crane now runs a 16 s lift cycle (swing out, lower the load, raise it, swing back) instead of constant sway.
- **QA:** an isolated demo home with construction started via the API (deleted afterwards). Front close-ups of each worker mid-action; no console errors.
- **Checks:** npm test passed; app:build, strict codesign and dist parity passed. ⌘R in the running app. No commit or push.

# Latest pass — Mayor dialogue restyled to match the game's panels (October 9, 2026)

- **Card (`web/src/style.css` mayor block, plus small markup in `web/src/onboarding.js`):**
  - The dark teal card with gold borders and square corners is now the shared glass card: `--glass-strong`, theme ink, `--r-lg`, soft shadow and blur. It works in day and night.
  - The speech tail is kept, in the card color.
  - The header row is a gradient "Mayor Martin" pill (Rewards gold) plus a muted quest line with a landmark icon.
- **Buttons:** accent primary pill, soft secondary pill, ghost "subtle"; Lucide chevrons replace the text "›"; the gem cost shows as an inner badge.
- **Details:** cost and time are chips. The progress bar is a rounded gold gradient, errors are a tinted row, and the close button is a glass circle.
- **World label:** "Mayor Martin" is a gold pill.
- **Fixed:** a night rule (`body.night .mayor-choice`) outranked `.primary` and turned the main button grey at night.
- **QA:** a fresh isolated demo home (deleted afterwards) walked through every beat: greeting (day), link providers (night), Town Hall offer, building with progress and speed-up (day and night). Contrast checker 0 failing on all.
- **Checks:** npm test passed; app:build, strict codesign and dist parity passed. ⌘R in the running app. No commit or push.

# Latest pass — mayor's arm and a relaxed idle stance for everyone (October 9, 2026)

- **Mayor (`web/src/mayor-character.js`):** `pose()` set `armL.rotation.z = -0.3`. The left arm sits on +x, so negative z swings the hand inward, and it showed up tucked behind his back. Changes:
  - Both arms now use a relaxed stance (z ±0.17 with breath sway, slight forward carry, soft elbow); the right arm still gestures while he talks.
  - Arm, elbow and head rotations ease toward their targets, so talking and listening blend instead of snapping.
  - The beard tufts are flat-shaded icosahedra to match the faceted hair.
- **All characters:**
  - The shoulder offset is now `SHOULDER_X = 0.335` (was 0.3), exported from models.js and used by `armIK`, so hanging arms clear the wider faceted torso.
  - The default joint targets in `Sim.animate` (any pose that doesn't override them) are a relaxed stance: arms 0.17 out, −0.07 forward, elbows −0.24, with a small breathing drift. Before, arms hung straight at ±0.08 with locked elbows and grazed the body.
  - The portrait idle (`avatar-portrait.js`) uses the same values.
- **QA** (isolated demo): the mayor's tutorial popover talking (left arm at his side, right arm gesturing, faceted beard) and Quinn standing front-on in the world. Desk typing and couch poses are unaffected (IK uses the same shoulder constant).
- **Checks:** npm test passed; `git diff --check` clean; app:build, strict codesign and dist parity passed. ⌘R in the running app. No commit or push.

# Latest pass — faceted low-poly characters, layered hair, and a broken merge repaired (October 9, 2026)

- **Art style (`buildPerson` in `web/src/models.js`, rewritten):** characters match the human's reference.
  - Flat-shaded faceted shapes: rounded boxes and low-segment cylinders with deterministic vertex jitter.
  - A big blocky head (1.16 scale) with a tapered jaw, faceted ears and a pyramid nose.
  - Large glossy eyes with two highlights, flat blush, and an open smile with a tongue.
  - Chunky boots with pale soles, a boxy torso with a hem band, puffed faceted shoulders and mitten hands.
  - The rig contract is unchanged (hips 0.9, knees −0.44, shoulders ±0.3·build at 0.62, elbows −0.31, head on the spine; same returned joints), so every pose, the arm IK, couch/desk sitting and the portraits work as before. Elbow joint gems close the gap when bent.
- **Hair:** no longer a cap.
  - A faceted shell with a real hairline (high forehead, temples, nape, with vertices below it tucked under the skin).
  - Layered on top: swept flat fringe chunks, crown tufts and per-style silhouettes. Crop is textured and swept; bob has side curtains, a full back and blunt bangs; bun has a tie band; spiky has two rows of chunky spikes; curly is a cloud of faceted curls; ponytail is a tapered tail with a tie.
  - Cap, beanie, glasses, flower and headphones are rebuilt to match.
- **Materials:** `charMat` (flat-shaded, rim-lit, not shared with world materials). `patchCharacterMaterial` now also sets `userData.fx`, so characters skip world weather and wind patches, and seasons.js skips them for recolor.
- **Portraits:** framing raised for the bigger heads.
- **Merge repair (not from this pass):** commit 7edd16c ("Merge branch 'gameplay-improvement' into ai-features") left conflict regions commented out, which crashed the client.
  - `main.js applySnapshot` referenced an undefined `visibleHouseholds`/`visibleSessions`. Restored by applying `visibleResidents(gameplay, …)` after ai-features' project filter.
  - `ui.js renderRoster` lost `stale` and the Projects-tab early return. Restored, keeping the ai-features flat list and gameplay-improvement's town-link empty state.
  - `ui.js setConnection` received a connectionView object but expected a count, which showed "Live · [object Object] sessions". It now accepts both.
  - The commented-out conflict blocks are still in those files for the human to review.
- **QA** (isolated demo; the gameplay "connection" was claimed in the scratch home only, to show residents): portrait grid of all six hairstyles plus cap, beanie, glasses and headphones; large busts; in-world front views of standing, dozing on the couch, and seated at a desk. No console errors after the repair.
- **Checks:** npm test 206/206; `git diff --check` clean; app:build, strict codesign and dist parity passed. ⌘R or reopen in the running app. No commit or push.
# Startup port conflict repair (October 9, 2026)

- User reported `yarn start` failing with `EADDRINUSE` on 127.0.0.1:4777. Read-only verification found the same healthy `node bridge/server.mjs --serve dist` process, PID 53960, already serving HTTP 200; zero proposals/runs. Root cause: `scripts/dev.mjs` unconditionally spawned another bridge and observer.
- Changed `scripts/dev.mjs` to probe the port before spawning any children. Production/default-home startup reuses a verified Agent World API, an explicitly non-demo first SSE snapshot and an HTML page. Unrelated services, demo bridges, API-only bridges, dev/demo starts and custom-home starts on occupied ports fail with an actionable message and no new child processes. Existing bridge/runner/observers are never killed. Return normally after the read-only probes; immediate `process.exit` after cancelling fetch caused a Windows Node 24 native handle assertion during development and was removed.
- Added `test/startup.test.mjs` with HTTP fixture servers; no fake events, real prompts or home metadata writes. Final `node --test test/startup.test.mjs test/merge-integration.test.mjs`: **6/6 passed**. Actual `yarn start`: **exit 0**, client built, existing URL printed, no duplicate bridge/tailer. Syntax/diff checks passed. Previous uncommitted merge repairs preserved; no commit/push.
- Required `npm run app:build`: Vite passed; macOS packaging remains unsupported on Windows. Local Windows fallback `npx electron-builder --win --dir '--config.win.signAndEditExecutable=false'` passed. Packaged dist 8, bridge 22, shared 27 and adapters 8 all match source/build; Windows executable remains **NotSigned**. No app/bridge restart or real queue/schedule change. This launcher script is checkout tooling; Electron retains its existing reuse logic.
- Open `http://127.0.0.1:4777/` to use the existing app. `yarn start` builds current browser assets but reusing a bridge does not upgrade its loaded backend code. Next bounded work remains review of the merge repair; restart/reopen only when approved/queued/running work is clear. Windows/macOS build portability and the baseline full-suite failures remain unresolved separate work.

# Merge repair — mayor onboarding and AI features (October 9, 2026)

- Checkout: `C:\Users\pawns\Documents\projects\agent-world`, `gameplay-improvement`, HEAD `565c614`. Working tree was clean at entry. Reviewed the gameplay change `3c1b603`, AI-feature change `50e6ddb`, and their merge `7edd16c`. The four conflicts had been committed as commented markers; Git had no unmerged index entries. No commit, push, publication, real planning/queue/schedule changes, provider execution or app restart in this pass.
- Repaired `web/src/main.js`: intersect explicit project selection with the mayor's resident visibility gate, define the missing `visibleHouseholds`/`visibleSessions`, retain selected planning/library records, and feed gated sessions to the chat card. Preserve both onboarding and AI project/chat workflows.
- Repaired all three conflict sections in `web/src/ui.js`: retain provider-health view objects through mayor-link updates, restore accessibility/health explanations while adding separate town-link guidance, restore the Projects view guard and missing `stale` flag, and preserve the selected-project empty state. Removed all conflict-marker comments from both files.
- Added `test/merge-integration.test.mjs`: three runtime regressions execute actual snapshot/UI code with scene/DOM doubles, covering selected/hidden/legacy projects, unlinked/linked residents, parent-before-visitor application, stale-session cleanup, provider health expiry/disconnect/reconnect, project-tab counts and onboarding text. `node --test test/merge-integration.test.mjs test/gameplay.test.mjs test/connections.test.mjs`: **9/9 passed**. Both changed JS syntax checks and `git diff --check` passed.
- Full-suite limitation on Windows/Node 24.18.0: `npm test` fails discovery (`node --test test/`, MODULE_NOT_FOUND). Explicitly enumerating all `*.test.mjs` files gives **204 tests, 171 passed, 33 failed**. An untouched HEAD archive in a separate temporary checkout gives **201 tests, 168 passed, the same 33 failures**. Failure names match after normalizing the checkout path. Existing failures include POSIX executable fixtures, file permissions/path expectations, and CRLF-sensitive composer import stripping; this pass did not repair them or claim a full-suite pass. Logs: `%TEMP%\agent-world-merge-tests-explicit.log` and `%TEMP%\agent-world-merge-baseline-tests.log`.
- Actual built-renderer QA used hidden Electron windows and separate temporary `AGENT_WORLD_HOME`/`CODEX_HOME`, ports 4796/4797, runner disabled and nonexistent provider commands. Unlinked snapshot: zero residents/homes and mayor onboarding. Linked snapshot: three off-duty residents, one selected home, unselected home hidden. Both dismiss the intro, retain Projects view counts, switch back to Agents, and show `Live · unavailable` on bridge shutdown with **zero renderer errors**. No real prompts or account calls. Temporary bridges/windows closed; fixture homes remain in temp. Evidence: `%TEMP%\agent-world-merge-ui-stdout.log`; harness: `%TEMP%\agent-world-merge-ui-qa.cjs`.
- Required `npm run app:build` was attempted: Vite succeeded; macOS packaging cannot run on Windows. Normal Windows packaging then failed extracting signing tools because symlink privileges were unavailable. Local fallback `npx electron-builder --win --dir '--config.win.signAndEditExecutable=false'` **passed**. All packaged `dist` (8), `bridge` (22), `shared` (27), and `adapters` (8) files match the build/source by SHA-256. Authenticode check reports **NotSigned**, as does the installed Electron executable. This is an unsigned local Windows package, not a verified signed release; strict macOS signature verification still requires macOS. Package: `release/win-unpacked/Agent World.exe`.
- Existing bridge on 4777 (PID 53960) stayed running; its read-only initial snapshot had zero proposals/runs. No existing app/window was reopened or reloaded. Source/package changes require a safe reopen/reload when the human is ready, after rechecking approved/queued/running work.
- Next bounded validation: human review of combined mayor onboarding, explicit project import and chat UI; verify the signed macOS package on macOS if distributing that target. Windows test/packaging portability is a separate unresolved task. Repairs remain uncommitted for review.

# Commit and push verification (October 9, 2026)

- User authorized committing and pushing the accumulated changes on `ai-features`.
- Standard `npm test` on Node 18.16.0: **203/203 passed**, without `NODE_OPTIONS` or the polling preload. The earlier watcher EMFILE failure did not reproduce in this run; this does not establish that its underlying intermittent condition is fixed.
- `npm run app:build` passed. `codesign --verify --deep --strict` passed; all packaged `dist` (8), `bridge` (22), `shared` (26) and `adapters` (8) files matched the current build/source byte for byte.
- Existing bundle-size, disabled-asar, missing-author and skipped-notarization notices remain. The live bridge returned HTTP 200. No real prompts, scheduling changes, queue changes or app restart were performed in this verification pass.
- Next useful step: evaluate starter-team delegation with a human-authorized real task and check the original chat's final return report; retain the intermittent Inbox watcher error as an unresolved reliability item.

# Latest implementation pass — Live overlay counts provider observer contacts (October 9, 2026)

- Scoped implementation on `ai-features`, HEAD `8f2ad9b`; preserved the large existing uncommitted change set. No commit, push, publication, real prompt, queue/task/schedule edit, acceptance, authentication change or provider spending. No delegation. This is reported implementation/check evidence, not human acceptance.
- Changed this pass: `shared/connections.mjs`, `bridge/connections.mjs`, `adapters/contact.mjs`, `adapters/codex/tail.mjs`, `adapters/claude-code/hook.mjs`, `bridge/server.mjs`, `web/src/main.js`, `web/src/ui.js`, `web/src/experience.js`, `web/index.html`, `test/connections.test.mjs`, `README.md`, `CONCEPT.md`, this file and `docs/screenshots/provider-connections-qa.png`. Other Git differences predate the pass.
- Evidence investigation: live packaged API reported both CLIs installed, 3 attached sessions and one running pass; CLI discovery resolved existing Codex/Claude executable paths without invoking them. Current sources have a persistent Codex log tailer and short-lived Claude hooks, no persistent Claude health channel. Saved chats are metadata; event timestamps and successful turns are history. Process listing was denied by the sandbox. Authentication/cloud connectivity was not probed or inferred.
- Exact supported meaning, visible on the button tooltip/accessibility label and in Connections: **fresh local activity-observer contact**. Codex writes a five-second lease only while the rollout root is readable; the bridge checks tailer PID liveness and expires its lease after 20 seconds. Claude supported hooks write per-session 30-second contact leases; SessionEnd clears only that session. Multiple sessions/observers count once per provider, giving 0/1/2. Health leases are isolated from canonical events, residents/city and queue files. The Codex watcher now closes on an asynchronous error and continues its preexisting polling fallback, necessary for observer health under the observed OS watcher rejection. No Inbox audit fix was made.
- Bridge snapshots and two-second health messages carry provider contact status even with no session events. UI expires health at ten seconds, respects provider lease deadlines each second, clears counts on SSE disconnect and restores current evidence on reconnect. Live is now a button opening Connections, which keeps contact status separate from last-observed conversation history. Demo/saved chats/CLI installation/account authentication never generate a connected count.
- Focused `node --test test/connections.test.mjs`: **3/3 passed** (rerun after final code). Isolated fixtures cover none/Codex-only/Claude-only/both, multiple contacts from each provider, per-session ends, dead tailer, 20/30-second expiry, future/malformed leases, reconnect, bridge loss and stalled health. Actual spawned Claude hook and Codex tailer fixtures verify contact emission and termination without provider execution. Fake contacts used temporary AGENT_WORLD_HOME only; Codex fixture also isolated CODEX_HOME.
- Standard `npm test`, Node 18.16.0: **203 tests, 196 passed, 4 failed, 3 cancelled**. Failing API groups still encounter the previously documented asynchronous Inbox FSWatcher EMFILE crash; no claim of a normal full-suite pass. A Node 24.19.0 retry also aborted on refused bridge connections. An Electron Node 22 attempt using the directory argument failed test discovery and is not a valid suite result. With a **test-only preload** at `/tmp/aw-polling-fixture.cjs` forcing synchronous watcher setup failure and the existing polling fallback, `NODE_OPTIONS='--require /tmp/aw-polling-fixture.cjs' npm test`: **203/203 passed**. That qualified result does not repair or certify normal Inbox watcher operation.
- UI QA: independent headless Chrome launch was blocked by sandbox SIGABRT; managed Chrome successfully inspected the built UI on isolated port 4789, runner disabled and CLI paths nonexistent. The isolated bridge used the same test-only polling preload. Observed Live 0, Codex-only 1 despite two contacts, Claude-only 1, both 2, contact disconnection/expiry back to 0, renewed contacts back to 2, bridge shutdown → unavailable for both, and automatic bridge reconnection → current 0 without page reload. Live button opens the visible definition/history distinction. Screenshot: `docs/screenshots/provider-connections-qa.png`. Read-only isolated API verified zero runs and zero proposals. No Send, real prompt or queue mutation. Temporary server and QA tab were closed.
- `npm run app:build` completed. `codesign --verify --deep --strict 'release/mac-arm64/Agent World.app'` passed. Byte comparisons matched all **dist 8, bridge 22, shared 26 and adapters 8** packaged files. Syntax checks for changed bridge/adapters/client modules and `git diff --check` passed. Build retains existing Vite chunk-size/electron-builder packaging warnings.
- **Safe reopen still required:** real API on 4777 still reports one running pass and lacks the new connections field, so its existing window/bridge/tailer were deliberately not restarted or reloaded. The new package is built; runtime adoption awaits a safe human reopen after approved/queued/running work settles. Existing Claude hooks must reference the updated adapter; settings were not altered.
- Detection limits: this is observer contact, **not authenticated provider/cloud connectivity or proof a native desktop app is open**. Codex observer can stay connected without an active conversation. Claude can expire during idle time or a long tool operation, and abrupt shutdown remains connected only until the lease expires. There is no supported persistent Claude liveness source in this pass. Missing hooks cannot establish contact; real-provider idle/reconnect behavior and current installed-hook routing remain unverified. No further pass is approved or executed; human review and a safe reopen remain outstanding.

# Latest pass — starter team and scoped task handoffs (October 9, 2026)

- First added home receives three assigned responsibilities: slot 1 Assistant, slot 2 Junior developer, slot 3 Researcher. Starter-home marker persists with households; import/list alone still does not import other homes. Existing names/history are preserved. Current native Electron/API verified Otto → Assistant, Nell → Junior developer, Milo → Researcher. Role labels appear in roster, Watch activity and prompter; explicit responsibilities override inferred specialties only in that team. No synthetic live events or city credit.
- Added shared/team.mjs, bridge/handoffs.mjs and shared/pass-team.schema.json. A new Send captures the project roster as scoped delegation authorization; new team schedules also capture it (old schedules unchanged). Agents return bounded structured handoffs; roles map to exact same-project residents, provider/model/effort are inherited, first recipient chat is new and existing request-owned chats can resume. Runs stay serial. Earlier prerequisites supply recorded evidence before dependent work executes, including descendant reports. Each queued recipient has its own chat row. Original chat shows provenance/status/report/Open chat; automatic prompts identify their teammate or Team report request rather than the human.
- After all parts settle, one report-only pass resumes the original exact conversation with teammate reports. Limits: three handoffs per response, six per request, depth two; final pass cannot delegate. Invalid/self/unknown-role requests reject atomically. Failure pauses dependent work, no retry. Interruptions still require human inspection; resolve updates proposal status so inspected failures return to the coordinator. Stop from original or recipient chat cancels remaining group queue and stops the current game-owned child. Existing file changes remain. Finished reports never accept tasks/reward progress. Voice and isolated-worktree requests do not enable this team loop.
- Final full Node 18 suite: 200/200. Tests cover starter/idempotent/persisted responsibilities, dependencies/evidence, ownership, no cross-provider chat rows, invalid/self/unapproved handoffs, budgets/depth, failure, interruption inspection, group cancellation and original-chat Stop targeting. Actual spawned fixture CLIs verify Assistant → Researcher → developer → report for both Codex and Claude, with exact original-thread resume. No paid provider runs or real prompt/queue/schedule edits during QA. Real-model decomposition quality is not established by fixtures.
- Isolated Chrome QA verified three role labels/cards, queued handoff status/links, recipient-owned chat and attributed incoming instruction, Stop cancels both queued parts, and the recorded combined report appears in original chat. Disposable home/server/browser cleaned up (home retained in temp for evidence). Screenshots: docs/screenshots/team-handoffs-qa.png, team-return-report-qa.png, starter-team-electron.png. No app errors observed; one unrelated browser extension error appeared after reload.
- Final npm run app:build completed; strict deep codesign passed; all dist (8), bridge (21) and shared (25) packaged files matched checkout. Syntax/diff whitespace checks passed. Safely reopened Electron after zero running/interrupted/approved work and no composer draft. Verified current three roles via native UI and API. Existing unrelated uncommitted work preserved; no commit/push.
- Next useful validation: a human-submitted bounded real project prompt to Otto (Assistant), then inspect delegation quality, returned checks and actual output in the recipient chat. This pass did not submit that real prompt or claim live-provider teamwork is proven.

# Latest pass — work clothes removed

- Removed role work clothes completely:
  - `buildUniform` (apron and lanyard) is deleted from `web/src/models.js`, along with `Sim.applyUniform` and the uniform on street-life walkers and the 3D portraits;
  - the wardrobe's "Work clothes · Wear them / Hide them" option is gone;
  - `shared/style.mjs` no longer stores `uniform`. Old saved `uniform: false` values are ignored on the next save.
- Roles stay (the role card in the agent panel, street-life destinations); they just don't change what a resident wears. GAMEPLAY.md is noted.
- **Checks:**
  - **QA** (isolated demo): Quinn in the world and in the panel portrait without an apron; wardrobe text has no "Work clothes".
  - **Tests:** npm test 189/189.
  - **Build:** app:build, strict codesign and dist/style parity passed. The bridge's style module changed, so a full reopen is cleanest. No commit or push.

# Latest pass — apron work clothes fixed

- **Bug:** the role "apron" (`buildUniform` in `web/src/models.js`) was a flat box panel with box straps placed for a torso squashed to z 0.82. The breathing animation (sim.js, and the new portraits) resets `torso.scale.z` to 1, so the real torso is round and the flat panel's edges stuck out of the sides of the shirt. It was very visible on the prompter's waist-up avatar (human's screenshot of Otto).
- **Fix:** the apron is now curved open-cylinder shells that wrap the round torso: a skirt over the belly, a white waist tie, a narrower bib and a lighter pocket. Tube straps run from the bib corners over the shoulders to the back of the neck. Shell materials are DoubleSide clones, and `bakeable()` now excludes non-FrontSide materials so merging keeps them two-sided. The lanyard is unchanged.
- **Checks:**
  - **QA** (isolated demo): waist-up portraits of four apron-wearing Sims (green, pink, blue and orange aprons on contrasting shirts) plus the thinking pose; in-world close-up of Quinn. The apron sits flush with no protrusions.
  - **Tests:** npm test full suite passed.
  - **Build:** app:build, strict codesign and dist parity passed. ⌘R in the running app. No commit or push.

# Latest pass — avatar portrait polish and no more Sims sharing a spot

- **Portraits (`avatar-portrait.js`):**
  - Reframed: the bust shows chest to crown and the waist view hips to crown, so buns, curls and hats are no longer clipped. Narrower FOV, 3/4 yaw, slight high angle.
  - Studio lighting: RoomEnvironment PMREM fill (0.22), a warm key, cool back rim, warm side rim and low bounce; exposure 0.9.
  - Before the change, renders were flat and pastel, and dark hair or skin lost its edges.
- **Spot reservations (`sim.js`):** `lot.claims` maps each spot to the Sim holding it; claimed in `decide()` and released on re-decide, leave and dispose.
  - Flavor picks choose only free spots. When all of a kind are taken they try the other activities, then a free standing spot one body-width from others.
  - Truth targets (desk, wait, off-duty couch or wander) take priority. The target is claimed before the displaced flavor Sim re-decides, so it can't pick the same spot. Two truth targets on one spot send the second to a free wander or standing spot (couch dozing becomes standing).
  - Visitors take free guest spots.
- **Separation (`separateSims`, called each frame in main):** standing Sims in the same lot closer than 0.62 m ease apart, onto walkable cells only. Sims seated at a desk or on the couch hold still.
- **Checks:**
  - **QA** (isolated demo): forced every Sim in online-store to re-decide 30 times toward the couch. 0 duplicate claims, stationary pairs at least 0.85 m apart, distinct couch seats in the screenshot. Large portrait grid (6 Sims, bust) plus waist idle and thinking inspected before and after.
  - **Tests:** npm test full suite passed.
  - **Build:** app:build, strict codesign and dist parity passed. ⌘R in the running app. No commit or push.

# Latest pass — live 3D avatars (You badge, agent panel, wardrobe, prompter overlay)

- **New `web/src/avatar-portrait.js`:** `AvatarPortrait` renders the same `buildPerson` model (plus work-clothes uniform) into a 2D canvas.
  - One shared offscreen WebGLRenderer (600×800, alpha, ACES) draws each visible portrait in turn at 30 fps via viewport, scissor and drawImage, so there is only one extra GL context.
  - Framing modes: `bust` (head and shoulders) and `waist`.
  - Idle: breathing (torso scale and body bob), randomized blinks (occasional double), slow head glance and tilt, small weight shift.
  - Thinking: right hand to chin via the now-exported `armIK` from sim.js, other arm folded across the waist, head tilted.
  - Portraits rebuild when the look or role changes. Non-persistent ones dispose when their canvas leaves the DOM; hidden ones skip rendering.
- **"You" badge:** bust portrait. **Wardrobe:** waist preview, mounted through the new `mountPreview` hook. Both portraits are persistent.
- **Agent panel header:** a bust portrait of the agent replaces the SVG, with the status ring kept. Roster and toasts keep the SVG portraits.
- **Prompter overlay:** a `popover="manual"` element so it sits above the modal.
  - Shows a waist-up portrait of the resident, a name pill and a "…" thought bubble.
  - The thinking pose and bubble are on while a game run is running for that resident (`PassCard.promptRunning()`).
  - On windows ≥1240 px the prompter shifts right to make room; narrower windows hide the overlay. The overlay closes with the dialog.
  - `main.js` passes `resident(project, slot)`, and the debug handle now exposes `passCard`.
- **Checks:**
  - **QA** (isolated demo, hidden Electron capture): badge, panel and wardrobe canvases present; large test renders of bust, waist and thinking poses inspected (fixed the IK NaN from a missing bodyY, the framing and the other arm); prompter overlay in day, plus night with a page-only fake running entry showing the thinking pose and bubble.
  - **Tests:** npm test full suite passed.
  - **Build:** app:build, strict codesign and dist parity passed. Client-only: ⌘R in the running app. No commit or push.

# Latest pass — prompter sidebar icons and Scheduled view upgrade

- **Prompter sidebar (`pass-card.js`):** the full-width "New chat" and "Scheduled" pills are now a header row: "<Name>’s chats" with two 32 px icon buttons, Scheduled (calendar-clock) and New chat (square-pen, accent-tinted). Same `data-scheduled` and `data-new-chat` hooks, with aria-labels and tooltips.
- **Scheduled view (`schedules.js`):**
  - Sidebar header: back-arrow icon, "Scheduled", "+" icon. The task list is slim rows with a status dot (grey when paused) and "Daily · 9:00 AM".
  - Main view: title and description with an accent "New task" pill.
  - Compact task cards: icon tile (repeat, calendar, or pause), title, schedule chip, Paused chip, a two-line clamped instruction, one meta line (provider · state · next run · last run). The duplicate "Paused" message is suppressed.
  - Icon actions: open chat, pause/resume, edit, delete (red hover).
  - The empty state has an icon tile.
- **Editor:** glass card with the shared header icon, tighter fields and pill selects.
- **New icons:** squarePen, calendarClock, play, pause, repeat.
- **Checks:**
  - **QA:** an isolated non-demo AGENT_WORLD_HOME (scheduling is disabled in demo), with the selected-projects file pointed at the fake homes. The runner was enabled only so the API would accept creates. Three future schedules were created (earliest the next morning); one was paused. Prompter sidebar, Scheduled view (day and night) and editor captured; contrast checker 0 failing. The bridge was stopped and the QA home deleted, so nothing ran.
  - **Tests:** npm test full suite passed.
  - **Build:** app:build, strict codesign and dist parity passed. ⌘R in the running app shows it. No commit or push.

# Latest pass — explicit Claude scheduling (October 8, 2026)

- Schedule a task now has Run with: Codex or Claude Code. Available installed providers only; defaults to the current chat provider. Switching a new task provider resets captured model/effort to that provider’s preferences, avoiding Codex model IDs in Claude tasks. Editing locks the task’s provider and the API rejects provider changes; create a new task to switch.
- Existing scheduler routes Claude tasks through the Claude Code runner, creates a dedicated session on first run and resumes its exact UUID for repeats. Added an isolated spawned Claude fixture verifying init/result handling, provider, structured response, observed model, requested --model/--effort and subsequent --resume, with a nonexistent Codex executable proving no fallback. Claude Code 2.1.292 installed locally; no real provider execution/sign-in entitlement check was performed.
- Focused scheduling/chat tests: 15/15. Full Node 18 suite: 189/189. Syntax and diff whitespace checks passed. Isolated Chrome QA created a future Claude task from a Codex chat, verified Claude-owned chat row/Open chat and locked provider on edit, then deleted the disposable schedule and closed server/browser. No real prompt/queue/schedule writes, acceptance or paid execution during QA. Screenshot: docs/screenshots/claude-scheduling-editor-qa.png.
- npm run app:build completed; strict deep codesign passed, and all dist (8), bridge (20), shared (23) packaged files matched source. Electron safely reopened after zero running/interrupted/approved work and no unsent composer draft. Existing changes preserved; no commit/push. The app must remain open and computer awake; Claude’s configured tool permissions apply and unavailable/denied tools can fail a run and pause recurrence.

# Latest pass — dedicated scheduled conversations and quarter-hour times (October 8, 2026)

- New scheduled tasks appear immediately in the selected resident’s chat list as their own scheduled conversation. The first run starts a separate provider chat; repeating runs resume that exact task chat. The selected existing conversation contributes model/effort preferences only. No fabricated provider session IDs; sending/voice remain disabled until a real conversation is established. Scheduled runs retain Stop controls.
- Time picker now offers all 96 quarter-hour options (00:00–23:45). Create/edit API rejects off-quarter times. Future legacy schedules detach from old chats without changing authorized times; already-dispatched one-time work retains its original chat/history. No real schedules, queue records or provider prompts were changed during verification.
- Final Node 18 suite: 188/188 passed. Focused scheduling/chat: 14/14. Fixture CLI proves first execution excludes resume/old chat ID, while the repeat explicitly resumes the newly established thread. Legacy running-task preservation and resident-owned placeholder/merge checks passed. No paid-provider execution claimed.
- Isolated Chrome QA verified 15-minute picker options, future task creation while an existing chat was selected, immediate dedicated row, Open chat, reload persistence, waiting copy and disabled Send, then removed the disposable schedule and closed isolated server/browser. Screenshot: docs/screenshots/scheduled-dedicated-chat-qa.png.
- Final npm run app:build completed; strict deep codesign passed after packaging completed, and all dist (8), bridge (20), shared (23) files matched packaged bytes. Diff whitespace passed. Safely reopened Electron only after the existing real scheduled run finished and API confirmed zero running/interrupted/approved work. Native world/prompter reopened; no new real scheduled tasks were created. Existing audit and uncommitted changes preserved. No commit/push.

# Latest pass — audit only (October 8, 2026)

- Report: [AUDIT_2026-10-08.md](AUDIT_2026-10-08.md). Honest verdict: distinctive working prototype with substantial safeguards, but chat, review and world progression need a more coherent daily loop.
- Fresh `npm test` on Node 18.16.0: 186 tests, 179 passed, 4 failed, 3 cancelled. CLI API subset failed again; diagnostic child stderr proved both isolated bridges crashed on an unhandled asynchronous `FSWatcher` `EMFILE` error. Inbox catches setup exceptions but has no watcher error listener; its polling fallback does not survive that crash. Live packaged bridge remained responsive.
- Read-only native inspection covered world/prompter, Connections and Work Now. Seven older review items and an older next action contrasted with newer chat work. No real prompts, queue changes, acceptance, schedules or provider spending. Existing uncommitted work preserved; only audit documentation added/updated.
- `/api/state` HTTP 200; port 4777 verified as packaged bridge. Strict deep codesign passed; all dist (8), bridge (20) and shared (23) packaged file hashes matched checkout. Diff whitespace check passed. No fresh build or restart: no application/UI changes, and current work remained active.
- One proposed next pass only, not approved or executed: recover asynchronous Inbox watcher errors with an isolated regression, rerun affected API checks, then package/signature/asset verification. Full details and limits are in the audit report. No production-readiness, performance or real-provider certification claimed.

# Previous pass — local prompt scheduling

- Added Scheduled to each resident’s prompter, with a list/sidebar and a Schedule a task editor matching the reference structure. Create/update once, daily and weekly; time zone, title, pause/resume/delete and same-chat navigation. Empty instruction disables Create. Provider/model/effort captured from the selected chat; attachments excluded.
- bridge/schedules.mjs persists schedules in the existing PassStore transaction. Due occurrences atomically enter the authorized queue and advance nextAt; no duplicate pending occurrence and one catch-up after missed times. First-run new conversation is retained for recurrence. DST covered. Failure/interruption pauses recurrence; removal pauses project schedules. Queue/result ownership and local-origin guards retained.
- Full Node 18 suite: 186/186 passed, including 5 scheduler tests and a real spawned fixture CLI that returned a structured response into the exact resumed chat. API rejects foreign origins, missing residents and foreign chat IDs. No paid-provider execution, real schedules, prompts, queue edits, acceptance, publishing, commits or pushes during QA.
- Isolated Chrome QA: create daily, pause, edit weekly, persistence/reload, resume, delete, Open chat, and disabled empty Create verified. No prompts dispatched during UI QA; existing fixture chat preserved. Screenshots: docs/screenshots/scheduling-editor-qa.png and scheduling-list-qa.png.
- Final npm run app:build completed; strict deep codesign and all dist/bridge/shared packaged bytes verified. Safely reopened with zero active/interrupted/queued game work and zero real schedules. Verified Scheduled in the real Electron prompter; left its empty view open. Screenshot: docs/screenshots/scheduling-electron.png. Isolated server and browser closed.
- Limitations: local bridge must run/computer awake; no background/cloud scheduling, notifications beyond existing chat/activity behavior, or scheduled attachments. Real provider scheduling remains untested; fixture runner boundary is verified.

# Latest pass — fence, couch and traveling-tag fixes

- **Fence (`web/src/lot.js`):** the yard now ends at `YARD_Z = 7.45`, short of the lot-side sidewalks (z ±7.7). The front fence and side fences no longer cross the sidewalk. Front-yard items moved inside it:
  - mailboxes and the Conversation shelf sign (z 7.0), corner bushes, the back trees, the front wander spots;
  - the level-3 arch and hedge (z 7.2 / 6.95), the level-4 fountain and flag (now beside the house), the level-5 path lanterns (one pair at z 6.3);
  - the stepping stones (2 instead of 5).
  - Build-mode "in the yard" validation uses the same bound. The human's real style.json has no decor past it; demo QA decor at z 7.5 now sits just outside.
- **Couch (`web/src/sim.js`):** the `relax` and `doze` poses (couch-only) use `COUCH_Y = -0.31` instead of the desk-chair height, so Sims sit on the cushions rather than sinking into them.
- **Traveling tag (`streetlife.js`, CSS):** the two-line card is now a slim one-line pill, "Name · Traveling" (~96×19 px). It anchors just above the head (y 2.35, bottom edge on the point), so it never covers the walker.
- **Checks:**
  - **QA** (isolated demo :4778/:5178, hidden Electron capture): fence corners and the street side, Lola on the couch close up, a forced street-life trip with the walker fully visible under the pill.
  - **Tests:** npm test 181/181. `git diff --check` clean.
  - **Build:** `npm run app:build`, strict codesign and dist parity passed. Client-only change: ⌘R in the running app. No commit or push.

# Latest pass — Projects view visual cleanup

- The Agents/Projects switch in Your agents is now a compact segmented control: soft track, white selected pill, no full-accent block.
- The oversized "Create new" and "Import existing" buttons are replaced by an action row:
  - home count on the left, small pills "New" (accent tint, folder-plus icon) and "Import" (ghost, folder-input icon), and a small refresh icon.
  - Behavior and data attributes are unchanged. The import list's new close button also clears `importing`.
- **Project list:** compact rows like the agent list. Each has an accent house tile, name, "Observed folder · N residents" and a monospace path. The trash icon shows only on hover or focus, centered at the right with a warm hover; no more bordered card with a bottom trash row.
- **Import list and New form:** soft cards, each with a small header and close button.
  - Import rows end in an "Add" pill, or a muted "Added".
  - The form has tighter fields, a solid accent "Add project" and a ghost "Cancel".
  - The status message is an info row and is hidden when empty.
- **New icons:** folderPlus, folderInput.
- **Checks:**
  - **QA** (isolated demo :4778/:5178, hidden Electron capture): default list, New form and import list (page-only mocked list response, because demo rejects local projects), in day and at night. Contrast checker 0 failing.
  - **Tests:** npm test full suite passed. `git diff --check` clean.
  - **Build:** `npm run app:build`, strict codesign verify and dist parity passed. Client-only change: ⌘R in the running app shows it. No commit or push.

# Latest pass — project trash icon

- Replaced project-card Remove text with the existing Lucide trash icon; accessible removal label and preservation tooltip retained. Removal behavior unchanged.
- Syntax and diff checks passed. npm run app:build completed; strict deep signature and packaged asset parity verified. Safe reopen performed with no active/queued game work.

# Latest pass — remove a project home

- Added Remove to each Your Projects card, with local-origin/selected-home validation. Removes only the explicit world selection, preserving files, Codex projects, resident identities and history for re-import. Rejects running or queued game work and active voice.
- Live removal detaches home/residents and refreshes visible catalogs without reloading the app or interrupting other projects. Last removal restores the vacant lot.
- Focused project API suite 5/5 passed: removal origin guard, persisted empty selection, read-only list after removal, files/identity preserved, repeated-removal rejection and re-import identity. Isolated browser verified immediate 0 projects/0 homes, vacant lot and success message; no console errors. Screenshot: docs/screenshots/project-removal-qa.png. Real user project remains selected; no real removal during QA.
- Final npm run app:build completed; strict deep signature passed after signing finished, and dist/bridge/shared packaged assets match. Safe Electron reopen performed with 0 running/interrupted/approved game work; real selected project retained.

# Latest pass — explicit project onboarding

- Removed automatic Codex project imports from list requests. New persistent world selection starts empty and preserves existing households/history without deleting files or Codex projects.
- Empty world shows a vacant lot with Add your first project. Projects sidebar offers Create new and Import existing, with per-project explicit import and Already added state. Small-window project navigation remains accessible.
- Tests: full Node 18 suite 181/181 passed, including read-only listing, explicit import, invalid import rejection and selected folder persistence. Isolated browser verified vacant-lot CTA, read-only import browsing (0 homes), explicit import (1 home/off-duty resident). Final app:build completed; strict deep codesign passed and dist/bridge/shared bytes match the package. Safe Electron reopen performed after verifying 0 game-owned active/queued runs. Real Codex registry and household history preserved.

## Latest pass: local Codex projects in sidebar, one home per folder (2026-10-08)

User asked for a Projects view inside Your agents and local Codex project creation, with every project represented by a home.

- New Agents/Projects sidebar switch, sorted project list, Add project form (name, folder, create-if-missing), refresh and home focus. Existing observed folders remain visible. Inputs retain the retry key unless edited; failures are surfaced; no global account configuration is modified.
- bridge/local-projects.mjs uses installed Codex 0.160.0 experimental project/list and project/create (validated against generated protocol). Paginates, canonicalizes local primary roots, skips missing folders, serializes creates and reuses existing root entries. Creates at most the requested folder, preserves all existing files and retains newly created folders after provider failure. No turn/thread execution.
- /api/codex-projects is a guarded local-origin JSON POST. List registers valid local roots as homes; create registers only confirmed metadata. Duplicate canonical folders reuse one home. Provisioning slot 1 produces a persistent off-duty resident; sessions and work queues remain unchanged. Demo rejects real project mutation.
- Node 18 full suite 181/181; five new focused tests cover protocol initialization, deduplication/files, errors, pagination, API origin/persistence and no fabricated activity. Syntax and diff checks pass. Real CLI verification used empty isolated CODEX_HOME, created a project, then verified durable listing. Browser UI in isolated AGENT_WORLD_HOME/CODEX_HOME created a second project: success feedback, 2 homes, 2 residents, 0 sessions/runs/proposals. Final list and Add form visually checked.
- npm run app:build succeeded after final styling. Completed codesign --verify --deep --strict passed; dist/bridge/shared files exactly match the package. Real Electron safely reopened; loaded Agents/Projects tabs verified. Left Agents selected; existing project homes will import when Projects is opened. No real project registry writes during QA, commits, pushes, prompts or spending. Isolated QA resources are separate from the user's registry.

Known bounds: local projects only, primary root for multi-root projects; no cloud ChatGPT synchronization. Prompt execution still uses existing folder/session routing. Native Codex projectId assignment for game-created conversations remains a future step; do not claim conversation membership merely from matching folders. Opening the real Projects view imports available registry roots as homes, which can increase the rendered world; large-world performance is not verified by the two-home QA.

## Latest pass: remove Connections Start here section (2026-10-08)

Scoped human authorization: remove the Start here section from the overlay plug-icon modal. Removed only its heading and three instructional cards in `web/src/experience.js`; Open Work, Chats, usage, source observations and coverage notes remain. Updated the corresponding README description. Preserved pre-existing uncommitted work.

Checks actually run: `node --check web/src/experience.js`, `git diff --check`, `npm run app:build`, and `codesign --verify --deep --strict --verbose=2` passed. SHA-256 comparisons confirmed all 49 files in packaged dist/bridge/shared match this checkout; built JavaScript omits Start here. Chrome visual/accessibility QA of the refreshed production build on temporary Vite preview port 5189 confirmed the Connections modal has no heading/cards and retains Open Work and Chats. Preview used the configured read-only bridge proxy; no sample metadata/events were created. Temporary tab and preview server were closed.

Limits: full test suite was not run for this markup-only removal. Build retains existing large-chunk and packaging warnings; package is ad-hoc signed, not notarized. GET `/api/state` succeeded; process inspection via `ps` was sandbox-denied, so bridge process identity was not verified. State reported one running run/proposal; no app quit/restart was attempted. Running Electron window still needs a safe reopen after active/approved/queued work finishes; native refreshed-window verification remains pending. No queue/task mutations, prompts, acceptance, spending, messages, commits, pushes or publishing were performed. Stop after this pass; no next pass proposed.

## Latest pass: Claude conversation effort selector (2026-10-08)

User authorized adding Claude effort selection. Installed CLI help confirms --effort accepts low/medium/high/xhigh/max. Official Claude model configuration says supported levels and caps depend on model/policy and unsupported requests can be reduced; the UI describes requested effort rather than claiming effective reasoning.

- Same composer model menu now has Default/Low/Medium/High/Extra high/Max slider for Claude, with effort in the pill. Reset effort preserves selected Claude model. Default omits the CLI flag.
- Effort is isolated by provider/project/thread, persisted locally, recovered from the most recent run when a new thread establishes its UUID, and pinned into each authorized prompt. Resumed runs pass --effort with the exact --resume session. No global Claude settings are changed.
- Backend rejects Codex-only or unknown effort values for Claude. /api/models includes requested effort separately from actual reported model identity.
- Full Node 18 suite: 176/176. Additional updated runner test verifies Default omits --effort and preserves UUID; focused suite passes. npm run app:build passed, completed signature verification passed, dist/bridge/shared packaged bytes match.
- No real prompts, auth/config changes, queue mutations, commits or pushes. Native app reopened after no game-owned running/interrupted/approved/queued work and no open draft were confirmed. Native Electron UI verified: Claude Opus menu shows the effort slider; incrementing Default to Low updates its title and pill to Claude Opus Low; Reset effort restores Default while preserving Claude Opus. Restored original effort and submitted no prompt. Actual paid/provider execution with the new effort remains unverified.

## Latest pass: per-conversation Claude model selection (2026-10-08)

User authorized adding Claude model selection. Verified installed Claude Code 2.1.292 --help supports --model and --resume; official model configuration documents Sonnet/Opus/Haiku aliases.

- Composer model menu supports Claude Sonnet, Opus, Haiku and configured default, keeping the current Claude session. Preferences are isolated by provider/project/thread and saved locally. Last requested alias from run records restores a new chat's selection after its UUID is created.
- /api/models is provider-aware. Claude returns supported CLI aliases, not a claimed live account catalog. Foreign-provider thread queries fail. Last actual model is recorded from the Claude init event and displayed separately from requested selection.
- Proposals validate Claude choices. Runner passes --model for new and resumed Claude runs; default omits override. Configured effort is preserved. Exact resident ownership and execution permissions remain intact.
- Full Node 18 suite: 174/174. Updated isolated API tests: 2/2. Mock runner verified --model with --resume and unchanged permission flags. No real Claude prompts, spending, queues or authentication changes.
- npm run app:build passed; completed package codesign --verify --deep --strict passed, dist/bridge/shared match the package. Reopened only after confirming no game-owned running/interrupted/approved/queued work and no open draft. Native Electron verification: switched Otto to Claude, saw Default/Sonnet/Opus/Haiku options, selected Opus and verified the composer pill changed to Claude Opus, then restored configured default. No prompt submitted. Left Claude controls open for review. Actual account/model execution remains unverified. No commit or push.

## Latest pass: Codex voice transport and composer controls (2026-10-08)

User requested spoken prompting and replies through the Codex route. Implemented bridge/voice.mjs, /api/voice and scoped SSE, web/src/voice.js and composer microphone controls. Exact conversation ownership, local-origin guards, one active execution, pending approval exclusion and explicit tool approvals are preserved. Transcript text is actual returned speech; no fake activity or raw recording is persisted. Voice call runs end as cancelled or failed, never as accepted work. macOS microphone usage description added.

## Codex voice (experimental, 2026-10-08)

The Codex composer has a microphone button for the selected resident and conversation. It starts a thread-scoped app-server realtime session, captures mono PCM audio, plays returned audio, and shows provider-authored live transcripts. Mute and End voice controls are available during a call; closing the drawer ends the call and interrupts associated execution. Conversation/provider switching and text sends are locked during voice. Only one call can run, and approved/queued execution must finish first. Command/file permission requests require a human decision. Raw audio is held in memory, never saved by Agent World; returned transcript text is saved to that resident's chat.

**Current blocker:** the installed Codex CLI 0.160.0 rejected both default and v3 realtime connections with `realtime conversation requires API key auth`. Thread initialization succeeded but zero audio chunks were returned. ChatGPT sign-in alone has not worked for this route. No API-key login, paid fallback, or authentication change was performed. UI/transport wiring is implemented, but two-way audio, speech quality and microphone permission behavior are not verified end to end. This must not be described as working subscription-backed voice.

Checks so far: full Node 18 suite 171/171 before final canonical transcript streaming changes; focused transport/API suite 9/9 after them. Final full Node 18 suite: 172/172. `npm run app:build` succeeded; `codesign --verify --deep --strict` passed. All 8 dist files, 18 bridge files and 23 shared files match the package; microphone usage description is present. Native microphone permission, live audio and voice UI interaction are unverified. Current API snapshot had no running/interrupted runs or approved passes. No queues in the real game were changed, no commits/pushes, no auth changes, no microphone recording. The existing running Electron process needs a safe quit/reopen to load its new bridge; it was not restarted during this pass.

Next: resolve Codex voice authentication via a supported route before promising live voice. If API-key auth is chosen, obtain explicit user direction, document billing/auth effects and verify genuine microphone input plus returned speech. Do not silently replace existing ChatGPT login or use unsupported private endpoints. Scheduling, handoffs and project creation remain separate roadmap work.

## Latest pass: "Your projects" panel becomes "Your agents" (2026-10-07)

Human asked to rename the left panel to "Your agents" and, for now, show only the list of agents with their status and when they were last seen.

- `web/index.html`: title "Your agents"; collapse label "Collapse agent list".
- `web/src/ui.js` `renderRoster`/`rosterRow`:
  - A flat list replaces the project groups. Sorted by needs-you, error, working, idle, then off duty, alphabetical within each.
  - Each row: portrait with status ring, name, status (the same `Sim.statusText` the bubble uses, so Traveling appears while walking; "Offline" while observation is disconnected) and last seen.
  - Last seen is "Now" for active sessions; otherwise relative time from the observation timestamp or `character.lastSeen`, with the full date in the tooltip, or "Never".
  - Count reads "N agents · M active". Clicking a row still focuses the agent.
  - Removed the now-unused stateText/appChip/WAIT_REASON and the conversationLabel/brandOf imports. Off-duty rows are no longer faded, for readability.
- **CSS:** new `.agent-row` layout.
- **README:** controls table updated.

Checks:
- **QA** (isolated demo :4778/:5178, hidden Electron capture): day and night show the title, "9 agents · 5 active", rows like "Kai · Explore helper | Traveling | Now" and "Iris | Off duty | 2d ago". Contrast checker 0 failing in both modes. Clicking a row opened that agent's panel.
- **Tests:** npm test 165/165.
- **Build:** `npm run app:build`, codesign verify and dist parity are in the build step below. The running app needs ⌘R (client-only change).

## Latest pass: no "Done, your turn"; bubbles show only name and status (2026-10-07)

Human asked to remove "Done, your turn" completely (agent panel card, bubble status, everything), have finished agents return to their usual routine, and limit bubbles to name plus status, with "Traveling" while walking.

- **Truth normalization (`shared/schema.mjs` `normalizeEvent`):** `waiting_for_user` with reason `turn_complete` is recorded as `idle` with no detail. Inbox reads (live and replay) and adapter emits both pass through it, so no client path ever sees a finished-turn wait. Permission and question waits are unchanged.
- **Removed finished-turn surfaces:** the "Done, your turn" activity and agent-view label, the toast text, the WAIT_REASON entry, the finish cheer and the finish chime choice. Idle agents already fall through to flavor activities (verified in QA: couch, coffee, books, globe, wander).
- **Bubbles (`sim.js` `statusText`):** icon, name and one short status only: Working, Needs your OK / Has a question / Needs you, Error, Idle, Off duty, or Traveling while the Sim has a path (navigation icon). No activity text, conversation line, targets or wait timer. Chip mode now includes the status; zoomed-far icons are unchanged; offline still shows "Last seen …".
- **Street-life walkers:** the tag is now name plus Traveling, or Off duty while at the business, restyled like a bubble.
- **Docs:** README, plus CONCEPT's mapping table and a new section.

Checks:
- **Tests:** npm test 165/165 (new `test/schema.test.mjs`; updated activity and agent-view expectations; the turn-boundary fallback keeps older records working).
- **QA stack** (isolated demo :4778/:5178, hidden Electron capture):
  - Bubble texts in day were all name plus status, including "Eli · Explore helper · Traveling".
  - 60 s sampling saw Working, Off duty, Traveling, Needs your OK, Error and Idle, with 0 "your turn" anywhere on the page.
  - Idle agents went to their routine.
  - An idle agent's panel shows an "Idle" card.
- **Build:** `npm run app:build`, codesign verify, dist and schema parity.
- **Running app:** the open Electron app still runs the old bridge and tailer in memory, so it needs quit and reopen (⌘R alone updates only the bubbles and client). Not restarted by the agent. No commit or push.

## Latest pass: model picker with effort slider, provider toggle and Connect an app redesign (2026-10-07)

Human feedback: the model selector should look like their reference (pill "GPT-6.1 Sol Medium ⌄"; popover with a big effort title, model name with ›, reset icon, and a stepped slider), the Codex/Claude dropdown placement was unappealing, and Connect an app still looked out of theme. Their screenshot was the stale window: the package already had the previous restyle, but the open window hadn't been reloaded.

- **Model picker (`web/src/conversation-models.js`, rewritten):**
  - Quiet pill: model, muted effort, chevron. The popover is a segmented Codex | Claude Code toggle, then a brain icon, the accent effort title, "Model ›" (opens a model-list view with back arrow, check and descriptions) and a reset button (clears model and effort).
  - The effort slider is a range input over the model's supported efforts, with a custom track, fill, stop dots and white thumb, plus the effort description underneath.
  - Claude shows a "configured model" card. A locked provider shows a reason.
  - Effort and model choices are per project/thread and apply to the next message. The prompter defers live re-renders while the slider is dragged.
- **Provider:** the composer `<select>` is removed. `PassCard.setProvider()` replaces its change handler; same lock rule as before (disabled while the resident is busy or sending).
- **Effort end to end:**
  - `bridge/models.mjs` exposes each model's `efforts` and `defaultEffort` from Codex `model/list`, filtered to known values (`EFFORTS`, `validEffort`).
  - `bridge/passes.mjs` validates `effort` (rejected for Claude) and pins it on the proposal, the run and any next proposal.
  - `bridge/pass-runner.mjs` passes `-c model_reasoning_effort=<effort>` to Codex.
- **Connect an app (`web/src/computer-use.js`):**
  - Added a Codex ⇄ app hero whose link is dashed, then animates while busy, turns green with a check when verified and red when failed.
  - The field has a labelled input with the app's initial badge, quick-pick chips (Agent World, Finder, Safari, Notes, Xcode; they only fill the field) and a full-width accent "Request app access".
  - Approval card has App and Risk rows (risk chip colored by level), Always allow / Allow once / Deny, then a note. Status line with tones; footer with Cancel or "Reads the app only".
  - Fixed night primary buttons (a night rule outranked `.primary`), and greens darkened for white-text contrast.
- **Icons:** rotateCcw, chevronRight.

Checks:
- **Tests:** npm test 163/163, including new effort tests (CLI receives `-c model_reasoning_effort=high`; invalid and Claude effort are rejected) and the catalog-efforts test.
- **QA stack:** isolated demo on :4778/:5178, captured through a hidden Electron/CDP window.
  - Picker in day and night: pill, popover, slider moved Low→Medium updated both the pill and the title, model list, Claude view. Uses a page-only `/api/models` mock with the real Codex catalog shape, since demo returns unavailable.
  - Connect an app initial, approval and verified states in day and night via a page-only fetch mock.
  - Contrast checker 0 failing on all of the above.
- **Build:** `npm run app:build`; codesign verify passed; dist and changed bridge files match the package.
- **Running app (:4777):** already serves the new UI (⌘R), but its bridge process is the old code, so the effort slider shows no levels until the app is quit and reopened. Checked the live queue: no approved or running passes. Not restarted by the agent. No commit or push.

## Latest pass: UI visual upgrade across menus and modals, including the new ones (2026-10-07)

Human asked for a visual pass over every menu and modal so the newer additions match the rest. QA ran on an isolated stack (AGENT_WORLD_HOME scratch, demo, runner off, :4778/:5178). Full-resolution captures came from a hidden offscreen Electron window over CDP, with a WCAG checker run in day (noon) and night. The checker's gradient bug, which overstated failures, was fixed mid-pass.

- **Connect an app (`computer-use.js`, CSS):**
  - Was a dark, browser-default dialog in both themes. It now uses the shared panel head (plug icon, title, subtitle, icon close), a themed input and pill buttons.
  - The approval card is accent-tinted with an App / Details / Provider risk list and Always allow (primary) / Allow once / Deny (warm text).
  - The status line has tones (info, busy with a spinning hourglass, good, bad), and Cancel connection sits in a footer.
  - Logic and data attributes are unchanged. Approval state was previewed with a page-only fetch mock; nothing reached Codex or the bridge.
- **Prompter's newer pieces (`pass-card.js`, CSS):**
  - Search has an icon and themed field (the `.pass-card input` specificity clash is fixed).
  - Archived chats and Back to chats are icon rows aligned with the list. Thread archive and restore use Lucide icons instead of ▣/↶ and appear on hover like rename.
  - The provider select is a pill matching the model pill, with a theme chevron and themed options. The attach button is a soft round button. Attachment chips are accent pills.
  - Workspace and review-finding reports are themed cards with tighter type and inline code chips. Execution notes use ink-3, and Stop is a warm pill.
  - Dark-only hard-coded greys are replaced by tokens, so all of these read in day as well.
- **Review dialog:** the output link uses accent-ink (was default blue, 1.4:1 at night) and the night consent row is readable. "Review recorded" and "Task handoff" got header icons and icon close buttons.
- **Chats:** home filters are horizontal chips like Work's home row.
- **Connections:** the usage box is a filled card.
- **Every modal's close button:** one size (32 px circle, 16 px icon, same hover). Before there were 12.5, 18 and 22 px variants plus text ×.
- **New icons:** archive, archiveRestore, search.

Checks:
- **Contrast checker, day and night:** 0 failing on Work, Chats, Play, Connections, Rewards, Downtown, Album, the prompter (empty, plus a sample conversation with attachments, review findings, worktree report and Stop injected page-only), the model and usage popovers, Connect an app (form and approval), Review work, New task, the agent drawer, and the walls, quality and help menus.
- **Tests:** npm test 161/161.
- **Build:** `git diff --check` clean. `npm run app:build` passed; `codesign --verify --deep --strict` passed; packaged `dist/` matches the build byte-for-byte.
- **Running app:** the open Electron app (:4777, PID 18801) already serves the new asset hashes from its bundle, so a window reload (⌘R) shows the update. It was not restarted or reloaded by the agent, and nothing queued or running was touched. No commit or push.

## Latest pass: simpler chat list and composer Send / Stop (2026-10-07)

Human requested names only in the conversation sidebar, removal of the imported-message/provider explanatory paragraph and inline Stop buttons, and one composer icon: empty while active → square Stop, typed draft → Send arrow. Implemented those changes, accessible labels/types and filled square icon. Empty Stop bypasses required textarea validation. Stop targets only the displayed resident/provider/conversation game run (or queued prompt), never unrelated or external observed work. Stop-requested runs disable repeat Stop while still allowing typed follow-ups.

Implemented explicit human-message enqueue support because the prior backend rejected active-run sends. Preserve active/approved proposals, approve follow-ups independently, serialize execution through existing runner lock and resume exact owned UUID. Messages sent before first UUID depend on that proposal; a failed start pauses dependent work instead of creating a fresh chat. Multiple queued messages remain visible. A model’s suggested next pass cannot replace human queued messages. Existing non-enqueue proposal approval safeguards and interrupted-run inspection gates remain. No actual provider prompts or real queue mutations during tests.

Checks: Node18 full suite 160/160 passed; final focused queue/chat/composer regression checks 28/28 passed, including the added displayed-run targeting check (161 total tests after that addition). npm run app:build passed; final codesign --verify --deep --strict passed and all dist assets, bridge/passes.mjs and shared/chat.mjs match the package. Safely reopened idle Electron (zero running/approved game passes) and refreshed final frontend; native UI confirms names-only sidebar, missing paragraph and idle Send arrow. Screenshot docs/screenshots/composer-sidebar-electron.png. The Send/Stop transition and serialized follow-ups were verified with isolated store fixtures and a UI-method harness; paid-provider execution was not exercised. Existing unrelated changes preserved, no commit or push.

# Agent World next-pass handoff

As of 2026-10-07. This is a development handoff, not proof of release readiness. Recheck Git, listeners and live state when resuming.

## Latest pass: require and run Electron builds after updates (2026-10-07)

Human requested a new Electron build whenever an application update is made. Added the requirement to AGENTS.md and README.md: run npm run app:build after application code/UI updates, verify signature and packaged asset parity, and do not interrupt queued/approved/running work to restart. This requirement does not expand pass scope or authorize publishing/queue changes.

Executed npm run app:build successfully, including the prior Watch activity footer removal. codesign --verify --deep --strict passed. All eight dist files and all bridge/shared files match the packaged copies byte-for-byte. Built-JS assertions confirmed the footer Watch activity button is absent and Connect an app remains. git diff --check passed. Existing large-client-chunk, missing author, disabled asar and skipped notarization warnings remain. No full test suite rerun for documentation/build-only changes.

Updated package: release/mac-arm64/Agent World.app. Running Electron :4777 PID 87042 was left open; this runner pass must finish before a safe restart. No claim of refreshed running-window visuals. Reopen the built package when no queued/approved/running work would be interrupted; local ad-hoc rebuilds may require renewed human OS consent, as recorded below. No prompt, queue/task mutation, future approval, acceptance, spend, commit, push or publish. Existing uncommitted changes preserved. Stop after this pass; no next pass executed or proposed in the queue.

## Latest pass: remove Watch activity from prompter footer (2026-10-07)

Scoped human authorization: remove the Watch activity text next to Connect an app at the bottom of the prompter. Removed only that button markup in web/src/pass-card.js; Connect an app and the separate activity drawer remain. Preserved existing uncommitted work. No queue/task/planning metadata changes, prompts, future-pass approval, commit, publish or push.

Checks actually run: node --check web/src/pass-card.js passed; npm run build passed with the existing large-chunk warning; git diff --check passed. Targeted source assertions confirmed the footer button is absent, Connect an app remains and the activity drawer title remains. Live :4777 root returned HTTP 200; lsof identifies its Electron listener cwd as this checkout's release/mac-arm64/Agent World.app/Contents/Resources/app. Process command inspection via ps was denied by the environment. Browser verification was attempted but the in-app browser provider was unavailable. No visual verification claimed.

Runtime limit: built dist is updated, but the running Electron package was not rebuilt or restarted during this approved runner pass. It still contains its prior snapshot and may still show the removed button. Full test suite not rerun for this one-button markup removal. No next pass executed or queue proposal created. Stop after this pass; packaged refresh and visual review would require a separately authorized pass.

## Latest pass: confirm Electron computer-use access after human OS approval (2026-10-07)

Human reported completing all requested approvals and asked whether setup is good and how to see it in the UI. Verified the live packaged app without rebuilding or changing permissions. Milo's prior read-only run 3c3dad21-effc-401f-ae56-78fbe75e49d1 FAILED after the filesystem gate cleared: Codex desktop currently owns conversation 01a11890-d6d7-7161-aeb8-7231dfbc4503. CLI reported that the prompt was not executed, with no automatic retry. Do not infer native-tool use from that run or silently move it to a new conversation.

From Milo's actual Electron prompter, clicked Connect an app → Request app access for Agent World. Fresh setup connection 7a2d229f-06e5-4f12-8e91-9c19834381b4 returned status=verified, message “Native app access verified.” at 2026-10-08T00:11:46.246Z. No approval was requested again and no model turn was started. UI visibly shows the same verified message with Agent World as the target. Screenshot docs/screenshots/computer-use-verified-electron.png. Left that verified modal open for the human. This proves native access to THIS app in the packaged setup connection; it does not mean every app is allowed, prove editing/actions, or resolve conversation ownership. Normal game-prompt computer-use execution remains unverified because the existing test chat is owned by Codex desktop. Human can explicitly choose New chat in the game or continue the existing chat in Codex. No new chat, extra prompt, grant, acceptance, commit, push, or rebuild this pass. Documentation-only changes; git diff --check passed.

The previous startup/OS-gate notes below are historical, superseded by this observed packaged verification. The ad-hoc rebuild/signature caveat still applies to future builds.

## Latest pass: verify human app approval and fix first-use response parsing (2026-10-07)

Human selected Always allow in the actual Electron setup flow, then requested verification. Live /api/state recorded choice=always but unavailable with message “## Computer Use”. A fresh direct Codex app-server call returned isError=false and TWO text blocks: introductory Computer Use documentation, then the real Window: Agent World native state. No approval was requested in that fresh connection, establishing saved native-app permission for this target. Fixed bridge/computer-use.mjs to inspect all text blocks instead of only the first; documentation alone still does not count as successful app access. Added the documentation-before-window regression test. Focused service/API tests: 11/11 passed. Electron production build and final codesign verification passed; reopened the rebuilt app. Existing work preserved; no commit/push.

IMPORTANT: repeated packaged startup stall now has concrete OS evidence. macOS tccd logged “Failed to match existing code requirement” for dev.agentworld.app / kTCCServiceSystemPolicyDocumentsFolder after the rebuild, followed by AUTHREQ_PROMPTING with no completion. Ad-hoc code hashes differ across builds. A sampled normal CLI process blocks inside current_dir/getcwd/open before recording a new turn. This is a separate macOS folder-access consent from the user's saved Codex native-app approval. System Settings → Privacy & Security → Files & Folders → Agent World was opened and expanded. Documents Folder shows ON for the existing grant, but macOS still awaits the renewed signature-specific request. No OS or native-app permission was granted by the agent. Do not manipulate TCC records or signature requirements to bypass consent. For repeatable release updates, use legitimate stable developer signing; do not claim that local ad-hoc rebuilds retain OS approvals.

Authorized one bounded read-only native-access prompt through Milo's EXISTING game test conversation 01a11890-d6d7-7161-aeb8-7231dfbc4503. Run 3c3dad21-effc-401f-ae56-78fbe75e49d1 is waiting on the OS permission before a new turn/tool call. Prompt restricts inspection to Agent World and two visible labels; prohibits modifications, other apps, substitute HTTP/shell/source inspection and next work. Do not resubmit or create duplicate chats. After the human approves Documents access for the current build, verify this existing run's actual tool result and game feedback. Until then ordinary Electron prompting remains unverified. Screenshot of the exact Settings screen: docs/screenshots/computer-use-documents-settings.png. System Settings and game left open for the human; no pending approval was accepted automatically.

## Latest pass: in-game Codex computer-use approval (2026-10-07)

Human requested a self-service game flow for native application access. Located the bundled computer-use policy code: native app selection calls nodeRepl.createElicitation with provider metadata (app, risk/warning, persistence). Existing codex exec runs have no game handler for that request. A real direct app-server probe received mcpServer/elicitation/request with Agent World, get_app_state and session/always choices; probe declined without granting access. This is a supported protocol path, not editing provider permission files.

Added bridge/computer-use.mjs and guarded POST /api/computer-use. A separate ephemeral app-server thread directly calls cua_repl.js / cua.getApp; no model turn, prompt queue mutation or durable conversation. Provider-generated native-app requests are surfaced with a fresh approval ID and offered persistence choices; unknown requests are declined. Human decisions alone grant access. Origin, resident ownership, stale response, cancellation, timeout, input quoting, response size and old-connection shutdown guards apply. Native interface return alone sets verified for this setup connection. Normal codex exec prompting retains its prior fixed execution policy.

Added web/src/computer-use.js and Connect an app in the Codex prompter footer. Modal accepts a native application name/bundle ID, presents the actual request and provider warning/risk, explains Always allow vs Allow once, and reports connecting/verified/unavailable/cancelled honestly. Closing cancels pending requests. Demo mode disables real app connections. README, CONCEPT and skill navigation updated. Existing changes preserved; no commit/push.

Checks: Node18 full suite 155/155 passed after startup-timeout and connection-lifecycle guards. Initial Node22 npm test directory invocation failed to discover test/; reran the project's Node18 suite successfully. Focused service/API tests and the final production Electron build passed. Final ad-hoc codesign verification passed and packaged computer-use.mjs SHA256 matched the checkout; reopened the final app. First desktop UI test found API fallthrough to the conversation handler; corrected return and added integration regression coverage. Closing during an in-flight request cancels that exact connection; stale polls cannot replace a reopened dialog. Startup has a separate 20-second timeout; interactive approval has a three-minute timeout. Setup runs in the temporary directory, disables shell snapshots and personal memories, and removes inherited parent-chat identity/IPC variables; ordinary prompts retain existing behavior. No provider stderr or native interface text is retained in setup state. Protocol diagnostics contain only method/id/error flags.

Verified real UI: an isolated AGENT_WORLD_HOME bridge on :4788, launched from this development environment, displayed the real provider request “Allow Computer Use to use Agent World?” with dev.agentworld.app, low risk and Always allow / Allow once / Deny inside the game. Screenshot: docs/screenshots/computer-use-approval-qa.png. Closed/cancelled the test; zero proposals/runs and no saved approval. No model inference was started. Temporary QA server/tab cleaned up.

IMPORTANT OPEN BLOCKER: packaged Electron-owned app-server initializes but stalls at thread/start before a permission request. Same ComputerUse class, Electron Node binary, working directory and reproduced GUI environment work when launched from this development shell. Provider sampling found a blocked filesystem read_dir; earlier startup also logged shell-snapshot timeout. Exact cause is unresolved; do not claim TCC, shell configuration or inherited identity as the proven cause. Changing cwd, parent-context variables and disabling optional initialization features has NOT established standalone packaged success. Final build includes a clear startup timeout rather than an indefinite spinner. Development-browser flow is verified; standalone Electron approval flow is not ready. The in-game button exists, but packaging success is not runtime success.

Next work: isolate the packaged process's filesystem startup stall without bypassing macOS/provider restrictions. After that, let the human choose app approval in the game, then run a separately authorized ordinary game prompt to prove saved access. Never click Allow once/Always allow on their behalf. No claim that all apps or first-time OS permission installation work without ChatGPT; installed/authenticated Codex and its native service remain prerequisites. Existing source changes remain uncommitted/unpushed.

## Latest pass: start human app-approval flow (2026-10-07)

Human requested starting the approval process. This desktop chat could read Agent World through cua.getApp, but a second actual game-runner attempt in Milo’s existing test chat still returned "Computer Use was not approved to use Agent World" (run 01ce15e5-02d5-4e9e-a428-2fc4b6e5e4f8). Thus current-chat permission is not proof of saved access for the independent CLI. Computer Use declined access to Codex itself for safety; no workaround or settings edit attempted. Used the supported Codex navigation and task-message tools to open thread 01a11890-d6d7-7161-aeb8-7231dfbc4503 and start one explicitly human-authorized desktop read-only request for Agent World access. Human should approve via the app’s permission UI, using Always allow if desired. The desktop retry also completed with the same app-approval denial; no approval dialog was confirmed. Human must review Computer Use app permissions in desktop settings. Saved permission and subsequent game-runner access remain to be verified. No code changes, build, commit or push.

## Latest pass: real game-launched computer-use connection test (2026-10-07)

On explicit human authorization, submitted one read-only test prompt to idle Milo through the running Electron bridge on :4777, using the actual fixed-policy Codex runner. Run c9bdd0a8-63ee-4ee1-9ae8-7b2210a9dcad; Codex thread 01a11890-d6d7-7161-aeb8-7231dfbc4503. Verified the raw rollout tool call mcp__cua_repl.js invoking cua.getApp("dev.agentworld.app") and its tool output: "Computer Use was not approved to use Agent World". This establishes tool availability and a responding permission gate, not successful native UI access/control. Runner returned the blocked report to Milo’s game chat with next:null; no files/settings/messages were changed by that test. No retries or permission overrides. No suite/build needed for this verification and documentation-only pass.

Next: human grants Agent World app access in Codex/ChatGPT Computer Use permissions (a saved app approval may be needed for non-interactive runs), then explicitly retry the same bounded native-interface test from Milo’s chat. Verify real labels/screenshots before claiming desktop control works. Keep permission denial separate from successful task outcome.

## Latest pass: remove worktree option from prompter (2026-10-07)

Human requested removing Use isolated Git worktree for this new chat. Removed the checkbox, its draft state/change handlers/provider carry-over and isolate request field from the prompter. New game chats use the project checkout. Existing worktree conversations retain their workspace; no merge/removal or metadata rewrite. Preserved other pending work. Syntax and git diff --check passed; no extra tests added for this narrow UI removal. npm run app:build and codesign --verify --deep --strict passed. All packaged dist assets match the checkout and the worktree checkbox text is absent from built JS. Reopened Electron on :4777 (PID 89251), /api/state responded, and native UI/screenshot docs/screenshots/no-worktree-option-electron.png confirmed the checkbox is gone from a new-chat composer. No suite rerun for this narrow UI removal; prior backend behavior remains covered by the preceding 146-test pass. No real prompts, queue mutations, commit or push.

## Latest pass: fixed prompt policy and settings removal (2026-10-07)

Human requested removing all newly added bottom Run settings controls and fixing their values. Removed ExecutionControls component, event handlers, preference submission and settings CSS. Existing provider/model/attachment/worktree controls and historical findings remain. New workflow always Prompt; Codex workspace-write, shell=true, workspace shell network=true, web_search=live; Claude configured dontAsk permissions, shell tools available, WebSearch/WebFetch allowed where supported. Both inherit CLI MCP/plugins; Codex inheritance is supported and requires no forced-off fallback. Claude configured sandbox/network/tool rules still apply.

Fixed policy is applied at proposal validation, claim and runner startup. Override requests fail, old queued preferences cannot re-enable reviews, and old completed records are preserved. No changes to global CLI config, credentials, plugin installation or real queue metadata. Node18 full suite 146/146 passed, including fixed-policy rejection, old queued preference replacement, and mocked Codex/Claude exact CLI argument delivery. Source syntax and git diff --check passed. Desktop refresh checked zero approved/running/interrupted game runs and an empty native composer before closing the old app. npm run app:build and codesign --verify --deep --strict passed; packaged execution policy/runner/store and all dist assets match source. Reopened Electron :4777 listener PID 78685 and verified /api/state. Native UI and docs/screenshots/fixed-policy-electron.png confirm no Run settings or review/permission/search/MCP controls; existing composer controls remain. No real prompt/service calls were submitted. App remains open. Inherited packaging warnings remain. Preserved pending changes; no commit or push.

## Latest pass: reviews, integrations, search and execution controls (2026-10-07)

Authorized scope: code review workflows, MCP/plugins, supported web search, configurable execution access. Preserved all prior pending changes; no commit or push. Run settings in the composer pins preferences to each message and reuses recorded settings for its chat; running turns are unchanged.

Implemented structured review workflow with changed-files/branch/commit scopes, bounded Git input and recorded HEAD/reference/diff digest/time. Reviews use the existing structured prompt CLI (not Codex native exec review), return validated P0–P3 file/line/impact findings in chat, and forbid fixes/acceptance/next execution. Zero findings is a reported result, not correctness evidence. Reviews/read-only access disable external integrations; Claude read-only restricts built-in tools rather than providing an OS sandbox.

Codex: read-only/workspace-write, shell tool and workspace shell-network toggles, default/off/cached/live search, unattended approval_policy=never. Claude: configured dontAsk, explicit acceptEdits with permission-prompts=none, read tools only, shell deny and default/off/on WebSearch/WebFetch. No dangerous permission bypass controls. Web/MCP availability remains provider/account/managed-policy dependent; configuration is not observed use.

Integration catalog returns configured MCP/plugin names/enabled metadata only, never secrets; Codex MCP list JSON plus local user/project plugin tables, Claude MCP/settings metadata. Selection emits per-run config/settings, not global writes. Up to four trusted HTTPS endpoints (no embedded credentials/query/fragment), optional Codex server tool allow lists; private per-run Claude MCP JSON. Missing inventory/selections fail explicitly instead of falling back. Plugin install/OAuth login remains in the provider CLI; Refresh configured tools reloads the list. Workspace-managed plugin choices can override local preferences. Actual authenticated service calls, new plugin installation and real inference remain unverified.

Evidence: Node18 final full suite **146/146 passed**, including the final preflight cancellation regression. Earlier focused execution suite **6/6 passed** after the Claude search-allow change. Tests include Git scopes without source mutation, settings pinning, private/redacted integration configs, missing selection failure, Codex mock review findings, Claude merged command/web/MCP denials without bypass, and Stop during async integration preflight preventing any instruction process from starting. Build/syntax/diff checks passed; installed Codex accepted setting keys with read-only mcp list, no model turn. Isolated AGENT_WORLD_HOME/browser mock on :4789 verified selection, connection draft add/remove, review defaults, returned reported finding, and provider-specific Claude controls. No console errors. docs/screenshots/run-settings-qa.png is explicitly mock evidence. No real prompt, service calls, acceptance or spend.

Desktop refresh: checked no approved/running/interrupted game-controlled executions and no visible unsent composer before closing the old app. Final npm run app:build succeeded, ad-hoc codesign --verify --deep --strict passed, and all built assets plus execution/review/integration modules match the checkout. Reopened packaged app at :4777, listener PID 64601; /api/state responded. Native UI confirmed Milo’s empty owned list and Run settings with Workflow, Permissions, Web search, shell/network and MCP/plugins controls. docs/screenshots/run-settings-electron.png shows the actual refreshed app, with an empty prompt; no settings were submitted. Native accessibility IDs changed during observed SSE/model updates, so the final expansion used its verified screenshot position. Closed the isolated QA server/tab. External observed agents were not stopped. Inherited large-chunk, disabled asar, missing author and skipped notarization warnings remain; this is a local ad-hoc package.

Limits: Git diff max1 MB, untracked file max256 KB. Diff content is captured at execution start; later source reads can change unless using an isolated worktree. Claude hooks and managed configuration remain outside its built-in tool restriction. Codex shell toggle governs its default shell tool; arbitrary configured external tools are separate. Plugin inventory covers standard user/project local tables, not a remote marketplace or complete workspace-managed catalog. No game-owned interactive permission/OAuth prompt transport.

## Latest pass: direct prompt tools (2026-10-07)

Human authorized attachments, cancel/stop, isolated worktrees and conversation management. Preserved all pending resident-ownership and overlay work on ai-features; no commit or push.

Implemented private home/resident-bound, integrity-checked image/text uploads (four files, 5 MB each, 256 KB text; 20,000 text characters passed), Codex image flags and Claude Read paths; no PDF/binary documents. Added queued cancellation and Stop for current game-owned CLI process groups, including escalation for surviving descendants. Cancellation retains edits and gives an explicit chat result. External agent processes are not controlled.

New chats can execute in an isolated Git worktree with HEAD plus tracked/untracked source changes captured at execution time; ignored files are excluded. Follow-ups reuse the registered workspace. Replies expose branch/path/Open in VS Code; no automatic merge/removal. World observations map the worktree back to its logical resident/home while retaining actual sourceProject provenance. Resident/provider lists now search, archive and restore with ownership/API guards and active-work protection; archive hides local entries without deleting provider history.

Verification: Node 18.16.0 full suite **139/139 passed**, including real temporary Git snapshots/reuse, native attachment delivery via mock CLI, descendant process cancellation, origin/ownership guards, persistent archive/restore, and observed worktree provenance. Production build, packaging and git diff --check passed. Inherited large chunk, disabled asar/missing author/notarization warnings remain. Completed ad-hoc signature verification passed; packaged attachment/workspace/runner/server/chat/index hashes match checkout.

Actual browser QA used isolated AGENT_WORLD_HOME and mock CLI on :4789, with explicit Demo labeling: upload brief.md, new worktree chat, returned mock reply, continued chat in same worktree, Stop with clear cancellation, search no-match, archive and restore. No browser console errors. Screenshot docs/screenshots/prompt-tools-qa.png is isolated mock evidence, not real provider inference. No real prompts, queue changes, acceptance or spending. Private draft uploads persist on disk after removal; no cleanup/retention policy yet. Claude image reading remains subject to its configured tool permissions; actual authenticated provider execution remains unverified.

Before desktop refresh, read-only live state showed no approved, running or interrupted game-controlled executions, and the native UI had no unsent composer. Closed the app, rebuilt and reopened release/mac-arm64/Agent World.app. External observed sessions were not stopped. Refreshed listener PID 40422 served /api/state on :4777. Native Electron UI confirmed Milo’s empty owned list, Search chats, Archived chats, Attach files and isolated-worktree checkbox; screenshot docs/screenshots/prompt-tools-electron.png. The app remains open with an empty composer. Closed the temporary QA tab/server. Recheck live state before any future refresh.

## Latest scoped pass: rebuild packaged app (2026-10-06)

Approved instruction: rebuild the app. Preserved all uncommitted source/docs/screenshots. Ran `npm run app:build` successfully: Vite built 170 modules and electron-builder 26.8.0 packaged Electron 39.8.10 for macOS arm64 at `release/mac-arm64/Agent World.app`, with an ad-hoc signature. Latest overlay removal and resident conversation ownership are included.

Checks actually run: `codesign --verify --deep --strict --verbose=2` passed (valid on disk, satisfies Designated Requirement); SHA-256 comparisons matched packaged electron/main.cjs, bridge/world.mjs, bridge/server.mjs, shared/chat.mjs, shared/pass-conversations.mjs, dist/index.html and the built JS/CSS assets to the checkout; packaged index.html has no id="needs" strip. `node --check electron/main.cjs` and `git diff --check` passed. No test suite or visual QA ran during this packaging-only pass.

Build warnings: inherited 1,014.45 KB client chunk, missing package author, disabled asar and skipped notarization. This is a local ad-hoc signed app, not a notarized release. Read-only pass metadata showed running work, and lsof confirmed the existing :4777 listener PID 4426 remained running. Did not quit/restart the app or change queue state. Reopen the rebuilt app after the current pass finishes to load the new client/code; live rendering remains unverified. No publishing, push, spend, outside-chat messages, acceptance, approvals or next-pass execution. This single pass stops here; no next pass proposed.

## Latest scoped pass: remove overlay Needs you strip (2026-10-06)

Approved instruction: remove the yellow Needs you tag and the adjacent agent cards to its right on the overlay. Removed the entire `#needs` / `#needs-list` strip from `web/index.html`, its UI references/listener/render method, the obsolete `onPromptKey` handler and its CSS/layout rules. Kept the shared pop-in animation used by toasts. Roster layout now starts directly below the top bar. The separate project roster, activity drawer, world-space waiting signals, edge arrows and Work attention view remain. README, CONCEPT and the skill navigation reference document the current entry points.

Preserved all existing uncommitted resident-ownership work, desktop-refresh documentation and two untracked resident-chat screenshots. This pass changes only `web/index.html`, `web/src/ui.js`, `web/src/main.js` (one obsolete callback removal), `web/src/style.css`, README, CONCEPT, the navigation reference and this handoff. No real metadata, queue/task changes, prompts, approvals, acceptance, spending, outside-chat messages, commit, push or publishing. Stops after this single pass; no next pass proposed or executed.

Checks actually run:
- `node --check web/src/ui.js`, `node --check web/src/main.js`, and `git diff --check`: passed.
- `node --test test/agent-view.test.mjs test/freshness.test.mjs`: 5/5 passed. Full suite not run for this narrow UI removal.
- `npm run build`: passed, 170 modules; inherited large-chunk warning (1,014.45 KB JS).
- Source-reference scan: no remaining needs-list, needs-label, renderNeeds, onPromptKey or #needs overlay references in web sources. Sim's unrelated simulated needs remain.

Runtime/limits: lsof identified :4777 PID 4426 with cwd `release/mac-arm64/Agent World.app/Contents/Resources/app`; no :5177 listener was found. Read-only shell HTTP request to :4777 failed. Computer Use app inspection returned “Computer Use was not approved to use Agent World”; no app action or screenshot occurred. The packaged Electron app was not rebuilt/restarted during this pass and still uses its existing copy. Actual rendering, interaction and mobile layout remain unverified for this removal. Source/build checks are not production-live evidence.

## Latest pass: apply resident-owned chats to the running Electron app (2026-10-06)

Human reported that the resident-owned-chat implementation was not visible. Verified the live :4777 listener was the packaged Electron app, rooted in release/mac-arm64/Agent World.app/Contents/Resources/app. Its shared/chat.mjs hash differed from the checkout and its world code had no residentSlot handling. This was a stale packaged release, not evidence that the new source had reached the desktop. The old Milo modal exposed Otto's recorded chats, consistent with the previous prompt-recipient override.

Preserved the pending ai-features implementation. All 131 tests passed fresh on Node 18.16.0; production build and git diff --check passed. After rechecking zero approved/running/interrupted executions and no unsent input, quit the old app using the native UI, ran npm run app:build successfully, verified its ad-hoc signature with codesign --verify --deep, and reopened the packaged app. Packaged shared/chat.mjs and bridge/world.mjs hashes now match the checkout. README now explains that source/build changes require rebuilding/reopening the packaged app and refreshing a reused bridge.

Verified actual desktop UI via native accessibility: Otto's list contains three Codex threads, Nell's list contains three different Codex threads, Milo's Codex list is empty and its prompt recipient is Milo. The live API independently confirms those exact resident counts and no shared valid thread IDs; eight observed catalog records now have persisted residentSlot fields after replay of actual history. No fabricated events or planning/queue mutations. Historical wrongly-routed prompts remain with their recorded first owner rather than being guessed or rewritten. Earlier app message history still is not imported.

Screenshots actually inspected: docs/screenshots/resident-chats-nell.png and docs/screenshots/resident-chats-milo.png. Nell's screenshot contains a historical desktop-writer conflict reply; it was not produced by this pass. Native UI snapshots/actions occasionally went stale as the observed activity changed; refreshed before retrying. Actual new provider inference remains unverified; no real prompts, approvals, retries, acceptance, spending, messaging other chats, Git commit or push performed. The refreshed packaged app remains open. Existing Codex desktop-writer constraints are independent of resident ownership.

## Previous scoped pass: resident-owned conversations and prompt routing (2026-10-06)

Approved scope: each agent has its own conversations in the prompter, and a prompt addressed to a clicked agent executes for that agent. Work stopped after this pass. Checkout: `/Users/blacksatoshi/Documents/Projects/agent-world`, branch `ai-features`, starting HEAD `8f2ad9b`. Starting Git status was clean; no reset, commit, push or publishing performed.

Implemented:
- Prompter recipient comes from the clicked resident's home and slot; it no longer switches recipients by looking up a prior run attached to the observed thread. Helper entry uses its parent resident. Switching residents clears an unfinished rename form.
- Owned observed chats join that resident's recorded chat list, with provider separation. Exact thread ownership gates selection, continuation and rename entry. Legacy duplicated runs remain untouched: the first run containing that thread identifies its single owner. Unassigned saved app links remain in the project shelf; earlier app messages are not imported.
- Proposal and approval API paths reject cross-resident continuation. PassStore rejects nonexistent resident slots when household characters are available and refuses conflicting thread identities. The runner rejects conflicting ownership/invalid returned identity without fallback or retry.
- Catalog metadata persists `residentSlot` for observed primary chats. World assignment honors recorded runner ownership and persisted conversation ownership. A runner identity arriving after the observer corrects the resident association without synthesizing events or changing observation timestamps. The client clears a former resident's attachment when a session moves and prevents older-session updates from replacing newer observed activity.
- Fresh and continued sends wait while the selected resident is observed working. Existing queue records were not migrated or modified by this pass.

Changed source: `shared/pass-conversations.mjs`, `shared/chat.mjs`, `bridge/world.mjs`, `bridge/server.mjs`, `bridge/passes.mjs`, `bridge/pass-runner.mjs`, `web/src/pass-card.js`, `web/src/main.js`. Regression coverage: `test/pass-conversations.test.mjs`, `test/chat.test.mjs`, `test/world.test.mjs`, `test/passes.test.mjs`. README and CONCEPT explain the ownership behavior.

Checks actually run:
- Final focused command: `node --test test/pass-conversations.test.mjs test/chat.test.mjs test/world.test.mjs test/passes.test.mjs`: **37/37 passed**, including owned chat lists after persistence/restart, foreign resident/provider/home exclusion, cross-resident resume and returned identity rejection, busy recipient gating, and a mock CLI fresh prompt for resident two whose early observed event was reassigned from resident one to resident two. Mock execution used temporary projects/stores only, never a paid provider.
- Full explicit suite: `node --test test/*.test.mjs`: **131 tests; 127 passed, 4 failed**. The four failures were the existing catalog API integrations exiting at bridge startup (`Bridge exited: 1`). This full run preceded only the final nonexistent-resident guard; the final focused run covered that guard.
- `npm run build`: passed, 170 modules, inherited large-chunk warning (1,015.54 KB JS). All eight changed source modules passed `node --check`; `git diff --check` passed.
- Isolated UI server attempted with scratch `AGENT_WORLD_HOME`, runner disabled, port 4789 and `dist/`: startup failed with **listen EPERM 127.0.0.1:4789**. No temporary server remained running. No browser interaction with the updated UI was possible; no screenshot is claimed.

Runtime and uncertainties:
- `lsof` identified :4777 PID 86134 as the packaged Electron app, cwd `release/mac-arm64/Agent World.app/Contents/Resources/app`. The :5173 Vite listener belongs to sibling remotion-vfx, not this project. `ps` was denied and shell read-only HTTP connection to :4777 failed. Computer-use inventory confirmed Agent World running and no Chrome Agent World tab.
- The running packaged app was neither repackaged nor restarted; it does **not** load this checkout's updated source/build. Actual desktop interaction and authenticated provider execution remain unverified. This pass establishes source/build and isolated mock evidence, not production-live or human acceptance.
- Legacy external conversations without persisted ownership acquire it when their real events are replayed; unobserved saved links are never assigned an invented agent. Concurrent sessions owned by one resident retain separate truth records; the client displays its most recent observed session.

No real home metadata, queue/proposal/task state, acceptance, spending or chats were changed. No real prompts, outside-chat messages, future approvals or follow-up execution occurred. No next pass is proposed. Review this diff and the checks above; do not infer authorization to relaunch or execute work from this handoff.
As of 2026-10-08. This is a development handoff, not proof of release readiness. Recheck Git, listeners and live state when resuming.

## Latest pass: Town Hall cutaway entrance (2026-10-08)

Attached the Town Hall's hinged doors, portico columns/caps and overhead beam to the animated front-wall group in `web/src/commons.js`. They now lower with that wall to clear the office view and return with it when the hall closes; the entry steps remain at ground level. Preserved the existing door-open animation for Martin's walk-in.

Verification: `node --check web/src/commons.js`, `npm run build`, 15 focused gameplay/progression/neighborhood tests and `git diff --check` passed (existing chunk-size and CRLF notices only). A temporary hidden tab on the real 4777 bridge showed an unobstructed office cutaway and the restored portico/doors with the roof closed; no player actions or saved game data were changed. The temporary tab was closed, and the existing bridge stayed running. No commit or push. Reload the player tab to use the new bundle.

## Latest pass: Town Hall roof and Mayor's office (2026-10-08)

Corrected the finished Town Hall's gable slope so its center ridge is above both eaves. Replaced the council-room layout with Martin's office: desk, plans, lamp, chair, two visitor seats, bookcase/trophy shelf, rug and plants. Opened the front wall into a real doorway with animated door leaves. When a live build changes from building to built, Martin follows a path through the doorway, around the desk and into his chair, then poses seated. A page loaded with an already-built Hall seats him immediately rather than replaying the walk.

Browser QA used isolated `AGENT_WORLD_HOME` fixtures on bridges 4785 and 4787 (runner disabled). In 4787, two 5-gem expedite actions completed the isolated build, and Martin visibly walked through the hall and settled behind the desk. The cutaway showed the office; moving the camera away restored the closed roof. No real-town gems or connection state were changed. `npm run build`, syntax checks, 15 focused gameplay/progression/neighborhood tests and `git diff --check` passed (the existing large-chunk and CRLF notices remain). No commit or push. The real bridge on 4777 remains running; reload its page for the new bundle. The isolated QA bridges were stopped after testing.

## Latest pass: reset town link and gate residents (2026-10-08)

The human reported seeing existing agents while stuck at Mayor Martin's connection step. Two live homes were identified: the real bridge on 4777 was running an older server without `/api/gameplay`, while the 5184/4784 isolated preview had no saved connection. Both real `~/.agent-world/gameplay.json` and preview `%TEMP%\agent-world-mayor-fresh-preview\gameplay.json` are now explicitly empty (`connection: null`, `townhall: null`); pre-existing style and observed events/households/conversations were preserved. After checking no approved/running proposals, restarted only the real `scripts/dev.mjs --prod` stack so 4777 serves the current bridge and built client. Codex's external sign-in remains unchanged; read-only usage on 4777 reports available.

In `web/src/main.js`, unlinked towns suppress observed homes, residents, sessions, and downtown display while keeping the observation records intact. A successful game link refetches the bridge snapshot and reveals them. `web/src/ui.js` labels the state "Town not linked" and points the empty roster to Martin; `web/src/onboarding.js` distinguishes an existing CLI sign-in from linking it to this town and reports a stale server's 404 clearly. A disconnected first visit opens Martin even if an older browser's seen flag is set. `shared/gameplay.mjs` has the pure resident gate and a regression test. Updated README/GAMEPLAY copy.

Verification: 15 focused gameplay/progression/neighborhood tests passed; production build passed with inherited chunk warning; `git diff --check` passed with CRLF notices. In the real 4777 browser view, 3 recorded households and 1 live observed session remained in the API but no homes, agents, or downtown businesses appeared before linking; the Mayor dialogue showed the link choice and there were no console errors. In an isolated 4786 sample home, a recorded resident was hidden before the Codex claim and appeared afterward alongside 50 gems and the Town Hall choice. No real claim, gem spend, task acceptance, external sign-out, commit, or push. The 5184 first-run preview remains unlinked. Next: confirm a human-initiated link in the real town, then test resumed observed-session updates and the build flow; do not claim on the human's behalf.

## Latest pass: larger civic plots and playable Town Hall (2026-10-08)

Kept Mayor Martin's current world size. Enlarged and repositioned the Town Hall, park, cafe and plaza plots in `web/src/commons.js`, expanded the square/paths/navigation bounds, and scaled their built contents and construction site to suit the characters. The finished Town Hall now has a columned entrance, pediment, teal gabled roof, clock cupola and furnished council room with the existing outcome trophies. Its roof spring-lifts on approach and lowers camera-facing walls in cutaway mode like a home; double-clicking the hall focuses it. Updated the square map framing in `web/src/mapmode.js` and main camera/settings integration in `web/src/main.js`.

Checks: focused gameplay/progression/neighborhood tests passed 14/14; `npm run build` passed with the inherited chunk warning; `git diff --check` passed with CRLF notices. Browser QA used isolated `AGENT_WORLD_HOME=%TEMP%\agent-world-hall-qa` and bridge 4785 with a past-due Town Hall test fixture: verified completed hall interior/exterior, roof open/closed by camera distance, expanded empty plots, and no browser errors at the desktop viewport. The user's 5184 first-run preview and real 4777 bridge were not modified. Mobile viewport was not available in this browser session. `npm test` still fails on Windows because Node 24 treats `test/` as a module; explicit suite discovered tests but inherited Windows-specific CLI/path fixture failures. No commit or push. Next: review the Town Hall from the normal player camera in clear daytime and test park/cafe/plaza unlock visuals on an isolated home, especially at mobile width; adjust art/labels as needed.

## Latest pass: Mayor portrait framing and tie (2026-10-08)

Human asked for Mayor Martin to match resident size in the world, have a corrected necktie, and appear waist-up on the left while speaking. In `web/src/mayor-character.js`, his world rig now uses `buildPerson` scale 1 and build 1 (the resident defaults), with a matching contact shadow and lower world label. Replaced the oversized cone tie with a narrow two-part knot and blade on the same rig used by the in-world and dialogue portraits. Moved and aimed the portrait camera to frame his head through waist. In `web/src/style.css`, his portrait is on the left and the speech box on the right with its tail pointing back to him; on mobile the waist-up portrait sits behind the full-width bottom conversation box. Browser screenshots at the default desktop viewport and 390x700 showed the full head, tie, waist crop, dialogue and choices without overlap. The isolated first-visit preview remains at `http://127.0.0.1:5184/` (bridge 4784, `%TEMP%\agent-world-mayor-fresh-preview`, runner disabled); the in-app browser is left on the opening line at its normal viewport. Real bridge 4777 was not touched. `node --check web/src/mayor-character.js` passed, focused gameplay/progression/neighborhood tests passed 14/14, `npm run build` passed with the inherited large-chunk warning, and `git diff --check` passed with only CRLF notices. No economy, agent-state, prompt, or persistent-data changes; no commit or push.

## Latest pass: 3D Mayor and living Town Hall site (2026-10-08)

Human asked for Mayor Martin to be an in-game agent character rather than a static cutout, animated during his introduction, and for visible Town Hall construction with a clickable countdown sign. Added `web/src/mayor-character.js`: Martin is a dedicated, persistent game-owned 3D character at the town square using the same `buildPerson` rig as residents, with a matching live-rendered 3D dialogue portrait, speaking gesture/mouth animation, gray beard, tie and badge. He is clickable in the world. The verified Codex/Claude claim changes his provider-link badge; it does not synthesize an observed session, prompt the provider, or make the scripted tutorial into a live AI conversation. Actual model-backed Mayor conversation remains a separate future feature requiring explicit user prompts and a clear game/observed-state boundary. Removed the previous generated static PNG from `web/public`.

The active Town Hall site now has two animated hard-hat builders and a rotating/hoisting crane. Its CSS2D sign shows seconds-level time remaining from the persisted `readyAt` and opens Martin's construction details/expedite choice; his world name label opens the same conversation. No gameplay economy or bridge contract changed. Browser QA in an isolated `AGENT_WORLD_HOME` at `%TEMP%\agent-world-mayor-avatar-preview` used Vite 5183 and bridge 4783 (runner disabled): checked first greeting, read-only Codex claim (+50 gems), 30-gem build, visible site animation, live countdown, sign click to details, world-Mayor click, and desktop/mobile 390x700 framing. Earlier real bridge on 4777 was untouched. `node --check` passed for the four changed JS modules, focused gameplay/progression/neighborhood tests passed 14/14, `npm run build` passed with the inherited large-chunk warning, and `git diff --check` passed with only Git's CRLF notices. The prior full-suite Windows fixture/path failures were not rerun. QA servers on 5183/4783 were stopped. A fresh first-visit preview is running on Vite 5184 and bridge 4784, with runner disabled and `%TEMP%\agent-world-mayor-fresh-preview` as its isolated game home; the in-app browser is left on Martin's greeting. Preserve the existing untracked `yarn.lock` and earlier onboarding work. No commit or push. Next focused step: decide and design Martin's post-connection model-backed conversation, with explicit user prompts and no confusion with observed resident-agent activity.

## Latest pass: RPG-style Mayor Martin onboarding UI (2026-10-06)

Human supplied three game-dialogue references and asked to make onboarding feel like a game. Replaced the centered modal with a non-modal in-world conversation overlay: a generated transparent low-poly Mayor Martin character anchored at the lower right, a named speech panel at the lower left, a first line followed by RPG response choices, and game language for inviting a provider, building, speeding up, and exploring. The town and construction site remain visible behind him; other HUD controls fade while the conversation is open. On phone widths the character sits above a full-width dialogue box with vertically stacked choices. The generated art is `web/public/mayor-martin.png`. The backend economy, provider checks, construction clock, and player data format are unchanged.

The isolated browser preview on 5181/4781 was used at 1440x900 and 390x700: verified visible character and bubble, unclipped nameplate and options, Connections → Mayor return path, read-only Codex claim, 30-gem build, 5-gem speed-up, the 3D construction site, completed Town Hall, and closing back into the world. `npm run build` passed, copying the character asset into `dist`; the known large-chunk warning remains. Focused gameplay/progression/neighborhood tests passed 14/14. `node --check web/src/onboarding.js` and `git diff --check` passed. The previous full-suite Windows fixture/path failures were not rerun for this UI-only pass. Existing user data and the bridge on 4777 were not touched. Existing untracked `yarn.lock` and the prior onboarding changes were preserved.

The QA preview on 5181/4781 was stopped after that walkthrough. A fresh, isolated preview is running at `http://127.0.0.1:5182/` (bridge 4782, `AGENT_WORLD_HOME` at `%TEMP%\agent-world-rpg-preview`, runner disabled). The in-app browser is left on the first Mayor Martin greeting with its normal viewport restored; this is preview-only data, not the user's game home.

## Previous pass: Mayor Martin onboarding and Town Hall construction (2026-10-06)

Human asked to implement the game-first onboarding, naming the Mayor "Mayor Martin." First launch now opens his dialog, calls the player Governor, focuses the Town Hall plot, and guides a Codex or Claude Code connection claim, a 30-gem Town Hall build, its five-minute real-time construction, optional 5-gem/minute expedites, and the opening celebration. Play has a Mayor Martin entry to resume the dialog. The connection grant is 50 gems once per game home. Codex claim requires a successful read-only quota call; Claude Code claim requires `claude auth status --json` with `loggedIn: true`. No agent prompt is submitted to verify either connection.

The bridge stores player-selected game actions in `gameplay.json`, separate from observed events, work plans and style. The server checks balance and spending; the client and 3D Town Hall derive construction status from `readyAt`. Progress and decor use the shared gem balance. Product copy now says gems instead of bricks; `BRICKS` remains as an internal alias for existing imports and ledger fields. Park, cafe and plaza still open from milestones. Existing untracked `yarn.lock` was preserved.

Checks: focused `node --test test/gameplay.test.mjs test/progression.test.mjs test/neighborhood.test.mjs` passed 14/14; `npm run build` passed with the inherited large-chunk warning; `git diff --check` passed. `npm test` fails because Node 24 treats `test/` as a module. The explicit full glob runs, but existing Windows-specific hook, CLI mock and path tests fail; feature-focused tests pass. In a separate `AGENT_WORLD_HOME`, browser QA showed Mayor Martin on first load at mobile and desktop widths, a real read-only Codex claim yielding 50 gems, Town Hall start costing 30, speed-ups costing 5 each, persistence across reload, the construction site and finished building, and decor purchase rejection when only 5 gems remained. Keyboard activation worked; browser automation mouse click coordinates were offset in this environment and are not evidence of a product mouse defect. No real home was mutated.

Preview: isolated Vite on 5181 and bridge on 4781, with a fresh test home (verify listener state before reuse). Existing bridge on 4777 was not interrupted. No commit, push, account sign-in, agent prompt, user task acceptance or real-game gem spending. Next focused check: run a Claude Code authenticated claim on a machine with Claude signed in, and manually mouse-test the dialog in the desktop app. Future active player-placed buildings should use the construction timer pattern; decor placement remains immediate.

## Git checkpoint: Electron app and accumulated updates (2026-10-06)

The human authorized committing and pushing the current project, including the Electron conversion, to the configured GitHub origin/main. This checkpoint includes the Electron wrapper/config/icons, accumulated visual and navigation changes, Claude prompt routing, Codex executable discovery, related tests and docs. Generated release/, dist/, node_modules/ and runtime/demo data remain excluded. All prior work preserved.

Fresh checks: explicit Node 18.16.0 test run passed 125/125; production build passed with the existing large-chunk warning; Electron main syntax and git diff --check passed. Credential/key-pattern scan of changed text files returned no matches. Existing mac-arm64 packaged app passed codesign --verify --deep (no new package generated or app relaunched during this checkpoint). Verified origin/main matched local HEAD before committing. Current bridge listener belongs to the Electron app; it was not interrupted. Prior authenticated-provider, browser and notarization limitations remain scoped as recorded; this checkpoint does not claim a new real prompt test, notarization or release readiness.

## Previous pass: remove main-overlay buttons (2026-10-06)

Scoped human instruction: remove the chat, Prompt agent and All homes buttons from the main overlay. Removed the Conversations icon and focus chip from `web/index.html`, the generated Prompt agent button and focus-chip refresh/listeners from `web/src/main.js`, and their obsolete CSS/icon/listener references. Connections → Chats now calls the conversation library directly through an Experience callback instead of clicking the removed overlay control. Resident activity-view prompting, world-space shelves and the existing focus preference/notification logic remain. README documents the entry points. Prior uncommitted work preserved.

Checks actually run: syntax checks for main.js, experience.js, conversations.js and ui.js passed; `git diff --check` passed. `node --test test/chat.test.mjs test/freshness.test.mjs` passed 8/8. `npm run build` passed (170 modules; inherited large-chunk warning, 1,014.33 KB JS). Source-reference scan found no remaining references to the removed IDs/handlers (the unrelated `.focus-status` class remains).

Runtime: lsof identified existing Vite :5177 and bridge :4777 listeners, PIDs 58563/61106, and verified both cwd paths are this checkout. Shell HTTP probe returned connection failure (000); process command inspection was denied. Computer-use inventory timed out twice, so no browser/desktop visual verification or screenshot was obtained. Build/tests do not establish live rendering or interaction behavior. Existing servers were not restarted. Full suite not run for this narrow UI removal.

Changed this pass: web/index.html, web/src/main.js, web/src/conversations.js, web/src/experience.js, web/src/ui.js, web/src/style.css, README.md and this handoff. No queue/task changes, prompt submission, acceptance, spending, messages to other chats, future pass approval/execution, commit, push or publishing. Stop after this single pass; no next pass is proposed.

## Previous pass: Codex startup from a minimal PATH (2026-10-06)

Human reported Nell's prompt failed with `Codex CLI could not start`. Live runner capability was codex.installed=false, although the signed-in Codex CLI existed inside ChatGPT.app. Root cause: bridge used the literal `codex` executable and its startup environment could not resolve it. Verified the official bundled binary with `--version` (0.160.0) and read-only `login status` (logged in using ChatGPT).

Added shared Codex discovery: explicit `AGENT_WORLD_CODEX_COMMAND`, executable on PATH, then known official macOS app bundle paths. PassRunner and model/usage app-server RPCs share it; overrides remain pinned even if missing. Missing CLI now disables Send and rejects proposals before approval. Startup errors distinguish a missing executable from executable permissions and no longer imply an authentication failure. Provider, history and all other uncommitted changes preserved. Skill's stale Claude-continuation sentence corrected to the already-implemented game-owned-session rule.

Restarted only the API bridge after confirming zero approved/running/interrupted work; existing Vite and tailer remain. New bridge runner reports both providers installed. No failed prompt replayed, queue modified, new inference sent, task accepted or commit/push performed. Existing failed chat messages remain historical evidence. Human can explicitly resend the instruction. Desktop conversation ownership constraints remain separate from this resolved executable lookup failure.

Checks: new minimal-PATH/override/executable-permission discovery test plus runner/usage regressions passed 21/21 on Node 18.16.0. Full suite passed 124/125; its one planning-helper integration failure (catalog-api seen action) passed on a targeted rerun, without changing planning code. Production build passed with the existing chunk warning. Syntax checks and git diff --check passed. A minimal-PATH read-only launch verified Codex version and sign-in; live bridge capability confirmed installed=true after restart. No real prompt or actual Nell inference was sent as a test. Live read-only endpoints also returned usage available (one quota bucket) and models available (eight models). Initial model probe without a project correctly returned 400; retried with the recorded project key.

## Previous pass: remove project-card footer buttons (2026-10-06)

Scoped human instruction: remove Plan & briefing and shelf buttons from the project card. Removed Conversation shelf and Plan & briefing from the roster's `.lot-group` template and removed their dataset assignments in `web/src/ui.js`. Removed CSS used only by those footer controls while retaining shared shelf styling elsewhere. Project title, live counts and resident/visitor rows remain. World-space shelf and other existing library/planning entry points are outside this card and unchanged. README and CONCEPT reflect the reduced card. All prior visual/navigation/provider edits and other uncommitted work preserved.

Checks actually run:
- `node --check web/src/ui.js` and `git diff --check` passed.
- `npm run build` passed, with inherited large-chunk warning (1,015.37 KB JS).
- `node --test test/*.test.mjs`: 124 tests, 120 passed, four catalog API integration tests failed at bridge startup (`Bridge exited: 1`). A separate loopback listen probe returned EPERM; exact child diagnostics remain unavailable. Used the explicit glob because the recorded Node 22 npm-script discovery limitation remains; no package/test-runner change was made.
- In-app browser was unavailable. Used the existing user Chrome Agent World tab: verified one project card, zero footer controls matching `.roster-shelf`/`.work-home-button`, and all three real agent rows present. Selecting Nell opened Watch activity; closed the drawer afterward. No console errors reported. No prompt submission or metadata mutation. User tab remains open.
- Screenshot: `docs/screenshots/project-card-no-footer-buttons.png` (live page, project card at upper left).

Runtime: lsof verified bridge PID 45933 on :4777 and Vite PID 45934 on :5177, with cwd this checkout; Chrome loaded the live page. No backend restart or synthetic data needed. Changed ui.js, style.css, README, CONCEPT, this handoff and screenshot only. No queue/task writes, approvals, acceptance, future pass approval/execution, spend, messages to other chats, publishing, commit or push. No mobile/device or exhaustive accessibility audit. This single pass stops here; no next pass is proposed or executed.

## Previous pass: Claude Code prompt routing (2026-10-06)

Human authorized adding Claude routing after grounding in all new visual/navigation changes. Preserved the existing visual pass, player/camera split and other uncommitted work. Composer now offers Codex / Claude Code, preserves unsent drafts on switch, starts a separate provider chat, and filters chat history, rename metadata and continuation by provider. Claude has an explicit unavailable usage control and configured-model label; no false Codex model, quota or reasoning claims. Send pins provider on the proposal/run; next recommendations inherit it but remain unapproved. Claude resumes only exact game-created sessions in the same project. Ordinary Claude desktop/web chats and external Claude Code sessions are not resumed.

`bridge/providers.mjs` discovers the official local Claude CLI or PATH (override `AGENT_WORLD_CLAUDE_COMMAND`). Installed Anthropic's official npm CLI outside the repo at `~/.agent-world/tools/claude-code`, version 2.1.292. Read-only auth status reported loggedIn=false. The human was asked to complete `~/.agent-world/tools/claude-code/node_modules/.bin/claude auth login`; no real inference or sign-in was performed by this pass. Binary presence in runner capabilities is not auth readiness.

Runner uses print-mode stream JSON, structured output, exact UUID validation on init/result and `dontAsk` permission mode, never bypass flags. Errors, permission denials and identity mismatch cannot be successful results; no automatic retries or provider fallback. Claude thinking/raw messages are not imported. Existing hooks supply actual observed activity. Tool permissions requiring interaction must be configured in Claude Code by the human before an explicit retry.

Checks: explicit `node --test test/*.test.mjs` passed 124/124, including isolated mock Claude success/continuation, denied tools, wrong session identity and provider history separation. Build passed with the existing chunk warning. Live browser verified provider controls, separate history, correct model/usage labels and draft retention, without selecting Send. Screenshot: `docs/screenshots/claude-routing.png`. Browser log contains a Vite HMR WebSocket connection error; HTTP reload delivered current code. Authenticated Claude execution, actual hook-driven Claude activity and real follow-up execution remain unverified until sign-in. `npm test` discovery is incompatible with the current Node 22 environment; explicit file glob runs the suite.

Started `npm run dev` on 5177/4777 after confirming no active/interrupted/approved runs. Recheck listeners before reuse; do not interrupt live work. Next useful check: human sign-in, then a human-authorized Claude prompt and follow-up, verifying the same session ID, reply and observed activity. No commit/push performed for this pass.

## Git checkpoint (2026-10-06)

The human authorized committing and pushing all project changes so far to the configured origin/main. Fresh checkpoint validation on Node 18.16.0: npm test passed all 120 tests, including the four catalog API integrations that were blocked in earlier environments; production build passed with the existing chunk-size warning; git diff --check passed. Reviewed tracked/untracked inventory: source, project docs, relative skill symlinks and QA screenshots; no temporary QA source or generated/runtime directories included. Credential-file/key-pattern scan found no matches. Remote main matched local HEAD before the checkpoint. Prior browser/paid-provider limits in each pass remain scoped as recorded; passing this suite does not establish release readiness.

## Latest pass: Electron desktop app (2026-10-06)

Human asked for an Electron app of the exact current game build.

- **`electron/main.cjs`:**
  - Runs `bridge/server.mjs --serve dist` and `adapters/codex/tail.mjs` with Electron's own Node (`ELECTRON_RUN_AS_NODE`), using the same environment as `scripts/dev.mjs --prod`. The runner is on unless `AGENT_WORLD_RUNNER` says otherwise.
  - Waits for `/` and `/api/state`, then loads the game in a 1440×900 window with a loading screen first.
  - Window security: context isolation, sandbox, no Node in the page. Other origins and app links open through `shell.openExternal`, and a failed load retries.
  - Single instance. Quitting sends SIGTERM to the children; verified no orphaned processes.
  - Opened from Finder, it borrows the login shell's PATH so passes can find `codex` and `claude`.
  - If an Agent World bridge already answers on 4777, the app reuses it rather than starting a second bridge over the same home: it loads that bridge's page if it serves one, otherwise the Vite page on 5177, otherwise it explains and quits.
  - `--demo` uses `userData/demo-home` with fake agents on a free port.
- **`package.json`:** `main`; scripts `app`, `app:demo` and `app:build`; electron-builder config (unpacked, no node_modules, since the client is fully bundled in dist; ad-hoc signed with `identity: "-"`; icon `electron/build/icon.icns`); output in `release/` (gitignored). Electron is pinned to ^39.8.10 and electron-builder to 26.8.0, the newest whose installs still work on this machine's default Node 18.16 (Electron 40+ and builder 26.15 need require(esm), Node ≥20.19).
- **Icon:** `electron/build/icon.svg`, a green gem on a sky and hill tile, rendered to `icon.png` with transparent corners and `icon.icns`.
- **`bridge/server.mjs`:** static MIME types now cover woff2, woff, jpg and json.

Checks actually run:
- `npm run app:demo` from the checkout: the window loaded the game (Live · 4 sessions, 4 Sims, captured over CDP).
  - First load showed the bridge's "not found" because `dist/` was being rewritten by a concurrent build. Hence the wait for `/` plus retry.
- `electron-builder --mac --dir` → `release/mac-arm64/Agent World.app`: 256 MB, ad-hoc signature verified with `codesign --verify --deep`, bundle has no node_modules.
- The packaged app launched with `--demo` from its own Resources/app and went Live with 4 Sims.
- Quitting both left no bridge or fake processes. npm test passed 125/125.

Follow-up launch (real mode):
- The first two tries showed the "already running in API-only mode" dialog. The human's Vite listens only on [::1]:5177, and the 800 ms probes timed out under heavy machine load (load average about 35).
- Fixed: the app now probes both loopback addresses with a 5 s timeout and logs startup errors.
- On the third launch the dev bridge had stopped, so the app started its own bridge and Codex tailer on 4777 with `~/.agent-world` and loaded the game. The window's contents weren't inspectable without accessibility permission; the bridge answered `/api/state`.

Originally not run: the app in real (non-demo) mode, because the human's own dev bridge was on 4777 at the time and I didn't want to touch it. Also no DMG, notarization or Intel build.

## Previous pass: offline bubbles show only "last seen" (2026-10-06)

Human asked that the overhead bubbles shown while observation is offline drop the "Last known: <activity>" text, the conversation line and the detail, and show only when the agent was last seen. In `web/src/sim.js` `updateLabel`, a stale bubble (observation offline and the Sim has a session) now shows the name plus `Last seen <age>`, using `observedLabel` with "Last observed" reworded. The detail and conversation lines are suppressed while stale. Live bubbles are unchanged. Other "Last known" surfaces were left as they were: the roster, the inspect drawer, the Needs strip and the agent-view tests.

Checks: npm test passed 120/120. In the browser on the QA stack, I forced each attached Sim to offline and selected, then rendered its bubble. All four read `<Name> | Last seen just now`, with the stale styling. Taking the real bridge offline wasn't observable in the pane because the Vite proxy kept the stream looking live.

## Previous pass: visual pass E, graphics and animation polish (2026-10-06)

Human asked for a graphics, animations and visuals pass. I reviewed full-resolution renders (captured through the QA home's photo endpoint) at noon, golden hour and night, from overview and close-up, and fixed what looked weakest:

- **Roofs (`lot.js`):**
  - Roofs are now strictly on or off, with hysteresis (open below 48 m, or 76 m for the centered home; close 8 m farther out). Before, they hovered half-lifted and shrunken anywhere between 46 and 58 m.
  - The lift is a damped spring with a small settle bounce.
  - Hovering a roofed home nudges its roof up 0.45 m, hinting that double-click looks inside (`lot.hovered`, set from main's pointer hover).
  - Craftsman roofs are proper hip roofs (two slopes, a ridge and two ends) with a ridge cap instead of a four-sided pyramid. Each home's shingle tint (slate, brown, sage or umber) comes from a hash of its project.
  - Craftsman homes get a chimney too. Cottage and craftsman chimneys have six animated smoke puffs, shown only while the roof is on.
- **Ground (`fx.js`, `scenery.js`, `seasons.js`):**
  - `FX_MOTTLE` adds broad warm and cool patches, and the big terrain now uses mottle (0.22).
  - `FX_LAWN` adds mowed stripes on lot lawns, faded out with `fwidth` so they don't shimmer at distance.
  - Grass tufts are three-blade clumps with per-instance tint instead of single spikes.
  - Autumn grass is olive (lawns #a9c066, tufts #9dab4c, terrain blend 0.3) instead of khaki.
- **Lighting (`environment.js`):**
  - Day fill is lower (hemi about 0.4, environment light 0.36) with a stronger sun (3.45 at noon) and slightly lower exposure, so shadows and roof planes read.
  - Golden hour is less saturated (1.06).
  - Night is a neutral moonlight instead of saturated blue (moon 1.35, desaturated grade), so warm windows and lamp pools pop and roofs keep their form.
- **Animation:**
  - Selecting a Sim plays a squash-and-stretch hop and spins its diamond (`sim.js`; root scale is restored afterwards).
  - At dusk, homes switch their lights on at staggered moments (a per-project threshold) instead of all at once.
- **Interiors:** the wainscot is a bit darker (0.8) and there's a new baseboard (0.55) along the interior walls.

Checks actually run, on the isolated QA stack at an emulated 1280×800:
- **Renders, before and after** (`docs/screenshots/visual-pass-e-*.jpg`):
  - Roof state at the old in-between distance: each lot was exactly 0 or 1.
  - The hover lift raised a roof from 2.74 to 3.19.
  - The selection hop's scale animated and returned to 1.
  - The pane held 60 fps at night in the overview.
  - No console errors.
- **Tests and build:** npm test passed 120/120; build passes; `git diff --check` is clean.

Not verified: spring, summer and winter looks; Medium and Low quality; Retina hardware. Smoke adds 6 small draws per chimney.

## Previous pass: picture avatar and drag-to-pan camera (2026-10-06)

Human asked: the player becomes a picture of an animated avatar, walking in the world is removed, click-and-drag moves around the map, and I choose how to look inside buildings.

- **Camera (`web/src/camera.js`, replaces `avatar.js`):** left-drag grabs the ground under the pointer and pans, with a short coast after a flick. Right/middle-drag turns and tilts, the wheel zooms, and WASD/arrows pan at a speed that scales with zoom (Shift is faster). Q/E turn. A 5px threshold separates pans from clicks, and the click after a pan is suppressed. Grabbing mid-flight keeps the flight's zoom. Text selection and touch scrolling are blocked on the canvas. Panning goes through a `panTarget()` callback: free focus, build focus or map focus. Grabbing while following a Sim switches to free focus without a jump. User pans clamp to the bounds of the homes, square and downtown (refreshed every 2s).
- **Player (`web/src/player.js`):** a "You" badge after the brand chip, showing the shared SVG `portrait()` with CSS bob, breathe and blink (none under reduced motion). Clicking it opens the wardrobe with a large live preview; saves still use `{ kind: 'player' }`. `portrait()` gained accessories (glasses, cap, beanie, headphones, flower) and a collar cue for hoodies and collared tops, which Sim portraits get too. On phones the badge shrinks to the picture only.
- **Seeing inside:** the existing roof lift (46–58 units) and cutaway walls are kept. The home under the screen center (`lot.peek`) lifts its roof from 74–88 units, so whatever you center on opens up. Double-clicking a home glides to it at distance 22; double-clicking a Sim focuses it; double-clicking ground glides there.
- **Rewired avatar-dependent play:**
  - Finds are clicked to collect, with an invisible 0.75 radius hit sphere and a pointer cursor; `Explore.collect` and `hitTargets`.
  - Garden chips show when a bed is within 7 units of the screen center while zoomed in (camera distance under 34).
  - Pets greet the screen center when the camera distance is under 26.
  - Space and the hint use the Sim nearest the screen center when zoomed in.
  - Build's nearest-lot pick uses the camera target.
  - The census "Visit" flies the camera.
  - Snow footprints and the car yielding to the avatar are gone.
  - `blockedAt` was removed from main. The `blockedAt` methods in commons, downtown and landscape are now unused and could be deleted.
- **Help menu, photo hint, README, GAMEPLAY, CONCEPT and the navigation skill reference** are updated for drag-to-pan.

Checks actually run, on the isolated QA stack (:4778/:5178, demo agents, scratch AGENT_WORLD_HOME):
- **Browser:** no console errors on load and no avatar in the scene. Drag pans in normal, inspect, build and map modes. Inspect stays open while panning. Double-clicking a roofed home glides in with the roof off. The badge opens the wardrobe, and a live hair change updated both the badge and the preview (then cancelled). Clicking a find collected it in the QA home (crystal count 1→2). No text is selected after a drag. The help menu is compact. Phone width fits.
- **Tests and build:** npm test passed 120/120, the production build passed (existing chunk warning), and `git diff --check` is clean.

Gaps:
- No pinch-zoom on touch.
- Real-mouse feel (coast amount) should be tuned by the human. Synthetic drags arrive as single jumps.
- Drag starting on a floating label doesn't pan.

## Previous pass: theme, contrast and spacing across modals and menus (2026-10-06)

Human asked that every modal and menu be in theme, with good internal spacing and readable text, plus two prompter icon swaps. Codex's parallel work (prompter, usage, setup guide, review flow) was preserved and only restyled.

- **Tokens:** `--ink-3` darkened to #5f6779; added `--accent-ink`, `--warm-ink` and `--amber-ink`; `--gold` set to #a96a00. The night theme is `body.night` (game time), not `prefers-color-scheme`. Earlier prefers-color-scheme rules were converted, and night tokens were added for the ink, accent, warm, amber and gold colors and for the glass background. Hard-coded #c2562e and #b07400 text now uses those tokens.
- **Prompter (`pass-card.js`):** full glass/ink retheme: sidebar, threads, bubbles, composer, model and usage popovers, focus rings. The rename text is now a pencil icon button (aria-label kept), and the usage “C” is a gauge icon (`usage.js`). Added the `arrowUp` icon for send.
- **Scoped fixes:** panel `.count` no longer collides with the roster count. The Prompt-agent pill excludes the hero card and screen preview. Pill buttons are used in Rewards, Downtown and the album. App chips use color-mix text. Waiting and stage pills have darker day ink and lighter night ink.
- **Album (`photo.js`):** uses the shared `.panel-head` (icon, “Album”, count) and is a compact 400px card when empty.
- **Layout:** observation age moved under the roster status. Inspect, Build and Wardrobe drop to top:104px while the Needs strip shows (desktop only, via `:has`).
- **Bug fix (`models.js`):** `prepGeometry` dropped vertex colors when re-merging already-merged meshes, so parked cars rendered black. It now keeps the `color` attribute when the material uses vertex colors. One car color was also lightened.

Checks actually run: a contrast audit script (WCAG 4.5:1 text, 3:1 large text and symbols; blends translucent backgrounds) over the prompter, Work, Play, Connections, Chats, Rewards, Downtown, dock menus, inspect drawer, roster, top bar, Needs strip, toasts, Build, Wardrobe, Paint, Album, the task editor and the Work-loop journal, in day and night. 0 failing after fixes; night readings taken mid-transition were re-measured after settling. Took browser screenshots of each surface. Verified the drawer clears the Needs strip (needs bottom 102, drawer top 104). npm test: 120/120 passed. Production build passed (existing chunk warning). QA ran on an isolated AGENT_WORLD_HOME with demo/fake agents on :4778/:5178; no real data writes, commit or push.

Gaps: mobile layouts were not re-audited this pass. The rename pencil was verified with DOM-injected sample rows (nothing saved). Next smallest step: a phone-width pass over the same surfaces.

## Previous pass: remove conversation card from Watch activity (2026-10-06)

Scoped instruction: remove the conversation card containing Open in Codex and Shelf from Watch activity. Removed its slot and rendering block from `web/src/ui.js`, plus the now-unused conversationTarget import. Conversation labels remain in the roster. Watch activity retains Prompt this agent, inactive status chat entry, animated screen, role, observed details and recent steps. Shelf access elsewhere and chat continuation are unchanged. README and CONCEPT now reflect the reduced activity view. Existing uncommitted work preserved.

Checks actually run:
- `node --check web/src/ui.js` and `git diff --check` passed.
- `npm run build` passed with the inherited large-chunk warning (1,007.46 KB JS).
- `npm test` failed before suite discovery: installed Node v22.14.0 interpreted `test/` as a module and returned MODULE_NOT_FOUND. Ran the existing suite explicitly with `node --test test/*.test.mjs`: 120 tests, 116 passed, four catalog API integrations failed at bridge startup (`Bridge exited: 1`). Separate loopback listen probe returned EPERM; exact child diagnostics remain unavailable. No test runner/package changes were made for this UI-only request.
- Live browser verified the working Nell and waiting/finished-turn Otto Watch activity views have zero conversation slots and zero Shelf buttons inside #inspect, with status/screen/details/recent steps still visible. The animated screen opened chat; closing chat returned to activity; Prompt this agent also opened chat. No Send, approval or metadata write was submitted. No console errors reported.
- Screenshot: `docs/screenshots/watch-activity-no-conversation-card.png` (real observed working-agent view). First browser initialization timed out; retry succeeded and the QA tab was closed afterward.

Runtime: lsof verified bridge PID 25353 on :4777 and Vite PID 25354 on :5177, both with cwd this checkout. Live page loaded; no restart/backend change required. No new synthetic data or real queue/task/title writes, acceptance, approvals, future pass execution, spend, messages to other chats, publishing, commit or push. No mobile/device or exhaustive accessibility audit. This single pass stops here; no next pass is proposed or executed.

## Previous pass: show actual summary sections prominently during runs (2026-10-06)

Human reported live chat only showed Thinking/command steps while detailed summaries were visible afterward. Read the latest rename implementation and preserved it. Verified the most recent real completed run has three public summary items; metadata-only inspection of the exact rollout showed nonempty public summaries before subsequent tool calls and several minutes before task_complete. Existing runner broadcasts after each accepted summary item; the chat had a separate Thinking/activity accordion alongside a collapsed public-summary disclosure.

Removed the competing tool/activity accordion from the prompter. Actual per-reply Reasoning · live is automatically open for running/queued messages and accumulates public summary sections as runner updates arrive. Renders preserve explicit collapsed state, drafts, caret, scroll and the same sections through completion. Tool and file steps remain in Watch activity. No runner/permission/model changes, private rollout content import, or token-stream claims. The CLI JSONL path delivers summary sections; finer app-server summaryTextDelta streaming remains a separate transport improvement. Source verified: https://learn.chatgpt.com/docs/app-server.

Checks: 17 focused chat/runner tests passed; build passed with inherited chunk warning; syntax and diff checks passed. Isolated browser fixture began with an empty running reply, automatically expanded waiting text, then received two summary sections via separate state updates while status remained running. Verified both visibly accumulated before finish, no command/activity panel in chat, manual collapse survives next update, draft retained, completion retains summaries, and no console errors. Screenshot docs/screenshots/live-summary-sections-fixture.png is simulated QA, not real inference. No Send, title save, real state mutation, approval, paid inference, commit or push. Temporary fixture source and tab removed after QA. Backend unchanged; no restart required.

Next: normal human prompting to verify this presentation with model-provided summaries. Some models emit no summaries or emit them only at section boundaries. If finer partial-text latency remains the requirement, replace exec transport with app-server summaryTextDelta while preserving exact-thread continuation and all existing execution/approval restrictions; never consume raw reasoning textDelta.

## Previous pass: rename chats inside the prompter (2026-10-06)

Scoped instruction: add chat renaming inside the prompter. Recorded Codex chats now have a separate Rename button beside their selection button, including the current observed conversation when it has no game run yet. An inline Chat name editor supports Save name/Enter, Cancel/Escape, a 200-character limit, trimmed nonblank names and an explicit local-storage label. Saves use the existing `/api/conversation-title` route with allowTitle:true; the human's Save action provides title-storage consent. No backend or external Codex title mutation was added. The catalog remains the persistent source of truth shared with the conversation shelf.

`shared/chat.mjs` resolves title metadata only for exact source=codex, project and validated UUID. Saved titles take precedence over first-prompt fallbacks; original messages, run records and continuation IDs remain intact. Main snapshot/catalog SSE updates now feed metadata to the prompter. Background updates preserve rename text, focus/caret and composer drafts. Failed saves retain the entered name and show an inline error; duplicate saves are blocked while saving. Prompt submission lookup is scoped to its own form so the new rename form cannot capture its Send state. Unstarted messages and unsent new chats are not renameable until a real catalog conversation exists.

Checks actually run:
- Eleven focused chat/conversation tests passed, including a new exact-source/project/thread title test, message preservation and missing/unstarted exclusions. Existing catalog tests cover user-title retention through observed replay.
- `npm test`: 120 tests, 116 passed and four catalog API integrations failed at bridge startup with `Bridge exited: 1`. The suite's title persistence/restart check therefore remains unverified this pass. A separate loopback listen probe returned EPERM, consistent with startup restrictions; exact bridge child diagnostics were not exposed.
- `npm run build` passed with inherited large-chunk warning (1,010.45 KB JS). Syntax checks for pass-card/main and shared chat, and `git diff --check`, passed.
- Isolated browser fixture verified Enter causes one exact title write, trimmed names, literal HTML escaping, renaming an unselected chat without switching the message thread, snapshot preservation of both drafts, Escape/cancel with no extra writes, whitespace validation and failed-save name/composer retention. Send was forbidden by the mock post implementation. No console errors reported.
- Live browser on :5177 verified Rename controls for actual recorded chats, opened the current chat's editor, checked maxlength=200 and cancelled with Escape while chat remained open. No real title was saved, no real prompt sent, no console errors reported. Existing bridge/Vite listeners were verified by lsof (PIDs 25353/25354, cwd this checkout). No restart needed; the title route already exists.

Evidence: `docs/screenshots/chat-rename-fixture.png` is visibly labeled isolated fixture. The temporary `.qa-rename-home` used only in-memory records/mocked reads/writes, then was removed. Both QA tabs were closed. No real observer inbox or user metadata was populated for testing. README and CONCEPT describe local-only names and scope.

Changed this pass: shared/chat.mjs, web/src/pass-card.js, main.js, style.css, test/chat.test.mjs, README, CONCEPT, this handoff and the screenshot. All previous uncommitted work preserved. No queue/task changes, real title writes, approvals, acceptance, future pass approval/execution, paid inference, messages to other chats, publish, commit or push. Names are local to Agent World, not synchronized to Codex's native app. No mobile/device or exhaustive accessibility audit. This one pass stops here; no next pass is proposed or executed.

## Previous pass: live public reasoning summaries in game chat (2026-10-06)

Cause: the runner consumed JSONL but retained only thread identity, and the observer intentionally reduced reasoning to a Thinking state. Thus the UI's blanket unavailable copy reflected an implementation limit. The official non-interactive/config docs document reasoning JSONL items and model_reasoning_summary. Installed CLI is 0.160.0.

Added an allowlisted public-summary path for game-authorized runs: request model_reasoning_summary=auto and show_raw_agent_reasoning=false per invocation; consume reasoning item started/updated/completed text only after exact thread identity is recorded. Store by run/item ID, replace partial updates, deduplicate and bound to 32 items / 64,000 characters / 4,000 per item. Exclude arbitrary messages, tool output, raw/encrypted fields and rollout analysis. Broadcast through existing pass SSE. Per-reply Thinking disclosure shows incoming summaries and remains as Reasoning summary after completion or failure. Waiting copy accurately describes summaries not yet emitted. Existing target-only observer and tool activity remain separate. Existing old runs are not backfilled.

Checks: full suite 119/119 passed; focused runner/chat/activity 19/19 passed; build passed (inherited chunk warning), syntax/diff checks passed. Isolated mock CLI verified split chunks, intermediate broadcasts, item replacement, raw/unrelated exclusions and persistence on completion. Browser fixture verified literal HTML escaping, expanded state and draft preservation through completion, with no console errors. Screenshot docs/screenshots/reasoning-summary-fixture.png is explicitly simulated QA, not a real model response. Fixture submission was disabled; no real prompt, approval, metadata injection, inference, commit or push.

Runtime: checked zero active/interrupted runs and zero approved proposals before restarting the existing dev stack to load the new runner. Next human Send uses this path. Temporary fixture source removed. QA tab cleanup was blocked by the browser URL policy after it became an internal connection-error page; the live game tab was restored successfully. No real model inference was requested to force a summary; model-provided summary availability is still conditional, not guaranteed. Next smallest step is normal authorized human prompting and checking the expandable Thinking section. Do not ingest private analysis from local rollout logs.

## Previous pass: ChatGPT-style model and usage placement (2026-10-06)

Implemented the human's two supplied screenshot references. Removed the above-message model/usage panels. The model pill is inside the composer toolbar, opens a rounded light menu upward, marks the selected next-message preference and labels the actual last observed model separately. The compact Codex account button sits at the lower-left of the workspace (sidebar bottom on desktop, footer on narrow layouts). Its light upward popover uses 5h/weekly remaining-percentage/reset rows rather than dashboard bars. No account identity, paid upgrade actions or effort controls were invented. Connections retains its original full usage disclosure.

Browser verification on the live server: actual quota rows rendered, both menus placed correctly at narrow/default preview and desktop 1100x800 layout; outside pointer dismissal and Escape worked, Escape retained the chat; changing a model updated the pill/checkmark without sending; restored Keep conversation model. Unsent draft survived opening usage and was cleared after QA. Temporary viewport reset. No console errors observed. No Send, real approvals, task metadata writes, inference, commit or push. Screenshots: docs/screenshots/chatgpt-model-placement.png and chatgpt-usage-placement.png.

Checks: 11 focused usage/models/chat tests passed; module syntax and git diff checks passed; production build passed with inherited large-chunk warning. This is placement/design verification, not a new paid model inference test. Next smallest step: human review of the supplied-reference layout and normal authorized use of the model picker. Preserve all prior uncommitted work.

## Previous pass: live usage repair and per-conversation models (2026-10-06)

Usage failed because the running bridge predated the new route: GET /api/usage returned 404. A direct read-only authenticated app-server probe succeeded. Verified no approved/running pass before restarting the dev stack. The live endpoint now returns actual account quota windows and the chat renders remaining percentages/reset times. Values are shared account limits, not thread budgets. No active execution was interrupted.

Added models to chat: each conversation row shows the last model observed in that thread's rollout turn_context; the selected chat has a Last observed model label and Next message model selector. The available choices come from the installed Codex app-server model/list RPC. Metadata lookup is limited to known project conversations, exact validated thread UUIDs and an 8 MiB tail of the matching local rollout. No prompt/tool/reasoning content leaves that lookup; unavailable metadata remains unknown. Model observations reload when opening chat and after run status/completion changes.

Model selections are separate user preferences per project/thread, held in this browser session. Selection applies on the next human Send, not immediately to a running or desktop-owned chat. The selected model is validated against the available catalog, pinned in proposal/run metadata and passed explicitly as --model to Codex exec/resume. Keep conversation model omits an override. Follow-up proposals preserve the selected model. Model controls do not send a prompt or change global Codex settings. Existing ownership restrictions are unchanged.

Checks: 116/116 full tests passed and build passed (existing large-chunk warning). Final focused model/usage/runner rerun: 18/18 passed; final build, syntax and diff checks passed. Tests cover latest turn-context identity/privacy, sanitized catalogs, model validation/pinning and exact model argument on resumed CLI execution. Live authenticated usage and model-list reads passed; GET /api/models returned the actual observed gpt-6.1-sol for the selected conversation. Browser verified live quota text/bars/reset times, models beside both real conversations, selector options and per-chat preference retention when switching away/back. Restored tested selector to Keep conversation model. No Send, paid inference, real approvals, acceptance, task edits, commit or push. Screenshot: docs/screenshots/usage-and-models-live.png.

Next: human use of model selection on a new authorized message. Actual paid inference with a changed model was not run by this development pass; exact runner arguments were verified with isolated mock execution. Claude model selection and usage are unsupported. Preserve all prior uncommitted changes and recheck listeners before continuing.

## Previous pass: connected app usage and removed results modal (2026-10-06)

Scoped instruction: add remaining connected-app usage like ChatGPT and remove Results & history. Connections and chat now contain a Connected app usage disclosure. Codex account quota windows show remaining percentages, progress bars, actual window lengths, local reset times and the observation timestamp. Limits are account-wide, not task or thread budgets. Unknown quotas are never treated as zero/full, and passed reset times show Awaiting refresh rather than inventing renewed allowance. Claude Code and saved ChatGPT/Claude links explicitly show Usage unavailable; no verified source is implemented for them. Workspace credit balances and reset-credit consumption are not exposed.

`bridge/usage.mjs` initializes a short-lived Codex app-server and calls only the official read-only `account/rateLimits/read` RPC. `/api/usage` is demand-driven, coalesces concurrent reads and caches for 60 seconds. Errors/timeouts replace old data with unavailable; child processes are terminated. Only normalized quota fields leave the bridge, without account identity, credentials or raw diagnostics. No login, thread/turn creation, token-refresh RPC, credit consumption or messaging RPC is requested. Demo mode disables real account reads. Documentation source: https://learn.chatgpt.com/docs/app-server (Rate limits section).

Removed the Results & history button, rendering branch, openRun entry point and obsolete response-view CSS. Saved pass records and returned reports remain in chronological chat messages. Watch activity navigation, prompting authorization and the queue are unchanged. The persistent usage disclosure survives chat rerenders without losing its expanded state or the user's draft. Polling runs only while usage is open and is stopped on modal close.

Checks actually run:
- Twelve focused quota/chat/activity tests passed. Six new quota tests cover multi-bucket preference, 0/100 percent boundaries, malformed/missing data, expired reset windows, RPC fragmentation and the exact read-only method sequence, error/timeout redaction and concurrent cache reads/expiry.
- `npm test`: 113 tests, 109 passed, four catalog API integration tests failed at bridge startup with `Bridge exited: 1`. A separate loopback listening probe returned EPERM; exact child diagnostics remain unavailable.
- Syntax checks for bridge/server.mjs, bridge/usage.mjs, shared/usage.mjs and the changed client modules; `git diff --check`; production build (inherited large-chunk warning). Final focused rerun passed all 12 tests; final build passed (1,001.72 KB JS).
- Direct real `readCodexUsage()` probe returned `{status:unavailable,capturedAt:null,buckets:[]}`. It did not establish a live balance or cause; no inference was requested.
- Browser on existing :5177 verified Connections usage disclosure, explicit unavailable state, chat usage entry point, retained real recorded replies and removal of results controls. Isolated in-memory fixture verified 76.6% and 0% bars, reset times, expired-window Awaiting refresh/no bars, and draft/disclosure preservation across a chat snapshot update. No console errors reported on live or fixture tabs at inspection. No Send was submitted.
- Evidence: `docs/screenshots/connected-usage-fixture.png`, visibly labeled isolated fixture, not the user's real balance. Fixture files were confined to `.qa-usage-home`, used a mocked fetch and prohibited real submission, then removed; QA tabs closed. No observer/inbox/test metadata writes to real state.

Runtime: existing bridge PID 11316 (:4777) and Vite PID 11317 (:5177), both with this checkout as cwd, were verified by lsof. The live bridge was intentionally not restarted because it owns this running approved pass and restarting it would interrupt/alter the run. Its loaded code predates `/api/usage`, so the live UI currently shows Usage unavailable; the backend addition takes effect when the bridge is restarted after this pass. An authenticated end-to-end usage read remains unverified. The isolated mock is rendering/contract evidence only. No mobile/device audit or deployment verification.

Changed: bridge/server.mjs, new bridge/usage.mjs and shared/usage.mjs, new web/src/usage.js, pass-card/experience/main/styles, test/usage.test.mjs, README, CONCEPT, repository skill wording, screenshot and this handoff. All pre-existing uncommitted work preserved. No real queue/task writes, approvals, acceptance, future pass approval/execution, paid inference, messages to other chats, publishing, commit or push. This one pass stops here; no next pass is proposed or executed.

## Previous pass: activity-first selection and observed thinking (2026-10-06)

Scoped human instruction: Watch activity should be the default agent view; inactive Done/your-turn status and the animated screen should open prompting; chat should show thinking. Agent selection (`select` in `web/src/main.js`) now opens the visible activity drawer without automatically opening the chat modal. A Watch activity heading identifies the view. Inactive drawer status is a native chat button; working status remains informational. The animated screen is a native keyboard-accessible chat button. Finished-turn attention entries and inactive overhead status buttons open chat directly. Prompt this agent remains available. Closing chat returns to the selected activity drawer.

These chat entry points pin the clicked Sim's exact observed Codex UUID, retaining the run's launching project/slot for recorded message lookup. The modal uses the clicked Sim's display name; it no longer substitutes the launching resident's name when the actual observed conversation occupies another desk. Explicit top-bar prompting and historical chat selection remain available. No prompts are sent by navigation.

`shared/agent-view.mjs` provides the inactive-status predicate and exact-project/thread activity projection. Chat has a live Thinking/activity accordion with recent observed state/tool/target steps. It updates on observation detail/history changes, preserves its expanded state and drafts, and excludes prior-turn steps before the current run/boundary. Old observations cannot stand in for a newly started turn. It never reads or displays raw reasoning or summary text. The current Codex translator exposes thinking states but drops reasoning content; actual private thoughts are unavailable. No adapter ingestion, privacy settings or provider access were changed. Disconnects show Last known activity, stop the live indicator, and label pending responses as recorded/unavailable rather than claiming current work. Sending still remains the existing human-authorized one-instruction flow; no new run was initiated by this agent.

Checks actually run:
- Syntax checks passed for main.js, ui.js, sim.js, pass-card.js and the new shared helper; git diff --check passed.
- Six targeted tests passed (three new agent-view tests plus the existing three chat tests). Coverage: inactive/working status routing predicate; exact thread/project/source isolation; prior-turn/run-start exclusion; no private reasoning/summary rendering; disconnected truth and done labels; existing chat pairing and pending deduplication. Targeted checks were rerun after final helper/UI changes.
- npm test: 107 tests, 103 passed, 4 catalog API integration failures with Bridge exited: 1. An isolated loopback listen probe returned EPERM, consistent with prior startup restrictions; the individual bridge test child errors remain unavailable.
- Final npm run build passed, with the inherited large-chunk warning (999.92 KB JS).
- Live browser on :5177 verified working-agent selection into Watch activity, animated-screen navigation to the exact observed conversation, clicked-agent name, expanded current observed steps and no console errors. Screenshots: docs/screenshots/watch-default.png and docs/screenshots/chat-observed-thinking.png.
- Isolated browser fixture used the real UI, PassCard and animated Screen classes with fixture data confined to .qa-activity-home; no main observer/runner was loaded and post was blocked. Done/your-turn keyboard activation and finished-turn attention mouse/keyboard activation opened chat. Closing chat returned to activity. Thinking → Reading updates preserved the draft and expanded details; private fixture summary text was excluded. Disconnect showed last-known activity and unavailable pending-response wording. No fixture console errors were reported. The temporary fixture and QA tab were removed.

Runtime: lsof confirmed existing :4777/:5177 listeners use this checkout; the live app loaded and client changes applied without restarting the bridge. Preserved all earlier uncommitted work. Changed this pass: main.js, ui.js, sim.js, pass-card.js, style.css, shared/agent-view.mjs, test/agent-view.test.mjs, README, CONCEPT, repository skill/navigation wording, this handoff and two screenshots. No queue/task writes, approvals, acceptance, spend, messaging other chats, publishing, commit or push.

Limits: thinking details are observed progress metadata, not a transcript of private thoughts or a ChatGPT reasoning integration. Earlier app messages remain unimported; final responses are not token streamed. Existing desktop-thread ownership limitations remain. No additional paid-provider execution, real device/Retina or exhaustive accessibility/performance audit. Human review remains pending. This one pass ends here; no next pass is proposed or executed.

## Previous pass: conversational prompting and removed pass notices (2026-10-06)

Scoped human authorization: a ChatGPT-like prompting UI with visible back-and-forth messages, and removal of floating Pass failed notices. `web/src/pass-card.js` now opens a dark chat workspace with a conversation sidebar, chronological human/agent message pairs, a pinned auto-growing composer, Enter to send, Shift+Enter for a newline, Copy controls and explicit New chat. Results & history remains a response-only secondary view with Back to chat. Work stays in the chat; Watch activity is explicit and checks for the selected thread's observed activity. Floating pass feedback is no longer created or rendered; failure records remain unchanged and their errors appear inline.

`shared/chat.mjs` derives messages only from recorded run instructions/results. Threads are grouped by exact validated conversationSession/resumeSession within the launching project/resident; failed starts without a thread remain separately read-only. Completed responses preserve all returned report content. Pending approval/run states show the human message while awaiting the result. Selecting an earlier thread pins its exact continuation ID. New-chat approval remains visible while its new thread identity arrives, rather than showing a previous chat. Background updates preserve drafts, caret and scroll position; users can draft while work runs. Drafts are held in memory per chat, not persisted across page reloads. Only a human Send invokes the existing single-instruction, versioned proposal/approval flow; no retry, task acceptance or queue policy changes. README, CONCEPT and the repository skill now describe chat-stays-open behavior.

Checks actually run:
- `node --check web/src/pass-card.js` and `git diff --check` passed.
- Three new `test/chat.test.mjs` tests passed, covering thread/resident isolation, chronological pairs, failed-continuation provenance and queued message deduplication/content retention. Targeted checks were rerun after final changes.
- `npm test`: 104 tests, 100 passed, 4 failed in catalog API integrations with `Bridge exited: 1`. A separate isolated loopback listen probe returned EPERM, consistent with the same startup restriction reported last pass; exact bridge child diagnostics remain unavailable.
- Final `npm run build` passed with the inherited large-chunk warning (~996 KB JS).
- Live browser on :5177 verified actual recorded messages, this pass's actual in-progress state and no floating pass notices. No console errors were reported for the live tab or standalone fixture.
- Isolated UI fixture with a mocked `post` method exercised live-update draft retention, separate new/existing chat drafts, Shift+Enter, single Enter submission to the selected exact UUID, queued messages, completion in place, next-draft retention and inline failed-send error/draft retention. New chat submitted resumeSession:null and kept its own pending message visible. No provider or real API mutations were made by these checks. Literal script markup displayed as text.
- Desktop layout was visually inspected. A 390px iframe fixture verified the narrow layout and horizontal conversation strip. Requested browser viewport overrides did not affect the observed 1280px live viewport; they were reset. The iframe inspection logged one MutationObserver error of undiagnosed origin; it did not prevent the visible chat render. This is not a real device/Retina/accessibility audit.

Evidence: `docs/screenshots/chat-prompting-desktop.png` (real stored conversation and current in-progress run), `docs/screenshots/chat-prompting-narrow.png` (explicitly labeled isolated fixture). Temporary fixture data was confined to `.qa-chat-home`, with no observer inbox writes or live metadata use, then removed. Existing listeners on :4777/:5177 were verified by lsof to use this checkout; live browser loaded the app. No server restart was needed.

Limits: the runner returns a final structured report, so this is not token streaming or a complete ChatGPT feature clone. Earlier app messages are not imported; no attachments, voice or model switching were added. Existing desktop-thread ownership restrictions still apply. No additional provider execution was initiated for QA. Full integration suite remains partially blocked. Human review remains pending.

Changed this pass: `web/src/pass-card.js`, `web/src/style.css`, `shared/chat.mjs`, `test/chat.test.mjs`, README, CONCEPT, repository skill wording, this handoff and the two screenshots. All earlier uncommitted work preserved. No real queue/task changes, approvals, acceptance, spend, messages to other chats, publish, commit or push. This pass stops here; no next pass is proposed or executed.

## Previous pass: response-only Results & history (2026-10-06)

Scoped human instruction: simplify Results & history to the response given back. `web/src/pass-card.js` now renders newest-first expandable responses, opening the latest response or the exact run selected from its notice. The full stored returned report (summary, checks, limitations and optional next text) is displayed as escaped plain text. Removed the dashboard sections, execution metadata, proposal/approval/pause/direction/interruption controls, source links and legacy task fallback from this view. Failed runs display their own error; active runs say the response is pending. The prompt composer is preserved. Styles support wrapping and scrolling; README reflects the new view.

Checks actually run: `node --check web/src/pass-card.js` passed; `git diff --check` passed; `npm test` reported 101 tests, 97 passed and 4 failed in catalog API integration tests with `Bridge exited: 1`. An isolated loopback listen probe returned EPERM, consistent with startup failures; the test child-process diagnostics do not expose the exact underlying error. `npm run build` passed with the existing large-chunk warning (993.94 KB JS). An attempted direct Node rendering smoke check could not import the UI's SVG dependencies (ERR_UNKNOWN_FILE_EXTENSION); it provided no rendering evidence. Live browser on :5177 verified completed/failed response expansion, actual failure text, full completed response content, removed execution controls and no reported console errors. Screenshot: `docs/screenshots/response-history.png`.

Runtime inspection: listeners exist on :4777/:5177; lsof confirms the bridge cwd is this checkout. Browser successfully loaded the live app. Shell HTTP reads and process-command inspection were restricted, so exact launch arguments were not verified. No server restart was needed for this client change. No synthetic events or QA metadata were written to real state. Existing uncommitted work was preserved; no queue/task writes, acceptance, future approval, spend, publishing, commit or push occurred. Browser notice acknowledgement only affects its local seen list.

Limits: desktop-thread ownership remains unresolved from the preceding diagnosis; this pass changes only the results display. No new provider execution, responsive/Retina audit or release verification. Human review remains pending. No next implementation pass is proposed or executed.

## Previous pass: desktop ownership failure diagnosis (2026-10-06)

The human tried two prompts and both failed before a runner thread was returned. A bounded no-tools connection diagnostic using the same resume ID and normal CLI config reproduced code 1: thread-store conflict, already has an active writer. The desktop app owns this thread after it was opened there, even while observed waiting_for_user. Earlier continuation QA used an isolated CLI-owned thread and did not verify coexistence with a loaded desktop chat. Do not claim that CLI resume can control desktop-owned chats.

Runner now consumes bounded private stderr/error events only to classify safe actionable errors; raw content is never persisted or shown. Ownership conflicts name the cause and offer continuing in Codex or explicit New conversation; no retry/fallback. Failed result views no longer borrow previous task summaries/checks/limitations. The composer shows the error and preserves the failed human prompt for editing. The latest real failure was annotated with the separate read-only diagnostic and diagnosis timestamp, without changing its status or claiming execution.

101 tests and build pass (existing bundle warning). Regression test covers private desktop-writer diagnostics and no retries. Live UI shows the actual ownership diagnostic and no stale success summary. No failed task was rerun, no new thread was created, and no real proposal approved by this agent. Existing work preserved. No commit/push.

Remaining blocker: direct Send to a desktop-owned chat requires integration with the owning Codex app rather than an independent CLI writer. This integration is not implemented; do not promise closing a visible chat releases ownership without verification. CLI-owned continuous chats work, but opening one in the desktop app can transfer ownership. Address this before claiming seamless desktop/game continuation.

## Previous pass: resident conversation continuity (2026-10-06)

Send now resumes the resident's latest game-launched Codex thread, falling back to its attached Codex conversation when none exists. New conversation is an explicit composer option, and preserves the typed draft when toggled. The composer shows the exact target UUID and Open in Codex. Approval and run records pin resumeSession; follow-up proposals inherit the same thread. The runner invokes codex exec --sandbox workspace-write resume with the exact UUID, never --last, and stops if the CLI returns another identity. No fresh-chat fallback is attempted after a failed continuation.

Observed busy conversations disable Send and are checked again at approval and before claiming queued work. The shared runner still serializes game-launched execution and blocks unresolved interruptions. These guards cover game execution and observed activity; they are not a cross-process lock against an external client starting an unobserved turn. The same session drives the restored activity screen. Conversation selection and busy checks are shared pure helpers; no synthetic real activity or resident reassignment.

100 tests and build passed (existing chunk warning). Added thread selection/busy coverage, exact resume argument and persistence/follow-up tests. An actual signed-in Codex CLI test in an isolated CODEX_HOME and temporary project sent two prompts: both returned the same thread ID, and the second remembered the first-turn marker without tools/files. Evidence: docs/CONVERSATION_CONTINUITY_QA.json. The local CLI help verifies the supported resume/schema/output options. Live browser shows Otto targeting his prior game-launched thread 01a10f68-1792-7482-92d7-628f96515409. No real project prompt was sent or proposal approved in this development pass.

Next: human use of continued prompting. Claude execution/continuation remains unsupported. Preserve all uncommitted work. No acceptance, commit or push. Temporary test credentials and sessions were removed after evidence capture.

## Previous pass: direct prompting and restored activity (2026-10-06)

User corrected the primary interaction: clicking an agent now opens a blank prompt composer with Send. Send records and approves exactly that typed instruction through existing version-checked routes; separate proposal editing/confirmation is no longer required for a human-typed prompt. Results & history preserves previous cards and proposals. Prompt this agent in the restored drawer returns to the composer.

The old inspect drawer is visible again, including its animated observed screen, tool details and recent steps. After Send, automatic navigation waits for the runner's explicit conversation ID and an observed matching session, then follows the actual Sim holding that conversation. It never presents unrelated source activity as the new run. If that session is not observed, the card remains on queue/run status. Fresh Codex sessions may occupy a different resident while the old chat remains attached; same-chat continuation remains unsupported.

97 tests and build passed. Isolated Demo browser QA used a mock CLI and synthetic events: click → prompt, Send → one exact instruction/approval, automatic old drawer, observed reading screen, Prompt this agent, busy-send disabled, and completed result. This UI check did not run a paid provider. No real prompt or approval was sent in this development pass. Existing actual Codex execution evidence remains in earlier handoffs. Screenshots: docs/screenshots/prompt-activity-qa.png and docs/screenshots/direct-prompt-live.png. Preserve all uncommitted work.

Next: human use of direct prompting. Same-thread continuation and provider selection require a separate slice; no Claude runner yet. Keep execution metadata and observed activity distinct. No commit/push or acceptance occurred.

## Previous pass: completion feedback and run identity (2026-10-06)

The user’s approved validation ran successfully and returned findings (its sandbox reported 91/95 tests passing with four loopback-related integration failures). Its result belonged to Otto, while the observed new conversation occupied Nell. Fixed the navigation ambiguity: a persistent Pass ready to review / failed / interrupted button opens the launching resident’s card; opening it acknowledges only the browser notice, never accepts work. Each result shows its title, status, timestamp and direct run-chat link. Clicking a resident whose observed session matches a recorded runner thread opens the original result card. Observed desk assignment remains truthful.

The runner consumes Codex --json thread.started events and persists only the validated thread ID; raw event contents are discarded. The existing run was associated after independently verifying the exact approved instruction in its rollout, not by title or timing. Claiming is now blocked globally by unresolved interrupted runs; malformed false/0/empty next values are refused. Added isolated regression tests for cross-project interruption and actual child-process identity capture/privacy.

97 tests pass in this development environment. Production build passes with the existing chunk warning. Live browser verification opened the persistent notice into Otto’s result and confirmed the exact Codex thread link; no console errors. Opening a report does not accept the task or approve its follow-up. The result retains its original findings rather than rewriting history. Real run count remains one. No approval, commit or push was performed in this fix pass. Preserve all earlier uncommitted changes.

Next: review the fixed navigation and proposed read-only revalidation. Future work can bring project-local output previews into this card. Native Codex destination, new paid-provider run and full Retina/accessibility testing were not re-exercised in this fix pass.

## Previous pass: one-card approved execution (2026-10-06)

The user authorized changing the observer-only boundary: clicking a resident now opens one card with the last reported result, checks, uncertainty and a proposed next pass. Run next pass requires explicit confirmation of that proposal version. Change direction saves a new proposal; Pause prevents queued execution. Previous Work/inspect entry points are hidden; existing project records remain accessible through History / Previous project workflow.

See `docs/ONE_CARD_WORKFLOW.md`, `docs/ONE_CARD_TEST_EVIDENCE.json` and `docs/screenshots/one-card-qa.png`. 95 tests and production build pass (existing chunk-size warning). An isolated browser test used the actual installed signed-in Codex CLI: approval created marker.txt with exactly 25 expected bytes, returned structured checks, and proposed an unapproved follow-up. Independent filesystem verification confirmed the bytes and one run only. Pause and Change direction were exercised. No real proposal was approved, no work accepted, no rewards spent, no commit or push.

`npm run dev` enables the local runner; `AGENT_WORLD_RUNNER=0 npm run dev` disables it. Demo keeps it off. The runner starts a fresh Codex CLI pass in the approved local project with workspace-write sandboxing; it does not resume the clicked source conversation. Claude execution and cloud-only project execution are unsupported. Local confirmation is a workflow gate, not authenticated authorization against a malicious local process. Completed means the runner returned a valid report, not human acceptance. Interrupted runs require inspection and explicit acknowledgement; never automatically replay them.

Live dev is running at :5177 with bridge :4777 and Codex tailer. Real handoff task `4b2a386b-b8b9-42d4-bf23-b42c9e8fd136` remains Needs review. Slot 1 proposal `614cdcdb-f324-4a90-b264-3e243e95fb66` is proposed, with zero real runs; it requests bounded read-only validation. Screenshot: `docs/screenshots/one-card-live.png`. Temporary QA server and project were cleaned up.

Next: human inspection of the live card and its proposed bounded validation pass. Let the human approve or change that direction. Then prioritize evidence preview/source links within this card and keyboard/accessibility checks. Preserve all uncommitted work and separate observed activity, reported results, human approval and simulated flavor. Do not infer measured productivity improvement from this QA.

## Previous pass: scan-friendly reviews, source jumps and pilot support (2026-10-05)

See `docs/REVIEW_PILOT_PASS.md` for implementation, evidence and the real pilot runbook. Compact recorded summaries/limitations, outputs/checks and independently scrolling evidence keep decisions visible. New metadata survives omitted updates and handoffs. Five pending tasks received Codex-attributed summaries/limits; all remain unaccepted. Source navigation constructs documented existing Codex UUID-chat links and retains Copy ID. Chats/inspect use the same resolver. Native destination is unverified: the link was clicked, but Codex app inspection is blocked in this environment.

The journal adds explicit timers with draft persistence, running-timer save prevention, baseline start-button disabling, board-count capture, opposite-condition drafts, review-decision counts and next-review navigation. No automatic activity measurements or acceptance. 91 tests and build pass (existing chunk warning); isolated return/next/timer/reload/save/pair/undo QA passed. Real task `37b44c96-0e8b-4d17-909b-f0020c13143d` is Needs review. No real review decision or measured session was entered, no rewards spent, no commit/push.

Next: human review of actual outputs and three comparable with/without session pairs using the runbook. Fix returned issues within authorized scope. Full Retina, keyboard and dark-mode audits remain the next technical slice. Native source destination and authenticated cloud navigation still need verification. Do not raise productivity scores from synthetic QA or recorded task counts. Preserve all uncommitted work.

## Previous pass: guided setup and lower board upkeep (2026-10-05)

See `docs/ONBOARDING_HANDOFF.md`. Getting started follows recorded outcome/task/review decisions, with optional chat linking. Save & draft task saves the plan and opens a prefilled editable draft; Cancel creates no task. Handoff previews and copies recorded project/task context, feedback and evidence without dispatching work or changing stage. Accepted records require human authorization before continuation.

Verified 88 tests, production build (existing bundle warning), isolated browser setup/draft/cancel/save/guide-reopen/clipboard flow with no console errors. Real task `ef6f5257-ebff-430b-bce5-f3686ea1682c` is handed back Needs review. No acceptance, reward spending, commit or push. No measured efficiency improvement is claimed.

Next slice: full-size Retina performance, keyboard-only workflows and dark-mode readability. Preserve all uncommitted work and keep QA metadata isolated. Collect real matched work-loop observations; source account sync, permission coverage and non-text previews remain limitations.

## Previous pass: visible freshness and focus (2026-10-05)

See `docs/FRESHNESS_FOCUS.md`. Snapshot-ready connection gates live UI and reminders; offline attached Sims pause with grey plumbobs/Last known labels while preserving observations. Roster, screen caption, requests, Chats, Work and Connections expose observation history. Connections updates while open. A persistent focus chip names the focused home, opens Work and clears focus; unavailable saved focus does not filter. Header/request/roster spacing adapts to wrapping.

Verified 86 tests, production build (existing bundle warning), isolated offline/reconnect, no replayed toasts, focus persistence/clear and task stage/version preservation; no browser errors. Real focus unchanged. Real task `348440ad-ec74-4bce-9377-518f09c57fcd` is Needs review. No human acceptance/reward spending/commit/push. Reminder suppression is gated in code; audible playback was not measured.

Next slice: progressive onboarding and lower board upkeep, then full Retina, keyboard and dark-mode verification. Source health/account sync/permission coverage remain limitations. Preserve all uncommitted work.

## Previous pass: focused deliverable review (2026-10-05)

See `docs/REVIEW_WORKFLOW.md`. Needs-you/Reviews now open a focused accept-or-return dialog with task context, outputs/checks, source actions and bounded project-local plain-text previews. Explicit human confirmation remains required; returning requires feedback and records it without messaging agents. Task history and legacy evidence survive edits; structured references carry reported result, recorder label and server timestamp. Helper accepts `--references-json` and still refuses acceptance. Only recorded regular text files within the project's real folder can be previewed; hidden files, symlink escapes, binary files and arbitrary paths are refused. Current preview content is not a frozen deliverable version.

Verified 84 tests, production build (~963 KB warning), isolated browser preview/gates/return feedback with no errors. Live backend restarted to load routes. Real task `25ff78db-7ab5-41fd-abd7-e327b9bf52f2` is handed back Needs review with evidence. No real task accepted, no reward spent, no commit/push.

Next smallest implementation slice: visible freshness/focus outside dialogs, then reduced onboarding upkeep and full-size Retina/accessibility verification. Collect real work-loop observations alongside development; do not raise productivity scores from synthetic QA. Existing provider deep-link/account/permission and non-text output support gaps remain.

## Previous pass: calm menus (2026-10-05)

From the human's feedback after the critique: menus were off-theme and text-heavy. This pass is UI and copy only; planning, acceptance, rewards and observation rules are unchanged, except the downtown pacing noted below.

- **One look:** a shared "calm panel" style (`style.css`, end of file) for Work, Task editor, Chats, Play, Connections, Rewards and Downtown. It has the glass surface, an icon panel header with a short status line, pill buttons with one accent primary, compact `row-card`s, and collapsible `info-note`s that hold every caveat. A guard keeps `[hidden]` hidden inside panels; this caught the acceptance checkbox showing on new tasks.
- **Work** (`work-center.js`):
  - Home chips with attention counts instead of a select.
  - Three views: Now, Tasks, Reviews. Attention opens from "N in other homes"; the Work loop journal is a footer link.
  - Now shows the plan card (✎ Edit, ⚑ Reached), then Needs you (one row with one action), then Up next (only when nothing needs you), then Changed (collapsed), then count pills with Mark caught up.
  - The Needs-you Review button goes to Reviews, where evidence is inline.
  - The task editor is reduced to Title, Stage and collapsed details. Acceptance still needs the explicit checkbox.
- **Chats** (`conversations.js`): home chips, a search box, one compact row per chat (Show / Open / ✎), and the add forms collapsed.
- **Play / Connections** (`experience.js`): Play is 8 icon tiles. Connections replaces Sources & guide: 3 status rows with last-seen dots, 3 start steps, and caveats collapsed. The top bar uses icon chips for Chats and Connections.
- **Rewards** (`progress.js`): balance, two earning pills, homes, and collapsible Town square / Finds / Garden / Photos / Recent with counts.
- **Downtown** (`census.js`): business tiles with growth pips (4 dots, one per tier, in the business color; the current tier fills like a pie; replaced the gradient bars); tap a tile for its reason; people as chips; rules and meaning in the note.
- **Scrollbars:** themed globally at the end of `style.css`: thin, rounded, translucent thumb, transparent track kept off rounded corners, darker on hover, dark-mode tokens. Horizontal strips (needs list, top bar, home chips) stay bar-free.
- **Also:** the inspect drawer (one-line role, compact chat row, IDs folded, last 8 steps, portrait overlap fixed on narrow screens) and Help (keys plus a 3-item legend).
- **Pacing (from the critique):** a business is under construction on the first day its kind of work is seen and opens on day 2 (was surveyed → built → open on day 3). Tiers 7/14/30 are unchanged. Tests were updated.
- **Word counts (QA home):**

  | Panel | Before | After |
  | --- | --- | --- |
  | Work Now | 225 | ~52 |
  | Sources → Connections | 193 | 41 |
  | Play | 104 | 45 |
  | Census | 751 | 118 |
  | Rewards | 359 | 52 |
  | Inspect drawer | 230 | 97 |
  | Chats | ~1,200 | ~10 per row |

- **Verified:**
  - 79 tests; build passes.
  - Browser checks on the isolated stack (the sample review task lives in the scratch home only): every panel; the acceptance box hidden for planned tasks and shown for accepted; Reviews evidence inline; no console errors.
- **Not verified:** dark mode on screen, full-size Retina, and keyboard-only navigation of the new chips.
- README, `docs/GAMEPLAY.md` and the skill's `references/navigation.md` were updated for the new names (Work, Chats, Connections) and layout.

## Previous pass: usability and incentives (2026-10-05)

See `docs/USABILITY_PASS.md`. Implemented default compact Work view, labeled Play hub, Sources & guide with observed timestamp/coverage caveats, progressive task details, a Pets tab/shortcut, explicit descriptive city-role copy and a server-stamped daily ceiling for new task rewards. Existing accepted credits remain. Outcomes still drive home levels; town-square task thresholds use credited reviews. Keep these rules consistent in any further UI/API work.

Verified 79 tests and production build (~951 KB client chunk warning). Live browser checks covered Work/Play, source coverage, Pets navigation, minimal new-task form and visible evidence in existing review forms; forms cancelled without writing sample real tasks. Restarted real dev stack so the policy is loaded. No task accepted or reward spent by Codex. Real task `f953f5ec-4cc0-4e5f-b378-6ada405df5b5` is handed back for review.

Next: human review of this pass, then one actual matched work-loop session pair. Do not infer measured productivity or fun from this implementation. Provider account sync/permission coverage, authenticated deep links, local output opening and full Retina performance are still separate gaps. Preserve all existing uncommitted work; nothing pushed in this pass.

## Previous pass: core work loop (2026-10-05)

Implemented actionable return briefings, inline output/check evidence, direct known source-chat links and copyable coding conversation IDs/output paths. Added a browser-local Work loop journal for matched with/without session observations. Missing measurements stay unknown; no real productivity comparison has been recorded. See `docs/WORK_LOOP_REPORT.md` for evidence, interaction counts and the comparison protocol.

Real Agent World task `5ba7bf84-33c7-4943-b738-186c6ab23395` tracks this pass and is handed back in Needs review, with this conversation linked and Codex-attributed notes. The project's outcome/next action are recorded. No human acceptance or milestone was performed. Preserve these real planning records when resuming.

Verified: 77 tests; production build (existing ~945 KB client warning); isolated browser QA of briefing/references and journal persistence/arithmetic. Source URLs were inspected, not authenticated with third-party apps. No claim of human efficiency improvement. The test home is separate from real metadata.

Also fixed unavailable saved focus selecting a phantom home/filtering notifications, and briefing acknowledgement drifting beyond represented facts.

Next smallest slice: review the real task, then collect the first real matched session pair using Command center → Work loop. Reuse the board and record concrete evidence each pass; keep gameplay expansion paused while this work loop is evaluated. Skill instructions explain the workflow. Remaining provider coverage, authenticated deep links, local artifact opening and full Retina checks remain separate limitations.

## Previous pass: visual pass D, performance (2026-10-05)

Measured at an emulated 1440×900 (DPR 1) on High quality, overview camera, three demo homes, 9 Sims, fake agents. Draw calls were counted across every composer pass (`renderer.info.autoReset = false`).

| | Before | After |
| --- | --- | --- |
| Draw calls per frame | 3,843 | 1,368 |
| Triangles per frame | 1.09 M | 0.70 M |
| Meshes | 1,696 | 1,047 |
| FPS, High | ~28–30 | ~44 |
| FPS, Medium | — | ~59 |

Changes:
- **Vertex-color merging** (`models.js` `mergeStatic`/`mergeDirect`): plain single-color standard materials are baked into vertex colors and share one material per (roughness, metalness, shading, rim).
  - Skipped for seasonal foliage and ground colors (`SEASONAL_COLORS`), textures, transparency, emissive, surface flags and `noBake`.
  - Lots went from about 42 static meshes to 8, desks from about 14 to about 5.
- **Merges:** window frames per window (walls 75 → 22 per lot), eyes and cheeks per head, uniforms, pets per joint (`mergeRig`), and parked cars without separate light meshes. Characters are 27–29 meshes, the floor for an articulated rig. The provider badge stays separate (`keep`).
- **Shadows:** the map is 2048 on High (was 4096) and 1536 on Medium, and is redrawn every other frame (`shadowMap.autoUpdate = false`). This was the largest single cost: about +15 fps when toggled off before the change.
- **GTAO:** computed at half resolution with fewer samples. AO now costs about 2 fps (was about 6).
- **Outline pass:** disabled when nothing is outlined.
- **Dynamic resolution:** a `maxPixels` budget per preset (3.7 MP High, 2.4 MP Medium, 1.4 MP Low). On Retina, High renders at an effective DPR of about 1.6 instead of 2.
- **Verified:**
  - 72 tests; build passes.
  - Visual check after baking: room colors, furniture, people, pets and faces (eyes, glints, cheeks) are unchanged.
  - No console errors.
- **Remaining:**
  - Submitting the draws takes about 11 ms of CPU per frame; GTAO's normal pass redraws the whole scene.
  - Next candidates: instancing desks, chairs and decor across lots; level of detail for distant homes (hide interiors and Sims' small parts beyond ~70 m); throttling the CSS2D label renderer when the camera is still. Real Retina hardware measurements are still needed.

## Previous pass: visual pass C, world and characters (2026-10-05)

- **`web/src/landscape.js`:**
  - About 300 grove trees placed in noise clusters north, west and east, instanced (3 draws; seasonal recolor, sway and snow apply).
  - A pond north of row 0 (shared water, stones, reeds, a jetty).
  - A hazy skyline far east whose window texture lights up at night.
  - A bird flock crossing by day every ~45 s.
  - Parked cars on each row's far curb (they block the avatar; lights off).
  - One car driving main street's north lane that stops for the avatar, with headlights and tail lights at night.
  - Hydrants, benches, bins and a bus stop at the start of main street.
- **`scenery.js`:** the terrain stays flat to 100 m, so the pond and groves sit level; hills start beyond.
- **`fx.js`:**
  - Moving cloud shadows on up-facing outdoor surfaces (`uCloud`, set by day under clear skies).
  - `patchCharacterMaterial` adds a sky-tinted rim light to people's and uniform materials (`uRimColor`/`uRimStrength` from the environment each frame).
  - Water ripples calm with distance to hide tiling.
- **`declutter.js`:** `declutterSigns` runs every 4 frames. Home, business, street, shelf and garden signs never cover an agent bubble, and where signs overlap the nearer one wins and the other fades (`.occluded`).
- **Verified:**
  - 72 tests; build passes.
  - Browser checks on the isolated stack at High quality:
    - The pond (after the flat-terrain fix), groves and parked cars.
    - The skyline lit at night.
    - The pile-up view: downtown signs went from six overlapping to two clear ones.
    - The rim light on the avatar at golden hour.
    - The bird flock active.
    - No console errors.
  - About 36 fps at High in the small preview pane.
- **Not verified:** a proper draw-call count (`renderer.info` resets per composer pass) and full-size Retina. That's the performance pass (D) next.

## Previous pass: visual pass B, surfaces and architecture (2026-10-05)

- **Floors:** `web/src/textures.js` generates canvas textures per floor style: oak, walnut and birch planks with grain and staggered joints; slate and terracotta tiles with grout and glaze; carpet weave with a border. Each has baked edge shading at the walls. The floor is now one textured slab instead of up to 280 boxes.
- **Surface shader flags** (`fx.js`, set on shared materials before the first render): `mottle` (lot grass 0.16, sidewalks 0.07), `asphalt` (wear and speckle plus hairline cracks in patches), `siding` (clapboard lines on outside walls; none for modern homes) and `bands` (shingle rows on roofs). Rooms only stay dry below y 2.6, so roofs catch rain and snow.
- **Architecture:** `ARCHES` in `shared/style.mjs` (cottage gable with chimney and shutters, craftsman hip, modern flat with parapet, solar panels and an AC unit, red barn with round vents and shutters), with gutters on the gables. Each home picks a style from its seed; Build → Paint → House style overrides it (`home.arch`, validated).
- **Roofs:** they rise in between 46 and 58 m of camera distance, force the walls up while shown, and lift and shrink away as you zoom in. They're never shown in Build mode or over the home you're inspecting.
- **Details:** a mailbox by each gate.
- **Fixed:** grass tufts from a later row were scattered onto the previous row's street.
- **Verified:**
  - 72 tests; build passes.
  - Browser checks on the isolated stack at High quality:
    - Roofs at overview distance (modern, then cottage, craftsman and barn via a local override); the near roof lifts away to reveal tiled floors.
    - Oak floor grain close up, the mailbox, asphalt cracks, and no tufts on streets.
    - The House style chip saved `barn`.
    - Snow on roofs.
    - No console errors.
- **Not verified:** walnut, birch, slate and carpet floors on screen; Medium/Low quality; full-size Retina performance (textures add about 3 MB of GPU memory per floor style used).

## Previous pass: visual pass A, labels and lighting (2026-10-05)

From a visual review: labels buried busy rooms, daytime was flat and washed out, and night lacked light spill. Passes B (surfaces and architecture), C (world dressing and characters) and D (performance) are proposed next.
- **Labels:**
  - `web/src/declutter.js` places labels each frame by priority (selected, needs you, error, hovered, nearest, then distance). Overlapping labels lift with an eased offset (`--dy`) and a leader line; low-priority ones that would climb past 120 px are tucked away (`crowded`). Needs-you, error and selected labels are never hidden.
  - A new `chip` label mode (state icon plus name) is the default; the full bubble shows for the important cases; distant labels stay icon-only.
- **Lighting:**
  - New keyframes in `environment.js`: less flat ambient, stronger sun, cool sky fill and warm ground bounce.
  - A per-hour color grade (tint, saturation, contrast), applied in the pipeline's grade pass.
  - A low moon disc in the sky and a moon key light angled to model shapes.
- **Night:**
  - Warm additive light pools (`buildLightPool`/`setLightPools` in `models.js`) outside house windows and doors and on shop sidewalks.
  - Downtown upper-floor windows are partly dark; window glow is warmer and lower so the amber reads.
- **Verified:**
  - 72 tests; build passes.
  - Browser checks on the isolated stack at High quality: the same views as the "before" review (noon interior and close-up, golden overview, night interior, night downtown).
  - Close-ups no longer form a wall of bubbles; noon is richer; golden hour is warm with long shadows (tuned down once from too orange).
  - Night shows pools and amber windows (after lowering the glow). No console errors.
- **Not verified:** full-size Retina and Medium/Low quality looks; label placement with many Sims at the top edge, where some chips sit under the top bar.

## Previous pass: city builder, step 5: street life (2026-10-05)

- **Client:**
  - `web/src/streetlife.js`: trips, routes, a walk-cycle walker built from the resident's look and uniform, and a dashed flavor tag.
  - The real Sim is hidden only while `state === 'off_duty'`; a session, selection, a closed workplace or the setting ends the trip.
  - `roleInfo.business` was added in `applyRoles`.
  - `settings.streetLife` ('on' by default) has a "Street life" section in the Walls menu.
- **Verified:**
  - 72 Node tests; `npm run build` passes.
  - Browser checks on the isolated stack:
    - With fake agents stopped, Otto started a trip on his own and walked the sidewalk with his apron and tag.
    - A synthetic session started for Hazel mid-trip ended the walk instantly; she was visible and "reading" at home.
    - Nell's trip went "at the QA lab", then "heading home from the QA lab", then ended with her visible and resting.
    - "Stay home" ends trips.
    - No console errors.
- **Not verified:** walkers in rows other than row 0 visually (the route is computed and only tested in row 0), and a crowd of 4 at full size.

Next ideas: let walkers be clicked to show the made-up explanation; let hired staff work at their business's door; show a small city clock or rush hours. Keep the truth-first rule.

## Previous pass: city builder, step 4: business upgrades by use (2026-10-05)

The human asked for upgrades "based on how much they are used". This is implemented as different days of use (the bridge's existing once-per-day ledger), not volume, and the human was told the reason.
- **Shared:** `shared/city.mjs` adds `TIERS` (3/7/14/30 days), `businessTier`, `businessName` (landmark names), `businessProgress`; `downtown()` includes `tier`; `whyText` names the tier and the next step.
- **Client:**
  - `web/src/downtown.js`:
    - `storefront(id, tier)` adds upper floors with lit windows; flagships get a rooftop billboard and flags.
    - `landmark(id)` builds eight unique buildings. The post office clock keeps local time.
    - Labels show the tier and the days to the next one, and `positionOf(id)` is new.
  - `main.js` `celebrateCity` celebrates live tier increases only (confetti and a toast, no sound).
  - The census shows tier pills, progress bars and the upgrade rule.
- **Verified:**
  - 72 Node tests (new tier test: 1,000 events on one day stay one day); `npm run build` passes.
  - Browser checks on the isolated stack with scratch-only seeded ledgers:
    - All eight landmarks rendered side by side.
    - Mixed tiers rendered: Open, Expanded, Flagship, Landmark, construction and surveyed.
    - Fixed the library pediment, which is now an extruded triangle.
    - Backdated synthetic `npm test` events emitted into the scratch inbox upgraded the QA lab live to Expanded and then to Flagship, with the toast "QA lab became a flagship · your agents ran tests on 14 different days".
    - The census shows the bars.
    - No console errors.
- **Not verified:** night window glow on upper floors (code path only) and full-size performance with several landmarks.

Next: step 5, commuting street life (residents walk between home and their workplace while off duty, clearly labeled as flavor).

## Previous pass: city builder, step 3: roles, uniforms and interns (2026-10-05)

- **Shared:** `shared/city.mjs`:
  - ledger v2: every day is kept and `count = days.length`, so replay is idempotent (this fixes a recount bug in the earlier 60-day cap);
  - `people` keyed `r:<home>#<slot>` and `h:<home>|<type>`;
  - `ROLES`, `roleOf`, `roleWhy`, `staff()` (stable staff names), `HIRE_AFTER_DAYS = 3` and `helperType()`.
  - `sanitizeLook` accepts `uniform: false`.
- **Bridge:** `personFor(e)`:
  - residents come from the world's session slot;
  - a helper's type is the parent's latest delegation target, or else the helper's first target;
  - the maps are bounded.
- **Client:**
  - `buildUniform` (an apron with white trim that darkens near the shirt color, or an intern lanyard) and `Sim.setRole`.
  - Hired helpers are named "Eli · Explore helper".
  - `applyRoles()` runs on city updates and every 2 seconds.
  - New: the role card in the inspect drawer, the wardrobe's "Work clothes" toggle, and the census "People and jobs" section (residents, then hired staff, then interns).

Verified:
- 71 Node tests (role by days, intern to hire, idempotent replay); `npm run build` passes.
- Browser checks on the isolated stack with people seeded only in the scratch `city.json`:
  - All residents have roles and aprons; Nell's role card shows "Tester · QA lab" with its reason, and the wardrobe shows "Work clothes · Tester".
  - Temporary preview figures confirmed the dark-on-green apron, a blue apron on an orange shirt, and the intern lanyard.
  - A live helper shows as an intern. A synthetic Explore helper emitted into the scratch inbox appeared as "Eli · Explore helper" (Researcher, apron).
  - The census lists jobs.
  - No console errors.

Not verified: a natural front-on screenshot of a resident in uniform at their desk; residents mostly face their monitors, so I used the preview figures.

Next: step 4, landmark upgrades for open businesses that need accepted outcomes from the human (e.g. QA lab → research campus). Then step 5, commuting street life labeled as flavor.

## Previous pass: city builder, steps 1–2 (2026-10-05)

The human approved the rule change: observed work shapes what exists, by kind and never by amount (see `docs/GAMEPLAY.md`).
- **Shared:** `shared/city.mjs`:
  - `signalsOf`: categories only. Commands are classified with `commandKind`, file types are read only from editing targets, and delegating comes from the state or `parent_session`.
  - `recordEvent`: once per day per kind; synthetic events are excluded unless allowed.
  - Also `mergeCity` (a union), `businessStage`, `downtown` (order of first appearance) and `whyText`.
- **Bridge:**
  - Folds every event into `city`, persisted to `~/.agent-world/city.json`.
  - The snapshot includes `city`, and a `{type: 'city'}` message is broadcast on change.
  - Synthetic events count only with `AGENT_WORLD_DEMO=1`. The fake agent now tags its events `x_synthetic: true`; older fake sessions are recognized by the `fake-` prefix.
- **Client:**
  - `web/src/downtown.js`: 8 plots along the row 0 street at x 65–117, with surveyed, construction (animated crane) and storefront models. Each storefront has a roof prop and windows that glow at night. Signs are clickable "why" cards, and buildings block the avatar.
  - `web/src/census.js` and a dock button.
  - Scenery streets extend to downtown.
  - The rotate buttons are hidden on screens 600 px wide or less, so the dock fits.
- **Skill:** forbids doing work, or writing events, just to grow the city.

Verified:
- 68 Node tests (new `test/city.test.mjs`); `npm run build` passes.
- Browser checks on the isolated stack, with a backdated `city.json` seeded in the scratch home only:
  - The census, including a demo banner.
  - Visit downtown.
  - Open, construction and surveyed lots.
  - The library's "why" card.
  - Collisions.
  - A synthetic `git push` emitted into the scratch inbox added a Shipping depot lot live.
  - No console errors.
- Read-only preview of the real events (1,420): five surveyed lots (library, coworking, design studio, QA lab, print shop). Nothing was written to the real home; the real `city.json` is created when the restarted bridge starts.

Next: step 3, resident roles and uniforms plus interns. Then step 4 (landmarks gated by accepted outcomes) and step 5 (commuting street life).

## Previous pass: photos, gardens and visual polish (2026-10-05)

Implemented per `docs/GAMEPLAY.md` (section 4).
- **Shared:**
  - `shared/garden.mjs`: crops, growth stages, locks and time formatting.
  - `shared/style.mjs`:
    - adds `garden_bed` and the Harvest decor;
    - adds `gardens`, `harvest` and `gallery` to the style document;
    - adds the `plant`, `harvest` and `gallery` change kinds (time comes from `known.now`) and `removePhoto`;
    - removing a bed clears its planting.
  - `lockReason` handles `'grown'`.
- **Bridge:**
  - `bridge/photos.mjs` stores photos.
  - New routes: `GET /api/photos`, `GET /api/photos/<id>.jpg`, `POST /api/photos` (body `image/jpeg`, local origin) and `POST /api/photo-delete`.
  - `/api/style` now passes `photos` and `now` to the validator, and the snapshot includes `photos`.
- **Client:**
  - `web/src/photo.js`: PhotoMode and Album.
  - `pipeline.setLook` puts the looks and grain into the grade pass.
  - `web/src/garden.js`: crop models and plant/harvest prompts.
  - `Lot.setGallery`: polaroids on the back wall.
  - `web/src/fx.js`:
    - `patchWorldMaterial`, applied through the 2-second pass in `Seasons.recolor`;
    - `waterMaterial` (world-space ripples);
    - `WeatherFx` (splashes, footprints, and room rectangles that keep effects outdoors).
  - The sound module gains a `shutter` cue outside the chime debounce.
  - New: a dock camera button, Build's Harvest tab, the Garden and Photo album sections in the Progress panel, and help text.
  - `B` and `M` are disabled in photo mode.

Verified:
- 63 Node tests (new `test/garden.test.mjs`); `npm run build` passes.
- Browser checks on the isolated stack (scratch `AGENT_WORLD_HOME`, ports 4778/5178, fake agents, narrow ~536 px pane):
  - Snow built up into patchy drifts with asphalt showing (tuned down from an initial whiteout). Footprints were placed outdoors and none inside.
  - Rain melted the snow and darkened the roads, with splash rings.
  - The pond ripples. A fix was needed: the chunk is replaced at `#include <normal_fragment_maps>`, and the normal map is now linear-filtered.
  - Placed two garden beds and planted tomatoes through the prompt (the pumpkin was locked). For QA only, I backdated plantings in the scratch home: a ripe sunflower and growing tomatoes rendered, and harvesting showed confetti and unlocked the sunflower vase.
  - In photo mode, the Warm look plus tilt-shift was captured to the album.
  - Hung the photo in online-store; the polaroid rendered on the back wall. Delete asked for confirmation and took the polaroid down.
  - The Progress panel shows the Garden and Photo album sections.
  - API refusals: cross-origin upload 403, wrong type 415, non-JPEG 400, path traversal 404, early harvest and fake gallery ids refused.
  - No JavaScript or shader errors.

Not verified:
- Wind sway visually (the shader compiles; the motion is subtle).
- Placing a bed through a canvas click (done through the same save call).
- Pumpkins with a real seed packet in the UI (covered by tests).
- The Film, Mono and Cool looks on screen.
- Full-size Retina performance with all effects.

No real `~/.agent-world` data was changed. Restart `npm run dev` to load the photo routes.

Next slice: a performance pass (measure full-size Retina; merge and level-of-detail where it counts), then rigged glTF characters.

## Previous pass: neighborhood, phase 3 (2026-10-05)

Implemented per `docs/GAMEPLAY.md` (phase 3 "As built").
- **Shared:** `shared/collectibles.mjs` holds the daily deterministic spawns. `shared/style.mjs` adds `layout`, `streets`, `found`, `collected`, `PETS` and Found decor, with `applyStyleChange` kinds `layout`, `street` and `collect`. `shared/progression.mjs` adds `COMMONS`, `commonsHint` and `progress().commons/counts`.
- **Bridge:** `/api/style` gives the validator today's spawns.
- **Client:**
  - `web/src/commons.js`: the town square, with signs that fade at a distance.
  - `web/src/mapmode.js`: viewport-fitted, north-up; refits as rows are added and restores the camera yaw on exit.
  - `web/src/pets.js`.
  - `web/src/seasons.js`: recolors foliage, ground and terrain vertex colors; rain, snow and leaf particles; overcast. Terrain tint is now a vertex-color blend.
  - `web/src/explore.js`.
  - Street signs in `scenery.js`.
  - `environment.js`: `overcast`, plus a `fogScale` for map mode.
  - `CameraRig.maxDistance`.
  - A season/weather dock menu. Toasts fade while a dock menu is open.
  - The pet picker in build Paint.
  - Town square and Finds sections in the Progress panel.

Verified:
- 58 Node tests; `npm run build` passes.
- Browser checks on the isolated stack (scratch `AGENT_WORLD_HOME`, ports 4778/5178, fake agents) in a narrow (~536 px) pane:
  - The town square shows the open park (1 outcome) and locked café, plaza and town hall with their requirements.
  - Map mode moved online-store to row 2. Roads and a new empty row appeared, and the layout survived a reload. Renaming Main Street to "Lighthouse Row" updated the in-world sign.
  - The Paint tab set a dog, saved as `pet: "dog"`; the dog wandered and greeted the avatar.
  - Winter plus snow whitened foliage and terrain, with flakes falling and an overcast sky.
  - Picking up a crystal showed confetti and the "crystal lamp is now in your catalog" toast, and saved `found.crystal = 1`. The server refused a repeat pickup and a pickup of a different day's id.
  - The Progress panel shows the town square, finds and "3 finds are sparkling".
  - No console errors after the fixes.

Not verified:
- Rain and spring/summer visuals and the café/plaza/town-hall models in the browser (code paths only).
- Placing Found decor through the UI (the server gating is covered by tests).
- Full-size Retina performance with particles.

No real `~/.agent-world` data was changed. Restart the running `npm run dev` to load the new `/api/style` kinds.

Next slice: polish from real use. Check whether the town-square placement and the map-mode fit feel right at full size. Consider holiday props per season. Keep the sticker book deferred.

## Previous pass: progression, phase 2 (2026-10-05)

Implemented per `docs/GAMEPLAY.md` ("As built" section):
- **Rules:** `shared/progression.mjs` derives bricks from human-accepted tasks with review notes and from reached outcomes. It also derives levels, prices and locks.
- **Bridge:** `Productivity.milestone()` and `POST /api/milestone` (requires `confirmed: true` and the plan version; supports undo). `/api/style` accepts `unlock`, and gates newly placed decor by unlocks and home level using the derived balance and levels.
- **Client:**
  - `Lot.setLevel()` adds exterior upgrades and puts stars on the sign.
  - `web/src/progress.js` provides the bricks chip and Progress panel.
  - `web/src/celebrate.js` draws confetti and fireworks for live human decisions.
  - The build catalog shows prices, locks and an unlock prompt.
  - The Command center has *Mark outcome reached* (with confirmation that survives re-renders) and undo.
  - The narrow top bar scrolls.
- **Skill:** `skills/agent-world/SKILL.md` now forbids agents from marking outcomes or spending, decorating or dressing on the human's behalf.

Verified:
- 54 Node tests (new `test/progression.test.mjs`); `npm run build` passes.
- Browser on an isolated stack (scratch `AGENT_WORLD_HOME`, ports 4778/5178, fake agents, sample plan and task seeded in that home only), driven through the UI:
  - Accepting a task with notes showed confetti, a "+10 bricks" toast and a 10-brick chip.
  - Marking the outcome reached showed fireworks and "grew into a House", raising the chip to 35, the sign to ★★ House, and adding the porch and awning.
  - Unlocking the monstera brought the balance to 25 and let it be placed.
  - The aquarium prompt correctly showed insufficient bricks, and the server refused the over-budget unlock.
  - Decor placed before prices existed was preserved.
  - No console errors.

Not verified: Manor/Estate visuals in the browser (code paths only), level-up with user decor overlapping new yard structures (overlap is allowed visually), and full-size Retina.

No real `~/.agent-world` data was changed. The running `npm run dev` (pid 13540/13541) predates `/api/style` and `/api/milestone`; restart it to use this.

Next slice, Phase 3 (neighborhood):
- Map mode to arrange lots.
- Public spaces unlocked by neighborhood milestones (e.g. total reached outcomes).
- Pets and seasons.
- Exploration collectibles.

Keep rewards tied to human decisions and play.

## Previous pass: customization, phase 1 (2026-10-05)

Implemented per `docs/GAMEPLAY.md` (cosmetic only; rewards never come from agent activity):

- **Build mode** (`web/src/build.js`, `B` / dock hammer): 25-item catalog (`shared/style.mjs` DECOR, models in `web/src/decor.js`) with rendered thumbnails. Place, move, rotate (`R`) and remove on a 0.25 m grid. `Lot.canPlace()` enforces indoor/yard placement, no overlap, and keeps every key spot reachable from the street (`NavGrid.reachableFrom`). Paint tab: exterior, wallpaper and floor (`Lot.buildWalls` / `buildFloor` rebuild live).
- **Wardrobe** (`web/src/wardrobe.js`): residents (inspect drawer shirt button) and the player (dock shirt). Live preview via `Sim.setLook` / `Avatar.setLook`; accessories in `buildPerson`.
- **Persistence:** `POST /api/style` (behind the existing JSON and local-origin checks) validates with `applyStyleChange` and writes `~/.agent-world/style.json`, then broadcasts `{type:'style'}`. The snapshot includes `style`.
- `vite.config.js` and the bridge origin check accept `AGENT_WORLD_PORT` / `AGENT_WORLD_WEB_PORT` for isolated QA stacks. Defaults are unchanged.

Verified: 49 Node tests (new `test/style.test.mjs`, a nav reachability test); `npm run build` passes (existing chunk-size warning, now about 785 KB). In-browser on an isolated stack (`AGENT_WORLD_HOME` in a scratch directory, ports 4778/5178, fake agents):
- placed decor with real clicks and confirmed it in `style.json`
- validation rejected blocking spots
- paint (exterior, floor) applied and persisted
- player and resident outfits previewed live and saved
- narrow-screen bottom sheets lift the scene
- no console errors

**Not** verified: full-size Retina layout, build mode with 8-desk homes, or performance with many decorated homes. No real `~/.agent-world` data was changed.

**Note:** an already-running `npm run dev` bridge predates `/api/style`. Restart it to save customizations (the client shows "restart `npm run dev`" on a 404).

Next slice, Phase 2 progression (see GAMEPLAY.md):
1. Derive bricks from accepted tasks that have review notes (computed from `productivity.json`, not stored).
2. Add an "outcome reached" action that raises a home's level.
3. Gate premium catalog items behind bricks and levels.
4. Play an accept-celebration triggered by the human's action.

Acceptance criteria: agents can't earn anything (the helper already refuses acceptance); un-accepting removes the bricks; and nothing in the UI implies productivity is scored by activity.

## Outcome and current state

Make observed agent work understandable and help the human return to projects, resolve attention and review deliverables. The game stays observer-only; actual work happens in the provider's own tools.

Implemented: persistent residents, observed coding sessions, saved conversation shelves and explicit app-project links; project outcomes/next actions, task boards, attention/review queues, focus and explicit briefing checkpoints. Ordinary ChatGPT/Claude conversations are manually registered links, not automatically observed account activity. Task acceptance is a human decision, never inferred from agent activity.

Added this pass: the shared Agent World skill, repository discovery links for Codex/Claude Code, working instructions and a local metadata helper (`npm run world -- help`). The helper refuses task acceptance and accepted-task edits, uses optimistic versions and confines requests to loopback HTTP without redirects. It depends on this checkout's shared modules; preserve its symlink to the canonical skill rather than copying only its directory.

The initial project commit is on GitHub. Conversation/productivity features and this skill currently include uncommitted work. Preserve and inspect it; do not reset it or assume it has been published.

## Verification and limits

Prior feature pass: 42 Node tests passed; Vite production build passed with a large-chunk warning. Browser checks exercised isolated plan/task creation, links, review/blocker states, acceptance confirmation, checkpoints and focus. These are development checks, not a formal release audit.

Skill pass: 43 Node tests passed, including isolated helper integration checks for field/link preservation, acceptance refusal, loopback restriction and checkpoints. `npm run build` passed with the existing 748 KB client chunk warning. The skill-creator validator passed using a temporary Python environment with PyYAML; helper syntax and help passed. Repository and personal discovery links resolve to the canonical skill; a read-only helper call through the personal Codex link succeeded against the live bridge. No real planning metadata was changed by these checks.

Real account ingestion, permission visibility, full-size Retina performance and fresh-session skill discovery are separate checks; do not infer them from unit tests or installed files. Local skills do not install themselves into ordinary ChatGPT/Claude cloud conversations.

## Next smallest useful slice

Run a user-facing acceptance pass over one real project from return briefing to reviewing one deliverable. Verify the running processes belong to this checkout; use the shared skill. Start with read-only inspection. Use isolated metadata for destructive or sample QA; edit real tasks only in the user's authorized scope.

Acceptance criteria:

1. The human can identify which project needs attention and where to act in its provider app.
2. Saved chats clearly show that live activity is unavailable; observed sessions retain accurate app/state/targets.
3. An outcome, next action and linked task survive a bridge restart. Stale concurrent edits produce a conflict rather than overwriting work.
4. Needs review includes concrete output/check evidence; only the human confirms acceptance.
5. Returning to the project gives a useful briefing; opening it does not silently mark it read or resolve blockers.
6. Disconnect/reconnect behavior is understandable and never presents stale data as newly observed work.

Record exact failing steps and screenshots before fixing issues. Bring the slice to a reviewable state, update this handoff and ask for human review.

## Prioritized remaining work

- **Connection clarity:** audit stale/disconnected states across scene, roster and command center; make the last observation and connection status clear. Consider a persistent focus indicator so a quiet project is understandable outside the modal.
- **Evidence clarity:** task evidence is free text, not a verified artifact/test record. Explore structured references with author, timestamp and provenance while keeping human acceptance separate. The API's acceptance checkbox is a workflow gate, not authentication of who reviewed.
- **Conversation coverage:** define and verify a supported read-only integration for ordinary ChatGPT/Claude app projects and chats before promising automatic sync. Establish consent, title privacy and unavailable-state behavior; don't scrape private account stores speculatively.
- **Codex approvals:** permission prompts aren't present in the currently tailed logs. Investigate supported observation sources; retain an honest unknown state until evidence exists.
- **Performance:** benchmark full-size Retina and multiple populated homes. The inherited estimate is roughly 1,000+ draw calls; small-preview smoothness does not establish full-size performance. Optimize from measured bottlenecks. Vite also warns about the client chunk size.
- **Visual polish:** rigged glTF characters are a later improvement. Resolve utility, truth and performance gaps before treating character polish as completion.

## Pass-end checklist

Record changed files and behavior; exact test/build/browser results; remaining gaps; any real metadata changes; Git/commit/push status; and one concrete next action with acceptance criteria. Keep implemented, verified, ready for review and human accepted distinct. Update this file after each meaningful development pass.
