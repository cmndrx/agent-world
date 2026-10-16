import { mountedTV } from '../../shared/tv-mounts.mjs';
import { interestForActivity } from '../../shared/interest-care.mjs';
import { CARE_ACTIONS } from '../../shared/care.mjs';
import { assignedRole } from '../../shared/team.mjs';
import { CareFeedback } from './care-feedback.js';
import {canPromptFromStatus} from '../../shared/agent-view.mjs';
import { observedLabel } from '../../shared/freshness.mjs';
// A Sim: one persistent character (or a visiting sub-agent) in a lot.
//
// Truth drives *where* a Sim is, *what* is on its screen, and *how* it moves. Agent work happens at
// the computer: the activity resolver maps each tool call to a screen app and a body pose, and arm
// IK puts the hands on the keyboard and mouse. When truth leaves room (idle), the simulation layer
// picks flavor activities. Truth always interrupts flavor immediately.

import * as THREE from 'three';
import { CSS2DObject } from 'three/addons/renderers/CSS2DRenderer.js';
import { plumbobFor } from '../../shared/schema.mjs';
import { activityKey, appName, resolveActivity } from './activity.js';
import { buildLaptop } from './furniture.js';
import { icon, STATE_ICON } from './icons.js';
import { SHOULDER_X, buildContactShadow, buildPerson, buildPlumbob, lookFromSeed, PLUMBOB_COLORS, PROVIDER_COLORS } from './models.js';
import { conversationLabel } from '../../shared/conversations.mjs';
import { Screen } from './screens.js';
import { HOME_ACTIVITIES, homeActivity, planHomeActivity, overlaps } from './home-activities.js';
import { HomeActivityScene } from './home-activity-scene.js';
import { ClickReaction } from './click-reaction.js';

const SPEED = 2.5;
/** Inside the house walls (lot-local metres; the same room bounds decor placement uses), not the yard. */
const indoors = (x, z) => Math.abs(x) < 6.7 && Math.abs(z) < 4.7;
const FLOOR_Y = 0.12;
const SIT_Y = -0.42;
// The couch cushions sit higher than a desk chair seat; sitting there uses this so Sims rest on top of them.
const COUCH_Y = -0.31;

// Desk geometry in the seated Sim's local frame (+z forward, +x = the Sim's left). Matches buildDesk().
const KEYS_Y = 0.7;
const KEYS_Z = 0.54;
const DESK = {
  keysL: [0.13, KEYS_Y, KEYS_Z],
  keysR: [-0.13, KEYS_Y, KEYS_Z],
  mouse: [-0.42, KEYS_Y, KEYS_Z],
  edgeL: [0.24, KEYS_Y + 0.02, 0.4],
  lapL: [0.14, 0.56, 0.3],
  chin: [-0.03, 1.33, 0.26],
  screen: [0, 1.13, 1.03],
};
const LAPTOP_AT = [0, 1.02, 0.36];

// Generic ambient routines use actual stations, independently of assigned interests.
const FLAVOR = {
  coffee: {label:'Getting coffee · simulated',pose:'sip',station:'coffee',min:7,max:12},
  couch: {label:'Relaxing on the couch · simulated',pose:'relax',station:'couch',min:10,max:18},
  wander: {label:'Stretching their legs · simulated',pose:'look',station:'wander',min:5,max:10},
  books: {label:'Browsing the bookshelf · simulated',pose:'browse',station:'bookshelf',min:6,max:11},
  doodle: {label:'Doodling on the whiteboard · simulated',pose:'present',station:'whiteboard',min:6,max:10},
  globe: {label:'Spinning the globe · simulated',pose:'globe',station:'globe',min:5,max:9},
};

const JOINTS = ['bodyY', 'lean', 'twist', 'legL', 'legR', 'kneeL', 'kneeR', 'armLx', 'armLz', 'armRx', 'armRz', 'elbowL', 'elbowR', 'headX', 'headY', 'headZ'];

export function formatDuration(sec) {
  sec = Math.max(0, Math.floor(sec));
  if (sec < 60) return `${sec}s`;
  if (sec < 3600) return `${Math.floor(sec / 60)}m ${String(sec % 60).padStart(2, '0')}s`;
  return `${Math.floor(sec / 3600)}h ${Math.floor((sec % 3600) / 60)}m`;
}

function hashStr(s) {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (Math.imul(h, 31) + s.charCodeAt(i)) | 0;
  return h >>> 0;
}

// ---- Two-bone arm IK -----------------------------------------------------------------------

const L1 = 0.31; // shoulder → elbow
const L2 = 0.3; // elbow → hand
const clamp = THREE.MathUtils.clamp;
const _q = new THREE.Quaternion();
const _e = new THREE.Euler();
const _v = new THREE.Vector3();

/**
 * Solve shoulder/elbow angles so the hand reaches `target` (Sim-local coordinates), given the
 * spine pose already in T. Writes armLx/armLz/elbowL (side 1) or armRx/armRz/elbowR (side −1).
 */
export function armIK(T, side, target, build = 1) {
  _e.set(T.lean, T.twist, 0, 'XYZ');
  _q.setFromEuler(_e).invert();
  _v.set(target[0], target[1] - (0.9 + T.bodyY), target[2]).applyQuaternion(_q);
  _v.x -= side * SHOULDER_X * build;
  _v.y -= 0.62;
  const L = clamp(_v.length(), 0.12, L1 + L2 - 0.002);
  _v.normalize();
  const flex = Math.PI - Math.acos(clamp((L1 * L1 + L2 * L2 - L * L) / (2 * L1 * L2), -1, 1));
  const alpha = Math.acos(clamp((L1 * L1 + L * L - L2 * L2) / (2 * L1 * L), -1, 1));
  const rz = Math.asin(clamp(_v.x, -1, 1));
  const fwd = Math.atan2(_v.z, -_v.y);
  if (side === 1) {
    T.armLx = -(fwd - alpha);
    T.armLz = rz;
    T.elbowL = -flex;
  } else {
    T.armRx = -(fwd - alpha);
    T.armRz = rz;
    T.elbowR = -flex;
  }
}

const off = (p, dx = 0, dy = 0, dz = 0) => [p[0] + dx, p[1] + dy, p[2] + dz];

export class Sim {
  /**
   * @param {object} o
   * @param {string} o.key
   * @param {import('./lot.js').Lot} o.lot
   * @param {{slot:number,name:string,seed:number}|null} o.character   null for visitors
   * @param {Sim|null} o.parent   the Sim a visitor belongs to
   */
  constructor({ key, lot, character = null, parent = null, seed, arriving = false }) {
    this.key = key;
    this.clickReaction = new ClickReaction();
    this.lot = lot;
    this.character = character;
    this.careFeedback = new CareFeedback(character);
    this.parent = parent;
    this.isVisitor = !!parent;
    this.hash = hashStr(key);
    this.baseLook = lookFromSeed(seed);
    this.look = this.baseLook;
    this.lookKey = '';

    this.parts = buildPerson(this.look, this.isVisitor ? { scale: 0.8, hat: 0xf2b134 } : {});
    this.root = this.parts.root;
    this.root.add(buildContactShadow(0.42));
    lot.group.add(this.root);

    this.plumbob = buildPlumbob();
    this.plumbob.position.y = 1.85;
    this.parts.spine.add(this.plumbob);

    // Characters use their desk's monitor; visiting helpers carry a laptop.
    if (this.isVisitor) {
      this.screen = new Screen({ scale: 0.5 });
      this.laptop = buildLaptop(this.screen);
      this.laptop.position.set(...LAPTOP_AT);
      this.root.add(this.laptop);
      this.guestIndex = parent.visitors.length;
      parent.visitors.push(this);
    } else {
      this.screen = lot.desk(character.slot).screen;
    }
    this.visitors = [];
    // A helper's role comes from the parent's delegation event (e.g. "Explore").
    this.roleName = parent?.truth?.state === 'delegating' ? parent.truth.detail?.target || null : null;
    this.root.traverse((o) => (o.userData.simKey = key));

    // The anchor is positioned by CSS2DRenderer (inline transform); the bubble inside is styled freely.
    this.labelEl = document.createElement('div');
    this.labelEl.className = 'bubble-anchor';
    this.bubbleEl = document.createElement('div');
    this.bubbleEl.className = 'bubble';
    this.bubbleEl.dataset.simKey = key;
    this.labelEl.appendChild(this.bubbleEl);
    this.label = new CSS2DObject(this.labelEl);
    this.label.position.y = 3.3;
    this.root.add(this.label);
    this.labelHtml = '';

    this.joints = Object.fromEntries(JOINTS.map((j) => [j, 0]));
    this.truth = null;
    this.act = resolveActivity(null);
    this.actKey = '';
    this.actT0 = 0;
    this.activity = null; // where to stand + pose (truth- or flavor-driven)
    this.path = [];
    this.facing = 0;
    this.targetFacing = 0;
    this.arrived = true;
    this.flavorUntil = 0;
    this.cheerUntil = 0;
    this.nextBlink = 1 + Math.random() * 3;
    this.leaving = false;
    this.gone = false;
    this.expanded = false;
    this.selected = false;
    this.hovered = false;
    this.labelMode = 'full';
    this.reminded = false;
    this.needs = { energy: 0.4 + Math.random() * 0.6, fun: 0.4 + Math.random() * 0.6 };

    this.pos = new THREE.Vector2();
    // Visitors and newly recruited residents walk in through the front door; everyone else appears in place.
    this.arriving = arriving;
    // On an upper floor, arrivals step out at that floor's stairs or elevator landing.
    const start = this.isVisitor || arriving ? (this.isVisitor ? this.parent.desk() : lot.desk(character.slot)).entrance || lot.stations.entrance : null;
    if (start) this.pos.set(start.x, start.z);
    this.placed = !!start;
    this.layoutVersion = lot.layoutVersion;
  }

  get name() {
    if (this.character) return this.character.name;
    const helper = this.roleName ? `${this.roleName} helper` : 'Helper';
    // Hired helper types get a staff name; the observed helper type always stays visible.
    return this.roleInfo?.staffName ? `${this.roleInfo.staffName} · ${helper}` : helper;
  }

  /**
   * Work role (play layer, derived from kinds of observed work; shared/city.mjs): an apron in the workplace
   * color, or an intern's lanyard. `info` = { title, color, kind: 'apron'|'lanyard'|null, staffName, why, intern }.
   */
  setRole(info) {
    const key = JSON.stringify(info || null);
    if (key === this.roleKey) return;
    this.roleKey = key;
    this.roleInfo = info;
  }

  /** Truth state, or `off_duty` when no session is attached. */
  get state() {
    return this.truth ? this.truth.state : 'off_duty';
  }

  /** Human description of what the agent is doing, derived from truth. */
  get activityLabel() {
    return this.act.label;
  }

  get waitSeconds() {
    if (this.state !== 'waiting_for_user') return 0;
    return (Date.now() - Date.parse(this.truth.since)) / 1000;
  }

  setTruth(session) {
    const prevState = this.state;
    const prevAt = this.act.at;
    this.truth = session;
    if (session && !['idle','done'].includes(session.state) && this.careCheerUntil > performance.now() / 1000) {
      this.careCheerUntil = 0;
      this.popT = undefined; // observed work interrupts the care animation
    }
    if (this.isVisitor && !this.roleName && session?.detail?.target) this.roleName = session.detail.target;

    const color = PLUMBOB_COLORS[plumbobFor(this.state)];
    const m = this.plumbob.userData.material;
    m.color.setHex(color);
    m.emissive.setHex(color);

    this.applyBadge();

    // What the agent is doing → screen + pose.
    this.act = resolveActivity(session);
    const key = activityKey(this.act);
    if (key !== this.actKey) {
      this.actKey = key;
      this.actT0 = performance.now() / 1000;
    }
    this.screen.set(this.act, { project: this.lot.name, provider: session?.provider, source: session?.source, app: appName(session), conversation: session?.conversation ? conversationLabel(session.conversation) : null });

    if (this.state !== prevState || this.act.at !== prevAt) {
      if (this.state !== prevState) this.reminded = false;
      this.decide();
    }
  }

  leave() {
    this.clickReaction.cancel();
    this.stopHomeActivity();
    this.release();
    this.leaving = true;
    this.activity = { pose: 'laptop_walk', flavor: false };
    this.goTo(this.stations.entrance);
    this.parent.visitors = this.parent.visitors.filter((v) => v !== this);
  }

  // ---- Deciding where to go -------------------------------------------------

  desk() {
    const slot = this.isVisitor ? this.parent.character.slot : this.character.slot;
    return this.lot.desk(slot);
  }

  /** The floor this resident lives and works on (their desk's), 0 = ground. */
  get floor() {
    return this.desk()?.floor || 0;
  }

  /** Stations this resident can use: their floor's, reachable from their own landing. */
  get stations() {
    const d = this.desk();
    return d?.floor ? this.lot.stationsFor(d.floor, d.entrance) : this.lot.stations;
  }

  truthTarget() {
    const desk = this.desk();
    const a = this.act;
    if (a.at === 'desk') {
      if (this.isVisitor) return { spot: desk.guests[this.guestIndex % desk.guests.length], pose: 'laptop' };
      return { spot: desk.chair, pose: a.pose };
    }
    if (a.at === 'wait') return { spot: this.isVisitor ? desk.visitorWait : desk.wait, pose: a.pose };
    return null; // idle or off duty: room for explicitly simulated home scenes
  }

  // ---- Spot reservations: one Sim per seat or standing spot -------------------

  /** Who holds a spot in this lot (lot.claims maps spot object → Sim). */
  holder(spot) {
    const h = (this.lot.claims ??= new Map()).get(spot);
    if(h && h!==this && !h.gone)return h;
    for(const [sim,p] of this.lot.homeActivityClaims || [])if(sim!==this && !sim.gone && p.floor===this.floor && spot.x>p.rect[0] && spot.x<p.rect[2] && spot.z>p.rect[1] && spot.z<p.rect[3])return sim;
    return null;
  }

  claim(spot) {
    this.release();
    this.lot.claims.set(spot, this);
    this.claimed = spot;
  }

  release() {
    if (this.claimed && this.lot.claims?.get(this.claimed) === this) this.lot.claims.delete(this.claimed);
    this.claimed = null;
  }

  /** A free spot from a list (random by default), or null. */
  freeSpot(spots, pick = 'random') {
    const free = spots.filter((s) => !this.holder(s));
    if (!free.length) return null;
    return pick === 'random' ? free[Math.floor(Math.random() * free.length)] : free[0];
  }

  /** Wander spots inside the house (the yard's strolling spots left out). */
  indoorWander() {
    return this.stations.wander.filter((s) => !s.yard && indoors(s.x, s.z));
  }

  /**
   * Somewhere to just stand when every station is taken: the nearest free nav cell around a point,
   * kept a body-width away from everyone else in the lot.
   */
  standingSpot(near, inside = false) {
    const nav = this.lot.getNav(this.floor);
    const others = [...(this.lot.claims?.entries() || [])].filter(([, h]) => h !== this && !h.gone).map(([s]) => s);
    for (let r = 0; r < 8; r++) {
      for (let k = 0; k < 8; k++) {
        const a = (k / 8) * Math.PI * 2 + r;
        const x = near.x + Math.cos(a) * (0.9 + r * 0.45);
        const z = near.z + Math.sin(a) * (0.9 + r * 0.45);
        if (!nav.walkable(x, z) || (inside && !indoors(x, z))) continue;
        if (others.some((o) => Math.hypot(o.x - x, o.z - z) < 0.85)) continue;
        return { x, z, face: near.face ?? 0, adHoc: true };
      }
    }
    return { x: this.pos.x, z: this.pos.y, face: this.facing, adHoc: true };
  }

  decide() {
    if (this.leaving) return;
    this.stopHomeActivity();
    const care = this.character?.care?.pending;
    const canCare = care && (!this.truth || ['idle','done'].includes(this.state));
    const target = this.truthTarget();
    if (!target && canCare) {
      if (this.startHomeActivity(CARE_ACTIONS[care.action]?.activityId, care)) return;
      this.careError = 'Care cancelled: the reserved station or its approach is blocked.';
      this.activity = {spot:this.standingSpot(this.desk().chair),pose:'stand',careId:care.id,flavor:false};
      this.cancelBlockedCare(care);
    } else
    if (target) {
      // Real work and off-duty spots take priority: an idle Sim relaxing there moves on.
      const holder = this.holder(target.spot);
      if (holder && holder.activity?.flavor) {
        this.claim(target.spot); // take it first, so the displaced Sim can't pick it again
        holder.claimed = null;
        holder.decide();
      } else if (holder) {
        // Two truth targets on one spot (e.g. off-duty Sims sharing a wander point): find another.
        const offDuty = this.state === 'off_duty';
        const alt = this.freeSpot(offDuty ? this.indoorWander() : this.stations.wander) || this.standingSpot(target.spot, offDuty);
        target.spot = alt;
        if (target.pose === 'doze') target.pose = 'doze_stand';
      }
      this.activity = { ...target, flavor: false };
    } else if (this.isVisitor) {
      const guests = this.desk().guests;
      const spot = [guests[this.guestIndex % 3], ...guests].find((g) => !this.holder(g)) || this.standingSpot(guests[0]);
      this.activity = { spot, pose: 'laptop', flavor: false };
    } else {
      // Alternate families; rotate within each. A permanently eligible interest cannot
      // starve coffee/globe, and a plentiful generic station cannot starve interests.
      this.preferInterest = !this.preferInterest;
      if (this.preferInterest && this.startInterestActivity()) return;
      if (this.startAmbientActivity()) { /* claimed and routed below */ }
      else if (this.startInterestActivity()) return;
      else {
      this.homeUnavailable = 'Home activities unavailable due to space · simulated';
      const spot=this.freeSpot(this.indoorWander()) || this.standingSpot(this.desk().chair,true);
      this.activity={spot,pose:'stand',flavor:true,label:this.homeUnavailable,kind:'wander'};
      this.flavorUntil=performance.now()/1000+8;
      }
    }
    this.claim(this.activity.spot);
    if (!this.placed) {
      // First placement after load: appear in place rather than walking in.
      const s = this.activity.spot;
      this.pos.set(s.x, s.z);
      this.facing = this.targetFacing = s.face;
      this.path = [];
      this.arrived = true;
      this.placed = true;
      return;
    }
    this.goTo(this.activity.spot);
  }

  startInterestActivity() {
    const start = (this.homeCursor ??= this.hash % HOME_ACTIVITIES.length);
    for (let i=0;i<HOME_ACTIVITIES.length;i++) {
      const index=(start+i)%HOME_ACTIVITIES.length, id=HOME_ACTIVITIES[index].id;
      if (!this.character.interestIds?.includes(interestForActivity(id))) continue;
      if (this.startHomeActivity(id)) { this.homeCursor=(index+1)%HOME_ACTIVITIES.length; return true; }
    }
    return false;
  }

  startAmbientActivity() {
    const kinds=Object.keys(FLAVOR), start=(this.ambientCursor ??= this.hash % kinds.length);
    const nav=this.lot.getNav(this.floor,this), from={x:this.pos.x,z:this.pos.y}, seen=nav.reachableFrom(from);
    for(let i=0;i<kinds.length;i++) {
      const index=(start+i)%kinds.length,kind=kinds[index],f=FLAVOR[kind];
      const spot=this.freeSpot((this.stations[f.station] || []).filter(s=>{
        const cell=nav.nearestFree(...nav.toCell(s.x,s.z),2);
        return cell && seen[cell[1]*nav.w+cell[0]];
      }));
      if(!spot)continue;
      this.ambientCursor=(index+1)%kinds.length;
      this.activity={spot,pose:f.pose,flavor:true,label:f.label,kind};
      this.flavorUntil=performance.now()/1000+f.min+Math.random()*(f.max-f.min);
      return true;
    }
    return false;
  }

  goTo(spot) {
    const path = this.lot.getNav(this.floor, this).findPath({ x: this.pos.x, z: this.pos.y }, spot);
    path[path.length - 1].face = spot.face;
    this.path = path;
    this.arrived = false;
  }

  stopHomeActivity() {
    const hadScene=!!this.homeScene;
    this.homeScene?.dispose();
    this.homeScene = null;
    this.homePlan = null;
    this.lot.homeActivityClaims?.delete(this);
    this.homeUnavailable=null;
    if(hadScene && this.joints)for(const key of JOINTS)this.joints[key]=0;
    if (this.parts) { this.parts.body.rotation.x = 0; this.parts.body.position.z = 0; }
  }

  /** Simulation only; intentionally has no API/persistence/reward effect. Observed work always wins. */
  startHomeActivity(id, care = null) {
    if (this.isVisitor || this.leaving || (this.truth && !['idle','done'].includes(this.state)) || (this.character?.care?.pending && !care)) return false;
    if (!homeActivity(id)) return false;
    let floor = this.lot.building?.floors[this.floor];
    if (!floor) return false;
    if(!this.floor) floor={...floor,items:[...(this.lot.homeActivityItems || floor.items),...this.lot.decor.items.flatMap(d=>{const m=d.item==='fireplace_tv'?mountedTV(d,floor.items):null;if(d.item==='fireplace_tv'&&!m)return [];return [{kind:m?'television':d.item,x:m?.screenX??d.x,z:m?.screenZ??d.z,facing:m?.facing || ['s','w','n','e'][d.rot],floor:0}];})]};
    // Player care owns its server-reserved envelope ahead of passive simulation.
    if(care?.plan) for(const [sim,p] of [...(this.lot.homeActivityClaims || [])]) {
      if(sim!==this && p.floor===this.floor && sim.activity?.flavor && overlaps(p.rect,care.plan.rect)) {
        sim.stopHomeActivity();sim.release();sim.activity=null;sim.path=[];
      }
    }
    if(care?.plan) for(const [spot,sim] of [...(this.lot.claims || [])]) {
      if(sim!==this && sim.floor===this.floor && sim.activity?.flavor && overlaps([spot.x-.45,spot.z-.45,spot.x+.45,spot.z+.45],care.plan.rect)) {
        sim.stopHomeActivity();sim.release();sim.activity=null;sim.path=[];
      }
    }
    const nav = this.lot.getNav(this.floor,this);
    const protectedSpots = (this.lot.desks || []).filter(d=>(d.floor || 0)===this.floor)
      .flatMap(d=>[d.chair,d.wait,d.visitorWait,...d.guests,d.entrance].filter(Boolean));
    const occupied = [...(this.lot.claims || [])].filter(([,h])=>h!==this && !h.gone && h.floor===this.floor)
      .map(([s])=>[s.x-.45,s.z-.45,s.x+.45,s.z+.45]);
    if(!this.floor)occupied.push(...this.lot.decor.obstacles);
    for (const [sim,p] of this.lot.homeActivityClaims || []) if(sim!==this && p.floor===this.floor) occupied.push(p.rect);
    const from=this.placed?{x:this.pos.x,z:this.pos.y}:this.desk().entrance || floor.stations.entrance;
    const solidRects=this.floor ? floor.obstacles : [...this.obstaclesForHomeActivity()];
    const plan=care?.plan || planHomeActivity({id,floor,nav,from,pet:this.lot.pet?.kind,protectedSpots,occupied,solidRects});
    if (!plan) return false;
    const [pi,pj]=nav.toCell(plan.spot.x,plan.spot.z);
    if(care && (care.floor!==this.floor || this.holder(plan.spot) || occupied.some(r=>overlaps(r,plan.rect)) || !nav.walkable(plan.spot.x,plan.spot.z) || !nav.reachableFrom(from)[pj*nav.w+pi])) return false;
    this.stopHomeActivity();this.release();
    this.homeUnavailable=null;this.homePlan=plan;
    (this.lot.homeActivityClaims ??= new Map()).set(this,{...plan,floor:this.floor});
    this.activity={spot:plan.spot,pose:'home',homeId:id,flavor:!care,careId:care?.id,label:plan.def.label,kind:id};
    this.claim(plan.spot);
    this.flavorUntil=Infinity; // duration starts on arrival, not while walking
    if(!this.placed){this.pos.set(from.x,from.z);this.placed=true;}
    this.goTo(plan.spot);
    return true;
  }

  obstaclesForHomeActivity() {
    return [...this.lot.obstacles,...this.lot.levelObstacles,...this.lot.deskBlocks,...this.lot.decor.obstacles];
  }

  // ---- Per frame ------------------------------------------------------------

  update(dt, t) {
    if (this.layoutVersion !== this.lot.layoutVersion) {
      this.layoutVersion = this.lot.layoutVersion;
      this.clickReaction.cancel();this.staleReactionRestore=0;
      this.stopHomeActivity();this.release();this.activity=null;this.path=[];this.placed=false;
    }
    if(this.clickReaction.active){this.staleReactionRestore=1;this.staleClickBase=this.clickReaction.active.baseJoints;this.staleClickYaw=this.clickReaction.active.baseYaw;}
    this.clickReaction.tick(dt,this);
    if(this.observationConnected===false && (this.character?.care?.pending || this.activity?.careId)) {
      // Offline scenes cannot earn progress or keep a household station locked.
      // The bridge owns expiry/restart cancellation; never send an offline reward.
      this.stopHomeActivity();this.release();this.activity=null;this.path=[];
      if(!this.truth){this.updateLabel();return;}
    }
    if (this.truth && this.observationConnected === false) {
      this.plumbob.userData.material.color.setHex(0x9299a5);this.plumbob.userData.material.emissive.setHex(0x9299a5);this.plumbob.userData.material.emissiveIntensity=.25;
      if(this.staleReactionRestore>0){
        this.staleReactionRestore-=dt;this.root.rotation.y=this.staleClickYaw??this.facing;
        const pose=this.currentPose(false,performance.now()/1000);this.animate(pose,t,dt);
        if(pose==='home')this.homeScene?.update(0,matchMedia('(prefers-reduced-motion: reduce)').matches);
      }
      this.updateLabel();return;
    }
    if (!this.activity) this.decide();
    const careId = this.character?.care?.pending?.id;
    if ((this.activity?.careId || null) !== (careId && (!this.truth || ['idle','done'].includes(this.state)) ? careId : null)) this.decide();
    const now = performance.now() / 1000;
    this.needs.energy = Math.max(0, this.needs.energy - dt * 0.012);
    this.needs.fun = Math.max(0, this.needs.fun - dt * 0.009);

    if (!this.clickReaction.active && this.activity?.flavor && this.arrived && now > this.flavorUntil) {
      if (this.activity.kind === 'coffee') this.needs.energy = 1;
      if (this.activity.kind === 'couch') this.needs.fun = 1;
      this.decide();
    }

    // Movement along the path.
    let step = SPEED * (this.leaving ? 1.3 : 1) * dt;
    if(this.clickReaction.active?.kind==='friendly')step=0;
    while (step > 0 && this.path.length) {
      const wp = this.path[0];
      const dx = wp.x - this.pos.x;
      const dz = wp.z - this.pos.y;
      const dist = Math.hypot(dx, dz);
      if (dist > 0.001) this.targetFacing = Math.atan2(dx, dz);
      if (dist <= step) {
        this.pos.set(wp.x, wp.z);
        step -= dist;
        if (wp.face !== undefined) this.targetFacing = wp.face;
        this.path.shift();
      } else {
        this.pos.x += (dx / dist) * step;
        this.pos.y += (dz / dist) * step;
        step = 0;
      }
    }
    const walking = this.path.length > 0;
    this.walking = walking;
    if (!walking && !this.arrived) {
      this.arrived = true;
      if (this.leaving) this.gone = true;
      if (this.arriving) {
        // Made it in: a happy hop and a little celebration (main listens for this).
        this.arriving = false;
        this.popT = 0;
        this.onArrive?.(this);
      }
    }

    // Smooth turning.
    let d = this.targetFacing - this.facing;
    d = Math.atan2(Math.sin(d), Math.cos(d));
    this.facing += d * (1 - Math.exp(-dt * 10));

    this.root.position.set(this.pos.x, FLOOR_Y + this.lot.floorY(this.floor), this.pos.y);
    // Only the inspected floor's residents show while a building is open (the others are behind walls and ceilings).
    const shown = this.lot.showsFloor(this.floor);
    this.root.visible = shown;
    this.label.visible = shown;
    this.root.rotation.y = this.facing;
    // Selecting a Sim gives it a quick squash-and-stretch hop (pure feedback; says nothing about the agent).
    if (this.selected && !this.wasSelected && !this.clickReaction.active) this.popT = 0;
    if (this.arriving && this.root.visible) this.root.position.y += Math.abs(Math.sin(performance.now() / 160)) * 0.05; // bouncy, excited walk-in
    this.wasSelected = this.selected;
    const base = (this.root.userData.baseScale ??= this.root.scale.x);
    if (this.popT !== undefined && this.popT < 0.9) {
      this.popT += dt;
      const k = Math.exp(-this.popT * 6) * Math.sin(this.popT * 22);
      this.root.scale.set(base * (1 - k * 0.07), base * (1 + k * 0.12), base * (1 - k * 0.07));
      this.root.position.y += Math.max(0, Math.sin(Math.min(this.popT * 9, Math.PI))) * 0.14;
    } else this.root.scale.setScalar(base);

    const pose = this.clickReaction.active?.kind==='friendly' && walking ? 'stand' : this.currentPose(walking, now);
    if (pose === 'home' && !this.homeScene) {
      const plan=this.homePlan;
      this.homeScene=new HomeActivityScene(this,plan);
      if(this.activity.flavor) this.flavorUntil=now+10;
    }
    if(this.homeScene) {
      const active=pose==='home';
      this.homeScene.group.visible=active;
      for(const g of this.homeScene.held)g.visible=active;
      if(active && this.homePlan){const c=this.homePlan.center;this.root.position.set(c.x,FLOOR_Y+this.lot.floorY(this.floor),c.z);this.root.rotation.y=this.homePlan.face;}
    }
    this.animate(pose, t, dt);
    // Reapply structural sleep/bath support even while choreography time is frozen.
    if(pose==='home')this.homeScene?.update(this.clickReaction.active?0:dt,matchMedia('(prefers-reduced-motion: reduce)').matches);
    this.pulseCareScene(pose==='home' && !walking && !this.clickReaction.active);
    if (pose === 'globe') this.lot.globeSpin = 1;
    if (pose === 'sip') this.lot.coffeeBusy = 1;
    if (this.laptop) this.laptop.visible = !['wave', 'cheer'].includes(pose);
    this.screen.update(now);

    // Plumbob: bob, spin, pulse when the agent needs you.
    const waiting = this.state === 'waiting_for_user';
    const gem = this.plumbob.userData.gem;
    this.plumbob.rotation.y += dt * ((waiting ? 3.2 : 1.1) + (this.popT !== undefined && this.popT < 0.9 ? 14 * (0.9 - this.popT) : 0));
    this.plumbob.position.y = 1.85 + Math.sin(t * 2 + this.hash) * 0.05;
    const pulse = waiting ? 1 + Math.sin(t * 6) * 0.16 : 1;
    gem.scale.set(pulse, 2.05 * pulse, pulse);
    this.plumbob.userData.material.emissiveIntensity = waiting ? 3.6 + Math.sin(t * 6) * 1.2 : this.state === 'off_duty' ? 0.35 : 2.2;

    this.updateLabel();
  }

  pulseCareScene(active) {
    const p=this.character?.care?.pending;
    if(!active || !p || this.activity?.careId!==p.id || document.hidden || this.observationConnected===false || this.carePulseSending || performance.now()<(this.nextCarePulse || 0)) return;
    this.nextCarePulse=performance.now()+750;this.carePulseSending=true;
    fetch('/api/care',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({project:this.lot.project,agentId:this.character.id,action:'scene',pendingId:p.id,sequence:p.sequence+1,floor:this.floor,x:this.pos.x,z:this.pos.y})})
      .then(async r=>{const data=await r.json();if(!r.ok)throw Error(data.error || 'Care scene request failed.');this.careError=null;this.receiveCare(data.character);if(data.character.care.revision>=this.character.care.revision)this.character=data.character;})
      .catch(error=>{this.careError=error.message || 'Care scene connection failed.';this.nextCarePulse=performance.now()+750;})
      .finally(()=>{this.carePulseSending=false;});
  }

  cancelBlockedCare(pending) {
    if(this.cancellingCare===pending.id)return;
    this.cancellingCare=pending.id;
    fetch('/api/care',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({project:this.lot.project,agentId:this.character.id,action:'cancel',id:crypto.randomUUID(),revision:this.character.care.revision})})
      .then(async r=>{const data=await r.json();if(!r.ok)throw Error(data.error || 'Care cancellation failed.');if(data.character.care.revision>=this.character.care.revision)this.character=data.character;})
      .catch(error=>{this.careError+=' '+error.message;})
      .finally(()=>{this.cancellingCare=null;});
  }

  receiveCare(character, replay = false) {
    if (!this.careFeedback.receive(character, replay)) return;
    const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)').matches;
    this.careReceivedUntil = performance.now() / 1000 + 1.8;
    if (!reducedMotion && (!this.truth || ['idle', 'done'].includes(this.state))) {
      this.careCheerUntil = this.careReceivedUntil;
      this.popT = 0;
    }
  }

  /** Which pose to play right now: walking, a truth-driven desk pose (with lead-in), or flavor. */
  currentPose(walking, now) {
    if (walking) return this.isVisitor ? 'laptop_walk' : 'walk';
    if (now < this.careCheerUntil && (!this.truth || ['idle','done'].includes(this.state))) return 'cheer';
    if (now < this.cheerUntil) return 'cheer';
    const a = this.activity;
    if (!a) return 'stand';
    if (a.flavor || this.act.at !== 'desk') return a.pose;
    if (this.isVisitor) return 'laptop';
    const lead = this.act.lead;
    return lead && now - this.actT0 < lead.dur ? lead.pose : this.act.pose;
  }

  /** Pose → joint targets (with arm IK for desk work); joints ease toward targets so moves blend. */
  animate(pose, t, dt) {
    const T = Object.fromEntries(JOINTS.map((j) => [j, 0]));
    // Relaxed default stance: arms hang just off the body with soft elbows and a slight forward
    // carry, drifting with the breath. Poses override whatever they need.
    const breathe = Math.sin(t * 1.7 + this.hash);
    T.armLz = 0.17 + breathe * 0.015;
    T.armRz = -0.17 - breathe * 0.015;
    T.armLx = T.armRx = -0.07;
    T.elbowL = T.elbowR = -0.24;
    T.headY = Math.sin(t * 0.4 + this.hash) * 0.12;
    const build = this.look.build;

    const sit = () => {
      T.bodyY = SIT_Y;
      T.legL = T.legR = -Math.PI / 2;
      T.kneeL = T.kneeR = Math.PI / 2;
    };
    /** Point the head at the monitor, compensating for spine lean. */
    const lookAtScreen = (extra = 0) => {
      const headY = 0.9 + T.bodyY + 0.76 + 0.26;
      T.headX = Math.atan2(headY - DESK.screen[1], DESK.screen[2] - 0.1) - T.lean + extra;
    };
    const urgency = Math.min(1, this.waitSeconds / 120);
    const tap = (phase, speed = 18) => Math.max(0, Math.sin(t * speed + phase)) * 0.028;

    switch (pose) {
      case 'walk': {
        const ph = t * 9 + this.hash;
        const s = Math.sin(ph);
        T.legL = s * 0.55;
        T.legR = -s * 0.55;
        T.kneeL = Math.max(0, -Math.cos(ph)) * 0.8;
        T.kneeR = Math.max(0, Math.cos(ph)) * 0.8;
        T.armLx = -s * 0.45;
        T.armRx = s * 0.45;
        T.elbowL = T.elbowR = -0.3;
        T.bodyY = Math.abs(Math.cos(ph)) * 0.05;
        T.lean = 0.06;
        T.headY = 0;
        break;
      }
      case 'laptop_walk':
      case 'laptop': {
        if (pose === 'laptop_walk') {
          const ph = t * 9 + this.hash;
          const s = Math.sin(ph);
          T.legL = s * 0.5;
          T.legR = -s * 0.5;
          T.kneeL = Math.max(0, -Math.cos(ph)) * 0.7;
          T.kneeR = Math.max(0, Math.cos(ph)) * 0.7;
          T.bodyY = Math.abs(Math.cos(ph)) * 0.04;
        }
        T.lean = 0.05;
        armIK(T, 1, off(LAPTOP_AT, 0.16, -0.02 + (pose === 'laptop' ? tap(0, 14) : 0), -0.02), build);
        armIK(T, -1, off(LAPTOP_AT, -0.16, -0.02 + (pose === 'laptop' ? tap(1.7, 14) : 0), -0.02), build);
        T.headX = 0.5 + Math.sin(t * 0.7) * 0.05;
        T.headY = Math.sin(t * 0.4 + this.hash) * 0.1;
        break;
      }
      case 'type':
        sit();
        T.lean = 0.1;
        armIK(T, 1, off(DESK.keysL, 0, tap(0)), build);
        armIK(T, -1, off(DESK.keysR, 0, tap(1.7)), build);
        lookAtScreen(Math.sin(t * 0.9) * 0.03);
        T.headY = Math.sin(t * 0.6) * 0.07;
        break;
      case 'plan': {
        sit();
        T.lean = 0.06;
        const pause = Math.sin(t * 0.9) > 0.55;
        armIK(T, 1, off(DESK.keysL, 0, pause ? 0 : tap(0, 9)), build);
        armIK(T, -1, pause ? DESK.chin : off(DESK.keysR, 0, tap(1.7, 9)), build);
        lookAtScreen(pause ? -0.15 : 0);
        break;
      }
      case 'read':
        sit();
        T.lean = 0.14;
        armIK(T, -1, off(DESK.mouse, 0, -Math.max(0, Math.sin(t * 2.2)) * 0.01, Math.sin(t * 1.4) * 0.012), build);
        armIK(T, 1, DESK.edgeL, build);
        lookAtScreen(Math.sin(t * 0.55) * 0.06);
        T.headY = Math.sin(t * 0.3) * 0.07;
        break;
      case 'mouse': {
        sit();
        T.lean = 0.1;
        const click = t % 2.6 < 0.25 ? -0.016 : 0;
        armIK(T, -1, off(DESK.mouse, Math.sin(t * 0.9) * 0.045, click, Math.cos(t * 0.7) * 0.03), build);
        armIK(T, 1, DESK.edgeL, build);
        lookAtScreen();
        T.headY = -Math.sin(t * 0.9) * 0.1;
        break;
      }
      case 'watch':
        sit();
        T.lean = 0.02;
        armIK(T, -1, DESK.mouse, build);
        armIK(T, 1, DESK.lapL, build);
        lookAtScreen();
        T.headY = Math.sin(t * 0.5) * 0.06;
        break;
      case 'watch_close':
        // Leaning in, chin on fists, waiting for the command to finish.
        sit();
        T.lean = 0.24;
        armIK(T, 1, [0.06, 1.28, 0.36], build);
        armIK(T, -1, [-0.06, 1.28, 0.36], build);
        lookAtScreen();
        T.headY = Math.sin(t * 0.8) * 0.05;
        break;
      case 'lounge':
        // Long-running process (a dev server): lean back, arms folded.
        sit();
        T.lean = -0.18;
        armIK(T, 1, [-0.1, 1.0, 0.24], build);
        armIK(T, -1, [0.1, 0.94, 0.25], build);
        lookAtScreen();
        T.headY = Math.sin(t * 0.3) * 0.15;
        break;
      case 'think':
        sit();
        T.lean = -0.04;
        armIK(T, -1, off(DESK.chin, 0, Math.sin(t * 0.8) * 0.01), build);
        armIK(T, 1, DESK.edgeL, build);
        lookAtScreen(-0.22);
        T.headZ = Math.sin(t * 0.8) * 0.1;
        break;
      case 'talk':
        // Briefing the helper standing at the Sim's right.
        sit();
        T.twist = -0.45;
        T.lean = 0.02;
        armIK(T, 1, DESK.edgeL, build);
        T.armRx = -0.9 + Math.sin(t * 3) * 0.25;
        T.armRz = -0.3;
        T.elbowR = -0.9 + Math.sin(t * 4) * 0.3;
        T.headY = -0.55;
        T.headX = 0.05;
        break;
      case 'facepalm':
        sit();
        T.lean = 0.2;
        armIK(T, 1, [0.08, 1.44, 0.34], build);
        armIK(T, -1, [-0.08, 1.44, 0.34], build);
        T.headX = 0.32 + Math.sin(t * 3) * 0.04;
        break;
      case 'wave': {
        // Impatience grows with wait time (truth: measured from the event timestamp).
        const speed = 7 + urgency * 7;
        T.armRz = -2.65 + Math.sin(t * speed) * 0.32;
        T.elbowR = -0.35 + Math.sin(t * speed + 1) * 0.25;
        T.armLz = 0.12;
        T.bodyY = urgency > 0.5 ? Math.abs(Math.sin(t * 5)) * 0.07 * urgency : 0;
        T.legL = urgency > 0.8 ? Math.max(0, Math.sin(t * 10)) * -0.25 : 0;
        T.headY = 0;
        T.headX = -0.08;
        break;
      }
      case 'cheer': {
        const j = Math.abs(Math.sin(t * 7));
        T.armLz = 2.7;
        T.armRz = -2.7;
        T.elbowL = T.elbowR = -0.25;
        T.bodyY = j * 0.3;
        T.kneeL = T.kneeR = (1 - j) * 0.35;
        T.legL = T.legR = -(1 - j) * 0.2;
        T.headX = -0.15;
        break;
      }
      case 'browse':
        T.armRx = -2.5 + Math.sin(t * 1.3) * 0.2;
        T.elbowR = -0.35;
        T.armLx = -0.3;
        T.elbowL = -1.2;
        T.headX = -0.25 + Math.sin(t * 0.7) * 0.08;
        T.headY = Math.sin(t * 0.5) * 0.3;
        break;
      case 'globe':
        T.armRx = -1.15;
        T.elbowR = -0.45 + Math.sin(t * 2.4) * 0.15;
        T.armLx = -0.2;
        T.elbowL = -0.9;
        T.headX = 0.1;
        T.headY = Math.sin(t * 1.1) * 0.2;
        break;
      case 'present':
        T.armRx = -1.9 + Math.sin(t * 3) * 0.3;
        T.elbowR = -0.5;
        T.armRz = -Math.sin(t * 2) * 0.15;
        T.armLx = -0.2;
        T.elbowL = -1.3;
        T.headY = Math.sin(t * 0.6) * 0.35;
        break;
      case 'sip': {
        const s = Math.max(0, Math.sin(t * 1.2));
        T.armRx = -0.8;
        T.elbowR = -1.7 - s * 0.6;
        T.armLx = -0.2;
        T.elbowL = -1.3;
        T.headX = -0.15 * s;
        break;
      }
      case 'relax':
        sit();
        T.bodyY = COUCH_Y;
        T.lean = -0.22;
        T.armLz = 0.5;
        T.armRz = -0.5;
        T.elbowL = T.elbowR = -0.4;
        T.legL = T.legR = -1.35;
        T.kneeL = T.kneeR = 1.25;
        T.headX = -0.12;
        break;
      case 'doze':
        sit();
        T.bodyY = COUCH_Y;
        T.lean = -0.14;
        T.headX = 0.48 + Math.sin(t * 1.2) * 0.04;
        T.armLx = T.armRx = -0.35;
        T.elbowL = T.elbowR = -0.6;
        T.headY = 0;
        break;
      case 'doze_stand':
        T.headX = 0.4;
        break;
      case 'look':
        T.headY = Math.sin(t * 0.6 + this.hash) * 0.6;
        T.armLx = T.armRx = 0.25;
        T.elbowL = T.elbowR = -0.4;
        break;
      default:
        break;
    }

    if(pose==='home' && this.homeScene) this.homeScene.pose(T, matchMedia('(prefers-reduced-motion: reduce)').matches ? 1 : this.homeScene.age, armIK, build);
    if(this.observationConnected===false && this.staleClickBase)Object.assign(T,this.staleClickBase);
    this.clickReaction.compose(this,T,dt);
    // Ease joints toward targets: snappy while walking, softer otherwise.
    const k = 1 - Math.exp(-dt * (pose === 'walk' || pose === 'laptop_walk' ? 18 : 10));
    const J = this.joints;
    for (const key of JOINTS) J[key] += (T[key] - J[key]) * k;

    const p = this.parts;
    p.body.position.y = J.bodyY;
    if(pose!=='home'){p.body.rotation.x=0;p.body.position.z=0;p.legL.visible=p.legR.visible=true;}
    p.spine.rotation.set(J.lean, J.twist, 0);
    p.legL.rotation.x = J.legL;
    p.legR.rotation.x = J.legR;
    p.kneeL.rotation.x = J.kneeL;
    p.kneeR.rotation.x = J.kneeR;
    p.armL.rotation.set(J.armLx, 0, J.armLz);
    p.armR.rotation.set(J.armRx, 0, J.armRz);
    p.elbowL.rotation.x = J.elbowL;
    p.elbowR.rotation.x = J.elbowR;
    p.head.rotation.set(J.headX, J.headY, J.headZ);
    p.torso.scale.set(1, 1 + Math.sin(t * 2 + this.hash) * 0.012, 1);

    // Blinking (eyes closed while dozing).
    let eyeY = 1;
    if (pose === 'doze') eyeY = 0.1;
    else if (t > this.nextBlink) {
      eyeY = 0.1;
      if (t > this.nextBlink + 0.12) this.nextBlink = t + 2.5 + Math.random() * 3;
    }
    p.eyes.scale.y = eyeY;

    // Mouth: open while calling out or celebrating, flatter when something failed.
    const open = pose === 'wave' || pose === 'cheer';
    p.mouthOpen.visible = open;
    p.mouth.visible = !open;
    p.mouth.scale.set(1, pose === 'facepalm' ? 0.25 : 1, 1);
  }

  /** The one-word-ish status shown under the name: never activity details, files or chat titles. */
  statusText(stale) {
    if (stale) return observedLabel(this.truth).replace('Last observed', 'Last seen');
    if (this.walking) return 'Traveling';
    const state = this.state;
    if (state === 'off_duty') return 'Off duty';
    if (state === 'waiting_for_user') return { permission: 'Needs your OK', input: 'Has a question' }[this.truth?.detail?.reason] || 'Needs you';
    if (state === 'error') return 'Error';
    if (state === 'idle' || state === 'done') return 'Idle';
    return 'Working';
  }

  updateLabel() {
    const state = this.state;
    // While observation is offline, the bubble only says when the agent was last seen (no stale activity).
    const stale = this.observationConnected === false && !!this.truth;
    const text = this.statusText(stale);
    const compact = this.observationConnected !== false && this.labelMode === 'compact' && !this.selected && !this.hovered && state !== 'waiting_for_user';
    // Every bubble is just the name and a short status (icons only when zoomed far out).
    const chip = this.observationConnected !== false && this.labelMode === 'chip' && !compact;
    const stateIcon = icon(this.walking && !stale ? 'navigation' : STATE_ICON[state]);
    const careReceived = performance.now() / 1000 < this.careReceivedUntil && !stale && !['waiting_for_user','error'].includes(state);
    const homeLabel = !stale && (this.activity?.homeId ? (this.walking ? `Approaching · ${homeActivity(this.activity.homeId)?.label}` : homeActivity(this.activity.homeId)?.label) : this.homeUnavailable);
    const detail = this.selected && !this.detailSuppressed && !stale && this.labelMode === 'full' && !['waiting_for_user','error'].includes(state) ? `<span class="b-resident-detail">${escapeHtml(assignedRole(this.character?.assignedRole)?.title || '')}${this.character?.care ? `<small>Lv ${this.residentLevel || 1} &middot; Happiness ${this.character.happiness}/100 (simulated)</small>` : ''}</span>` : '';
    const html = compact
      ? `<span class="b-icon">${stateIcon}</span>`
      : `<span class="b-icon">${stateIcon}</span>` +
        `<span class="b-text"><b>${escapeHtml(this.name)}</b>${detail}${canPromptFromStatus(this.truth)?`<button type="button" class="b-state" data-prompt-sim aria-label="${escapeHtml(text)} · Open chat">${escapeHtml(text)}</button>`:`<span class="b-state">${escapeHtml(text)}</span>`}${homeLabel ? `<small>${escapeHtml(homeLabel)}</small>` : ''}${careReceived ? '<small class="b-care-feedback">Care received &middot; simulated</small>' : ''}</span>`;
    if (html !== this.labelHtml) {
      this.bubbleEl.innerHTML = html;
      this.labelHtml = html;
      this.labelSize = null; // re-measured by the declutter pass
    }
    const cls = `bubble${stale ? ' observation-stale' : ''} s-${plumbobFor(state)}${this.isVisitor ? ' visitor' : ''}${this.selected ? ' selected' : ''}${compact ? ' compact' : ''}${chip ? ' chip' : ''}${this.labelMode === 'hidden' ? ' hidden' : ''}${this.crowded ? ' crowded' : ''}${this.labelDy > 2 ? ' shifted' : ''}`;
    if (this.bubbleEl.className !== cls) {
      this.bubbleEl.className = cls;
      this.labelSize = null;
    }
  }

  /** Seated at a desk or on the couch: those stations are exclusive, so no nudging. */
  get seated() {
    if (this.walking) return false;
    const pose = this.activity?.pose;
    return (this.act?.at === 'desk' && !this.isVisitor && !this.activity?.flavor) || pose === 'relax' || pose === 'doze';
  }

  worldPosition() {
    return this.lot.toWorld(this.pos.x, this.pos.y).setY(this.lot.floorY(this.floor));
  }

  /** Provider badge on the chest (cosmetic): shown while a session is attached. */
  applyBadge() {
    const badge = this.parts.badge;
    const providerColor = this.truth && PROVIDER_COLORS[this.truth.provider];
    badge.visible = !!providerColor;
    if (providerColor) badge.material.color.setHex(providerColor);
  }

  /**
   * Apply wardrobe overrides (hex colors and options from shared/style.mjs) on top of the seeded look.
   * Rebuilds the body in place; position, pose, plumbob, label and laptop carry over.
   */
  setLook(overrides) {
    const key = JSON.stringify(overrides || {});
    if (key === this.lookKey) return;
    this.lookKey = key;
    this.look = { ...this.baseLook, ...lookFromOverrides(overrides) };
    const old = this.root;
    const oldBody = this.parts.body;
    const parts = buildPerson(this.look, this.isVisitor ? { scale: 0.8, hat: 0xf2b134 } : {});
    parts.root.position.copy(old.position);
    parts.root.rotation.copy(old.rotation);
    for (const child of [...old.children]) if (child !== oldBody) parts.root.add(child);
    parts.spine.add(this.plumbob);
    this.lot.group.remove(old);
    this.lot.group.add(parts.root);
    oldBody.traverse((o) => o.isMesh && o.geometry.dispose());
    this.parts = parts;
    this.root = parts.root;
    this.root.traverse((o) => (o.userData.simKey = this.key));
    this.applyBadge();
  }

  dispose() {
    this.clickReaction.cancel();
    this.stopHomeActivity();
    this.release();
    this.lot.group.remove(this.root);
    this.labelEl.remove();
    if (this.isVisitor) {
      this.screen.texture.dispose();
      this.screen.material.dispose();
    }
  }
}

/** Wardrobe overrides use hex strings; the model builder uses numbers. */
export function lookFromOverrides(overrides = {}) {
  const out = {};
  for (const [k, v] of Object.entries(overrides || {})) out[k] = typeof v === 'string' && v.startsWith('#') ? parseInt(v.slice(1), 16) : v;
  return out;
}

export function escapeHtml(s) {
  return String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
}

/**
 * Keep standing Sims in the same lot a body-width apart: overlapping pairs ease away from each
 * other each frame (only onto walkable floor). Seated Sims hold their station and don't move.
 */
export function separateSims(sims, dt) {
  const MIN = 0.62;
  const list = [...sims].filter((s) => !s.gone && s.root.visible !== false);
  for (let i = 0; i < list.length; i++) {
    for (let j = i + 1; j < list.length; j++) {
      const a = list[i], b = list[j];
      if (a.lot !== b.lot || a.floor !== b.floor) continue;
      const dx = b.pos.x - a.pos.x, dz = b.pos.y - a.pos.y;
      const d = Math.hypot(dx, dz);
      if (d >= MIN) continue;
      const aFixed = a.seated, bFixed = b.seated;
      if (aFixed && bFixed) continue;
      const nx = d > 1e-4 ? dx / d : Math.cos(i + j), nz = d > 1e-4 ? dz / d : Math.sin(i + j);
      const push = Math.min(MIN - d, dt * 2.5);
      const nav = a.lot.getNav(a.floor);
      const move = (s, sx, sz) => { const x = s.pos.x + sx, z = s.pos.y + sz; if (nav.walkable(x, z)) s.pos.set(x, z); };
      if (aFixed) move(b, nx * push, nz * push);
      else if (bFixed) move(a, -nx * push, -nz * push);
      else { move(a, -nx * push / 2, -nz * push / 2); move(b, nx * push / 2, nz * push / 2); }
    }
  }
}
