// A lot is one project's house: a room with Sims-style cutaway walls, furniture, and the
// "stations" Sims use. All coordinates are lot-local. The room spans x -7..7, z -5..5; the street is at +z.

import * as THREE from 'three';
import { CSS2DObject } from 'three/addons/renderers/CSS2DRenderer.js';
import {
  buildBookshelf, buildChair, buildCoffeeBar, buildCouch, buildDesk, buildFloorLamp, buildGlobe,
  buildRack, buildRug, buildSideTable, buildWallArt, buildWhiteboard,
} from './furniture.js';
import { EXTERIORS, INTERIORS, PALETTE, box, buildBush, buildPlant, buildTree, cyl, glassTexture, ico, mat, mergeStatic, rng, softBox, buildLightPool } from './models.js';
import { waterMaterial } from './fx.js';
import { ARCHES, DECOR, FLOORS } from '../../shared/style.mjs';
import { floorMaterial } from './textures.js';
import { levelName } from '../../shared/progression.mjs';
import { buildDecor } from './decor.js';
import { NavGrid } from './nav.js';
import { Pet } from './pets.js';
import { Screen } from './screens.js';

const photoLoader = new THREE.TextureLoader();
const photoTextures = new Map();
/** A photo from the album, center-cropped to the polaroid's 6:5 window (shared per photo id). */
function photoTexture(id) {
  if (photoTextures.has(id)) return photoTextures.get(id);
  const tex = photoLoader.load(`/api/photos/${id}.jpg`, (t) => {
    const a = t.image.width / t.image.height;
    const want = 0.36 / 0.3;
    if (a > want) {
      t.repeat.set(want / a, 1);
      t.offset.set((1 - want / a) / 2, 0);
    } else {
      t.repeat.set(1, a / want);
      t.offset.set(0, (1 - a / want) / 2);
    }
  });
  tex.colorSpace = THREE.SRGBColorSpace;
  photoTextures.set(id, tex);
  return tex;
}

export const LOT_W = 26;
export const LOT_D = 24;
/** The yard (and its fence) ends here, short of the lot-side sidewalks at z ±7.7. */
const YARD_Z = 7.45;
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
    this.exterior = this.baseExterior = EXTERIORS[seed % EXTERIORS.length];
    this.arch = this.baseArch = Object.keys(ARCHES)[(Math.imul(seed ^ (seed >>> 13), 0x5bd1e995) >>> 0) % 4];
    this.roofAllowed = true; // main turns roofs off in build mode and for the inspected home
    this.peek = false; // main sets this for the home in the middle of the screen
    this.hovered = false; // main sets this for the home under the pointer
    this.roofOn = true;
    this.roofV = 0;
    this.roofK = 0;
    this.interior = this.baseInterior = INTERIORS[(seed >>> 3) % INTERIORS.length];
    // Build-mode decor (simulation layer only; see docs/GAMEPLAY.md).
    this.decor = { group: new THREE.Group(), items: [], obstacles: [], glows: [], canopies: [], key: '' };
    this.group.add(this.decor.group);
    // Home level upgrades (phase 2): earned by outcomes you mark reached.
    this.level = 0;
    this.levelGroup = new THREE.Group();
    this.levelObstacles = [];
    this.levelGlows = [];
    this.group.add(this.levelGroup);

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
    this.setLevel(1);
    const shelf = document.createElement('button');
    shelf.className = 'conversation-shelf';
    shelf.dataset.conversationHome = this.project;
    shelf.hidden = true;
    const shelfLabel = new CSS2DObject(shelf);
    shelfLabel.position.set(-6, 2.2, -0.4);
    this.group.add(shelfLabel);
    this.shelfEl = shelf;
    this.ensureDesks(Math.max(2, household.characters.length));
    mergeStatic(this.static);

    // Night: window and door light spilling onto the yard (shared fade in models.js).
    for (const [w, d, x, z] of [[2.4, 1.6, -5.6, -6.2], [2.4, 1.6, 5.0, -6.2], [1.6, 2.4, -8.2, -3.4], [1.6, 2.4, 8.2, -1.8], [1.6, 2.4, 8.2, 3.2], [2.4, 1.8, -4.2, 6.3], [2.4, 1.8, 4.2, 6.3], [2.8, 2.6, 0, 6.6]]) {
      this.group.add(buildLightPool(w, d, x, 0.075, z));
    }

    // Warm interior light for evenings; intensity follows the time of day.
    this.lamp = new THREE.PointLight(0xffc98a, 0, 16, 1.6);
    this.lamp.position.set(0, 2.6, 0.5);
    this.group.add(this.lamp);
  }

  add(obj) {
    this.static.add(obj);
    return obj;
  }

  /** Move the whole house to another plot (map mode). Residents and pets are lot-local, so they come along. */
  setIndex(index) {
    if (index === this.index) return;
    this.index = index;
    this.group.position.set((index % 3) * LOT_W, 0, Math.floor(index / 3) * LOT_D);
  }

  /** A home's pet (flavor only). */
  setPet(kind) {
    if ((this.pet?.kind || null) === (kind || null)) return;
    this.pet?.dispose();
    this.pet = kind ? new Pet(kind, this) : null;
  }

  block(x0, z0, x1, z1) {
    this.obstacles.push([x0, z0, x1, z1]);
    this.nav = null;
  }

  /** Navigation grid over the lot, rebuilt lazily when furniture or decor changes. */
  getNav() {
    if (!this.nav) this.nav = this.makeNav(this.decor.obstacles);
    return this.nav;
  }

  makeNav(decorRects) {
    const nav = new NavGrid({ x0: -11, z0: -5, x1: 11, z1: 11.5 }, 0.25, 0.25);
    for (const r of this.obstacles) nav.addRect(r);
    for (const r of this.levelObstacles) nav.addRect(r);
    for (const r of decorRects) nav.addRect(r);
    return nav;
  }

  /**
   * Show a home's level (1 Cottage … 5 Estate) with cumulative exterior upgrades. Cosmetic; the level
   * comes from outcomes the human marked reached (shared/progression.mjs), never from agent activity.
   */
  setLevel(level) {
    if (level === this.level) return;
    this.level = level;
    for (const child of [...this.levelGroup.children]) {
      this.levelGroup.remove(child);
      child.traverse((o) => o.isMesh && o.geometry.dispose());
    }
    this.levelObstacles = [];
    this.levelGlows = [];
    const g = new THREE.Group();
    const accent = new THREE.Color(this.exterior).multiplyScalar(0.7).getHex();
    const glowBox = (w, h, d, x, y, z, color = 0xffd28a) => {
      const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), new THREE.MeshStandardMaterial({ color, emissive: color, emissiveIntensity: 0.15 }));
      m.position.set(x, y, z);
      m.userData.dynamic = true;
      m.userData.nightGlow = 2.6;
      this.levelGlows.push(m);
      return m;
    };
    const block = (...r) => this.levelObstacles.push(r);
    if (level >= 2) {
      // House: porch deck, door awning, porch lights.
      for (let i = 0; i < 6; i++) g.add(Object.assign(box(3.6, 0.08, 0.13, PALETTE.woodMid, 0, 0.16, 5.3 + i * 0.14), { castShadow: false }));
      g.add(softBox(2.8, 0.08, 1.0, accent, 0, 2.5, 5.55, 0.04));
      for (const s of [1, -1]) {
        g.add(box(0.08, 2.35, 0.08, PALETTE.trim, s * 1.3, 1.3, 5.98));
        block(s * 1.3 - 0.06, 5.92, s * 1.3 + 0.06, 6.04);
        g.add(glowBox(0.14, 0.2, 0.1, s * 1.45, 1.95, 5.27));
      }
    }
    if (level >= 3) {
      // Villa: flowered garden arch over the path, and a front hedge.
      for (const s of [1, -1]) {
        g.add(box(0.12, 2.2, 0.12, PALETTE.trim, s * 1.05, 1.1, 7.2));
        block(s * 1.05 - 0.08, 7.12, s * 1.05 + 0.08, 7.28);
        for (let x = 2.45; x < 10.2; x += 0.75) {
          g.add(ico(0.38, PALETTE.leafDark, s * x, 0.34, 6.95, 0));
        }
        block(Math.min(s * 2.1, s * 10.4), 6.6, Math.max(s * 2, s * 10.4), 7.35);
      }
      const arch = new THREE.Mesh(new THREE.TorusGeometry(1.05, 0.06, 6, 16, Math.PI), new THREE.MeshStandardMaterial({ color: PALETTE.trim, flatShading: true }));
      arch.position.set(0, 2.2, 7.2);
      arch.castShadow = true;
      g.add(arch);
      for (let i = 0; i < 9; i++) {
        const a = (i / 8) * Math.PI;
        g.add(ico(0.1, PALETTE.flowers[i % PALETTE.flowers.length], Math.cos(a) * 1.05, 2.2 + Math.sin(a) * 1.05, 7.2));
      }
    }
    if (level >= 4) {
      // Manor: a fountain and a flag in the home's color.
      g.add(cyl(1.0, 1.1, 0.4, 0xd8d2c6, 16, 8.9, 0.2, 4.6));
      const water = cyl(0.88, 0.88, 0.02, 0x7fc4ec, 16, 8.9, 0.41, 4.6, { material: waterMaterial() });
      water.castShadow = false;
      g.add(water);
      g.add(cyl(0.12, 0.16, 0.8, 0xd8d2c6, 8, 8.9, 0.8, 4.6));
      g.add(cyl(0.4, 0.25, 0.14, 0xd8d2c6, 12, 8.9, 1.22, 4.6));
      g.add(glowBox(0.08, 0.3, 0.08, 8.9, 1.42, 4.6, 0x9fd8ff));
      block(7.85, 3.55, 9.95, 5.65);
      g.add(cyl(0.04, 0.05, 4.2, PALETTE.metal, 6, -8.8, 2.1, 5.6));
      g.add(ico(0.07, 0xd9b55a, -8.8, 4.25, 5.6));
      g.add(box(1.1, 0.65, 0.03, this.exterior, -8.25, 3.8, 5.6));
      block(-8.9, 5.5, -8.7, 5.7);
    }
    if (level >= 5) {
      // Estate: lanterns along the path and a golden plumbob statue.
      for (const s of [1, -1]) {
        for (const z of [6.3]) {
          g.add(cyl(0.05, 0.07, 1.1, PALETTE.dark, 6, s * 1.55, 0.55, z));
          g.add(glowBox(0.18, 0.22, 0.18, s * 1.55, 1.2, z));
          block(s * 1.55 - 0.1, z - 0.1, s * 1.55 + 0.1, z + 0.1);
        }
      }
      g.add(cyl(0.45, 0.55, 0.6, 0xe9e3d5, 8, -6.6, 0.3, 5.9));
      const gem = new THREE.Mesh(new THREE.OctahedronGeometry(0.35, 0), new THREE.MeshStandardMaterial({ color: 0xffd166, emissive: 0xffb703, emissiveIntensity: 0.6, metalness: 0.6, roughness: 0.25, flatShading: true }));
      gem.scale.set(1, 1.8, 1);
      gem.position.set(-6.6, 1.3, 5.9);
      gem.castShadow = true;
      gem.userData.dynamic = true;
      this.statue = gem;
      g.add(gem);
      block(-7.1, 5.4, -6.1, 6.4);
    } else {
      this.statue = null;
    }
    mergeStatic(g);
    this.levelGroup.add(g);
    this.nav = null;
    this.reachCache = null;
    const badge = this.signEl.querySelector('.lot-level');
    badge.textContent = `${'★'.repeat(level)} ${levelName(level)}`;
    badge.title = `Home level ${level} of 5: grows when you mark this project's outcome reached`;
  }

  // ---- Customization (paint + decor) ---------------------------------------------------

  /** Apply a saved home style: paint, floor and decor. Missing fields fall back to the seeded look. */
  applyStyle(home) {
    const hex = (c, fallback) => (c ? parseInt(c.slice(1), 16) : fallback);
    const exterior = hex(home?.exterior, this.baseExterior);
    const interior = hex(home?.interior, this.baseInterior);
    const arch = home?.arch in ARCHES ? home.arch : this.baseArch;
    if (exterior !== this.exterior || interior !== this.interior || arch !== this.arch) {
      this.exterior = exterior;
      this.interior = interior;
      this.arch = arch;
      this.buildWalls();
      this.buildRoof();
      this.signEl.querySelector('.lot-dot').style.background = `#${exterior.toString(16).padStart(6, '0')}`;
      const level = this.level; // awning and flag use the house color
      this.level = 0;
      this.setLevel(level);
    }
    const floor = home?.floor || 'oak';
    if (floor !== this.floorStyle) this.buildFloor(floor);
    this.setDecor(home?.decor || []);
    this.setPet(home?.pet || null);
  }

  /**
   * Polaroids of your own photo-mode pictures, pinned on the back wall between the paintings
   * (up to four, from style.gallery). Images load from the local bridge.
   */
  setGallery(ids = []) {
    const key = ids.join(',');
    if (key === this.galleryKey) return;
    this.galleryKey = key;
    if (this.gallery) {
      this.group.remove(this.gallery);
      this.gallery.traverse((o) => {
        if (!o.isMesh) return;
        o.geometry.dispose();
        if (o.userData.photo) o.material.dispose();
      });
    }
    this.gallery = new THREE.Group();
    this.group.add(this.gallery);
    ids.forEach((id, i) => {
      const frame = new THREE.Group();
      // Centered in the gap between the two paintings (x −2.4 … 1.9).
      frame.position.set(-0.25 + (i - (ids.length - 1) / 2) * 0.55, 2.0 + (i % 2 ? -0.06 : 0.04), -4.96);
      frame.rotation.z = ((this.seed >> i) % 7 - 3) * 0.02;
      frame.add(box(0.42, 0.5, 0.015, 0xfbfaf6, 0, 0, 0));
      frame.add(box(0.05, 0.05, 0.02, 0xe56b6f, 0, 0.22, 0.012)); // pin
      const tex = photoTexture(id);
      const photo = new THREE.Mesh(new THREE.PlaneGeometry(0.36, 0.3), new THREE.MeshStandardMaterial({ map: tex, roughness: 0.45 }));
      photo.userData.photo = true;
      photo.position.set(0, 0.04, 0.009);
      frame.add(photo);
      this.gallery.add(frame);
    });
  }

  /** Footprint rectangle [x0, z0, x1, z1] of an item at a position and quarter-turn rotation. */
  footprint(item, x, z, rot = 0) {
    const def = DECOR[item];
    const [w, d] = rot % 2 ? [def.d, def.w] : [def.w, def.d];
    return [x - w / 2, z - d / 2, x + w / 2, z + d / 2];
  }

  setDecor(list) {
    const key = JSON.stringify(list);
    if (key === this.decor.key) return;
    this.decor.key = key;
    const d = this.decor;
    for (const child of [...d.group.children]) {
      d.group.remove(child);
      child.traverse((o) => o.isMesh && o.geometry.dispose());
    }
    d.items = [];
    d.obstacles = [];
    d.glows = [];
    d.canopies = [];
    for (const it of list) {
      if (!(it.item in DECOR)) continue;
      const built = buildDecor(it.item, this.seed + [...it.id].reduce((a, c) => a + c.charCodeAt(0), 0));
      built.group.position.set(it.x, 0.12, it.z);
      built.group.rotation.y = -it.rot * (Math.PI / 2);
      built.group.userData.decorId = it.id;
      built.group.traverse((o) => (o.userData.decorId = it.id));
      d.group.add(built.group);
      d.items.push({ ...it, object: built.group });
      d.glows.push(...built.glows);
      d.canopies.push(...built.canopies);
      if (!DECOR[it.item].walkable) d.obstacles.push(this.footprint(it.item, it.x, it.z, it.rot));
    }
    this.nav = null;
  }

  /**
   * Can `item` go at (x, z, rot)? Keeps rooms and yards separate, avoids furniture and other decor,
   * and makes sure every desk, waiting spot and station stays reachable from the street.
   * @returns {{ok: boolean, reason?: string}}
   */
  canPlace(item, x, z, rot = 0, ignoreId = null) {
    const def = DECOR[item];
    if (!def) return { ok: false, reason: 'Unknown item' };
    const [x0, z0, x1, z1] = this.footprint(item, x, z, rot);
    const inRoom = x0 >= -6.95 && x1 <= 6.95 && z0 >= -4.95 && z1 <= 4.95;
    const overlapsRoom = x1 > -7.3 && x0 < 7.3 && z1 > -5.3 && z0 < 5.3;
    const inYard = !overlapsRoom && x0 >= -10.7 && x1 <= 10.7 && z0 >= -YARD_Z + 0.15 && z1 <= YARD_Z - 0.15;
    if (def.where === 'indoor' && !inRoom) return { ok: false, reason: 'This goes inside the house' };
    if (def.where === 'outdoor' && !inYard) return { ok: false, reason: 'This goes in the yard' };
    if (def.where === 'any' && !inRoom && !inYard) return { ok: false, reason: 'Place it inside or in the yard' };
    if (def.walkable) return { ok: true };

    const overlaps = (r) => x0 < r[2] && x1 > r[0] && z0 < r[3] && z1 > r[1];
    const others = this.decor.items.filter((it) => it.id !== ignoreId && !DECOR[it.item].walkable).map((it) => this.footprint(it.item, it.x, it.z, it.rot));
    if (this.obstacles.some(overlaps) || this.levelObstacles.some(overlaps) || others.some(overlaps)) return { ok: false, reason: 'Something is already there' };

    // Every spot Sims can reach today (from the street) must stay reachable with the item placed.
    const reachable = (nav) => {
      const seen = nav.reachableFrom(this.stations.entrance);
      return this.keySpots().map((s) => {
        const cell = nav.nearestFree(...nav.toCell(s.x, s.z), 4);
        return !!cell && !!seen[cell[1] * nav.w + cell[0]];
      });
    };
    const baseKey = JSON.stringify(others);
    if (this.reachCache?.key !== baseKey) this.reachCache = { key: baseKey, spots: reachable(this.makeNav(others)) };
    const after = reachable(this.makeNav([...others, [x0, z0, x1, z1]]));
    if (this.reachCache.spots.some((was, i) => was && !after[i])) return { ok: false, reason: 'That would block a desk, seat or doorway' };
    return { ok: true };
  }

  /** Spots Sims must always be able to reach. */
  keySpots() {
    const st = this.stations;
    return [
      ...this.desks.flatMap((d) => [d.chair, d.wait, d.visitorWait, d.guests[0]]),
      ...st.coffee, ...st.couch, ...st.bookshelf.slice(0, 1), ...st.whiteboard.slice(0, 1), ...st.globe.slice(0, 1), ...st.rack.slice(0, 1),
    ];
  }

  /** Decor item under a raycast hit object, if any. */
  decorAt(object) {
    const id = object?.userData?.decorId;
    return id ? this.decor.items.find((it) => it.id === id) : null;
  }

  // ---- Outside ------------------------------------------------------------------------

  buildGround() {
    const r = this.r;
    const grass = box(22, 0.1, 20, PALETTE.grassLot, 0, 0, 0);
    grass.castShadow = false;
    this.add(grass);

    // Stepping-stone path from the sidewalk to the door.
    for (let i = 0; i < 2; i++) {
      const s = softBox(1.3 + r() * 0.2, 0.06, 0.75, PALETTE.sidewalk, (r() - 0.5) * 0.15, 0.08, 5.9 + i * 0.95, 0.15);
      s.rotation.y = (r() - 0.5) * 0.15;
      s.castShadow = false;
      this.add(s);
    }

    // Picket fence around the yard, open at the path. It stops short of the sidewalks (which start at z ±7.7).
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
    fence(-10.8, YARD_Z, -1.2, YARD_Z);
    fence(1.2, YARD_Z, 10.8, YARD_Z);
    fence(-10.8, -YARD_Z, -10.8, YARD_Z);
    fence(10.8, -YARD_Z, 10.8, YARD_Z);

    // Mailbox by the gate.
    this.add(box(0.08, 1.0, 0.08, PALETTE.wood, 1.62, 0.5, 7.0));
    this.add(softBox(0.42, 0.3, 0.24, 0x4f6d8f, 1.62, 1.08, 7.0, 0.08));
    this.add(box(0.03, 0.22, 0.03, 0xd94f4f, 1.85, 1.2, 6.96));
    this.add(box(0.1, 0.05, 0.03, 0xd94f4f, 1.9, 1.29, 6.96));

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

    for (const [x, z, sc] of [[-9.7, 6.6, 1.0], [9.7, 6.7, 0.9], [-9.6, 2.5, 0.8], [9.6, -2, 0.85]]) {
      this.add(buildBush(x, z, sc));
      this.block(x - 0.5 * sc, z - 0.5 * sc, x + 0.5 * sc, z + 0.5 * sc);
    }
    // Trees in the back yard sway, so they stay out of the static merge.
    this.trees = [buildTree(this.seed + 1, -8.9, -6.4), buildTree(this.seed + 2, 8.9, -6.2), buildTree(this.seed + 3, -9.3, -1.6)];
    for (const t of this.trees) this.group.add(t);
  }

  // ---- Room ---------------------------------------------------------------------------

  buildRoom() {
    this.glass = new THREE.MeshStandardMaterial({ map: glassTexture(), roughness: 0.08, metalness: 0.05, transparent: true, opacity: 0.82, emissive: 0xffcf8a, emissiveIntensity: 0 });
    this.buildFloor('oak');
    this.buildWalls();
    this.buildRoof();

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

  /** The room floor, rebuilt when the floor style changes (see FLOORS in shared/style.mjs). */
  buildFloor(key) {
    const style = FLOORS[key] || FLOORS.oak;
    this.floorStyle = key in FLOORS ? key : 'oak';
    if (this.floorGroup) {
      this.group.remove(this.floorGroup);
      this.floorGroup.traverse((o) => o.isMesh && o.geometry.dispose());
    }
    const g = new THREE.Group();
    const [, b] = style.colors.map((c) => parseInt(c.slice(1), 16));
    const flat = (m) => ((m.castShadow = false), m);
    // One textured slab (planks, tiles or carpet with soft shading at the walls; textures.js).
    g.add(flat(box(14, 0.12, 10, 0, 0, 0.06, 0, { material: floorMaterial(this.floorStyle) })));
    g.add(flat(box(1.8, 0.13, 0.3, b, 0, 0.065, 5.05))); // door sill
    mergeStatic(g);
    this.floorGroup = g;
    this.group.add(g);
  }

  /** The four walls in the current exterior/interior colors, rebuilt when repainted. */
  buildWalls() {
    for (const w of this.walls) {
      this.group.remove(w);
      w.traverse((o) => o.isMesh && o.geometry.dispose());
    }
    this.walls = [];
    const glassMat = this.glass;
    const wainscot = new THREE.Color(this.interior).multiplyScalar(0.8).getHex();
    const baseboard = new THREE.Color(this.interior).multiplyScalar(0.55).getHex();
    // Outside walls get clapboard lines (fx.js); a slightly different roughness keeps the material separate.
    const siding = mat(this.exterior, { roughness: 0.83 });
    siding.userData.siding = this.arch === 'modern' ? 0 : 0.26;
    const shutterColor = new THREE.Color(this.exterior).multiplyScalar(0.55).getHex();
    const shutters = this.arch === 'cottage' || this.arch === 'barn';

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
          pieces.push(box(w, h, d, color, ox, y, oz, shift > 0 ? { material: siding } : undefined));
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
          pieces.push(trim(to - from, 0.12, 0.06, (from + to) / 2, 0.045, baseboard)); // grounds the room
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
        if (shutters) {
          // Louvered shutters on the outside.
          for (const sx of [-1.12, 1.12]) {
            const sh = along === 'x' ? box(0.5, 1.15, 0.05, shutterColor, sx, 1.53, normal.z * 0.14) : box(0.05, 1.15, 0.5, shutterColor, normal.x * 0.14, 1.53, sx);
            win.add(sh);
          }
        }
        const pane = new THREE.Mesh(along === 'x' ? new THREE.BoxGeometry(1.6, 1.05, 0.03) : new THREE.BoxGeometry(0.03, 1.05, 1.6), glassMat);
        pane.position.y = 1.53;
        win.add(pane);
        if (along === 'x') win.position.x = c;
        else win.position.z = c;
        win.userData.dynamic = true;
        mergeStatic(win); // frames, shutters and pane: a few draws per window instead of ~10
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

  }

  /** Roof in the home's architecture style (ARCHES). Sits on the walls at y 2.74; lot.update lifts it away. */
  buildRoof() {
    this.smoke = null;
    if (this.roof) {
      this.group.remove(this.roof);
      this.roof.traverse((o) => o.isMesh && o.geometry.dispose());
    }
    const g = new THREE.Group();
    const W = 14.3;
    const D = 10.3;
    const ov = 0.5;
    const ext = this.exterior;
    const shingle = (color) => {
      const m = mat(color, { roughness: 0.81 });
      m.userData.bands = 0.12; // shingle rows (fx.js)
      return m;
    };
    const gable = (H, color, chimney) => {
      const half = D / 2 + ov;
      const slope = Math.hypot(half, H);
      const ang = Math.atan2(H, half);
      for (const s of [1, -1]) {
        const slab = box(W + ov * 2, 0.14, slope, 0, 0, H / 2, (s * half) / 2, { material: shingle(color) });
        slab.rotation.x = s * ang;
        g.add(slab);
        g.add(box(W + ov * 2, 0.1, 0.12, 0xe9e5dc, 0, -0.02, s * (half - 0.05))); // gutter
      }
      // Gable ends in the house color.
      const tri = new THREE.Shape([new THREE.Vector2(-D / 2, 0), new THREE.Vector2(D / 2, 0), new THREE.Vector2(0, H - 0.08)]);
      const end = new THREE.Mesh(new THREE.ExtrudeGeometry(tri, { depth: W - 0.1, bevelEnabled: false }), mat(ext));
      end.rotation.y = Math.PI / 2;
      end.position.x = -(W - 0.1) / 2;
      end.castShadow = true;
      g.add(end);
      if (this.arch === 'barn') {
        for (const x of [-W / 2 - 0.02, W / 2 + 0.02]) {
          const vent = cyl(0.45, 0.45, 0.06, 0xfbfaf6, 16, x, H * 0.45, 0);
          vent.rotation.z = Math.PI / 2;
          g.add(vent);
        }
      }
      if (chimney) addChimney(W / 2 - 2.2, -1.6, H);
    };
    // A brick chimney with a lazy curl of smoke (animated in update; lifts away with the roof).
    const addChimney = (x, z, H) => {
      g.add(box(0.9, H + 0.8, 0.9, 0x9a5b45, x, (H + 0.8) / 2, z), box(1.05, 0.15, 1.05, 0x6b3f30, x, H + 0.85, z));
      const smoke = new THREE.Group();
      smoke.userData.dynamic = true;
      smoke.position.set(x, H + 1, z);
      const puffMat = new THREE.MeshLambertMaterial({ color: 0xf2f2f2, transparent: true, opacity: 0, depthWrite: false });
      for (let i = 0; i < 6; i++) {
        const puff = new THREE.Mesh(new THREE.IcosahedronGeometry(0.28, 0), puffMat.clone());
        puff.userData.phase = i / 6;
        puff.userData.dynamic = true;
        smoke.add(puff);
      }
      g.add(smoke);
      this.smoke = smoke;
    };
    if (this.arch === 'craftsman') {
      // Hip roof: two sloped sides meeting at a ridge plus two triangular ends, over wide eaves.
      const a = (W + ov * 3) / 2;
      const b = (D + ov * 3) / 2;
      const H = 2.3;
      const r = a - b;
      const v = (x, y, z) => [x, y, z];
      const tris = [
        [v(-a, 0, b), v(a, 0, b), v(r, H, 0)], [v(-a, 0, b), v(r, H, 0), v(-r, H, 0)], // front slope
        [v(a, 0, -b), v(-a, 0, -b), v(-r, H, 0)], [v(a, 0, -b), v(-r, H, 0), v(r, H, 0)], // back slope
        [v(a, 0, b), v(a, 0, -b), v(r, H, 0)], // right end
        [v(-a, 0, -b), v(-a, 0, b), v(-r, H, 0)], // left end
      ];
      const geo = new THREE.BufferGeometry();
      geo.setAttribute('position', new THREE.Float32BufferAttribute(tris.flat(2), 3));
      geo.computeVertexNormals();
      const tints = [0x56606c, 0x6a5246, 0x4d6358, 0x6b5a4c];
      const hash = [...this.project].reduce((h, ch) => (Math.imul(h, 31) + ch.charCodeAt(0)) | 0, 7);
      const hip = new THREE.Mesh(geo, shingle(tints[Math.abs(hash) % tints.length]));
      hip.castShadow = true;
      g.add(hip);
      g.add(box(r * 2 + 0.3, 0.12, 0.22, 0x3b414a, 0, H + 0.02, 0)); // ridge cap
      g.add(box(W + ov * 3, 0.12, D + ov * 3, 0xe9e5dc, 0, 0.02, 0));
      addChimney(-a + 3.2, -b + 2.6, H * 0.55);
    } else if (this.arch === 'modern') {
      g.add(box(W + 0.4, 0.3, D + 0.4, 0xd9d4ca, 0, 0.15, 0));
      for (const [w, d, x, z] of [[W + 0.4, 0.25, 0, (D + 0.4) / 2], [W + 0.4, 0.25, 0, -(D + 0.4) / 2], [0.25, D + 0.4, (W + 0.4) / 2, 0], [0.25, D + 0.4, -(W + 0.4) / 2, 0]]) {
        g.add(box(w, 0.55, d, ext, x, 0.45, z)); // parapet in the house color
      }
      for (let i = 0; i < 4; i++) {
        const panel = box(1.6, 0.06, 1.0, 0x1f3354, -4.5 + i * 1.9, 0.75, -2.2, { roughness: 0.25, metalness: 0.5 });
        panel.rotation.x = -0.35;
        g.add(panel);
      }
      g.add(box(1.2, 0.8, 1.0, 0xb8bec7, 4.6, 0.7, 2.2)); // AC unit
    } else {
      gable(this.arch === 'barn' ? 3.1 : 2.2, this.arch === 'barn' ? 0xb5452b : 0x8a4b3c, this.arch === 'cottage');
    }
    mergeStatic(g);
    g.position.y = 2.74;
    g.visible = false;
    this.roof = g;
    this.group.add(g);
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
        spot(0.4, 6.6, 0.3), spot(-3.4, 6.8, -0.5), spot(4.4, 6.8, 0.8), spot(-7.5, 4, 1.2)],
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
    mailbox.position.set(-1.9, 0, 7.0);
    this.add(mailbox);
    this.block(-2.05, 6.85, -1.75, 7.15);

    const el = document.createElement('div');
    el.className = 'lot-sign';
    el.dataset.workHome = this.project;
    el.setAttribute('role', 'button');
    el.tabIndex = 0;
    el.setAttribute('aria-label', `Open project command center for ${household.name}`);
    el.addEventListener('keydown', e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); el.click(); } });
    el.innerHTML = `<span class="lot-dot" style="background:#${this.exterior.toString(16).padStart(6, '0')}"></span><span class="lot-name"></span><span class="lot-level"></span>`;
    el.querySelector('.lot-name').textContent = household.name;
    el.title = household.project;
    this.signEl = el;
    const label = new CSS2DObject(el);
    label.position.set(-1.9, 2.0, 7.0);
    this.group.add(label);
  }

  setConversationCount(count) {
    this.shelfEl.hidden = !count;
    this.shelfEl.textContent = `Conversation shelf · ${count}`;
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
  update(dt, t, { camera, night, busy, avatar = null }) {
    this.pet?.update(dt, t, avatar);
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

    // Chimney smoke: slow puffs that rise, drift with the breeze and fade (only while the roof is on).
    if (this.smoke && this.roof?.visible) {
      for (const puff of this.smoke.children) {
        const p = (t * 0.16 + puff.userData.phase) % 1;
        puff.position.set(p * 0.9 + Math.sin(p * 6 + puff.userData.phase * 9) * 0.12, p * 2.6, Math.sin(p * 4) * 0.15);
        puff.scale.setScalar(0.5 + p * 1.9);
        puff.material.opacity = Math.sin(p * Math.PI) * 0.42 * (0.7 + night * 0.3);
      }
    }

    // Trees sway gently (yard trees and planted decor trees).
    const sway = (c) => {
      c.rotation.z = Math.sin(t * 0.9 + c.userData.phase) * 0.025;
      c.rotation.x = Math.cos(t * 0.7 + c.userData.phase) * 0.02;
    };
    for (const tree of this.trees) sway(tree.getObjectByName('canopy'));
    for (const c of this.decor.canopies) sway(c);
    for (const glow of this.decor.glows) glow.material.emissiveIntensity = (glow.userData.dayGlow ?? 0) + night * glow.userData.nightGlow;
    for (const glow of this.levelGlows) glow.material.emissiveIntensity = 0.15 + night * glow.userData.nightGlow;
    if (this.statue) this.statue.rotation.y += dt * 0.6;

    // Night: interior light, window glow, lamps. Each home switches on at its own moment around dusk,
    // so the street lights up house by house instead of all at once.
    this.lightsAt ??= 0.18 + (Math.abs([...this.project].reduce((h, ch) => (Math.imul(h, 33) + ch.charCodeAt(0)) | 0, 5)) % 100) / 100 * 0.42;
    const lit = THREE.MathUtils.smoothstep(night, this.lightsAt, this.lightsAt + 0.08) * night;
    this.lamp.intensity = lit * 14;
    this.glass.emissiveIntensity = lit * 0.9;
    this.glass.opacity = 0.82 + night * 0.12;
    for (const glow of this.nightGlows) glow.material.emissiveIntensity = lit * (glow.userData.nightGlow ?? 1);

    // Roof: shown when you're zoomed out, lifting away as you zoom in so the room (and the truth inside it)
    // is always visible up close.
    const center = this.group.position;
    const camDist = camera.position.distanceTo(center);
    // The roof is either on or off (never parked half-lifted). The home in the middle of the screen (`peek`)
    // opens up from farther out so you can look inside; the gap between thresholds stops flicker.
    const openBelow = this.peek ? 76 : 48;
    if (!this.roofAllowed || this.wallMode === 'down') this.roofOn = false;
    else if (this.roofOn && camDist < openBelow) this.roofOn = false;
    else if (!this.roofOn && camDist > openBelow + 8) this.roofOn = true;
    // A soft spring, so the roof settles with a little bounce instead of sliding.
    const target = this.roofOn ? 1 : 0;
    this.roofV = (this.roofV || 0) + ((target - this.roofK) * 70 - this.roofV * 11) * dt;
    this.roofK += this.roofV * dt;
    if (Math.abs(target - this.roofK) < 0.001 && Math.abs(this.roofV) < 0.01) this.roofK = target;
    // Hovering a roofed home lifts its roof a touch: a hint that double-click looks inside.
    this.hoverK = (this.hoverK || 0) + ((this.hovered ? 1 : 0) - (this.hoverK || 0)) * (1 - Math.exp(-dt * 10));
    if (this.roof) {
      const k = THREE.MathUtils.clamp(this.roofK, 0, 1.08);
      this.roof.visible = k > 0.01;
      this.roof.position.y = 2.74 + (1 - Math.min(k, 1)) * 5 + this.hoverK * 0.45 * Math.min(k, 1);
      this.roof.scale.setScalar(0.55 + 0.45 * k);
    }
    // Cutaway walls: lower the walls between the camera and the room (all up while the roof is on).
    const toCam = new THREE.Vector3(camera.position.x - center.x, 0, camera.position.z - center.z).normalize();
    for (const w of this.walls) {
      let target = 1;
      if (this.roofK > 0.3) target = 1;
      else if (this.wallMode === 'down') target = CUT_SCALE;
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

