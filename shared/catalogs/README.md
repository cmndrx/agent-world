# Agent World content catalogs

Shared ES modules for future candidate generation, recruitment, workplaces and
character happiness. They are bundled with the desktop package under `shared/` and
can be imported by the bridge or Vite client. Importing them performs no I/O or
changes to player data. These definitions do not create agents, buildings or work.

The source is the **Plan agent world roadmap** chat and its **AGENT WORLD.pdf**:
all 99 professions, 12 workplaces, 75 recreation venues and 60 interest activities
are represented. Added content includes Junior Developer and Researcher (existing
role IDs), Mayor, Police Officer, Firefighter, Sanitation Worker, project home and
four infrastructure templates, plus eight pet/creative/social interests.

| File | Named export | Contents |
| --- | --- | --- |
| `professions.js` | `PROFESSIONS` | 105 profession objects |
| `intrests.js` | `INTERESTS` | 68 interest objects; requested filename |
| `interests.js` | `INTERESTS` | Alias of the same list with corrected spelling |
| `buildings.js` | `BUILDINGS` | 92 building/venue templates |
| `activities.js` | `ACTIVITIES` | 68 simulation activity definitions |
| `items.js` | `ITEMS` | 56 equipment, decor and treat definitions |
| `pets.js` | `PETS` | 4 pet definitions |
| `names.js` | `NAMES` | 124 distinct names containing 4–6 letters |
| `index.js` | All lists and `*_BY_ID` | Common imports and ID lookups |

Each list file also has a default export. Edit the explicit object arrays to add
content; the PDF is not a runtime dependency. Run the catalog integrity checks:

```powershell
node --test test/content-catalogs.test.mjs
```

## Contracts

IDs are permanent lowercase snake_case keys, unique **within** each catalog.
Labels may change without changing IDs. Store IDs rather than labels or list positions.

```js
// Profession
{ id, label, category, buildingAffinity: ['building_template_id'] }
// Interest
{ id, label, category, happinessValue: 5,
  relatedItems: ['item_id'], relatedPets: ['pet_id'],
  relatedActivities: ['activity_id'] }
// Building
{ id, label, category, relatedProfessions: ['profession_id'],
  subcategory /* optional finer grouping for recreation */ }
// Activity
{ id, label, category, buildingIds: ['building_template_id'] }
// Item
{ id, label, category, decorId /* existing DECOR ID, or null for future content */ }
// Pet
{ id, label, category, stylePetId /* existing style PETS ID, or null */ }
// Name
{ id, label }
```

`buildingAffinity` is always an array, allowing multiple compatible templates.
`relatedProfessions` is its inverse: keep both sides aligned when editing. It
describes workplace compatibility, not proof that an agent has been employed.
Empty lists mean no relationship is defined. `Activity.buildingIds` describes
possible venues, independent of profession compatibility.

Building `category` uses the foundation's four values: `residential`,
`recreational`, `infrastructure`, `work`. Category is separate from zoning;
zones, capacity, costs, unlock levels and pollution rules are still undecided.
Profession and interest categories are grouping keys rather than eligibility rules.

`home`, `townhall`, `personal_assistant`, `junior_developer` and `researcher`
retain the foundation/role vocabulary. `assistant` remains the legacy delegation
role alias handled by `shared/team.mjs`; new profession assignments use
`personal_assistant`. Some new workplace IDs (for example `design_studio`) differ
from historical downtown businesses (for example `studio`). The observed-work city
ledger in `shared/city.mjs` is independent and has not been migrated.

Building IDs here identify **templates**. A resident's `workplaceId` must identify
a real placed building instance when workplace assignment is implemented. The
catalog entry `home` is not a persistent home's `home:...` ID. Names likewise are
a reusable pool, not agent identities; candidate IDs must remain unique even when
two agents share a name.

Every `happinessValue` is a provisional **+5** for a matching fulfilled activity.
This is deliberately a uniform content baseline, not a balanced or active rule.
Do not award it on import, item ownership, a returned provider reply or ambient
animation. A later happiness system must define eligibility, repeat limits,
stacking, bounds and explicit event recording. Interests describe game character
preferences, not observed human or provider traits.

Existing decor links (such as `arcade`, `record_player`, `garden_bed`) and existing
pet links (`cat`, `dog`, `bunny`) reuse `shared/style.mjs` IDs. `decorId: null`
and `stylePetId: null` mean future content without an implemented renderer; fish
are not currently selectable pets. Catalog presence never implies an available
asset or unlocked building. Civic profession definitions also do not decide
whether a future service worker is simulated or an executable AI agent.

## Example for future consumers

```js
import {
  PROFESSIONS, NAMES, PROFESSION_BY_ID, BUILDING_BY_ID,
  INTEREST_BY_ID, ACTIVITY_BY_ID,
} from './shared/catalogs/index.js';

const profession = PROFESSION_BY_ID.junior_developer;
const compatibleTemplates = profession.buildingAffinity.map(id => BUILDING_BY_ID[id]);
const interest = INTEREST_BY_ID.dog_companionship;
const activities = interest.relatedActivities.map(id => ACTIVITY_BY_ID[id]);
const nameOptions = NAMES.map(name => name.label);
```

Recruitment, personality assignment, persistent candidate generation and happiness
integration remain subsequent passes. A catalog profession does not automatically
become a supported delegation role. No existing resident assignments are changed.
