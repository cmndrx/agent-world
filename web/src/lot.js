// A lot is one project's house: a room with Sims-style cutaway walls, furniture, and the
// "stations" Sims use. All coordinates are lot-local. The room spans x -7..7, z -5..5; the street is at +z.

import * as THREE from 'three';
import { CSS2DObject } from 'three/addons/renderers/CSS2DRenderer.js';
import {
  buildArmchair, buildBath, buildBed, buildBench, buildBookshelf, buildChair, buildCoffeeBar, buildColumn, buildCouch,
  buildDesk, buildDining, buildElevator, buildFireplace, buildFloorLamp, buildFridge, buildGlobe, buildKitchen,
  buildLaundry, buildLockers, buildLoveseat, buildMailboxes, buildPlanter, buildRack, buildReception, buildRug,
  buildSideTable, buildStairs, buildTV, buildWallArt, buildWardrobe, buildWhiteboard,
} from './furniture.js';
import { YAW, deskLayout, floorplanFor, rotate } from './home-floorplans.js';
import { EXTERIORS, INTERIORS, PALETTE, box, buildPlant, cyl, glassTexture, ico, mat, mergeStatic, rng, softBox, buildLightPool } from './models.js';
import { GROUND_H, YARD_Z, doorsOf, frontWallBlocks, leafRect, tierPlan, yardProps } from './home-tier-plans.js';
import { buildUpper, buildYard, facadeExtras } from './home-tiers.js';
import { ARCHES, DECOR, FLOORS } from '../../shared/style.mjs';
import { floorMaterial } from './textures.js';
import { levelName, MAX_LEVEL, buildingTier } from '../../shared/progression.mjs';
import { buildDecor } from './decor.js';
import { NavGrid } from './nav.js';
import { Pet } from './pets.js';
import { Screen } from './screens.js';
import { Crew } from './crew.js';

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

const WALL_H = 2.7;
const CUT_SCALE = 0.13;

const FACE_FRONT = 0;
const FACE_BACK = Math.PI;
const FACE_LEFT = -Math.PI / 2;
const FACE_RIGHT = Math.PI / 2;

const overlaps = (a, b) => a[0] < b[2] && a[2] > b[0] && a[1] < b[3] && a[3] > b[1];
/** Interior pieces that step aside for the player's decor (the rest of a floor plan always stays). */
const OPTIONAL = new Set(['plant', 'rug', 'armchair', 'sideTable', 'floorLamp', 'planter', 'bench', 'column', 'tv']);
const ROOM_FLOORS = { tile: [0xe4ddd1, 0xcfc6b8], carpet: [0xc9b7a3, null] };

export class Lot {
  constructor(household, index, seed) {
    this.project = household.project;
    this.residentSlots = new Map(household.characters.map((c,i)=>[c.slot,i+1]));
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
    // Home level upgrades: follow the home's combined resident XP. Each level is a residential tier
    // (home-tier-plans.js / home-tiers.js) with its own facade, upper floors and yard.
    this.level = 0;
    this.plan = tierPlan(1);
    this.levelGroup = new THREE.Group();
    this.levelObstacles = [];
    this.levelGlowMat = new THREE.MeshStandardMaterial({ color: 0xffd28a, emissive: 0xffd28a, emissiveIntensity: 0.15 });
    this.trees = [];
    this.group.add(this.levelGroup);

    this.static = new THREE.Group(); // merged after building
    this.group.add(this.static);
    this.desks = [];
    this.deskCount = 0;
    this.deskBlocks = [];
    this.screens = []; // one monitor per seat, kept across floor plans (residents hold on to theirs)
    this.walls = [];
    this.nightGlows = [];
    this.globes = [];
    this.rackLights = [];
    this.steams = [];
    this.layoutVersion = 0; // bumped when the floor plan changes, so residents re-place themselves
    this.globeSpin = 0;
    this.coffeeBusy = 0;
    this.obstacles = [];
    this.wallMode = 'cutaway';

    this.buildGround();
    this.buildRoom();
    this.buildSign(household);
    const shelf = document.createElement('button');
    shelf.className = 'conversation-shelf';
    shelf.dataset.conversationHome = this.project;
    shelf.hidden = true;
    this.shelfLabel = new CSS2DObject(shelf);
    this.group.add(this.shelfLabel);
    this.shelfEl = shelf;
    this.setLevel(1);
    this.ensureDesks(Math.max(1, household.characters.length));
    mergeStatic(this.static);

    // Night: window light spilling onto the side and back yards (shared fade in models.js); the front
    // windows and doors change with the tier, so their pools live in the tier's yard.
    for (const [w, d, x, z] of [[2.4, 1.6, -5.6, -6.2], [2.4, 1.6, 5.0, -6.2], [1.6, 2.4, -8.2, -3.4], [1.6, 2.4, 8.2, -1.8], [1.6, 2.4, 8.2, 3.2]]) {
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

  setConstruction(build) {
    this.construction = build;
    const active = !!build && Date.parse(build.readyAt) > Date.now();
    if (active && !this.constructionSite) {
      this.constructionSite = new THREE.Group();
      this.constructionSite.add(box(14, .2, 10, 0xbab09b, 0, .1, 0));
      for (const x of [-6, 6]) for (const z of [-4, 4]) this.constructionSite.add(box(.2, 3, .2, PALETTE.wood, x, 1.6, z));
      for (const z of [-4, 4]) this.constructionSite.add(box(12, .2, .2, PALETTE.wood, 0, 3.1, z));
      for (const x of [-6, 6]) this.constructionSite.add(box(.2, .2, 8, PALETTE.wood, x, 3.1, 0));
      this.constructionCrew = new Crew(this.constructionSite);
      const button = document.createElement('button');
      button.className = 'home-construction-sign';
      button.dataset.homeDetail = this.project;
      const label = new CSS2DObject(button);
      label.position.set(0, 4.2, 5);
      this.constructionSite.add(label);
      this.constructionSign = button;
      this.group.add(this.constructionSite);
    }
    if (active) {
      this.constructionHidden ||= new Map();
      for (const child of this.group.children) if (child !== this.constructionSite) {
        if (!this.constructionHidden.has(child)) this.constructionHidden.set(child, child.visible);
        child.visible = false;
      }
    } else if (this.constructionHidden) {
      for (const [child, visible] of this.constructionHidden) child.visible = visible;
      this.constructionHidden = null;
    }
    if (this.constructionSite) this.constructionSite.visible = active;
    this.constructing = active;
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
    if (!this.nav) {
      this.nav = this.makeNav(this.decor.obstacles);
      // Strolling spots in the yard only count when this tier's landscaping leaves them reachable.
      const seen = this.nav.reachableFrom(this.stations.entrance);
      const ok = (s) => {
        const c = this.nav.nearestFree(...this.nav.toCell(s.x, s.z), 2);
        return !!c && !!seen[c[1] * this.nav.w + c[0]];
      };
      const wander = this.allWander.filter((s) => !s.yard || ok(s));
      this.stations.wander.splice(0, this.stations.wander.length, ...(wander.length ? wander : this.allWander));
    }
    return this.nav;
  }

  makeNav(decorRects) {
    const nav = new NavGrid({ x0: -11, z0: -5, x1: 11, z1: 11.5 }, 0.25, 0.25);
    for (const r of this.obstacles) nav.addRect(r);
    for (const r of this.levelObstacles) nav.addRect(r);
    for (const r of this.deskBlocks) nav.addRect(r);
    // Decor that ended up inside a wall or a fixed piece of the floor plan (placed before an upgrade) is
    // drawn but not walled off, so it can never trap residents.
    const fixed = [...(this.fixedBlocks || []), ...this.deskBlocks];
    for (const r of decorRects) if (!fixed.some((f) => overlaps(r, f))) nav.addRect(r);
    return nav;
  }

  /**
   * Show a home's level as its residential tier (1 Cottage … 8 Landmark Residence; docs/concepts/home-tiers).
   * Cosmetic: the level follows the home's pooled resident participation XP (shared/progression.mjs), never
   * reviewed outcomes. Only the shell changes (front facade, upper floors and roof, yard); the ground-floor
   * studio, desks, residents, decor, paint and conversations carry over untouched.
   */
  setLevel(level) {
    level = Math.min(MAX_LEVEL, Math.max(1, Math.floor(level) || 1));
    if (level === this.level) return;
    this.level = level;
    this.plan = tierPlan(level);
    this.buildWalls();
    this.buildRoof();
    this.buildYard();
    this.buildInterior();
    const badge = this.signEl.querySelector('.lot-level');
    badge.textContent = `Lv ${level} · ${levelName(level)}`;
    badge.title = `Home level ${level} of ${MAX_LEVEL}: follows this home's combined resident XP`;
  }

  /** Remove an object built for a tier and free its geometry (shared materials stay cached). */
  disposeObject(obj) {
    if (!obj) return;
    obj.parent?.remove(obj);
    obj.traverse((o) => {
      if (!o.isMesh) return;
      o.geometry.dispose();
      if (o.userData.ownMaterial) o.material.dispose();
    });
  }

  /** Obstacles that change with the tier: front wall segments and door leaves, the floor plan, yard props. */
  refreshLevelObstacles() {
    this.levelObstacles = [...frontWallBlocks(this.plan), ...(this.interiorBlocks || []), ...(this.yardBlocks || [])];
    this.nav = null;
    this.reachCache = null;
  }

  /**
   * The tier's ground-floor plan (home-floorplans.js): partitions, room floors, furniture, stations and desks.
   * Optional pieces (plants, rugs, armchairs…) step aside for the player's decor. Residents keep their seats and
   * monitors; they re-place themselves when the plan changes (layoutVersion).
   */
  buildInterior() {
    const fp = floorplanFor(this.plan.key, this.yardBlocks || [], this.level);
    const decorRects = this.decor.items.map((it) => this.footprint(it.item, it.x, it.z, it.rot));
    const items = fp.items.filter((it) => !(OPTIONAL.has(it.kind) && it.rect && decorRects.some((d) => overlaps(it.rect, d))));
    const key = `${fp.key}|${this.interior}|${items.length}`;
    if (key === this.interiorKey) return;
    const planChanged = fp.key !== this.floorplan?.key;
    this.interiorKey = key;
    this.floorplan = fp;
    this.disposeObject(this.interiorGroup);
    this.disposeObject(this.partitionGroup);
    this.nightGlows = [];
    this.globes = [];
    this.rackLights = [];
    this.steams = [];

    const g = new THREE.Group();
    const dyn = new THREE.Group(); // live parts (globes, steam, glowing lamps) stay out of the static merge
    dyn.userData.dynamic = true;
    // Tiled and carpeted rooms on top of the main floor.
    for (const [, kind, x0, z0, x1, z1] of fp.rooms) {
      const colors = ROOM_FLOORS[kind];
      if (!colors) continue;
      const [base, grout] = colors;
      const w = x1 - x0;
      const d = z1 - z0;
      const tint = kind === 'carpet' ? new THREE.Color(this.interior).lerp(new THREE.Color(base), 0.7).getHex() : base;
      g.add(Object.assign(box(w, 0.012, d, tint, (x0 + x1) / 2, 0.126, (z0 + z1) / 2), { castShadow: false }));
      if (grout) {
        for (let x = x0 + 0.5; x < x1 - 0.05; x += 0.5) g.add(Object.assign(box(0.02, 0.014, d, grout, x, 0.127, (z0 + z1) / 2), { castShadow: false }));
        for (let z = z0 + 0.5; z < z1 - 0.05; z += 0.5) g.add(Object.assign(box(w, 0.014, 0.02, grout, (x0 + x1) / 2, 0.127, z), { castShadow: false }));
      }
    }
    items.forEach((it, i) => {
      const seed = this.seed + 31 + i * 7;
      let obj;
      let rot = 0;
      let live = false;
      switch (it.kind) {
        case 'bookshelf': obj = buildBookshelf(seed); rot = -Math.PI / 2; break;
        case 'whiteboard': obj = buildWhiteboard(); rot = -Math.PI / 2; break;
        case 'globe': { const b = buildGlobe(); obj = mergeStatic(b.group); this.globes.push(b.spinner); live = true; break; }
        case 'rack': { const b = buildRack(); obj = mergeStatic(b.group); this.rackLights.push(...b.lights); live = true; break; }
        case 'coffeeBar': { const b = buildCoffeeBar(); obj = mergeStatic(b.group); this.steams.push(b.steam); rot = Math.PI / 2; live = true; break; }
        case 'kitchen': { const b = buildKitchen(it.len ?? 3, it.coffee ?? null); obj = b.group; if (b.steam) { mergeStatic(obj); this.steams.push(b.steam); live = true; } break; }
        case 'couch': obj = buildCouch(seed); break;
        case 'loveseat': obj = buildLoveseat(seed); break;
        case 'armchair': obj = buildArmchair(seed); break;
        case 'sideTable': obj = buildSideTable(); break;
        case 'floorLamp': { const b = buildFloorLamp(); obj = mergeStatic(b.group); this.nightGlows.push(b.shade); live = true; break; }
        case 'plant': obj = buildPlant(0, 0, seed); break;
        case 'rug': obj = buildRug(it.w ?? 2, it.d ?? 2, PALETTE.rug, 0, 0); break;
        case 'bed': obj = buildBed(seed); break;
        case 'fridge': obj = buildFridge(); break;
        case 'dining': obj = buildDining(seed); break;
        case 'fireplace': { const b = buildFireplace(); obj = mergeStatic(b.group); this.nightGlows.push(b.glow); live = true; break; }
        case 'tv': obj = buildTV(); break;
        case 'reception': obj = buildReception(it.w ?? 2.6); break;
        case 'mailboxes': obj = buildMailboxes(); break;
        case 'elevator': { const b = buildElevator(it.w ?? 2.2); obj = mergeStatic(b.group); this.nightGlows.push(b.glow); live = true; break; }
        case 'stairs': obj = buildStairs(it.len ?? 2.6, it.w ?? 1.0); break;
        case 'bath': obj = buildBath(); break;
        case 'wardrobe': obj = buildWardrobe(); break;
        case 'laundry': obj = buildLaundry(); break;
        case 'lockers': obj = buildLockers(); break;
        case 'bench': obj = buildBench(); break;
        case 'column': obj = buildColumn(); break;
        case 'planter': obj = buildPlanter(seed); break;
        default: return;
      }
      obj.position.set(it.x, 0, it.z);
      obj.rotation.y = (YAW[it.facing] ?? 0) + rot;
      (live ? dyn : g).add(obj);
    });
    // Wall art on the outer walls.
    fp.art.forEach(([x, z, facing], i) => {
      const art = buildWallArt(this.seed + 11 + i, i ? 0.8 : 1.0, i ? 0.6 : 0.75);
      art.rotation.y = YAW[facing] - Math.PI / 2;
      art.position.set(x, 1.95, z);
      g.add(art);
    });
    mergeStatic(g);
    g.add(dyn);
    this.interiorGroup = g;
    this.group.add(g);

    // Interior partitions, lowered with the cutaway walls so residents stay in view.
    const pg = new THREE.Group();
    pg.userData.dynamic = true;
    const trimColor = new THREE.Color(this.interior).multiplyScalar(0.55).getHex();
    for (const [x0, z0, x1, z1] of fp.partitions) {
      const w = x1 - x0;
      const d = z1 - z0;
      pg.add(box(w, WALL_H - 0.05, d, this.interior, (x0 + x1) / 2, (WALL_H - 0.05) / 2, (z0 + z1) / 2));
      pg.add(box(w + 0.02, 0.12, d + 0.02, trimColor, (x0 + x1) / 2, 0.06, (z0 + z1) / 2));
      pg.add(box(w + 0.04, 0.06, d + 0.04, PALETTE.trim, (x0 + x1) / 2, WALL_H - 0.04, (z0 + z1) / 2));
    }
    mergeStatic(pg);
    pg.userData.scale = 1;
    this.partitionGroup = pg;
    this.group.add(pg);

    // Stations, obstacles and the conversation shelf by the first bookshelf.
    this.stations = fp.stations;
    this.allWander = [...fp.stations.wander];
    const shelfItem = items.find((it) => it.kind === 'bookshelf');
    this.shelfLabel.position.set(shelfItem?.x ?? 0, 2.2, shelfItem?.z ?? 0);
    // Fixed ground: walls, the plan's main furniture, and the approach to every front door (decor placed there
    // under an earlier tier stays drawn but never walls residents out).
    const approaches = doorsOf(this.plan).map((d) => [d.x - d.w / 2, 5.2, d.x + d.w / 2, 6.7]);
    this.fixedBlocks = [...fp.partitions, ...approaches, ...items.filter((it) => it.rect && !OPTIONAL.has(it.kind)).map((it) => it.rect)];
    this.interiorBlocks = [...fp.partitions, ...items.map((it) => it.rect).filter(Boolean)];
    this.claims = new Map();
    if (planChanged) {
      this.layoutVersion++;
      const ids = this.galleryIds || [];
      this.galleryKey = null;
      this.setGallery(ids);
    }
    this.refreshLevelObstacles(); // before the desks: extra residents' desks are fitted around this plan
    this.rebuildDesks();
  }

  /** The tier's yard: fence, paths, beds and trees. Props that would sit on the player's decor are left out. */
  buildYard() {
    const props = yardProps(this.plan, this.decor.items.map((it) => this.footprint(it.item, it.x, it.z, it.rot)));
    const key = `${this.plan.key}|${JSON.stringify(props)}`;
    if (key === this.yardKey) return;
    this.yardKey = key;
    this.disposeObject(this.yardGroup);
    for (const t of this.trees) this.disposeObject(t);
    const built = buildYard(this.plan, this, props, this.levelGlowMat, rng(this.seed + this.level * 101));
    mergeStatic(built.group);
    this.yardGroup = built.group;
    this.levelGroup.add(built.group);
    this.yardGlows = built.glows;
    // Trees sway, so they stay out of the static merge.
    this.trees = built.trees;
    for (const t of this.trees) this.group.add(t);
    this.yardBlocks = props.blocking.map(([, ...r]) => r);
    this.refreshLevelObstacles();
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
      if (this.level) this.buildInterior();
      this.signEl.querySelector('.lot-dot').style.background = `#${exterior.toString(16).padStart(6, '0')}`;
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
    this.galleryIds = ids;
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
      // On the floor plan's gallery wall (a free stretch of the back wall).
      const [gx, gz] = this.floorplan?.gallery || [-0.25, -4.96];
      frame.position.set(gx + (i - (ids.length - 1) / 2) * 0.55, 2.0 + (i % 2 ? -0.06 : 0.04), gz);
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
    if (this.level) {
      this.buildYard();
      this.buildInterior();
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
    if (this.obstacles.some(overlaps) || this.levelObstacles.some(overlaps) || this.deskBlocks.some(overlaps) || others.some(overlaps)) return { ok: false, reason: 'Something is already there' };

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
    ].filter(Boolean);
  }

  /** Decor item under a raycast hit object, if any. */
  decorAt(object) {
    const id = object?.userData?.decorId;
    return id ? this.decor.items.find((it) => it.id === id) : null;
  }

  // ---- Outside ------------------------------------------------------------------------

  buildGround() {
    const grass = box(22, 0.1, 20, PALETTE.grassLot, 0, 0, 0);
    grass.castShadow = false;
    this.add(grass);

    // Fence lines around the yard, open at the gate. Each tier draws its own fence style (home-tiers.js) on the
    // same footprint; it stops short of the lot-side sidewalks (which start at z ±7.7).
    for (const [x0, z0, x1, z1] of [[-10.8, YARD_Z, -1.2, YARD_Z], [1.2, YARD_Z, 10.8, YARD_Z], [-10.8, -YARD_Z, -10.8, YARD_Z], [10.8, -YARD_Z, 10.8, YARD_Z]]) {
      this.block(Math.min(x0, x1) - 0.12, Math.min(z0, z1) - 0.12, Math.max(x0, x1) + 0.12, Math.max(z0, z1) + 0.12);
    }

    // Mailbox by the gate.
    this.add(box(0.08, 1.0, 0.08, PALETTE.wood, 1.62, 0.5, 7.0));
    this.add(softBox(0.42, 0.3, 0.24, 0x4f6d8f, 1.62, 1.08, 7.0, 0.08));
    this.add(box(0.03, 0.22, 0.03, 0xd94f4f, 1.85, 1.2, 6.96));
    this.add(box(0.1, 0.05, 0.03, 0xd94f4f, 1.9, 1.29, 6.96));
  }

  // ---- Room ---------------------------------------------------------------------------

  buildRoom() {
    this.glass = new THREE.MeshStandardMaterial({ map: glassTexture(), roughness: 0.08, metalness: 0.05, transparent: true, opacity: 0.82, emissive: 0xffcf8a, emissiveIntensity: 0 });
    this.buildFloor('oak');
    // Walls and the upper stack are built by setLevel for the home's tier. The front wall's openings
    // change with the tier, so its obstacles are tier obstacles (frontWallBlocks).
    this.block(-7.25, -5.25, -6.95, 5.25);
    this.block(-7.25, -5.25, 7.25, -4.95);
    this.block(6.95, -5.25, 7.25, 5.25);
    // Furniture, partitions and wall art come from the tier's floor plan (buildInterior).
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

  /** The four ground-floor walls in the current colors and tier facade, rebuilt when repainted or upgraded. */
  buildWalls() {
    for (const w of this.walls) this.disposeObject(w);
    this.walls = [];
    this.facadeGlows = [];
    const plan = this.plan;
    const glassMat = this.glass;
    const wainscot = new THREE.Color(this.interior).multiplyScalar(0.8).getHex();
    const baseboard = new THREE.Color(this.interior).multiplyScalar(0.55).getHex();
    // Outside walls get clapboard lines (fx.js) on clapboard tiers; a slightly different roughness keeps the material separate.
    const siding = mat(this.exterior, { roughness: 0.83 });
    siding.userData.siding = this.arch === 'modern' ? 0 : plan.siding;
    const shutterColor = new THREE.Color(this.exterior).multiplyScalar(0.55).getHex();
    const shutters = plan.key === 'cottage' || this.arch === 'cottage' || this.arch === 'barn';

    /**
     * A wall segment along x or z (from its outward normal) with window and door openings
     * ({ kind, x, w, box, color }; x runs along the wall), as a group that can be lowered to a stub
     * when it faces the camera.
     */
    const makeWall = (normal, center, length, openingList, side) => {
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
      // Cut openings for windows (y 1.0–2.05) and doors (y 0–2.15).
      const half = length / 2;
      const openings = openingList.map((o) => (o.kind === 'door' ? [o.x - o.w / 2, o.x + o.w / 2, 0, 2.15] : [o.x - o.w / 2, o.x + o.w / 2, 1.0, 2.05]));
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
      for (const o of openingList.filter((o) => o.kind === 'window')) {
        const win = new THREE.Group();
        const ww = o.w;
        const frame = (w, h, d, ox, oy, color = PALETTE.trim, on = 0) => win.add(along === 'x' ? box(w, h, d, color, ox, oy, normal.z * on) : box(d, h, w, color, normal.x * on, oy, ox));
        frame(ww + 0.1, 0.08, 0.3, 0, 0.98);
        frame(ww + 0.1, 0.08, 0.26, 0, 2.08);
        frame(0.08, 1.1, 0.26, -ww / 2 - 0.02, 1.53);
        frame(0.08, 1.1, 0.26, ww / 2 + 0.02, 1.53);
        frame(0.05, 1.05, 0.22, 0, 1.53);
        if (shutters) for (const sx of [-1, 1]) frame(Math.min(0.5, ww * 0.32), 1.15, 0.05, sx * (ww / 2 + Math.min(0.32, ww * 0.2)), 1.53, shutterColor, 0.14);
        if (o.box) {
          // A flower box under the sill.
          frame(ww + 0.1, 0.2, 0.24, 0, 0.84, PALETTE.wood, 0.22);
          for (let k = 0; k < Math.max(3, Math.round(ww / 0.3)); k++) {
            const fx = -ww / 2 + 0.12 + k * 0.3;
            if (fx > ww / 2) break;
            const at = along === 'x' ? [fx, 1.0, normal.z * 0.24] : [normal.x * 0.24, 1.0, fx];
            win.add(ico(0.1, PALETTE.leafDark, ...at), ico(0.06, PALETTE.flowers[k % PALETTE.flowers.length], at[0] + (along === 'x' ? 0.04 : normal.x * 0.05), 1.08, at[2] + (along === 'x' ? normal.z * 0.05 : 0.04)));
          }
        }
        const pane = new THREE.Mesh(along === 'x' ? new THREE.BoxGeometry(ww, 1.05, 0.03) : new THREE.BoxGeometry(0.03, 1.05, ww), glassMat);
        pane.position.y = 1.53;
        win.add(pane);
        if (along === 'x') win.position.x = o.x;
        else win.position.z = o.x;
        win.userData.dynamic = true;
        mergeStatic(win); // frames, shutters and pane: a few draws per window instead of ~10
        g.add(win);
        g.userData.windows.push(win);
      }
      for (const o of openingList.filter((o) => o.kind === 'door')) {
        const frame = (w, h, ox, oy) => g.add(along === 'x' ? box(w, h, 0.28, PALETTE.trim, ox, oy, 0) : box(0.28, h, w, PALETTE.trim, 0, oy, ox));
        frame(0.1, 2.2, o.x - o.w / 2 - 0.05, 1.1);
        frame(0.1, 2.2, o.x + o.w / 2 + 0.05, 1.1);
        frame(o.w + 0.2, 0.1, o.x, 2.18);
        // An open door, swung in against its hinge (the footprint matches leafRect in home-tier-plans.js).
        const len = 5.0 - leafRect(o)[1];
        const hinge = new THREE.Group();
        hinge.position.set(o.x + o.w / 2 - 0.02, 0, -0.14);
        hinge.rotation.y = -Math.PI / 2 * 0.96;
        const doorColor = o.color ?? new THREE.Color(this.exterior).multiplyScalar(0.62).getHex();
        hinge.add(softBox(len, 2.1, 0.06, doorColor, -len / 2, 1.05, 0, 0.02));
        for (const y of [0.55, 1.45]) hinge.add(box(len * 0.8, 0.6, 0.02, new THREE.Color(doorColor).multiplyScalar(0.85).getHex(), -len / 2, y, 0.035));
        hinge.add(cyl(0.035, 0.035, 0.08, 0xd9b55a, 10, -len * 0.92, 1.0, 0.07));
        g.add(hinge);
      }
      // Tier details on the outside: quoins, plinth, lanterns, the bay window and entrance portals.
      const extra = facadeExtras(plan, this, side, length, this.levelGlowMat);
      for (const o of extra.objects) g.add(o);
      this.facadeGlows.push(...extra.glows);

      mergeStatic(g);
      g.position.set(center.x, 0, center.z);
      g.userData.normal = normal;
      g.userData.scale = 1;
      this.group.add(g);
      this.walls.push(g);
      return g;
    };

    const win = (x) => ({ kind: 'window', x, w: 1.6 });
    makeWall(new THREE.Vector3(0, 0, -1), new THREE.Vector3(0, 0, -5.1), 14.4, [win(-5.6), win(5.0)], 'back');
    makeWall(new THREE.Vector3(-1, 0, 0), new THREE.Vector3(-7.1, 0, 0), 10.0, [win(-3.4)], 'left');
    makeWall(new THREE.Vector3(1, 0, 0), new THREE.Vector3(7.1, 0, 0), 10.0, [win(-1.8), win(3.2)], 'right');
    makeWall(new THREE.Vector3(0, 0, 1), new THREE.Vector3(0, 0, 5.1), 14.4, plan.front, 'front');
  }

  /**
   * The tier's upper floors and roof (home-tiers.js), sitting on the walls at GROUND_H. Shown from afar;
   * lot.update lifts the whole stack away as you zoom in so the studio and its residents stay visible.
   */
  buildRoof() {
    this.disposeObject(this.roof);
    const built = buildUpper(this.plan, this, rng(this.seed + 7 + this.level * 13));
    const g = built.group;
    mergeStatic(g);
    g.position.y = GROUND_H;
    g.visible = false;
    this.roof = g;
    this.smoke = built.smoke;
    this.roofTop = GROUND_H + built.top;
    this.group.add(g);
  }

  /** Desks for n residents (up to fifteen), at the floor plan's seats; extra residents get a free spot. */
  ensureDesks(n) {
    this.deskCount = Math.max(this.deskCount, Math.min(Math.max(1, n), MAX_LEVEL));
    while (this.desks.length < this.deskCount) if (!this.addDesk(this.desks.length)) break;
  }

  rebuildDesks() {
    this.disposeObject(this.deskGroup);
    this.deskGroup = new THREE.Group();
    this.group.add(this.deskGroup);
    this.desks = [];
    this.deskBlocks = [];
    this.deskGlows = [];
    this.ensureDesks(this.deskCount);
  }

  /** Seat i: the floor plan's desk, or the first free spot that fits a desk and its chair. */
  addDesk(i) {
    const layout = this.floorplan.desks[i] || this.overflowDesk();
    if (!layout) return false;
    const screen = (this.screens[i] ||= new Screen());
    const desk = buildDesk(i, screen);
    desk.group.position.set(layout.x, 0, layout.z);
    desk.group.rotation.y = layout.yaw;
    this.deskGroup.add(mergeStatic(desk.group));
    this.nightGlows.push(desk.lamp);
    this.deskGlows.push(desk.lamp);
    const chair = mergeStatic(buildChair());
    const [cx, cz] = rotate(0, 0.82, layout.yaw);
    chair.position.set(layout.x + cx, 0, layout.z + cz);
    chair.rotation.y = layout.yaw + Math.PI;
    this.deskGroup.add(chair);
    this.deskBlocks.push(layout.block);
    // Visiting helpers stand at the user's right with a laptop, facing the desk.
    this.desks.push({ screen, chair: layout.chair, guests: layout.guests, wait: layout.wait, visitorWait: layout.visitorWait });
    this.nav = null;
    this.reachCache = null;
    return true;
  }

  /**
   * A desk for a resident beyond the floor plan's seats: the first spot that fits a desk with its chair and
   * keeps every existing desk, station and doorway reachable from the street.
   */
  overflowDesk() {
    const taken = [...this.obstacles, ...this.levelObstacles, ...this.deskBlocks, ...this.decor.obstacles];
    const clearAt = (s) => s.x > -6.7 && s.x < 6.7 && s.z > -4.7 && s.z < 4.6 && !taken.some((r) => s.x > r[0] - 0.3 && s.x < r[2] + 0.3 && s.z > r[1] - 0.3 && s.z < r[3] + 0.3);
    const reach = (nav) => {
      const seen = nav.reachableFrom(this.stations.entrance);
      return (s, r = 4) => {
        const c = nav.nearestFree(...nav.toCell(s.x, s.z), r);
        return !!c && !!seen[c[1] * nav.w + c[0]];
      };
    };
    const now = reach(this.makeNav(this.decor.obstacles));
    const needed = this.keySpots().filter((s) => now(s));
    for (let z = -3.4; z <= 2.6; z += 0.5) {
      for (let x = -5.6; x <= 5.6; x += 0.5) {
        for (const look of ['n', 'e', 'w']) {
          const d = deskLayout(x, z, look);
          const [x0, z0, x1, z1] = d.block;
          if (x0 < -6.95 || x1 > 6.95 || z0 < -4.95 || z1 > 4.95) continue;
          if (taken.some((r) => x0 < r[2] + 0.05 && x1 > r[0] - 0.05 && z0 < r[3] + 0.05 && z1 > r[1] - 0.05)) continue;
          if (![d.chair, d.wait, d.visitorWait].every(clearAt)) continue;
          this.deskBlocks.push(d.block);
          const after = reach(this.makeNav(this.decor.obstacles));
          this.deskBlocks.pop();
          if ([d.chair, d.wait, d.visitorWait].every((s) => after(s, 1)) && needed.every((s) => after(s))) return d;
        }
      }
    }
    return null;
  }

  desk(slot) {
    const seat=this.residentSlots?.get(slot)||slot;
    this.ensureDesks(seat);
    return this.desks[(seat - 1) % this.desks.length];
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
    el.setAttribute('aria-label', `Open home overview for ${household.name}`);
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
  update(dt, t, { camera, night, busy, avatar = null, clearView = false, peekOpen = 76 }) {
    if (this.constructing) {
      this.setConstruction(this.construction);
      if (this.constructing) {
        this.constructionCrew.update(dt, t);
        const minutes = Math.ceil((Date.parse(this.construction.readyAt) - Date.now()) / 60000);
        this.constructionSign.textContent = `${this.name} · Building · ${minutes} min`;
        return;
      }
    }
    this.pet?.update(dt, t, avatar);
    if (this.globeSpin > 0) for (const globe of this.globes) globe.rotation.y += dt * 2.5;
    this.globeSpin = 0;

    this.rackLights.forEach((l, i) => {
      l.visible = busy ? Math.sin(t * (7 + (i % 5)) + i * 1.7) > -0.3 : i % 3 === 0;
    });


    // Coffee steam: a lazy loop of puffs while someone is at the bar.
    const steaming = this.coffeeBusy > 0;
    this.coffeeBusy = 0;
    for (const steam of this.steams) steam.children.forEach((puff) => {
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
    this.levelGlowMat.emissiveIntensity = 0.15 + night * 2.5; // door lanterns and yard lamps

    // Night: interior light, window glow, lamps. Each home switches on at its own moment around dusk,
    // so the street lights up house by house instead of all at once.
    this.lightsAt ??= 0.18 + (Math.abs([...this.project].reduce((h, ch) => (Math.imul(h, 33) + ch.charCodeAt(0)) | 0, 5)) % 100) / 100 * 0.42;
    const lit = THREE.MathUtils.smoothstep(night, this.lightsAt, this.lightsAt + 0.08) * night;
    this.lamp.intensity = lit * 14;
    this.glass.emissiveIntensity = lit * 0.9;
    this.glass.opacity = 0.82 + night * 0.12;
    for (const glow of this.nightGlows) glow.material.emissiveIntensity = (glow.userData.dayGlow ?? 0) + lit * (glow.userData.nightGlow ?? 1);

    // Roof: shown when you're zoomed out, lifting away as you zoom in so the room (and the truth inside it)
    // is always visible up close.
    const center = this.group.position;
    const camDist = camera.position.distanceTo(center);
    // The roof is either on or off (never parked half-lifted). The home in the middle of the screen (`peek`)
    // opens up from farther out so you can look inside; the gap between thresholds stops flicker.
    // Tall tiers also open while they stand between the camera and the home you're looking at (`clearView`).
    // Zoomed all the way out, even the centered home shows its whole building.
    const openBelow = this.peek ? Math.max(48, peekOpen) : 48;
    if (!this.roofAllowed || this.wallMode === 'down' || clearView) this.roofOn = false;
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
      // Taller stacks lift farther so their lowest floor clears the residents' heads quickly.
      const lift = 5 + Math.max(0, (this.roofTop || 0) - 8) * 0.35;
      this.roof.position.y = GROUND_H + (1 - Math.min(k, 1)) * lift + this.hoverK * 0.45 * Math.min(k, 1);
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
    // Interior partitions drop to a low stub whenever the room is open (cutaway or walls down).
    if (this.partitionGroup) {
      const pg = this.partitionGroup;
      const target = this.roofK > 0.3 || this.wallMode === 'up' ? 1 : 0.16;
      pg.userData.scale += (target - pg.userData.scale) * (1 - Math.exp(-dt * 7));
      pg.scale.y = pg.userData.scale;
    }
  }

  /** Lot-local → world. */
  toWorld(x, z) {
    return new THREE.Vector3(x + this.group.position.x, 0, z + this.group.position.z);
  }
}

