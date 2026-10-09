import * as THREE from 'three';
import { CSS2DObject } from 'three/addons/renderers/CSS2DRenderer.js';
import { buildContactShadow, buildPerson, box } from './models.js';

const LOOK = {
  skin: 0xd99c76, hair: 0x77736d, shirt: 0x205e70, pants: 0x303b4a,
  shoes: 0x573b2e, hairStyle: 2, top: 'collar', build: 1,
};
const OUTSIDE = new THREE.Vector3(3.5, 0.12, -5.4);
const OFFICE_SEAT = new THREE.Vector3(0, 0.35, -17.05);
const OFFICE_ROUTE = [
  [2.1, -8.2], [0, -9.5], [0, -12.3], [2.45, -13.4], [2.45, -17.05], [0, -17.05],
];

function makeMayor(scale) {
  const parts = buildPerson(LOOK, { scale });
  const beardMat = new THREE.MeshStandardMaterial({ color: 0x8b8981, roughness: 0.9 });
  for (const [x, y, z, sx, sy, sz] of [
    [-0.23, 0.15, 0.12, 0.09, 0.15, 0.12],
    [0.23, 0.15, 0.12, 0.09, 0.15, 0.12],
    [0, 0.035, 0.13, 0.21, 0.11, 0.14],
    [-0.085, 0.18, 0.255, 0.09, 0.035, 0.045],
    [0.085, 0.18, 0.255, 0.09, 0.035, 0.045],
  ]) {
    const tuft = new THREE.Mesh(new THREE.SphereGeometry(1, 12, 10), beardMat);
    tuft.position.set(x, y, z);
    tuft.scale.set(sx, sy, sz);
    parts.head.add(tuft);
  }
  parts.mouth.position.z = 0.34;
  parts.mouthOpen.position.z = 0.34;
  const tieMat = new THREE.MeshStandardMaterial({ color: 0xe3a93d, roughness: 0.72, side: THREE.DoubleSide });
  const blade = new THREE.Shape();
  blade.moveTo(-0.028, 0.49);
  blade.lineTo(0.028, 0.49);
  blade.lineTo(0.041, 0.33);
  blade.lineTo(0, 0.27);
  blade.lineTo(-0.041, 0.33);
  blade.closePath();
  const tie = new THREE.Mesh(new THREE.ShapeGeometry(blade), tieMat);
  tie.position.z = 0.257;
  parts.spine.add(tie);
  const knot = new THREE.Shape();
  knot.moveTo(-0.05, 0.57);
  knot.lineTo(0.05, 0.57);
  knot.lineTo(0.028, 0.49);
  knot.lineTo(-0.028, 0.49);
  knot.closePath();
  const knotMesh = new THREE.Mesh(new THREE.ShapeGeometry(knot), tieMat);
  knotMesh.position.z = 0.265;
  parts.spine.add(knotMesh);
  const badge = box(0.12, 0.12, 0.025, 0xf2c65d, -0.13, 0.48, 0.25);
  parts.spine.add(badge);
  parts.badge.visible = false;
  return parts;
}

function pose(parts, t, talking, phase = 0) {
  const wave = talking ? Math.sin(t * 2.8 + phase) : Math.sin(t * 0.8 + phase);
  parts.body.position.y = Math.sin(t * 2 + phase) * (talking ? 0.035 : 0.015);
  parts.spine.rotation.z = Math.sin(t * 1.3 + phase) * 0.035;
  parts.head.rotation.y = Math.sin(t * 1.4 + phase) * 0.12;
  parts.head.rotation.x = talking ? -0.08 + Math.sin(t * 2.5 + phase) * 0.045 : 0;
  parts.armL.rotation.z = -0.3;
  parts.armR.rotation.z = talking ? -0.8 - wave * 0.28 : -0.35;
  parts.armR.rotation.x = talking ? -0.65 : -0.12;
  parts.elbowR.rotation.x = talking ? -0.55 - wave * 0.18 : -0.3;
  parts.mouthOpen.visible = talking && Math.sin(t * 11 + phase) > -0.08;
  parts.mouth.visible = !parts.mouthOpen.visible;
}

// A game-owned town character. Provider linkage is a player choice, never an observed agent session.
export class MayorCharacter {
  constructor(commons) {
    this.commons = commons;
    this.world = makeMayor(1);
    this.world.root.position.copy(OUTSIDE);
    this.hallStatus = null;
    this.routeIndex = -1;
    this.seatBlend = 0;
    this.world.root.add(buildContactShadow(0.42));
    this.world.root.traverse(o => { o.userData.mayor = true; });
    commons.group.add(this.world.root);

    const labelEl = document.createElement('button');
    labelEl.type = 'button';
    labelEl.className = 'mayor-world-label';
    labelEl.dataset.mayorWorld = '';
    labelEl.textContent = 'Mayor Martin';
    this.label = new CSS2DObject(labelEl);
    this.label.position.y = 2.4;
    this.world.root.add(this.label);

    this.portrait = makeMayor(1);
    this.portraitScene = new THREE.Scene();
    this.portraitScene.add(this.portrait.root);
    this.portraitScene.add(new THREE.HemisphereLight(0xffffff, 0x647987, 2.4));
    const key = new THREE.DirectionalLight(0xffe8c3, 2.5);
    key.position.set(-2, 4, 5);
    this.portraitScene.add(key);
    this.portraitCamera = new THREE.PerspectiveCamera(28, 1, 0.1, 20);
    this.portraitCamera.position.set(0, 1.78, 3.4);
    this.portraitCamera.lookAt(0, 1.78, 0);
    this.renderer = new THREE.WebGLRenderer({ alpha: true, antialias: true, powerPreference: 'low-power' });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.5));
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.domElement.className = 'mayor-character';
    this.renderer.domElement.setAttribute('aria-hidden', 'true');
    this.renderer.domElement.style.pointerEvents = 'none';
    this.lastWidth = 0;
    this.lastHeight = 0;
  }

  attachPortrait(dialog) { dialog.append(this.renderer.domElement); }

  setConnection(provider) {
    const color = provider === 'claude' ? 0xd97745 : provider === 'codex' ? 0x45a987 : null;
    for (const parts of [this.world, this.portrait]) {
      parts.badge.visible = color != null;
      if (color != null) parts.badge.material.color.setHex(color);
    }
    this.label.element.title = provider ? `Mayor Martin · ${provider === 'claude' ? 'Claude Code' : 'Codex'} connected` : 'Mayor Martin · town guide';
  }

  setTownHallStatus(status) {
    if (status === this.hallStatus) return;
    const previous = this.hallStatus;
    this.hallStatus = status;
    if (status !== 'built') {
      this.routeIndex = -1;
      this.seatBlend = 0;
      this.world.root.position.copy(OUTSIDE);
      this.world.root.rotation.y = 0;
      this.commons.doorOpen = false;
    } else if (previous === null) {
      this.routeIndex = OFFICE_ROUTE.length;
      this.seatBlend = 1;
      this.world.root.position.copy(OFFICE_SEAT);
      this.world.root.rotation.y = 0;
    } else {
      this.routeIndex = 0;
      this.seatBlend = 0;
      this.world.root.position.copy(OUTSIDE);
    }
  }

  update(t, talking, dt = 0) {
    const walking = this.routeIndex >= 0 && this.routeIndex < OFFICE_ROUTE.length;
    if (walking) {
      let travel = dt * 2.1;
      while (travel > 0 && this.routeIndex < OFFICE_ROUTE.length) {
        const [x, z] = OFFICE_ROUTE[this.routeIndex];
        const dx = x - this.world.root.position.x;
        const dz = z - this.world.root.position.z;
        const distance = Math.hypot(dx, dz);
        if (distance < 0.001) { this.routeIndex++; continue; }
        const step = Math.min(distance, travel);
        this.world.root.position.x += dx / distance * step;
        this.world.root.position.z += dz / distance * step;
        this.world.root.rotation.y = Math.atan2(dx, dz);
        travel -= step;
        if (step === distance) this.routeIndex++;
      }
      this.world.root.position.y = THREE.MathUtils.lerp(0.12, 0.35, THREE.MathUtils.clamp((-this.world.root.position.z - 9.5) / 2, 0, 1));
    }
    this.commons.doorOpen = walking && this.world.root.position.z < -8.5 && this.world.root.position.z > -12.5;
    const sitting = this.hallStatus === 'built' && !walking;
    this.seatBlend += ((sitting ? 1 : 0) - this.seatBlend) * (1 - Math.exp(-dt * 5));
    pose(this.world, t, talking && !walking && !sitting, 0);
    if (walking) {
      const step = Math.sin(t * 9);
      this.world.body.position.y = Math.abs(step) * 0.055;
      this.world.legL.rotation.x = step * 0.5;
      this.world.legR.rotation.x = -step * 0.5;
      this.world.armL.rotation.x = -step * 0.3;
      this.world.armR.rotation.x = step * 0.3;
    } else {
      this.world.legL.rotation.x = THREE.MathUtils.lerp(this.world.legL.rotation.x, -Math.PI / 2 * this.seatBlend, 1 - Math.exp(-dt * 10));
      this.world.legR.rotation.x = THREE.MathUtils.lerp(this.world.legR.rotation.x, -Math.PI / 2 * this.seatBlend, 1 - Math.exp(-dt * 10));
      this.world.kneeL.rotation.x = this.world.kneeR.rotation.x = Math.PI / 2 * this.seatBlend;
      this.world.body.position.y -= 0.42 * this.seatBlend;
      if (sitting) {
        this.world.root.rotation.y += (0 - this.world.root.rotation.y) * (1 - Math.exp(-dt * 6));
        this.world.armL.rotation.x = this.world.armR.rotation.x = -0.45;
      }
    }
    this.label.position.y = THREE.MathUtils.lerp(2.4, 1.95, this.seatBlend);
    if (!talking) return;
    pose(this.portrait, t, true, 0);
    const canvas = this.renderer.domElement;
    const w = Math.round(canvas.clientWidth);
    const h = Math.round(canvas.clientHeight);
    if (!w || !h) return;
    if (w !== this.lastWidth || h !== this.lastHeight) {
      this.renderer.setSize(w, h, false);
      this.portraitCamera.aspect = w / h;
      this.portraitCamera.updateProjectionMatrix();
      this.lastWidth = w;
      this.lastHeight = h;
    }
    this.renderer.render(this.portraitScene, this.portraitCamera);
  }
}
