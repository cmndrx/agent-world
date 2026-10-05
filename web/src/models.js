// Low-poly model builders: stylized, flat-shaded, no external assets.

import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';

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

/**
 * Merge every static mesh under `group` into one mesh per material (fewer draw calls).
 * Meshes flagged `userData.dynamic` are left alone.
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
    const g = (o.geometry.index ? o.geometry.toNonIndexed() : o.geometry.clone());
    for (const name of Object.keys(g.attributes)) if (!['position', 'normal', 'uv'].includes(name)) g.deleteAttribute(name);
    if (!g.attributes.uv) g.setAttribute('uv', new THREE.BufferAttribute(new Float32Array(g.attributes.position.count * 2), 2));
    g.applyMatrix4(new THREE.Matrix4().multiplyMatrices(inv, o.matrixWorld));
    const key = `${o.material.uuid}|${o.castShadow}`;
    if (!buckets.has(key)) buckets.set(key, { material: o.material, cast: o.castShadow, geos: [] });
    buckets.get(key).geos.push(g);
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
    if (!o.isMesh || o.userData.keep) continue;
    const key = o.material.uuid;
    if (!buckets.has(key)) buckets.set(key, []);
    buckets.get(key).push(o);
  }
  for (const meshes of buckets.values()) {
    if (meshes.length < 2) continue;
    const geos = meshes.map((m) => {
      m.updateMatrix();
      const g = (m.geometry.index ? m.geometry.toNonIndexed() : m.geometry.clone()).applyMatrix4(m.matrix);
      for (const name of Object.keys(g.attributes)) if (!['position', 'normal', 'uv'].includes(name)) g.deleteAttribute(name);
      return g;
    });
    const merged = new THREE.Mesh(mergeGeometries(geos), meshes[0].material);
    merged.castShadow = true;
    merged.receiveShadow = true;
    for (const m of meshes) group.remove(m);
    group.add(merged);
  }
}

/**
 * A stylized "toy" person facing +z: soft capsules and spheres, big friendly head, expressive face.
 * The skeleton (hip 0.9, shoulders 0.62 above the hip, arm 0.31 + 0.30) is fixed: desk IK in sim.js
 * and seating depend on it. Returns the root plus articulated parts.
 *
 * Extra options: hat (beanie color), headphones, backpack.
 */
export function buildPerson(look, { scale = 1, hat = null, headphones = false, backpack = false } = {}) {
  const soft = (color, roughness = 0.62) => mat(color, { roughness, flat: false });
  const skin = soft(look.skin, 0.5);
  const skinShade = soft(new THREE.Color(look.skin).multiplyScalar(0.86).getHex(), 0.5);
  const shirt = soft(look.shirt, 0.7);
  const shirtTrim = soft(new THREE.Color(look.shirt).multiplyScalar(0.78).getHex(), 0.7);
  const pants = soft(look.pants, 0.75);
  const shoes = soft(look.shoes ?? PALETTE.dark, 0.45);
  const sole = soft(0xf1ede6, 0.6);
  const hair = soft(look.hair, 0.55);
  const dark = soft(0x1a1c24, 0.25);
  const white = soft(0xffffff, 0.2);
  const longSleeves = look.top !== 'tee' && look.top !== 'collar';

  const root = new THREE.Group();
  const body = new THREE.Group();
  root.add(body);

  const mesh = (geo, material, x = 0, y = 0, z = 0) => {
    const m = shadowed(new THREE.Mesh(geo, material));
    m.position.set(x, y, z);
    return m;
  };
  const capsule = (r, len, material, x, y, z) => mesh(new THREE.CapsuleGeometry(r, len, 4, 12), material, x, y, z);
  const sphere = (r, material, x, y, z, sx = 1, sy = 1, sz = 1) => {
    const m = mesh(new THREE.SphereGeometry(r, 18, 14), material, x, y, z);
    m.scale.set(sx, sy, sz);
    return m;
  };

  // Legs: hip → thigh → knee → shin → rounded shoe with a contrasting sole.
  const hipY = 0.9;
  const leg = (side) => {
    const hip = new THREE.Group();
    hip.position.set(side * 0.12, hipY, 0);
    hip.add(capsule(0.118, 0.22, pants, 0, -0.21, 0));
    const knee = new THREE.Group();
    knee.position.y = -0.44;
    hip.add(knee);
    knee.add(capsule(0.104, 0.2, pants, 0, -0.18, 0));
    knee.add(sphere(0.108, pants, 0, -0.33, 0, 1.05, 0.5, 1.05)); // cuff
    knee.add(sphere(0.115, shoes, 0, -0.405, 0.05, 1, 0.62, 1.42));
    knee.add(mesh(new THREE.BoxGeometry(0.2, 0.04, 0.31), sole, 0, -0.455, 0.05));
    mergeDirect(knee);
    mergeDirect(hip);
    body.add(hip);
    return { hip, knee };
  };
  const L = leg(1);
  const R = leg(-1);

  // Spine: pelvis, torso, belt, collar/hood; carries arms and head.
  const spine = new THREE.Group();
  spine.position.y = hipY;
  body.add(spine);
  spine.add(sphere(0.24, pants, 0, 0.03, 0, 1.05 * look.build, 0.62, 0.85));
  const torso = capsule(0.255 * look.build, 0.2, shirt, 0, 0.37, 0);
  torso.scale.z = 0.82;
  torso.userData.keep = true; // stays separate so it can "breathe"
  spine.add(torso);
  const hem = mesh(new THREE.TorusGeometry(0.235 * look.build, 0.026, 8, 24), shirtTrim, 0, 0.12, 0);
  hem.rotation.x = Math.PI / 2;
  hem.scale.y = 0.82;
  spine.add(hem);
  if (look.top === 'hoodie') {
    const hood = mesh(new THREE.TorusGeometry(0.15, 0.06, 10, 20), shirtTrim, 0, 0.66, -0.07);
    hood.rotation.x = Math.PI / 2 + 0.35;
    spine.add(hood);
    for (const s of [1, -1]) spine.add(capsule(0.008, 0.12, white, s * 0.05, 0.54, 0.19));
  } else if (look.top === 'collar') {
    for (const s of [1, -1]) {
      const c = mesh(new THREE.BoxGeometry(0.12, 0.02, 0.09), white, s * 0.07, 0.68, 0.14);
      c.rotation.set(0.5, 0, s * -0.5);
      spine.add(c);
    }
  } else {
    const neckline = mesh(new THREE.TorusGeometry(0.09, 0.018, 8, 18), shirtTrim, 0, 0.7, 0.02);
    neckline.rotation.x = Math.PI / 2;
    spine.add(neckline);
  }
  if (backpack) {
    const pack = mesh(new THREE.CapsuleGeometry(0.15, 0.16, 4, 10), soft(0xf2b134, 0.6), 0, 0.4, -0.24);
    pack.scale.set(1.1, 1, 0.55);
    spine.add(pack);
    for (const s of [1, -1]) spine.add(capsule(0.02, 0.36, soft(0x9a6a10, 0.6), s * 0.12, 0.42, 0.0));
  }

  const arm = (side) => {
    const shoulder = new THREE.Group();
    shoulder.position.set(side * 0.3 * look.build, 0.62, 0);
    shoulder.add(sphere(0.1, shirt, 0, 0, 0));
    shoulder.add(capsule(0.088, 0.15, shirt, 0, -0.155, 0));
    if (!longSleeves) shoulder.add(sphere(0.094, shirtTrim, 0, -0.23, 0, 1, 0.45, 1)); // sleeve hem
    const elbow = new THREE.Group();
    elbow.position.y = -0.31;
    shoulder.add(elbow);
    elbow.add(capsule(0.074, 0.12, longSleeves ? shirt : skin, 0, -0.12, 0));
    if (longSleeves) elbow.add(sphere(0.079, shirtTrim, 0, -0.21, 0, 1, 0.45, 1)); // cuff
    elbow.add(sphere(0.082, skin, 0, -0.29, 0.005, 0.92, 1.05, 0.8)); // mitten hand
    elbow.add(sphere(0.034, skin, side * 0.065, -0.262, 0.035)); // thumb
    mergeDirect(elbow);
    mergeDirect(shoulder);
    spine.add(shoulder);
    return { shoulder, elbow };
  };
  const AL = arm(1);
  const AR = arm(-1);

  // Head: big and round, with a soft face.
  const head = new THREE.Group();
  head.position.y = 0.76;
  spine.add(head);
  head.add(mesh(new THREE.CylinderGeometry(0.085, 0.1, 0.12, 12), skin, 0, 0.0, 0));
  head.add(sphere(0.3, skin, 0, 0.3, 0, 1, 1.0, 0.96));
  for (const s of [1, -1]) head.add(sphere(0.06, skin, s * 0.295, 0.28, -0.01, 0.55, 1, 0.8));
  head.add(sphere(0.032, skinShade, 0, 0.245, 0.295)); // nose

  const eyes = new THREE.Group();
  eyes.position.set(0, 0.3, 0.262);
  head.add(eyes);
  for (const s of [1, -1]) {
    const e = new THREE.Group();
    e.position.x = s * 0.1;
    e.add(sphere(0.046, dark, 0, 0, 0, 0.82, 1.12, 0.5));
    const glint = sphere(0.014, white, 0.012, 0.02, 0.022);
    glint.userData.keep = true;
    e.add(glint);
    eyes.add(e);
    const brow = capsule(0.013, 0.05, hair, s * 0.1, 0.385, 0.27);
    brow.rotation.z = Math.PI / 2 + s * 0.12;
    head.add(brow);
    const cheek = sphere(0.045, soft(0xff8f8f, 0.8), s * 0.17, 0.21, 0.245, 1, 0.6, 0.3);
    cheek.material = cheek.material.clone();
    cheek.material.transparent = true;
    cheek.material.opacity = 0.45;
    cheek.castShadow = false;
    cheek.userData.keep = true;
    head.add(cheek);
  }
  // Mouth: a smile, plus an open "o" used for waving/cheering.
  const mouthMat = soft(0x6b2a2a, 0.4);
  const smile = mesh(new THREE.TorusGeometry(0.038, 0.009, 6, 14, Math.PI), mouthMat, 0, 0.185, 0.283);
  smile.rotation.z = Math.PI;
  smile.userData.keep = true;
  head.add(smile);
  const open = sphere(0.032, mouthMat, 0, 0.17, 0.283, 1, 0.85, 0.4);
  open.visible = false;
  open.userData.keep = true;
  head.add(open);

  // Hair: a dome tilted back over the skull, plus a style-specific shape.
  const dome = (r = 0.318, tilt = -0.3, cover = 0.52) => {
    const m = mesh(new THREE.SphereGeometry(r, 24, 14, 0, Math.PI * 2, 0, Math.PI * cover), hat ? soft(hat, 0.8) : hair, 0, 0.31, -0.005);
    m.rotation.x = tilt;
    head.add(m);
    return m;
  };
  if (hat) {
    dome(0.325, -0.18, 0.5);
    const band = mesh(new THREE.TorusGeometry(0.31, 0.04, 8, 28), soft(new THREE.Color(hat).multiplyScalar(0.8).getHex(), 0.8), 0, 0.36, -0.03);
    band.rotation.x = Math.PI / 2 - 0.18;
    head.add(band);
    head.add(sphere(0.07, white, 0, 0.66, -0.06));
  } else {
    const hs = look.hairStyle;
    dome();
    if (hs === 0) {
      for (let i = 0; i < 3; i++) head.add(sphere(0.085, hair, -0.12 + i * 0.12, 0.5 - Math.abs(i - 1) * 0.02, 0.18, 1.1, 0.7, 0.9));
    } else if (hs === 1) {
      for (const s of [1, -1]) head.add(sphere(0.15, hair, s * 0.24, 0.24, -0.02, 0.55, 1.25, 1));
      head.add(sphere(0.27, hair, 0, 0.26, -0.1, 1.12, 1, 0.75));
      head.add(sphere(0.12, hair, 0.1, 0.5, 0.17, 1.6, 0.55, 0.9));
    } else if (hs === 2) {
      head.add(sphere(0.12, hair, 0, 0.62, -0.13));
      head.add(sphere(0.08, hair, -0.1, 0.5, 0.18, 1.4, 0.6, 0.9));
    } else if (hs === 3) {
      for (let i = 0; i < 6; i++) {
        const a = -0.9 + i * 0.36;
        const spike = mesh(new THREE.ConeGeometry(0.075, 0.22, 10), hair, Math.sin(a) * 0.2, 0.58, Math.cos(a) * 0.05 + 0.02);
        spike.rotation.set(0.3, 0, -a * 0.6);
        head.add(spike);
      }
    } else if (hs === 4) {
      for (let i = 0; i < 14; i++) {
        const a = (i / 14) * Math.PI * 2;
        const up = i % 2 ? 0.52 : 0.42;
        head.add(sphere(0.11, hair, Math.cos(a) * 0.24, up, Math.sin(a) * 0.22 - 0.03));
      }
      head.add(sphere(0.17, hair, 0, 0.6, -0.02));
    } else {
      const tail = capsule(0.07, 0.22, hair, 0, 0.2, -0.33);
      tail.rotation.x = 0.35;
      head.add(tail);
      head.add(sphere(0.045, soft(0xe63946, 0.5), 0, 0.36, -0.3));
      head.add(sphere(0.1, hair, -0.1, 0.5, 0.17, 1.5, 0.6, 0.9));
    }
  }
  if (headphones) {
    const band = mesh(new THREE.TorusGeometry(0.33, 0.025, 8, 24, Math.PI), soft(0x2a2f3c, 0.4), 0, 0.33, 0);
    head.add(band);
    for (const s of [1, -1]) {
      const cup = mesh(new THREE.CylinderGeometry(0.09, 0.09, 0.07, 16), soft(0x2a2f3c, 0.4), s * 0.32, 0.3, 0);
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
