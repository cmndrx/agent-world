// Exploration collectibles (phase 3, docs/GAMEPLAY.md): a few finds appear in yards around the
// neighborhood each day. Walking your avatar up to one collects it. Finding a kind unlocks a special
// decor item. Pure play: collectibles never give bricks and have nothing to do with agents.
// Spawns are deterministic from the local day and the set of homes, so bridge and client agree
// without storing them.

export const COLLECTIBLES = {
  seed_packet: { label: 'Seed packet', weight: 40, unlocks: 'veggie_patch', color: 0xe9c46a },
  blue_tulip: { label: 'Blue tulip', weight: 25, unlocks: 'blue_tulips', color: 0x4f86c6 },
  lucky_clover: { label: 'Lucky clover', weight: 20, unlocks: 'clover_patch', color: 0x3fa34d },
  crystal: { label: 'Tiny crystal', weight: 10, unlocks: 'crystal_lamp', color: 0xc77dff },
  golden_gnome: { label: 'Golden gnome', weight: 5, unlocks: 'golden_gnome', color: 0xffd166 },
};
export const SPAWNS_PER_DAY = 4;

/** Open yard spots (lot-local x, z) clear of fences, beds, trees and level upgrades. */
export const YARD_SPOTS = [[-8.5, 4.5], [8.3, 4.5], [-5.2, 8.2], [4.4, 7.8], [-9.2, -4.5], [9.2, -5], [-5, -7.4], [5, -7.8]];

/** Local calendar day, e.g. "2026-10-05". */
export function dayKey(date = new Date()) {
  const p = (n) => String(n).padStart(2, '0');
  return `${date.getFullYear()}-${p(date.getMonth() + 1)}-${p(date.getDate())}`;
}

function rng(seed) {
  let s = seed >>> 0 || 1;
  return () => {
    s ^= s << 13;
    s ^= s >>> 17;
    s ^= s << 5;
    return ((s >>> 0) % 100000) / 100000;
  };
}
function hash(str) {
  let h = 2166136261;
  for (let i = 0; i < str.length; i++) h = Math.imul(h ^ str.charCodeAt(i), 16777619);
  return h >>> 0;
}

/**
 * Today's spawns. `projects` are home keys; order doesn't matter (sorted here).
 * @returns {Array<{id:string, kind:string, project:string, x:number, z:number}>}
 */
export function spawnsFor(day, projects) {
  const homes = [...projects].sort();
  if (!homes.length) return [];
  const r = rng(hash(`${day}|${homes.join('|')}`));
  const total = Object.values(COLLECTIBLES).reduce((n, c) => n + c.weight, 0);
  const used = new Set();
  const out = [];
  for (let i = 0; out.length < SPAWNS_PER_DAY && i < SPAWNS_PER_DAY * 6; i++) {
    let roll = r() * total;
    const kind = Object.keys(COLLECTIBLES).find((k) => (roll -= COLLECTIBLES[k].weight) < 0) || 'seed_packet';
    const project = homes[Math.floor(r() * homes.length)];
    const spot = Math.floor(r() * YARD_SPOTS.length);
    if (used.has(`${project}|${spot}`)) continue;
    used.add(`${project}|${spot}`);
    const [x, z] = YARD_SPOTS[spot];
    out.push({ id: `${day}:${out.length}:${kind}`, kind, project, x, z });
  }
  return out;
}
