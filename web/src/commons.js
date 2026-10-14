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
import { Crew } from './crew.js';
import { HALL, buildTownHall } from './town-hall.js';

/** Where each space sits (local x, z, half-width, half-depth). The street is at +z. */
const SPACES = {
  park: { x: -11.2, z: -2.4, w: 5, d: 5.4 },
  cafe: { x: 11.2, z: -2.4, w: 5, d: 5.4 },
  // The Town Hall (town-hall.js): its footprint is centred a little behind HALL.z (the steps reach forward).
  townhall: { x: HALL.x, z: HALL.z + (HALL.front - HALL.back) / 2, w: HALL.w, d: (HALL.front + HALL.back) / 2 },
  plaza: { x: 0, z: 3.5, w: 5, d: 4.2 },
};

export class Commons {
  constructor(scene) {
    this.group = new THREE.Group();
    this.group.position.set(-LOT_W - 6, 0, 0);
    scene.add(this.group);
    this.key = null;
    this.obstacles = [];
    this.anim = { ducks: [], spray: [], glows: [], builders: [], cranes: [] };
    this.labels = [];
    this.lastCountdown = null;
    this.hallRoof = null;
    this.hallWalls = [];
    this.hallDoors = [];
    this.hallPartitions = null;
    this.doorOpen = false;
    this.roofOn = true;
    this.roofK = 1;
    this.roofV = 0;
    this.wallMode = 'cutaway';
    this.hovered = false;
    this.peek = false;

    // Ground, paths and the entrance sign never change.
    const base = new THREE.Group();
    // The lawn reaches back behind the Town Hall; the path runs from the street to the hall's forecourt.
    base.add(Object.assign(box(40, 0.1, 38, PALETTE.grassLot, 0, 0, -9), { castShadow: false }));
    base.add(Object.assign(box(2.8, 0.06, 17, PALETTE.sidewalk, 0, 0.08, 1.5), { castShadow: false }));
    base.add(Object.assign(box(32, 0.06, 1.8, PALETTE.sidewalk, 0, 0.08, -0.5), { castShadow: false }));
    mergeStatic(base);
    this.group.add(base);
    this.dynamic = new THREE.Group();
    this.group.add(this.dynamic);
    this.sign('Town square', 0, 2.2, 9.2, 'commons-title');
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
  set(openIds, outcomes = 0, townhall = 'empty', readyAt = null) {
    this.readyAt = readyAt;
    const key = `${openIds.join(',')}|${Math.min(outcomes, 10)}|${townhall}`;
    if (key === this.key) return;
    this.key = key;
    this.far = undefined; // re-apply the distance fade to the new signs
    for (const child of [...this.dynamic.children]) {
      this.dynamic.remove(child);
      child.traverse((o) => {
        if (!o.isMesh) return;
        o.geometry.dispose();
        if (o.userData.ownMaterial || o.material?.userData?.ownMaterial) o.material.dispose();
      });
    }
    for (const l of this.labels) {
      this.group.remove(l);
      l.element.remove();
    }
    this.labels = [];
    this.lastCountdown = null;
    this.obstacles = [];
    this.anim = { ducks: [], spray: [], glows: [], builders: [], cranes: [] };
    this.nav = null;
    this.hallRoof = null;
    this.hallWalls = [];
    this.hallDoors = [];
    this.hallPartitions = null;

    for (const c of COMMONS) {
      const s = SPACES[c.id];
      const g = new THREE.Group();
      const hallBuilt = c.id === 'townhall' && (townhall === 'building' || openIds.includes(c.id));
      g.position.set(s.x, 0, hallBuilt ? HALL.z : s.z);
      if (c.id === 'townhall' && townhall === 'building') this.build_townhall_site(g, s);
      else if (openIds.includes(c.id)) this[`build_${c.id}`](g, s, outcomes);
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

  build_townhall_site(g, s) {
    // Foundations and scaffolding on the hall's footprint (hall-local, like build_townhall).
    g.add(box(27.4, 0.24, 14.6, 0xd9ccad, 0, 0.12, 0));
    g.add(box(18.4, 0.22, 13.8, 0xbab09b, 0, 0.35, 0));
    for (const sx of [-1, 1]) g.add(box(4.2, 0.2, 9.2, 0xbab09b, sx * 11.0, 0.34, -0.45));
    for (const x of [-9, -4.5, 0, 4.5, 9]) for (const z of [-6.9, 6.9]) g.add(box(0.2, 4.4, 0.2, PALETTE.wood, x, 2.3, z));
    for (const z of [-6.9, 6.9]) for (const y of [1.6, 3.2, 4.4]) g.add(box(18.2, 0.16, 0.16, PALETTE.wood, 0, y, z));
    for (const x of [-9, 9]) for (const y of [1.6, 3.2, 4.4]) g.add(box(0.16, 0.16, 13.8, PALETTE.wood, x, y, 0));
    for (const z of [-6.9, 6.9]) g.add(box(18.2, 0.08, 0.9, 0xc9a26d, 0, 3.25, z + (z < 0 ? -0.5 : 0.5)));
    g.add(box(2.4, 0.9, 1.4, 0xc88f57, -4.5, 0.7, 3.0));
    g.add(box(1.8, 0.65, 1.2, 0xe1b573, 5.0, 0.55, -2.4));
    g.add(cyl(1.2, 1.2, 1.2, 0xe9e0d2, 16, 0, 1.0, 0.7));
    // The crew is game ambience: never treated as observed agent activity (crew.js).
    const before = new Set(g.children);
    this.crew = new Crew(g);
    for (const child of g.children) if (!before.has(child) && (child.isGroup || child.userData.animated)) child.userData.dynamic = true;
    for (const m of this.crew.members) m.parts.root.userData.dynamic = true;
    this.anim.builders.push(this.crew);
    const crane = new THREE.Group();
    crane.position.set(-10.2, 0.1, -6.2);
    crane.userData.dynamic = true;
    crane.add(box(0.36, 9.0, 0.36, 0xe3ac39, 0, 4.5, 0));
    const boom = new THREE.Group();
    boom.position.y = 9.0;
    boom.add(box(12.0, 0.24, 0.24, 0xf0c455, 3.6, 0, 0));
    boom.add(box(0.32, 0.32, 0.32, 0x715b46, 9.2, 0, 0));
    const hook = new THREE.Group();
    hook.position.x = 9.0;
    hook.add(box(0.045, 3, 0.045, 0x6c6861, 0, -1.5, 0));
    hook.add(box(0.8, 0.4, 0.6, 0xc99459, 0, -3.2, 0));
    boom.add(hook);
    crane.add(boom);
    g.add(crane);
    this.anim.cranes.push({ boom, hook });
    this.block({ x: HALL.x, z: HALL.z }, -HALL.w, -HALL.back, HALL.w, HALL.front);
    const label = this.sign('Town Hall · building', HALL.x, 6.0, HALL.z + 7.5, 'commons-sign construction-sign');
    label.element.innerHTML = '<button type="button" data-townhall-detail><b>Town Hall</b><span data-build-countdown>Building…</span></button>';
    this.labels.push(label);
  }

  build_park(g, s) {
    g.add(Object.assign(box(s.w * 2, 0.04, s.d * 2, 0x8fca70, 0, 0.06, 0), { castShadow: false }));
    for (const [x, z, kind] of [[-4, -3.7, 'tree_round'], [3.8, -3.8, 'tree_pine'], [-4, 3.6, 'tree_round'], [3.8, 3.5, 'tree_round']]) {
      const t = buildDecor(kind, 31 + x * 7).group;
      t.position.set(x, 0.05, z);
      g.add(t);
      this.block(s, x - 0.6, z - 0.6, x + 0.6, z + 0.6);
    }
    // Pond with ducks.
    const pond = cyl(2, 2, 0.05, 0x5ab4e6, 20, 0.5, 0.08, 0, { material: waterMaterial() });
    pond.castShadow = false;
    g.add(pond);
    g.add(cyl(2.15, 2.2, 0.06, 0xd8d2c6, 20, 0.5, 0.06, 0));
    this.block(s, -1.7, -2.2, 2.7, 2.2);
    for (let i = 0; i < 3; i++) {
      const duck = new THREE.Group();
      duck.add(ico(0.12, 0xffd166, 0, 0, 0, 1));
      duck.add(ico(0.07, 0xffd166, 0, 0.1, 0.09, 1));
      duck.add(cyl(0, 0.03, 0.06, 0xef8354, 6, 0, 0.09, 0.17));
      duck.children.at(-1).rotation.x = Math.PI / 2;
      duck.userData.dynamic = true;
      duck.userData.phase = i * 2.1;
      g.add(duck);
      this.anim.ducks.push({ duck, cx: s.x + 0.5, cz: s.z });
    }
    for (const [x, z, rot] of [[-2.5, 4.3, 0], [2.5, 4.3, 0], [-3, -1, Math.PI / 2]]) {
      const b = buildDecor('bench', 3).group;
      b.position.set(x, 0.05, z);
      b.rotation.y = rot;
      g.add(b);
      this.block(s, x - 0.8, z - 0.3, x + 0.8, z + 0.3);
    }
    const flowers = buildDecor('flower_patch', 9).group;
    flowers.position.set(-3.6, 0.05, 1.6);
    g.add(flowers);
    this.block(s, -4.2, 1.2, -3, 2);
    this.labels.push(this.sign('Park', s.x, 1.2, s.z + s.d - 0.2));
  }

  build_cafe(g, s) {
    g.add(softBox(8.2, 3.7, 4.6, 0xf4e3c3, 0, 1.85, -2.5, 0.08));
    g.add(box(8.5, 0.22, 4.9, 0x8f5f3e, 0, 3.81, -2.5));
    for (let i = 0; i < 12; i++) {
      const stripe = box(0.68, 0.09, 1.5, i % 2 ? 0xffffff : 0xe63946, -3.75 + i * 0.68, 3.05, 0.55);
      stripe.rotation.x = 0.35;
      g.add(stripe);
    }
    g.add(box(1.5, 2.5, 0.06, 0x6b4a33, -1.1, 1.25, -0.17));
    const win = new THREE.Mesh(new THREE.BoxGeometry(3.6, 1.6, 0.04), new THREE.MeshStandardMaterial({ color: 0xffe2a8, emissive: 0xffc982, emissiveIntensity: 0.4 }));
    win.position.set(1.65, 1.8, -0.16);
    win.userData.dynamic = true;
    win.userData.nightGlow = 1.6;
    g.add(win);
    this.anim.glows.push(win);
    this.block(s, -4.3, -4.9, 4.3, -0.1);
    for (const [x, z, c] of [[-3.3, 2.2, 0xe63946], [0, 2.6, 0x4f86c6], [3.3, 2.2, 0xf2b134]]) {
      g.add(cyl(0.4, 0.4, 0.05, PALETTE.white, 12, x, 0.75, z));
      g.add(cyl(0.04, 0.05, 0.72, PALETTE.dark, 6, x, 0.38, z));
      g.add(cyl(0.03, 0.03, 1.8, PALETTE.metal, 6, x, 0.9, z));
      g.add(cyl(0, 0.85, 0.36, c, 8, x, 1.9, z));
      for (const side of [1, -1]) g.add(box(0.36, 0.06, 0.36, PALETTE.woodMid, x + side * 0.65, 0.45, z));
      this.block(s, x - 0.5, z - 0.5, x + 0.5, z + 0.5);
    }
    this.labels.push(this.sign('Café', s.x, 4.5, s.z - 1));
  }

  build_plaza(g, s) {
    const paving = cyl(4.1, 4.1, 0.05, 0xe9e0d2, 24, 0, 0.08, 0);
    paving.castShadow = false;
    g.add(paving);
    g.add(cyl(2.05, 2.2, 0.55, 0xd8d2c6, 20, 0, 0.28, 0));
    const water = cyl(1.9, 1.9, 0.02, 0x7fc4ec, 20, 0, 0.57, 0, { material: waterMaterial() });
    water.castShadow = false;
    g.add(water);
    g.add(cyl(0.2, 0.26, 1.2, 0xd8d2c6, 10, 0, 1.0, 0));
    g.add(cyl(0.7, 0.4, 0.18, 0xd8d2c6, 14, 0, 1.6, 0));
    g.add(cyl(0.1, 0.14, 0.5, 0xd8d2c6, 8, 0, 1.9, 0));
    this.block(s, -2.3, -2.3, 2.3, 2.3);
    const sprayMat = new THREE.MeshStandardMaterial({ color: 0xcfeeff, emissive: 0x9fd8ff, emissiveIntensity: 0.8, transparent: true, opacity: 0.8 });
    for (let i = 0; i < 18; i++) {
      const drop = new THREE.Mesh(new THREE.IcosahedronGeometry(0.04, 0), sprayMat);
      drop.userData.dynamic = true;
      drop.userData.phase = i / 18;
      drop.userData.angle = (i / 18) * Math.PI * 2;
      g.add(drop);
      this.anim.spray.push({ drop, cx: 0, cz: 0, y0: 2.15 });
    }
    for (const [x, z] of [[-3.7, 2.8], [3.7, 2.8], [-3.7, -2.8], [3.7, -2.8]]) {
      g.add(buildDecor('fern', 5).group.translateX(x).translateZ(z).translateY(0.05));
      this.block(s, x - 0.3, z - 0.3, x + 0.3, z + 0.3);
    }
    this.labels.push(this.sign('Plaza', s.x, 3.2, s.z));
  }

  build_townhall(g, s, outcomes) {
    const hall = buildTownHall(g, { outcomes });
    this.hallWalls = hall.walls;
    this.hallDoors = hall.doors;
    this.hallRoof = hall.roof;
    this.hallRoofBase = hall.roofBase;
    this.hallPartitions = hall.partitions;
    for (const m of hall.glows) this.anim.glows.push(m);
    for (const [x0, z0, x1, z1] of hall.obstacles) this.block({ x: HALL.x, z: HALL.z }, x0, z0, x1, z1);
    this.labels.push(this.sign(outcomes ? `Town Hall · ${outcomes} outcome${outcomes === 1 ? '' : 's'} reached` : 'Town Hall', HALL.x, 9.4, HALL.z + 9.6));
  }

  /** Where to look at the Town Hall from (world coordinates): the middle of the building. */
  hallFocus() {
    return new THREE.Vector3(this.group.position.x + HALL.x, 0.12, this.group.position.z + HALL.z + 1.5);
  }

  getNav() {
    if (!this.nav) {
      this.nav = new NavGrid({ x0: -20, z0: -28, x1: 20, z1: 10 }, 0.25, 0.3);
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

  containsTownHall(point) {
    if (!point) return false;
    const s = SPACES.townhall;
    const x = point.x - this.group.position.x - HALL.x;
    const z = point.z - this.group.position.z - HALL.z;
    return Math.abs(x) < s.w && z > -HALL.back - 0.6 && z < HALL.front + 0.6;
  }

  update(dt, t, night, focus = null, camera = null, peekOpen = 76) {
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
      duck.position.set(cx - SPACES.park.x + Math.cos(a) * 1.3, 0.14 + Math.sin(t * 2 + a) * 0.01, cz - SPACES.park.z + Math.sin(a) * 1.3);
      duck.rotation.y = -a;
    }
    for (const { drop, y0 } of this.anim.spray) {
      const p = (t * 0.6 + drop.userData.phase) % 1;
      const r = p * 1.1;
      drop.position.set(Math.cos(drop.userData.angle) * r, y0 + p * 0.6 - p * p * 1.8, Math.sin(drop.userData.angle) * r);
    }
    for (const crew of this.anim.builders) crew.update(dt, t);
    for (const { boom, hook } of this.anim.cranes) {
      // A slow lift cycle: swing out, lower the load, raise it, swing back, with eased holds.
      const c = (t % 16) / 16;
      const swing = c < 0.25 ? 0.35 * Math.sin(c / 0.25 * Math.PI / 2) : c < 0.5 ? 0.35 : c < 0.75 ? 0.35 * Math.cos((c - 0.5) / 0.25 * Math.PI / 2) : 0;
      boom.rotation.y = -0.35 + swing * 2;
      const drop = c >= 0.25 && c < 0.5 ? Math.sin((c - 0.25) / 0.25 * Math.PI) : 0;
      hook.position.y = -drop * 1.4 + Math.sin(t * 1.1) * 0.04;
    }
    if (this.hallRoof && camera) {
      for (const { hinge, sign } of this.hallDoors) hinge.rotation.y += ((this.doorOpen ? -sign * 1.15 : 0) - hinge.rotation.y) * (1 - Math.exp(-dt * 5));
      const center = new THREE.Vector3(this.group.position.x + HALL.x, 0, this.group.position.z + HALL.z);
      const camDist = camera.position.distanceTo(center);
      // Zoomed all the way out, even the Town Hall you're centred on shows its dome (like the homes).
      const openBelow = this.peek ? Math.max(48, peekOpen) : 48;
      if (this.wallMode === 'down') this.roofOn = false;
      else if (this.roofOn && camDist < openBelow) this.roofOn = false;
      else if (!this.roofOn && camDist > openBelow + 8) this.roofOn = true;
      const target = this.roofOn ? 1 : 0;
      this.roofV += ((target - this.roofK) * 70 - this.roofV * 11) * dt;
      this.roofK += this.roofV * dt;
      if (Math.abs(target - this.roofK) < 0.001 && Math.abs(this.roofV) < 0.01) this.roofK = target;
      this.hoverK = (this.hoverK || 0) + ((this.hovered ? 1 : 0) - (this.hoverK || 0)) * (1 - Math.exp(-dt * 10));
      const k = THREE.MathUtils.clamp(this.roofK, 0, 1.08);
      this.hallRoof.visible = k > 0.01;
      this.hallRoof.position.y = this.hallRoofBase + (1 - Math.min(k, 1)) * 9 + this.hoverK * 0.45 * Math.min(k, 1);
      this.hallRoof.scale.setScalar(0.55 + 0.45 * k);
      const toCam = camera.position.clone().sub(center).setY(0).normalize();
      for (const wall of this.hallWalls) {
        let wallTarget = 1;
        if (this.roofK <= 0.3) {
          if (this.wallMode === 'down' || (this.wallMode === 'cutaway' && wall.userData.normal.dot(toCam) > 0.15)) wallTarget = 0.13;
        }
        wall.userData.scale += (wallTarget - wall.userData.scale) * (1 - Math.exp(-dt * 7));
        wall.scale.y = wall.userData.scale;
        for (const win of wall.userData.windows) win.visible = wall.userData.scale > 0.75;
      }
      // Interior partitions drop to a low stub while the hall is open, so every room reads from above.
      const p = this.hallPartitions;
      if (p) {
        const pt = this.roofK > 0.3 || this.wallMode === 'up' ? 1 : 0.18;
        p.userData.scale += (pt - p.userData.scale) * (1 - Math.exp(-dt * 7));
        p.scale.y = p.userData.scale;
      }
    }
    if (this.readyAt && this.anim.builders.length) {
      const sec = Math.max(0, Math.ceil((Date.parse(this.readyAt) - Date.now()) / 1000));
      if (sec !== this.lastCountdown) {
        this.lastCountdown = sec;
        const display = sec >= 3600 ? `${Math.floor(sec / 3600)}h ${String(Math.floor(sec % 3600 / 60)).padStart(2, '0')}m` : `${Math.floor(sec / 60)}:${String(sec % 60).padStart(2, '0')}`;
        const el = this.labels.find(l => l.element.classList.contains('construction-sign'))?.element;
        const timer = el?.querySelector('[data-build-countdown]');
        if (timer) timer.textContent = `Ready in ${display}`;
        if (el) el.title = `Town Hall construction · ${display} remaining · open details`;
      }
    }
    for (const w of this.anim.glows) w.material.emissiveIntensity = (w.material.userData.dayGlow ?? w.userData.dayGlow ?? 0.4) + night * w.userData.nightGlow;
  }
}
