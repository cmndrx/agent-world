# Usability and incentives pass — 2026-10-05

Implemented the priorities from the critique without expanding the game systems:

- Work is the default with a smaller dock. Play has labeled shortcuts into existing activities; returning to Work leaves active Build/Map/Photo modes. No planning or observed activity is modified by switching views.
- Sources & guide gives a four-step project workflow and shows bridge connectivity at opening, last received Codex/Claude Code event timestamps, saved-only app coverage, and the missing Codex permission signals. These are received observations, not an adapter health diagnosis or account synchronization.
- New-task title and stage appear first. Notes, blockers and conversation links are optional details; existing review evidence is visible. Nothing bypasses the human acceptance checkbox, optimistic versions or same-home link validation.
- Pets have a separate Build tab and a direct Play shortcut. No pet or cosmetic changes were made to real homes during QA.
- New human acceptances receive a server-stamped `daily-v1` policy and server-local reward day. At most one eligible task earns 10 bricks per project per day. Town-square task thresholds use the same credited reviews. Existing accepted rewards retain legacy credits, including when their recorded notes are edited. Reopening/reaccepting an old task uses the new policy. Unaccepting recalculates remaining credits; purchased cosmetics remain owned. Outcomes still drive home levels and earn 25 bricks. This reduces the incentive to split tasks but does not certify meaningful work or prevent dishonest outcome records.
- The census explains that tool-based roles and businesses do not establish expertise, test success or deployment. Existing passive city pacing stays intact; free customization is available immediately and quiet days never decay progress.

## Evidence

79 Node tests pass, including daily ceiling, project/day independence, legacy preservation, no-note eligibility, reversal and server rejection of client policy override. Production build passes with the existing approximately 951 KB minified-client chunk warning.

Browser checks on localhost:5177: compact Work dock, Sources coverage and workflow, labeled Play hub, Pets shortcut/tab, minimal new-task form (cancelled without saving), and existing review form with visible evidence (cancelled without saving). Live dev stack restarted to load the backend policy. No synthetic activity, human acceptance, reward spending, or automatic account navigation performed in the real world.

This pass improves discoverability and reduces form clutter. It does not establish a measured increase in fun, productivity or efficiency. Existing authenticated provider links, automatic local artifact opening, missing permissions and full Retina performance remain unresolved. The local Work loop journal remains the place to record actual matched sessions.
