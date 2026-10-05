// Furniture builders. Each returns a group (lot-local, origin on the floor) plus any live parts.
// Live parts are flagged `userData.dynamic` so static merging leaves them alone.

import * as THREE from 'three';
import { PALETTE, box, cyl, ico, mat, rng, softBox } from './models.js';

// ---- Desk ----------------------------------------------------------------------------------

let spill = null;
function spillTexture() {
  if (spill) return spill;
  const c = document.createElement('canvas');
  c.width = 128;
  c.height = 64;
  const g = c.getContext('2d');
  const grad = g.createRadialGradient(64, 0, 4, 64, 0, 70);
  grad.addColorStop(0, 'rgba(255,255,255,1)');
  grad.addColorStop(1, 'rgba(255,255,255,0)');
  g.fillStyle = grad;
  g.fillRect(0, 0, 128, 64);
  spill = new THREE.CanvasTexture(c);
  return spill;
}

/**
 * A desk whose user sits on the +z side facing −z (back to the camera, Sims over-the-shoulder view).
 * The monitor faces the user, and therefore the camera. Keyboard and mouse positions are matched
 * by the Sim's arm IK (see sim.js DESK_*).
 */
export function buildDesk(i, screen) {
  const g = new THREE.Group();
  g.add(softBox(1.7, 0.07, 0.85, PALETTE.woodLight, 0, 0.76, 0, 0.05));
  for (const [dx, dz] of [[-0.78, -0.36], [-0.78, 0.36]]) g.add(box(0.06, 0.73, 0.06, PALETTE.dark, dx, 0.37, dz));
  g.add(box(0.5, 0.7, 0.78, PALETTE.woodMid, 0.55, 0.37, 0));
  for (const y of [0.2, 0.42, 0.62]) {
    g.add(box(0.46, 0.17, 0.02, PALETTE.woodLight, 0.55, y, 0.4));
    g.add(box(0.12, 0.025, 0.03, PALETTE.metal, 0.55, y, 0.42));
  }
  // Monitor on a stand, screen toward the user.
  g.add(softBox(0.3, 0.03, 0.2, PALETTE.dark, 0, 0.81, -0.22, 0.05));
  g.add(box(0.06, 0.32, 0.05, PALETTE.dark, 0, 0.97, -0.27));
  g.add(softBox(1.04, 0.64, 0.05, 0x22262f, 0, 1.25, -0.25, 0.03));
  const screenMesh = new THREE.Mesh(new THREE.PlaneGeometry(0.96, 0.6), screen.material);
  screenMesh.position.set(0, 1.25, -0.222);
  screenMesh.userData.dynamic = true;
  g.add(screenMesh);
  // Soft light spill from the screen onto the desk and keyboard.
  const glow = new THREE.Mesh(new THREE.PlaneGeometry(1.4, 0.9), new THREE.MeshBasicMaterial({ map: spillTexture(), transparent: true, opacity: 0.32, blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false }));
  glow.rotation.x = -Math.PI / 2;
  glow.position.set(0, 0.802, 0.1);
  glow.userData.dynamic = true;
  glow.visible = false;
  g.add(glow);
  screen.glow = glow;
  // Keyboard, mouse + pad, mug, notebook.
  g.add(softBox(0.52, 0.025, 0.17, 0xe7e9ee, 0, 0.805, 0.24, 0.02));
  for (let r = 0; r < 3; r++) g.add(box(0.46, 0.008, 0.035, 0xc9ccd6, 0, 0.82, 0.19 + r * 0.045));
  g.add(softBox(0.26, 0.006, 0.22, 0x3b4256, 0.42, 0.797, 0.24, 0.04));
  g.add(softBox(0.065, 0.03, 0.1, 0xf4f4f6, 0.42, 0.815, 0.24, 0.025));
  g.add(cyl(0.05, 0.045, 0.11, PALETTE.books[i % PALETTE.books.length], 10, -0.62, 0.85, 0.12));
  g.add(box(0.24, 0.02, 0.3, PALETTE.books[(i + 3) % PALETTE.books.length], -0.56, 0.8, -0.18));
  // Little desk lamp
  g.add(cyl(0.08, 0.09, 0.03, PALETTE.dark, 8, 0.7, 0.81, -0.26));
  const arm = box(0.03, 0.36, 0.03, PALETTE.dark, 0.7, 0.98, -0.22);
  arm.rotation.x = -0.25;
  g.add(arm);
  const bulb = new THREE.Mesh(new THREE.ConeGeometry(0.09, 0.12, 8, 1, true), new THREE.MeshStandardMaterial({ color: 0xf2f2f2, emissive: 0xffd9a0, emissiveIntensity: 0, side: THREE.DoubleSide }));
  bulb.position.set(0.7, 1.15, -0.15);
  bulb.rotation.x = -0.6;
  bulb.userData.dynamic = true;
  bulb.userData.nightGlow = 1.6;
  g.add(bulb);
  return { group: g, lamp: bulb };
}

/** A laptop for visiting sub-agents, opened toward its holder (local −z is the user side). */
export function buildLaptop(screen) {
  const g = new THREE.Group();
  g.add(softBox(0.42, 0.025, 0.3, 0xc3c8d2, 0, 0, 0, 0.03, { roughness: 0.35, metalness: 0.4 }));
  g.add(box(0.36, 0.004, 0.14, 0x2a2f3c, 0, 0.014, -0.04));
  const lid = new THREE.Group();
  lid.position.set(0, 0.012, 0.15);
  lid.rotation.x = 0.32; // leaning back, away from the user
  lid.add(softBox(0.42, 0.28, 0.018, 0xc3c8d2, 0, 0.14, 0, 0.03, { roughness: 0.35, metalness: 0.4 }));
  const scr = new THREE.Mesh(new THREE.PlaneGeometry(0.38, 0.24), screen.material);
  scr.position.set(0, 0.14, -0.011);
  scr.rotation.y = Math.PI;
  lid.add(scr);
  g.add(lid);
  g.traverse((o) => {
    if (o.isMesh) o.castShadow = true;
  });
  return g;
}

export function buildChair() {
  const g = new THREE.Group();
  g.add(softBox(0.52, 0.09, 0.5, PALETTE.chairSeat, 0, 0.47, 0, 0.08));
  g.add(softBox(0.5, 0.58, 0.08, PALETTE.chairSeat, 0, 0.82, -0.25, 0.06));
  g.add(cyl(0.035, 0.035, 0.36, PALETTE.metal, 6, 0, 0.26, 0));
  for (let k = 0; k < 5; k++) {
    const a = (k / 5) * Math.PI * 2;
    const leg = box(0.04, 0.03, 0.3, PALETTE.dark, Math.sin(a) * 0.14, 0.07, Math.cos(a) * 0.14);
    leg.rotation.y = a;
    g.add(leg);
    g.add(ico(0.035, PALETTE.dark, Math.sin(a) * 0.28, 0.04, Math.cos(a) * 0.28));
  }
  for (const s of [1, -1]) g.add(box(0.05, 0.04, 0.32, PALETTE.dark, s * 0.28, 0.66, -0.02));
  return g;
}

export function buildBookshelf(seed) {
  const r = rng(seed);
  const g = new THREE.Group();
  const d = 0.42;
  const w = 2.0;
  const H = 2.15;
  g.add(box(d, 0.06, w, PALETTE.shelf, 0, H, 0));
  g.add(box(d, H, 0.06, PALETTE.shelf, 0, H / 2, -w / 2));
  g.add(box(d, H, 0.06, PALETTE.shelf, 0, H / 2, w / 2));
  g.add(box(0.04, H, w, PALETTE.wood, -d / 2 + 0.02, H / 2, 0));
  for (let i = 0; i < 5; i++) {
    const y = 0.06 + i * 0.5;
    g.add(box(d, 0.05, w, PALETTE.shelf, 0, y, 0));
    if (i === 4) break;
    let z = -w / 2 + 0.08;
    while (z < w / 2 - 0.12) {
      if (r() < 0.12) {
        z += 0.18;
        continue;
      }
      const bw = 0.06 + r() * 0.06;
      const bh = 0.28 + r() * 0.13;
      const book = box(0.3, bh, bw, PALETTE.books[Math.floor(r() * PALETTE.books.length)], 0.02, y + 0.03 + bh / 2, z + bw / 2);
      if (r() < 0.1) book.rotation.x = 0.18;
      g.add(book);
      z += bw + 0.01;
    }
  }
  g.add(ico(0.16, PALETTE.leaf, 0.02, 2.3, 0.6));
  g.add(cyl(0.1, 0.08, 0.14, PALETTE.potAlt, 8, 0.02, 2.24, 0.6));
  return g;
}

export function buildWhiteboard() {
  const g = new THREE.Group();
  g.add(box(0.05, 1.15, 1.9, PALETTE.white, 0, 1.6, 0, { roughness: 0.25 }));
  g.add(box(0.07, 1.25, 2.0, PALETTE.metal, -0.01, 1.6, 0));
  g.add(box(0.12, 0.04, 1.6, PALETTE.metal, 0.06, 1.0, 0));
  const strokes = [[0xe76f51, 1.92, -0.4, 0.7], [0x4d7cc4, 1.75, 0.1, 1.0], [0x3fa34d, 1.55, -0.2, 0.55], [0x4d7cc4, 1.38, 0.3, 0.8]];
  for (const [color, y, z, len] of strokes) g.add(box(0.02, 0.05, len, color, 0.035, y, z));
  g.add(box(0.03, 0.22, 0.22, 0xffd166, 0.035, 1.85, 0.75));
  g.add(box(0.03, 0.22, 0.22, 0xff8fab, 0.035, 1.5, 0.78));
  return g;
}

export function buildGlobe() {
  const g = new THREE.Group();
  g.add(cyl(0.3, 0.36, 0.06, PALETTE.wood, 10, 0, 0.03, 0));
  g.add(cyl(0.05, 0.07, 0.85, PALETTE.wood, 8, 0, 0.47, 0));
  const ring = new THREE.Mesh(new THREE.TorusGeometry(0.5, 0.025, 6, 24), mat(0xc9a24c, { metalness: 0.6, roughness: 0.35 }));
  ring.position.y = 1.32;
  ring.rotation.set(0, Math.PI / 2, 0.35);
  ring.castShadow = true;
  g.add(ring);
  const spinner = new THREE.Group();
  spinner.userData.dynamic = true;
  spinner.add(ico(0.44, PALETTE.globeSea, 0, 0, 0, 1, { roughness: 0.4 }));
  const r = rng(3);
  for (let i = 0; i < 7; i++) {
    const a = r() * Math.PI * 2;
    const b = (r() - 0.5) * 1.6;
    spinner.add(ico(0.15 + r() * 0.08, PALETTE.globeLand, Math.cos(a) * Math.cos(b) * 0.36, Math.sin(b) * 0.36, Math.sin(a) * Math.cos(b) * 0.36));
  }
  spinner.position.y = 1.32;
  spinner.rotation.z = 0.35;
  g.add(spinner);
  return { group: g, spinner };
}

export function buildRack() {
  const g = new THREE.Group();
  g.add(softBox(0.95, 2.15, 0.78, 0x262b36, 0, 1.075, 0, 0.04));
  g.add(box(0.85, 1.95, 0.02, 0x161a22, 0, 1.08, 0.4));
  const lights = [];
  for (let i = 0; i < 7; i++) {
    const y = 0.3 + i * 0.27;
    g.add(box(0.8, 0.2, 0.03, 0x3a4150, 0, y, 0.41));
    for (let k = 0; k < 3; k++) {
      const color = k === 2 ? 0x7fd3ff : 0x3ee07a;
      const led = new THREE.Mesh(new THREE.BoxGeometry(0.035, 0.035, 0.02), new THREE.MeshStandardMaterial({ color, emissive: color, emissiveIntensity: 2.5 }));
      led.position.set(-0.3 + k * 0.07, y, 0.43);
      led.userData.dynamic = true;
      g.add(led);
      lights.push(led);
    }
    for (let k = 0; k < 6; k++) g.add(box(0.035, 0.12, 0.02, 0x1d2129, 0.05 + k * 0.05, y, 0.43));
  }
  return { group: g, lights };
}

export function buildCoffeeBar() {
  const g = new THREE.Group();
  g.add(softBox(0.85, 0.95, 1.8, PALETTE.woodMid, 0, 0.475, 0, 0.04));
  g.add(box(0.95, 0.06, 1.9, 0xeae6df, 0, 0.98, 0, { roughness: 0.3 }));
  for (const z of [-0.45, 0.45]) g.add(box(0.02, 0.8, 0.8, PALETTE.woodLight, -0.43, 0.48, z));
  // Espresso machine
  g.add(softBox(0.5, 0.55, 0.42, 0xc23b3b, 0.05, 1.29, -0.45, 0.06, { roughness: 0.35 }));
  g.add(box(0.36, 0.06, 0.3, PALETTE.metal, -0.05, 1.03, -0.45, { metalness: 0.6, roughness: 0.3 }));
  g.add(cyl(0.035, 0.035, 0.12, PALETTE.metal, 6, -0.18, 1.18, -0.45));
  // Cups
  for (let k = 0; k < 3; k++) g.add(cyl(0.05, 0.045, 0.1, [PALETTE.white, 0xf2c14e, 0x4f86c6][k], 10, -0.1, 1.06, 0.15 + k * 0.17));
  g.add(cyl(0.12, 0.1, 0.14, 0x9c6b42, 10, 0.15, 1.08, 0.55)); // cookie jar
  // Steam puffs (shown when someone is having coffee)
  const steam = new THREE.Group();
  steam.userData.dynamic = true;
  const steamMat = new THREE.MeshStandardMaterial({ color: 0xffffff, transparent: true, opacity: 0.5, roughness: 1, depthWrite: false });
  for (let k = 0; k < 4; k++) {
    const puff = new THREE.Mesh(new THREE.IcosahedronGeometry(0.05, 0), steamMat.clone());
    puff.userData.phase = k / 4;
    steam.add(puff);
  }
  steam.position.set(-0.18, 1.05, -0.45);
  g.add(steam);
  return { group: g, steam };
}

export function buildCouch(seed) {
  const r = rng(seed);
  const g = new THREE.Group();
  g.add(softBox(2.7, 0.32, 0.95, PALETTE.couchDark, 0, 0.26, 0, 0.1));
  for (let k = 0; k < 3; k++) g.add(softBox(0.84, 0.16, 0.8, PALETTE.couch, -0.86 + k * 0.86, 0.5, 0.06, 0.1));
  g.add(softBox(2.7, 0.62, 0.26, PALETTE.couchDark, 0, 0.62, -0.38, 0.1));
  for (const s of [1, -1]) g.add(softBox(0.24, 0.52, 0.95, PALETTE.couchDark, s * 1.36, 0.46, 0, 0.08));
  for (const s of [1, -1]) g.add(cyl(0.04, 0.03, 0.12, PALETTE.wood, 6, s * 1.25, 0.06, 0.35));
  for (const s of [1, -1]) {
    const p = softBox(0.42, 0.38, 0.14, PALETTE.pillow[Math.floor(r() * 3)], s * 0.95, 0.75, -0.18, 0.06);
    p.rotation.set(-0.25, 0, s * 0.12);
    g.add(p);
  }
  return g;
}

export function buildSideTable() {
  const g = new THREE.Group();
  g.add(cyl(0.3, 0.3, 0.05, PALETTE.woodLight, 12, 0, 0.55, 0));
  g.add(cyl(0.04, 0.05, 0.53, PALETTE.dark, 6, 0, 0.27, 0));
  g.add(cyl(0.18, 0.2, 0.03, PALETTE.dark, 10, 0, 0.015, 0));
  g.add(box(0.2, 0.05, 0.26, PALETTE.books[2], 0.05, 0.6, 0));
  g.add(cyl(0.05, 0.045, 0.1, PALETTE.white, 10, -0.12, 0.63, 0.1));
  return g;
}

export function buildFloorLamp() {
  const g = new THREE.Group();
  g.add(cyl(0.2, 0.22, 0.04, PALETTE.dark, 10, 0, 0.02, 0));
  g.add(cyl(0.025, 0.025, 1.6, PALETTE.dark, 6, 0, 0.82, 0));
  const shade = new THREE.Mesh(new THREE.CylinderGeometry(0.2, 0.3, 0.34, 10, 1, true), new THREE.MeshStandardMaterial({ color: 0xfff1d6, emissive: 0xffc982, emissiveIntensity: 0, side: THREE.DoubleSide }));
  shade.position.y = 1.72;
  shade.userData.dynamic = true;
  shade.userData.nightGlow = 1.4;
  shade.castShadow = true;
  g.add(shade);
  return { group: g, shade };
}

export function buildWallArt(seed, w = 0.9, h = 0.7) {
  const r = rng(seed);
  const g = new THREE.Group();
  g.add(box(0.04, h, w, 0x2a2f3c, 0, 0, 0));
  g.add(box(0.045, h - 0.1, w - 0.1, 0xf4efe6, 0.005, 0, 0));
  // An abstract little composition
  const colors = [0xe76f51, 0x2a9d8f, 0xe9c46a, 0x5a7d9a, 0xf4a261];
  for (let k = 0; k < 3; k++) {
    const s = 0.12 + r() * 0.18;
    g.add(box(0.05, s, s * (1 + r()), colors[Math.floor(r() * colors.length)], 0.01, (r() - 0.5) * (h - 0.35), (r() - 0.5) * (w - 0.4)));
  }
  return g;
}

export function buildRug(w, d, color, x, z) {
  const g = new THREE.Group();
  const outer = box(w, 0.02, d, color, x, 0.135, z);
  outer.castShadow = false;
  const inner = box(w - 0.3, 0.022, d - 0.3, 0xf6efe4, x, 0.137, z);
  inner.castShadow = false;
  const core = box(w - 0.5, 0.024, d - 0.5, color, x, 0.139, z);
  core.castShadow = false;
  g.add(outer, inner, core);
  return g;
}
