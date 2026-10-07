# Navigate Agent World

Default development UI: `http://localhost:5177/`. Bridge: `http://127.0.0.1:4777/`. With `npm start`, the production-built UI is served by the bridge on :4777. Recheck runtime identity and mode before use.

## What the scene means

| Scene element | Meaning |
| --- | --- |
| House | A local folder or registered app project; explicit links may combine sources into one home |
| Resident | A persistent home + slot character who picks up conversations over time |
| Occupied desk / conversation card | A session attached to a resident, with that conversation's identity |
| Visitor with laptop | A helper/sub-agent, not another permanent resident |
| Conversation shelf | Earlier observed conversations and saved chat links; existence alone is not current activity |
| Green / yellow / red / grey plumbob | Working / needs human attention / observed error / off duty |
| Off-duty resident | No live session attached; not evidence that an entire project is complete |

Typing, code bars and ambient poses are illustrative. Observed labels, file/command names and wait timestamps are the factual layer. No agent contents are inferred from procedural animation.

## Controls

- Left-drag: pan the map (there is no walking avatar; the player is a picture in the top bar). `W A S D` or arrow keys also pan; `Shift` pans faster.
- Double-click a home: glide in. The home in the middle of the screen lifts its roof as you zoom in; cutaway walls face the camera.
- `Q / E`, dock arrows, or right-drag: rotate; vertical right-drag tilts.
- Scroll: zoom.
- Click a resident, or `Space` for the one in the middle of the view: open Watch activity. Its inactive status and animated screen open chat for the exact observed Codex conversation. Finished-turn attention opens chat directly; this sends nothing.
- “Needs you” entries and edge arrows: navigate to an attached resident that needs attention.
- House sign or **Plan & briefing**: open that home’s agent card.
- **Conversation shelf** or the top-bar chat icon (**Chats**): search conversations and find their current resident. **Open in…** opens a known original chat link, not a prompt composer under the game's control. Coding conversation links may be unavailable.
- `Esc`: close menus/drawers; native dialogs can be dismissed through their close control or Escape.
- Dock: graphics, cutaway/up/down walls, local-clock ambience or time preview, sounds, help.

Use current accessible controls and page state when automating the UI. Typing in forms must not pan the camera. Test scene appearance as well as DOM controls for visual changes. The optional debug handle `window.agentWorld` is diagnostic, not a way to forge truth or bypass task acceptance.

## Work (formerly the command center)

Home chips select the project. Views: **Now**, **Tasks**, **Reviews**; the **Work loop journal** is a footer link; the neighborhood-wide attention list opens from “N in other homes”.

- **Now (briefing):** outcome and next step, then what needs the human, then “Up next” (only when nothing needs them), and “Changed since last check” collapsed; accepted/review/blocker counts in the footer. **Mark caught up** acknowledges through the displayed cutoff and never dismisses unresolved attention. First briefings show all available records. This is not an AI summary of uncollected chat content.
- **Work loop:** an optional human-entered with/without measurement journal. Never enter synthetic QA timings in a real project or invent the human's notice/resumption times. Zero and unknown are different. The journal does not grant rewards or establish causation.
- **Tasks:** Planned → In progress → Needs review → Accepted. The resident's activity does not move these stages. Task links stay within the chosen home. Record outputs and review references as notes with provenance.
- **Attention:** whole-neighborhood observed questions, approvals, errors and responses ready, plus manually recorded blockers/reviews. A blocked review task appears once, prioritizing its blocker. Each item gives the original app or task to act in.
- **Reviews:** tasks explicitly marked Needs review. Inspect outputs and references, return to work if needed, and let the human perform acceptance.
- **Focus (★):** quiet routine finished-turn chimes/toasts/reminders elsewhere. Urgent external questions, approvals, interruptions and errors remain visible. **Show all attention** reveals filtered routine items; **Clear focus** removes the viewer preference.

## Add projects and conversations

The library's add section registers an app project from its link, optionally linking it to an existing home. Names alone do not merge homes. Saved ChatGPT/Claude chats require direct conversation links and remain unavailable for live status until a real observer supplies events. Title storage has a separate consent checkbox. No local filesystem skill installation automatically grants cloud account access or ordinary chat observation.

Work is the default compact view. Play opens world activities as icon tiles, including Pets; returning to Work leaves active customization modes. Connections (plug icon) shows observed sources and a short workflow; caveats sit in each panel's collapsed “How it works” note. New tasks show title/stage first; expand optional details for notes, blockers and conversation links. Existing review evidence stays visible.

The focus chip outside panels opens Work and offers Clear focus. Saved unavailable homes do not filter. Offline attached residents/screens pause with Last known labels; observations and planning remain saved. Last observed timestamps describe received history, not adapter health or proof an agent stopped. Do not clear human focus as part of routine inspection.


Getting started in Work → Now follows recorded outcomes, tasks and review decisions; linking a chat is optional. Save & draft task opens an editable draft after saving the plan, and Cancel creates no task. A task's Handoff button previews recorded context and evidence for copying into the source app. Copy sends nothing and changes no task stage. Re-read current records before continuing, preserve newer changes, and leave completed work in Needs review for the human. Accepted tasks require explicit human authorization before further work.


Reviews show a recorded summary, outputs, reported checks and limitations; full notes stay available and decisions remain visible while evidence scrolls. Task details/helper support review summary and limitations. Valid Codex IDs offer Open in Codex with an ID fallback. The journal preserves project drafts and user-started timers, offers the next review and identifies unmatched condition records. Stop and inspect timer values before saving; baseline sessions use an external timer with Agent World closed. See `docs/REVIEW_PILOT_PASS.md` for the real pilot runbook. Never start human measurement timers or enter their notice/resumption times on their behalf.

## Current primary workflow

Agent selection opens Watch activity. The inactive status, animated screen and Prompt this agent open its chat; closing chat returns to activity. The chat retains local recorded prompt/response pairs and exact conversation identity. Its thinking/activity details show observed tool/file steps, not private reasoning. Earlier app messages are not imported. Only the human selecting Send approves that one typed instruction. Do not approve, retry, resolve interrupted work or accept tasks on the human's behalf. See the README and latest handoff for verified coverage.


The composer provider control chooses Codex or Claude Code for a new chat and retains the draft. Each provider has its own recorded chats. Follow-ups resume the exact selected session; Claude resumes only sessions created by Agent World, not external Claude app/CLI sessions. Claude requires a signed-in CLI and configured tool permissions, uses its configured model, and has no verified quota or reasoning-summary source. Installation detection does not establish sign-in. Do not send a test prompt without human authorization for the actual work.
