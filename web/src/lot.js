// A lot is one project's house: a room with Sims-style cutaway walls, furniture, and the
// "stations" Sims use. All coordinates are lot-local. The room spans x -7..7, z -5..5; the street is at +z.

import * as THREE from 'three';
import { CSS2DObject } from 'three/addons/renderers/CSS2DRenderer.js';
import {
  buildBookshelf, buildChair, buildCoffeeBar, buildCouch, buildDesk, buildFloorLamp, buildGlobe,
  buildRack, buildRug, buildSideTable, buildWallArt, buildWhiteboard,
} from './furniture.js';
import { EXTERIORS, INTERIORS, PALETTE, box, buildBush, buildPlant, buildTree, cyl, glassTexture, ico, mergeStatic, rng, softBox } from './models.js';
import { NavGrid } from './nav.js';
import { Screen } from './screens.js';

export const LOT_W = 26;
export const LOT_D = 24;
export const DOOR_HALF = 0.9;

const WALL_H = 2.7;
const CUT_SCALE = 0.13;

const FACE_FRONT = 0;
const FACE_BACK = Math.PI;
const FACE_LEFT = -Math.PI / 2;
const FACE_RIGHT = Math.PI / 2;

const spot = (x, z, face) => ({ x, z, face });

export class Lot {
  constructor(household, index, seed) {
    this.project = household.project;
    this.index = index;
    this.seed = seed;
    this.r = rng(seed);
    this.group = new THREE.Group();
    const col = index % 3;
    const row = Math.floor(index / 3);
    this.group.position.set(col * LOT_W, 0, row * LOT_D);
    this.exterior = EXTERIORS[seed % EXTERIORS.length];
    this.interior = INTERIORS[(seed >>> 3) % INTERIORS.length];

    this.static = new THREE.Group(); // merged after building
    this.group.add(this.static);
    this.desks = [];
    this.walls = [];
    this.nightGlows = [];
    this.globeSpin = 0;
    this.coffeeBusy = 0;
    this.obstacles = [];
    this.wallMode = 'cutaway';

    this.buildGround();
    this.buildRoom();
    this.buildFurniture();
    this.buildSign(household);
    this.ensureDesks(Math.max(2, household.characters.length));
    mergeStatic(this.static);

    // Warm interior light for evenings; intensity follows the time of day.
    this.lamp = new THREE.PointLight(0xffc98a, 0, 16, 1.6);
    this.lamp.position.set(0, 2.6, 0.5);
    this.group.add(this.lamp);
  }

  add(obj) {
    this.static.add(obj);
    return obj;
  }

  block(x0, z0, x1, z1) {
    this.obstacles.push([x0, z0, x1, z1]);
    this.nav = null;
  }

  /** Navigation grid over the lot, rebuilt lazily when furniture changes. */
  getNav() {
    if (!this.nav) {
      this.nav = new NavGrid({ x0: -11, z0: -5, x1: 11, z1: 11.5 }, 0.25, 0.25);
      for (const r of this.obstacles) this.nav.addRect(r);
    }
    return this.nav;
  }

  // ---- Outside ------------------------------------------------------------------------

  buildGround() {
    const r = this.r;
    const grass = box(22, 0.1, 20, PALETTE.grassLot, 0, 0, 0);
    grass.castShadow = false;
    this.add(grass);

    // Stepping-stone path from the sidewalk to the door.
    for (let i = 0; i < 5; i++) {
      const s = softBox(1.3 + r() * 0.2, 0.06, 0.75, PALETTE.sidewalk, (r() - 0.5) * 0.15, 0.08, 5.9 + i * 0.95, 0.15);
      s.rotation.y = (r() - 0.5) * 0.15;
      s.castShadow = false;
      this.add(s);
    }

    // Picket fence around the plot, open at the path.
    const fence = (x0, z0, x1, z1) => {
      const len = Math.hypot(x1 - x0, z1 - z0);
      const n = Math.floor(len / 0.45);
      for (let k = 0; k <= n; k++) {
        const t = k / n;
        const post = box(0.08, 0.62, 0.08, PALETTE.trim, x0 + (x1 - x0) * t, 0.31, z0 + (z1 - z0) * t);
        this.add(post);
      }
      const rail = box(Math.abs(x1 - x0) || 0.05, 0.06, Math.abs(z1 - z0) || 0.05, PALETTE.trim, (x0 + x1) / 2, 0.42, (z0 + z1) / 2);
      this.add(rail);
      this.block(Math.min(x0, x1) - 0.05, Math.min(z0, z1) - 0.05, Math.max(x0, x1) + 0.05, Math.max(z0, z1) + 0.05);
    };
    fence(-10.8, 9.8, -1.2, 9.8);
    fence(1.2, 9.8, 10.8, 9.8);
    fence(-10.8, -9.6, -10.8, 9.8);
    fence(10.8, -9.6, 10.8, 9.8);

    // Flower beds under the front windows.
    for (const side of [-1, 1]) {
      const cx = side * 4.2;
      const bed = box(3.2, 0.14, 0.7, 0x6b4a33, cx, 0.08, 5.75);
      bed.castShadow = false;
      this.add(bed);
      for (let k = 0; k < 9; k++) {
        const fx = cx - 1.4 + k * 0.35 + (r() - 0.5) * 0.1;
        const fz = 5.75 + (r() - 0.5) * 0.4;
        this.add(cyl(0.015, 0.015, 0.25, PALETTE.leafDark, 4, fx, 0.25, fz));
        this.add(ico(0.08, PALETTE.flowers[Math.floor(r() * PALETTE.flowers.length)], fx, 0.4, fz));
      }
      this.block(cx - 1.6, 5.4, cx + 1.6, 6.1);
    }

    for (const [x, z, sc] of [[-9.4, 7.8, 1.1], [9.3, 8.0, 0.95], [-9.6, 2.5, 0.8], [9.6, -2, 0.85]]) {
      this.add(buildBush(x, z, sc));
      this.block(x - 0.5 * sc, z - 0.5 * sc, x + 0.5 * sc, z + 0.5 * sc);
    }
    // Trees in the back yard sway, so they stay out of the static merge.
    this.trees = [buildTree(this.seed + 1, -8.6, -7.6), buildTree(this.seed + 2, 8.5, -7.4), buildTree(this.seed + 3, -2, -8.3)];
    for (const t of this.trees) this.group.add(t);
  }

  // ---- Room ---------------------------------------------------------------------------

  buildRoom() {
    // Plank floor in two alternating tones.
    for (let k = 0; k < 28; k++) {
      const plank = box(0.5, 0.12, 10, k % 2 ? PALETTE.floor : PALETTE.floorAlt, -6.75 + k * 0.5, 0.06, 0);
      plank.castShadow = false;
      this.add(plank);
    }
    const sill = box(1.8, 0.13, 0.3, PALETTE.floorAlt, 0, 0.065, 5.05);
    sill.castShadow = false;
    this.add(sill);

    const glassMat = new THREE.MeshStandardMaterial({ map: glassTexture(), roughness: 0.08, metalness: 0.05, transparent: true, opacity: 0.82, emissive: 0xffcf8a, emissiveIntensity: 0 });
    const wainscot = new THREE.Color(this.interior).multiplyScalar(0.86).getHex();
    this.glass = glassMat;

    /**
     * A wall segment along x (dir 'x') or z (dir 'z'), with its outward normal, as a group that can
     * be lowered to a stub when it faces the camera.
     */
    const makeWall = (normal, center, length, windows = [], door = false) => {
      const g = new THREE.Group();
      g.userData.dynamic = true;
      const along = normal.x === 0 ? 'x' : 'z';
      const inner = (len, h, y, offset) => {
        const thickness = 0.1;
        const pieces = [];
        for (const [color, shift] of [[this.interior, -0.05], [this.exterior, 0.05]]) {
          const w = along === 'x' ? len : thickness;
          const d = along === 'x' ? thickness : len;
          const ox = along === 'x' ? offset : normal.x * shift;
          const oz = along === 'x' ? normal.z * shift : offset;
          pieces.push(box(w, h, d, color, ox, y, oz));
        }
        return pieces;
      };
      const pieces = [];
      // Interior trim pieces offset into the room along the wall's inward normal.
      const trim = (len, h, y, offset, depth, color) => {
        const w = along === 'x' ? len : depth;
        const d = along === 'x' ? depth : len;
        const inset = -(0.1 + depth / 2);
        return box(w, h, d, color, along === 'x' ? offset : normal.x * inset, y, along === 'x' ? normal.z * inset : offset);
      };
      const solid = (from, to, y0 = 0, y1 = WALL_H) => {
        if (to - from <= 0.01) return;
        pieces.push(...inner(to - from, y1 - y0, (y0 + y1) / 2, (from + to) / 2));
        if (y0 === 0 && y1 >= 0.95) {
          // Wainscot panel and chair rail along the lower wall.
          pieces.push(trim(to - from, 0.9, 0.45, (from + to) / 2, 0.025, wainscot));
          pieces.push(trim(to - from, 0.05, 0.92, (from + to) / 2, 0.05, PALETTE.trim));
        }
      };
      // Cut openings for windows (y 1.0–2.05) and the door (y 0–2.15).
      const half = length / 2;
      const openings = windows.map((c) => [c - 0.8, c + 0.8, 1.0, 2.05]);
      if (door) openings.push([-DOOR_HALF, DOOR_HALF, 0, 2.15]);
      openings.sort((a, b) => a[0] - b[0]);
      let cursor = -half;
      for (const [a, b, y0, y1] of openings) {
        solid(cursor, a);
        solid(a, b, 0, y0);
        solid(a, b, y1, WALL_H);
        cursor = b;
      }
      solid(cursor, half);
      for (const p of pieces) g.add(p);

      // Trim: top cap, window frames and glass.
      const cap = along === 'x' ? box(length + 0.24, 0.08, 0.24, PALETTE.trim, 0, WALL_H, 0) : box(0.24, 0.08, length + 0.24, PALETTE.trim, 0, WALL_H, 0);
      g.add(cap);
      g.userData.windows = [];
      for (const c of windows) {
        const win = new THREE.Group();
        const frame = (w, h, d, ox, oy) => win.add(along === 'x' ? box(w, h, d, PALETTE.trim, ox, oy, 0) : box(d, h, w, PALETTE.trim, 0, oy, ox));
        frame(1.7, 0.08, 0.3, 0, 0.98);
        frame(1.7, 0.08, 0.26, 0, 2.08);
        frame(0.08, 1.1, 0.26, -0.82, 1.53);
        frame(0.08, 1.1, 0.26, 0.82, 1.53);
        frame(0.05, 1.05, 0.22, 0, 1.53);
        const pane = new THREE.Mesh(along === 'x' ? new THREE.BoxGeometry(1.6, 1.05, 0.03) : new THREE.BoxGeometry(0.03, 1.05, 1.6), glassMat);
        pane.position.y = 1.53;
        win.add(pane);
        if (along === 'x') win.position.x = c;
        else win.position.z = c;
        win.userData.dynamic = true;
        g.add(win);
        g.userData.windows.push(win);
      }
      if (door) {
        const frame = (w, h, ox, oy) => g.add(along === 'x' ? box(w, h, 0.28, PALETTE.trim, ox, oy, 0) : box(0.28, h, w, PALETTE.trim, 0, oy, ox));
        frame(0.1, 2.2, -DOOR_HALF - 0.05, 1.1);
        frame(0.1, 2.2, DOOR_HALF + 0.05, 1.1);
        frame(2.0, 0.1, 0, 2.18);
        // An open front door, swung in against the wall on its hinge.
        const hinge = new THREE.Group();
        hinge.position.set(DOOR_HALF - 0.02, 0, -0.14);
        hinge.rotation.y = -Math.PI / 2 * 0.96;
        const doorColor = new THREE.Color(this.exterior).multiplyScalar(0.62).getHex();
        hinge.add(softBox(1.74, 2.1, 0.06, doorColor, -0.87, 1.05, 0, 0.02));
        for (const y of [0.55, 1.45]) hinge.add(box(1.4, 0.6, 0.02, new THREE.Color(doorColor).multiplyScalar(0.85).getHex(), -0.87, y, 0.035));
        hinge.add(cyl(0.035, 0.035, 0.08, 0xd9b55a, 10, -1.6, 1.0, 0.07));
        g.add(hinge);
      }

      mergeStatic(g);
      g.position.set(center.x, 0, center.z);
      g.userData.normal = normal;
      g.userData.scale = 1;
      this.group.add(g);
      this.walls.push(g);
      return g;
    };

    makeWall(new THREE.Vector3(0, 0, -1), new THREE.Vector3(0, 0, -5.1), 14.4, [-5.6, 5.0]);
    makeWall(new THREE.Vector3(-1, 0, 0), new THREE.Vector3(-7.1, 0, 0), 10.0, [-3.4]);
    makeWall(new THREE.Vector3(1, 0, 0), new THREE.Vector3(7.1, 0, 0), 10.0, [-1.8, 3.2]);
    makeWall(new THREE.Vector3(0, 0, 1), new THREE.Vector3(0, 0, 5.1), 14.4, [-4.2, 4.2], true);

    this.block(-7.25, -5.25, -6.95, 5.25);
    this.block(-7.25, -5.25, 7.25, -4.95);
    this.block(6.95, -5.25, 7.25, 5.25);
    this.block(-7.25, 4.95, -DOOR_HALF - 0.05, 5.25);
    this.block(DOOR_HALF - 0.12, 3.25, DOOR_HALF + 0.05, 5.0); // the open door leaf
    this.block(DOOR_HALF + 0.05, 4.95, 7.25, 5.25);

    // Wall art
    const art1 = buildWallArt(this.seed + 11, 1.0, 0.75);
    art1.rotation.y = -Math.PI / 2; // canvas faces into the room (+z)
    art1.position.set(-2.9, 1.95, -4.97);
    this.add(art1);
    const art2 = buildWallArt(this.seed + 12, 0.8, 0.6);
    art2.rotation.y = -Math.PI / 2;
    art2.position.set(2.3, 2.0, -4.97);
    this.add(art2);
  }

  buildFurniture() {
    const place = (obj, x, z, rotY = 0) => {
      obj.position.set(x, 0, z);
      obj.rotation.y = rotY;
      return obj;
    };

    // Bookshelf (reading) on the left wall.
    this.add(place(buildBookshelf(this.seed + 5), -6.78, -0.4));
    this.block(-7.0, -1.42, -6.55, 0.62);

    // Whiteboard (delegating) on the left wall.
    this.add(place(buildWhiteboard(), -6.97, 2.4));

    // Globe (web search).
    const globe = buildGlobe();
    this.group.add(place(mergeStatic(globe.group), -3.2, 3.3));
    this.globe = globe.spinner;
    this.block(-3.5, 3.0, -2.9, 3.6);

    // Server rack (running commands).
    const rack = buildRack();
    this.group.add(place(mergeStatic(rack.group), 6.3, -4.35));
    this.rackLights = rack.lights;
    this.block(5.8, -4.75, 6.8, -3.95);

    // Coffee bar (flavor) against the right wall.
    const bar = buildCoffeeBar();
    this.group.add(place(mergeStatic(bar.group), 6.5, 0.9));
    this.steam = bar.steam;
    this.block(6.05, 0.0, 6.95, 1.8);

    // Living corner: couch facing the street, side table, floor lamp, rug.
    this.add(buildRug(4.0, 2.6, PALETTE.rug, 2.0, 3.4));
    this.add(place(buildCouch(this.seed + 7), 2.0, 2.9));
    this.block(0.62, 2.42, 3.38, 3.38);
    this.add(place(buildSideTable(), 3.85, 2.9));
    this.block(3.55, 2.6, 4.15, 3.2);
    const floorLamp = buildFloorLamp();
    this.group.add(place(mergeStatic(floorLamp.group), 0.15, 2.65));
    this.nightGlows.push(floorLamp.shade);
    this.block(-0.05, 2.45, 0.35, 2.85);

    const plants = [[-6.4, -4.45], [-6.4, 4.45], [5.2, -4.5], [6.5, 4.45], [-4.2, 4.5]];
    plants.forEach(([x, z], k) => {
      this.add(buildPlant(x, z, this.seed + 20 + k));
      this.block(x - 0.24, z - 0.24, x + 0.24, z + 0.24);
    });

    this.stations = {
      bookshelf: [spot(-5.95, -1.1, FACE_LEFT), spot(-5.95, -0.2, FACE_LEFT), spot(-5.95, 0.5, FACE_LEFT)],
      whiteboard: [spot(-6.05, 2.0, FACE_LEFT), spot(-6.05, 2.9, FACE_LEFT)],
      globe: [spot(-3.2, 2.45, FACE_FRONT), spot(-2.35, 3.3, FACE_LEFT), spot(-4.05, 3.3, FACE_RIGHT)],
      rack: [spot(6.3, -3.35, FACE_BACK), spot(5.45, -3.35, FACE_BACK)],
      coffee: [spot(5.6, 0.55, FACE_RIGHT), spot(5.6, 1.35, FACE_RIGHT)],
      couch: [1.15, 2.0, 2.85].map((x) => spot(x, 2.92, FACE_FRONT)),
      wander: [spot(-1, 0.6, 0.4), spot(1.6, 1.2, -0.6), spot(-0.6, 3.6, 0.2), spot(-4.6, 0.9, 1.2), spot(4.9, 3.9, -0.9),
        spot(0.4, 7.4, 0.3), spot(-3.4, 7.9, -0.5), spot(4.4, 8.3, 0.8), spot(-7.5, 4, 1.2)],
      entrance: spot(0, 10.6, FACE_BACK),
    };
  }

  /**
   * Desk i: a back row of 4, then a second row. The user sits on the street side facing the wall,
   * so the camera looks over their shoulder at the screen.
   */
  ensureDesks(n) {
    n = Math.min(n, 8);
    while (this.desks.length < n) {
      const i = this.desks.length;
      const back = i < 4;
      const x = -4.2 + (i % 4) * 2.6;
      const deskZ = back ? -3.55 : 0.35;
      const chairZ = deskZ + 0.78;

      const screen = new Screen();
      const desk = buildDesk(i, screen);
      desk.group.position.set(x, 0, deskZ);
      this.group.add(mergeStatic(desk.group));
      this.nightGlows.push(desk.lamp);
      const chair = mergeStatic(buildChair());
      chair.position.set(x, 0, chairZ + 0.04);
      chair.rotation.y = Math.PI;
      this.group.add(chair);
      this.block(x - 0.85, deskZ - 0.43, x + 0.85, deskZ + 0.43);

      this.desks.push({
        screen,
        chair: spot(x, chairZ, FACE_BACK),
        // Visiting helpers stand at the user's right (+x) with a laptop, facing the desk.
        guests: [spot(x + 1.3, deskZ + 0.85, -2.2), spot(x + 1.3, deskZ + 1.6, -2.6), spot(x - 1.3, deskZ + 0.85, 2.2)],
        wait: spot(x, chairZ + 0.95, FACE_FRONT),
        visitorWait: spot(x + 0.85, chairZ + 1.0, FACE_FRONT),
      });
    }
  }

  desk(slot) {
    this.ensureDesks(slot);
    return this.desks[(slot - 1) % this.desks.length];
  }


  buildSign(household) {
    const mailbox = new THREE.Group();
    mailbox.add(box(0.1, 1.0, 0.1, PALETTE.wood, 0, 0.5, 0));
    mailbox.add(softBox(0.36, 0.3, 0.55, 0x4f86c6, 0, 1.12, 0, 0.08));
    mailbox.add(box(0.03, 0.18, 0.08, 0xe63946, 0.2, 1.25, -0.12));
    mailbox.position.set(-1.9, 0, 10.3);
    this.add(mailbox);
    this.block(-2.05, 10.15, -1.75, 10.45);

    const el = document.createElement('div');
    el.className = 'lot-sign';
    el.innerHTML = `<span class="lot-dot" style="background:#${this.exterior.toString(16).padStart(6, '0')}"></span><span class="lot-name"></span>`;
    el.querySelector('.lot-name').textContent = household.name;
    el.title = household.project;
    this.signEl = el;
    const label = new CSS2DObject(el);
    label.position.set(-1.9, 2.0, 10.3);
    this.group.add(label);
  }

  setName(name) {
    this.signEl.querySelector('.lot-name').textContent = name;
  }

  get name() {
    return this.signEl.querySelector('.lot-name').textContent;
  }

  /**
   * @param {object} o
   * @param {THREE.Camera} o.camera
   * @param {number} o.night 0..1
   * @param {boolean} o.busy someone is running commands here
   */
  update(dt, t, { camera, night, busy }) {
    if (this.globeSpin > 0) this.globe.rotation.y += dt * 2.5;
    this.globeSpin = 0;

    this.rackLights.forEach((l, i) => {
      l.visible = busy ? Math.sin(t * (7 + (i % 5)) + i * 1.7) > -0.3 : i % 3 === 0;
    });


    // Coffee steam: a lazy loop of puffs while someone is at the bar.
    const steaming = this.coffeeBusy > 0;
    this.coffeeBusy = 0;
    this.steam.children.forEach((puff) => {
      const p = (t * 0.45 + puff.userData.phase) % 1;
      puff.position.set(Math.sin(p * 9 + puff.userData.phase * 6) * 0.04, p * 0.6, 0);
      puff.scale.setScalar(0.6 + p * 1.6);
      puff.material.opacity = steaming ? 0.45 * (1 - p) : 0;
    });

    // Trees sway gently.
    for (const tree of this.trees) {
      const c = tree.getObjectByName('canopy');
      c.rotation.z = Math.sin(t * 0.9 + c.userData.phase) * 0.025;
      c.rotation.x = Math.cos(t * 0.7 + c.userData.phase) * 0.02;
    }

    // Night: interior light, window glow, lamps.
    this.lamp.intensity = night * 14;
    this.glass.emissiveIntensity = night * 0.9;
    this.glass.opacity = 0.82 + night * 0.12;
    for (const glow of this.nightGlows) glow.material.emissiveIntensity = night * (glow.userData.nightGlow ?? 1);

    // Cutaway walls: lower the walls between the camera and the room.
    const center = this.group.position;
    const toCam = new THREE.Vector3(camera.position.x - center.x, 0, camera.position.z - center.z).normalize();
    for (const w of this.walls) {
      let target = 1;
      if (this.wallMode === 'down') target = CUT_SCALE;
      else if (this.wallMode === 'cutaway' && w.userData.normal.dot(toCam) > 0.15) target = CUT_SCALE;
      w.userData.scale += (target - w.userData.scale) * (1 - Math.exp(-dt * 7));
      w.scale.y = w.userData.scale;
      for (const win of w.userData.windows) win.visible = w.userData.scale > 0.75;
    }
  }

  /** Lot-local → world. */
  toWorld(x, z) {
    return new THREE.Vector3(x + this.group.position.x, 0, z + this.group.position.z);
  }
}

