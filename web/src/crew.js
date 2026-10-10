// The Town Hall construction crew (game ambience; never observed agent activity). Three workers with
// distinct jobs, each a simple looping routine built on the shared character rig:
//   hammerer — kneels on the deck and nails a beam: quick strikes with dust puffs, then checks the work;
//   sawyer   — saws a board on a sawhorse, sawdust drifting down under the cut;
//   carrier  — picks up a plank from the lumber pile, shoulders it across the site, sets it down, walks back.

import * as THREE from 'three';
import { box, buildPerson, cyl, mat } from './models.js';
import { armIK } from './sim.js';

const JOINTS = ['bodyY', 'lean', 'twist', 'legL', 'legR', 'kneeL', 'kneeR', 'armLx', 'armLz', 'armRx', 'armRz', 'elbowL', 'elbowR', 'headX', 'headY'];
const smooth = (x) => x * x * (3 - 2 * x);
const clamp01 = (x) => Math.min(1, Math.max(0, x));
const mix = (a, b, k) => [a[0] + (b[0] - a[0]) * k, a[1] + (b[1] - a[1]) * k, a[2] + (b[2] - a[2]) * k];

function rest() {
  const T = Object.fromEntries(JOINTS.map((j) => [j, 0]));
  T.armLz = 0.17;
  T.armRz = -0.17;
  T.armLx = T.armRx = -0.07;
  T.elbowL = T.elbowR = -0.24;
  return T;
}

function apply(parts, J) {
  parts.body.position.y = J.bodyY;
  parts.spine.rotation.set(J.lean, J.twist, 0);
  parts.legL.rotation.x = J.legL;
  parts.legR.rotation.x = J.legR;
  parts.kneeL.rotation.x = J.kneeL;
  parts.kneeR.rotation.x = J.kneeR;
  parts.armL.rotation.set(J.armLx, 0, J.armLz);
  parts.armR.rotation.set(J.armRx, 0, J.armRz);
  parts.elbowL.rotation.x = J.elbowL;
  parts.elbowR.rotation.x = J.elbowR;
  parts.head.rotation.set(J.headX, J.headY, 0);
}

function worker(look) {
  const parts = buildPerson({ hair: 0x513e35, pants: 0x45505a, shoes: 0x524239, hairStyle: 0, top: 'long', build: 1, ...look }, { scale: 0.95 });
  // A faceted hard hat with a brim and a ridge (not the beanie's pompom).
  const hatMat = mat(0xf7ca4e, { roughness: 0.45 });
  const dome = new THREE.Mesh(new THREE.SphereGeometry(0.37, 8, 4, 0, Math.PI * 2, 0, Math.PI / 2), hatMat);
  dome.position.set(0, 0.44, -0.01);
  dome.scale.set(1, 1, 1.02);
  dome.castShadow = true;
  parts.head.add(dome);
  parts.head.add(cyl(0.41, 0.41, 0.035, 0xf2bd34, 8, 0, 0.44, 0.03));
  parts.head.add(box(0.08, 0.06, 0.66, 0xf2bd34, 0, 0.79, -0.01));
  parts.J = rest();
  return parts;
}

/** Tool in the right fist, sticking forward out of the hand (elbow-local coordinates). */
function inHand(parts, tool) {
  tool.position.set(0, -0.29, 0.02);
  parts.elbowR.add(tool);
  return tool;
}

function hammer() {
  const g = new THREE.Group();
  g.add(box(0.035, 0.035, 0.36, 0x9a6b3e, 0, 0, 0.16));
  g.add(box(0.07, 0.17, 0.08, 0x4a4f5a, 0, 0.02, 0.34));
  return g;
}

function saw() {
  const g = new THREE.Group();
  g.add(box(0.05, 0.1, 0.12, 0xd0573a, 0, 0, 0.05));
  const blade = box(0.012, 0.14, 0.55, 0xc9ced6, 0, -0.03, 0.38, { metalness: 0.6, roughness: 0.3 });
  g.add(blade);
  return g;
}

/** A small pool of dust or sawdust puffs living in a station's local space. */
class Puffs {
  constructor(parent, color, count = 10) {
    this.items = [];
    const material = new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0, depthWrite: false });
    for (let i = 0; i < count; i++) {
      const m = new THREE.Mesh(new THREE.IcosahedronGeometry(0.045, 0), material.clone());
      m.visible = false;
      parent.add(m);
      this.items.push({ m, age: 1, life: 1, v: new THREE.Vector3() });
    }
    this.next = 0;
  }

  emit(x, y, z, n = 4, spread = 0.6, rise = 0.5, life = 0.7) {
    for (let k = 0; k < n; k++) {
      const p = this.items[this.next++ % this.items.length];
      p.m.position.set(x, y, z);
      p.v.set((Math.random() - 0.5) * spread, rise * (0.4 + Math.random() * 0.6), (Math.random() - 0.5) * spread);
      p.age = 0;
      p.life = life * (0.7 + Math.random() * 0.6);
      p.m.visible = true;
    }
  }

  update(dt, gravity = -1.2) {
    for (const p of this.items) {
      if (p.age >= p.life) continue;
      p.age += dt;
      p.v.y += gravity * dt;
      p.m.position.addScaledVector(p.v, dt);
      const k = p.age / p.life;
      p.m.scale.setScalar(0.6 + k * 1.4);
      p.m.material.opacity = Math.sin(Math.min(1, k) * Math.PI) * 0.75;
      if (p.age >= p.life) p.m.visible = false;
    }
  }
}

export class Crew {
  /**
   * @param {THREE.Group} site Town Hall site group (local: base slab top y 0.24, deck top y 0.46)
   */
  constructor(site) {
    this.members = [];

    // Hammerer: kneels on the deck facing a beam laid across it.
    {
      const station = new THREE.Group();
      station.position.set(-3.5, 0.46, 1.9);
      station.rotation.y = Math.PI / 2;
      site.add(station);
      station.add(box(0.2, 0.14, 1.9, 0xc99459, 0.05, 0.07, 0.55)); // beam, along the worker's view
      for (let i = 0; i < 5; i++) station.add(box(0.025, 0.03, 0.025, 0x6c6861, 0.05, 0.155, 0.2 + i * 0.18)); // nail heads
      const parts = worker({ skin: 0xd7a47e, shirt: 0xd17548 });
      station.add(parts.root);
      inHand(parts, hammer());
      this.members.push({ kind: 'hammer', parts, station, puffs: new Puffs(station, 0xe9dfcf, 12), phase: 0, lastHit: -1 });
    }

    // Sawyer: stands at a sawhorse with a board across it.
    {
      const station = new THREE.Group();
      station.position.set(2.7, 0.46, 0.75);
      station.rotation.y = 0.35;
      site.add(station);
      const horse = new THREE.Group();
      horse.position.z = 0.62;
      for (const sx of [-0.45, 0.45]) {
        for (const sz of [-0.14, 0.14]) {
          const leg = box(0.05, 0.62, 0.05, 0x8a6a48, sx, 0.29, sz);
          leg.rotation.x = sz > 0 ? -0.22 : 0.22;
          horse.add(leg);
        }
      }
      horse.add(box(1.05, 0.07, 0.1, 0x9a7650, 0, 0.6, 0));
      horse.add(box(1.5, 0.05, 0.3, 0xd8b07a, -0.1, 0.66, 0)); // the board being cut
      station.add(horse);
      const parts = worker({ skin: 0x9c674d, shirt: 0x388b9a });
      station.add(parts.root);
      inHand(parts, saw()).rotation.x = 1.1; // blade angles down along the forearm into the cut
      this.members.push({ kind: 'saw', parts, station, puffs: new Puffs(station, 0xe2c08f, 16), phase: 1.3 });
    }

    // Carrier: lumber pile on the left of the front slab, delivery stack on the right.
    {
      const pile = (x, n, color) => {
        for (let i = 0; i < n; i++) site.add(box(0.34, 0.08, 1.5, color, x + (i % 2) * 0.02, 0.29 + i * 0.085, 3.72));
      };
      pile(-4.55, 6, 0xd8b07a);
      pile(3.65, 3, 0xcfa56d);
      const parts = worker({ skin: 0xc58c64, shirt: 0x6b8f3a });
      parts.root.position.set(-4.0, 0.25, 3.72);
      site.add(parts.root);
      const plank = box(0.12, 0.07, 1.5, 0xd8b07a, -0.06, 0.72, 0.08);
      plank.visible = false;
      parts.spine.add(plank); // rides on the right shoulder
      this.members.push({ kind: 'carry', parts, plank, from: -4.0, to: 3.1, z: 3.72, phase: 0 });
    }
  }

  update(dt, t) {
    for (const m of this.members) {
      const T = rest();
      const { parts } = m;
      if (m.kind === 'hammer') this.hammer(m, T, t);
      else if (m.kind === 'saw') this.saw(m, T, t);
      else this.carry(m, T, t);
      const k = 1 - Math.exp(-dt * (m.fast ? 22 : 9));
      for (const j of JOINTS) parts.J[j] += (T[j] - parts.J[j]) * k;
      apply(parts, parts.J);
      m.puffs?.update(dt, m.kind === 'saw' ? -0.6 : -1.4);
    }
  }

  /** 3.2 s loop: four quick strikes, then a pause to look the work over and reach for the next nail. */
  hammer(m, T, t) {
    const cycle = 3.2;
    const c = (t + m.phase) % cycle;
    // Kneel on the right knee, left foot planted forward, leaning over the beam.
    T.bodyY = -0.33;
    T.legL = -1.25;
    T.kneeL = 1.25;
    T.legR = 0.05;
    T.kneeR = Math.PI / 2;
    T.lean = 0.42;
    const strike = [-0.06, 0.24, 0.47]; // nail on the beam, worker-local
    const raised = [-0.18, 0.95, 0.32];
    armIK(T, 1, [0.14, 0.22, 0.42]); // left hand steadies the nail
    if (c < 2) {
      const s = (c % 0.5) / 0.5; // one strike every 0.5 s
      const k = s < 0.65 ? smooth(s / 0.65) : 1 - smooth((s - 0.65) / 0.35); // slow lift, fast drop
      armIK(T, -1, mix(strike, raised, k));
      T.headX = 0.25;
      m.fast = true;
      const hit = Math.floor(c / 0.5);
      if (s > 0.97 || s < 0.04) {
        if (m.lastHit !== hit) {
          m.lastHit = hit;
          m.puffs.emit(strike[0], strike[1] + 0.02, strike[2], 3, 0.7, 0.45, 0.55);
        }
      }
    } else {
      // Sit back a little, check the work, then reach toward the next nail.
      const p = (c - 2) / (cycle - 2);
      T.lean = 0.3;
      T.headX = 0.35;
      T.headY = Math.sin(p * Math.PI * 2) * 0.35;
      armIK(T, -1, [-0.22, 0.55, 0.3]);
      m.fast = false;
      m.lastHit = -1;
    }
  }

  /** Continuous sawing strokes with sawdust, breaking every few seconds to blow the dust off and check the line. */
  saw(m, T, t) {
    const cycle = 4.5;
    const c = (t + m.phase) % cycle;
    T.lean = 0.3;
    T.twist = 0.12;
    T.legL = -0.18;
    T.legR = 0.14;
    T.kneeR = 0.12;
    T.headX = 0.3;
    armIK(T, 1, [0.26, 0.76, 0.55]); // left hand holds the board
    if (c < 3.4) {
      const s = Math.sin(c * 7.5);
      armIK(T, -1, [-0.12, 0.84 + s * 0.02, 0.4 + s * 0.17]);
      T.bodyY = Math.abs(s) * 0.012;
      T.twist = 0.12 + s * 0.05;
      m.fast = true;
      if (Math.random() < 0.35) m.puffs.emit(-0.12, 0.62, 0.62, 1, 0.12, 0.02, 1.1);
    } else {
      armIK(T, -1, [-0.3, 0.9, 0.25]);
      T.headY = 0.2;
      T.headX = 0.45;
      m.fast = false;
    }
  }

  /** 11 s loop: pick up a plank, walk it across the site, set it down, walk back empty. */
  carry(m, T, t) {
    const PICK = 1.2;
    const WALK = 4.3;
    const cycle = PICK * 2 + WALK * 2;
    const c = (t + m.phase) % cycle;
    const root = m.parts.root;
    const bend = (p) => {
      // Squat and reach down, then stand back up.
      const k = Math.sin(p * Math.PI);
      T.lean = 0.75 * k;
      T.bodyY = -0.2 * k;
      T.legL = T.legR = -0.55 * k;
      T.kneeL = T.kneeR = 0.95 * k;
      armIK(T, 1, mix([0.3, 1.05, 0.15], [0.2, 0.38, 0.5], k));
      armIK(T, -1, mix([-0.3, 1.05, 0.15], [-0.2, 0.38, 0.5], k));
      T.headX = 0.3 * k;
    };
    const walk = (p, dir, carrying) => {
      const ph = p * WALK * 8.5;
      const s = Math.sin(ph);
      T.legL = s * 0.5;
      T.legR = -s * 0.5;
      T.kneeL = Math.max(0, -Math.cos(ph)) * 0.75;
      T.kneeR = Math.max(0, Math.cos(ph)) * 0.75;
      T.bodyY = Math.abs(Math.cos(ph)) * 0.05;
      T.lean = 0.07;
      T.armLx = -s * 0.4;
      T.elbowL = -0.35;
      if (carrying) armIK(T, -1, [-0.24, 1.66, 0.12]); // right hand steadies the plank on the shoulder
      else {
        T.armRx = s * 0.4;
        T.elbowR = -0.35;
      }
      root.position.x = dir > 0 ? m.from + (m.to - m.from) * smooth(p) : m.to + (m.from - m.to) * smooth(p);
    };
    m.fast = false;
    if (c < PICK) {
      root.position.x = m.from;
      root.rotation.y = -Math.PI / 2; // face the pile
      bend(c / PICK);
      m.plank.visible = c / PICK > 0.5;
    } else if (c < PICK + WALK) {
      root.rotation.y = Math.PI / 2;
      walk((c - PICK) / WALK, 1, true);
      m.plank.visible = true;
    } else if (c < PICK * 2 + WALK) {
      root.position.x = m.to;
      root.rotation.y = Math.PI / 2; // face the delivery stack
      const p = (c - PICK - WALK) / PICK;
      bend(p);
      m.plank.visible = p < 0.5;
    } else {
      root.rotation.y = -Math.PI / 2;
      walk((c - PICK * 2 - WALK) / WALK, -1, false);
      m.plank.visible = false;
    }
  }
}
