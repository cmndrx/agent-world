// Downtown (play layer): a main street east of the homes that builds itself from the kinds of work your
// agents actually do (shared/city.mjs). Businesses go from a surveyed lot, to a construction site, to an
// open storefront as that kind of work shows up on more days. Each one explains why it's there.

import * as THREE from 'three';
import { CSS2DObject } from 'three/addons/renderers/CSS2DRenderer.js';
import { BUSINESSES, STAGE_NAMES, TIERS, businessName, businessProgress, downtown, whyText } from '../../shared/city.mjs';
import { icon } from './icons.js';
import { LOT_W } from './lot.js';
import { PALETTE, box, buildLightPool, cyl, ico, mat, mergeStatic } from './models.js';
import { escapeHtml as esc } from './sim.js';

export const DOWNTOWN_X = LOT_W * 3.5; // center of the two plots east of the homes
const PLOTS = 8;
const PLOT_W = 6.5;
const BLD = { w: 5.4, d: 5.6, z: 1.6 }; // storefront footprint; its front faces the street (+z)
const plotX = (i) => (i - (PLOTS - 1) / 2) * PLOT_W;

function glowMat(color, base = 0.12) {
  const m = new THREE.MeshStandardMaterial({ color, emissive: color, emissiveIntensity: base, roughness: 0.35 });
  m.userData.dayGlow = base;
  return m;
}

/** Roof prop that says what the business does. */
function prop(kind, color) {
  const g = new THREE.Group();
  if (kind === 'lens') {
    const ring = new THREE.Mesh(new THREE.TorusGeometry(0.55, 0.09, 8, 20), glowMat(0xdfe7ef, 0.05));
    ring.position.y = 0.9;
    g.add(ring, box(0.14, 0.7, 0.14, PALETTE.wood, 0.5, 0.25, 0));
    g.children.at(-1).rotation.z = 0.7;
  } else if (kind === 'envelope') {
    g.add(box(1.4, 0.9, 0.12, 0xfbfaf6, 0, 0.6, 0));
    const flap = box(1.0, 1.0, 0.04, 0xe9e1d0, 0, 0.88, 0.07);
    flap.rotation.z = Math.PI / 4;
    flap.scale.y = 0.55;
    g.add(flap, box(0.22, 0.22, 0.05, 0xd94f4f, 0, 0.6, 0.1));
  } else if (kind === 'crates') {
    for (const [x, y, z] of [[-0.45, 0.3, 0], [0.45, 0.3, 0.05], [0, 0.9, 0]]) g.add(box(0.8, 0.6, 0.8, PALETTE.woodLight, x, y, z));
  } else if (kind === 'books') {
    PALETTE.books.slice(0, 4).forEach((c, i) => g.add(box(1.3 - i * 0.12, 0.26, 0.9, c, 0, 0.14 + i * 0.27, 0)));
  } else if (kind === 'palette') {
    const disc = cyl(0.75, 0.75, 0.08, 0xf2e3c6, 16, 0, 0.9, 0);
    disc.rotation.x = Math.PI / 2 - 0.4;
    g.add(disc, box(0.1, 0.6, 0.1, PALETTE.wood, 0, 0.3, -0.1));
    [0xe56b8a, 0x4f86c6, 0xe6c84f, 0x5fbf73].forEach((c, i) => {
      const a = (i / 4) * Math.PI * 1.4 + 0.4;
      g.add(ico(0.11, c, Math.cos(a) * 0.45, 0.9 + Math.sin(a) * 0.38, 0.12));
    });
  } else if (kind === 'paper') {
    const roll = cyl(0.35, 0.35, 1.4, 0xfbfaf6, 12, 0, 0.4, 0);
    roll.rotation.z = Math.PI / 2;
    g.add(roll, box(1.3, 0.04, 0.9, 0xfbfaf6, 0, 0.06, 0.6));
  } else if (kind === 'dome') {
    const dome = new THREE.Mesh(new THREE.SphereGeometry(1.1, 14, 8, 0, Math.PI * 2, 0, Math.PI / 2), new THREE.MeshStandardMaterial({ color: 0xdfe5ec, roughness: 0.3, metalness: 0.4, flatShading: true }));
    dome.castShadow = true;
    g.add(dome, box(0.3, 1.0, 1.1, 0x34405a, 0, 0.55, 0.15));
  } else {
    for (const x of [-0.6, 0.6]) {
      g.add(cyl(0.03, 0.03, 1.1, PALETTE.metal, 6, x, 0.55, 0));
      g.add(cyl(0, 0.6, 0.3, color, 8, x, 1.15, 0));
      g.add(box(0.4, 0.06, 0.4, PALETTE.woodLight, x, 0.3, 0.45));
    }
  }
  return g;
}

const wallOf = (b) => new THREE.Color(b.color).lerp(new THREE.Color(0xf4efe6), 0.55).getHex();
const darkOf = (b, k = 0.7) => new THREE.Color(b.color).multiplyScalar(k).getHex();

/** A lit window pane (glows at night). */
function pane(w, h, x, y, z, color = 0xffc47a, lit = true) {
  const m = glowMat(color, 0.05);
  m.userData.nightGlow = lit ? 0.5 : 0.04; // some offices are dark at night
  const mesh = new THREE.Mesh(new THREE.BoxGeometry(w, h, 0.06), m);
  mesh.position.set(x, y, z);
  mesh.userData.dynamic = true;
  mesh.userData.glow = true;
  return mesh;
}

/** Upper floors with a row of windows on the street side. Returns the new roof height. */
function upperFloors(g, b, from, floors, inset = 0.2) {
  let y = from;
  for (let f = 0; f < floors; f++) {
    const fh = 2.4;
    g.add(box(BLD.w - inset, fh, BLD.d - inset, wallOf(b), 0, y + fh / 2, 0));
    for (const x of [-1.7, 0, 1.7]) {
      const lit = Math.abs(Math.sin(x * 12.9898 + y * 78.233 + b.color * 0.001)) > 0.38;
      g.add(pane(1.0, 1.1, x, y + 1.25, (BLD.d - inset) / 2 + 0.02, 0xffc47a, lit));
    }
    g.add(box(BLD.w - inset + 0.2, 0.18, BLD.d - inset + 0.2, darkOf(b), 0, y + fh + 0.09, 0));
    y += fh + 0.18;
  }
  return y;
}

/**
 * A storefront at a tier (1 Open, 2 Expanded with a second floor, 3 Flagship with three floors, a rooftop
 * billboard and flags). Returns { group, height }.
 */
function storefront(id, tier = 1) {
  const b = BUSINESSES[id];
  const g = new THREE.Group();
  const wall = wallOf(b);
  const h = 3.4;
  g.add(box(BLD.w, h, BLD.d, wall, 0, h / 2, 0));
  g.add(box(BLD.w + 0.2, 0.25, BLD.d + 0.2, darkOf(b), 0, h + 0.12, 0)); // cornice
  // Shop window and door on the street side.
  const glass = glowMat(0xffc47a, 0.05);
  glass.userData.nightGlow = 0.6;
  const win = new THREE.Mesh(new THREE.BoxGeometry(3.0, 1.5, 0.06), glass);
  win.position.set(-0.8, 1.35, BLD.d / 2 + 0.02);
  win.userData.dynamic = true;
  win.userData.glow = true;
  g.add(win);
  g.add(box(3.2, 0.12, 0.14, PALETTE.trim, -0.8, 0.55, BLD.d / 2 + 0.05));
  g.add(box(1.0, 2.0, 0.08, new THREE.Color(b.color).multiplyScalar(0.55).getHex(), 1.6, 1.0, BLD.d / 2 + 0.03));
  g.add(buildLightPool(4.2, 2.6, -0.6, 0.14, BLD.d / 2 + 1.4)); // shop light on the sidewalk at night
  // Striped awning.
  for (let k = 0; k < 9; k++) {
    const stripe = box(BLD.w / 9, 0.06, 1.1, k % 2 ? 0xfbfaf6 : b.color, -BLD.w / 2 + (k + 0.5) * (BLD.w / 9), 2.45, BLD.d / 2 + 0.5);
    stripe.rotation.x = 0.28;
    g.add(stripe);
  }
  // Sign board above the awning.
  g.add(box(3.6, 0.55, 0.1, 0x2a2f3c, 0, 2.95, BLD.d / 2 + 0.06));
  g.add(box(3.3, 0.08, 0.04, b.color, 0, 2.95, BLD.d / 2 + 0.12));
  // Planters by the door.
  for (const x of [-BLD.w / 2 + 0.3, BLD.w / 2 - 0.3]) {
    g.add(box(0.5, 0.4, 0.5, 0xd27f55, x, 0.2, BLD.d / 2 + 0.45));
    g.add(ico(0.32, PALETTE.leaf, x, 0.62, BLD.d / 2 + 0.45));
  }
  let top = h + 0.25;
  if (tier >= 2) top = upperFloors(g, b, top, tier >= 3 ? 2 : 1);
  if (tier >= 3) {
    // Flagship: rooftop billboard in the business color and a pair of flags.
    for (const x of [-1.4, 1.4]) g.add(box(0.12, 1.4, 0.12, 0x34405a, x, top + 0.7, -0.6));
    g.add(box(3.6, 1.1, 0.14, 0xfbfaf6, 0, top + 1.5, -0.6));
    g.add(box(3.3, 0.8, 0.16, b.color, 0, top + 1.5, -0.58));
    for (const x of [-BLD.w / 2 + 0.3, BLD.w / 2 - 0.3]) {
      g.add(cyl(0.03, 0.03, 1.8, PALETTE.metal, 6, x, top + 0.9, BLD.d / 2 - 0.4));
      g.add(box(0.55, 0.35, 0.02, b.color, x + 0.28, top + 1.6, BLD.d / 2 - 0.4));
    }
  }
  const p = prop(b.prop, b.color);
  p.position.set(tier >= 3 ? 1.5 : 0, top, tier >= 3 ? 1.0 : 0);
  if (tier >= 3) p.scale.setScalar(0.7);
  g.add(p);
  return { group: g, height: top + (tier >= 3 ? 2.2 : 1.6) };
}

/** Shared ground floor for landmarks: the storefront's first floor without its roof prop. */
function landmarkBase(id) {
  const { group } = storefront(id, 1);
  group.children.at(-1).removeFromParent(); // drop the small roof prop
  return group;
}

const glass = () => {
  const m = new THREE.MeshStandardMaterial({ color: 0x9fc6e0, roughness: 0.08, metalness: 0.35, emissive: 0xffd9a0, emissiveIntensity: 0.02, flatShading: true });
  m.userData.dayGlow = 0.02;
  m.userData.nightGlow = 0.5;
  return m;
};
function glassBox(w, h, d, x, y, z) {
  const mesh = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), glass());
  mesh.position.set(x, y, z);
  mesh.castShadow = true;
  mesh.userData.dynamic = true;
  mesh.userData.glow = true;
  return mesh;
}

/** Each business's landmark (tier 4). Returns { group, height, clock? }. */
function landmark(id) {
  const b = BUSINESSES[id];
  const g = landmarkBase(id);
  const top = 3.65;
  let height = 12;
  let clock = null;
  if (id === 'qa_lab') {
    g.add(glassBox(4.2, 8.5, 4.2, 0, top + 4.25, -0.4));
    for (let y = top + 1.4; y < top + 8.5; y += 1.4) g.add(box(4.3, 0.08, 4.3, 0xeef2f6, 0, y, -0.4));
    const lens = prop('lens', b.color);
    lens.scale.setScalar(1.8);
    lens.position.set(0, top + 8.5, -0.4);
    g.add(lens);
    height = top + 12;
  } else if (id === 'post_office') {
    upperFloors(g, b, top, 1);
    const tx = 0;
    g.add(box(1.8, 6.5, 1.8, wallOf(b), tx, top + 3.25, -0.9));
    g.add(box(2.0, 0.2, 2.0, darkOf(b), tx, top + 6.5, -0.9));
    const roof = cyl(0, 1.5, 1.6, darkOf(b, 0.55), 4, tx, top + 7.4, -0.9);
    roof.rotation.y = Math.PI / 4;
    g.add(roof);
    // A working clock (local time) on the street face.
    const face = cyl(0.65, 0.65, 0.06, 0xfbfaf6, 20, tx, top + 5.4, 0.03);
    face.rotation.x = Math.PI / 2;
    g.add(face);
    const hands = new THREE.Group();
    hands.position.set(tx, top + 5.4, 0.08);
    hands.userData.dynamic = true;
    const hour = new THREE.Group();
    hour.add(box(0.07, 0.4, 0.02, 0x2a2f3c, 0, 0.18, 0));
    const minute = new THREE.Group();
    minute.add(box(0.05, 0.56, 0.02, 0x2a2f3c, 0, 0.26, 0.01));
    hands.add(hour, minute);
    g.add(hands);
    clock = { hour, minute };
    height = top + 9.6;
  } else if (id === 'shipping') {
    const shed = cyl(2.7, 2.7, BLD.d - 0.4, wallOf(b), 12, 0, top + 0.2, 0);
    shed.rotation.x = Math.PI / 2;
    shed.scale.y = 1;
    shed.scale.z = 0.55;
    g.add(shed);
    const colors = [0xd94f4f, 0x4f86c6, 0xe6c84f, 0x5fbf73];
    [[0, 0], [1, 0], [0, 1], [2, 0]].forEach(([k, lvl], i) => g.add(box(2.4, 1.1, 1.1, colors[i % 4], -1.2 + (k % 2) * 2.5 - 0.2, top + 1.95 + lvl * 1.12, -2.1 + Math.floor(k / 2) * 1.15)));
    for (const x of [-2.4, 2.4]) g.add(box(0.25, 7, 0.25, 0xf2c14e, x, top + 3.5, 1.4));
    g.add(box(5.3, 0.3, 0.4, 0xf2c14e, 0, top + 7, 1.4));
    g.add(box(0.8, 0.5, 0.6, 0x6b7280, 0.6, top + 6.6, 1.4));
    height = top + 8.6;
  } else if (id === 'library') {
    upperFloors(g, b, top, 1, 0.1);
    for (let i = 0; i < 6; i++) g.add(cyl(0.16, 0.18, 2.4, 0xfbfaf6, 10, -2.2 + i * 0.88, top + 1.2, BLD.d / 2 + 0.25));
    // Triangular pediment over the columns.
    const tri = new THREE.Shape([new THREE.Vector2(-2.8, 0), new THREE.Vector2(2.8, 0), new THREE.Vector2(0, 1.0)]);
    const pedGeo = new THREE.ExtrudeGeometry(tri, { depth: 0.9, bevelEnabled: false });
    const ped = new THREE.Mesh(pedGeo, mat(0xf4efe6));
    ped.position.set(0, top + 2.45, BLD.d / 2 - 0.45);
    ped.castShadow = true;
    g.add(ped, box(5.8, 0.12, 0.95, 0xe9e1d0, 0, top + 2.42, BLD.d / 2));
    const dome = new THREE.Mesh(new THREE.SphereGeometry(1.9, 16, 8, 0, Math.PI * 2, 0, Math.PI / 2), new THREE.MeshStandardMaterial({ color: darkOf(b, 0.8), roughness: 0.4, metalness: 0.3, flatShading: true }));
    dome.position.set(0, top + 2.6, -0.6);
    dome.castShadow = true;
    g.add(dome, cyl(0.1, 0.1, 0.9, 0xd9b55a, 6, 0, top + 4.9, -0.6), ico(0.18, 0xd9b55a, 0, top + 5.4, -0.6));
    height = top + 6.6;
  } else if (id === 'studio') {
    g.add(box(BLD.w, 3.2, BLD.d - 0.6, 0xfbfaf6, 0, top + 1.6, -0.3));
    g.add(glassBox(BLD.w - 0.6, 2.6, 0.08, 0, top + 1.6, BLD.d / 2 - 0.55));
    const rainbow = [0xe56b8a, 0xf2a65a, 0xe6c84f, 0x5fbf73, 0x4f86c6, 0x9b7ede];
    rainbow.forEach((c, i) => {
      const cube = box(0.9 - i * 0.08, 0.6, 0.9 - i * 0.08, c, 0, top + 3.6 + i * 0.6, -0.4);
      cube.rotation.y = i * 0.35;
      g.add(cube);
    });
    for (const x of [-2.1, 2.1]) g.add(box(0.5, 2.2, 0.04, b.color, x, top + 1.6, BLD.d / 2 - 0.4));
    height = top + 8.2;
  } else if (id === 'print_shop') {
    const roofY = upperFloors(g, b, top, 2);
    // Marquee band of headlines, lit at night.
    g.add(pane(BLD.w - 0.1, 0.4, 0, top + 0.3, BLD.d / 2 + 0.08, 0xfff1b8));
    const roll = cyl(0.7, 0.7, 3.2, 0xfbfaf6, 14, 0, roofY + 0.75, -0.6);
    roll.rotation.z = Math.PI / 2;
    g.add(roll, box(3.0, 0.05, 1.6, 0xfbfaf6, 0, roofY + 0.06, 0.8), cyl(0.04, 0.04, 2.6, PALETTE.metal, 6, 2.2, roofY + 1.3, -1.8));
    height = roofY + 3;
  } else if (id === 'research_lab') {
    g.add(cyl(2.3, 2.5, 4.2, wallOf(b), 16, 0, top + 2.1, -0.5));
    for (const y of [top + 1.4, top + 2.8]) g.add(cyl(2.36, 2.36, 0.12, darkOf(b), 16, 0, y, -0.5));
    const dome = new THREE.Mesh(new THREE.SphereGeometry(2.3, 16, 8, 0, Math.PI * 2, 0, Math.PI / 2), new THREE.MeshStandardMaterial({ color: 0xdfe5ec, roughness: 0.3, metalness: 0.45, flatShading: true }));
    dome.position.set(0, top + 4.2, -0.5);
    dome.castShadow = true;
    g.add(dome, box(0.6, 2.1, 2.4, 0x34405a, 0, top + 5.2, 0.1));
    const scope = cyl(0.22, 0.32, 2.2, 0xd9dee5, 10, 0, top + 6.6, 0.9);
    scope.rotation.x = 0.7;
    g.add(scope);
    height = top + 8.4;
  } else {
    // Innovation hub: stepped terraces with rooftop gardens and umbrellas.
    let y = top;
    [[BLD.w, 2.4], [BLD.w - 1.2, 2.4], [BLD.w - 2.4, 2.4]].forEach(([w, fh], i) => {
      g.add(box(w, fh, BLD.d - 0.6 - i * 0.8, wallOf(b), 0, y + fh / 2, -0.3 - i * 0.4));
      g.add(glassBox(w - 0.5, 1.2, 0.06, 0, y + 1.2, (BLD.d - 0.6 - i * 0.8) / 2 - 0.3 - i * 0.4 + 0.02));
      y += fh;
      for (const x of [-w / 2 + 0.5, w / 2 - 0.5]) g.add(ico(0.35, PALETTE.leaf, x, y + 0.3, (BLD.d - 0.6 - i * 0.8) / 2 - 0.6 - i * 0.4));
    });
    g.add(cyl(0.03, 0.03, 1.1, PALETTE.metal, 6, 0, y + 0.55, -1.2), cyl(0, 0.75, 0.3, b.color, 8, 0, y + 1.15, -1.2));
    height = y + 2.4;
  }
  return { group: g, height, clock };
}

/** Stakes and string around the footprint, plus a gravel pad. */
function surveyed() {
  const g = new THREE.Group();
  g.add(Object.assign(box(BLD.w + 0.6, 0.04, BLD.d + 0.6, 0xc9bda6, 0, 0.07, 0), { castShadow: false }));
  const hw = BLD.w / 2;
  const hd = BLD.d / 2;
  for (const [x, z] of [[-hw, -hd], [hw, -hd], [-hw, hd], [hw, hd]]) g.add(box(0.08, 0.6, 0.08, PALETTE.woodLight, x, 0.3, z));
  for (const z of [-hd, hd]) g.add(box(BLD.w, 0.02, 0.02, 0xff7a3d, 0, 0.5, z));
  for (const x of [-hw, hw]) g.add(box(0.02, 0.02, BLD.d, 0xff7a3d, x, 0.5, 0));
  g.add(box(0.06, 0.9, 0.06, PALETTE.wood, hw - 0.4, 0.45, hd + 0.5));
  g.add(box(0.9, 0.55, 0.05, 0xfbfaf6, hw - 0.4, 0.95, hd + 0.52));
  return g;
}

/** Slab, half-built walls, scaffolding, cones and a little crane. Returns { group, jib }. */
function construction(id) {
  const b = BUSINESSES[id];
  const g = new THREE.Group();
  g.add(Object.assign(box(BLD.w + 0.6, 0.04, BLD.d + 0.6, 0xc9bda6, 0, 0.07, 0), { castShadow: false }));
  g.add(box(BLD.w, 0.2, BLD.d, 0xb9b4aa, 0, 0.15, 0));
  const wall = new THREE.Color(b.color).lerp(new THREE.Color(0xf4efe6), 0.55).getHex();
  g.add(box(BLD.w, 1.5, 0.2, wall, 0, 1.0, -BLD.d / 2 + 0.1));
  g.add(box(0.2, 1.5, BLD.d, wall, -BLD.w / 2 + 0.1, 1.0, 0));
  g.add(box(0.2, 0.9, BLD.d * 0.6, wall, BLD.w / 2 - 0.1, 0.7, -BLD.d * 0.2));
  // Scaffolding along the street side.
  for (let x = -BLD.w / 2; x <= BLD.w / 2 + 0.01; x += BLD.w / 4) g.add(cyl(0.035, 0.035, 3.0, 0x9aa3b0, 5, x, 1.5, BLD.d / 2 + 0.35));
  for (const y of [1.0, 2.0, 2.9]) {
    g.add(box(BLD.w, 0.05, 0.05, 0x9aa3b0, 0, y, BLD.d / 2 + 0.35));
    g.add(box(BLD.w, 0.06, 0.5, PALETTE.woodLight, 0, y - 0.04, BLD.d / 2 + 0.6));
  }
  for (const [x, z] of [[-1.6, BLD.d / 2 + 1.4], [1.9, BLD.d / 2 + 1.3]]) {
    g.add(cyl(0.02, 0.17, 0.42, 0xff7a3d, 8, x, 0.25, z));
    g.add(cyl(0.11, 0.13, 0.07, 0xfbfaf6, 8, x, 0.3, z));
  }
  g.add(box(0.8, 0.5, 0.6, PALETTE.woodLight, BLD.w / 2 + 0.2, 0.3, BLD.d / 2 + 0.2));
  // Crane: mast plus a jib that slowly turns (animated).
  g.add(box(0.3, 6.2, 0.3, 0xf2c14e, -BLD.w / 2 + 0.4, 3.1, -BLD.d / 2 + 0.4));
  const jib = new THREE.Group();
  jib.position.set(-BLD.w / 2 + 0.4, 6.2, -BLD.d / 2 + 0.4);
  jib.add(box(5.2, 0.22, 0.22, 0xf2c14e, 1.9, 0, 0));
  jib.add(box(1.0, 0.5, 0.5, 0x6b7280, -0.9, 0, 0));
  const cable = box(0.03, 2.4, 0.03, 0x2a2f3c, 3.6, -1.2, 0);
  const load = box(0.5, 0.35, 0.5, wall, 3.6, -2.5, 0);
  jib.add(cable, load);
  jib.userData.dynamic = true;
  jib.userData.load = load;
  g.add(jib);
  return { group: g, jib };
}

export class Downtown {
  /** @param {THREE.Scene} scene */
  constructor(scene, { onVisit } = {}) {
    this.group = new THREE.Group();
    this.group.position.set(DOWNTOWN_X, 0, 0);
    scene.add(this.group);
    this.onVisit = onVisit;
    this.key = '';
    this.items = [];
    this.open = null; // id whose "why" card is expanded
    this.far = undefined;

    const base = new THREE.Group();
    base.add(Object.assign(box(PLOTS * PLOT_W + 1, 0.1, 20, PALETTE.grassLot, 0, 0, 0), { castShadow: false }));
    base.add(Object.assign(box(PLOTS * PLOT_W + 1, 0.06, 3.0, PALETTE.sidewalk, 0, 0.08, BLD.z + BLD.d / 2 + 1.6), { castShadow: false }));
    for (let i = 0; i <= PLOTS; i++) base.add(box(0.06, 0.07, 3.0, PALETTE.curb, plotX(i) - PLOT_W / 2, 0.09, BLD.z + BLD.d / 2 + 1.6));
    // Gateway arch at the west end of main street.
    for (const x of [-PLOTS * PLOT_W / 2 - 0.2, -PLOTS * PLOT_W / 2 + 3.2]) base.add(cyl(0.12, 0.14, 4.2, 0x34405a, 8, x, 2.1, BLD.z + BLD.d / 2 + 1.6));
    base.add(box(3.8, 0.6, 0.18, 0x34405a, -PLOTS * PLOT_W / 2 + 1.5, 4.0, BLD.z + BLD.d / 2 + 1.6));
    mergeStatic(base);
    this.group.add(base);
    this.dynamic = new THREE.Group();
    this.group.add(this.dynamic);

    const title = document.createElement('div');
    title.className = 'commons-title downtown-title';
    title.textContent = 'Downtown';
    this.title = new CSS2DObject(title);
    this.title.position.set(-PLOTS * PLOT_W / 2 + 1.5, 4.8, BLD.z + BLD.d / 2 + 1.6);
    this.group.add(this.title);
    this.labels = [];
  }

  /** Rebuild for the current city ledger (only when stages change). */
  set(city) {
    this.city = city;
    const plan = downtown(city);
    const key = plan.map((b) => `${b.id}:${b.stage}:${b.tier}`).join(',');
    if (key !== this.key) {
      this.key = key;
      for (const child of [...this.dynamic.children]) {
        this.dynamic.remove(child);
        child.traverse((o) => o.isMesh && o.geometry.dispose());
      }
      for (const l of this.labels) l.parent?.remove(l);
      this.labels = [];
      this.items = [];
      this.far = undefined;
      plan.forEach((b, i) => {
        const slot = new THREE.Group();
        slot.position.set(plotX(i), 0, BLD.z);
        let jib = null;
        let clock = null;
        let labelY = 1.9;
        if (b.stage === 1) slot.add(surveyed());
        else if (b.stage === 2) {
          const c = construction(b.id);
          slot.add(c.group);
          jib = c.jib;
          labelY = 4.2;
        } else {
          const built = b.tier >= 4 ? landmark(b.id) : storefront(b.id, b.tier);
          slot.add(built.group);
          clock = built.clock;
          labelY = built.height + 0.6;
        }
        mergeStatic(slot);
        const glows = [];
        slot.traverse((o) => o.userData.glow && glows.push(o));
        this.dynamic.add(slot);
        const el = document.createElement('button');
        el.className = `biz-sign stage-${b.stage}`;
        el.dataset.biz = b.id;
        el.addEventListener('click', () => {
          this.open = this.open === b.id ? null : b.id;
          this.renderLabels();
        });
        const label = new CSS2DObject(el);
        label.position.set(0, labelY, BLD.d / 2);
        slot.add(label);
        this.labels.push(label);
        const x0 = plotX(i) - BLD.w / 2 - (b.stage === 2 ? 0.2 : 0);
        this.items.push({ ...b, slot, jib, clock, glows, el, rect: [x0, BLD.z - BLD.d / 2, x0 + BLD.w + (b.stage === 2 ? 1.2 : 0), BLD.z + BLD.d / 2 + (b.stage === 2 ? 0.9 : 0)] });
      });
    }
    this.renderLabels();
  }

  renderLabels() {
    for (const it of this.items) {
      const b = BUSINESSES[it.id];
      const expanded = this.open === it.id;
      const prog = businessProgress(this.city, it.id);
      const status = it.stage < 3 ? 'Under construction · opens on day 2' : `${TIERS[prog.tier - 1].name}${prog.next ? ` · ${prog.days} of ${prog.next.days} days to ${prog.next.name.toLowerCase()}` : ''}`;
      const html = `<b>${it.stage === 3 ? icon(it.tier >= 4 ? 'landmark' : 'store') : icon('hardHat')} ${esc(businessName(it.id, it.tier))}</b><small>${esc(status)}</small>${expanded ? `<span class="biz-why">${icon('info')} ${esc(whyText(this.city, it.id))}<em>Built from the kinds of work your agents do, never how much.</em></span>` : ''}`;
      if (it.el.innerHTML !== html) it.el.innerHTML = html;
      it.el.classList.toggle('expanded', expanded);
    }
  }

  /** Avatar collision in world coordinates (null when outside downtown). */
  blockedAt(x, z) {
    const lx = x - this.group.position.x;
    const lz = z - this.group.position.z;
    if (Math.abs(lx) > (PLOTS * PLOT_W) / 2 + 0.5 || lz < -10 || lz > 10) return null;
    return this.items.some((it) => it.stage >= 2 && lx > it.rect[0] && lx < it.rect[2] && lz > it.rect[1] && lz < it.rect[3]);
  }

  /** World position of a business on main street (for celebrations), or null. */
  positionOf(id) {
    const it = this.items.find((x) => x.id === id);
    return it ? it.slot.getWorldPosition(new THREE.Vector3()) : null;
  }

  update(dt, t, night, focus) {
    for (const it of this.items) {
      if (it.clock) {
        // The clock tower keeps the viewer's local time.
        const now = new Date();
        it.clock.minute.rotation.z = -(now.getMinutes() / 60) * Math.PI * 2;
        it.clock.hour.rotation.z = -(((now.getHours() % 12) + now.getMinutes() / 60) / 12) * Math.PI * 2;
      }
      if (it.jib) {
        it.jib.rotation.y = Math.sin(t * 0.12 + it.slot.position.x) * 1.2;
        it.jib.userData.load.position.y = -2.5 + Math.sin(t * 0.5 + it.slot.position.x) * 0.8;
      }
      for (const g of it.glows) g.material.emissiveIntensity = g.material.userData.dayGlow + night * (g.material.userData.nightGlow || 1);
    }
    if (focus) {
      const far = Math.hypot(focus.x - this.group.position.x, focus.z - this.group.position.z) > 40;
      if (far !== this.far) {
        this.far = far;
        for (const it of this.items) it.el.classList.toggle('far', far);
      }
    }
  }
}
