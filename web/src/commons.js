// The town square (phase 3): public spaces that open as neighborhood milestones are reached.
// Milestones come only from the human's decisions (shared/progression.mjs COMMONS): outcomes marked
// reached and tasks accepted with review notes. Locked spaces show what opens them.

import * as THREE from 'three';
import { CSS2DObject } from 'three/addons/renderers/CSS2DRenderer.js';
import { COMMONS, commonsHint } from '../../shared/progression.mjs';
import { buildDecor } from './decor.js';
import { LOT_W } from './lot.js';
import { PALETTE, box, buildPerson, cyl, ico, mergeStatic, softBox } from './models.js';
import { waterMaterial } from './fx.js';
import { NavGrid } from './nav.js';

/** Where each space sits (local x, z, half-width, half-depth). The street is at +z. */
const SPACES = {
  park: { x: -11.2, z: -2.4, w: 5, d: 5.4 },
  cafe: { x: 11.2, z: -2.4, w: 5, d: 5.4 },
  townhall: { x: 0, z: -14, w: 6, d: 4.8 },
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
    this.doorOpen = false;
    this.roofOn = true;
    this.roofK = 1;
    this.roofV = 0;
    this.wallMode = 'cutaway';
    this.hovered = false;
    this.peek = false;

    // Ground, paths and the entrance sign never change.
    const base = new THREE.Group();
    base.add(Object.assign(box(36, 0.1, 31, PALETTE.grassLot, 0, 0, -5.5), { castShadow: false }));
    base.add(Object.assign(box(2.8, 0.06, 25, PALETTE.sidewalk, 0, 0.08, -2.5), { castShadow: false }));
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
      child.traverse((o) => o.isMesh && o.geometry.dispose());
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

    for (const c of COMMONS) {
      const s = SPACES[c.id];
      const g = new THREE.Group();
      g.position.set(s.x, 0, s.z);
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
    g.add(box(11.4, 0.24, 8.8, 0xd9ccad, 0, 0.12, -0.3));
    g.add(box(9.8, 0.22, 7.2, 0xbab09b, 0, 0.35, -0.3));
    for (const x of [-4.8, 4.8]) for (const z of [-3.8, 3.2]) g.add(box(0.2, 3.2, 0.2, PALETTE.wood, x, 1.75, z));
    for (const z of [-3.8, 3.2]) g.add(box(9.8, 0.18, 0.18, PALETTE.wood, 0, 3.4, z));
    for (const x of [-4.8, 4.8]) g.add(box(0.16, 0.16, 7, PALETTE.wood, x, 2.1, -0.3));
    g.add(box(2.4, 0.9, 1.4, 0xc88f57, -1.5, 0.7, 0.4));
    g.add(box(1.8, 0.65, 1.2, 0xe1b573, 1.8, 0.55, -1.4));
    // The crew is game ambience: never treated as observed agent activity.
    for (const [i, x, z] of [[0, -3.2, 3.45], [1, 3.2, 3.45], [2, 1.3, -1.6]]) {
      const worker = buildPerson({ skin: i ? 0x9c674d : 0xd7a47e, hair: 0x513e35, shirt: i ? 0x388b9a : 0xd17548, pants: 0x45505a, shoes: 0x524239, hairStyle: 0, top: 'long', build: 1 }, { scale: 0.95, hat: 0xf7ca4e });
      worker.head.add(box(0.52, 0.045, 0.22, 0xf7ca4e, 0, 0.39, 0.23));
      worker.root.position.set(x, 0.25, z);
      worker.root.userData.dynamic = true;
      g.add(worker.root);
      this.anim.builders.push({ parts: worker, x, z, phase: i * Math.PI });
    }
    const crane = new THREE.Group();
    crane.position.set(-5.25, 0.1, -3.7);
    crane.userData.dynamic = true;
    crane.add(box(0.32, 6.2, 0.32, 0xe3ac39, 0, 3.1, 0));
    const boom = new THREE.Group();
    boom.position.y = 6.2;
    boom.add(box(8.2, 0.22, 0.22, 0xf0c455, 2.2, 0, 0));
    boom.add(box(0.28, 0.28, 0.28, 0x715b46, 6, 0, 0));
    const hook = new THREE.Group();
    hook.position.x = 5.8;
    hook.add(box(0.045, 2, 0.045, 0x6c6861, 0, -1, 0));
    hook.add(box(0.7, 0.36, 0.56, 0xc99459, 0, -2.15, 0));
    boom.add(hook);
    crane.add(boom);
    g.add(crane);
    this.anim.cranes.push({ boom, hook });
    this.block(s, -5.5, -4.4, 5.5, 4.1);
    const label = this.sign('Town Hall · building', s.x, 4.2, s.z + 3, 'commons-sign construction-sign');
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
    const stone = 0xf0e6d1;
    const trim = 0xd2be97;
    const roofColor = 0x39746d;
    g.add(box(11.8, 0.3, 9.2, trim, 0, 0.15, -0.1));
    g.add(box(10.8, 0.05, 8.1, 0xc3ad86, 0, 0.33, -0.3));
    // Martin's office faces the entrance. The clear center aisle leads to his chair behind the desk.
    g.add(box(4.3, 0.04, 5.5, 0x69918a, 0, 0.39, 0.15));
    g.add(softBox(3.5, 0.18, 1.4, PALETTE.woodMid, 0, 1.13, -1.85, 0.07));
    g.add(box(3.55, 0.06, 1.42, 0x466965, 0, 1.24, -1.85));
    for (const x of [-1.45, 1.45]) g.add(box(0.38, 0.78, 1.2, PALETTE.wood, x, 0.7, -1.85));
    g.add(box(2.6, 0.72, 0.14, PALETTE.wood, 0, 0.75, -1.08));
    // Paper plans, desk lamp and a small town seal keep the desk legible from the cutaway view.
    g.add(box(0.75, 0.025, 0.48, 0xf5f0dc, -0.72, 1.29, -1.73));
    g.add(box(0.75, 0.025, 0.48, 0xf5f0dc, -0.58, 1.31, -1.83));
    g.add(cyl(0.14, 0.18, 0.08, 0xcba44e, 12, 1.16, 1.3, -2.08));
    g.add(cyl(0.045, 0.045, 0.5, 0xcba44e, 8, 1.16, 1.58, -2.08));
    g.add(cyl(0.34, 0.16, 0.24, 0xf1d58a, 12, 1.16, 1.95, -2.08));
    const chair = new THREE.Group();
    chair.position.set(0, 0, -3.05);
    chair.add(box(1.15, 0.16, 0.96, 0x455b58, 0, 0.64, 0));
    chair.add(box(1.15, 1.1, 0.18, 0x455b58, 0, 1.15, -0.43));
    for (const x of [-0.46, 0.46]) chair.add(box(0.11, 0.63, 0.11, PALETTE.wood, x, 0.32, 0.32));
    g.add(chair);
    for (const x of [-1.45, 1.45]) {
      g.add(box(0.94, 0.14, 0.9, 0x67877d, x, 0.61, 1.15));
      g.add(box(0.94, 0.94, 0.16, 0x67877d, x, 1.03, 1.55));
      for (const dx of [-0.36, 0.36]) g.add(box(0.1, 0.59, 0.1, PALETTE.wood, x + dx, 0.3, 1.48));
    }
    for (const x of [-4.2, 4.2]) {
      g.add(cyl(0.36, 0.28, 0.48, 0xc19368, 10, x, 0.6, 2.45));
      g.add(ico(0.56, 0x4d8b69, x, 1.15, 2.45, 1));
    }
    g.add(box(3.8, 1.6, 0.34, PALETTE.wood, 3.1, 1.3, -3.72));
    for (const y of [0.85, 1.42, 2]) g.add(box(3.7, 0.08, 0.5, PALETTE.woodLight, 3.1, y, -3.48));
    g.add(box(2.9, 0.1, 0.5, PALETTE.wood, 3.1, 2.2, -3.48));
    const cups = Math.min(outcomes, 10);
    for (let i = 0; i < cups; i++) {
      const x = 1.48 + i * 0.36;
      g.add(cyl(0.09, 0.05, 0.19, 0xffd166, 8, x, 2.33, -3.48, { metalness: 0.6, roughness: 0.3 }));
      g.add(cyl(0.04, 0.06, 0.08, 0xffd166, 8, x, 2.22, -3.48, { metalness: 0.6, roughness: 0.3 }));
    }
    const walls = [
      { normal: [0, 0, 1], z: 3.7, x: 0, w: 10.8, d: 0.28 },
      { normal: [0, 0, -1], z: -4.3, x: 0, w: 10.8, d: 0.28 },
      { normal: [-1, 0, 0], z: -0.3, x: -5.4, w: 0.28, d: 8 },
      { normal: [1, 0, 0], z: -0.3, x: 5.4, w: 0.28, d: 8 },
    ];
    for (const side of walls) {
      const wall = new THREE.Group();
      wall.position.set(side.x, 0.3, side.z);
      wall.userData.dynamic = true;
      wall.userData.normal = new THREE.Vector3(...side.normal);
      wall.userData.scale = 1;
      wall.userData.windows = [];
      if (side.normal[2] === 1) {
        for (const x of [-3.15, 3.15]) wall.add(box(4.5, 3.7, side.d, stone, x, 1.85, 0));
        wall.add(box(1.8, 1.05, side.d, stone, 0, 3.18, 0));
      } else wall.add(box(side.w, 3.7, side.d, stone, 0, 1.85, 0));
      wall.add(box(side.w + 0.1, 0.18, side.d + 0.1, trim, 0, 0.2, 0));
      wall.add(box(side.w + 0.16, 0.2, side.d + 0.16, trim, 0, 3.55, 0));
      if (side.normal[2]) {
        for (const x of [-3.5, -1.75, 1.75, 3.5]) {
          const win = box(0.78, 1.65, 0.035, 0x9dc8c4, x, 2, side.normal[2] * (side.d / 2 + 0.03));
          win.material.emissive = new THREE.Color(0xffd89b);
          win.material.emissiveIntensity = 0.1;
          win.userData.nightGlow = 0.65;
          wall.add(win);
          wall.userData.windows.push(win);
          this.anim.glows.push(win);
          wall.add(box(0.1, 1.7, 0.06, trim, x, 2, side.normal[2] * (side.d / 2 + 0.08)));
        }
      } else {
        for (const z of [-2.5, 1.8]) {
          const win = box(0.035, 1.65, 1.1, 0x9dc8c4, side.normal[0] * (side.w / 2 + 0.03), 2, z);
          wall.add(win);
          wall.userData.windows.push(win);
        }
      }
      g.add(wall);
      this.hallWalls.push(wall);
    }
    // The entry moves with the front wall when the office opens for viewing.
    const frontWall = this.hallWalls[0];
    for (let i = 0; i < 3; i++) g.add(box(5.7 - i * 0.25, 0.13, 1.9 - i * 0.35, trim, 0, 0.07 + i * 0.13, 5.1 - i * 0.23));
    for (const x of [-2.25, 2.25]) {
      frontWall.add(cyl(0.19, 0.21, 3.15, stone, 10, x, 1.5, 0.85));
      frontWall.add(box(0.54, 0.22, 0.54, trim, x, 3.12, 0.85));
    }
    frontWall.add(box(5.35, 0.28, 1.5, trim, 0, 3.34, 0.65));
    for (const sign of [-1, 1]) {
      const hinge = new THREE.Group();
      hinge.position.set(sign * 0.87, 0, 0.21);
      hinge.userData.dynamic = true;
      hinge.add(box(0.82, 2.55, 0.09, 0x395f58, -sign * 0.41, 1.28, 0));
      hinge.add(ico(0.08, 0xe7b952, -sign * 0.16, 1.22, 0.08, 1));
      frontWall.add(hinge);
      this.hallDoors.push({ hinge, sign });
    }
    const roof = new THREE.Group();
    roof.position.y = 4;
    roof.userData.dynamic = true;
    for (const sign of [-1, 1]) {
      const slope = box(6.25, 0.22, 8.7, roofColor, sign * 2.65, 1.05, -0.3);
      slope.rotation.z = -sign * 0.38;
      roof.add(slope);
    }
    const pedimentShape = new THREE.Shape();
    pedimentShape.moveTo(-5.2, 0);
    pedimentShape.lineTo(5.2, 0);
    pedimentShape.lineTo(0, 1.95);
    pedimentShape.closePath();
    const pediment = new THREE.Mesh(new THREE.ShapeGeometry(pedimentShape), new THREE.MeshStandardMaterial({ color: stone, side: THREE.DoubleSide }));
    pediment.position.set(0, 0, 4.08);
    roof.add(pediment);
    roof.add(ico(0.33, 0xe7b952, 0, 0.67, 4.15, 1));
    roof.add(box(0.35, 0.26, 9, 0x294e4b, 0, 2.05, -0.3));
    roof.add(box(2, 1.25, 1.9, stone, 0, 2.7, 0.15));
    roof.add(cyl(0, 1.36, 1.25, roofColor, 4, 0, 3.95, 0.15));
    roof.add(box(0.18, 0.45, 0.18, 0xe7b952, 0, 4.72, 0.15));
    const clock = cyl(0.52, 0.52, 0.08, 0xfaf0ce, 24, 0, 2.77, 1.15);
    clock.rotation.x = Math.PI / 2;
    roof.add(clock);
    roof.add(box(0.055, 0.32, 0.045, 0x344440, 0, 2.84, 1.21));
    roof.add(box(0.26, 0.055, 0.045, 0x344440, 0.12, 2.77, 1.21));
    g.add(roof);
    this.hallRoof = roof;
    this.block(s, -5.5, -4.5, 5.5, 4.6);
    this.labels.push(this.sign(outcomes ? `Town Hall · ${outcomes} outcome${outcomes === 1 ? '' : 's'} reached` : 'Town Hall', s.x, 5.2, s.z + 4.1));
  }

  getNav() {
    if (!this.nav) {
      this.nav = new NavGrid({ x0: -18, z0: -21, x1: 18, z1: 10 }, 0.25, 0.3);
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
    const x = point.x - this.group.position.x - s.x;
    const z = point.z - this.group.position.z - s.z;
    return Math.abs(x) < s.w && Math.abs(z) < s.d + 0.8;
  }

  update(dt, t, night, focus = null, camera = null) {
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
    for (const { parts, x, z, phase } of this.anim.builders) {
      const step = Math.sin(t * 2.4 + phase);
      parts.root.position.x = x + Math.sin(t * 0.8 + phase) * 0.22;
      parts.root.position.z = z + Math.cos(t * 0.8 + phase) * 0.18;
      parts.body.position.y = Math.abs(step) * 0.06;
      parts.armL.rotation.x = -0.35 + step * 0.45;
      parts.armR.rotation.x = -0.35 - step * 0.45;
      parts.legL.rotation.x = step * 0.35;
      parts.legR.rotation.x = -step * 0.35;
      parts.head.rotation.y = Math.sin(t + phase) * 0.18;
    }
    for (const { boom, hook } of this.anim.cranes) {
      boom.rotation.y = Math.sin(t * 0.45) * 0.35;
      hook.position.y = Math.sin(t * 1.5) * 0.18;
    }
    if (this.hallRoof && camera) {
      for (const { hinge, sign } of this.hallDoors) hinge.rotation.y += ((this.doorOpen ? -sign * 1.15 : 0) - hinge.rotation.y) * (1 - Math.exp(-dt * 5));
      const center = new THREE.Vector3(this.group.position.x + SPACES.townhall.x, 0, this.group.position.z + SPACES.townhall.z);
      const camDist = camera.position.distanceTo(center);
      const openBelow = this.peek ? 76 : 48;
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
      this.hallRoof.position.y = 4 + (1 - Math.min(k, 1)) * 5 + this.hoverK * 0.45 * Math.min(k, 1);
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
    for (const w of this.anim.glows) w.material.emissiveIntensity = 0.4 + night * w.userData.nightGlow;
  }
}
