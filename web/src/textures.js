// Generated surface textures (no image assets): wood planks, tiles and carpet for room floors, with soft
// baked shading where the floor meets the walls. Cached per floor style.

import * as THREE from 'three';
import { FLOORS } from '../../shared/style.mjs';
import { rng } from './models.js';

const cache = new Map();
const W = 1024;
const H = Math.round((W * 10) / 14); // the room floor is 14 × 10 m
const PX = W / 14; // pixels per meter

// Keep the catalog's sRGB values as-is (no linear conversion): the canvas is sRGB.
const hex = (s) => new THREE.Color().setStyle(s, THREE.LinearSRGBColorSpace);
const css = (c, k = 1) => `rgb(${Math.round(Math.min(1, c.r * k) * 255)},${Math.round(Math.min(1, c.g * k) * 255)},${Math.round(Math.min(1, c.b * k) * 255)})`;

function planks(g, a, b, r) {
  const pw = 0.5 * PX; // planks run front to back, 0.5 m wide
  for (let i = 0; i * pw < W; i++) {
    const x = i * pw;
    // Staggered plank ends along each row.
    let y = -r() * 2.4 * PX;
    while (y < H) {
      const len = (1.6 + r() * 1.6) * PX;
      const base = (i + Math.floor(y / 50)) % 2 ? a : b;
      g.fillStyle = css(base, 0.94 + r() * 0.12);
      g.fillRect(x, y, pw, len);
      // Grain: thin wavy streaks.
      g.strokeStyle = css(base, 0.84);
      g.globalAlpha = 0.35;
      g.lineWidth = 1;
      for (let s = 0; s < 6; s++) {
        const gx = x + 4 + r() * (pw - 8);
        g.beginPath();
        g.moveTo(gx, y);
        for (let t = 0; t <= len; t += 12) g.lineTo(gx + Math.sin((t + s * 40) * 0.03) * 2.2, y + t);
        g.stroke();
      }
      g.globalAlpha = 1;
      g.fillStyle = 'rgba(40,24,12,0.45)';
      g.fillRect(x, y + len - 1.5, pw, 1.5); // end joint
      y += len;
    }
    g.fillStyle = 'rgba(40,24,12,0.5)';
    g.fillRect(x, 0, 1.5, H); // long seam
  }
}

function tiles(g, a, b, r) {
  const t = 0.7 * PX;
  g.fillStyle = css(a, 0.7);
  g.fillRect(0, 0, W, H); // grout
  for (let i = 0; i * t < W; i++) {
    for (let j = 0; j * t < H; j++) {
      const base = (i + j) % 2 ? a : b;
      g.fillStyle = css(base, 0.95 + r() * 0.1);
      g.fillRect(i * t + 2, j * t + 2, t - 4, t - 4);
      // A soft highlight in one corner reads as glaze.
      const hl = g.createLinearGradient(i * t, j * t, i * t + t, j * t + t);
      hl.addColorStop(0, 'rgba(255,255,255,0.12)');
      hl.addColorStop(0.5, 'rgba(255,255,255,0)');
      g.fillStyle = hl;
      g.fillRect(i * t + 2, j * t + 2, t - 4, t - 4);
    }
  }
}

function carpet(g, a, b, r) {
  g.fillStyle = css(a);
  g.fillRect(0, 0, W, H);
  // Woven speckle.
  for (let k = 0; k < 26000; k++) {
    g.fillStyle = css(r() < 0.5 ? a : b, 0.86 + r() * 0.28);
    g.fillRect(r() * W, r() * H, 2, 2);
  }
  g.strokeStyle = css(b, 1.12);
  g.lineWidth = 6;
  g.strokeRect(0.35 * PX, 0.35 * PX, W - 0.7 * PX, H - 0.7 * PX); // border band
}

/** Darken the floor near walls: cheap baked ambient occlusion. */
function edgeShade(g) {
  const d = 0.55 * PX;
  const edge = (x0, y0, x1, y1) => {
    const gr = g.createLinearGradient(x0, y0, x1, y1);
    gr.addColorStop(0, 'rgba(20,14,10,0.42)');
    gr.addColorStop(1, 'rgba(20,14,10,0)');
    return gr;
  };
  g.fillStyle = edge(0, 0, 0, d);
  g.fillRect(0, 0, W, d);
  g.fillStyle = edge(0, H, 0, H - d);
  g.fillRect(0, H - d, W, d);
  g.fillStyle = edge(0, 0, d, 0);
  g.fillRect(0, 0, d, H);
  g.fillStyle = edge(W, 0, W - d, 0);
  g.fillRect(W - d, 0, d, H);
}

export function floorTexture(key) {
  if (cache.has(key)) return cache.get(key);
  const style = FLOORS[key] || FLOORS.oak;
  const c = document.createElement('canvas');
  c.width = W;
  c.height = H;
  const g = c.getContext('2d');
  const r = rng(key.length * 97 + 13);
  const [a, b] = style.colors.map(hex);
  if (style.kind === 'plank') planks(g, a, b, r);
  else if (style.kind === 'tile') tiles(g, a, b, r);
  else carpet(g, a, b, r);
  edgeShade(g);
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 4;
  cache.set(key, tex);
  return tex;
}

const floorMats = new Map();
/** A shared floor material per style. */
export function floorMaterial(key) {
  if (!floorMats.has(key)) {
    const kind = (FLOORS[key] || FLOORS.oak).kind;
    floorMats.set(key, new THREE.MeshStandardMaterial({ map: floorTexture(key), roughness: kind === 'tile' ? 0.42 : kind === 'plank' ? 0.68 : 0.95, flatShading: true }));
  }
  return floorMats.get(key);
}
