// Pets (phase 3): a cat, dog or bunny per home. Pure flavor: they wander, nap, and come say hi when your
// avatar is near. They never stand in for, or say anything about, agents.

import * as THREE from 'three';
import { buildContactShadow, mat, rng, mergeRig } from './models.js';

const COATS = {
  cat: [0xe8a35c, 0x8d8d8d, 0x3a3a3a, 0xf4f1ea],
  dog: [0xc8935a, 0x6b4a33, 0xf4e3c3, 0x2f2f2f],
  bunny: [0xf4f1ea, 0xc9b38f, 0x9a9a9a],
};

function soft(color, roughness = 0.7) {
  return mat(color, { roughness, flat: false });
}

/** Low-poly pet facing +z. Returns the root plus parts we animate. */
function buildPet(kind, seed) {
  const r = rng(seed);
  const coatColor = COATS[kind][Math.floor(r() * COATS[kind].length)];
  const coat = soft(coatColor);
  const light = soft(new THREE.Color(coatColor).lerp(new THREE.Color(0xffffff), 0.45).getHex());
  const dark = soft(0x1b1d24, 0.3);
  const root = new THREE.Group();
  const body = new THREE.Group();
  root.add(body);
  const mesh = (geo, material, x, y, z) => {
    const m = new THREE.Mesh(geo, material);
    m.position.set(x, y, z);
    m.castShadow = true;
    body.add(m);
    return m;
  };
  const legs = [];
  const leg = (x, z, h, rad) => {
    const pivot = new THREE.Group();
    pivot.position.set(x, h, z);
    const m = new THREE.Mesh(new THREE.CapsuleGeometry(rad, h * 0.6, 3, 8), coat);
    m.position.y = -h / 2;
    m.castShadow = true;
    pivot.add(m);
    body.add(pivot);
    legs.push(pivot);
  };
  const head = new THREE.Group();
  body.add(head);
  const tail = new THREE.Group();
  body.add(tail);

  if (kind === 'cat') {
    const torso = mesh(new THREE.CapsuleGeometry(0.13, 0.3, 4, 10), coat, 0, 0.26, 0);
    torso.rotation.x = Math.PI / 2;
    for (const [x, z] of [[0.08, 0.14], [-0.08, 0.14], [0.08, -0.14], [-0.08, -0.14]]) leg(x, z, 0.18, 0.04);
    head.position.set(0, 0.38, 0.24);
    head.add(new THREE.Mesh(new THREE.SphereGeometry(0.12, 14, 10), coat));
    for (const s of [1, -1]) {
      const ear = new THREE.Mesh(new THREE.ConeGeometry(0.045, 0.09, 4), coat);
      ear.position.set(s * 0.07, 0.11, -0.01);
      head.add(ear);
      const eye = new THREE.Mesh(new THREE.SphereGeometry(0.018, 8, 6), dark);
      eye.position.set(s * 0.045, 0.02, 0.105);
      head.add(eye);
    }
    tail.position.set(0, 0.3, -0.24);
    const t = new THREE.Mesh(new THREE.CapsuleGeometry(0.025, 0.28, 3, 6), coat);
    t.position.set(0, 0.14, -0.04);
    t.rotation.x = -0.4;
    tail.add(t);
  } else if (kind === 'dog') {
    const torso = mesh(new THREE.CapsuleGeometry(0.16, 0.34, 4, 10), coat, 0, 0.34, 0);
    torso.rotation.x = Math.PI / 2;
    for (const [x, z] of [[0.1, 0.16], [-0.1, 0.16], [0.1, -0.16], [-0.1, -0.16]]) leg(x, z, 0.24, 0.05);
    head.position.set(0, 0.5, 0.28);
    head.add(new THREE.Mesh(new THREE.SphereGeometry(0.14, 14, 10), coat));
    const snout = new THREE.Mesh(new THREE.CapsuleGeometry(0.06, 0.08, 3, 8), light);
    snout.rotation.x = Math.PI / 2;
    snout.position.set(0, -0.03, 0.14);
    head.add(snout);
    const nose = new THREE.Mesh(new THREE.SphereGeometry(0.028, 8, 6), dark);
    nose.position.set(0, -0.01, 0.23);
    head.add(nose);
    for (const s of [1, -1]) {
      const ear = new THREE.Mesh(new THREE.CapsuleGeometry(0.04, 0.1, 3, 6), soft(new THREE.Color(coatColor).multiplyScalar(0.75).getHex()));
      ear.position.set(s * 0.12, -0.02, -0.02);
      ear.rotation.z = s * 0.3;
      head.add(ear);
      const eye = new THREE.Mesh(new THREE.SphereGeometry(0.02, 8, 6), dark);
      eye.position.set(s * 0.06, 0.04, 0.12);
      head.add(eye);
    }
    tail.position.set(0, 0.42, -0.3);
    const t = new THREE.Mesh(new THREE.CapsuleGeometry(0.03, 0.16, 3, 6), coat);
    t.position.set(0, 0.08, -0.03);
    t.rotation.x = -0.6;
    tail.add(t);
  } else {
    mesh(new THREE.SphereGeometry(0.16, 14, 10), coat, 0, 0.2, 0).scale.set(1, 0.9, 1.2);
    for (const [x, z] of [[0.08, 0.1], [-0.08, 0.1], [0.08, -0.12], [-0.08, -0.12]]) leg(x, z, 0.08, 0.04);
    head.position.set(0, 0.32, 0.16);
    head.add(new THREE.Mesh(new THREE.SphereGeometry(0.1, 14, 10), coat));
    for (const s of [1, -1]) {
      const ear = new THREE.Mesh(new THREE.CapsuleGeometry(0.03, 0.18, 3, 6), coat);
      ear.position.set(s * 0.04, 0.17, -0.02);
      ear.rotation.z = s * -0.15;
      head.add(ear);
      const eye = new THREE.Mesh(new THREE.SphereGeometry(0.016, 8, 6), dark);
      eye.position.set(s * 0.05, 0.02, 0.085);
      head.add(eye);
    }
    tail.position.set(0, 0.2, -0.2);
    tail.add(new THREE.Mesh(new THREE.SphereGeometry(0.05, 8, 6), light));
  }
  head.traverse((o) => o.isMesh && (o.castShadow = true));
  tail.traverse((o) => o.isMesh && (o.castShadow = true));
  root.add(buildContactShadow(0.3, 0.3));
  mergeRig(root); // one or two draws per joint instead of one per piece
  return { root, body, head, tail, legs };
}

export class Pet {
  /**
   * @param {'cat'|'dog'|'bunny'} kind
   * @param {import('./lot.js').Lot} lot
   */
  constructor(kind, lot) {
    this.kind = kind;
    this.lot = lot;
    this.seed = lot.seed + kind.length * 101;
    this.r = rng(this.seed);
    this.parts = buildPet(kind, this.seed);
    this.root = this.parts.root;
    lot.group.add(this.root);
    this.pos = new THREE.Vector2(2.5, 4.2);
    this.facing = Math.PI;
    this.path = [];
    this.mode = 'idle'; // idle | wander | sit | nap | greet
    this.until = 1;
    this.phase = 0;
  }

  /** Random walkable spot inside the room or the yard. */
  randomSpot() {
    const nav = this.lot.getNav();
    for (let i = 0; i < 20; i++) {
      const x = -10 + this.r() * 20;
      const z = -4.5 + this.r() * 13.5;
      if (nav.walkable(x, z)) return { x, z };
    }
    return { x: this.pos.x, z: this.pos.y };
  }

  /**
   * @param {number} dt
   * @param {number} t elapsed seconds
   * @param {THREE.Vector3|null} avatar the player's world position
   */
  update(dt, t, avatar) {
    const speed = this.kind === 'dog' ? 2.6 : this.kind === 'bunny' ? 1.8 : 2.1;
    // Come say hi when the avatar is close by (same lot).
    let greet = null;
    if (avatar) {
      const lx = avatar.x - this.lot.group.position.x;
      const lz = avatar.z - this.lot.group.position.z;
      const d = Math.hypot(lx - this.pos.x, lz - this.pos.y);
      if (d < 6 && this.lot.getNav().inBounds(lx, lz)) greet = { x: lx, z: lz, d };
    }
    if (greet) {
      this.mode = 'greet';
      this.path = [];
      if (greet.d > 1.1) {
        const dx = (greet.x - this.pos.x) / greet.d;
        const dz = (greet.z - this.pos.y) / greet.d;
        const nx = this.pos.x + dx * speed * 1.25 * dt;
        const nz = this.pos.y + dz * speed * 1.25 * dt;
        if (this.lot.getNav().walkable(nx, nz)) this.pos.set(nx, nz);
      }
      this.turnToward(greet.x - this.pos.x, greet.z - this.pos.y, dt);
    } else if (this.mode === 'greet') {
      this.mode = 'idle';
      this.until = t + 1.5;
    }

    if (!greet && t > this.until && !this.path.length) {
      const roll = this.r();
      if (roll < 0.55) {
        this.mode = 'wander';
        this.path = this.lot.getNav().findPath({ x: this.pos.x, z: this.pos.y }, this.randomSpot());
      } else if (roll < 0.8) {
        this.mode = 'sit';
        this.until = t + 4 + this.r() * 6;
      } else {
        this.mode = 'nap';
        this.until = t + 10 + this.r() * 12;
      }
    }
    let moving = !!greet && greet.d > 1.1;
    if (this.path.length) {
      const wp = this.path[0];
      const dx = wp.x - this.pos.x;
      const dz = wp.z - this.pos.y;
      const dist = Math.hypot(dx, dz);
      const step = speed * dt;
      if (dist <= step) {
        this.pos.set(wp.x, wp.z);
        this.path.shift();
        if (!this.path.length) {
          this.mode = 'idle';
          this.until = t + 1 + this.r() * 3;
        }
      } else {
        this.pos.x += (dx / dist) * step;
        this.pos.y += (dz / dist) * step;
        this.turnToward(dx, dz, dt);
      }
      moving = true;
    }

    this.root.position.set(this.pos.x, 0.12, this.pos.y);
    this.root.rotation.y = this.facing;
    this.animate(dt, t, moving);
  }

  turnToward(dx, dz, dt) {
    let d = Math.atan2(dx, dz) - this.facing;
    d = Math.atan2(Math.sin(d), Math.cos(d));
    this.facing += d * (1 - Math.exp(-dt * 8));
  }

  animate(dt, t, moving) {
    const p = this.parts;
    this.phase += dt * (moving ? 14 : 2);
    const s = Math.sin(this.phase);
    p.legs.forEach((leg, i) => (leg.rotation.x = moving ? s * 0.6 * (i % 2 ? 1 : -1) * (i < 2 ? 1 : -1) : 0));
    const hop = this.kind === 'bunny' && moving ? Math.abs(Math.sin(this.phase * 0.5)) * 0.14 : 0;
    const resting = this.mode === 'nap' || this.mode === 'sit';
    p.body.position.y = hop - (this.mode === 'nap' ? 0.08 : 0);
    p.body.rotation.x = this.mode === 'sit' ? -0.25 : 0;
    p.head.rotation.x = this.mode === 'nap' ? 0.5 : this.mode === 'greet' ? -0.25 : Math.sin(t * 0.7) * 0.05;
    p.head.rotation.y = resting ? 0 : Math.sin(t * 0.5 + this.seed) * 0.25;
    const wag = this.kind === 'dog' && (this.mode === 'greet' || moving) ? 14 : 3;
    p.tail.rotation.y = Math.sin(t * wag) * (this.kind === 'dog' ? 0.6 : 0.25);
  }

  dispose() {
    this.lot.group.remove(this.root);
  }
}
