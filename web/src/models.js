// Low-poly model builders: stylized, flat-shaded, no external assets.

import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { patchCharacterMaterial } from './fx.js';

export const PALETTE = {
  grass: 0x86c06a,
  grassLot: 0x97cf78,
  grassDark: 0x6faa57,
  asphalt: 0x7f7c8c,
  sidewalk: 0xe9e0d2,
  curb: 0xcfc4b4,
  roadLine: 0xf6f0e2,
  floor: 0xd8a66c,
  floorAlt: 0xcd9a60,
  wallIn: 0xf7f0e6,
  trim: 0xfffaf2,
  baseboard: 0xe9dccb,
  wood: 0x8f5f3e,
  woodMid: 0xb07a4f,
  woodLight: 0xd5a676,
  chair: 0x3f4a63,
  chairSeat: 0x5a6b8f,
  dark: 0x2a2f3c,
  metal: 0xa9b1bd,
  screen: 0x7fd3ff,
  shelf: 0x7a4f34,
  books: [0xe76f51, 0xf4a261, 0x2a9d8f, 0xe9c46a, 0x5a7d9a, 0xb56576, 0x6d597a, 0x88b04b],
  couch: 0x5f86c4,
  couchDark: 0x4d70aa,
  pillow: [0xf2c14e, 0xf78154, 0xe9e3d5],
  rug: 0xe8a598,
  leaf: 0x5aae5f,
  leafLight: 0x7cc46b,
  leafDark: 0x3f8a4f,
  trunk: 0x7b5236,
  pot: 0xd27f55,
  potAlt: 0xe9e3d5,
  white: 0xfbfbfb,
  globeSea: 0x4d9de0,
  globeLand: 0x7cc47a,
  flowers: [0xff8fab, 0xffd166, 0xf1faee, 0xc77dff, 0xff6b6b],
  lamp: 0xfff1c9,
};

/** Interior wallpaper tones; each lot gets one (wainscot uses a darker shade). */
export const INTERIORS = [0xf6eee2, 0xe9f1e4, 0xf1e9f4, 0xe6eff6, 0xf8eadf, 0xf3f0e3];

/** A soft round contact shadow to ground characters (shared texture). */
let blobTex = null;
export function buildContactShadow(radius = 0.45, opacity = 0.42) {
  if (!blobTex) {
    const c = document.createElement('canvas');
    c.width = c.height = 64;
    const g = c.getContext('2d');
    const grad = g.createRadialGradient(32, 32, 0, 32, 32, 32);
    grad.addColorStop(0, 'rgba(0,0,0,1)');
    grad.addColorStop(0.5, 'rgba(0,0,0,0.55)');
    grad.addColorStop(1, 'rgba(0,0,0,0)');
    g.fillStyle = grad;
    g.fillRect(0, 0, 64, 64);
    blobTex = new THREE.CanvasTexture(c);
  }
  const m = new THREE.Mesh(
    new THREE.PlaneGeometry(radius * 2, radius * 2),
    new THREE.MeshBasicMaterial({ map: blobTex, transparent: true, opacity, depthWrite: false, color: 0x1a1430 }),
  );
  m.rotation.x = -Math.PI / 2;
  m.position.y = 0.02;
  m.renderOrder = 1;
  return m;
}

/** Glass with a painted sky reflection and diagonal highlights (shared texture). */
let glassTex = null;
export function glassTexture() {
  if (glassTex) return glassTex;
  const c = document.createElement('canvas');
  c.width = c.height = 128;
  const g = c.getContext('2d');
  const grad = g.createLinearGradient(0, 0, 0, 128);
  grad.addColorStop(0, '#f2f9ff');
  grad.addColorStop(0.55, '#bfdcf3');
  grad.addColorStop(1, '#9cc4e4');
  g.fillStyle = grad;
  g.fillRect(0, 0, 128, 128);
  g.fillStyle = 'rgba(255,255,255,0.65)';
  for (const [x, w] of [[22, 16], [52, 6], [88, 22]]) {
    g.beginPath();
    g.moveTo(x, 0);
    g.lineTo(x + w, 0);
    g.lineTo(x + w - 40, 128);
    g.lineTo(x - 40, 128);
    g.fill();
  }
  glassTex = new THREE.CanvasTexture(c);
  glassTex.colorSpace = THREE.SRGBColorSpace;
  return glassTex;
}

/** Exterior wall colors; each lot gets one. */
export const EXTERIORS = [0xa9c9a4, 0xe6ae94, 0x9fc4e6, 0xf0d58f, 0xc7b8e6, 0xf2b5c4];

export const PLUMBOB_COLORS = {
  working: 0x3ee07a,
  waiting: 0xffc61a,
  error: 0xff4d4d,
  off_duty: 0xa4abb8,
};

export const PROVIDER_COLORS = {
  anthropic: 0xd97757,
  openai: 0x10a37f,
};

const SKIN = [0xf8d5bb, 0xeebd98, 0xd39a6f, 0xa86f48, 0x7a4c30, 0x5a3622];
const HAIR = [0x2b2118, 0x4a2f1d, 0x8b4a24, 0xd8b26a, 0xb9bec7, 0x23314f, 0xc0566b, 0x6b4ea8];
const SHIRT = [0xef8354, 0x4f86c6, 0x5fbf73, 0xe6c84f, 0x9b7ede, 0xe56b8a, 0x3fb7b0, 0xf2a65a, 0xf4f1ea, 0x334155];
const PANTS = [0x34405a, 0x5b4636, 0x2f3b2f, 0x4b4b63, 0x6b5b4b, 0x22252e, 0x7b8fa6];

// ---- Light pools ------------------------------------------------------------------

/**
 * Warm light spilling onto the ground at night (windows, doors, shop fronts). One shared additive
 * material; `setLightPools(night)` fades them all in and out.
 */
let poolMat = null;
function lightPoolMaterial() {
  if (poolMat) return poolMat;
  const c = document.createElement('canvas');
  c.width = c.height = 64;
  const g = c.getContext('2d');
  const grad = g.createRadialGradient(32, 32, 0, 32, 32, 32);
  grad.addColorStop(0, 'rgba(255,255,255,1)');
  grad.addColorStop(0.45, 'rgba(255,255,255,0.45)');
  grad.addColorStop(1, 'rgba(255,255,255,0)');
  g.fillStyle = grad;
  g.fillRect(0, 0, 64, 64);
  poolMat = new THREE.MeshBasicMaterial({ map: new THREE.CanvasTexture(c), color: 0xff9440, transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false, fog: false });
  return poolMat;
}
export function buildLightPool(w, d, x, y, z) {
  const m = new THREE.Mesh(new THREE.PlaneGeometry(w, d), lightPoolMaterial());
  m.rotation.x = -Math.PI / 2;
  m.position.set(x, y, z);
  m.renderOrder = 2;
  m.userData.dynamic = true;
  return m;
}
export function setLightPools(night) {
  lightPoolMaterial().opacity = Math.max(0, night - 0.15) * 0.6;
}

// ---- Materials and primitives ----------------------------------------------------

const materials = new Map();
export function mat(color, { roughness = 0.85, metalness = 0, emissive = 0, emissiveIntensity = 1, flat = true } = {}) {
  const key = `${color}|${roughness}|${metalness}|${emissive}|${emissiveIntensity}|${flat}`;
  let m = materials.get(key);
  if (!m) {
    m = new THREE.MeshStandardMaterial({ color, flatShading: flat, roughness, metalness, emissive, emissiveIntensity });
    materials.set(key, m);
  }
  return m;
}

function shadowed(mesh, cast = true, receive = true) {
  mesh.castShadow = cast;
  mesh.receiveShadow = receive;
  return mesh;
}

export function box(w, h, d, color, x = 0, y = 0, z = 0, opts) {
  const m = shadowed(new THREE.Mesh(new THREE.BoxGeometry(w, h, d), opts?.material || mat(color, opts)));
  m.position.set(x, y, z);
  return m;
}

/** A box with bevelled vertical edges (an 8-sided prism), softer than a plain box. */
export function softBox(w, h, d, color, x = 0, y = 0, z = 0, bevel = 0.06, opts) {
  const shape = new THREE.Shape();
  const hw = w / 2;
  const hd = d / 2;
  const b = Math.min(bevel, hw * 0.9, hd * 0.9);
  shape.moveTo(-hw + b, -hd);
  shape.lineTo(hw - b, -hd);
  shape.lineTo(hw, -hd + b);
  shape.lineTo(hw, hd - b);
  shape.lineTo(hw - b, hd);
  shape.lineTo(-hw + b, hd);
  shape.lineTo(-hw, hd - b);
  shape.lineTo(-hw, -hd + b);
  shape.closePath();
  const geo = new THREE.ExtrudeGeometry(shape, { depth: h, bevelEnabled: false });
  geo.rotateX(-Math.PI / 2);
  geo.translate(0, -h / 2, 0);
  const m = shadowed(new THREE.Mesh(geo, opts?.material || mat(color, opts)));
  m.position.set(x, y, z);
  return m;
}

export function cyl(rTop, rBottom, h, color, segments = 8, x = 0, y = 0, z = 0, opts) {
  const m = shadowed(new THREE.Mesh(new THREE.CylinderGeometry(rTop, rBottom, h, segments), opts?.material || mat(color, opts)));
  m.position.set(x, y, z);
  return m;
}

export function ico(r, color, x = 0, y = 0, z = 0, detail = 0, opts) {
  const m = shadowed(new THREE.Mesh(new THREE.IcosahedronGeometry(r, detail), opts?.material || mat(color, opts)));
  m.position.set(x, y, z);
  return m;
}

/** Deterministic PRNG for looks and scenery. */
export function rng(seed) {
  let s = seed >>> 0 || 1;
  return () => {
    s ^= s << 13;
    s ^= s >>> 17;
    s ^= s << 5;
    return ((s >>> 0) % 100000) / 100000;
  };
}

// ---- Merging helpers ----------------------------------------------------------------
//
// Plain single-color materials are merged across colors: each mesh's color is baked into a vertex color
// and the result shares one material per (roughness, metalness, shading). Anything special keeps its own
// material: textures, transparency, glow, surface-detail flags (fx.js), and seasonal foliage/ground
// colors (seasons.js recolors those materials in place).

export const SEASONAL_COLORS = new Set([
  PALETTE.leaf, PALETTE.leafLight, PALETTE.leafDark, 0x4c9a59, 0x9bd06b, 0x7fb866, 0x6aa65a, 0x8fc477, 0x5f9b57, 0x6fb257,
  PALETTE.grassLot, 0x8fca70,
]);
const vcMaterials = new Map();
function bakeable(m) {
  if (!m?.isMeshStandardMaterial || m.isMeshPhysicalMaterial || m.map || m.transparent || m.vertexColors || m.opacity !== 1 || m.side !== THREE.FrontSide) return false;
  if (m.emissive.getHex() !== 0 || m.envMap || m.normalMap) return false;
  const u = m.userData;
  if (u.mottle || u.asphalt || u.siding || u.bands || u.sway || u.noBake || u.skyline) return false;
  return !SEASONAL_COLORS.has(u.baseColor ?? m.color.getHex());
}
function vcMaterial(m) {
  const key = `${m.roughness}|${m.metalness}|${m.flatShading}|${m.userData.rim ? 1 : 0}`;
  let vc = vcMaterials.get(key);
  if (!vc) {
    vc = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: m.roughness, metalness: m.metalness, flatShading: m.flatShading });
    if (m.userData.rim) patchCharacterMaterial(vc);
    vcMaterials.set(key, vc);
  }
  return vc;
}
/** Bucket key and target material for a mesh being merged. */
function bucketFor(o) {
  if (bakeable(o.material)) {
    const material = vcMaterial(o.material);
    return { key: `vc|${material.uuid}|${o.castShadow}`, material, color: o.material.color };
  }
  return { key: `${o.material.uuid}|${o.castShadow}`, material: o.material, color: null };
}
/** A non-indexed copy of a geometry in a target space, with only the attributes merging needs. */
function prepGeometry(geometry, matrix, color, keepColor = false) {
  const g = geometry.index ? geometry.toNonIndexed() : geometry.clone();
  // Keep baked vertex colors when re-merging something that was already merged (e.g. a parked car into its street).
  const keep = keepColor && g.attributes.color ? ['position', 'normal', 'uv', 'color'] : ['position', 'normal', 'uv'];
  for (const name of Object.keys(g.attributes)) if (!keep.includes(name)) g.deleteAttribute(name);
  if (!g.attributes.uv) g.setAttribute('uv', new THREE.BufferAttribute(new Float32Array(g.attributes.position.count * 2), 2));
  g.applyMatrix4(matrix);
  if (color) {
    const n = g.attributes.position.count;
    const c = new Float32Array(n * 3);
    for (let i = 0; i < n; i++) c.set([color.r, color.g, color.b], i * 3);
    g.setAttribute('color', new THREE.BufferAttribute(c, 3));
  }
  return g;
}

/**
 * Merge every static mesh under `group` into as few meshes as possible (fewer draw calls).
 * Meshes flagged `userData.dynamic` (or under a dynamic parent) are left alone.
 */
export function mergeStatic(group) {
  group.updateMatrixWorld(true);
  const inv = new THREE.Matrix4().copy(group.matrixWorld).invert();
  const buckets = new Map();
  const remove = [];
  group.traverse((o) => {
    if (!o.isMesh || o.userData.dynamic || o.isInstancedMesh) return;
    let dyn = false;
    for (let p = o.parent; p && p !== group; p = p.parent) if (p.userData.dynamic) dyn = true;
    if (dyn) return;
    if (o.userData.keep) return;
    const b = bucketFor(o);
    const g = prepGeometry(o.geometry, new THREE.Matrix4().multiplyMatrices(inv, o.matrixWorld), b.color, o.material.vertexColors);
    if (!buckets.has(b.key)) buckets.set(b.key, { material: b.material, cast: o.castShadow, geos: [] });
    buckets.get(b.key).geos.push(g);
    remove.push(o);
  });
  for (const o of remove) o.parent.remove(o);
  for (const { material, cast, geos } of buckets.values()) {
    const merged = new THREE.Mesh(mergeGeometries(geos), material);
    merged.castShadow = cast;
    merged.receiveShadow = true;
    group.add(merged);
  }
  // Drop now-empty helper groups.
  const empties = [];
  group.traverse((o) => {
    if (o !== group && o.type === 'Group' && !o.children.length && !o.userData.dynamic) empties.push(o);
  });
  for (const e of empties) e.parent?.remove(e);
  return group;
}

// ---- People -------------------------------------------------------------------------

export function lookFromSeed(seed) {
  const r = rng(seed);
  const pick = (a) => a[Math.floor(r() * a.length)];
  return {
    skin: pick(SKIN),
    hair: pick(HAIR),
    shirt: pick(SHIRT),
    pants: pick(PANTS),
    shoes: pick([0x2a2f3c, 0xf4f1ea, 0x7b4b2a, 0xd94f4f, 0x4f86c6]),
    hairStyle: Math.floor(r() * 6),
    top: pick(['tee', 'long', 'hoodie', 'collar']),
    build: 0.92 + r() * 0.16,
  };
}

/**
 * Merge the direct mesh children of a joint that share a material (fewer draw calls) without
 * touching child joints, so the rig stays articulated.
 */
function mergeDirect(group) {
  const buckets = new Map();
  for (const o of [...group.children]) {
    if (!o.isMesh || o.userData.keep || o.children.length) continue;
    const b = bucketFor(o);
    if (!buckets.has(b.key)) buckets.set(b.key, { material: b.material, items: [] });
    buckets.get(b.key).items.push({ o, color: b.color });
  }
  for (const { material, items } of buckets.values()) {
    if (items.length < 2 && !items[0]?.color) continue;
    const meshes = items.map((i) => i.o);
    const geos = items.map(({ o, color }) => {
      o.updateMatrix();
      return prepGeometry(o.geometry, o.matrix, color, o.material.vertexColors);
    });
    const merged = new THREE.Mesh(mergeGeometries(geos), material);
    merged.castShadow = true;
    merged.receiveShadow = true;
    for (const m of meshes) group.remove(m);
    group.add(merged);
  }
}

/** Merge every joint's direct meshes in an articulated model (pets, props) without breaking the rig. */
export function mergeRig(root) {
  const groups = [];
  root.traverse((o) => (o.isGroup || o === root) && !o.userData.dynamic && groups.push(o));
  for (const g of groups) mergeDirect(g);
  return root;
}

/**
 * A stylized "toy" person facing +z: soft capsules and spheres, big friendly head, expressive face.
 * The skeleton (hip 0.9, shoulders 0.62 above the hip, arm 0.31 + 0.30) is fixed: desk IK in sim.js
 * and seating depend on it. Returns the root plus articulated parts.
 *
 * Extra options: hat (beanie color), headphones, backpack. `look.accessory` (wardrobe) may add
 * glasses, a cap, a beanie, headphones or a hair flower.
 */
// ---- Characters: faceted low poly -------------------------------------------------------------
// Chunky, hand-cut shapes with flat-shaded facets (rounded boxes and low-segment cylinders with a
// little deterministic jitter), big glossy eyes, layered hair. The rig is unchanged: hips at 0.9,
// knees −0.44, shoulders ±0.3·build at 0.62 on the spine, elbows −0.31, head on the spine at 0.76 —
// so every pose, IK target and animation keeps working.

const charMats = new Map();
/** Character materials: flat-shaded, rim-lit, never shared with world materials. */
function charMat(color, roughness = 0.62) {
  const key = `${color}|${roughness}`;
  let m = charMats.get(key);
  if (!m) {
    m = patchCharacterMaterial(new THREE.MeshStandardMaterial({ color, roughness, metalness: 0, flatShading: true }));
    charMats.set(key, m);
  }
  return m;
}

function hash3(x, y, z, seed) {
  const h = Math.sin(Math.round(x * 997) * 12.9898 + Math.round(y * 997) * 78.233 + Math.round(z * 997) * 37.719 + seed * 4.123) * 43758.5453;
  return h - Math.floor(h);
}
/** Nudge vertices by a hash of their position (so seams stay closed) for a hand-cut look. */
function facet(geo, amount, seed = 1) {
  const p = geo.attributes.position;
  for (let i = 0; i < p.count; i++) {
    const x = p.getX(i), y = p.getY(i), z = p.getZ(i);
    p.setXYZ(i, x + (hash3(x, y, z, seed) - 0.5) * amount, y + (hash3(x, y, z, seed + 1) - 0.5) * amount, z + (hash3(x, y, z, seed + 2) - 0.5) * amount);
  }
  geo.computeVertexNormals();
  return geo;
}
/** A box with its corners pulled toward a sphere: chunky, faceted, friendly. */
function roundedBox(w, h, d, seg = 2, round = 0.4) {
  const g = new THREE.BoxGeometry(w, h, d, seg, seg, seg);
  const p = g.attributes.position;
  const v = new THREE.Vector3();
  for (let i = 0; i < p.count; i++) {
    v.set(p.getX(i) / (w / 2), p.getY(i) / (h / 2), p.getZ(i) / (d / 2));
    const s = v.clone().normalize();
    v.lerp(s, round);
    p.setXYZ(i, v.x * w / 2, v.y * h / 2, v.z * d / 2);
  }
  g.computeVertexNormals();
  return g;
}

/** Shoulder offset from the spine (× build): wide enough that hanging arms clear the boxy torso. */
export const SHOULDER_X = 0.335;

export function buildPerson(look, { scale = 1, hat = null, headphones = false, backpack = false } = {}) {
  const b = look.build || 1;
  const accessory = look.accessory || 'none';
  const accent = new THREE.Color(look.shirt).multiplyScalar(0.72).getHex();
  if (accessory === 'beanie' && hat == null) hat = accent;
  if (accessory === 'headphones') headphones = true;
  const cap = accessory === 'cap' && hat == null;
  const shade = (c, k) => new THREE.Color(c).multiplyScalar(k).getHex();
  const skin = charMat(look.skin, 0.55);
  const skinShade = charMat(shade(look.skin, 0.85), 0.55);
  const shirt = charMat(look.shirt, 0.72);
  const shirtTrim = charMat(shade(look.shirt, 0.8), 0.72);
  const pants = charMat(look.pants, 0.78);
  const pantsTrim = charMat(shade(look.pants, 0.82), 0.78);
  const shoes = charMat(look.shoes ?? PALETTE.dark, 0.5);
  const sole = charMat(0xf1ece2, 0.6);
  const hair = charMat(look.hair, 0.6);
  const hairDark = charMat(shade(look.hair, 0.8), 0.6);
  const dark = charMat(0x15161c, 0.18);
  const white = charMat(0xffffff, 0.25);
  const blush = charMat(0xf28b8b, 0.7);
  const mouthMat = charMat(0x7a2430, 0.45);
  const tongue = charMat(0xe8707f, 0.5);
  const longSleeves = look.top !== 'tee' && look.top !== 'collar';
  let seed = Math.floor((look.skin + look.hair * 3 + look.shirt * 7) % 997);

  const root = new THREE.Group();
  const body = new THREE.Group();
  root.add(body);
  const mesh = (geo, material, x = 0, y = 0, z = 0) => {
    const m = shadowed(new THREE.Mesh(geo, material));
    m.position.set(x, y, z);
    return m;
  };
  const rbox = (w, h, d, material, x, y, z, { seg = 2, round = 0.4, jitter = 0.008 } = {}) => mesh(facet(roundedBox(w, h, d, seg, round), jitter, ++seed), material, x, y, z);
  const cyl = (rt, rb, h, material, x, y, z, { seg = 7, jitter = 0.006 } = {}) => mesh(facet(new THREE.CylinderGeometry(rt, rb, h, seg, 1), jitter, ++seed), material, x, y, z);
  const gem = (r, material, x, y, z, sx = 1, sy = 1, sz = 1, detail = 0) => {
    const m = mesh(facet(new THREE.IcosahedronGeometry(r, detail), r * 0.12, ++seed), material, x, y, z);
    m.scale.set(sx, sy, sz);
    return m;
  };
  /** A tapered, four-sided lock of hair (a stretched pyramid), pointing from base toward tip. */
  const lock = (r, len, x, y, z, rx, ry, rz, material = hair, flat = 1) => {
    const geo = new THREE.ConeGeometry(r, len, 4, 1);
    geo.translate(0, -len / 2, 0); // base at the origin, tip pointing down −y
    if (flat !== 1) geo.scale(1.35, 1, flat); // a wide, thin swept chunk rather than a spike
    const m = mesh(facet(geo, r * 0.15, ++seed), material, x, y, z);
    m.rotation.set(rx, ry, rz);
    return m;
  };
  /** Fringe: overlapping flat chunks swept across the forehead, ending above the brows. */
  const sweptFringe = (n, dir = -1) => {
    for (let i = 0; i < n; i++) {
      const x = -0.18 + (i / Math.max(1, n - 1)) * 0.36;
      head.add(lock(0.085, 0.13 - Math.abs(x) * 0.12, x, 0.555, 0.235 - Math.abs(x) * 0.12, -0.55, dir * 0.15, dir * (0.75 + i * 0.08), hair, 0.42));
    }
  };

  // ---- Legs: hip → thigh → knee → shin, chunky boots with a pale sole.
  const hipY = 0.9;
  const leg = (side) => {
    const hip = new THREE.Group();
    hip.position.set(side * 0.12, hipY, 0);
    hip.add(cyl(0.122, 0.11, 0.36, pants, 0, -0.2, 0));
    const knee = new THREE.Group();
    knee.position.y = -0.44;
    hip.add(knee);
    knee.add(cyl(0.108, 0.1, 0.27, pants, 0, -0.14, 0));
    knee.add(cyl(0.112, 0.112, 0.05, pantsTrim, 0, -0.3, 0)); // turned-up cuff
    knee.add(rbox(0.19, 0.11, 0.29, shoes, 0, -0.39, 0.045, { round: 0.45 }));
    knee.add(rbox(0.205, 0.045, 0.305, sole, 0, -0.437, 0.045, { round: 0.3, jitter: 0.004 }));
    mergeDirect(knee);
    mergeDirect(hip);
    body.add(hip);
    return { hip, knee };
  };
  const L = leg(1);
  const R = leg(-1);

  // ---- Spine: hips, a boxy faceted torso with a hem, neckline by top style.
  const spine = new THREE.Group();
  spine.position.y = hipY;
  body.add(spine);
  spine.add(rbox(0.47 * b, 0.2, 0.33 * b, pants, 0, 0.03, 0, { round: 0.5 }));
  const torso = rbox(0.5 * b, 0.5, 0.36 * b, shirt, 0, 0.37, 0, { round: 0.42, jitter: 0.01 });
  torso.userData.keep = true; // stays separate so it can "breathe"
  spine.add(torso);
  spine.add(rbox(0.51 * b, 0.06, 0.37 * b, shirtTrim, 0, 0.14, 0, { round: 0.5, jitter: 0.004 })); // hem band
  if (look.top === 'hoodie') {
    const hood = mesh(facet(new THREE.TorusGeometry(0.16, 0.065, 5, 9), 0.01, ++seed), shirtTrim, 0, 0.64, -0.08);
    hood.rotation.x = Math.PI / 2 + 0.4;
    spine.add(hood);
    for (const s of [1, -1]) spine.add(cyl(0.01, 0.01, 0.13, white, s * 0.05, 0.53, 0.19, { seg: 4, jitter: 0 }));
  } else if (look.top === 'collar') {
    for (const s of [1, -1]) {
      const flap = mesh(new THREE.ConeGeometry(0.075, 0.13, 3), white, s * 0.065, 0.6, 0.15);
      flap.rotation.set(0.35, 0, s * 2.7);
      flap.scale.z = 0.35;
      spine.add(flap);
    }
  } else {
    const neckline = mesh(new THREE.TorusGeometry(0.115, 0.022, 4, 8), shirtTrim, 0, 0.615, 0);
    neckline.rotation.x = Math.PI / 2;
    spine.add(neckline);
  }
  if (backpack) {
    spine.add(rbox(0.32, 0.36, 0.16, charMat(0xf2b134, 0.6), 0, 0.4, -0.25, { round: 0.45 }));
    for (const s of [1, -1]) spine.add(cyl(0.022, 0.022, 0.36, charMat(0x9a6a10, 0.6), s * 0.13, 0.42, 0.0, { seg: 5 }));
  }

  // ---- Arms: puffed shoulder, sleeve, forearm, mitten hand with a thumb.
  const arm = (side) => {
    const shoulder = new THREE.Group();
    shoulder.position.set(side * SHOULDER_X * b, 0.62, 0);
    shoulder.add(gem(0.11, shirt, 0, -0.01, 0, 1, 1, 1, 1));
    shoulder.add(cyl(0.088, 0.082, 0.24, shirt, 0, -0.15, 0));
    if (!longSleeves) shoulder.add(cyl(0.094, 0.094, 0.045, shirtTrim, 0, -0.25, 0)); // sleeve hem
    const elbow = new THREE.Group();
    elbow.position.y = -0.31;
    shoulder.add(elbow);
    elbow.add(gem(0.08, longSleeves ? shirt : skin, 0, 0, 0, 1, 1, 1, 1)); // elbow joint, no gap when bent
    elbow.add(cyl(0.077, 0.068, 0.2, longSleeves ? shirt : skin, 0, -0.11, 0));
    if (longSleeves) elbow.add(cyl(0.082, 0.082, 0.045, shirtTrim, 0, -0.205, 0)); // cuff
    elbow.add(rbox(0.13, 0.15, 0.11, skin, 0, -0.29, 0.005, { round: 0.5 })); // mitten
    const thumb = rbox(0.05, 0.08, 0.05, skin, side * 0.07, -0.26, 0.035, { seg: 1, round: 0.3 });
    thumb.rotation.z = side * 0.5;
    elbow.add(thumb);
    mergeDirect(elbow);
    mergeDirect(shoulder);
    spine.add(shoulder);
    return { shoulder, elbow };
  };
  const AL = arm(1);
  const AR = arm(-1);

  // ---- Head: a big rounded block with a slightly narrower jaw, ears, and a friendly face.
  const head = new THREE.Group();
  head.position.y = 0.73; // a short neck under the big head
  head.scale.setScalar(1.16); // big, friendly head like the reference art
  spine.add(head);
  spine.add(cyl(0.1, 0.11, 0.16, skin, 0, 0.63, 0, { seg: 6, jitter: 0 })); // neck base, rooted in the torso
  // Neck: reaches from inside the skull down into the torso, so tilting the head never opens a gap.
  head.add(cyl(0.08, 0.088, 0.28, skin, 0, -0.06, 0, { seg: 6, jitter: 0 }));
  const skullGeo = roundedBox(0.56, 0.54, 0.5, 2, 0.42);
  {
    const p = skullGeo.attributes.position;
    for (let i = 0; i < p.count; i++) {
      const y = p.getY(i);
      const k = 1 - Math.max(0, -y / 0.27) * 0.16; // taper toward the chin
      p.setX(i, p.getX(i) * k);
      p.setZ(i, p.getZ(i) * (1 - Math.max(0, -y / 0.27) * 0.06));
    }
  }
  head.add(mesh(facet(skullGeo, 0.01, ++seed), skin, 0, 0.3, 0));
  for (const s of [1, -1]) head.add(gem(0.06, skin, s * 0.285, 0.28, -0.01, 0.55, 1, 0.85));
  const nose = mesh(new THREE.ConeGeometry(0.034, 0.07, 4), skinShade, 0, 0.255, 0.27);
  nose.rotation.set(Math.PI / 2, Math.PI / 4, 0);
  head.add(nose);

  const eyes = new THREE.Group();
  eyes.position.set(0, 0.315, 0.252);
  head.add(eyes);
  // Both eyes live directly in `eyes` (blinks scale the group), so they merge into one draw.
  for (const s of [1, -1]) {
    const eye = mesh(new THREE.SphereGeometry(0.058, 10, 8), dark, s * 0.105, 0, 0);
    eye.scale.set(0.86, 1.12, 0.42);
    eyes.add(eye);
    eyes.add(mesh(new THREE.SphereGeometry(0.019, 6, 5), white, s * 0.105 + 0.018, 0.026, 0.022));
    eyes.add(mesh(new THREE.SphereGeometry(0.008, 5, 4), white, s * 0.105 - 0.014, -0.022, 0.022));
    const brow = rbox(0.085, 0.022, 0.03, hairDark, s * 0.11, 0.415, 0.252, { seg: 1, round: 0.2, jitter: 0 });
    brow.rotation.z = s * -0.12;
    head.add(brow);
    const cheek = mesh(new THREE.CircleGeometry(0.042, 8), blush, s * 0.17, 0.205, 0.247);
    cheek.castShadow = false;
    head.add(cheek);
  }
  mergeDirect(eyes);
  // Mouth: an open, happy smile (dark with a tongue), plus a wide "o" for waving and cheering.
  const smile = new THREE.Group();
  smile.position.set(0, 0.185, 0.258);
  const lip = mesh(new THREE.CircleGeometry(0.062, 10, Math.PI, Math.PI), mouthMat, 0, 0, 0);
  lip.scale.y = 0.85;
  smile.add(lip);
  smile.add(mesh(new THREE.CircleGeometry(0.032, 8, Math.PI, Math.PI), tongue, 0, -0.03, 0.002));
  smile.userData.keep = true;
  head.add(smile);
  const open = mesh(new THREE.CircleGeometry(0.04, 10), mouthMat, 0, 0.175, 0.258);
  open.scale.set(0.9, 1.15, 1);
  open.visible = false;
  open.userData.keep = true;
  head.add(open);

  // ---- Hair: a faceted shell with a natural hairline (forehead, temples, nape), then locks on top
  // for shape — a swept fringe, crown tufts and a style-specific silhouette. Not a cap.
  const shell = (hairline) => {
    const g = roundedBox(0.61, 0.6, 0.55, 3, 0.48);
    const p = g.attributes.position;
    for (let i = 0; i < p.count; i++) {
      const x = p.getX(i), y = p.getY(i), z = p.getZ(i);
      if (y < hairline(x, z)) p.setXYZ(i, x * 0.78, y * 0.78, z * 0.78); // tuck under the skin
    }
    g.computeVertexNormals();
    const m = mesh(facet(g, 0.016, ++seed), hat ? charMat(hat, 0.75) : hair, 0, 0.31, -0.012);
    head.add(m);
    return m;
  };
  /** Hairline height (shell-local y) at a point: high over the forehead, lower at temples and nape. */
  const line = ({ front = 0.13, side = -0.03, back = -0.22 } = {}) => (x, z) => {
    const t = THREE.MathUtils.clamp((z + 0.05) / 0.28, 0, 1);
    const base = THREE.MathUtils.lerp(back, front, t);
    return Math.abs(x) > 0.2 && z > -0.1 ? Math.min(base, side) : base;
  };
  const tufts = (n, r = 0.1) => {
    for (let i = 0; i < n; i++) {
      const a = (i / n) * Math.PI * 2;
      head.add(gem(r, hair, Math.cos(a) * 0.14, 0.58 + Math.sin(a * 2) * 0.015, Math.sin(a) * 0.12 - 0.03, 1.2, 0.65, 1));
    }
  };

  if (cap) {
    shell(line({ front: 0.05, side: -0.06, back: -0.18 }));
    const crown = mesh(facet(roundedBox(0.63, 0.34, 0.58, 2, 0.55), 0.01, ++seed), charMat(accent, 0.7), 0, 0.47, -0.01);
    head.add(crown);
    const brim = rbox(0.4, 0.035, 0.24, charMat(accent, 0.7), 0, 0.4, 0.3, { seg: 1, round: 0.35 });
    brim.rotation.x = 0.12;
    head.add(brim);
    head.add(gem(0.03, charMat(accent, 0.7), 0, 0.65, -0.02));
  } else if (hat) {
    // Beanie / hard hat: a snug faceted dome with a folded band and a pompom.
    const dome = mesh(facet(roundedBox(0.63, 0.4, 0.58, 2, 0.6), 0.012, ++seed), charMat(hat, 0.78), 0, 0.46, -0.015);
    head.add(dome);
    head.add(rbox(0.65, 0.09, 0.6, charMat(shade(hat, 0.82), 0.78), 0, 0.33, -0.015, { round: 0.6 }));
    head.add(gem(0.07, white, 0, 0.68, -0.04, 1, 1, 1, 1));
    for (const s of [1, -1]) head.add(lock(0.06, 0.1, s * 0.27, 0.32, 0.05, 0, 0, s * 0.15)); // hair at the temples
  } else {
    const hs = look.hairStyle;
    if (hs === 0) {
      // Crop: short, textured on top, swept to one side.
      shell(line());
      tufts(5, 0.085);
      sweptFringe(4);
    } else if (hs === 1) {
      // Bob: full sides to the jaw, straight-ish fringe, rounded back.
      shell(line({ front: 0.12, side: -0.2, back: -0.26 }));
      // Side curtains hug the cheeks down to the jaw; the back is full; straight blunt bangs in front.
      for (const s of [1, -1]) {
        const side = rbox(0.09, 0.4, 0.36, hair, s * 0.275, 0.25, -0.03, { round: 0.6, jitter: 0.014 });
        side.rotation.z = s * -0.06;
        head.add(side);
      }
      head.add(rbox(0.56, 0.38, 0.16, hair, 0, 0.24, -0.23, { round: 0.6, jitter: 0.016 }));
      const bangs = rbox(0.5, 0.1, 0.13, hair, 0, 0.5, 0.2, { seg: 3, round: 0.5, jitter: 0.012 });
      bangs.rotation.x = -0.25;
      head.add(bangs);
    } else if (hs === 2) {
      // Bun: pulled back, a faceted bun on top, a soft side-swept fringe.
      shell(line({ front: 0.14, side: -0.02, back: -0.2 }));
      head.add(gem(0.13, hair, 0, 0.66, -0.12, 1, 0.9, 1, 1));
      const band = mesh(new THREE.TorusGeometry(0.1, 0.02, 4, 8), hairDark, 0, 0.6, -0.1);
      band.rotation.x = Math.PI / 2 - 0.5;
      head.add(band);
      sweptFringe(3);
    } else if (hs === 3) {
      // Spiky: short sides, a crown of sharp faceted spikes.
      shell(line({ front: 0.16, side: 0.02, back: -0.18 }));
      for (let i = 0; i < 9; i++) {
        const a = -1.3 + (i % 5) * 0.65 + (i >= 5 ? 0.32 : 0);
        const row = i >= 5 ? -0.12 : 0.06;
        const spike = lock(0.085, 0.16, Math.sin(a) * 0.17, 0.56, row + Math.cos(a) * 0.04, 0, 0, 0);
        spike.rotation.set(Math.PI + 0.3 - row, 0, a * 0.5); // tip up and outward
        head.add(spike);
      }
    } else if (hs === 4) {
      // Curly: a cloud of faceted curls over the crown and sides.
      shell(line({ front: 0.14, side: -0.06, back: -0.22 }));
      const curls = [[0, 0.64, 0.02, 0.13], [-0.16, 0.6, 0.08, 0.11], [0.16, 0.6, 0.08, 0.11], [-0.12, 0.62, -0.14, 0.12], [0.12, 0.62, -0.14, 0.12],
        [-0.26, 0.48, 0.02, 0.1], [0.26, 0.48, 0.02, 0.1], [-0.25, 0.44, -0.16, 0.1], [0.25, 0.44, -0.16, 0.1], [0, 0.55, -0.26, 0.12],
        [-0.08, 0.53, 0.22, 0.085], [0.09, 0.54, 0.21, 0.08], [0, 0.66, -0.1, 0.11], [-0.22, 0.34, -0.22, 0.09], [0.22, 0.34, -0.22, 0.09]];
      for (const [x, y, z, r] of curls) head.add(gem(r, hair, x, y, z, 1, 1, 1, 1));
    } else {
      // Ponytail: tied back high, a tapered tail of faceted sections, side fringe.
      shell(line({ front: 0.14, side: -0.02, back: -0.2 }));
      head.add(gem(0.04, charMat(0xe63946, 0.5), 0, 0.5, -0.3, 1, 1, 1, 1));
      head.add(gem(0.1, hair, 0, 0.47, -0.33, 1, 0.9, 1));
      head.add(lock(0.085, 0.24, 0, 0.45, -0.36, 0.35, 0, 0));
      head.add(lock(0.06, 0.18, 0, 0.24, -0.43, 0.15, 0, 0));
      sweptFringe(3);
    }
  }
  if (accessory === 'glasses') {
    const frame = charMat(0x1f2430, 0.3);
    for (const s of [1, -1]) {
      const ring = mesh(new THREE.TorusGeometry(0.068, 0.012, 4, 8), frame, s * 0.105, 0.315, 0.272);
      ring.rotation.z = Math.PI / 8;
      ring.userData.keep = true;
      head.add(ring);
      const temple = cyl(0.008, 0.008, 0.24, frame, s * 0.265, 0.33, 0.14, { seg: 4, jitter: 0 });
      temple.rotation.x = Math.PI / 2;
      head.add(temple);
    }
    const bridge = cyl(0.008, 0.008, 0.06, frame, 0, 0.33, 0.275, { seg: 4, jitter: 0 });
    bridge.rotation.z = Math.PI / 2;
    head.add(bridge);
  }
  if (accessory === 'flower') {
    const petal = charMat(0xff8fab, 0.6);
    for (let i = 0; i < 5; i++) {
      const a = (i / 5) * Math.PI * 2;
      head.add(gem(0.04, petal, 0.25 + Math.cos(a) * 0.045, 0.52 + Math.sin(a) * 0.045, 0.14));
    }
    head.add(gem(0.028, charMat(0xffd166, 0.6), 0.25, 0.52, 0.17));
  }
  if (headphones) {
    const hp = charMat(0x2a2f3c, 0.4);
    const band = mesh(new THREE.TorusGeometry(0.33, 0.026, 4, 12, Math.PI), hp, 0, 0.33, -0.02);
    head.add(band);
    for (const s of [1, -1]) {
      const cup = cyl(0.09, 0.09, 0.08, hp, s * 0.315, 0.3, -0.02, { seg: 8, jitter: 0.004 });
      cup.rotation.z = Math.PI / 2;
      head.add(cup);
    }
  }
  mergeDirect(head);
  mergeDirect(spine);

  // Provider badge on the chest (cosmetic; hidden until a session is attached).
  const badge = new THREE.Mesh(new THREE.CapsuleGeometry(0.035, 0.03, 4, 8), new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.4 }));
  badge.rotation.z = Math.PI / 2;
  badge.position.set(0.11, 0.5, 0.19);
  badge.visible = false;
  badge.userData.keep = true; // recolored per provider and shown/hidden at runtime
  spine.add(badge);

  root.scale.setScalar(scale);
  return {
    root,
    body,
    spine,
    head,
    eyes,
    mouth: smile,
    mouthOpen: open,
    torso,
    badge,
    legL: L.hip,
    legR: R.hip,
    kneeL: L.knee,
    kneeR: R.knee,
    armL: AL.shoulder,
    armR: AR.shoulder,
    elbowL: AL.elbow,
    elbowR: AR.elbow,
  };
}

/** The classic floating diamond. Emissive so the bloom pass makes it glow. */
export function buildPlumbob() {
  const group = new THREE.Group();
  const material = new THREE.MeshStandardMaterial({
    color: PLUMBOB_COLORS.off_duty,
    emissive: PLUMBOB_COLORS.off_duty,
    emissiveIntensity: 1.4,
    flatShading: true,
    roughness: 0.25,
    metalness: 0.1,
    transparent: true,
    opacity: 0.92,
  });
  const gem = new THREE.Mesh(new THREE.OctahedronGeometry(0.15, 0), material);
  gem.scale.set(1, 2.05, 1);
  group.add(gem);
  group.userData.material = material;
  group.userData.gem = gem;
  return group;
}

// ---- Nature -------------------------------------------------------------------------

/** Trees sway in the wind; their canopy is a child group named "canopy". */
export function buildTree(seed, x, z, kind) {
  const r = rng(seed);
  kind ??= r() < 0.45 ? 'pine' : r() < 0.7 ? 'round' : 'birch';
  const g = new THREE.Group();
  const canopy = new THREE.Group();
  canopy.userData.dynamic = true;
  canopy.name = 'canopy';
  const h = 1.3 + r() * 1.1;
  if (kind === 'pine') {
    g.add(cyl(0.12, 0.2, h, PALETTE.trunk, 6, 0, h / 2, 0));
    const tiers = 3 + Math.floor(r() * 2);
    for (let i = 0; i < tiers; i++) {
      const size = 1.45 - i * 0.3;
      const cone = cyl(0, size, 1.25, i % 2 ? PALETTE.leafDark : 0x4c9a59, 7, 0, h + 0.3 + i * 0.62, 0);
      cone.rotation.y = r() * Math.PI;
      canopy.add(cone);
    }
  } else if (kind === 'round') {
    g.add(cyl(0.13, 0.2, h + 0.4, PALETTE.trunk, 6, 0, (h + 0.4) / 2, 0));
    const blobs = 3 + Math.floor(r() * 3);
    for (let i = 0; i < blobs; i++) {
      const s = 0.75 + r() * 0.55;
      canopy.add(ico(s, i % 2 ? PALETTE.leaf : PALETTE.leafLight, (r() - 0.5) * 1.1, h + 0.9 + r() * 0.9, (r() - 0.5) * 1.1, 0));
    }
  } else {
    g.add(cyl(0.09, 0.13, h + 1.2, 0xeeeae2, 6, 0, (h + 1.2) / 2, 0));
    for (let i = 0; i < 4; i++) canopy.add(ico(0.55 + r() * 0.3, 0x9bd06b, (r() - 0.5) * 0.8, h + 1.1 + i * 0.35, (r() - 0.5) * 0.8, 0));
  }
  canopy.userData.phase = r() * 10;
  g.add(canopy);
  g.position.set(x, 0, z);
  g.rotation.y = r() * Math.PI * 2;
  g.scale.setScalar(0.9 + r() * 0.35);
  return g;
}

export function buildBush(x, z, s = 1, color = PALETTE.leafDark) {
  const g = new THREE.Group();
  g.add(ico(0.5 * s, color, 0, 0.36 * s, 0));
  g.add(ico(0.36 * s, PALETTE.leaf, 0.32 * s, 0.3 * s, 0.1 * s));
  g.add(ico(0.32 * s, PALETTE.leaf, -0.3 * s, 0.26 * s, -0.08 * s));
  g.position.set(x, 0, z);
  return g;
}

export function buildPlant(x, z, seed = 1) {
  const r = rng(seed);
  const g = new THREE.Group();
  const potColor = r() < 0.5 ? PALETTE.pot : PALETTE.potAlt;
  g.add(cyl(0.22, 0.16, 0.42, potColor, 8, 0, 0.21, 0));
  g.add(cyl(0.2, 0.2, 0.03, 0x5a4030, 8, 0, 0.42, 0));
  if (r() < 0.5) {
    // Leafy: a ring of tilted leaves.
    for (let i = 0; i < 7; i++) {
      const leaf = new THREE.Mesh(new THREE.ConeGeometry(0.12, 0.7, 4), mat(i % 2 ? PALETTE.leaf : PALETTE.leafLight));
      leaf.castShadow = true;
      const a = (i / 7) * Math.PI * 2;
      leaf.position.set(Math.cos(a) * 0.12, 0.75, Math.sin(a) * 0.12);
      leaf.rotation.set(Math.sin(a) * 0.6, 0, -Math.cos(a) * 0.6);
      g.add(leaf);
    }
  } else {
    const leaves = ico(0.36, PALETTE.leaf, 0, 0.78, 0, 0);
    leaves.scale.y = 1.25;
    g.add(leaves);
    g.add(ico(0.22, PALETTE.leafLight, 0.12, 1.02, 0.08, 0));
  }
  g.position.set(x, 0, z);
  return g;
}

export function buildLampPost(x, z) {
  const g = new THREE.Group();
  g.add(cyl(0.12, 0.16, 0.3, PALETTE.dark, 8, 0, 0.15, 0));
  g.add(cyl(0.05, 0.06, 3.0, PALETTE.dark, 6, 0, 1.6, 0));
  g.add(cyl(0.22, 0.12, 0.14, PALETTE.dark, 8, 0, 3.2, 0));
  const bulb = new THREE.Mesh(new THREE.IcosahedronGeometry(0.17, 1), new THREE.MeshStandardMaterial({ color: PALETTE.lamp, emissive: 0xffd28a, emissiveIntensity: 0 }));
  bulb.position.y = 3.02;
  bulb.userData.dynamic = true;
  bulb.userData.nightGlow = 3.2;
  g.add(bulb);
  // Warm pool of light on the ground at night.
  const pool = new THREE.Mesh(
    new THREE.PlaneGeometry(5, 5),
    new THREE.MeshBasicMaterial({ map: poolTexture(), color: 0xffc98a, transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false }),
  );
  pool.rotation.x = -Math.PI / 2;
  pool.position.y = 0.09;
  pool.userData.dynamic = true;
  pool.userData.nightPool = 0.55;
  g.add(pool);
  g.position.set(x, 0, z);
  return g;
}

let poolTex = null;
function poolTexture() {
  if (poolTex) return poolTex;
  const c = document.createElement('canvas');
  c.width = c.height = 128;
  const g = c.getContext('2d');
  const grad = g.createRadialGradient(64, 64, 0, 64, 64, 64);
  grad.addColorStop(0, 'rgba(255,255,255,1)');
  grad.addColorStop(0.45, 'rgba(255,255,255,0.45)');
  grad.addColorStop(1, 'rgba(255,255,255,0)');
  g.fillStyle = grad;
  g.fillRect(0, 0, 128, 128);
  poolTex = new THREE.CanvasTexture(c);
  return poolTex;
}
