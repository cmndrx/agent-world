// The town square (phase 3): public spaces that open as neighborhood milestones are reached.
// Milestones come only from the human's decisions (shared/progression.mjs COMMONS): outcomes marked
// reached and tasks accepted with review notes. Locked spaces show what opens them.

import * as THREE from 'three';
import { CSS2DObject } from 'three/addons/renderers/CSS2DRenderer.js';
import { COMMONS, commonsHint } from '../../shared/progression.mjs';
import { buildDecor } from './decor.js';
import { LOT_W } from './lot.js';
import { PALETTE, box, cyl, ico, mergeStatic, softBox } from './models.js';
import { waterMaterial } from './fx.js';
import { NavGrid } from './nav.js';

/** Where each space sits (local x, z, half-width, half-depth). The street is at +z. */
const SPACES = {
  park: { x: -6.2, z: -4.2, w: 4.2, d: 4.4 },
  cafe: { x: 6.2, z: -4.2, w: 4.2, d: 4.4 },
  townhall: { x: 0, z: -7.2, w: 1.9, d: 2.2 },
  plaza: { x: 0, z: 3.4, w: 4.2, d: 3.4 },
};

export class Commons {
  constructor(scene) {
    this.group = new THREE.Group();
    this.group.position.set(-LOT_W, 0, 0);
    scene.add(this.group);
    this.key = null;
    this.obstacles = [];
    this.anim = { ducks: [], spray: [], glows: [] };
    this.labels = [];

    // Ground, paths and the entrance sign never change.
    const base = new THREE.Group();
    base.add(Object.assign(box(22, 0.1, 20, PALETTE.grassLot, 0, 0, 0), { castShadow: false }));
    base.add(Object.assign(box(2.2, 0.06, 13, PALETTE.sidewalk, 0, 0.08, 3.5), { castShadow: false }));
    base.add(Object.assign(box(18, 0.06, 1.6, PALETTE.sidewalk, 0, 0.08, -0.6), { castShadow: false }));
    mergeStatic(base);
    this.group.add(base);
    this.dynamic = new THREE.Group();
    this.group.add(this.dynamic);
    this.sign('Town square', 0, 2.2, 9.4, 'commons-title');
  }

  sign(text, x, y, z, cls = 'commons-sign') {
    const el = document.createElement('div');
    el.className = cls;
    el.textContent = text;
    const label = new CSS2DObject(el);
    label.position.set(x, y, z);
    this.group.add(label);
    return label;
  }

  /** Rebuild for the open spaces. `outcomes` sizes the trophy shelf. */
  set(openIds, outcomes = 0) {
    const key = `${openIds.join(',')}|${Math.min(outcomes, 10)}`;
    if (key === this.key) return;
    this.key = key;
    this.far = undefined; // re-apply the distance fade to the new signs
    for (const child of [...this.dynamic.children]) {
      this.dynamic.remove(child);
      child.traverse((o) => o.isMesh && o.geometry.dispose());
    }
    for (const l of this.labels) {
      this.group.remove(l);
      l.element.remove();
    }
    this.labels = [];
    this.obstacles = [];
    this.anim = { ducks: [], spray: [], glows: [] };
    this.nav = null;

    for (const c of COMMONS) {
      const s = SPACES[c.id];
      const g = new THREE.Group();
      g.position.set(s.x, 0, s.z);
      if (openIds.includes(c.id)) this[`build_${c.id}`](g, s, outcomes);
      else this.buildPlaceholder(g, s, c);
      const statics = new THREE.Group();
      for (const child of [...g.children]) if (!child.userData.dynamic) statics.add(child);
      mergeStatic(statics);
      g.add(statics);
      this.dynamic.add(g);
    }
  }

  block(s, x0, z0, x1, z1) {
    this.obstacles.push([s.x + x0, s.z + z0, s.x + x1, s.z + z1]);
  }

  buildPlaceholder(g, s, c) {
    // Dashed outline + a little sign saying what opens it.
    const color = 0xd8d0c0;
    for (let x = -s.w; x < s.w; x += 0.8) {
      g.add(box(0.5, 0.04, 0.08, color, x + 0.25, 0.06, -s.d));
      g.add(box(0.5, 0.04, 0.08, color, x + 0.25, 0.06, s.d));
    }
    for (let z = -s.d; z < s.d; z += 0.8) {
      g.add(box(0.08, 0.04, 0.5, color, -s.w, 0.06, z + 0.25));
      g.add(box(0.08, 0.04, 0.5, color, s.w, 0.06, z + 0.25));
    }
    g.add(box(0.08, 0.9, 0.08, PALETTE.wood, 0, 0.45, s.d - 0.6));
    g.add(box(0.9, 0.5, 0.05, PALETTE.woodLight, 0, 1.0, s.d - 0.6));
    const label = this.sign(`${c.name} · coming soon`, s.x, 1.9, s.z + s.d - 0.6, 'commons-sign locked');
    label.element.title = commonsHint(c);
    label.element.innerHTML = `<b>${c.name}</b><span>${commonsHint(c)}</span>`;
    this.labels.push(label);
  }

  build_park(g, s) {
    g.add(Object.assign(box(s.w * 2, 0.04, s.d * 2, 0x8fca70, 0, 0.06, 0), { castShadow: false }));
    for (const [x, z, kind] of [[-2.8, -2.6, 'tree_round'], [2.6, -2.8, 'tree_pine'], [-3, 2.6, 'tree_round']]) {
      const t = buildDecor(kind, 31 + x * 7).group;
      t.position.set(x, 0.05, z);
      g.add(t);
      this.block(s, x - 0.6, z - 0.6, x + 0.6, z + 0.6);
    }
    // Pond with ducks.
    const pond = cyl(1.4, 1.4, 0.05, 0x5ab4e6, 20, 0.6, 0.08, 0.2, { material: waterMaterial() });
    pond.castShadow = false;
    g.add(pond);
    g.add(cyl(1.5, 1.55, 0.06, 0xd8d2c6, 20, 0.6, 0.06, 0.2));
    this.block(s, -0.9, -1.3, 2.1, 1.7);
    for (let i = 0; i < 3; i++) {
      const duck = new THREE.Group();
      duck.add(ico(0.12, 0xffd166, 0, 0, 0, 1));
      duck.add(ico(0.07, 0xffd166, 0, 0.1, 0.09, 1));
      duck.add(cyl(0, 0.03, 0.06, 0xef8354, 6, 0, 0.09, 0.17));
      duck.children.at(-1).rotation.x = Math.PI / 2;
      duck.userData.dynamic = true;
      duck.userData.phase = i * 2.1;
      g.add(duck);
      this.anim.ducks.push({ duck, cx: s.x + 0.6, cz: s.z + 0.2 });
    }
    for (const [x, z, rot] of [[-1.2, 3.2, 0], [2.6, 3.2, 0]]) {
      const b = buildDecor('bench', 3).group;
      b.position.set(x, 0.05, z);
      b.rotation.y = rot;
      g.add(b);
      this.block(s, x - 0.8, z - 0.3, x + 0.8, z + 0.3);
    }
    const flowers = buildDecor('flower_patch', 9).group;
    flowers.position.set(-2.8, 0.05, 0.2);
    g.add(flowers);
    this.block(s, -3.4, -0.2, -2.2, 0.6);
    this.labels.push(this.sign('Park', s.x, 1.2, s.z + s.d - 0.2));
  }

  build_cafe(g, s) {
    // Little café with a striped awning and parasol tables.
    g.add(softBox(5, 2.6, 3, 0xf4e3c3, 0, 1.3, -2, 0.08));
    g.add(box(5.2, 0.12, 3.2, 0x8f5f3e, 0, 2.66, -2));
    for (let i = 0; i < 9; i++) {
      const stripe = box(0.56, 0.06, 1.2, i % 2 ? 0xffffff : 0xe63946, -2.24 + i * 0.56, 2.25, -0.2);
      stripe.rotation.x = 0.35;
      g.add(stripe);
    }
    g.add(box(1, 1.8, 0.06, 0x6b4a33, 0, 0.9, -0.48));
    const win = new THREE.Mesh(new THREE.BoxGeometry(2.6, 1, 0.04), new THREE.MeshStandardMaterial({ color: 0xffe2a8, emissive: 0xffc982, emissiveIntensity: 0.4 }));
    win.position.set(1.4, 1.3, -0.47);
    win.userData.dynamic = true;
    win.userData.nightGlow = 1.6;
    g.add(win);
    this.anim.glows.push(win);
    this.block(s, -2.6, -3.6, 2.6, -0.4);
    for (const [x, z, c] of [[-2.2, 1.6, 0xe63946], [0.4, 2.0, 0x4f86c6], [2.6, 1.4, 0xf2b134]]) {
      g.add(cyl(0.4, 0.4, 0.05, PALETTE.white, 12, x, 0.75, z));
      g.add(cyl(0.04, 0.05, 0.72, PALETTE.dark, 6, x, 0.38, z));
      g.add(cyl(0.03, 0.03, 1.8, PALETTE.metal, 6, x, 0.9, z));
      g.add(cyl(0, 0.85, 0.36, c, 8, x, 1.9, z));
      for (const side of [1, -1]) g.add(box(0.36, 0.06, 0.36, PALETTE.woodMid, x + side * 0.65, 0.45, z));
      this.block(s, x - 0.5, z - 0.5, x + 0.5, z + 0.5);
    }
    this.labels.push(this.sign('Café', s.x, 3.4, s.z - 0.4));
  }

  build_plaza(g, s) {
    const paving = cyl(3.3, 3.3, 0.05, 0xe9e0d2, 24, 0, 0.08, 0);
    paving.castShadow = false;
    g.add(paving);
    g.add(cyl(1.5, 1.6, 0.5, 0xd8d2c6, 20, 0, 0.25, 0));
    const water = cyl(1.35, 1.35, 0.02, 0x7fc4ec, 20, 0, 0.51, 0, { material: waterMaterial() });
    water.castShadow = false;
    g.add(water);
    g.add(cyl(0.2, 0.26, 1.2, 0xd8d2c6, 10, 0, 1.0, 0));
    g.add(cyl(0.7, 0.4, 0.18, 0xd8d2c6, 14, 0, 1.6, 0));
    g.add(cyl(0.1, 0.14, 0.5, 0xd8d2c6, 8, 0, 1.9, 0));
    this.block(s, -1.7, -1.7, 1.7, 1.7);
    const sprayMat = new THREE.MeshStandardMaterial({ color: 0xcfeeff, emissive: 0x9fd8ff, emissiveIntensity: 0.8, transparent: true, opacity: 0.8 });
    for (let i = 0; i < 18; i++) {
      const drop = new THREE.Mesh(new THREE.IcosahedronGeometry(0.04, 0), sprayMat);
      drop.userData.dynamic = true;
      drop.userData.phase = i / 18;
      drop.userData.angle = (i / 18) * Math.PI * 2;
      g.add(drop);
      this.anim.spray.push({ drop, cx: 0, cz: 0, y0: 2.15 });
    }
    for (const [x, z] of [[-2.8, 1.6], [2.8, 1.6], [-2.8, -1.6], [2.8, -1.6]]) {
      g.add(buildDecor('fern', 5).group.translateX(x).translateZ(z).translateY(0.05));
      this.block(s, x - 0.3, z - 0.3, x + 0.3, z + 0.3);
    }
    this.labels.push(this.sign('Plaza', s.x, 3.0, s.z));
  }

  build_townhall(g, s, outcomes) {
    g.add(box(4, 0.3, 3.2, 0xe9e3d5, 0, 0.15, 0));
    g.add(box(3.6, 2.2, 2.4, 0xf4efe6, 0, 1.4, -0.3));
    for (let i = 0; i < 4; i++) g.add(cyl(0.12, 0.14, 2.2, PALETTE.white, 8, -1.35 + i * 0.9, 1.4, 1.05));
    const roof = cyl(0, 2.4, 0.9, 0xb56576, 4, 0, 2.95, 0.1);
    roof.rotation.y = Math.PI / 4;
    roof.scale.set(1, 1, 0.8);
    g.add(roof);
    for (let i = 0; i < 3; i++) g.add(box(4.2 - i * 0.2, 0.1, 0.4, 0xe9e3d5, 0, 0.05 + i * 0.1, 1.7 - i * 0.2));
    // Trophy shelf: one cup per outcome reached across the neighborhood (up to 10).
    g.add(box(2.8, 0.08, 0.4, PALETTE.wood, 0, 0.95, 1.35));
    const cups = Math.min(outcomes, 10);
    for (let i = 0; i < cups; i++) {
      const x = -1.25 + (i % 10) * 0.28;
      g.add(cyl(0.07, 0.04, 0.14, 0xffd166, 8, x, 1.08, 1.35, { metalness: 0.6, roughness: 0.3 }));
      g.add(cyl(0.03, 0.05, 0.06, 0xffd166, 8, x, 1.0, 1.35, { metalness: 0.6, roughness: 0.3 }));
    }
    this.block(s, -2, -1.9, 2, 1.6);
    this.labels.push(this.sign(`Town hall · ${outcomes} outcome${outcomes === 1 ? '' : 's'} reached`, s.x, 3.9, s.z + 0.2));
  }

  getNav() {
    if (!this.nav) {
      this.nav = new NavGrid({ x0: -11, z0: -10, x1: 11, z1: 10 }, 0.25, 0.3);
      for (const r of this.obstacles) this.nav.addRect(r);
    }
    return this.nav;
  }

  /** Avatar collision in world coordinates (null when outside the square). */
  blockedAt(x, z) {
    const lx = x - this.group.position.x;
    const lz = z - this.group.position.z;
    const nav = this.getNav();
    if (!nav.inBounds(lx, lz)) return null;
    return !nav.walkable(lx, lz);
  }

  update(dt, t, night, focus = null) {
    // Space signs only read well up close; fade them when the camera is over another street.
    if (focus) {
      const far = Math.hypot(focus.x - this.group.position.x, focus.z - this.group.position.z) > 20;
      if (far !== this.far) {
        this.far = far;
        this.group.traverse((o) => o.isCSS2DObject && o.element.classList.contains('commons-sign') && o.element.classList.toggle('far', far));
      }
    }
    for (const { duck, cx, cz } of this.anim.ducks) {
      const a = t * 0.25 + duck.userData.phase;
      duck.position.set(cx - SPACES.park.x + Math.cos(a) * 0.9, 0.14 + Math.sin(t * 2 + a) * 0.01, cz - SPACES.park.z + Math.sin(a) * 0.9);
      duck.rotation.y = -a;
    }
    for (const { drop, y0 } of this.anim.spray) {
      const p = (t * 0.6 + drop.userData.phase) % 1;
      const r = p * 1.1;
      drop.position.set(Math.cos(drop.userData.angle) * r, y0 + p * 0.6 - p * p * 1.8, Math.sin(drop.userData.angle) * r);
    }
    for (const w of this.anim.glows) w.material.emissiveIntensity = 0.4 + night * w.userData.nightGlow;
  }
}
