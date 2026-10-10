// Live 3D portraits: the same low-poly characters as the world, rendered head-and-shoulders (or waist up)
// into small canvases with an idle loop — breathing, blinking, a little head sway — and an optional
// "thinking" pose. One shared offscreen WebGL renderer draws every visible portrait in turn, so the page
// never needs more than one extra GL context. Purely cosmetic: says nothing about what an agent is doing.

import * as THREE from 'three';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { buildPerson } from './models.js';
import { armIK } from './sim.js';

const RENDER_W = 600;
const RENDER_H = 800;
const FPS = 30;

/** Framing per mode: where the camera looks (character-local y) and how much it sees. */
const FRAMES = {
  // Hair and hats reach ~2.45 m; the bust shows chest to crown, the waist view hips to crown.
  bust: { target: 2.04, height: 1.22, fov: 24, yaw: 0.42, lift: 0.12 },
  waist: { target: 1.74, height: 2.0, fov: 24, yaw: 0.36, lift: 0.18 },
};

let renderer = null;
let scene = null;
const portraits = new Set();
let last = 0;

function setup() {
  renderer = new THREE.WebGLRenderer({ alpha: true, antialias: true, powerPreference: 'low-power' });
  renderer.setPixelRatio(1);
  renderer.setSize(RENDER_W, RENDER_H, false);
  renderer.setClearColor(0x000000, 0);
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 0.9;
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  scene = new THREE.Scene();
  // Studio lighting: soft image-based fill for rounded shading, a warm key from the upper right,
  // a cool rim from behind that separates hair and shoulders from the background, and a low bounce.
  const pmrem = new THREE.PMREMGenerator(renderer);
  scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
  scene.environmentIntensity = 0.22;
  scene.add(new THREE.HemisphereLight(0xe8f0ff, 0x6b5a4a, 0.5));
  const key = new THREE.DirectionalLight(0xfff0dc, 2.5);
  key.position.set(2.2, 3.0, 3.2);
  scene.add(key);
  const rim = new THREE.DirectionalLight(0xc4d4ff, 2.6);
  rim.position.set(-2.6, 2.4, -2.8);
  scene.add(rim);
  const rim2 = new THREE.DirectionalLight(0xffe2c8, 1.2);
  rim2.position.set(2.8, 1.6, -2.4);
  scene.add(rim2);
  const bounce = new THREE.DirectionalLight(0xffe6d0, 0.5);
  bounce.position.set(0, -1.5, 2.5);
  scene.add(bounce);
  requestAnimationFrame(loop);
}

function loop(now) {
  requestAnimationFrame(loop);
  if (now - last < 1000 / FPS || document.hidden) return;
  const dt = Math.min(0.1, (now - last) / 1000);
  last = now;
  for (const p of portraits) {
    if (!p.canvas.isConnected) {
      if (!p.persistent) p.dispose(); // one-off portraits (agent panel) go away with their panel
      continue;
    }
    if (!p.canvas.offsetParent && getComputedStyle(p.canvas).position !== 'fixed') continue; // hidden
    p.draw(dt, now / 1000);
  }
}

export class AvatarPortrait {
  /**
   * @param {object} o
   * @param {() => object} o.look current look (re-read every frame; the model rebuilds when it changes)
   * @param {() => object|null} [o.role] role info (rebuilds the model when it changes) or null
   * @param {'bust'|'waist'} [o.mode]
   * @param {() => boolean} [o.thinking] whether to play the thinking pose
   * @param {string} [o.className]
   * @param {boolean} [o.persistent] keep it registered while detached (reused canvases)
   */
  constructor({ look, role = () => null, mode = 'bust', thinking = () => false, className = '', persistent = false }) {
    if (!renderer) setup();
    Object.assign(this, { look, role, mode, thinking, persistent });
    this.canvas = document.createElement('canvas');
    this.canvas.className = `avatar-3d ${mode} ${className}`.trim();
    this.canvas.setAttribute('aria-hidden', 'true');
    this.ctx = this.canvas.getContext('2d');
    this.camera = new THREE.PerspectiveCamera(FRAMES[mode].fov, 1, 0.1, 20);
    this.key = '';
    this.parts = null;
    this.J = { bodyY: 0, headX: 0, headY: 0, headZ: 0, armLx: -0.07, armLz: 0.17, armRx: -0.07, armRz: -0.17, elbowL: -0.24, elbowR: -0.24, lean: 0, twist: 0 };
    this.nextBlink = 1 + Math.random() * 2;
    this.phase = Math.random() * 10;
    portraits.add(this);
  }

  rebuild(look, role) {
    if (this.parts) this.parts.root.traverse((o) => o.isMesh && o.geometry.dispose());
    const parts = buildPerson(look, {});
    parts.root.traverse((o) => { if (o.isMesh) { o.castShadow = false; o.frustumCulled = false; } });
    this.parts = parts;
  }

  /** Size the 2D canvas to its CSS box at device resolution. */
  fit() {
    const r = this.canvas.getBoundingClientRect();
    const dpr = Math.min(2, devicePixelRatio || 1);
    const w = Math.max(1, Math.min(RENDER_W, Math.round(r.width * dpr)));
    const h = Math.max(1, Math.min(RENDER_H, Math.round(r.height * dpr)));
    if (this.canvas.width !== w || this.canvas.height !== h) {
      this.canvas.width = w;
      this.canvas.height = h;
    }
    return [w, h];
  }

  animate(dt, t) {
    const think = !!this.thinking();
    const T = { bodyY: 0, headX: 0, headY: 0, headZ: 0, armLx: -0.07, armLz: 0.17, armRx: -0.07, armRz: -0.17, elbowL: -0.24, elbowR: -0.24, lean: 0, twist: 0 };
    const ph = t + this.phase;
    // Idle: a slow glance around and a soft weight shift.
    T.headY = Math.sin(ph * 0.45) * 0.18 + Math.sin(ph * 1.3) * 0.03;
    T.headZ = Math.sin(ph * 0.6) * 0.04;
    T.headX = Math.sin(ph * 0.7) * 0.03;
    T.twist = Math.sin(ph * 0.35) * 0.05;
    T.armLz = 0.17 + Math.sin(ph * 2) * 0.015;
    T.armRz = -0.17 - Math.sin(ph * 2) * 0.015;
    if (think) {
      // Hand to chin, head tilted, eyes up and to the side, tapping slowly.
      armIK(T, -1, [-0.07, 1.69 + Math.sin(ph * 1.6) * 0.012, 0.31]);
      armIK(T, 1, [-0.12, 1.3, 0.26]); // other arm folded across the waist, propping the elbow
      T.headX = -0.16;
      T.headY = 0.22 + Math.sin(ph * 0.5) * 0.05;
      T.headZ = 0.12 + Math.sin(ph * 0.8) * 0.04;
    }
    const k = 1 - Math.exp(-dt * 6);
    for (const key of Object.keys(T)) this.J[key] += (T[key] - this.J[key]) * k;
    const J = this.J;
    const p = this.parts;
    p.spine.rotation.set(J.lean, J.twist, 0);
    p.armL.rotation.set(J.armLx, 0, J.armLz);
    p.armR.rotation.set(J.armRx, 0, J.armRz);
    p.elbowL.rotation.x = J.elbowL;
    p.elbowR.rotation.x = J.elbowR;
    p.head.rotation.set(J.headX, J.headY, J.headZ);
    // Breathing: the chest rises and the shoulders lift a touch.
    const breath = Math.sin(ph * 1.9);
    p.torso.scale.set(1 + breath * 0.006, 1 + breath * 0.02, 1 + breath * 0.012);
    p.body.position.y = breath * 0.004;
    // Blinking every few seconds (sometimes a double blink).
    let eyeY = 1;
    if (t > this.nextBlink) {
      eyeY = 0.1;
      if (t > this.nextBlink + 0.11) this.nextBlink = t + (Math.random() < 0.2 ? 0.25 : 2.4 + Math.random() * 3);
    }
    p.eyes.scale.y += (eyeY - p.eyes.scale.y) * (eyeY < 1 ? 1 : 0.5);
    p.mouthOpen.visible = false;
    p.mouth.visible = true;
  }

  draw(dt, t) {
    const look = this.look();
    if (!look) return;
    const role = this.role?.() || null;
    const key = JSON.stringify([look, role?.kind, role?.color]);
    if (key !== this.key) {
      this.key = key;
      this.rebuild(look, role);
    }
    const [w, h] = this.fit();
    this.animate(dt, t);
    const f = FRAMES[this.mode];
    const cam = this.camera;
    cam.aspect = w / h;
    cam.fov = f.fov;
    cam.updateProjectionMatrix();
    const dist = f.height / 2 / Math.tan(THREE.MathUtils.degToRad(f.fov / 2));
    cam.position.set(Math.sin(f.yaw) * dist, f.target + f.lift, Math.cos(f.yaw) * dist);
    cam.lookAt(0, f.target, 0);
    scene.add(this.parts.root);
    renderer.setViewport(0, 0, w, h);
    renderer.setScissor(0, 0, w, h);
    renderer.setScissorTest(true);
    renderer.clear();
    renderer.render(scene, cam);
    scene.remove(this.parts.root);
    this.ctx.clearRect(0, 0, w, h);
    this.ctx.drawImage(renderer.domElement, 0, RENDER_H - h, w, h, 0, 0, w, h);
  }

  dispose() {
    portraits.delete(this);
    if (this.parts) this.parts.root.traverse((o) => o.isMesh && o.geometry.dispose());
    this.parts = null;
  }
}
