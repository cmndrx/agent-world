// The eight residential tiers as low-poly geometry (concept art: docs/concepts/home-tiers). Layout data lives in
// home-tier-plans.js. Each tier has three parts:
//
// - facade extras on the ground-floor walls (quoins, plinths, bay window, door lanterns, portals); they lower
//   with the cutaway walls,
// - the upper stack (upper floors, roofs, canopies, balconies, rooftop gardens), shown from afar and lifted
//   away like a roof when you zoom in so the ground-floor studio and its residents stay visible,
// - the yard (fence style, paths, beds, hedges, lamps, trees), which yields to the player's decor.
//
// Everything here is the simulation layer: it never reflects or implies agent activity.

import * as THREE from 'three';
import { PALETTE, box, buildBush, buildLightPool, buildTree, cyl, ico, mat, softBox } from './models.js';
import { waterMaterial } from './fx.js';
import { GROUND_H, YARD_Z, doorsOf } from './home-tier-plans.js';

const TRIM = 0xf3ead8;
const STONE = 0xd9ccb5;
const STONE_DARK = 0xb5a892;
const TIMBER = 0xa0643a;
const TIMBER_DARK = 0x6e4529;
const RAIL = 0x2f3440;
const LEAF = [PALETTE.leaf, PALETTE.leafDark, PALETTE.leafLight];

/** Roof treatment per house style (build mode → House style); tiers keep their silhouettes. */
export const ROOF_STYLES = {
  cottage: { form: 'gable', color: 0x56607a },
  craftsman: { form: 'hip', color: 0x6a5246 },
  modern: { form: 'flat', color: 0x8d9198 },
  barn: { form: 'gable', color: 0xa8432c, steep: 1.2 },
};

const shingle = (color) => {
  const m = mat(color, { roughness: 0.81 });
  m.userData.bands = 0.12; // shingle rows (fx.js)
  return m;
};
const darker = (c, k) => new THREE.Color(c).multiplyScalar(k).getHex();

// ---- Shared pieces ------------------------------------------------------------------------

/** A triangular prism (gable fill) under a ridge running along `axis`. */
function prism(w, d, H, color, axis) {
  const span = axis === 'x' ? d : w;
  const len = axis === 'x' ? w : d;
  const tri = new THREE.Shape([new THREE.Vector2(-span / 2, 0), new THREE.Vector2(span / 2, 0), new THREE.Vector2(0, H)]);
  const geo = new THREE.ExtrudeGeometry(tri, { depth: len, bevelEnabled: false });
  geo.translate(0, 0, -len / 2);
  if (axis === 'x') geo.rotateY(Math.PI / 2);
  const m = new THREE.Mesh(geo, mat(color));
  m.castShadow = true;
  m.receiveShadow = true;
  return m;
}

/** A square frustum scaled to w × d: hip roofs (small top), mansards (wide top) and plinths. */
function frustum(w, h, d, topK, color, material) {
  const geo = new THREE.CylinderGeometry(Math.SQRT2 * topK, Math.SQRT2, 1, 4, 1);
  geo.rotateY(Math.PI / 4);
  geo.scale(w / 2, h, d / 2);
  const m = new THREE.Mesh(geo, material || mat(color));
  m.castShadow = true;
  m.receiveShadow = true;
  return m;
}

/**
 * A pitched roof over a w × d rectangle centered at (cx, cz), eaves at y0. `axis` is the ridge direction for
 * gables. Hip and flat styles come from the home's House style.
 */
function roof(g, { cx = 0, cz = 0, y0 = 0, w, d, H, axis = 'x', ov = 0.45, style, wallColor, ends = true }) {
  const color = style.color;
  const form = style.form;
  H *= style.steep || 1;
  if (form === 'flat') {
    g.add(box(w + 0.3, 0.3, d + 0.3, 0xd9d4ca, cx, y0 + 0.15, cz));
    for (const [pw, pd, px, pz] of [[w + 0.3, 0.22, cx, cz + (d + 0.3) / 2], [w + 0.3, 0.22, cx, cz - (d + 0.3) / 2], [0.22, d + 0.3, cx + (w + 0.3) / 2, cz], [0.22, d + 0.3, cx - (w + 0.3) / 2, cz]]) {
      g.add(box(pw, 0.5, pd, wallColor, px, y0 + 0.45, pz));
    }
    return y0 + 0.7;
  }
  if (form === 'hip') {
    const hip = frustum(w + ov * 2, H, d + ov * 2, 0.12, 0, shingle(color));
    hip.position.set(cx, y0 + H / 2, cz);
    g.add(hip);
    g.add(box(w + ov * 2, 0.1, d + ov * 2, 0xe9e5dc, cx, y0 + 0.02, cz)); // eave fascia
    return y0 + H;
  }
  const half = (axis === 'x' ? d : w) / 2 + ov;
  const len = (axis === 'x' ? w : d) + ov * 2;
  const slope = Math.hypot(half, H);
  const ang = Math.atan2(H, half);
  for (const s of [1, -1]) {
    const slab = axis === 'x'
      ? box(len, 0.14, slope, 0, cx, y0 + H / 2, cz + (s * half) / 2, { material: shingle(color) })
      : box(slope, 0.14, len, 0, cx + (s * half) / 2, y0 + H / 2, cz, { material: shingle(color) });
    if (axis === 'x') slab.rotation.x = s * ang;
    else slab.rotation.z = -s * ang;
    g.add(slab);
  }
  // Ridge cap.
  g.add(axis === 'x' ? box(len, 0.12, 0.2, darker(color, 0.75), cx, y0 + H + 0.02, cz) : box(0.2, 0.12, len, darker(color, 0.75), cx, y0 + H + 0.02, cz));
  if (ends) {
    const fill = prism(axis === 'x' ? w - 0.1 : w - 0.1, axis === 'x' ? d - 0.1 : d - 0.1, H - 0.08, wallColor, axis);
    fill.position.set(cx, y0, cz);
    g.add(fill);
  }
  return y0 + H;
}

/** Half-timbering on a gable face: a tie beam, a king post and two struts. */
function timberGable(g, { x, z, y0, span, H, axis = 'z' }) {
  const out = 0.07;
  if (axis === 'z') {
    g.add(box(span - 0.2, 0.14, 0.1, TIMBER, x, y0 + 0.12, z + out));
    g.add(box(0.14, H * 0.8, 0.1, TIMBER, x, y0 + H * 0.42, z + out));
    for (const s of [1, -1]) {
      const strut = box(0.12, Math.hypot(span * 0.3, H * 0.55), 0.1, TIMBER, x + s * span * 0.16, y0 + H * 0.38, z + out);
      strut.rotation.z = -s * Math.atan2(span * 0.3, H * 0.55);
      g.add(strut);
    }
  } else {
    g.add(box(0.1, 0.14, span - 0.2, TIMBER, x + out * Math.sign(x || 1), y0 + 0.12, z));
    g.add(box(0.1, H * 0.8, 0.14, TIMBER, x + out * Math.sign(x || 1), y0 + H * 0.42, z));
  }
}

/**
 * A window on a face. `axis` 'x' means the window lies in a plane of constant z (front/back faces), `out` is
 * the outward normal sign. Options: shutters color, flower box, French door height.
 */
function windowAt(g, glass, { x, y, z, w = 1.2, h = 1.1, axis = 'x', out = 1, frame = TRIM, shutters = null, flowers = false, sill = true }) {
  const along = (a, b) => (axis === 'x' ? [a, b] : [b, a]);
  const at = (dx, dy, dn) => (axis === 'x' ? [x + dx, y + dy, z + dn * out] : [x + dn * out, y + dy, z + dx]);
  const piece = (pw, ph, pd, dx, dy, dn, color, opts) => {
    const [bw, bd] = along(pw, pd);
    g.add(box(bw, ph, bd, color, ...at(dx, dy, dn), opts));
  };
  const [pw, pd] = along(w, 0.04);
  const pane = new THREE.Mesh(new THREE.BoxGeometry(pw, h, pd), glass);
  pane.position.set(...at(0, 0, 0.03));
  g.add(pane);
  piece(w + 0.14, 0.08, 0.1, 0, h / 2 + 0.03, 0.06, frame);
  piece(0.08, h, 0.1, -w / 2 - 0.03, 0, 0.06, frame);
  piece(0.08, h, 0.1, w / 2 + 0.03, 0, 0.06, frame);
  piece(0.05, h, 0.06, 0, 0, 0.06, frame);
  if (sill) piece(w + 0.24, 0.07, 0.2, 0, -h / 2 - 0.03, 0.1, frame);
  if (shutters != null) for (const s of [-1, 1]) piece(w * 0.42, h + 0.05, 0.05, s * (w / 2 + w * 0.24), 0, 0.08, shutters);
  if (flowers) {
    piece(w + 0.1, 0.2, 0.24, 0, -h / 2 - 0.16, 0.16, TIMBER);
    const n = Math.max(3, Math.round(w / 0.28));
    for (let i = 0; i < n; i++) {
      const dx = -w / 2 + 0.1 + (i * (w - 0.2)) / (n - 1);
      g.add(ico(0.1, PALETTE.leafDark, ...at(dx, -h / 2 - 0.02, 0.17)));
      g.add(ico(0.06, PALETTE.flowers[i % PALETTE.flowers.length], ...at(dx + 0.04, -h / 2 + 0.05, 0.22)));
    }
  }
}

/** A railing between two points at height y (balusters every 0.22). */
function railing(g, x0, z0, x1, z1, y, h = 0.85, color = RAIL) {
  const len = Math.hypot(x1 - x0, z1 - z0);
  const along = Math.abs(x1 - x0) >= Math.abs(z1 - z0) ? 'x' : 'z';
  g.add(along === 'x' ? box(len, 0.06, 0.07, color, (x0 + x1) / 2, y + h, (z0 + z1) / 2) : box(0.07, 0.06, len, color, (x0 + x1) / 2, y + h, (z0 + z1) / 2));
  const n = Math.max(2, Math.round(len / 0.22));
  for (let i = 0; i <= n; i++) {
    const t = i / n;
    g.add(box(0.035, h, 0.035, color, x0 + (x1 - x0) * t, y + h / 2, z0 + (z1 - z0) * t));
  }
}

/** A planter strip of shrubs and flowers. */
function plantRow(g, x0, x1, y, z, r, { flowers = true, size = 0.16 } = {}) {
  const n = Math.max(2, Math.round((x1 - x0) / 0.35));
  for (let i = 0; i < n; i++) {
    const x = x0 + ((i + 0.5) * (x1 - x0)) / n;
    g.add(ico(size * (0.8 + r() * 0.5), LEAF[i % 3], x, y + size * 0.7, z + (r() - 0.5) * 0.08));
    if (flowers && i % 2 === 0) g.add(ico(size * 0.4, PALETTE.flowers[Math.floor(r() * PALETTE.flowers.length)], x + 0.05, y + size * 1.4, z + 0.06));
  }
}

/** A front balcony: slab, railing and a planter, attached to the face z = zFace. */
function balcony(g, r, { x0, x1, y, zFace, depth = 0.9, slab = TRIM, rail = RAIL, planters = true, side = 1 }) {
  const zc = zFace + (side * depth) / 2;
  g.add(box(x1 - x0, 0.16, depth, slab, (x0 + x1) / 2, y - 0.08, zc));
  const zf = zFace + side * (depth - 0.05);
  railing(g, x0 + 0.05, zf, x1 - 0.05, zf, y, 0.82, rail);
  railing(g, x0 + 0.05, zFace, x0 + 0.05, zf, y, 0.82, rail);
  railing(g, x1 - 0.05, zFace, x1 - 0.05, zf, y, 0.82, rail);
  if (planters) {
    g.add(box(Math.min(1.2, (x1 - x0) * 0.35), 0.22, 0.24, TIMBER, x0 + 0.45 + Math.min(0.6, (x1 - x0) * 0.17), y + 0.11, zf - side * 0.18));
    plantRow(g, x0 + 0.25, x0 + 0.25 + Math.min(1.2, (x1 - x0) * 0.35), y + 0.2, zf - side * 0.18, r, { size: 0.13 });
    g.add(cyl(0.16, 0.12, 0.34, PALETTE.pot, 8, x1 - 0.35, y + 0.17, zf - side * 0.25));
    g.add(ico(0.24, PALETTE.leaf, x1 - 0.35, y + 0.5, zf - side * 0.25));
  }
}

/** A side balcony on an x face (xFace, outward sign side). */
function sideBalcony(g, r, { z0, z1, y, xFace, depth = 0.8, slab = TRIM, rail = RAIL, side = 1 }) {
  const xc = xFace + (side * depth) / 2;
  g.add(box(depth, 0.16, z1 - z0, slab, xc, y - 0.08, (z0 + z1) / 2));
  const xf = xFace + side * (depth - 0.05);
  railing(g, xf, z0 + 0.05, xf, z1 - 0.05, y, 0.82, rail);
  railing(g, xFace, z1 - 0.05, xf, z1 - 0.05, y, 0.82, rail);
  railing(g, xFace, z0 + 0.05, xf, z0 + 0.05, y, 0.82, rail);
  g.add(ico(0.2, LEAF[Math.floor(r() * 3)], xf - side * 0.2, y + 0.3, z0 + 0.35));
}

/** A chimney with optional pots; returns the top. */
function chimney(g, x, z, y0, h, color = 0x9a5b45, pots = 2) {
  g.add(box(0.9, h, 0.9, color, x, y0 + h / 2, z));
  g.add(box(1.05, 0.15, 1.05, darker(color, 0.75), x, y0 + h + 0.05, z));
  for (let i = 0; i < pots; i++) g.add(cyl(0.11, 0.13, 0.32, 0xb8643f, 8, x + (pots === 1 ? 0 : (i - 0.5) * 0.36), y0 + h + 0.28, z));
  return y0 + h + 0.4;
}

/** Lazy curls of chimney smoke (animated by the lot; they lift away with the upper stack). */
function smokeAt(x, y, z) {
  const smoke = new THREE.Group();
  smoke.userData.dynamic = true;
  smoke.position.set(x, y, z);
  const puffMat = new THREE.MeshLambertMaterial({ color: 0xf2f2f2, transparent: true, opacity: 0, depthWrite: false });
  for (let i = 0; i < 6; i++) {
    const puff = new THREE.Mesh(new THREE.IcosahedronGeometry(0.28, 0), puffMat.clone());
    puff.userData.phase = i / 6;
    puff.userData.dynamic = true;
    puff.userData.ownMaterial = true;
    smoke.add(puff);
  }
  return smoke;
}

/** A small gable canopy over a door with timber brackets (local y0 is below the wall top). */
function doorCanopy(g, style, { x, z = 5.2, y0 = -0.45, w = 2.2, d = 1.0, posts = false }) {
  const cz = z + d / 2;
  if (style.form === 'flat') g.add(box(w, 0.14, d, darker(style.color, 0.9), x, y0 + 0.05, cz));
  else if (style.form === 'hip') {
    const c = frustum(w, 0.45, d, 0.25, 0, shingle(style.color));
    c.position.set(x, y0 + 0.22, cz);
    g.add(c);
  } else {
    // A shed canopy sloping down to the street.
    const slab = box(w, 0.1, Math.hypot(d, 0.45), 0, x, y0 + 0.22, cz, { material: shingle(style.color) });
    slab.rotation.x = Math.atan2(0.45, d);
    g.add(slab);
  }
  g.add(box(w, 0.12, 0.14, TIMBER, x, y0 - 0.02, z + d - 0.08));
  for (const s of [-1, 1]) {
    const bracket = box(0.1, 0.6, 0.1, TIMBER, x + s * (w / 2 - 0.12), y0 - 0.3, z + 0.32);
    bracket.rotation.x = 0.6;
    g.add(bracket);
    if (posts) g.add(box(0.12, 0.12, d, TIMBER, x + s * (w / 2 - 0.12), y0 - 0.02, cz));
  }
}

/** A dormer on a front roof slope: a box with a small gable and a window. */
function dormer(g, glass, style, { x, zFront, y0, w = 1.6, h = 1.2, depth = 1.8, wallColor }) {
  const cz = zFront - depth / 2;
  g.add(box(w, h, depth, wallColor, x, y0 + h / 2, cz));
  windowAt(g, glass, { x, y: y0 + h / 2 + 0.02, z: zFront, w: w * 0.55, h: h * 0.6, frame: TRIM, sill: false });
  if (style.form === 'flat') g.add(box(w + 0.2, 0.12, depth + 0.1, darker(style.color, 0.9), x, y0 + h + 0.06, cz));
  else roof(g, { cx: x, cz, y0: y0 + h, w, d: depth, H: 0.75, axis: 'z', ov: 0.12, style: { ...style, form: 'gable' }, wallColor });
}

/** One storey of a rectangular mass: body, a floor band and windows on chosen faces. */
function storey(g, glass, { x0, x1, z0, z1, y, h, color, band = TRIM, windows = {}, frame = TRIM, shutters = null, flowers = false }) {
  const w = x1 - x0;
  const d = z1 - z0;
  const cx = (x0 + x1) / 2;
  const cz = (z0 + z1) / 2;
  g.add(box(w, h, d, color, cx, y + h / 2, cz));
  if (band != null) g.add(box(w + 0.12, 0.12, d + 0.12, band, cx, y + 0.04, cz));
  const wy = y + h * 0.55;
  const wh = Math.min(1.25, h * 0.48);
  for (const x of windows.front || []) windowAt(g, glass, { x, y: wy, z: z1, w: windows.w || 1.2, h: wh, out: 1, frame, shutters, flowers });
  for (const x of windows.back || []) windowAt(g, glass, { x, y: wy, z: z0, w: windows.w || 1.2, h: wh, out: -1, frame, sill: false });
  for (const z of windows.left || []) windowAt(g, glass, { x: x0, y: wy, z, w: 1.1, h: wh, axis: 'z', out: -1, frame, sill: false, shutters });
  for (const z of windows.right || []) windowAt(g, glass, { x: x1, y: wy, z, w: 1.1, h: wh, axis: 'z', out: 1, frame, sill: false, shutters });
}

const range = (a, b, n) => Array.from({ length: n }, (_, i) => a + ((b - a) * i) / Math.max(1, n - 1));

// ---- Facade extras (ground floor) ---------------------------------------------------------------

/**
 * Exterior details for one ground-floor wall group. `side` is 'front' | 'back' | 'left' | 'right'.
 * @returns {{ objects: THREE.Object3D[], glows: THREE.Mesh[] }}
 */
export function facadeExtras(plan, lot, side, length, glowMaterial) {
  const objects = [];
  const glows = [];
  const along = side === 'front' || side === 'back' ? 'x' : 'z';
  const out = side === 'front' || side === 'right' ? 1 : -1;
  const at = (a, y, n) => (along === 'x' ? [a, y, n * out] : [n * out, y, a]);
  const piece = (len, h, depth, a, y, n, color) => objects.push(along === 'x' ? box(len, h, depth, color, ...at(a, y, n)) : box(depth, h, len, color, ...at(a, y, n)));
  if (plan.plinth) piece(length + 0.06, plan.stoneBase ? 0.95 : 0.34, 0.06, 0, plan.stoneBase ? 0.47 : 0.17, 0.12, plan.stoneBase ? STONE : STONE_DARK);
  if (plan.stoneBase) for (const y of [0.32, 0.64]) piece(length + 0.08, 0.03, 0.07, 0, y, 0.14, STONE_DARK);
  if (plan.quoins) {
    for (const s of [-1, 1]) {
      for (let i = 0; i < 6; i++) {
        const long = i % 2 === 0;
        piece(long ? 0.55 : 0.34, 0.36, 0.07, s * (length / 2 - (long ? 0.27 : 0.17)), 0.25 + i * 0.42, 0.13, STONE);
      }
    }
  }
  if (side !== 'front') return { objects, glows };

  const lantern = (x, y = 1.85) => {
    objects.push(box(0.08, 0.32, 0.12, RAIL, x, y, 0.2));
    const glow = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.22, 0.16), glowMaterial);
    glow.position.set(x, y + 0.02, 0.3);
    glow.userData.dynamic = true;
    glow.userData.nightGlow = 2.4;
    glows.push(glow);
    objects.push(glow);
  };
  for (const d of doorsOf(plan)) {
    lantern(d.x + d.w / 2 + 0.32);
    if (plan.stoneBase) {
      // A wood-clad portal around the entrance.
      for (const s of [-1, 1]) piece(0.32, 2.45, 0.12, d.x + s * (d.w / 2 + 0.2), 1.22, 0.16, TIMBER);
      piece(d.w + 0.72, 0.3, 0.14, d.x, 2.4, 0.17, TIMBER);
    }
  }
  if (plan.key === 'duplex') piece(0.24, 2.7, 0.08, 0, 1.35, 0.13, TIMBER); // the party line between the homes
  if (plan.key === 'townhouse-row') for (const x of [-3.6, 0, 3.6]) piece(0.16, 2.7, 0.06, x, 1.35, 0.12, STONE);
  if (plan.bay) {
    // A bay window pushing out from the front wall, with its own little roof (lifted with the upper stack).
    const { x0, x1, depth } = plan.bay;
    const cx = (x0 + x1) / 2;
    const w = x1 - x0;
    objects.push(box(w, 0.7, depth, lot.exterior, cx, 0.35, depth / 2 + 0.1));
    objects.push(box(w + 0.1, 0.08, depth + 0.1, TRIM, cx, 0.74, depth / 2 + 0.12));
    for (const [px, pw] of [[cx, w - 0.5]]) {
      const pane = new THREE.Mesh(new THREE.BoxGeometry(pw, 1.25, 0.04), lot.glass);
      pane.position.set(px, 1.42, depth + 0.1);
      objects.push(pane);
    }
    for (const s of [-1, 1]) {
      objects.push(box(0.16, 1.4, 0.16, TRIM, cx + s * (w / 2 - 0.08), 1.42, depth + 0.08));
      const side = new THREE.Mesh(new THREE.BoxGeometry(0.04, 1.25, depth - 0.25), lot.glass);
      side.position.set(cx + s * (w / 2 - 0.02), 1.42, depth / 2 + 0.05);
      objects.push(side);
    }
    objects.push(box(w + 0.08, 0.1, depth + 0.08, TRIM, cx, 2.12, depth / 2 + 0.12));
  }
  return { objects, glows };
}

// ---- Upper stacks -----------------------------------------------------------------------------

/**
 * Upper floors and roof for a tier, in a group whose y = 0 is the top of the ground-floor walls.
 * @returns {{ group: THREE.Group, smoke: THREE.Group|null, top: number }}
 */
export function buildUpper(plan, lot, r) {
  const g = new THREE.Group();
  const style = ROOF_STYLES[lot.arch] || ROOF_STYLES.cottage;
  const body = lot.exterior;
  const glass = lot.glass;
  const shut = 0x3e4a66;
  let smoke = null;
  let top = 0;
  const eave = () => g.add(box(14.6, 0.12, 10.6, TRIM, 0, 0.0, 0));
  const pitched = style.form !== 'flat';
  // Chimneys clear a pitched ridge of height H; on a flat roof they're short stacks above the parapet.
  const stack = (H, extra = 0.7) => (pitched ? (style.steep || 1) * H + extra : 1.8);

  switch (plan.key) {
    case 'cottage': {
      eave();
      top = roof(g, { w: 14.4, d: 10.4, H: 3.3, axis: 'x', style, wallColor: body });
      if (style.form === 'gable') {
        // Cross gable over the entrance with half-timbering and an attic window.
        roof(g, { cx: 0, cz: 2.95, w: 5.0, d: 5.5, H: 2.7, axis: 'z', ov: 0.35, style, wallColor: body });
        timberGable(g, { x: 0, z: 5.6, y0: 0, span: 5.0, H: 2.6 });
        windowAt(g, glass, { x: 0, y: 1.05, z: 5.66, w: 0.9, h: 0.75, shutters: TIMBER, sill: false });
        for (const x of [-7.15, 7.15]) timberGable(g, { x, z: 0, y0: 0, span: 10.2, H: 3.2, axis: 'x' });
      }
      doorCanopy(g, style, { x: 0, w: 2.8, d: 0.95, posts: true });
      const cTop = chimney(g, 4.6, -1.5, 0, stack(3.3, 0.9), STONE, 1);
      smoke = smokeAt(4.6, cTop, -1.5);
      break;
    }
    case 'family-house': {
      storey(g, glass, { x0: -7.2, x1: 7.2, z0: -5.2, z1: 5.2, y: 0, h: 2.6, color: body, windows: { front: [-4.7, 3.9], back: [-4.5, 0, 4.5], left: [-2.5, 2.5], right: [-2.5, 2.5], w: 1.3 }, shutters: shut });
      windowAt(g, glass, { x: -1.0, y: 1.45, z: 5.2, w: 2.0, h: 1.2, shutters: shut });
      top = roof(g, { y0: 2.6, w: 14.4, d: 10.4, H: 3.0, axis: 'x', style, wallColor: body });
      if (pitched) {
        roof(g, { cx: -1.0, cz: 2.75, y0: 2.6, w: 5.2, d: 5.5, H: 2.5, axis: 'z', ov: 0.4, style, wallColor: body });
        if (style.form === 'gable') timberGable(g, { x: -1.0, z: 5.55, y0: 2.6, span: 5.2, H: 2.4 });
        dormer(g, glass, style, { x: 4.4, zFront: 3.4, y0: 3.55, wallColor: body });
      }
      // Porch roof over the deck, and the bay window's little roof.
      const porch = frustum(8.9, 0.6, 1.75, 0.55, 0, shingle(style.color));
      porch.position.set(2.65, -0.12, 6.0);
      g.add(porch);
      g.add(box(8.9, 0.16, 0.16, TRIM, 2.65, -0.42, 6.82));
      if (pitched) roof(g, { cx: 0, cz: 6.1, y0: 0.1, w: 2.8, d: 1.6, H: 0.85, axis: 'z', ov: 0.15, style, wallColor: TRIM });
      const bay = frustum(2.7, 0.42, 0.95, 0.4, 0, shingle(style.color));
      bay.position.set(-4.7, -0.43, 5.62);
      g.add(bay);
      const cTop = chimney(g, -5.3, -2.0, 2.6, stack(3.0, 0.9), 0x9a5b45, 2);
      smoke = smokeAt(-5.3, cTop, -2.0);
      break;
    }
    case 'duplex': {
      storey(g, glass, { x0: -7.2, x1: 7.2, z0: -5.2, z1: 5.2, y: 0, h: 2.6, color: body, windows: { front: [-6.0, 6.0], back: [-4.5, -1.5, 1.5, 4.5], left: [-2.5, 2.5], right: [-2.5, 2.5], w: 1.0 }, flowers: false });
      for (const x of [-3.4, 3.4]) windowAt(g, glass, { x, y: 1.45, z: 5.2, w: 1.5, h: 1.15, flowers: true });
      g.add(box(0.24, 2.6, 0.1, TIMBER, 0, 1.3, 5.26));
      for (const x of [-7.15, 7.15]) for (let i = 0; i < 6; i++) g.add(box(0.07, 0.36, i % 2 ? 0.34 : 0.55, STONE, x + Math.sign(x) * 0.06, 0.25 + i * 0.42, 5.2 - (i % 2 ? 0.17 : 0.27)));
      top = roof(g, { y0: 2.6, w: 14.4, d: 10.4, H: 3.2, axis: 'x', style, wallColor: body });
      if (pitched) {
        for (const x of [-3.4, 3.4]) {
          roof(g, { cx: x, cz: 2.75, y0: 2.6, w: 4.8, d: 5.5, H: 2.7, axis: 'z', ov: 0.35, style, wallColor: body });
          if (style.form === 'gable') timberGable(g, { x, z: 5.55, y0: 2.6, span: 4.8, H: 2.6 });
          windowAt(g, glass, { x, y: 3.55, z: 5.57, w: 0.8, h: 0.7, sill: false });
        }
      }
      for (const x of [-2.2, 2.2]) doorCanopy(g, style, { x, w: 1.9, d: 0.85 });
      chimney(g, -6.2, -0.6, 2.6, stack(3.2), STONE, 2);
      const cTop = chimney(g, 6.2, -0.6, 2.6, stack(3.2), STONE, 2);
      smoke = smokeAt(6.2, cTop, -0.6);
      break;
    }
    case 'townhouse-row': {
      storey(g, glass, { x0: -7.2, x1: 7.2, z0: -5.2, z1: 5.2, y: 0, h: 2.7, color: body, windows: { front: [-6.3, -4.5, -2.7, -0.9, 0.9, 2.7, 4.5, 6.3], back: [-5.4, -1.8, 1.8, 5.4], left: [-2.6, 0, 2.6], right: [-2.6, 0, 2.6], w: 1.0 }, flowers: true });
      for (const x of [-3.6, 0, 3.6]) g.add(box(0.16, 2.7, 0.08, STONE, x, 1.35, 5.25));
      for (const x of [-7.15, 7.15]) for (let i = 0; i < 6; i++) g.add(box(0.07, 0.36, i % 2 ? 0.34 : 0.55, STONE, x + Math.sign(x) * 0.06, 0.25 + i * 0.42, 5.2 - (i % 2 ? 0.17 : 0.27)));
      top = roof(g, { y0: 2.7, w: 14.4, d: 10.4, H: 3.4, axis: 'x', style, wallColor: body });
      if (pitched) {
        // Party walls rise through the roof between the homes; a chimney stack tops each.
        for (const x of [-3.6, 0, 3.6]) {
          const wall = prism(0.22, 10.9, 3.55, STONE, 'x');
          wall.position.set(x, 2.7, 0);
          g.add(wall);
        }
        for (const x of [-5.4, -1.8, 1.8, 5.4]) dormer(g, glass, style, { x, zFront: 3.3, y0: 3.75, w: 1.5, wallColor: TRIM });
      }
      let cTop = 0;
      for (const x of [-6.9, -3.6, 0, 3.6]) cTop = chimney(g, x, 0, 2.7, stack(3.4), STONE, 2);
      smoke = smokeAt(3.6, cTop, 0);
      for (const d of doorsOf(plan)) doorCanopy(g, style, { x: d.x, w: 1.6, d: 0.75 });
      break;
    }
    case 'small-apartment': {
      const H = 2.6;
      for (let i = 0; i < 3; i++) {
        const y = i * H;
        storey(g, glass, { x0: -7.2, x1: 7.2, z0: -5.2, z1: 5.2, y, h: H, color: body, windows: { front: [], back: [-5, -2.5, 0, 2.5, 5], left: [-3, 0, 3], right: [-3, 0, 3], w: 1.1 } });
        // Wood-clad center bay with a tall window, French doors behind the side balconies.
        g.add(box(3.2, H, 0.3, TIMBER, 0, y + H / 2, 5.32));
        windowAt(g, glass, { x: 0, y: y + 1.35, z: 5.48, w: 1.6, h: 1.5, frame: TIMBER_DARK });
        for (const s of [-1, 1]) {
          windowAt(g, glass, { x: s * 4.4, y: y + 1.15, z: 5.2, w: 2.4, h: 1.9, frame: TIMBER_DARK, sill: false });
          balcony(g, r, { x0: s > 0 ? 2.3 : -6.7, x1: s > 0 ? 6.7 : -2.3, y: y + 0.1, zFace: 5.2, depth: 1.0, slab: TIMBER });
          g.add(box(0.06, 0.3, 0.12, RAIL, s * 6.4, y + 1.9, 5.28));
        }
      }
      for (const x of [-1.85, 1.85, -7.25, 7.25]) g.add(box(0.36, 3 * H, 0.32, TRIM, x, 1.5 * H, 5.25));
      g.add(box(14.9, 0.32, 10.9, TRIM, 0, 3 * H + 0.12, 0));
      if (pitched) {
        const hip = frustum(15.2, 1.7, 11.2, 0.45, 0, shingle(style.color));
        hip.position.set(0, 3 * H + 0.28 + 0.85, 0);
        g.add(hip);
        top = 3 * H + 2.0;
      } else top = roof(g, { y0: 3 * H + 0.2, w: 14.4, d: 10.4, H: 0, style, wallColor: body });
      g.add(box(2.6, 1.7, 1.9, TRIM, 3.4, top + 0.5, -2.2));
      g.add(box(2.8, 0.18, 2.1, darker(style.color, 0.9), 3.4, top + 1.42, -2.2));
      g.add(box(1.0, 0.7, 0.8, 0xb8bec7, -3.2, top + 0.2, -2.6));
      top += 1.6;
      // Entrance canopy.
      g.add(box(3.6, 0.18, 1.5, darker(style.color, 0.95), 0, -0.3, 5.95));
      g.add(box(3.6, 0.12, 0.12, TIMBER, 0, -0.42, 6.65));
      break;
    }
    case 'apartment-block': {
      const H = 2.5;
      const floors = 5;
      const wings = [
        { x0: -7.2, x1: -2.8, z0: -5.2, z1: 5.2, front: [-6.1, -3.9], inner: 'right' },
        { x0: 2.8, x1: 7.2, z0: -5.2, z1: 5.2, front: [3.9, 6.1], inner: 'left' },
        { x0: -2.8, x1: 2.8, z0: -5.2, z1: -1.4, front: [-1.5, 0, 1.5], inner: null },
      ];
      for (let i = 0; i < floors; i++) {
        const y = i * H;
        for (const w of wings) {
          // Street-side faces get four windows; faces onto the courtyard get three.
          const outer = [-3.6, -1.2, 1.2, 3.6];
          const court = [-0.2, 2.2, 4.4];
          const left = w.inner === 'left' ? court : w.x0 < -7 ? outer : [];
          const right = w.inner === 'right' ? court : w.x1 > 7 ? outer : [];
          const back = w.inner ? [(w.x0 + w.x1) / 2 - 1, (w.x0 + w.x1) / 2 + 1] : [-1.4, 1.4];
          storey(g, glass, { x0: w.x0, x1: w.x1, z0: w.z0, z1: w.z1, y, h: H, color: body, windows: { front: w.front, back, left, right, w: 1.05 }, frame: TRIM });
          // Planter balconies under the street-facing windows.
          for (const x of w.front) {
            const zf = w.z1;
            g.add(box(1.4, 0.12, 0.6, TIMBER, x, y + 0.42, zf + 0.3));
            railing(g, x - 0.66, zf + 0.56, x + 0.66, zf + 0.56, y + 0.48, 0.5, RAIL);
            plantRow(g, x - 0.55, x + 0.55, y + 0.5, zf + 0.3, r, { size: 0.12 });
          }
        }
        // Courtyard-facing balconies on the wings.
        for (const s of [-1, 1]) sideBalcony(g, r, { z0: 1.6, z1: 3.2, y: y + 0.1, xFace: s * 2.8, depth: 0.7, slab: TIMBER, side: -s });
      }
      // Mansard roofs with dormers, then flat caps and chimney stacks.
      const yTop = floors * H;
      for (const w of wings) {
        const cx = (w.x0 + w.x1) / 2;
        const cz = (w.z0 + w.z1) / 2;
        const ww = w.x1 - w.x0;
        const wd = w.z1 - w.z0;
        g.add(box(ww + 0.3, 0.26, wd + 0.3, TRIM, cx, yTop + 0.1, cz));
        const m = frustum(ww + 0.2, 1.8, wd + 0.2, 0.72, 0, shingle(style.form === 'flat' ? darker(style.color, 0.85) : style.color));
        m.position.set(cx, yTop + 0.23 + 0.9, cz);
        g.add(m);
        g.add(box(ww * 0.72, 0.12, wd * 0.72, darker(style.color, 0.85), cx, yTop + 2.1, cz));
        g.add(box(1.0, 0.8, 0.9, TRIM, cx + ww * 0.2, yTop + 2.5, cz - wd * 0.2));
      }
      for (const x of [-6.1, -3.9, 3.9, 6.1]) {
        g.add(box(0.9, 0.9, 0.5, body, x, yTop + 0.95, 5.25));
        windowAt(g, glass, { x, y: yTop + 0.95, z: 5.5, w: 0.5, h: 0.45, sill: false });
      }
      top = yTop + 3.0;
      // The courtyard garden on the podium roof.
      g.add(box(5.6, 0.14, 6.6, PALETTE.grassLot, 0, 0.07, 1.9));
      g.add(cyl(1.0, 1.0, 0.2, STONE, 14, 0, 0.17, 1.9));
      g.add(cyl(0.12, 0.16, 1.1, PALETTE.trunk, 6, 0, 0.7, 1.9));
      g.add(ico(0.95, PALETTE.leaf, 0, 1.75, 1.9, 0));
      for (const z of [0.4, 3.6]) for (const s of [-1, 1]) g.add(box(1.0, 0.35, 0.36, TIMBER, s * 1.75, 0.3, z));
      for (const s of [-1, 1]) {
        g.add(cyl(0.04, 0.05, 1.2, RAIL, 6, s * 2.2, 0.75, 4.6));
        g.add(ico(0.09, 0xfff1c9, s * 2.2, 1.4, 4.6));
        g.add(cone(0.35, 1.4, PALETTE.leafDark, s * 2.3, 0.15, -0.6));
      }
      railing(g, -2.75, 5.15, 2.75, 5.15, 0.14, 0.7, RAIL);
      plantRow(g, -2.6, 2.6, 0.14, 4.85, r);
      g.add(box(3.2, 0.16, 1.4, darker(style.color, 0.95), 0, -0.3, 5.9));
      break;
    }
    case 'residential-tower': {
      // Podium roof: planters around the tower's base.
      g.add(box(14.6, 0.16, 10.6, TRIM, 0, 0.05, 0));
      for (const [x0, x1, z] of [[-7.0, -1.6, 4.85], [1.6, 7.0, 4.85]]) {
        g.add(box(x1 - x0, 0.36, 0.5, STONE, (x0 + x1) / 2, 0.3, z));
        plantRow(g, x0 + 0.1, x1 - 0.1, 0.45, z, r);
      }
      const T = { x0: -5.4, x1: 5.4, z0: -4.6, z1: 3.8 };
      const H = 2.4;
      const floors = 9;
      for (let i = 0; i < floors; i++) {
        const y = 0.13 + i * H;
        storey(g, glass, { ...T, y, h: H, color: body, windows: { front: [], back: [-3.6, -1.2, 1.2, 3.6], left: [-3.2, -1.0, 1.2], right: [-3.2, -1.0, 1.2], w: 1.1 } });
        // Glazed center strip with wood spandrels.
        windowAt(g, glass, { x: 0, y: y + 1.2, z: T.z1, w: 2.4, h: 1.7, frame: TIMBER_DARK, sill: false });
        g.add(box(2.7, 0.35, 0.12, TIMBER, 0, y + 0.18, T.z1 + 0.06));
        for (const s of [-1, 1]) {
          windowAt(g, glass, { x: s * 3.6, y: y + 1.1, z: T.z1, w: 2.2, h: 1.75, frame: TIMBER_DARK, sill: false });
          balcony(g, r, { x0: s > 0 ? 2.0 : -5.6, x1: s > 0 ? 5.6 : -2.0, y: y + 0.1, zFace: T.z1, depth: 0.95, slab: TRIM, planters: i % 2 === 0 });
          sideBalcony(g, r, { z0: 1.4, z1: 3.8, y: y + 0.1, xFace: s * 5.4, depth: 0.75, slab: TRIM, side: s });
          g.add(box(0.06, 0.26, 0.1, 0xffe1a8, s * 5.2, y + 1.85, T.z1 + 0.06));
        }
      }
      const yTop = 0.13 + floors * H;
      for (const x of [-1.6, 1.6]) g.add(box(0.5, yTop + 0.6, 0.45, TRIM, x, (yTop + 0.6) / 2, T.z1 + 0.18));
      for (const x of [-5.45, 5.45]) g.add(box(0.5, yTop, 0.5, TRIM, x, yTop / 2, T.z1));
      g.add(box(1.4, yTop - 2.4, 0.2, TIMBER, 0, (yTop - 2.4) / 2 + 2.4, T.z0 - 0.1));
      // Roof deck: a pool, a pergola, an umbrella, loungers and planters, behind a parapet.
      g.add(box(11.2, 0.3, 8.8, 0x5d6370, 0, yTop + 0.15, -0.4));
      for (const [pw, pd, px, pz] of [[11.2, 0.25, 0, 3.9], [11.2, 0.25, 0, -4.7], [0.25, 8.8, 5.5, -0.4], [0.25, 8.8, -5.5, -0.4]]) g.add(box(pw, 0.7, pd, 0x5d6370, px, yTop + 0.55, pz));
      g.add(box(10.4, 0.06, 8.0, TIMBER, 0, yTop + 0.33, -0.4));
      g.add(box(4.0, 0.14, 2.6, 0xe8e3d8, 0.6, yTop + 0.4, 0.6));
      const water = box(3.6, 0.04, 2.2, 0x7fc4ec, 0.6, yTop + 0.48, 0.6, { material: waterMaterial() });
      water.castShadow = false;
      water.userData.dynamic = true;
      g.add(water);
      for (const [x, z] of [[-4.6, -3.6], [-1.6, -3.6], [-4.6, -1.4], [-1.6, -1.4]]) g.add(box(0.14, 2.0, 0.14, TIMBER, x, yTop + 1.35, z));
      for (let i = 0; i < 7; i++) g.add(box(3.4, 0.08, 0.14, TIMBER, -3.1, yTop + 2.38, -3.8 + i * 0.4));
      for (const z of [-3.2, -2.0]) g.add(softBox(1.5, 0.3, 0.6, TRIM, -3.1, yTop + 0.5, z, 0.08));
      g.add(cyl(0.03, 0.03, 2.0, RAIL, 6, 4.0, yTop + 1.3, -2.6));
      g.add(cyl(0.02, 1.2, 0.45, 0xf1e1c4, 10, 4.0, yTop + 2.35, -2.6));
      for (const [x, z] of [[-4.6, 2.9], [4.6, 2.9], [4.6, 0.6], [-4.6, 0.6]]) {
        g.add(box(0.8, 0.5, 0.8, STONE, x, yTop + 0.55, z));
        g.add(cone(0.35, 1.5, PALETTE.leafDark, x, yTop + 0.8, z));
      }
      top = yTop + 2.6;
      // Entrance pergola.
      for (let i = 0; i < 9; i++) g.add(box(0.1, 0.12, 1.7, TIMBER, -2.0 + i * 0.5, -0.25, 6.0));
      for (const z of [5.3, 6.75]) g.add(box(4.4, 0.16, 0.14, TIMBER_DARK, 0, -0.38, z));
      break;
    }
    case 'landmark-residence': {
      // Podium terraces with planters, umbrellas and small trees.
      g.add(box(14.6, 0.18, 10.6, TRIM, 0, 0.06, 0));
      railing(g, -7.1, 5.2, -2.4, 5.2, 0.15, 0.7, 0x9fb3bf);
      railing(g, 2.4, 5.2, 7.1, 5.2, 0.15, 0.7, 0x9fb3bf);
      for (const [x0, x1] of [[-6.9, -2.6], [2.6, 6.9]]) plantRow(g, x0, x1, 0.15, 4.8, r);
      for (const s of [-1, 1]) {
        g.add(cyl(0.03, 0.03, 1.6, RAIL, 6, s * 5.6, 0.95, 3.6));
        g.add(cyl(0.02, 0.85, 0.4, 0xf4ead8, 10, s * 5.6, 1.85, 3.6));
        g.add(box(1.0, 0.45, 0.6, TIMBER, s * 5.6, 0.38, 3.6));
        g.add(cone(0.4, 1.6, PALETTE.leafDark, s * 6.5, 0.15, -4.2));
      }
      // The amenity level, one floor stepped back, with a planted terrace on top.
      const A = { x0: -6.4, x1: 6.4, z0: -4.6, z1: 4.0 };
      storey(g, glass, { ...A, y: 0.15, h: 2.6, color: body, windows: { front: [-4.8, -2.4, 2.4, 4.8], back: [-4, 0, 4], left: [-2.6, 0, 2.6], right: [-2.6, 0, 2.6], w: 1.8 } });
      g.add(box(13.2, 0.22, 9.0, TRIM, 0, 2.86, -0.3));
      for (const [x0, x1] of [[-6.2, -2.0], [2.0, 6.2]]) {
        g.add(box(x1 - x0, 0.4, 0.5, STONE, (x0 + x1) / 2, 3.17, 3.85));
        plantRow(g, x0 + 0.1, x1 - 0.1, 3.3, 3.85, r);
      }
      // The tower with full-height pilasters and stacked planted balconies.
      const T = { x0: -4.8, x1: 4.8, z0: -3.8, z1: 3.0 };
      const H = 2.4;
      const lower = 7;
      const y0 = 2.97;
      for (let i = 0; i < lower; i++) {
        const y = y0 + i * H;
        storey(g, glass, { ...T, y, h: H, color: body, windows: { front: [], back: [-3, -1, 1, 3], left: [-2.2, 0, 2.0], right: [-2.2, 0, 2.0], w: 1.0 } });
        windowAt(g, glass, { x: 0, y: y + 1.2, z: T.z1, w: 1.8, h: 1.75, frame: TIMBER_DARK, sill: false });
        for (const s of [-1, 1]) {
          windowAt(g, glass, { x: s * 3.3, y: y + 1.1, z: T.z1, w: 1.9, h: 1.7, frame: TIMBER_DARK, sill: false });
          balcony(g, r, { x0: s > 0 ? 1.9 : -5.0, x1: s > 0 ? 5.0 : -1.9, y: y + 0.1, zFace: T.z1, depth: 0.9, slab: TRIM, rail: 0x9fb3bf });
          sideBalcony(g, r, { z0: 0.6, z1: 3.0, y: y + 0.1, xFace: s * 4.8, depth: 0.7, slab: TRIM, rail: 0x9fb3bf, side: s });
        }
      }
      const yS = y0 + lower * H;
      for (const x of [-1.25, 1.25]) g.add(box(0.5, yS - y0 + 1.2, 0.5, TRIM, x, y0 + (yS - y0 + 1.2) / 2, T.z1 + 0.15));
      for (const x of [-4.85, 4.85]) g.add(box(0.4, yS - y0, 0.4, TRIM, x, (y0 + yS) / 2, T.z1));
      // Setback with terraces and pergolas, then the crown pavilion and spire.
      g.add(box(10.2, 0.22, 7.4, TRIM, 0, yS + 0.08, -0.4));
      const S = { x0: -3.8, x1: 3.8, z0: -3.2, z1: 2.2 };
      for (let i = 0; i < 3; i++) {
        storey(g, glass, { ...S, y: yS + 0.2 + i * H, h: H, color: body, windows: { front: [-2.6, 0, 2.6], back: [-2, 0, 2], left: [-1.6, 0.6], right: [-1.6, 0.6], w: 1.2 } });
      }
      for (const s of [-1, 1]) {
        g.add(box(1.7, 0.4, 0.5, STONE, s * 4.0, yS + 0.39, 2.5));
        plantRow(g, s * 4.0 - 0.75, s * 4.0 + 0.75, yS + 0.55, 2.5, r);
        for (const [x, z] of [[s * 4.4, 0.4], [s * 4.4, -1.8]]) g.add(box(0.12, 1.9, 0.12, TIMBER, x, yS + 1.15, z));
        for (let k = 0; k < 6; k++) g.add(box(0.7, 0.07, 0.12, TIMBER, s * 4.4, yS + 2.1, -1.8 + k * 0.44));
        g.add(cone(0.3, 1.3, PALETTE.leafDark, s * 4.6, yS + 0.2, -2.8));
      }
      const yC = yS + 0.2 + 3 * H;
      g.add(box(8.2, 0.24, 5.8, TRIM, 0, yC + 0.1, -0.5));
      if (style.form !== 'flat') for (const s of [-1, 1]) {
        const hip = frustum(2.6, 1.0, 5.0, 0.3, 0, shingle(style.color));
        hip.position.set(s * 2.65, yC + 0.72, -0.5);
        g.add(hip);
      }
      for (const s of [-1, 1]) railing(g, s * 1.6, 2.1, s * 3.9, 2.1, yC + 0.22, 0.6, 0x9fb3bf);
      plantRow(g, -1.4, 1.4, yC + 0.22, 1.9, r);
      storey(g, glass, { x0: -1.7, x1: 1.7, z0: -2.2, z1: 1.2, y: yC + 0.22, h: 2.2, color: TRIM, windows: { front: [0], back: [0], left: [-0.5], right: [-0.5], w: 1.2 } });
      const cap = frustum(4.2, 2.3, 4.2, 0.05, 0, shingle(style.form === 'flat' ? 0x56607a : style.color));
      cap.position.set(0, yC + 2.42 + 1.15, -0.5);
      g.add(cap);
      const spire = new THREE.Mesh(new THREE.ConeGeometry(0.16, 1.8, 6), new THREE.MeshStandardMaterial({ color: 0xd9b55a, metalness: 0.6, roughness: 0.3, flatShading: true }));
      spire.position.set(0, yC + 4.7 + 0.9, -0.5);
      spire.castShadow = true;
      spire.userData.ownMaterial = true;
      g.add(spire);
      top = yC + 6.5;
      // The grand portico over the entrance.
      g.add(box(4.6, 0.3, 1.8, TRIM, 0, -0.3, 6.05));
      const portico = frustum(4.6, 0.9, 1.8, 0.2, 0, shingle(style.form === 'flat' ? 0x56607a : style.color));
      portico.position.set(0, 0.3, 6.05);
      g.add(portico);
      break;
    }
    default:
      top = roof(g, { w: 14.4, d: 10.4, H: 2.2, axis: 'x', style, wallColor: body });
  }
  if (smoke) g.add(smoke);
  return { group: g, smoke, top };
}

/** A low-poly conifer: two stacked cones on a stub trunk, base at y. */
function cone(r, h, color, x, y, z) {
  const g = new THREE.Group();
  g.add(cyl(0.06, 0.08, h * 0.25, PALETTE.trunk, 6, 0, h * 0.12, 0));
  const lower = new THREE.Mesh(new THREE.ConeGeometry(r, h * 0.7, 7), mat(color));
  lower.position.y = h * 0.5;
  lower.castShadow = true;
  const upper = new THREE.Mesh(new THREE.ConeGeometry(r * 0.7, h * 0.5, 7), mat(darker(color, 1.08)));
  upper.position.y = h * 0.85;
  upper.castShadow = true;
  g.add(lower, upper);
  g.position.set(x, y, z);
  return g;
}

// ---- Yards ------------------------------------------------------------------------------------

const FENCE_RUNS = [[-10.8, YARD_Z, -1.2, YARD_Z], [1.2, YARD_Z, 10.8, YARD_Z], [-10.8, -YARD_Z, -10.8, YARD_Z], [10.8, -YARD_Z, 10.8, YARD_Z]];

function fence(g, style) {
  for (const [x0, z0, x1, z1] of FENCE_RUNS) {
    const len = Math.hypot(x1 - x0, z1 - z0);
    const along = x0 === x1 ? 'z' : 'x';
    const cx = (x0 + x1) / 2;
    const cz = (z0 + z1) / 2;
    const run = (w, h, y, color, opts) => g.add(along === 'x' ? softBox(len, h, w, color, cx, y, cz, 0.03, opts) : softBox(w, h, len, color, cx, y, cz, 0.03, opts));
    const pillars = (every, size, h, color) => {
      const n = Math.max(1, Math.round(len / every));
      for (let k = 0; k <= n; k++) {
        const t = k / n;
        g.add(box(size, h, size, color, x0 + (x1 - x0) * t, h / 2, z0 + (z1 - z0) * t));
        g.add(box(size + 0.1, 0.08, size + 0.1, TRIM, x0 + (x1 - x0) * t, h + 0.04, z0 + (z1 - z0) * t));
      }
    };
    if (style === 'picket') {
      const n = Math.floor(len / 0.45);
      for (let k = 0; k <= n; k++) {
        const t = k / n;
        g.add(box(0.08, 0.62, 0.08, PALETTE.trim, x0 + (x1 - x0) * t, 0.31, z0 + (z1 - z0) * t));
      }
      run(0.05, 0.06, 0.42, PALETTE.trim);
      run(0.05, 0.06, 0.2, PALETTE.trim);
    } else if (style === 'stoneWall') {
      run(0.3, 0.5, 0.25, STONE);
      run(0.36, 0.06, 0.52, TRIM);
      pillars(3.2, 0.42, 0.72, STONE);
    } else if (style === 'woodPillars') {
      const n = Math.floor(len / 0.2);
      for (let k = 0; k <= n; k++) {
        const t = k / n;
        g.add(box(along === 'x' ? 0.14 : 0.05, 0.6 + (k % 2) * 0.05, along === 'x' ? 0.05 : 0.14, TIMBER, x0 + (x1 - x0) * t, 0.3, z0 + (z1 - z0) * t));
      }
      run(0.06, 0.07, 0.45, TIMBER_DARK);
      pillars(3.2, 0.4, 0.8, TRIM);
    } else if (style === 'lowWall') {
      run(0.34, 0.42, 0.21, STONE);
      run(0.4, 0.07, 0.45, TRIM);
      run(0.28, 0.32, 0.65, PALETTE.leafDark);
      pillars(3.6, 0.44, 0.8, STONE);
    } else {
      run(0.34, 0.32, 0.16, STONE);
      run(0.32, 0.5, 0.55, PALETTE.leafDark);
      pillars(3.6, 0.44, 0.9, STONE);
    }
  }
}

/** A clump of shrubs filling a footprint. */
function shrubs(g, [x0, z0, x1, z1], r, flowers = true) {
  const n = Math.max(2, Math.round((x1 - x0) / 0.6));
  for (let i = 0; i < n; i++) {
    const x = x0 + ((i + 0.5) * (x1 - x0)) / n;
    const z = (z0 + z1) / 2 + (r() - 0.5) * (z1 - z0) * 0.4;
    const s = Math.min(0.9, (z1 - z0) * 0.9) * (0.75 + r() * 0.35);
    g.add(ico(0.42 * s, LEAF[i % 3], x, 0.32 * s, z));
    if (flowers && r() < 0.7) g.add(ico(0.09, PALETTE.flowers[Math.floor(r() * PALETTE.flowers.length)], x + 0.1, 0.62 * s, z + 0.15));
  }
}

function prop(g, kind, rect, r, glowMaterial, glows) {
  const [x0, z0, x1, z1] = rect;
  const cx = (x0 + x1) / 2;
  const cz = (z0 + z1) / 2;
  const w = x1 - x0;
  const d = z1 - z0;
  switch (kind) {
    case 'flowerBed': {
      g.add(Object.assign(box(w, 0.14, d, 0x6b4a33, cx, 0.08, cz), { castShadow: false }));
      const n = Math.round(w / 0.33);
      for (let k = 0; k < n; k++) {
        const fx = x0 + 0.15 + k * ((w - 0.3) / (n - 1));
        const fz = cz + (r() - 0.5) * d * 0.5;
        g.add(cyl(0.015, 0.015, 0.25, PALETTE.leafDark, 4, fx, 0.25, fz));
        g.add(ico(0.08, PALETTE.flowers[Math.floor(r() * PALETTE.flowers.length)], fx, 0.4, fz));
      }
      break;
    }
    case 'vegBed': {
      for (const [bw, bd, bx, bz] of [[w, 0.1, cx, z0 + 0.05], [w, 0.1, cx, z1 - 0.05], [0.1, d, x0 + 0.05, cz], [0.1, d, x1 - 0.05, cz], [0.1, d, cx, cz]]) g.add(box(bw, 0.32, bd, TIMBER, bx, 0.16, bz));
      g.add(Object.assign(box(w - 0.15, 0.24, d - 0.15, 0x5a3d2a, cx, 0.12, cz), { castShadow: false }));
      for (let i = 0; i < 6; i++) for (let j = 0; j < 2; j++) {
        const x = x0 + 0.35 + i * ((w - 0.7) / 5);
        const z = z0 + 0.3 + j * (d - 0.6);
        if ((i + j) % 2) {
          const carrot = new THREE.Mesh(new THREE.ConeGeometry(0.06, 0.18, 5), mat(0xf08a3c));
          carrot.position.set(x, 0.3, z);
          carrot.rotation.x = Math.PI;
          g.add(carrot);
          g.add(ico(0.1, PALETTE.leafLight, x, 0.45, z));
        } else g.add(ico(0.17, 0x8fc46a, x, 0.36, z));
      }
      break;
    }
    case 'barrel':
      g.add(cyl(0.24, 0.21, 0.5, TIMBER, 10, cx, 0.25, cz));
      g.add(cyl(0.25, 0.25, 0.05, RAIL, 10, cx, 0.4, cz));
      g.add(ico(0.26, PALETTE.leaf, cx, 0.66, cz));
      g.add(ico(0.07, PALETTE.flowers[0], cx + 0.12, 0.8, cz + 0.1));
      break;
    case 'canopyPost':
      g.add(box(0.12, 2.38, 0.12, TIMBER, cx, 1.19, cz));
      break;
    case 'porchPost':
      g.add(box(0.3, 0.7, 0.3, STONE, cx, 0.35, cz));
      g.add(box(0.2, 1.75, 0.2, TRIM, cx, 1.55, cz));
      break;
    case 'railing':
      railing(g, x0 + (w > d ? 0 : w / 2), z0 + (w > d ? d / 2 : 0), w > d ? x1 : x0 + w / 2, w > d ? z0 + d / 2 : z1, 0.12, 0.7, TIMBER);
      break;
    case 'porch': {
      g.add(Object.assign(box(w, 0.08, d, TIMBER, cx, 0.13, cz), { castShadow: false }));
      for (let i = 0; i < Math.round(w / 0.32); i++) g.add(Object.assign(box(0.02, 0.085, d, TIMBER_DARK, x0 + 0.3 + i * 0.32, 0.135, cz), { castShadow: false }));
      g.add(Object.assign(box(2.0, 0.06, 0.55, STONE, 0, 0.1, z1 + 0.25), { castShadow: false }));
      break;
    }
    case 'bush':
      g.add(buildBush(cx, cz, Math.min(w, d)));
      break;
    case 'roses':
      shrubs(g, rect, r, true);
      for (let i = 0; i < 5; i++) g.add(ico(0.11, 0xf28da4, x0 + r() * w, 0.55 + r() * 0.2, z0 + r() * d));
      break;
    case 'shrubs':
      shrubs(g, rect, r, true);
      break;
    case 'evergreen':
      g.add(cone(Math.min(w, d) * 0.5, 2.0 + r() * 0.6, PALETTE.leafDark, cx, 0.05, cz));
      break;
    case 'hedge':
      g.add(softBox(w, 0.85, d, PALETTE.leafDark, cx, 0.45, cz, 0.12));
      for (let i = 0; i < Math.round(Math.max(w, d) / 0.7); i++) g.add(ico(0.08, PALETTE.flowers[2], x0 + r() * w, 0.9, z0 + r() * d));
      break;
    case 'planter':
      g.add(box(w, 0.42, d, STONE, cx, 0.21, cz));
      g.add(Object.assign(box(w - 0.12, 0.05, d - 0.12, 0x5a3d2a, cx, 0.43, cz), { castShadow: false }));
      plantRow(g, x0 + 0.1, x1 - 0.1, 0.42, cz, r);
      break;
    case 'raisedPlanter':
      g.add(box(w, 0.5, d, STONE, cx, 0.25, cz));
      g.add(box(w + 0.08, 0.06, d + 0.08, TRIM, cx, 0.52, cz));
      shrubs({ add: (m) => (m.position.y += 0.45, g.add(m)) }, rect, r, true);
      break;
    case 'terrace':
      g.add(box(w, 0.42, d, STONE, cx, 0.21, cz));
      g.add(box(w * 0.7, 0.42, d * 0.55, STONE, cx, 0.63, cz - d * 0.15));
      plantRow(g, x0 + 0.15, x1 - 0.15, 0.42, z1 - 0.18, r);
      shrubs({ add: (m) => (m.position.y += 0.8, g.add(m)) }, [x0 + w * 0.18, z0 + 0.15, x1 - w * 0.18, cz], r, true);
      break;
    case 'lamp': {
      g.add(cyl(0.05, 0.07, 2.1, RAIL, 6, cx, 1.05, cz));
      g.add(box(0.26, 0.06, 0.26, RAIL, cx, 2.12, cz));
      const glow = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.26, 0.2), glowMaterial);
      glow.position.set(cx, 2.3, cz);
      glow.userData.dynamic = true;
      glow.userData.nightGlow = 2.6;
      glows.push(glow);
      g.add(glow);
      g.add(box(0.3, 0.06, 0.3, RAIL, cx, 2.46, cz));
      break;
    }
    case 'bench':
      g.add(box(w, 0.07, 0.4, TIMBER, cx, 0.45, cz));
      g.add(box(w, 0.35, 0.06, TIMBER, cx, 0.68, z1 - 0.03));
      for (const s of [-1, 1]) g.add(box(0.07, 0.45, 0.4, RAIL, cx + s * (w / 2 - 0.15), 0.22, cz));
      break;
    default:
      break;
  }
}

/** Paths from the gate to each door. */
function paths(g, plan) {
  const flat = (m) => ((m.castShadow = false), m);
  const doors = doorsOf(plan);
  if (plan.key === 'cottage' || plan.key === 'family-house') {
    for (let i = 0; i < 3; i++) {
      const s = softBox(1.25, 0.06, 0.62, PALETTE.sidewalk, (i % 2 ? 0.1 : -0.08), 0.08, 5.65 + i * 0.68 + (plan.key === 'family-house' ? 0.4 : 0), 0.15);
      s.rotation.y = (i - 1) * 0.08;
      g.add(flat(s));
    }
    return;
  }
  if (plan.key === 'duplex') {
    g.add(flat(box(2.0, 0.05, 1.0, STONE, 0, 0.08, 6.95)));
    for (const d of doors) {
      g.add(flat(box(1.3, 0.05, 1.6, STONE, d.x, 0.08, 6.0)));
      g.add(flat(box(Math.abs(d.x) - 0.4, 0.05, 0.9, STONE, d.x / 2, 0.08, 6.7)));
    }
    return;
  }
  if (plan.key === 'townhouse-row') {
    g.add(flat(box(15.4, 0.05, 1.3, STONE, 0, 0.08, 6.55)));
    g.add(flat(box(2.0, 0.05, 0.4, STONE, 0, 0.08, 7.25)));
    for (const d of doors) g.add(flat(box(d.w + 0.3, 0.12, 0.55, STONE_DARK, d.x, 0.1, 5.55)));
    return;
  }
  // Apartments: a paved forecourt and entrance steps.
  g.add(flat(box(3.2, 0.05, 2.25, STONE, 0, 0.08, 6.35)));
  g.add(flat(box(2.6, 0.12, 0.5, STONE_DARK, 0, 0.1, 5.5)));
  g.add(flat(box(14.2, 0.05, 0.4, STONE, 0, 0.08, 5.45)));
}

/**
 * The tier's yard. `props` comes from yardProps(plan, decor) so landscaping yields to the player's decor.
 * @returns {{ group: THREE.Group, glows: THREE.Mesh[], trees: THREE.Group[] }}
 */
export function buildYard(plan, lot, props, glowMaterial, r) {
  const g = new THREE.Group();
  const glows = [];
  fence(g, plan.fence);
  paths(g, plan);
  for (const [kind, ...rect] of [...props.soft, ...props.blocking]) prop(g, kind, rect, r, glowMaterial, glows);
  // Night light spilling from the front windows and doors onto the yard.
  for (const o of plan.front) g.add(buildLightPool(Math.max(1.6, o.w + 0.8), o.kind === 'door' ? 2.4 : 1.8, o.x, 0.075, o.kind === 'door' ? 6.5 : 6.3));
  const trees = plan.trees.map(([x, z, kind], i) => buildTree(lot.seed + 1 + i, x, z, kind));
  return { group: g, glows, trees };
}
