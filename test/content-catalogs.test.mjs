import test from 'node:test';
import assert from 'node:assert/strict';
import {
  PROFESSIONS, INTERESTS, BUILDINGS, ACTIVITIES, ITEMS, PETS, NAMES,
  PROFESSION_BY_ID, INTEREST_BY_ID, BUILDING_BY_ID, ACTIVITY_BY_ID,
  ITEM_BY_ID, PET_BY_ID, NAME_BY_ID,
} from '../shared/catalogs/index.js';
import correctedInterests from '../shared/catalogs/interests.js';
import requestedInterests from '../shared/catalogs/intrests.js';
import { BUILDING_TYPES } from '../shared/foundation.mjs';
import { DECOR, PETS as STYLE_PETS } from '../shared/style.mjs';

const catalogs = { professions: PROFESSIONS, interests: INTERESTS, buildings: BUILDINGS,
  activities: ACTIVITIES, items: ITEMS, pets: PETS, names: NAMES };
const indexes = { professions: PROFESSION_BY_ID, interests: INTEREST_BY_ID,
  buildings: BUILDING_BY_ID, activities: ACTIVITY_BY_ID, items: ITEM_BY_ID,
  pets: PET_BY_ID, names: NAME_BY_ID };

function references(ids, targets, description) {
  assert.ok(Array.isArray(ids), `${description} must be an array`);
  assert.equal(new Set(ids).size, ids.length, `${description} has duplicate references`);
  for (const id of ids) assert.ok(Object.hasOwn(targets, id), `${description}: unknown ${id}`);
}

test('catalogs have unique stable IDs, clean labels and matching lookup exports', () => {
  for (const [name, entries] of Object.entries(catalogs)) {
    assert.ok(entries.length > 0);
    assert.equal(new Set(entries.map(entry => entry.id)).size, entries.length, name);
    for (const entry of entries) {
      assert.match(entry.id, /^[a-z][a-z0-9]*(?:_[a-z0-9]+)*$/);
      assert.equal(typeof entry.label, 'string');
      assert.equal(entry.label.trim(), entry.label);
      assert.ok(entry.label.length > 0 && !/[\d]\.|\ufffd/.test(entry.label), entry.label);
      assert.equal(indexes[name][entry.id], entry);
      if (name !== 'names') assert.match(entry.category, /^[a-z][a-z_]*$/);
    }
  }
  assert.equal(correctedInterests, requestedInterests);
  assert.equal(INTERESTS, requestedInterests);
  assert.equal(PROFESSION_BY_ID.unknown_profession, undefined);
});

test('profession and building relationships resolve and agree in both directions', () => {
  for (const profession of PROFESSIONS) {
    references(profession.buildingAffinity, BUILDING_BY_ID, profession.id);
    assert.ok(profession.buildingAffinity.length > 0, profession.id);
    for (const buildingId of profession.buildingAffinity)
      assert.ok(BUILDING_BY_ID[buildingId].relatedProfessions.includes(profession.id));
  }
  for (const building of BUILDINGS) {
    assert.ok(BUILDING_TYPES.includes(building.category), building.id);
    references(building.relatedProfessions, PROFESSION_BY_ID, building.id);
    for (const professionId of building.relatedProfessions)
      assert.ok(PROFESSION_BY_ID[professionId].buildingAffinity.includes(building.id));
  }
  assert.ok(PROFESSION_BY_ID.personal_assistant.buildingAffinity.includes('home'));
  assert.ok(PROFESSION_BY_ID.junior_developer);
  assert.ok(PROFESSION_BY_ID.researcher);
  assert.equal(BUILDING_BY_ID.townhall.category, 'infrastructure');
});

test('interest, activity, item and pet relationships resolve without missing content', () => {
  for (const interest of INTERESTS) {
    assert.ok(Number.isFinite(interest.happinessValue) && interest.happinessValue > 0);
    references(interest.relatedItems, ITEM_BY_ID, interest.id);
    references(interest.relatedPets, PET_BY_ID, interest.id);
    references(interest.relatedActivities, ACTIVITY_BY_ID, interest.id);
    assert.ok(interest.relatedActivities.length > 0);
  }
  for (const activity of ACTIVITIES) {
    references(activity.buildingIds, BUILDING_BY_ID, activity.id);
    assert.ok(activity.buildingIds.length > 0);
  }
  for (const item of ITEMS) {
    if (item.decorId !== null) assert.ok(Object.hasOwn(DECOR, item.decorId), item.id);
  }
  for (const pet of PETS) {
    if (pet.stylePetId !== null) assert.ok(Object.hasOwn(STYLE_PETS, pet.stylePetId), pet.id);
  }
});

test('candidate names remain distinct and satisfy the roadmap length requirement', () => {
  assert.ok(NAMES.length >= 100);
  assert.equal(new Set(NAMES.map(name => name.label.toLowerCase())).size, NAMES.length);
  for (const name of NAMES) assert.match(name.label, /^[A-Za-z]{4,6}$/);
});
