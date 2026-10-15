# Agent card and care layout — Tyler design handoff

## Human revision — compact header and Care modal (October 11, 2026)

This revision supersedes the header, separate happiness placement and inline care
placement specified below. Implement this revision against the current working
files, preserving the earlier care rules and above-head behavior. Recipient: @Olive.
Reference: human attachment `Screenshot 2026-10-11 134300.png`, inspected directly.
The sketch's red lines are layout guides, not UI borders; its purple outlines are
wireframe guides, not a request for outlined name/title inputs.

Header composition follows the sketch:

```text
┌─────────────────────────────────────────────────────┐
│ [portrait]  Tyler                    [outfit] [close]│
│ [        ]  Graphic Design Assistant                 │
├─────────────────────────────────────────────────────┤
│ [Talk to Tyler]    Agent World Build                 │
│                   No session open                   │
└─────────────────────────────────────────────────────┘

┌ Light purple resident stats surface ────────────────┐
│ [Lv 1] Level 1                         50 / 100 XP   │
│        [XP progress───────────────────────────]     │
│        50 XP to level 2                             │
│ Happiness · simulated                       63/100  │
│ [happiness meter──────────────────────────────]     │
│ Interests: Snacks • Reading                [Care]   │
└─────────────────────────────────────────────────────┘
```

The unlabeled purple pill is interpreted as the existing Talk to resident button;
the two gray sketch lines are interpreted as project and session metadata. Keep
XP and happiness together in the existing light purple stats surface, beneath
this header, rather than squeezing progress bars into the metadata lines.
Example numbers are illustrative only, not current observed state.

Use a two-row identity grid: portrait spans name/title rows at left (about 64 px);
name and controls share the top row; full profession occupies the second row
under the name. Controls remain inside the header at its upper right, outfit
then close, with independent accessible labels and 44 px targets. Title may wrap;
do not truncate the profession or displace close offscreen. Preserve name editing.
The lower header strip places Talk to resident at left and muted project/session
metadata at right. At narrow widths or 200% text zoom, allow this strip to stack.
No extra Talk button in the activity body. Keep observed state copy intact.

Extend the light purple XP card surface to enclose the entire resident summary:
level/XP, happiness number and semantic meter, bullet-separated interests and Care
button. Avoid nested boxes. Use 12–14 px interior spacing, 16 px section spacing,
and a small divider or gap between XP and happiness. Care is a labeled secondary
button with a 44 px target at the summary's bottom right; let it wrap onto its own
row when needed. Include this composition in both Watch activity and resident chat
where their current identity/stats presentations apply; retain chat's composer.

Care opens a modal titled “Care for Tyler” (using the selected resident's name).
Opening it only presents options; it must not send a care action, prompt or queue
work. Move the existing Suggested care rows into this modal, with current gains,
reasons, cooldowns, disabled states, inline errors, pending reading and Cancel reading.
Keep Care details, Edit interests and Happiness history disclosures inside it.
Remove the duplicate inline Suggested care section from the drawer. Show simulated
happiness and current interests briefly at the modal top for context; its values
stay synchronized with the card. With unavailable care data or connection, the
modal still opens and explains why actions are unavailable without inventing values.

Use the project's existing modal conventions: labeled dialog, focus trapped inside,
background inert, Escape and visible Close, initial focus on heading/Close rather
than a reward button, and focus returned to Care when closed. Clicking backdrop may
close according to existing conventions, never execute an action. Closing care is
not Cancel reading: pending activity remains visible in the card as “Reading ·
simulated · Ns remaining”, with a route back to Care for cancellation. Real work
still interrupts reading under existing rules. Close/reopen retains current state;
updates must not reset active form edits or keyboard focus. Long modal content
scrolls inside the available viewport; buttons remain reachable on short windows.

Olive should verify header layout at approximately 367 px viewport width, desktop,
short height and 200% text zoom, long names/professions, both card/chat entry points,
Care open/close/focus return, pending activity across close/reopen, missing/disconnected
states and all existing care rules using isolated fixture state. Run relevant
checks and required app:build, package parity and signature verification. Preserve
all unrelated uncommitted changes; no real care/prompt submission, queue edits,
publishing, pushing, spending or restarting during active work. Record actual
verification limits and any safe-reopen requirement in docs/NEXT_PASS.md.

Design-only evidence: attachment inspected with view_image; current ui/care/styles,
instructions, handoff and Git status inspected. No application code changed here.

October 11, 2026. Design deliverable for Olive (software_developer, resident 4).
Scope: the human's agent-card layout request and a compact above-head treatment.
This document specifies the design; application implementation belongs to Olive.

## Layout

Keep the current pale drawer, rounded surfaces, portrait and purple primary action.
Use one consistent identity block in Watch activity and resident chat. Put the
assigned profession immediately beneath the name. Project and observed session
metadata follow in smaller muted text. Preserve the distinction between an assigned
profession and a specialty inferred from observed tools; do not substitute an
activity-derived title for an assigned profession. If no profession is configured,
omit its line rather than invent one. Keep the full profession readable, wrapping
to two lines when necessary. Move the current standalone role card into this header;
its contextual explanation can remain available as a tooltip or disclosure.

Drawer order:

1. Identity: portrait, name, profession, project/session metadata, outfit and close.
2. Resident stats: existing level and XP, then happiness and interests.
3. Talk to resident action, then Watch activity, observed status and screen.
4. Suggested care, then activity details and recent steps.

Keep identity visible while the body scrolls, allowing the header to grow for long
names/titles. At narrow heights it must not consume most of the viewport. Stats and
care scroll with the body. Do not duplicate happiness lower in the care section.

Example at the supplied drawer width (values are screenshot examples, not live state):

```text
[portrait] Tyler                         [outfit] [close]
           Graphic Design Assistant
           Agent World Build
           No session open

┌ Resident stats ────────────────────────────────────┐
│ [Lv 1] Level 1                         50 / 100 XP  │
│        [purple XP progress─────────────────────]   │
│        50 XP to level 2                            │
│                                                    │
│ Happiness · simulated                       63/100 │
│ [soft lavender happiness meter─────────────────]   │
│ Interests: Snacks • Reading                        │
└────────────────────────────────────────────────────┘

[Talk to Tyler]
Watch activity
[Off duty — existing truthful status and screen]

Suggested care                         [Care details ▾]
┌ Give snack                         +8 happiness ───┐
│ Matches Snacks                          [Give snack]│
└────────────────────────────────────────────────────┘
┌ Read a book                        +5 happiness ───┐
│ Matches Reading · 10 seconds            [Read book]│
└────────────────────────────────────────────────────┘
┌ Praise                             +3 happiness ───┐
│ Encouragement                              [Praise]│
└────────────────────────────────────────────────────┘
[Edit interests ▾]                 [Happiness history ▾]
```

The happiness row sits directly under the level/XP block, with a little separation
so the two metrics remain distinct. Retain a text number and a semantic meter;
color is supplementary. Interests use 12–13 px plain text, separated by bullets,
wrapping naturally without chips. Prefix with “Interests:” so the meaning is clear.
Missing care data shows “Character care unavailable”; never render it as zero.

## Suggested care cards

Interpret the requested care cards as a redesign of the existing Praise, Give snack
and Read a book controls. No new care action, automatic suggestion service or game
rule is needed. Use three compact stacked rows, not the current wrapping button
cluster. Each row has a 14 px bold action title and a right-aligned gain, a 12–13 px
reason/duration line, and an explicit action button. At roughly 320 px content width,
put the button on a second row if text needs room. Minimum button target 44 px;
whole cards do not trigger care. Provide visible keyboard focus and disabled reasons.

Order available matching-interest actions first; order ties Give snack, Read a book,
Praise. Put unavailable actions after available ones, using the same tie order.
Freeze row order during cooldown/pending updates to prevent buttons moving under
the pointer; recalculate when opening the drawer or after saved interest changes.
Show all existing actions, including disabled reading, so the controls remain
discoverable. Gain comes from current rules, never hard-coded by profession.
At the 100 cap, distinguish the nominal bonus from the actual possible gain: e.g.
“Up to +8 happiness”, “Already at 100/100”; preserve existing allowed-action behavior.

States and copy:

| Condition | Visible treatment |
| --- | --- |
| Available matching action | “Matches Snacks” / “Matches Reading” / “Matches Encouragement”; enabled button |
| Available general action | Plain reason, nominal gain; enabled button |
| Cooldown | Disabled button, “Ready in 24s”; keep title/gain stable |
| Reading interest absent | Disabled reading, “Requires Reading interest” |
| Real activity prevents reading | Disabled reading, “Available when agent is idle” |
| Reading pending | “Reading · simulated · 7s remaining”; visible Cancel reading button; other actions disabled with a reason |
| Bridge disconnected | Visible “Care unavailable while disconnected”; disabled actions |
| Request underway/error | Disable repeat submission; inline status/error; preserve interest editor state and focus |

Keep the existing 10-second duration, 30-second per-action cooldown, matching bonuses,
interruptions, revisions, idempotency and history. Announce completion/error politely;
do not announce every countdown tick. “Care details” contains the current free-test,
bonus, cooldown, no-decay and no-autonomous-gains explanation. “Happiness history”
retains the existing actual-delta evidence. Interest editing continues to grant zero.
Do not display a predicted gain as an already earned reward.

## Above residents' heads

Use the existing bubble/label system rather than adding a second floating panel.
For the selected resident (and hovered resident on pointer devices), expand the label:

```text
Tyler
Graphic Design Assistant
Lv 1 · Happiness 63/100 (simulated)
Snacks • Reading
```

At ordinary world zoom, unselected residents keep compact name labels. At far zoom,
the existing declutter behavior may hide detail entirely. Selected detail has a
maximum width around 220 px and wraps the title. Interests are optional here: omit
them first if space is tight. Keep explicit “simulated” on happiness and do not color
the work-status plumbob from happiness. Urgent observed waits/errors retain priority
and existing state cues; suppress extra character lines when they collide with urgent
labels or neighboring residents. Opening the resident drawer remains the label's
action; no floating care buttons. If safe decluttering cannot fit this pass, implement
name/title/level/happiness for the selected resident only and report that limitation.

## Visual measurements and implementation map

- Drawer horizontal inset 16–20 px, section gap 16 px, internal card inset 12–14 px.
- Identity name 20–22 px bold, title 13–14 px medium, metadata 12 px muted.
- Stats/care surfaces: current neutral/lavender palette, subtle 1 px border,
  14–16 px corner radius. Avoid another large purple-outlined Character container.
- Purple remains the chat/action emphasis and XP color; happiness uses softer
  lavender with its own accessible text label. Meet 4.5:1 text contrast.
- Hide purely decorative icons from assistive technology. Maintain rename,
  outfit, close, chat and keyboard interactions. Respect reduced motion.
- `web/src/ui.js`: identity, section ordering, shared card/chat stats and role display.
- `web/src/care.js`: separate summary presentation from care rows, preserving handlers,
  state updates, disclosure state and current server contract.
- `web/src/style.css`: responsive sizing, card rows, readable bullet interests and focus.
- `web/src/sim.js`, `web/src/main.js`, `web/src/declutter.js`: optional selected/hover
  label expansion, priority and measured collision sizing. Inspect before changing.
- `shared/care.mjs`: read rule data; layout work should not change its rules or API.

## Olive's verification criteria

Verify long names/titles at the screenshot's approximately 367 px viewport width,
normal desktop width, short window height and 200% text zoom. Confirm name/title,
XP/happiness/interests order in both activity and resident chat views. Exercise care
available/disabled/cooldown/pending/cancel/error/disconnected/missing-data states in
an isolated `AGENT_WORLD_HOME`, with provider execution disabled. Confirm focus
survives render updates, disclosures remain open, and reading interrupted by real
fixture work grants no reward. No real care, prompts, queue changes or acceptance.
Check selected labels in a crowded view and at far zoom; waits/errors must remain
legible. Run relevant existing care/activity tests and appropriate UI checks.

After application changes, run `npm run app:build`, verify packaged asset parity and
signature, and record actual results. The handoff records a hard-coded macOS target
problem on Windows and an unsigned Windows package; inspect current state before
choosing the same documented Windows packaging fallback. Do not restart a running
window/bridge during approved, queued or running work. Report a safe-reopen need.
Update `docs/NEXT_PASS.md`; do not publish, push, spend or accept work.

## Design-pass evidence and limits

Reviewed both human-supplied screenshots, repository instructions, current handoff,
card/care source and care rules. Git status shows existing uncommitted application
and documentation work; it was preserved. Read-only `/api/state` returned HTTP 200,
runner enabled and no observed sessions at query time; this does not prove no owned
run or queued work. Port 4777 has a listener. No process was restarted. This is a
written design and wireframe, not a rendered implementation or live visual QA.
