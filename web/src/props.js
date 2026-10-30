// Town props (simulation layer): small low-poly trees, flower beds, benches, hedges, fountains, gazebos and statues
// the player buys with Civic Pride (shared/town.mjs `TOWN_PROPS`). Each part of each kind is one InstancedMesh shared
// by every prop of that kind, so draw calls stay flat however many props are placed. Scenery only: props never show
// or imply agent work.
import * as THREE from 'three';
import { TOWN_PROPS, tileCenter } from '../../shared/town.mjs';

const geo = {
  box: (w, h, d) => new THREE.BoxGeometry(w, h, d),
  cyl: (rt, rb, h, n = 8) => new THREE.CylinderGeometry(rt, rb, h, n),
  cone: (r, h, n = 7) => new THREE.ConeGeometry(r, h, n),
  ball: (r, detail = 0) => new THREE.IcosahedronGeometry(r, detail),
};
const mat = (color, extra = {}) => new THREE.MeshStandardMaterial({ color, roughness: 0.85, flatShading: true, ...extra });

/** Parts per kind: [geometry, material, x, y, z]. Sizes in metres; a tile is 8 m across. */
function partsFor(kind) {
  const wood = mat(0x8a5a3b), stone = mat(0xc9c3b6), leaf = mat(0x4f9a4a), dark = mat(0x3f7d3a);
  switch (kind) {
    case 'tree': return [[geo.cyl(0.25, 0.35, 2.2), wood, 0, 1.1, 0], [geo.ball(1.9, 1), leaf, 0, 3.4, 0], [geo.ball(1.2, 0), mat(0x5fae5a), 0.6, 4.4, 0.3]];
    case 'flower_bed': return [[geo.box(3.4, 0.35, 2.2), mat(0x6b4a33), 0, 0.18, 0], [geo.ball(0.45), mat(0xe887b8), -1, 0.6, -0.4], [geo.ball(0.45), mat(0xffd166), 0, 0.6, 0.4], [geo.ball(0.45), mat(0xb08bff), 1, 0.6, -0.3]];
    case 'bench': return [[geo.box(2.6, 0.15, 0.7), wood, 0, 0.55, 0], [geo.box(2.6, 0.6, 0.12), wood, 0, 0.95, -0.32], [geo.box(0.12, 0.5, 0.6), mat(0x3b3b44), -1.1, 0.25, 0], [geo.box(0.12, 0.5, 0.6), mat(0x3b3b44), 1.1, 0.25, 0]];
    case 'hedge': return [[geo.box(6.4, 1.6, 1.4), dark, 0, 0.8, 0], [geo.box(6.0, 0.4, 1.1), leaf, 0, 1.75, 0]];
    case 'fountain': return [[geo.cyl(2.4, 2.6, 0.6, 12), stone, 0, 0.3, 0], [geo.cyl(2.0, 2.0, 0.1, 12), mat(0x7cc4e4, { roughness: 0.2, metalness: 0.1 }), 0, 0.58, 0], [geo.cyl(0.3, 0.4, 1.8), stone, 0, 1.2, 0], [geo.cyl(0.9, 0.5, 0.3, 10), stone, 0, 2.1, 0]];
    case 'gazebo': return [[geo.cyl(2.8, 2.8, 0.3, 8), mat(0xe8dcc4), 0, 0.15, 0], [geo.cyl(0.15, 0.15, 2.6), mat(0xf2e6cf), 2.1, 1.6, 0], [geo.cyl(0.15, 0.15, 2.6), mat(0xf2e6cf), -2.1, 1.6, 0], [geo.cyl(0.15, 0.15, 2.6), mat(0xf2e6cf), 0, 1.6, 2.1], [geo.cyl(0.15, 0.15, 2.6), mat(0xf2e6cf), 0, 1.6, -2.1], [geo.cone(3.2, 1.6, 8), mat(0xb5584a), 0, 3.7, 0]];
    case 'statue': return [[geo.box(1.8, 1.2, 1.8), stone, 0, 0.6, 0], [geo.cyl(0.35, 0.5, 2.0), mat(0xa9a397), 0, 2.2, 0], [geo.ball(0.45, 1), mat(0xa9a397), 0, 3.5, 0]];
    default: return [];
  }
}

export class TownProps {
  constructor(scene) {
    this.group = new THREE.Group();
    this.group.name = 'props';
    scene.add(this.group);
    this.key = '';
  }

  /** Rebuild the instanced meshes when the set of props changes. */
  setTown(town) {
    const props = (town?.props || []).filter((p) => Object.hasOwn(TOWN_PROPS, p.kind) && p.i != null);
    const key = props.map((p) => `${p.id}:${p.kind}:${p.i},${p.j}`).join('|');
    if (key === this.key) return;
    this.key = key;
    this.clear();
    const byKind = new Map();
    for (const p of props) (byKind.get(p.kind) || byKind.set(p.kind, []).get(p.kind)).push(p);
    const m = new THREE.Matrix4(), q = new THREE.Quaternion(), up = new THREE.Vector3(0, 1, 0), one = new THREE.Vector3(1, 1, 1);
    for (const [kind, list] of byKind) {
      for (const [g, material, x, y, z] of partsFor(kind)) {
        const mesh = new THREE.InstancedMesh(g, material, list.length);
        mesh.castShadow = true;
        mesh.receiveShadow = true;
        list.forEach((p, n) => {
          const c = tileCenter(p.i, p.j);
          // A small, stable turn per prop so rows of trees don't look stamped.
          const yaw = kind === 'hedge' || kind === 'bench' ? 0 : ((p.i * 7 + p.j * 13) % 8) * (Math.PI / 4);
          q.setFromAxisAngle(up, yaw);
          const offset = new THREE.Vector3(x, y, z).applyQuaternion(q);
          m.compose(new THREE.Vector3(c.x + offset.x, offset.y, c.z + offset.z), q, one);
          mesh.setMatrixAt(n, m);
        });
        mesh.instanceMatrix.needsUpdate = true;
        this.group.add(mesh);
      }
    }
  }

  clear() {
    for (const mesh of [...this.group.children]) {
      this.group.remove(mesh);
      mesh.geometry.dispose();
      mesh.material.dispose();
      mesh.dispose?.();
    }
  }
}
