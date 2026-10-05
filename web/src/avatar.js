// The player's avatar and the follow camera. The avatar only observes; it can't affect agents.

import * as THREE from 'three';
import { buildContactShadow, buildPerson } from './models.js';

const WALK = 5.2;
const RUN = 9;

/** A soft glowing disc + chevron under the player, drawn once to a canvas. */
function markerTexture() {
  const c = document.createElement('canvas');
  c.width = c.height = 256;
  const g = c.getContext('2d');
  const grad = g.createRadialGradient(128, 128, 30, 128, 128, 128);
  grad.addColorStop(0, 'rgba(120,135,255,0.0)');
  grad.addColorStop(0.62, 'rgba(120,135,255,0.18)');
  grad.addColorStop(0.8, 'rgba(140,155,255,0.85)');
  grad.addColorStop(0.86, 'rgba(255,255,255,0.95)');
  grad.addColorStop(0.92, 'rgba(120,135,255,0.5)');
  grad.addColorStop(1, 'rgba(120,135,255,0)');
  g.fillStyle = grad;
  g.fillRect(0, 0, 256, 256);
  // Facing chevron at the front edge (+y in texture space = forward after rotation).
  g.fillStyle = 'rgba(255,255,255,0.95)';
  g.beginPath();
  g.moveTo(128, 8);
  g.lineTo(150, 34);
  g.lineTo(128, 26);
  g.lineTo(106, 34);
  g.closePath();
  g.fill();
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

const JOINTS = ['bodyY', 'lean', 'legL', 'legR', 'kneeL', 'kneeR', 'armLx', 'armLz', 'armRx', 'armRz', 'elbowL', 'elbowR', 'headX', 'headY'];

export class Avatar {
  constructor(scene) {
    this.parts = buildPerson(
      { skin: 0xeebd98, hair: 0x4a2f1d, shirt: 0x5b6cf9, pants: 0x2f3747, shoes: 0xf4f1ea, hairStyle: 0, top: 'hoodie', build: 1.02 },
      { headphones: true, backpack: true },
    );
    this.root = this.parts.root;
    const marker = new THREE.Mesh(
      new THREE.PlaneGeometry(1.7, 1.7),
      new THREE.MeshBasicMaterial({ map: markerTexture(), transparent: true, depthWrite: false, toneMapped: false }),
    );
    marker.rotation.x = -Math.PI / 2;
    marker.rotation.z = Math.PI; // chevron toward +z (forward)
    marker.position.y = 0.025;
    marker.renderOrder = 2;
    this.root.add(marker);
    this.marker = marker;
    this.root.add(buildContactShadow(0.42));
    scene.add(this.root);

    this.pos = new THREE.Vector3(0, 0.12, 11);
    this.vel = new THREE.Vector2();
    this.facing = Math.PI;
    this.keys = new Set();
    this.phase = 0;
    this.joints = Object.fromEntries(JOINTS.map((j) => [j, 0]));
    this.glance = 0;
    this.nextGlance = 3;
    this.nextBlink = 2;

    addEventListener('keydown', (e) => {
      if (e.target.closest?.('input, textarea')) return;
      this.keys.add(e.key.toLowerCase());
    });
    addEventListener('keyup', (e) => this.keys.delete(e.key.toLowerCase()));
    addEventListener('blur', () => this.keys.clear());
  }

  teleport(x, z) {
    this.pos.set(x, 0.12, z);
    this.vel.set(0, 0);
  }

  /**
   * @param {(x:number, z:number) => boolean} [blocked] collision test in world coordinates
   * @param {THREE.Vector3|null} [lookAt] something interesting nearby (e.g. the closest Sim)
   */
  update(dt, t, cameraYaw, blocked = () => false, lookAt = null) {
    const k = this.keys;
    let fx = 0;
    let fz = 0;
    if (k.has('w') || k.has('arrowup')) fz -= 1;
    if (k.has('s') || k.has('arrowdown')) fz += 1;
    if (k.has('a') || k.has('arrowleft')) fx -= 1;
    if (k.has('d') || k.has('arrowright')) fx += 1;
    const input = fx || fz;
    const speed = k.has('shift') ? RUN : WALK;

    // Velocity eases in and out so starts and stops feel weighty, not robotic.
    const want = new THREE.Vector2();
    if (input) {
      const len = Math.hypot(fx, fz);
      const sin = Math.sin(cameraYaw);
      const cos = Math.cos(cameraYaw);
      want.set(((fx * cos + fz * sin) / len) * speed, ((-fx * sin + fz * cos) / len) * speed);
    }
    this.vel.lerp(want, 1 - Math.exp(-dt * (input ? 9 : 12)));
    const v = this.vel.length();
    this.moving = v > 0.4;

    if (v > 0.01) {
      // Move, sliding along walls and furniture instead of stopping dead.
      const nx = this.pos.x + this.vel.x * dt;
      const nz = this.pos.z + this.vel.y * dt;
      if (blocked(this.pos.x, this.pos.z) || !blocked(nx, nz)) this.pos.set(nx, this.pos.y, nz);
      else if (!blocked(nx, this.pos.z)) this.pos.x = nx;
      else if (!blocked(this.pos.x, nz)) this.pos.z = nz;
      if (v > 0.3) {
        const target = Math.atan2(this.vel.x, this.vel.y);
        let d = target - this.facing;
        d = Math.atan2(Math.sin(d), Math.cos(d));
        this.facing += d * (1 - Math.exp(-dt * 12));
      }
    }
    this.root.position.copy(this.pos);
    this.root.rotation.y = this.facing;

    this.animate(dt, t, v, lookAt);
    this.marker.material.opacity = 0.75 + Math.sin(t * 2.5) * 0.2;
    this.marker.scale.setScalar(1 + Math.sin(t * 2.5) * 0.03);
  }

  animate(dt, t, v, lookAt) {
    const T = Object.fromEntries(JOINTS.map((j) => [j, 0]));
    const run = THREE.MathUtils.clamp((v - WALK) / (RUN - WALK), 0, 1);
    const gait = THREE.MathUtils.clamp(v / WALK, 0, 1);
    this.phase += dt * (6 + v * 1.25);
    const s = Math.sin(this.phase);
    const c = Math.cos(this.phase);

    if (gait > 0.05) {
      const amp = 0.5 + run * 0.35;
      T.legL = s * amp * gait;
      T.legR = -s * amp * gait;
      T.kneeL = Math.max(0, -c) * (0.8 + run * 0.5) * gait;
      T.kneeR = Math.max(0, c) * (0.8 + run * 0.5) * gait;
      T.armLx = -s * (0.45 + run * 0.4) * gait;
      T.armRx = s * (0.45 + run * 0.4) * gait;
      T.elbowL = T.elbowR = -(0.3 + run * 0.9) * gait;
      T.bodyY = Math.abs(c) * (0.05 + run * 0.06) * gait;
      T.lean = (0.05 + run * 0.15) * gait;
    } else {
      // Idle: breathe, shift weight, and glance around now and then.
      T.bodyY = Math.sin(t * 1.6) * 0.008;
      T.armLz = 0.1 + Math.sin(t * 1.6) * 0.015;
      T.armRz = -0.1 - Math.sin(t * 1.6) * 0.015;
      T.elbowL = T.elbowR = -0.15;
      if (t > this.nextGlance) {
        this.glance = (Math.random() - 0.5) * 1.2;
        this.nextGlance = t + 2.5 + Math.random() * 4;
      }
      T.headY = this.glance;
    }
    T.armLz ||= 0.08;
    T.armRz ||= -0.08;

    // Look at something interesting nearby (head only, within a comfortable range).
    if (lookAt) {
      const dx = lookAt.x - this.pos.x;
      const dz = lookAt.z - this.pos.z;
      let a = Math.atan2(dx, dz) - this.facing;
      a = Math.atan2(Math.sin(a), Math.cos(a));
      if (Math.abs(a) < 1.6) {
        T.headY = THREE.MathUtils.clamp(a, -1, 1);
        T.headX = -0.05;
      }
    }

    const k = 1 - Math.exp(-dt * (gait > 0.05 ? 16 : 7));
    const J = this.joints;
    for (const key of JOINTS) J[key] += (T[key] - J[key]) * k;
    const p = this.parts;
    p.body.position.y = J.bodyY;
    p.spine.rotation.x = J.lean;
    p.legL.rotation.x = J.legL;
    p.legR.rotation.x = J.legR;
    p.kneeL.rotation.x = J.kneeL;
    p.kneeR.rotation.x = J.kneeR;
    p.armL.rotation.set(J.armLx, 0, J.armLz);
    p.armR.rotation.set(J.armRx, 0, J.armRz);
    p.elbowL.rotation.x = J.elbowL;
    p.elbowR.rotation.x = J.elbowR;
    p.head.rotation.set(J.headX, J.headY, 0);
    p.torso.scale.set(1, 1 + Math.sin(t * 1.6) * 0.015, 1);

    let eyeY = 1;
    if (t > this.nextBlink) {
      eyeY = 0.1;
      if (t > this.nextBlink + 0.12) this.nextBlink = t + 2.5 + Math.random() * 3;
    }
    p.eyes.scale.y = eyeY;
  }
}

export class CameraRig {
  constructor(camera, dom) {
    this.camera = camera;
    this.yaw = Math.PI / 4;
    this.yawTarget = this.yaw;
    this.pitch = 0.85;
    this.distance = 22;
    this.distanceTarget = 22;
    this.target = new THREE.Vector3();
    this.fly = null;

    addEventListener('keydown', (e) => {
      if (e.target.closest?.('input, textarea')) return;
      if (e.key === 'q' || e.key === 'Q') this.yawTarget -= Math.PI / 4;
      if (e.key === 'e' || e.key === 'E') this.yawTarget += Math.PI / 4;
    });
    // Right- or middle-drag rotates and tilts the camera.
    let drag = null;
    dom.addEventListener('contextmenu', (e) => e.preventDefault());
    dom.addEventListener('pointerdown', (e) => {
      if (e.button === 1 || e.button === 2) drag = { x: e.clientX, y: e.clientY };
    });
    addEventListener('pointermove', (e) => {
      if (!drag) return;
      this.yawTarget -= (e.clientX - drag.x) * 0.006;
      this.pitch = THREE.MathUtils.clamp(this.pitch + (e.clientY - drag.y) * 0.004, 0.35, 1.35);
      drag = { x: e.clientX, y: e.clientY };
    });
    addEventListener('pointerup', () => (drag = null));
    dom.addEventListener('wheel', (e) => {
      e.preventDefault();
      this.distanceTarget = THREE.MathUtils.clamp(this.distanceTarget * (1 + e.deltaY * 0.001), 8, 60);
    }, { passive: false });
  }

  /** Glide the camera to a point with ease-in-out, optionally changing zoom. */
  flyTo(point, { distance = this.distanceTarget, duration = 0.9 } = {}) {
    this.fly = { from: this.target.clone(), to: point.clone(), t: 0, duration, d0: this.distance, d1: distance };
  }

  update(dt, focus) {
    const smooth = (rate) => 1 - Math.exp(-dt * rate);
    this.yaw += (this.yawTarget - this.yaw) * smooth(8);
    if (this.fly) {
      const f = this.fly;
      f.t += dt;
      const k = Math.min(1, f.t / f.duration);
      const e = k < 0.5 ? 4 * k * k * k : 1 - Math.pow(-2 * k + 2, 3) / 2;
      this.target.lerpVectors(f.from, f.to, e);
      // Arc out a little mid-flight so long jumps read as travel, not a cut.
      const lift = Math.sin(Math.PI * e) * Math.min(12, f.from.distanceTo(f.to) * 0.25);
      this.distance = THREE.MathUtils.lerp(f.d0, f.d1, e) + lift;
      if (k >= 1) {
        this.distanceTarget = f.d1;
        this.fly = null;
      }
    } else {
      this.distance += (this.distanceTarget - this.distance) * smooth(8);
      this.target.lerp(focus, smooth(5));
    }
    const d = this.distance;
    this.camera.position.set(
      this.target.x + Math.sin(this.yaw) * Math.cos(this.pitch) * d,
      this.target.y + Math.sin(this.pitch) * d,
      this.target.z + Math.cos(this.yaw) * Math.cos(this.pitch) * d,
    );
    this.camera.lookAt(this.target.x, this.target.y + 1, this.target.z);
  }
}
