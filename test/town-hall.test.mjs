import assert from 'node:assert/strict';
import { test } from 'node:test';
import * as THREE from 'three';
import { DOOR_ZONE, HALL, MAYOR_ROUTE, MAYOR_SEAT, buildTownHall, hallFloorAt } from '../web/src/town-hall.js';
import { mat } from '../web/src/models.js';

const built = () => {
  const g = new THREE.Group();
  const hall = buildTownHall(g, { outcomes: 4 });
  g.updateMatrixWorld(true);
  return { g, hall };
};

test('the Town Hall has walls, a lifting roof with a dome, partitions and doors', () => {
  const { hall } = built();
  assert.ok(hall.walls.length >= 10, `walls ${hall.walls.length}`);
  assert.ok(hall.walls.every((w) => w.userData.normal && w.userData.windows), 'every wall can lower in cutaway');
  assert.equal(hall.doors.length, 2, 'double front doors');
  let dome = false;
  hall.roof.traverse((o) => { if (o.isMesh && o.geometry.type === 'SphereGeometry') dome = true; });
  assert.ok(dome, 'the roof stack carries the dome');
  assert.ok(hall.roofBase > HALL.floor + 3, 'the roof sits on top of the storey');
  const size = new THREE.Box3().setFromObject(hall.roof).getSize(new THREE.Vector3());
  assert.ok(size.y > 8 && size.x > 26, `grand roofline ${size.x.toFixed(1)} × ${size.y.toFixed(1)}`);
});

test('night glows use the hall’s own materials, never the shared palette cache', () => {
  const { hall } = built();
  assert.ok(hall.glows.length > 20, `glowing windows and lamps ${hall.glows.length}`);
  // The previous hall set emissive on a cached box material, lighting every box of that colour at night.
  const cached = mat(0x9dc8c4);
  assert.equal(cached.emissive.getHex(), 0, 'cached palette material untouched');
  for (const m of hall.glows) assert.notEqual(m.material, cached);
});

test('Mayor Martin walks in through the front doors and around the furniture to his chair', () => {
  const { g, hall } = built();
  // Look straight down along the route: nothing taller than the floor, rugs and mosaics may be underfoot.
  const ray = new THREE.Raycaster();
  const down = new THREE.Vector3(0, -1, 0);
  const targets = [hall.inside, hall.partitions];
  const blockedAt = (x, z) => {
    ray.set(new THREE.Vector3(x - HALL.x, HALL.floor + 2.0, z - HALL.z), down);
    const hit = ray.intersectObjects(targets, true)[0];
    return hit && hit.point.y > HALL.floor + 0.15 ? hit.point.y : null;
  };
  // The probe does see furniture: the mayor's desk and a council bench.
  assert.ok(blockedAt(HALL.x + 10.25, HALL.z - 0.4) > HALL.floor + 0.7, 'desk detected');
  assert.ok(blockedAt(HALL.x - 6.6, HALL.z - 2.4) > HALL.floor + 0.3, 'bench detected');
  for (let i = 2; i < MAYOR_ROUTE.length - 1; i++) {
    const [ax, az] = MAYOR_ROUTE[i - 1];
    const [bx, bz] = MAYOR_ROUTE[i];
    for (let k = 0; k <= 24; k++) {
      const x = ax + ((bx - ax) * k) / 24;
      const z = az + ((bz - az) * k) / 24;
      for (const [dx, dz] of [[0, 0], [0.25, 0], [-0.25, 0], [0, 0.25], [0, -0.25]]) {
        const y = blockedAt(x + dx, z + dz);
        assert.equal(y, null, `route segment ${i} runs into something ${y?.toFixed(2)} high at ${(x + dx).toFixed(2)}, ${(z + dz).toFixed(2)}`);
      }
    }
  }
  // He crosses the front wall between the door jambs while the doors are open.
  const front = HALL.z + 6.85;
  const crossing = MAYOR_ROUTE.findIndex(([, z], i) => i && MAYOR_ROUTE[i - 1][1] > front && z < front);
  assert.ok(crossing > 0, 'the route enters the hall');
  assert.ok(Math.abs(MAYOR_ROUTE[crossing][0]) < 1.3, 'through the doorway');
  assert.ok(front > DOOR_ZONE[0] && front < DOOR_ZONE[1], 'the doors open around the doorway');
  // Steps lead up to the podium; the seat is on the office floor behind the desk.
  assert.equal(hallFloorAt(HALL.z + 12), 0.12);
  assert.equal(hallFloorAt(HALL.z + 8), HALL.floor);
  assert.equal(MAYOR_SEAT.y, HALL.floor);
  assert.deepEqual(MAYOR_ROUTE.at(-1), [MAYOR_SEAT.x, MAYOR_SEAT.z]);
  void g;
});
