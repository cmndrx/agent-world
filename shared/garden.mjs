// Gardening (play layer): plant a crop in a garden bed and it grows over real hours. Nothing wilts and
// nothing is lost by waiting; harvesting is optional. Growth is timed from `plantedAt`, which the bridge
// stamps (the client can't backdate it). Harvests unlock decor. They never give bricks and have nothing to
// do with agent activity. See docs/GAMEPLAY.md.

export const CROPS = {
  tomato: { label: 'Tomatoes', growHours: 12, unlocks: 'veg_crate', color: 0xe24a3b },
  sunflower: { label: 'Sunflower', growHours: 20, unlocks: 'sunflower_vase', color: 0xf5c518 },
  pumpkin: { label: 'Pumpkin', growHours: 48, unlocks: 'pumpkin_stack', color: 0xec8a2c, needs: 'seed_packet' },
};

export const STAGES = ['Planted', 'Sprouting', 'Growing', 'Ready to harvest'];

export const growMs = (crop) => CROPS[crop].growHours * 3600 * 1000;

/** Growth of a planted bed at `now`: stage 0–3 (3 = ripe), progress 0–1 and time left. */
export function growth(plot, now = Date.now()) {
  if (!plot || !CROPS[plot.crop]) return null;
  const total = growMs(plot.crop);
  const progress = Math.min(1, Math.max(0, (now - plot.plantedAt) / total));
  const stage = progress >= 1 ? 3 : progress >= 0.5 ? 2 : progress >= 0.12 ? 1 : 0;
  return { stage, progress, ripe: progress >= 1, remainingMs: Math.max(0, total - (now - plot.plantedAt)) };
}

/** Why a crop can't be planted yet ('found' = needs a find), or null. */
export function cropLockReason(crop, found = {}) {
  if (!CROPS[crop]) return 'unknown';
  if (CROPS[crop].needs && !(found[CROPS[crop].needs] > 0)) return 'found';
  return null;
}

/** "3h 20m", "45m", "under a minute". */
export function formatRemaining(ms) {
  const m = Math.ceil(ms / 60000);
  if (m <= 1) return 'under a minute';
  const h = Math.floor(m / 60);
  return h ? `${h}h${m % 60 ? ` ${m % 60}m` : ''}` : `${m}m`;
}
