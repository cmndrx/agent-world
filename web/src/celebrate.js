// Celebrations for human decisions (phase 2): confetti when you accept a task, fireworks when a home
// levels up. They react to your actions on the board, never to agent activity.

import * as THREE from 'three';

const COLORS = [0xff6b6b, 0xffd166, 0x06d6a0, 0x4f86c6, 0xc77dff, 0xff8fab];
const _m = new THREE.Matrix4();
const _q = new THREE.Quaternion();
const _e = new THREE.Euler();
const _s = new THREE.Vector3();

export class Celebrations {
  constructor(scene) {
    this.scene = scene;
    this.bursts = [];
  }

  /** Paper confetti popping up over a spot and fluttering down. */
  confetti(at, count = 90) {
    const mat = new THREE.MeshStandardMaterial({ side: THREE.DoubleSide, roughness: 0.6, transparent: true });
    const mesh = new THREE.InstancedMesh(new THREE.PlaneGeometry(0.12, 0.08), mat, count);
    const parts = [];
    const color = new THREE.Color();
    for (let i = 0; i < count; i++) {
      const a = Math.random() * Math.PI * 2;
      const speed = 2 + Math.random() * 3;
      parts.push({
        p: new THREE.Vector3(at.x, at.y + 2.5, at.z),
        v: new THREE.Vector3(Math.cos(a) * speed * 0.6, 5 + Math.random() * 4, Math.sin(a) * speed * 0.6),
        r: new THREE.Vector3(Math.random() * 6, Math.random() * 6, Math.random() * 6),
        spin: new THREE.Vector3((Math.random() - 0.5) * 12, (Math.random() - 0.5) * 12, (Math.random() - 0.5) * 12),
      });
      mesh.setColorAt(i, color.setHex(COLORS[i % COLORS.length]));
    }
    this.add({ mesh, parts, life: 3.2, drag: 2.2, gravity: 7, size: 1 });
  }

  /** A few glowing bursts high over a home (bloom makes them shine). */
  fireworks(at, shells = 4) {
    for (let k = 0; k < shells; k++) {
      setTimeout(() => {
        const count = 60;
        const hue = COLORS[(k * 2) % COLORS.length];
        const mat = new THREE.MeshStandardMaterial({ color: hue, emissive: hue, emissiveIntensity: 4, transparent: true });
        const mesh = new THREE.InstancedMesh(new THREE.IcosahedronGeometry(0.09, 0), mat, count);
        const center = new THREE.Vector3(at.x + (Math.random() - 0.5) * 8, at.y + 9 + Math.random() * 4, at.z + (Math.random() - 0.5) * 6);
        const parts = [];
        for (let i = 0; i < count; i++) {
          const dir = new THREE.Vector3().randomDirection();
          parts.push({ p: center.clone(), v: dir.multiplyScalar(5 + Math.random() * 2), r: new THREE.Vector3(), spin: new THREE.Vector3() });
        }
        this.add({ mesh, parts, life: 1.8, drag: 1.4, gravity: 3, size: 1, shrink: true });
      }, k * 380);
    }
    this.confetti(at, 60);
  }

  add(burst) {
    burst.age = 0;
    burst.mesh.frustumCulled = false;
    this.scene.add(burst.mesh);
    this.bursts.push(burst);
  }

  update(dt) {
    for (const b of [...this.bursts]) {
      b.age += dt;
      const t = b.age / b.life;
      if (t >= 1) {
        this.scene.remove(b.mesh);
        b.mesh.geometry.dispose();
        b.mesh.material.dispose();
        this.bursts.splice(this.bursts.indexOf(b), 1);
        continue;
      }
      b.mesh.material.opacity = t < 0.7 ? 1 : 1 - (t - 0.7) / 0.3;
      const k = Math.exp(-dt * b.drag);
      b.parts.forEach((p, i) => {
        p.v.multiplyScalar(k);
        p.v.y -= b.gravity * dt;
        p.p.addScaledVector(p.v, dt);
        if (p.p.y < 0.15) p.p.y = 0.15;
        p.r.addScaledVector(p.spin, dt);
        const s = b.shrink ? 1 - t * 0.7 : 1;
        _m.compose(p.p, _q.setFromEuler(_e.set(p.r.x, p.r.y, p.r.z)), _s.set(s, s, s));
        b.mesh.setMatrixAt(i, _m);
      });
      b.mesh.instanceMatrix.needsUpdate = true;
    }
  }
}
