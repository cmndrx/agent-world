// Venue visits (town simulation, docs/TOWN_SIM_PLAN.md Phase 5): every so often, one idle ground-floor resident whose
// home has a venue meeting one of their interests walks there along the streets, stays a while and walks home.
// Flavor only: nothing is saved, nothing is rewarded, and observed work always brings the resident back at once
// (Sim.decide). Night keeps everyone home. Venue signs show how many residents are visiting.
import { VISIT_RULES, chooseVisit } from '../../shared/venue-visits.mjs';
import { PUBLIC_BUILDINGS, civicTransform, tileCenter, worldToLocal } from '../../shared/town.mjs';

/** A point in a public building's frame (x across its front, z towards its street) → world. */
function buildingPoint(t, lx, lz) {
  const c = Math.cos(t.yaw), s = Math.sin(t.yaw);
  return { x: t.x + lx * c + lz * s, z: t.z - lx * s + lz * c };
}

/** Lot-local waypoints out to the venue and back for a resident of `home`. */
export function visitWaypoints(home, building, route, spread = 0) {
  const local = (p) => worldToLocal(home, p.x, p.z);
  const t = civicTransform(building);
  const front = buildingPoint(t, t.doorX + spread, t.D / 2 + 1);
  const stand = buildingPoint(t, t.doorX + spread, t.D / 2 - 2.5);
  // Out of the gate onto the street in front of the home (lot-local z 12 is that street's middle), then tile by tile.
  const streets = route.slice(1).map(({ i, j }) => local(tileCenter(i, j)));
  const out = [{ x: 0, z: 8.6 }, { x: 0, z: 12 }, ...streets, local(front), local(stand)];
  const back = [...out.slice(0, -1)].reverse();
  const centre = local({ x: t.x, z: t.z }), at = out.at(-1);
  return { out, back, face: Math.atan2(centre.x - at.x, centre.z - at.z) };
}

export class VenueVisits {
  /**
   * @param {object} o
   * @param {() => object} o.town
   * @param {() => Map<string, object>} o.satisfaction home satisfaction by project
   * @param {() => Iterable<object>} o.sims every Sim
   * @param {() => boolean} o.night
   * @param {{ setVisitors(kind: string, n: number): void }} o.civic
   */
  constructor(o) {
    Object.assign(this, o);
    this.lastVisit = new Map(); // resident id → when they got home (ms); in memory only
    this.nextCheck = 0;
    this.counts = new Map();
  }

  update(now = Date.now()) {
    const sims = [...this.sims()].filter((s) => s.character && !s.isVisitor);
    if (now >= this.nextCheck) {
      this.nextCheck = now + VISIT_RULES.checkEveryMs;
      this.consider(sims, now);
    }
    // Visitor counts on venue signs (only residents actually there).
    const counts = new Map();
    for (const s of sims) if (s.visit?.phase === 'stay') counts.set(s.visit.venue, (counts.get(s.visit.venue) || 0) + 1);
    for (const kind of new Set([...counts.keys(), ...this.counts.keys()])) {
      if ((counts.get(kind) || 0) !== (this.counts.get(kind) || 0)) this.civic.setVisitors(kind, counts.get(kind) || 0);
    }
    this.counts = counts;
  }

  consider(sims, now) {
    const town = this.town();
    const residents = sims.map((s) => ({
      project: s.lot.project, id: s.character.id, away: !!s.visit, groundFloor: !s.floor,
      idle: !s.truthTarget() && !s.leaving && s.placed && s.observationConnected !== false && !s.clickReaction?.active,
    }));
    const plan = chooseVisit({ town, satisfaction: this.satisfaction(), residents, lastVisit: this.lastVisit, now, night: this.night() });
    if (!plan) return;
    const sim = sims.find((s) => s.lot.project === plan.project && s.character.id === plan.residentId);
    const home = town.homes.find((h) => h.project === plan.project);
    const building = (town.civic || []).find((c) => c.kind === plan.venue);
    if (!sim || !home || !building) return;
    const spread = ((sim.hash % 3) - 1) * 1.4; // two visitors don't stand on one spot
    const ways = visitWaypoints(home, building, plan.route, spread);
    sim.onVisitEnd = (s) => { this.lastVisit.set(s.character.id, Date.now()); s.onVisitEnd = null; };
    sim.startVisit({ venue: plan.venue, label: PUBLIC_BUILDINGS[plan.venue].name.toLowerCase(), stayMs: plan.stayMs, ...ways });
  }
}
