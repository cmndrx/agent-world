# SimCity BuildIt research and Agent World comparison

Research date: October 24, 2026. Scope: research and recommendations only. No gameplay implementation, task acceptance, queue changes or future work approval.

**Conclusion:** Agent World's biggest opportunity is to connect the town systems it already has. BuildIt's useful lesson is that buildings, progression, needs and rewards continually give one another a purpose. Agent World can create that connection around persistent residents and actual project work, with a richer personal relationship than an anonymous population counter.

This is a broad survey of every major documented feature family I found, not a claim to have played every unlock, inspected every building or verified every live event. External mechanics below come from public sources; recommendations are my design analysis. Agent World findings come from the current working tree, which contains substantial pre-existing uncommitted work. They are not a certification of the running packaged app.

## What BuildIt's systems accomplish

The basic loop is production → construction → growth → new needs and options → more planning. Its additional modes give players different motivations: efficiency, collecting, visual expression, competition and cooperation. Those motivations share the same city, so improving it has several potential uses.

Agent World has two overlapping loops already:

- Authorized project work → returned responses → participation XP → larger homes, resident capacity and town unlocks.
- Human review and reached outcomes → gems and milestone rewards → customization and town development.

Its simulation layer adds care, interests, decor, gardens, weather and exploration. The design question is how to make those enjoyable systems interact while keeping participation, simulated wellbeing and reviewed work quality distinct.

## Feature coverage map

Each numbered entry is a feature or related group, not a count of individual assets. Sources are attached to the groups they support.

### City planning and economy

| # | BuildIt feature | Agent World comparison |
| --- | --- | --- |
| 1 | Road-connected housing; placement, movement and demolition. | Shared grid/frontage/rotation foundation. Agent World preserves a home's project and resident identity when moving it. |
| 2 | Housing upgrades and population growth. | Fifteen home levels and eight architectural tiers, with explicit recruitment. Population is not interchangeable with real teammates. |
| 3 | Service coverage, happiness, abandonment and land value. | Civic structures exist, but the inspected implementation does not establish a comparable city service economy. Resident care is a separate system. |
| 4 | Power, water, sewage, waste, fire, police and health. | Eight placeable civic kinds include several corresponding buildings, plus library and school. Their documented function is scenery. |
| 5 | Factory materials and commercial crafting chains. | No comparable manufacturing economy established by this inspection. Real agent tasks provide a different productive loop. |
| 6 | Storage upgrades and item-dependent land expansion. | A bounded town grid and level-dependent active-project permits; no corresponding material inventory found. |
| 7 | Trade Depot, Global Trade HQ, city deals and sea shipments. | No comparable player marketplace established. A future artifact library would serve a different, work-related purpose. |
| 8 | Simoleons, SimCash and keys. | Gems plus separate player/resident/home progression. Keep resource meanings legible rather than adding matching currencies. |
| 9 | Regional cities and upgradeable regional Hot Spots. | One town with project homes and recreation tiers. Districts could eventually help organize a large project collection. |
| 10 | City achievements. | Existing outcomes, reviewed rewards, collectibles and progression are the foundation for a clearer achievement presentation. |

BuildIt mechanics in this group: [EA beginner guide](https://help.ea.com/en/articles/simcity/simcity-buildit/beginner-guide/). The design inference is that placement becomes a decision when the player can understand its consequences.

### Identity, specialization and advanced building

| # | BuildIt feature | Agent World comparison |
| --- | --- | --- |
| 11 | International neighborhoods, landmarks, beach/mountain development, rivers, lakes and forests. | Architectural styles, evolved home silhouettes, decor, gardens, weather and public spaces already supply several forms of expression. |
| 12 | Specialization buildings and population boosts. | Recreation interests offer a more personal specialization basis, but placement currently grants no wellbeing benefit. |
| 13 | Space specialization. | No equivalent needed for parity. It illustrates an aspirational late-game theme rather than a separate space simulation requirement. |
| 14 | Airport cargo and imported neighborhood items. | No equivalent established. This is a secondary-source-supported feature family, not a verified current flight schedule or unlock table. |
| 15 | Epic Projects transform housing and generate speed-up token parts. | A possible inspiration for major human-reviewed project achievements producing commemorative town changes. |
| 16 | OMEGA homes, labs, research, NeoMall, NeoSimoleons, NeoBank and separate storage. | No equivalent specialized economy established. Useful lesson: a later unlock can introduce new decisions, rather than only a larger number. |
| 17 | OMEGA ControlNet, drones and proximity-dependent skybridges. | Potential inspiration for visible relationships between buildings, with effects confined to clearly labeled simulation. |
| 18 | Train tracks/stations, passenger dispatch, Rail Simoleons, train cards/classes and upgrades. | Roads and street life currently provide scenery and connectivity. An optional transit system would be a substantial new simulation project. |

Sources: [EA's App Store description](https://apps.apple.com/us/app/simcity-buildit/id913292932), [official anniversary announcement](https://www.youtube.com/watch?v=zxeFyElxqZU), [airport community reference](https://simcity-buildit.fandom.com/wiki/Airport), [Epic Projects](https://help.ea.com/en/articles/simcity/simcity-buildit/epic-projects/), [Future Cities](https://help.ea.com/en/articles/simcity/simcity-buildit/future-cities-simcity-buildit/), [trains announcement](https://www.ea.com/games/simcity/simcity-buildit/news/simcity-buildit-trains-arrival).

### Challenges, social play and ongoing content

| # | BuildIt feature | Agent World comparison |
| --- | --- | --- |
| 19 | Contest of Mayors assignments, leagues, ranks and leaderboards. | No comparable public competition established. Work volume would be a poor substitute for quality. |
| 20 | Mayor's Pass reward tracks, paid options and event tracks. | Progression exists; no equivalent seasonal pass established. An optional personal collection journey could fit without competitive pressure. |
| 21 | Design Challenges, voting, Blueprints and design leagues. | Decorating and photo mode are present; a self-contained design challenge space could extend them. |
| 22 | Mayor's Clubs, chat, member roles and cooperation. | Agent World teams are recruited AI residents inside a project, not clubs of human players. Human community features would require a separate product layer. |
| 23 | Club Wars, disaster cards, energy, supplies, shields and war rewards. | No comparable combat established. Poor near-term fit for managing trusted project work. |
| 24 | Monster Trouble and Vu's Pass. | No equivalent established. Their transferable idea is an optional event with a clear beginning, objective and reward. |
| 25 | Dr. Vu disaster activities. | Any corresponding challenge should be fictional and isolated from real files, agent permissions and task execution. |
| 26 | Themed seasons, collectible buildings and upgradeable landmarks. | Seasonal ambience and collectible decor exist. A persistent collection book could make this content easier to discover and value. |

Sources: [EA rewards guide](https://help.ea.com/en/articles/simcity/simcity-buildit/rewards/), [Mayor's Club guide](https://help.ea.com/en/articles/simcity/simcity-buildit/mayors-club/), [Greek Islands season](https://www.ea.com/games/simcity/simcity-buildit/news/explore-the-beauty-of-greek-islands), [Haunted Metropolis](https://www.ea.com/games/simcity/simcity-buildit/news/welcome-to-haunted-metropolis-streets-of-fright).

### Presentation, convenience and commercial systems

| # | BuildIt feature | Agent World comparison |
| --- | --- | --- |
| 27 | Time-of-day presets, precise adjustment and pause per region. | Seasons/weather and photo filters exist; equivalent time controls were not verified. |
| 28 | Photo sharing and helicopter city-tour recording. | Local photos, an album and photos displayed at home are documented. Guided flyovers could make sharing the town more compelling. |
| 29 | Separate raw-material storage. | A useful information-design lesson for separating world items, real work artifacts and account/provider information. |
| 30 | Daily login calendars and optional ad-doubled rewards. | No comparable mechanism established. Persistent, non-expiring discoveries would suit occasional visits better. |
| 31 | Purchasable currency, offers, web-store bundles and random-item purchases. | No comparable monetization verified in this pass; paid AI-provider execution is a different expense. |
| 32 | Linked-account recovery and cross-device saving. | Local state and installed-provider workflows; backup/restore is worth assessing before any social expansion. |
| 33 | Partial offline operation with online/social restrictions. | Local atmosphere and saved data differ from online provider execution. Clear availability labels matter more than claiming everything works offline. |
| 34 | Layered alerts, advisors and contextual explanations. | Mayor Martin, placement previews, resident activity and provider approvals provide a substantial foundation; town consequences could be explained more consistently. |

Sources: [Meteorology Center](https://www.ea.com/games/simcity/simcity-buildit/news/metorology-center), [Helicam City Tours](https://www.ea.com/games/simcity/simcity-buildit/ugc-campaign/helicam-city-tours), [Material Storage announcement](https://forums.ea.com/discussions/simcity-buildit-en/introducing-material-storage-expand-your-horizons/12288121), [Update 83](https://www.ea.com/games/simcity/simcity-buildit/news/update-83-patch-notes), [Web Store guide](https://help.ea.com/en/articles/simcity/simcity-buildit/web-store/), [save-progress guide](https://help.ea.com/no/articles/simcity/simcity-buildit/save-progress/). Offline restrictions are documented in the beginner guide above.

## Important current-version qualifications

Older documentation is not a reliable complete snapshot of the current game:

- The beginner guide describes three headline currencies, while other systems use additional resources. Treat it as an introduction rather than an exhaustive economy specification.
- The raw-material storage announcement describes factory materials moving into their own expandable store. A description that puts all goods in City Storage misses this system.
- An EA community-manager announcement indexed as **Town Forum — October 16, 2026** describes Mayor's Pass points coming from daily/weekly tasks and Contest points from bonus tasks. Older help and some season copy describe the tracks as coupled. The [EA forum listing](https://forums.ea.com/category/simcity-en/discussions/simcity-buildit-en) and its indexed excerpt were accessible; the specific older thread was not resolved to a stable direct page in this pass. This supports a recent announced change, not verified universal rollout or exact scoring rules.
- October's Haunted Metropolis page describes a new upgradable landmark, a city-wide atmospheric effect and themed roads/services. The October 6 patch notes also describe regional OMEGA contribution changes and optional ad-doubled calendar rewards. Both are more current than the core help pages.
- Exact unlocks, prices, event schedules and reward balancing may differ by version or change. I did not treat old guides or community comments as a definitive live balance table.

## Where Agent World is strongest

**Persistent individuals.** BuildIt's principal city feedback is aggregate. Agent World can make a place valuable because Otto or Ellis lives there, has particular interests, owns particular conversations and contributes to a particular project. That creates a more personal reason to care about a home.

**Actual productive stakes.** A resident can research, implement and return a real deliverable. The town can hold the history of things its owner actually made. This is a distinctive product direction, although we have not measured whether it produces stronger engagement than a conventional builder.

**Interior-scale attachment.** Homes have authored interiors, floor navigation, personal workspaces, customization and care. A future city system can connect back to those individuals rather than replacing them with a population statistic.

**Explainable provenance.** Current source separates response-based participation XP, human-reviewed gem rewards and simulated happiness. That distinction supports trust. Keep it visible as more progression is added.

## Where BuildIt currently offers more game depth

**Consequential placement.** Agent World checks that a footprint fits and connects. Beyond that, the inspected civic/venue systems provide fewer strategic consequences for choosing one location over another.

**Interlocking systems.** A new Agent World building can be an unlock and an attractive model without creating a new interaction. The recreation pass is the clearest example: ten venues are modeled and placeable, but residents cannot yet visit them through venue care.

**A readable horizon.** We have many progression paths, but their relationship is harder to explain: player levels, individual XP, pooled home XP, building tiers, resident slots, project permits, gems and milestones. A single overview could answer what comes next and why it is worth pursuing.

**Multiple supported play styles.** BuildIt explicitly supports competition, collecting, trading and design. Agent World's work, care and decorating paths could each have clearer voluntary objectives without requiring every user to participate in all of them.

**Ongoing aspiration.** BuildIt offers large transformations and recurring themes. Agent World's homes already transform, but personal and project achievements could leave more visible, memorable traces in the town.

These are source-based product comparisons. No comparative usability, performance, retention or spending study was performed.

## Recommended improvements

These are opportunities, not approved implementation passes. Effort is a relative design estimate, not an engineering commitment.

| Priority | Opportunity | Why it matters | Relative effort / confidence |
| --- | --- | --- | --- |
| 1 | Connect residents to recreation venues. | Turns existing scenery into personal town life. | Medium–large / high confidence in the documented gap. |
| 2 | Add planning overlays and consequence previews. | Makes placement understandable and gives future town systems a useful interface. | Medium / high conceptual fit. |
| 3 | Unify progression and unlock discovery. | Makes a complicated reward structure easier to understand. | Medium / high need for clarity; usability testing needed. |
| 4 | Give civic buildings one modest simulation function each. | Makes public construction meaningful without starting a whole new economy. | Large / medium; needs design validation. |
| 5 | Add an achievement gallery and project monuments. | Turns human-reviewed accomplishments into a town history. | Medium / medium–high fit. |
| 6 | Expand visual expression through coordinated sets and layout tools. | Makes existing building variety more satisfying to use. | Medium–large / medium. |
| 7 | Offer optional design challenges and safe town sharing. | Gives decorating a purpose beyond filling space. | Large / medium; audience demand untested. |
| 8 | Explore project districts and transit later. | Could make larger towns easier to navigate and more distinctive. | Large / low–medium until scale is observed. |

### 1. Let a resident use a place that matches their interests

Example: Ellis likes arcade games. The arcade panel can explain that it serves Ellis's interest; an explicit care action can send him there, show the scene and record the actual simulated benefit after completion.

This creates a complete sequence: discover a resident's interest → unlock a suitable venue → choose its location → watch the resident use it → see a persistent result. It builds on existing catalog mappings rather than inventing a separate resource economy.

The difficult parts are real: cross-home travel, route validity, reservations, leaving and returning to the correct floor, interruption by actual work, unavailable venues, reloads and once-only completion. A visitor animation alone would not complete the feature. Passive outings could later add life, but should retain the current no-passive-reward policy unless that policy is explicitly redesigned.

### 2. Make the map explain the town

Offer distinct overlays for road connections, recreation eligibility, unlock requirements and actual agent attention. Selecting a venue could highlight residents whose interests it supports and explain unavailable interactions. A moving-building preview should show consequences before confirmation.

Do not present a fictional radius as an already-implemented constraint. If distance eventually changes simulated access, define and test that rule first. Real provider approvals and blocked runs must remain distinguishable from a resident wanting leisure.

### 3. Show one understandable progression horizon

A town overview should explain player XP, the next project permit, each home's next tier/slot, nearby civic/leisure unlocks and gem provenance. Show a preview of what an unlock adds, not just its numerical threshold.

Label each measure: participation, human-reviewed achievement, or simulated wellbeing. This prevents a response-count milestone from appearing to certify expertise. An achievement-oriented path can acknowledge fewer, substantial completed projects without encouraging unnecessary AI calls.

### 4. Give civic buildings small, visible purposes

Possible simulation-only functions: a library hosts an implemented reading outing; a park supports walks; public services contribute to a transparent town comfort display. Each should show who benefits and what rule causes the benefit. Start with a small number of relationships rather than a full power/water/tax economy.

The city can become a deeper optional game without preventing users from accessing projects or reducing real AI capability when a fictional service is absent. No simulated building should imply that code is safer, a resident is more competent or real work has passed review.

### 5. Let completed projects change the town's story

Offer a commemorative mural, trophy, garden feature or monument after an existing human-reviewed outcome. The object can link to the human-approved description and chosen artifact, with private information hidden by default. A failed or merely finished agent turn should not qualify automatically.

The useful adaptation of Epic Projects is a memorable transformation. The adaptation need not inherit timed pressure or artificial boosts to real agent speed.

### 6. Make planning and collecting more expressive

Coordinated district themes, street surfaces, tree groupings, waterfront pieces and neighborhood palettes could make the same building set produce more distinctive towns. Improve safe undo/redo and layout previews before multiplying catalog size. Any saved layout should preserve real project/resident identities and report conflicts rather than silently removing things.

A collection book could show owned, locked and undiscovered decorations, their visual sets and the exact means of obtaining them. Optional collections can remain available after a season, allowing the town to welcome users back after a break.

### 7. Add a creative mode before a competitive economy

A design challenge could offer a separate temporary plot and a prompt such as a reading garden or a small creative campus. It should not require rearranging the real project town. Local completion and photo capture can provide value before online voting exists.

Later, sharing should export selected visual content with names, paths, monitors and prompt text excluded by default and a preview before publication. The existing local photo album is a useful starting point; community visits, moderation and online infrastructure are separate work.

### 8. Reserve districts and transit for demonstrated scale

Regions suggest a future way to organize many projects into neighborhoods: creative work, software, study or personal projects. Those groups should be chosen by the human and should not alter filesystem ownership or grant cross-project access.

Transit can eventually connect real destinations in the simulation. It should earn its place by improving navigation or visible town life, rather than becoming an additional timer/currency system solely because BuildIt has trains.

## Mechanics I would adapt cautiously

- Paid skips, storage bottlenecks and many separate currencies can make a builder monetizable but also make planning harder to understand. Agent World needs a clear distinction between cosmetic rewards and actual provider costs.
- Competitive rankings based on prompts, tokens or response count would reward usage rather than outcomes. Optional creative showcases are a better initial social fit.
- Disasters and abandonment can create dramatic city gameplay. Applying them to real projects, saved conversations or earned work history would undermine the town's role as a trusted workspace.
- Daily streak loss and expiring collections would require users to manage the game on its schedule. Existing non-wilting gardens and persistent city history support a more welcoming return experience.
- Seasonal spectacle, animation and population scale are production costs as well as features. Add graphics quality controls and measure responsiveness before pursuing city-wide effects comparable to a mature mobile title.

## Evidence from this checkout

Read: project instructions, `CONCEPT.md`, `README.md`, the latest entries of `docs/NEXT_PASS.md`, `docs/GAMEPLAY.md`, the user-maintained synopsis, the Agent World skill and work-cycle reference. Inspected current `shared/town.mjs`, `shared/progression.mjs`, `shared/experience.mjs`, `shared/interest-care.mjs`, `shared/care.mjs`, `shared/city.mjs` and targeted civic/planner references.

Key source confirmations:

- `shared/town.mjs` defines eight civic buildings and ten recreation venues, with levels, footprints, catalog-derived interests and explicit comments that placement is scenery.
- `shared/interest-care.mjs` returns an unimplemented-venue explanation for non-home activities. This confirms the latest handoff's venue-care limitation independently of its claimed test results.
- `shared/progression.mjs` defines fifteen home levels, eight building tiers and separate human-reviewed gem rules. Some older prose in `docs/GAMEPLAY.md` and README still describes superseded progression or floor behavior; the source and current amendments take precedence for this comparison.
- `shared/experience.mjs` awards participation XP once per qualifying returned run. `shared/city.mjs` describes activity categories rather than volume and explicitly rejects city shrinkage on quiet days.
- Git status and diff statistics were inspected. Existing uncommitted work was preserved. Port 4777 was listening in the Agent World process, PID 58147; no restart or runtime mutation was performed. A listener is not an end-to-end health check.

Public research used EA Help, EA announcements, EA community-manager material, EA's App Store description and the official anniversary description. The airport reference is community documentation and is labeled accordingly. The private task browser opened and inspected the official homepage, beginner guide and Helicam page; its screenshot showed promotional city imagery, not live game play. No browser clicks, fills, sign-in, purchase or submission was performed.

No application code changed. No tests, application build, signature check or package parity check were run; those would not validate this research-only deliverable. Earlier handoff test totals were read as historical reports and are not this pass's checks.

Remaining uncertainties: actual early-game pacing, touch interaction quality, current account-specific offers and unlocks, every catalog asset, late-game balance, full rollout of recent task changes, accessibility and real user preference between these design directions. No retention or comparative performance claims are established.

## One proposed next pass — not executed

Create a reviewable design specification for **one public-park outing**, using an already-defined supported park interest. Define explicit initiation, destination eligibility, route/return, work interruption, completion receipt and visible simulated benefit. Include UI states and acceptance criteria, but no implementation, real care actions or queue changes. This tests the highest-value connection before expanding all ten venues.
