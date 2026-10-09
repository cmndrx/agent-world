// Street life (simulation layer, made up): while a resident's agent is off duty, they sometimes walk down to
// their workplace downtown, spend a little while there, and walk home. It never happens while a session is
// attached: the moment their agent starts (or you select them), the walk ends and the real Sim is back home.

import * as THREE from 'three';
import { CSS2DObject } from 'three/addons/renderers/CSS2DRenderer.js';
import { BUSINESSES, businessStage } from '../../shared/city.mjs';
import { LOT_D } from './lot.js';
import { buildContactShadow, buildPerson } from './models.js';
import { escapeHtml as esc } from './sim.js';

const SPEED = 1.45; // m/s, an easy stroll
/** "coworking space" mid-sentence, but keep acronyms ("QA lab"). */
const MAX_TRIPS = 4;
const EAST_GAP_X = 64; // the gap between the last home column and downtown
const SIDEWALK = LOT_D / 2 - 3.4; // lot-side sidewalk, relative to a row's center

export class StreetLife {
  /**
   * @param {THREE.Scene} scene
   * @param {{ downtown: import('./downtown.js').Downtown }} o
   */
  constructor(scene, { downtown }) {
    this.scene = scene;
    this.downtown = downtown;
    this.trips = new Map(); // sim key -> trip
    this.restUntil = new Map(); // sim key -> time before they can go again
    this.offSince = new Map(); // sim key -> when they were last seen off duty and dozing
    this.enabled = true;
  }

  /** Waypoints from a home's front door to a business door (world coordinates). */
  route(lot, business) {
    const door = this.downtown.positionOf(business);
    if (!door) return null;
    const p = lot.group.position;
    const walk = p.z + SIDEWALK;
    const main = SIDEWALK; // row 0's lot-side sidewalk, where downtown fronts
    const pts = [lot.toWorld(0, 6.4), new THREE.Vector3(p.x, 0, walk)];
    if (p.z > 1) pts.push(new THREE.Vector3(EAST_GAP_X, 0, walk), new THREE.Vector3(EAST_GAP_X, 0, main));
    pts.push(new THREE.Vector3(door.x, 0, main), new THREE.Vector3(door.x, 0, 5.7));
    for (const v of pts) v.y = 0.12;
    return pts;
  }

  start(sim, business, t) {
    const pts = this.route(sim.lot, business);
    if (!pts) return;
    const parts = buildPerson(sim.look, {});
    parts.root.add(buildContactShadow(0.42));
    parts.root.position.copy(pts[0]);
    const el = document.createElement('div');
    el.className = 'street-tag';
    el.innerHTML = `<div class="street-tag-pill"><b>${esc(sim.character.name)}</b><span>Traveling</span></div>`;
    const label = new CSS2DObject(el);
    label.position.y = 2.35; // just above the head; the pill sits on this point, not centered over the walker
    parts.root.add(label);
    this.scene.add(parts.root);
    const legs = pts.slice(1).map((p, i) => p.distanceTo(pts[i]));
    this.trips.set(sim.key, { sim, business, pts, legs, total: legs.reduce((a, b) => a + b, 0), d: 0, dir: 1, phase: 'out', stayUntil: 0, parts, el, label, t0: t });
    sim.root.visible = false;
  }

  end(key, t) {
    const trip = this.trips.get(key);
    if (!trip) return;
    trip.label.removeFromParent();
    trip.el.remove();
    this.scene.remove(trip.parts.root);
    trip.parts.root.traverse((o) => o.isMesh && o.geometry.dispose());
    trip.sim.root.visible = true;
    this.trips.delete(key);
    this.restUntil.set(key, t + 150 + Math.random() * 150);
  }

  /** Position along the route at distance d (0 … total); also returns the heading. */
  at(trip, d) {
    let rest = d;
    for (let i = 0; i < trip.legs.length; i++) {
      if (rest <= trip.legs[i] || i === trip.legs.length - 1) {
        const a = trip.pts[i];
        const b = trip.pts[i + 1];
        const k = trip.legs[i] ? Math.min(1, rest / trip.legs[i]) : 1;
        return { pos: a.clone().lerp(b, k), dx: b.x - a.x, dz: b.z - a.z };
      }
      rest -= trip.legs[i];
    }
    return { pos: trip.pts.at(-1).clone(), dx: 0, dz: -1 };
  }

  /**
   * @param {Iterable<import('./sim.js').Sim>} sims
   * @param {object} city the city ledger (shared/city.mjs)
   * @param {THREE.Vector3} focus camera focus, for label fading
   */
  update(dt, t, sims, city, focus) {
    // End trips the moment truth needs the Sim at home (a session attached) or you pick them.
    for (const [key, trip] of this.trips) {
      const s = trip.sim;
      if (!this.enabled || s.gone || s.state !== 'off_duty' || s.selected || businessStage(city, trip.business) < 3) this.end(key, t);
    }
    if (!this.enabled) return;

    // Maybe start a trip: off-duty residents with an open workplace, who have dozed for a while.
    for (const s of sims) {
      if (!s.character || this.trips.has(s.key)) continue;
      if (s.state !== 'off_duty' || s.selected || s.hovered) {
        this.offSince.delete(s.key);
        continue;
      }
      if (!this.offSince.has(s.key)) this.offSince.set(s.key, t);
      const business = s.roleInfo?.business;
      if (!business || businessStage(city, business) < 3) continue;
      if (this.trips.size >= MAX_TRIPS || t < (this.restUntil.get(s.key) ?? 0) || t - this.offSince.get(s.key) < 40) continue;
      if (Math.random() < dt / 70) this.start(s, business, t);
    }

    for (const [key, trip] of this.trips) {
      const root = trip.parts.root;
      const p = trip.parts;
      let moving = true;
      if (trip.phase === 'stay') {
        moving = false;
        if (t > trip.stayUntil) {
          trip.phase = 'back';
          trip.dir = -1;
          trip.el.querySelector('span').textContent = 'Traveling';
        }
      } else {
        trip.d += trip.dir * SPEED * dt;
        if (trip.phase === 'out' && trip.d >= trip.total) {
          trip.d = trip.total;
          trip.phase = 'stay';
          trip.stayUntil = t + 45 + Math.random() * 50;
          trip.el.querySelector('span').textContent = 'Off duty';
        } else if (trip.phase === 'back' && trip.d <= 0) {
          this.end(key, t);
          continue;
        }
      }
      const { pos, dx, dz } = this.at(trip, Math.max(0, Math.min(trip.total, trip.d)));
      root.position.copy(pos);
      const heading = moving ? Math.atan2(dx * trip.dir, dz * trip.dir) : Math.PI; // at work: face the door
      root.rotation.y += (((heading - root.rotation.y + Math.PI * 3) % (Math.PI * 2)) - Math.PI) * Math.min(1, dt * 8);
      // A simple walk cycle (or a relaxed idle at the door).
      const ph = (t - trip.t0) * 7.5;
      const swing = moving ? Math.sin(ph) : 0;
      p.legL.rotation.x = swing * 0.55;
      p.legR.rotation.x = -swing * 0.55;
      p.kneeL.rotation.x = moving ? Math.max(0, -Math.sin(ph)) * 0.6 : 0;
      p.kneeR.rotation.x = moving ? Math.max(0, Math.sin(ph)) * 0.6 : 0;
      p.armL.rotation.set(-swing * 0.45, 0, 0.08);
      p.armR.rotation.set(swing * 0.45, 0, -0.08);
      p.body.position.y = moving ? Math.abs(Math.cos(ph)) * 0.04 : Math.sin(t * 1.5) * 0.008;
      trip.el.classList.toggle('far', root.position.distanceTo(focus) > 38);
    }
  }
}
