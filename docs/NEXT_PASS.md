# Agent World next-pass handoff

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
