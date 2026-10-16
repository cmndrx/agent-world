// Explicit reviewed policy. Catalog links alone never confer a usable venue/resource.
import { INTERESTS } from './catalogs/intrests.js';
import { ACTIVITIES } from './catalogs/activities.js';

const labels = {
  favorite_meals: 'Enjoy a meal', sweets: 'Enjoy candy or chocolate', takeout: 'Enjoy simulated takeout',
  snacks: 'Give snack', television: 'Watch TV', board_games: 'Play a solo board game',
  naps: 'Take a nap', sleeping_in: 'Rest a little longer', bubble_baths: 'Take a bubble bath',
  lazy_days: 'Enjoy a lazy day', reading: 'Read a book', personal_goals: 'Enjoy goal time',
  awards: 'Enjoy an award scene', celebrations: 'Celebrate together', praise: 'Offer encouragement',
};
export const INTEREST_CARE = Object.freeze(Object.fromEntries(INTERESTS.map(i => {
  const activity = ACTIVITIES.find(a => a.id === i.relatedActivities[0]);
  const unsupported = !activity?.buildingIds.includes('home')
    ? `Requires ${activity?.buildingIds.join(' or ') || 'a supported venue'}. Player care at this venue is not implemented yet.`
    : i.id === 'painting' ? 'Requires a placed easel; easels are not available to place yet.'
    : ['cat_companionship','bunny_companionship'].includes(i.id) ? 'Matching household pet required. Safe pet approach and return are not implemented yet.'
    : i.id === 'aquatic_pets' ? 'Requires a placed populated aquarium. Bound aquarium viewing is not implemented yet.'
    : !labels[i.id] ? 'This care scene is not implemented yet.' : null;
  return [i.id, {...i, activityId: activity?.id, label: labels[i.id] || i.label, unsupported}];
})));
export function resourceReason(interest, {items = [], pet = null, floor = 0} = {}) {
  const p = INTEREST_CARE[interest];
  if (!p) return 'Unknown interest.';
  if (p.relatedPets.length && interest !== 'aquatic_pets' && pet !== p.relatedPets[0]) return `This home needs a ${p.relatedPets[0]} for this activity.`;
  if (p.unsupported) return p.unsupported;
  const needs = {television:['tv','television'], bubble_baths:['bath'], naps:['bed'], sleeping_in:['bed'], snacks:['snack_fridge'], reading:['bookshelf','low_shelf']};
  if (needs[interest] && !items.some(i => needs[interest].includes(i.kind) && (i.floor ?? floor) === floor)) return `Requires a placed or authored ${needs[interest][0]} on this floor.`;
  return null;
}
export const interestForActivity = id => Object.values(INTEREST_CARE).find(p => p.activityId === id)?.id;
