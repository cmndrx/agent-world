import { PROFESSIONS } from './professions.js';
import { INTERESTS } from './intrests.js';
import { BUILDINGS } from './buildings.js';
import { ACTIVITIES } from './activities.js';
import { ITEMS } from './items.js';
import { PETS } from './pets.js';
import { NAMES } from './names.js';

export { PROFESSIONS, INTERESTS, BUILDINGS, ACTIVITIES, ITEMS, PETS, NAMES };
export const CATALOG_VERSION = 1;

// Templates are separate from persistent agents and placed building instances.
// Unknown IDs return undefined; consumers must not substitute a different identity.
const index = entries => Object.freeze(Object.fromEntries(entries.map(entry => [entry.id, entry])));
export const PROFESSION_BY_ID = index(PROFESSIONS);
export const INTEREST_BY_ID = index(INTERESTS);
export const BUILDING_BY_ID = index(BUILDINGS);
export const ACTIVITY_BY_ID = index(ACTIVITIES);
export const ITEM_BY_ID = index(ITEMS);
export const PET_BY_ID = index(PETS);
export const NAME_BY_ID = index(NAMES);
