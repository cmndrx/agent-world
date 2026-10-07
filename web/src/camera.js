// The map camera. There's no walking avatar: you look around like a city builder.
// Left-drag grabs the ground and pans, right/middle-drag turns and tilts, the wheel zooms,
// WASD/arrows pan and Q/E turn. It only observes; nothing here can affect agents.

import * as THREE from 'three';

const DRAG_THRESHOLD = 5; // px before a press becomes a pan instead of a click
const ground = new THREE.Plane(new THREE.Vector3(0, 1, 0), -0.12);

export class CameraRig {
  /**
   * @param {THREE.PerspectiveCamera} camera
   * @param {HTMLElement} dom
   * @param {{ panTarget: () => THREE.Vector3 }} o which focus vector panning moves (it changes with the mode)
   */
  constructor(camera, dom, { panTarget }) {
    this.camera = camera;
    this.dom = dom;
    this.panTarget = panTarget;
    this.yaw = Math.PI / 4;
    this.yawTarget = this.yaw;
    this.pitch = 0.85;
    this.distance = 22;
    this.distanceTarget = 22;
    this.maxDistance = 60;
    this.target = new THREE.Vector3();
    this.fly = null;
    this.keys = new Set();
    this.vel = new THREE.Vector3(); // glide after letting go of a pan
    this.suppressClick = false;
    this.raycaster = new THREE.Raycaster();

    addEventListener('keydown', (e) => {
      if (e.target.closest?.('input, textarea, select, dialog')) return;
      this.keys.add(e.key.toLowerCase());
      if (e.key === 'q' || e.key === 'Q') this.yawTarget -= Math.PI / 4;
      if (e.key === 'e' || e.key === 'E') this.yawTarget += Math.PI / 4;
    });
    addEventListener('keyup', (e) => this.keys.delete(e.key.toLowerCase()));
    addEventListener('blur', () => this.keys.clear());

    let drag = null;
    dom.addEventListener('contextmenu', (e) => e.preventDefault());
    dom.addEventListener('pointerdown', (e) => {
      if (e.button === 1 || e.button === 2) drag = { kind: 'turn', x: e.clientX, y: e.clientY };
      else if (e.button === 0 && this.enabled !== false) drag = { kind: 'pan', x: e.clientX, y: e.clientY, live: false, grab: null };
      e.preventDefault(); // dragging the map never selects page text
      this.vel.set(0, 0, 0);
    });
    addEventListener('pointermove', (e) => {
      if (!drag) return;
      if (drag.kind === 'turn') {
        this.yawTarget -= (e.clientX - drag.x) * 0.006;
        this.pitch = THREE.MathUtils.clamp(this.pitch + (e.clientY - drag.y) * 0.004, 0.35, 1.38);
        drag.x = e.clientX;
        drag.y = e.clientY;
        return;
      }
      if (!drag.live) {
        if (Math.hypot(e.clientX - drag.x, e.clientY - drag.y) < DRAG_THRESHOLD) return;
        drag.live = true;
        drag.focus = this.panTarget();
        this.cancelFly();
        drag.focus.copy(this.target); // start from exactly what's on screen
        this.place();
        drag.grab = this.groundAt(drag.x, drag.y);
        dom.classList.add('panning');
      }
      // Keep the grabbed spot of ground under the pointer.
      const now = this.groundAt(e.clientX, e.clientY);
      if (!drag.grab || !now) return;
      const delta = drag.grab.clone().sub(now);
      delta.y = 0;
      const dt = Math.max(1 / 240, (e.timeStamp - (drag.t || e.timeStamp - 16)) / 1000);
      drag.t = e.timeStamp;
      this.vel.lerp(delta.clone().divideScalar(Math.max(dt, 1 / 60)), 0.5);
      drag.focus.add(delta);
      this.target.add(delta);
      this.panned = true;
      this.place();
    });
    addEventListener('pointerup', (e) => {
      // Only a flick (still moving when let go) coasts.
      if (drag?.live && e.timeStamp - (drag.t || 0) > 80) this.vel.set(0, 0, 0);
      if (drag?.live) {
        this.suppressClick = true; // the click that follows a pan isn't a selection
        setTimeout(() => (this.suppressClick = false), 0);
        dom.classList.remove('panning');
        this.coast = drag.focus;
        if (this.vel.length() > 25) this.vel.setLength(25);
      } else this.vel.set(0, 0, 0);
      drag = null;
    });
    dom.addEventListener('wheel', (e) => {
      e.preventDefault();
      this.distanceTarget = THREE.MathUtils.clamp(this.distanceTarget * (1 + e.deltaY * 0.001), 8, this.maxDistance);
    }, { passive: false });
  }

  /** The point on the ground under a screen position (null when looking at the sky). */
  groundAt(clientX, clientY) {
    const rect = this.dom.getBoundingClientRect();
    const ndc = new THREE.Vector2(((clientX - rect.left) / rect.width) * 2 - 1, -((clientY - rect.top) / rect.height) * 2 + 1);
    this.camera.updateMatrixWorld();
    this.raycaster.setFromCamera(ndc, this.camera);
    return this.raycaster.ray.intersectPlane(ground, new THREE.Vector3());
  }

  /** Glide the camera to a point with ease-in-out, optionally changing zoom. */
  flyTo(point, { distance = this.distanceTarget, duration = 0.9 } = {}) {
    this.vel.set(0, 0, 0);
    this.fly = { from: this.target.clone(), to: point.clone(), t: 0, duration, d0: this.distance, d1: distance };
  }

  /** Stop a glide midway (the user grabbed the map), keeping the zoom it was heading for. */
  cancelFly() {
    if (!this.fly) return;
    this.distanceTarget = this.fly.d1;
    this.fly = null;
  }

  /** WASD/arrows pan whatever the camera is looking at, faster when zoomed out. */
  keyPan(dt) {
    if (this.enabled === false) return;
    const k = this.keys;
    let fx = 0;
    let fz = 0;
    if (k.has('w') || k.has('arrowup')) fz -= 1;
    if (k.has('s') || k.has('arrowdown')) fz += 1;
    if (k.has('a') || k.has('arrowleft')) fx -= 1;
    if (k.has('d') || k.has('arrowright')) fx += 1;
    if (!fx && !fz) return;
    const focus = this.panTarget();
    const len = Math.hypot(fx, fz);
    const speed = this.distance * 0.75 * (k.has('shift') ? 2 : 1) * dt;
    const sin = Math.sin(this.yaw);
    const cos = Math.cos(this.yaw);
    if (this.fly) {
      this.cancelFly();
      focus.copy(this.target);
    }
    this.panned = true;
    focus.x += ((fx * cos + fz * sin) / len) * speed;
    focus.z += ((-fx * sin + fz * cos) / len) * speed;
  }

  update(dt, focus) {
    const smooth = (rate) => 1 - Math.exp(-dt * rate);
    this.yaw += (this.yawTarget - this.yaw) * smooth(8);
    // A little momentum after a flick-pan.
    if (this.coast && this.vel.lengthSq() > 0.01) {
      this.coast.addScaledVector(this.vel, dt);
      this.panned = true;
      this.target.addScaledVector(this.vel, dt);
      this.vel.multiplyScalar(Math.exp(-dt * 7));
    } else this.coast = null;
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
    this.place();
  }

  place() {
    const d = this.distance;
    this.camera.position.set(
      this.target.x + Math.sin(this.yaw) * Math.cos(this.pitch) * d,
      this.target.y + Math.sin(this.pitch) * d,
      this.target.z + Math.cos(this.yaw) * Math.cos(this.pitch) * d,
    );
    this.camera.lookAt(this.target.x, this.target.y + 1, this.target.z);
  }
}
