# Shared foundation (October 10, 2026)

Town Hall remains the first player construction milestone. After linking a provider
and finishing Town Hall, Mayor Martin guides building a home for an existing local
project or creating a new project. Each newly registered local home starts with one
Personal Assistant owner, including imported projects with saved or observed teams.
Existing identities and history are retained, but are not automatically recruited.

`gameplay.homes[project]` owns timed construction: `startedAt`, `readyAt` and
`expediteSpent`. New import/create starts a five-minute timer, with no extra base
registration cost. Missing records represent previously completed homes. Re-import
preserves a recorded timer; reset clears it with the rest of gameplay setup. Paid
completion uses one gem per remaining minute, rounded up. Snapshots and streamed
households include `construction` and withhold active characters until completion.
Real observed sessions remain stored. New work, approval, scheduling and runner
dispatch are gated on home readiness; construction crews are simulation, not agents.

## Identity contract

`shared/foundation.mjs` owns version 1 of the shared contract. Household metadata
remains in `households.json`; no second mutable agent registry is introduced.

- `home.id`: permanent residential building ID, initially derived from its canonical
  project key. Preserve the ID if a future explicit migration changes that key.
- `character.id`: permanent agent ID, initially derived from the legacy project/slot.
  Preserve it if future authorized moves change household membership or slot.
- `home.ownerAgentId`: references one resident. Migration prefers an existing owner,
  then an Assistant, then the lowest existing slot. Empty metadata-only homes have no owner.
- `home.residentAgentIds`: active membership, initialized to the owner on local home
  import/startup. Saved `characters` remains the identity/history registry. Snapshots,
  streaming household updates and delegation expose active members only. Re-import
  preserves established membership; observation never recruits.
- `character.homeId`: current household ID. `slot` remains a compatibility binding for
  desks, execution, conversations, schedules, style and historical activity.
- `character.professionId`: catalog reference; the owner profession is `personal_assistant`.
  Legacy `assignedRole: assistant` remains valid for delegation. Roles are assigned
  planning metadata, never observed skill or professional qualification.
- `workplaceId`: nullable building reference. `interestIds`: catalog references, initially
  empty. `personality` and `happiness`: null until their respective systems are implemented.
  Null means unconfigured, not unhappy, contented or unable to work.

Migration fills missing fields and is idempotent. Names, seeds, slots, professions,
custom fields, old starter teams, chats and schedules are retained. New homes do not
gain a Junior developer or Researcher automatically. Real external observations can
retain additional identities and sessions without spawning additional household members.
Conversation metadata and raw session evidence remain available. Recruitment must
explicitly add membership before another identity can work as a household resident.

New proposals and claimed game runs pin `agentId` from server-owned household metadata.
Voice records also pin it. Claiming a legacy or scheduled proposal resolves its ID.
Historical records are not rewritten. `agentForRecord` uses an explicit ID first and
legacy project/slot only when no ID exists; unknown explicit IDs never fall back to
another occupant. `experience(runs, homes)` exposes stable-ID XP in `agents` alongside
the old `residents` map. Run IDs still deduplicate awards; player XP is unchanged.

Agent transfers, slot reuse by different hired people and project-folder moves are
not implemented. Before adding them, persist historical bindings, update chat/schedule
authorization and home XP pooling together. Do not assume adding an ID alone authorizes
moving a chat or transferring another resident's history.

## Building contract

`BUILDING_TYPES`: `residential`, `recreational`, `infrastructure`, `work`.
`ZONES`: `residential`, `commercial`, `industrial`, `mixed`.
Category and zone are independent. `zone: null` means no zoning rule is assigned yet.

`GET /api/state` includes a derived `foundation` snapshot with `version`, `agents`,
and `buildings`. Current building records cover known homes and player-started Town
Hall only. Homes have `{ id, type, kind, project, ownerAgentId, zone }`. Town Hall uses
ID `townhall`, type `infrastructure`, kind `townhall`. Historical activity-driven
downtown buildings remain separate; the projection does not manufacture workplaces.

The projection is read-only and not a persistence API. Incremental clients can derive
it with `foundationSnapshot` when household/gameplay SSE messages arrive. Recruitment,
capacity, construction prices, zoning effects and service rules need their own
validated actions in later passes; this foundation supplies no arbitrary thresholds.

## Tutorial contract

`mayorStage(gameplay, homes, runs, now)` derives `link`, `townhall`,
`townhall_building`, `home`, `owner`, or `settled`. Supply only selected world homes.
Progress derives from recorded state, so closing a popover is not tutorial completion.
`settled` means the first owner's response was returned, never human acceptance.

The local home import/create API rejects requests before Town Hall finishes, before
calling the provider project registry or creating a folder. Listing projects and
reading existing histories remain available. Saved web projects/chats are metadata,
not the local home-building action, and retain their existing non-executing behavior.

## Parallel engineering ownership

Engineer A owns agents, catalog assignments, recruitment and actual execution:
agent modules, `bridge/world.mjs`, team/handoff modules, pass identity, recruitment UI.
Engineer B owns city services, building placement, zoning, happiness and Mayor guidance:
city/happiness modules, onboarding, scene simulation and building/map UI.

B owns interest definitions/effects; A assigns their stable IDs to candidates.
Agree catalog IDs, eligibility inputs and event shapes before either branch uses them.
Treat this module as a shared contract requiring review by both engineers.

One named integration owner per milestone edits `bridge/server.mjs`, `web/src/main.js`,
`web/src/ui.js`, shared progression wiring and the central handoff. Prefer separate
feature modules/stylesheets. Use separate worktrees, ports and isolated
`AGENT_WORLD_HOME`/`CODEX_HOME`; never run synthetic QA against player data.

Next paired milestone: A builds candidate catalogs and recruitment eligibility;
B defines household capacity and compatible workplace availability. Agree those
contracts before implementing the Suggest Roommates inspection or happiness gates.
