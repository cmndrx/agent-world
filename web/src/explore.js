// Exploration (phase 3): today's finds sparkle in yards around the neighborhood. Walk your avatar up to
// one to collect it. Pure play: finds unlock special decor, never bricks, and have nothing to do with agents.

import * as THREE from 'three';
import { COLLECTIBLES, dayKey, spawnsFor } from '../../shared/collectibles.mjs';
import { DECOR } from '../../shared/style.mjs';
import { box, cyl, ico } from './models.js';

const PICKUP_RANGE = 1.3;

function model(kind) {
  const c = COLLECTIBLES[kind].color;
  const g = new THREE.Group();
  if (kind === 'seed_packet') {
    g.add(box(0.28, 0.36, 0.04, 0xfaf3e0, 0, 0.18, 0));
    g.add(box(0.2, 0.16, 0.045, c, 0, 0.2, 0));
    g.add(ico(0.04, 0x5fbf73, 0, 0.21, 0.03));
  } else if (kind === 'blue_tulip') {
    g.add(cyl(0.012, 0.012, 0.32, 0x3f8a4f, 4, 0, 0.16, 0));
    g.add(cyl(0.07, 0.04, 0.12, c, 6, 0, 0.36, 0));
  } else if (kind === 'lucky_clover') {
    g.add(cyl(0.01, 0.01, 0.2, 0x3f8a4f, 4, 0, 0.1, 0));
    for (let k = 0; k < 4; k++) {
      const a = (k / 4) * Math.PI * 2;
      const leaf = ico(0.06, c, Math.cos(a) * 0.06, 0.22, Math.sin(a) * 0.06);
      leaf.scale.y = 0.35;
      g.add(leaf);
    }
  } else if (kind === 'crystal') {
    const gem = new THREE.Mesh(new THREE.OctahedronGeometry(0.12, 0), new THREE.MeshStandardMaterial({ color: c, emissive: c, emissiveIntensity: 1.6, flatShading: true }));
    gem.position.y = 0.2;
    gem.scale.y = 1.5;
    g.add(gem);
  } else {
    const gold = { roughness: 0.25, metalness: 0.7 };
    g.add(cyl(0.08, 0.1, 0.18, c, 8, 0, 0.09, 0, gold));
    g.add(ico(0.06, c, 0, 0.22, 0, 1, gold));
    g.add(cyl(0, 0.07, 0.18, c, 8, 0, 0.34, 0, gold));
  }
  // Soft beacon so finds are noticeable from a distance.
  const ring = new THREE.Mesh(new THREE.RingGeometry(0.3, 0.42, 24), new THREE.MeshBasicMaterial({ color: 0xfff3c4, transparent: true, opacity: 0.7, side: THREE.DoubleSide, depthWrite: false }));
  ring.rotation.x = -Math.PI / 2;
  ring.position.y = 0.03;
  ring.name = 'ring';
  g.add(ring);
  g.traverse((o) => o.isMesh && (o.castShadow = o.name !== 'ring'));
  return g;
}

export class Explore {
  /**
   * @param {object} o
   * @param {(change: object) => Promise<void>} o.save
   * @param {() => Map<string, import('./lot.js').Lot>} o.lots
   * @param {(kind: string, firstTime: boolean, count: number) => void} o.onFound
   */
  constructor({ save, lots, onFound }) {
    Object.assign(this, { save, lots, onFound });
    this.objects = new Map(); // spawn id -> { group, spawn }
    this.style = null;
    this.day = '';
    this.pending = new Set();
  }

  setStyle(style) {
    this.style = style;
    this.sync();
  }

  /** Show today's uncollected finds; remove collected or stale ones. */
  sync() {
    if (!this.style) return;
    this.day = dayKey();
    const lots = this.lots();
    const collected = new Set(this.style.collected || []);
    const spawns = spawnsFor(this.day, [...lots.keys()]).filter((s) => !collected.has(s.id) && lots.has(s.project));
    const want = new Set(spawns.map((s) => s.id));
    for (const [id, o] of this.objects) {
      if (!want.has(id)) {
        o.group.parent?.remove(o.group);
        this.objects.delete(id);
      }
    }
    for (const spawn of spawns) {
      if (this.objects.has(spawn.id)) continue;
      const group = model(spawn.kind);
      group.position.set(spawn.x, 0.12, spawn.z);
      lots.get(spawn.project).group.add(group);
      this.objects.set(spawn.id, { group, spawn });
    }
  }

  /** How many finds are still out there today. */
  get remaining() {
    return this.objects.size;
  }

  update(dt, t, avatarPos) {
    if (dayKey() !== this.day) this.sync();
    for (const [id, { group, spawn }] of this.objects) {
      group.rotation.y = t * 1.2;
      group.children.forEach((c) => {
        if (c.name === 'ring') {
          c.scale.setScalar(1 + Math.sin(t * 3) * 0.12);
          c.material.opacity = 0.45 + Math.sin(t * 3) * 0.25;
        } else c.position.y += Math.sin(t * 2.2) * 0.0015;
      });
      const world = group.getWorldPosition(new THREE.Vector3());
      if (this.pending.has(id) || Math.hypot(world.x - avatarPos.x, world.z - avatarPos.z) > PICKUP_RANGE) continue;
      this.pending.add(id);
      const before = this.style?.found?.[spawn.kind] || 0;
      group.visible = false;
      this.save({ kind: 'collect', key: id })
        .then(() => this.onFound(spawn.kind, before === 0, before + 1, world))
        .catch(() => (group.visible = true))
        .finally(() => this.pending.delete(id));
    }
  }
}

/** "Found a lucky clover! The clover patch is now in your catalog." */
export function foundMessage(kind, firstTime, count) {
  const c = COLLECTIBLES[kind];
  const item = DECOR[c.unlocks];
  return firstTime
    ? `Found a <b>${c.label.toLowerCase()}</b>! The ${item.label.toLowerCase()} is now in your catalog (Found).`
    : `Found another <b>${c.label.toLowerCase()}</b> · ${count} collected`;
}
