// Customization: the decor catalog, paint and wardrobe options, and validation for saved style.
// Shared by the bridge (validation before saving to ~/.agent-world/style.json) and the client.
// Style is simulation-layer only: it never changes what is shown as true about agents. See docs/GAMEPLAY.md.

import { itemPrice, levelName, itemLevel, lockReason } from './progression.mjs';
import { CROPS, cropLockReason, growth } from './garden.mjs';

/**
 * Decor catalog. `where`: indoor (inside the room), outdoor (yard inside the fence) or any.
 * `w`/`d`: footprint in meters before rotation. `walkable`: rugs and mats don't block movement.
 * `price`: bricks to unlock (omitted = free). `level`: minimum home level to place it (see progression.mjs).
 */
export const DECOR = {
  fern: { label: 'Fern', cat: 'Plants', where: 'any', w: 0.5, d: 0.5 },
  monstera: { label: 'Monstera', cat: 'Plants', where: 'any', w: 0.6, d: 0.6, price: 10 },
  cactus: { label: 'Cactus', cat: 'Plants', where: 'any', w: 0.4, d: 0.4 },
  bonsai: { label: 'Bonsai stand', cat: 'Plants', where: 'indoor', w: 0.5, d: 0.5, price: 20 },
  floor_lamp: { label: 'Floor lamp', cat: 'Lighting', where: 'indoor', w: 0.4, d: 0.4 },
  lantern: { label: 'Lantern', cat: 'Lighting', where: 'outdoor', w: 0.4, d: 0.4, price: 10 },
  round_rug: { label: 'Round rug', cat: 'Rugs', where: 'indoor', w: 2.2, d: 2.2, walkable: true },
  runner_rug: { label: 'Runner rug', cat: 'Rugs', where: 'indoor', w: 3, d: 1, walkable: true, price: 10 },
  armchair: { label: 'Armchair', cat: 'Seating', where: 'indoor', w: 0.95, d: 0.9, price: 15 },
  beanbag: { label: 'Beanbag', cat: 'Seating', where: 'indoor', w: 0.9, d: 0.9 },
  bench: { label: 'Garden bench', cat: 'Seating', where: 'outdoor', w: 1.6, d: 0.6 },
  side_table: { label: 'Side table', cat: 'Furniture', where: 'indoor', w: 0.6, d: 0.6 },
  low_shelf: { label: 'Low bookshelf', cat: 'Furniture', where: 'indoor', w: 1.3, d: 0.45, price: 15 },
  aquarium: { label: 'Aquarium', cat: 'Fun', where: 'indoor', w: 1.2, d: 0.5, price: 40, level: 2 },
  arcade: { label: 'Arcade cabinet', cat: 'Fun', where: 'indoor', w: 0.8, d: 0.75, price: 60, level: 3 },
  record_player: { label: 'Record player', cat: 'Fun', where: 'indoor', w: 0.8, d: 0.5, price: 30, level: 2 },
  guitar: { label: 'Guitar on a stand', cat: 'Fun', where: 'indoor', w: 0.5, d: 0.5, price: 25 },
  snack_fridge: { label: 'Snack fridge', cat: 'Fun', where: 'indoor', w: 0.7, d: 0.65, price: 35, level: 2 },
  tree_round: { label: 'Round tree', cat: 'Garden', where: 'outdoor', w: 1.4, d: 1.4, price: 15 },
  tree_pine: { label: 'Pine tree', cat: 'Garden', where: 'outdoor', w: 1.4, d: 1.4, price: 15 },
  bush: { label: 'Bush', cat: 'Garden', where: 'outdoor', w: 1, d: 1 },
  flower_patch: { label: 'Flower patch', cat: 'Garden', where: 'outdoor', w: 1.2, d: 0.8 },
  gnome: { label: 'Garden gnome', cat: 'Garden', where: 'outdoor', w: 0.4, d: 0.4 },
  bird_bath: { label: 'Bird bath', cat: 'Garden', where: 'outdoor', w: 0.7, d: 0.7, price: 20, level: 2 },
  picnic_table: { label: 'Picnic table', cat: 'Garden', where: 'outdoor', w: 1.8, d: 1.5, price: 30, level: 2 },
  garden_bed: { label: 'Garden bed', cat: 'Garden', where: 'outdoor', w: 1.4, d: 1.0 },
  // Grown in a garden bed (shared/garden.mjs): your first harvest of the crop unlocks the item.
  veg_crate: { label: 'Tomato crate', cat: 'Harvest', where: 'any', w: 0.7, d: 0.5, grown: 'tomato' },
  sunflower_vase: { label: 'Sunflower vase', cat: 'Harvest', where: 'indoor', w: 0.4, d: 0.4, grown: 'sunflower' },
  pumpkin_stack: { label: 'Pumpkin stack', cat: 'Harvest', where: 'outdoor', w: 1.0, d: 0.9, grown: 'pumpkin' },
  // Found while exploring (shared/collectibles.mjs): finding one of the kind unlocks the item.
  veggie_patch: { label: 'Veggie patch', cat: 'Found', where: 'outdoor', w: 1.2, d: 0.8, found: 'seed_packet' },
  blue_tulips: { label: 'Blue tulips', cat: 'Found', where: 'any', w: 0.5, d: 0.5, found: 'blue_tulip' },
  clover_patch: { label: 'Clover patch', cat: 'Found', where: 'outdoor', w: 0.9, d: 0.9, walkable: true, found: 'lucky_clover' },
  crystal_lamp: { label: 'Crystal lamp', cat: 'Found', where: 'indoor', w: 0.4, d: 0.4, found: 'crystal' },
  golden_gnome: { label: 'Golden gnome', cat: 'Found', where: 'outdoor', w: 0.4, d: 0.4, found: 'golden_gnome' },
};

export const PETS = { cat: 'Cat', dog: 'Dog', bunny: 'Bunny' };
/** House architecture (roof and trim). Homes pick one from their seed until you choose. */
export const ARCHES = { cottage: 'Cottage gable', craftsman: 'Craftsman hip', modern: 'Modern flat', barn: 'Red barn' };
export const MAX_PLOTS = 60;
export const MAX_GALLERY = 4; // photos hung on a home's wall
const PHOTO_ID = /^[a-z0-9-]{6,40}$/;

export const EXTERIOR_COLORS = ['#a9c9a4', '#e6ae94', '#9fc4e6', '#f0d58f', '#c7b8e6', '#f2b5c4', '#f4f1ea', '#8fa3b8', '#d9886a', '#6f9e8f'];
export const INTERIOR_COLORS = ['#f6eee2', '#e9f1e4', '#f1e9f4', '#e6eff6', '#f8eadf', '#f3f0e3', '#fde2d4', '#dfe9f3', '#efe6d2', '#e4e0f7'];
export const FLOORS = {
  oak: { label: 'Oak planks', colors: ['#d8a66c', '#cd9a60'], kind: 'plank' },
  walnut: { label: 'Walnut planks', colors: ['#8f5f3e', '#835639'], kind: 'plank' },
  birch: { label: 'Birch planks', colors: ['#ecd5ab', '#e2c899'], kind: 'plank' },
  slate: { label: 'Slate tiles', colors: ['#9aa0a8', '#8c939c'], kind: 'tile' },
  terracotta: { label: 'Terracotta tiles', colors: ['#d98b62', '#cf7f57'], kind: 'tile' },
  carpet: { label: 'Blue carpet', colors: ['#6f87b8', '#6a82b2'], kind: 'carpet' },
};

export const WARDROBE = {
  skin: ['#f8d5bb', '#eebd98', '#d39a6f', '#a86f48', '#7a4c30', '#5a3622'],
  hair: ['#2b2118', '#4a2f1d', '#8b4a24', '#d8b26a', '#b9bec7', '#23314f', '#c0566b', '#6b4ea8', '#3f8f6b', '#e8e2d6'],
  shirt: ['#ef8354', '#4f86c6', '#5fbf73', '#e6c84f', '#9b7ede', '#e56b8a', '#3fb7b0', '#f2a65a', '#f4f1ea', '#334155', '#5b6cf9', '#c0392b'],
  pants: ['#34405a', '#5b4636', '#2f3b2f', '#4b4b63', '#6b5b4b', '#22252e', '#7b8fa6', '#c9b38f'],
  shoes: ['#2a2f3c', '#f4f1ea', '#7b4b2a', '#d94f4f', '#4f86c6'],
  hairStyle: ['Crop', 'Bob', 'Bun', 'Spiky', 'Curly', 'Ponytail'],
  top: { tee: 'T-shirt', long: 'Long sleeves', hoodie: 'Hoodie', collar: 'Collared shirt' },
  accessory: { none: 'None', glasses: 'Glasses', cap: 'Cap', beanie: 'Beanie', headphones: 'Headphones', flower: 'Hair flower' },
};

/** Lot-local bounds a decor center may occupy (inside the fence). */
export const LOT_BOUNDS = { x0: -10.4, x1: 10.4, z0: -9.2, z1: 9.4 };
export const MAX_DECOR = 80;

export function emptyStyle() {
  return {
    version: 1, homes: {}, residents: {}, player: null, unlocks: [], layout: [], streets: {}, found: {}, collected: [],
    gardens: {}, harvest: {}, gallery: {},
  };
}

const HEX = /^#[0-9a-f]{6}$/i;
const inList = (v, list) => (typeof v === 'string' && list.includes(v.toLowerCase()) ? v.toLowerCase() : undefined);
const num = (v, lo, hi) => (Number.isFinite(v) ? Math.min(hi, Math.max(lo, Math.round(v * 4) / 4)) : null);

/** Validate a home's style. Returns a clean object or throws with a readable message. */
export function sanitizeHome(value) {
  if (value == null) return null;
  if (typeof value !== 'object') throw new Error('Home style must be an object.');
  const out = { decor: [] };
  if (value.exterior != null && !(out.exterior = inList(value.exterior, EXTERIOR_COLORS))) throw new Error('Unknown exterior color.');
  if (value.interior != null && !(out.interior = inList(value.interior, INTERIOR_COLORS))) throw new Error('Unknown wallpaper color.');
  if (value.floor != null) {
    if (!(value.floor in FLOORS)) throw new Error('Unknown floor style.');
    out.floor = value.floor;
  }
  if (value.pet != null) {
    if (!(value.pet in PETS)) throw new Error('Unknown pet.');
    out.pet = value.pet;
  }
  if (value.arch != null) {
    if (!(value.arch in ARCHES)) throw new Error('Unknown house style.');
    out.arch = value.arch;
  }
  const decor = Array.isArray(value.decor) ? value.decor : [];
  if (decor.length > MAX_DECOR) throw new Error(`A home can hold up to ${MAX_DECOR} decorations.`);
  const ids = new Set();
  for (const d of decor) {
    if (!d || typeof d !== 'object' || !(d.item in DECOR)) throw new Error('Unknown decoration.');
    const id = String(d.id || '');
    if (!/^[a-z0-9]{1,16}$/i.test(id) || ids.has(id)) throw new Error('Each decoration needs a unique id.');
    ids.add(id);
    const x = num(d.x, LOT_BOUNDS.x0, LOT_BOUNDS.x1);
    const z = num(d.z, LOT_BOUNDS.z0, LOT_BOUNDS.z1);
    if (x == null || z == null) throw new Error('Decoration position is invalid.');
    const rot = Number.isInteger(d.rot) ? ((d.rot % 4) + 4) % 4 : 0;
    out.decor.push({ id, item: d.item, x, z, rot });
  }
  return out;
}

/** Validate a resident's (or the player's) look overrides. Unknown fields are dropped. */
export function sanitizeLook(value) {
  if (value == null) return null;
  if (typeof value !== 'object') throw new Error('Look must be an object.');
  const out = {};
  for (const key of ['skin', 'hair', 'shirt', 'pants', 'shoes']) {
    if (value[key] == null) continue;
    if (!HEX.test(value[key]) || !(out[key] = inList(value[key], WARDROBE[key]))) throw new Error(`Unknown ${key} color.`);
  }
  if (value.hairStyle != null) {
    if (!Number.isInteger(value.hairStyle) || value.hairStyle < 0 || value.hairStyle >= WARDROBE.hairStyle.length) throw new Error('Unknown hair style.');
    out.hairStyle = value.hairStyle;
  }
  if (value.top != null) {
    if (!(value.top in WARDROBE.top)) throw new Error('Unknown top.');
    out.top = value.top;
  }
  if (value.accessory != null) {
    if (!(value.accessory in WARDROBE.accessory)) throw new Error('Unknown accessory.');
    out.accessory = value.accessory;
  }
  // Work clothes from a resident's role (shared/city.mjs) show by default; this hides them.
  if (value.uniform === false) out.uniform = false;
  return out;
}

/**
 * Apply one change to a style document (returns a new document).
 * @param {{kind:'home'|'resident'|'player', key?:string, value:object|null}} change
 * @param {{homes:Set<string>, residents:Set<string>, earned?:number, levels?:Object<string,number>}} known
 *   existing project keys and resident keys, bricks earned (derived) and home levels (derived)
 */
export function applyStyleChange(style, change, known) {
  const next = {
    ...emptyStyle(), ...style, homes: { ...style?.homes }, residents: { ...style?.residents }, unlocks: [...(style?.unlocks || [])],
    layout: [...(style?.layout || [])], streets: { ...style?.streets }, found: { ...style?.found }, collected: [...(style?.collected || [])],
    gardens: { ...style?.gardens }, harvest: { ...style?.harvest }, gallery: { ...style?.gallery },
  };
  const now = known?.now ?? Date.now();
  const { kind, key, value } = change || {};
  if (kind === 'layout') {
    // Plot order for houses (map mode). Index = plot; null = empty plot.
    if (!Array.isArray(value) || value.length > MAX_PLOTS) throw new Error('Layout must be a list of plots.');
    const seen = new Set();
    for (const p of value) {
      if (p == null) continue;
      if (!known.homes.has(p) || seen.has(p)) throw new Error('Each home can take one plot.');
      seen.add(p);
    }
    next.layout = value.map((p) => p ?? null);
    while (next.layout.length && next.layout.at(-1) == null) next.layout.pop();
  } else if (kind === 'street') {
    const row = Number(key);
    if (!Number.isInteger(row) || row < 0 || row >= MAX_PLOTS / 3) throw new Error('Unknown street.');
    const name = typeof value === 'string' ? value.replace(/[\u0000-\u001f]/g, '').trim().slice(0, 40) : '';
    if (name) next.streets[row] = name;
    else delete next.streets[row];
  } else if (kind === 'collect') {
    // Only today's spawns (derived by the bridge), and each one once.
    const spawn = (known.spawns || []).find((s) => s.id === key);
    if (!spawn) throw new Error('That find is not here today.');
    if (next.collected.includes(key)) throw new Error('Already collected.');
    const day = key.split(':')[0];
    next.collected = [...next.collected.filter((id) => id.startsWith(`${day}:`)), key];
    next.found[spawn.kind] = (next.found[spawn.kind] || 0) + 1;
  } else if (kind === 'plant' || kind === 'harvest') {
    // Gardening: the bed must be a garden bed in that home. The bridge stamps the planting time.
    if (!known.homes.has(key)) throw new Error('Unknown home.');
    const bed = String(value?.bed || '');
    if (!(next.homes[key]?.decor || []).some((d) => d.id === bed && d.item === 'garden_bed')) throw new Error('That garden bed is gone.');
    const beds = { ...next.gardens[key] };
    if (kind === 'plant') {
      if (beds[bed]) throw new Error('Something is already growing there.');
      const crop = value?.crop;
      const reason = cropLockReason(crop, next.found);
      if (reason === 'unknown') throw new Error('Unknown crop.');
      if (reason === 'found') throw new Error(`Find a seed packet while exploring to plant ${CROPS[crop].label.toLowerCase()}.`);
      beds[bed] = { crop, plantedAt: now };
    } else {
      const g = growth(beds[bed], now);
      if (!g) throw new Error('Nothing is planted there.');
      if (!g.ripe) throw new Error('Not ready to harvest yet.');
      next.harvest[beds[bed].crop] = (next.harvest[beds[bed].crop] || 0) + 1;
      delete beds[bed];
    }
    if (Object.keys(beds).length) next.gardens[key] = beds;
    else delete next.gardens[key];
  } else if (kind === 'gallery') {
    // Photos hung on a home's wall (your own photo-mode pictures, stored by the bridge).
    if (!known.homes.has(key)) throw new Error('Unknown home.');
    if (!Array.isArray(value) || value.length > MAX_GALLERY) throw new Error(`A wall holds up to ${MAX_GALLERY} photos.`);
    if (new Set(value).size !== value.length || value.some((id) => !PHOTO_ID.test(id) || !known.photos?.has(id))) throw new Error('Unknown photo.');
    if (value.length) next.gallery[key] = [...value];
    else delete next.gallery[key];
  } else if (kind === 'unlock') {
    if (!(key in DECOR) || !itemPrice(key)) throw new Error('That item is free already (or found by exploring).');
    if (next.unlocks.includes(key)) throw new Error('Already unlocked.');
    const spent = next.unlocks.reduce((n, item) => n + itemPrice(item), 0);
    const balance = (known.earned || 0) - spent;
    if (balance < itemPrice(key)) throw new Error(`Not enough gems yet (${Math.max(0, balance)} of ${itemPrice(key)}).`);
    next.unlocks.push(key);
  } else if (kind === 'home') {
    if (!known.homes.has(key)) throw new Error('Unknown home.');
    const clean = sanitizeHome(value);
    // Newly placed items must be unlocked and fit the home's level. Decor already in place stays,
    // even if a level later drops, so nothing you built is ever torn down.
    const before = new Set((style?.homes?.[key]?.decor || []).map((d) => `${d.id}|${d.item}`));
    for (const d of clean?.decor || []) {
      if (before.has(`${d.id}|${d.item}`)) continue;
      const reason = lockReason(d.item, { unlocks: next.unlocks, level: known.levels?.[key] || 1, found: next.found, harvest: next.harvest });
      if (reason === 'grown') throw new Error(`Harvest ${CROPS[DECOR[d.item].grown].label.toLowerCase()} from a garden bed to unlock the ${DECOR[d.item].label.toLowerCase()}.`);
      if (reason === 'found') throw new Error(`Find one while exploring to unlock the ${DECOR[d.item].label.toLowerCase()}.`);
      if (reason === 'locked') throw new Error(`Unlock the ${DECOR[d.item].label.toLowerCase()} first.`);
      if (reason === 'level') throw new Error(`The ${DECOR[d.item].label.toLowerCase()} needs a ${levelName(itemLevel(d.item))} (level ${itemLevel(d.item)}) home.`);
    }
    if (clean) next.homes[key] = clean;
    else delete next.homes[key];
    // A removed garden bed takes its planting with it.
    if (next.gardens[key]) {
      const beds = Object.fromEntries(Object.entries(next.gardens[key]).filter(([id]) => clean?.decor.some((d) => d.id === id && d.item === 'garden_bed')));
      if (Object.keys(beds).length) next.gardens[key] = beds;
      else delete next.gardens[key];
    }
  } else if (kind === 'resident') {
    if (!known.residents.has(key)) throw new Error('Unknown resident.');
    const clean = sanitizeLook(value);
    if (clean && Object.keys(clean).length) next.residents[key] = clean;
    else delete next.residents[key];
  } else if (kind === 'player') {
    next.player = sanitizeLook(value);
  } else {
    throw new Error('Unknown style change.');
  }
  next.updatedAt = new Date().toISOString();
  return next;
}

/** Take a deleted photo off every wall. */
export function removePhoto(style, id) {
  const gallery = {};
  for (const [home, ids] of Object.entries(style.gallery || {})) {
    const left = ids.filter((p) => p !== id);
    if (left.length) gallery[home] = left;
  }
  return { ...style, gallery };
}
