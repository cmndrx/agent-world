import '@fontsource-variable/nunito';
import * as THREE from 'three';
import { CSS2DRenderer } from 'three/addons/renderers/CSS2DRenderer.js';
import { Avatar, CameraRig } from './avatar.js';
import { Environment } from './environment.js';
import { Lot } from './lot.js';
import { Pipeline } from './pipeline.js';
import { Scenery } from './scenery.js';
import { Sim } from './sim.js';
import { Sound } from './sound.js';
import { UI } from './ui.js';

// ---- Settings (per viewer, local only) ---------------------------------------------------

const SETTINGS_KEY = 'agent-world:settings';
const settings = { time: 'auto', walls: 'cutaway', quality: 'auto', roster: 'open' };
try {
  Object.assign(settings, JSON.parse(localStorage.getItem(SETTINGS_KEY) || '{}'));
} catch {}
const saveSettings = () => {
  try {
    localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings));
  } catch {}
};

// ---- Renderer and scene ---------------------------------------------------------------------

const app = document.getElementById('app');
const renderer = new THREE.WebGLRenderer({ antialias: false, powerPreference: 'high-performance' });
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
app.appendChild(renderer.domElement);

const labels = new CSS2DRenderer();
labels.domElement.className = 'labels';
app.appendChild(labels.domElement);

const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(36, 1, 0.5, 900);
const env = new Environment(renderer, scene);
env.setMode(settings.time);
const pipeline = new Pipeline(renderer, scene, camera, env);
const scenery = new Scenery(scene);
scenery.ensureRows(1);

// ---- World state --------------------------------------------------------------------------

const lots = new Map(); // project -> Lot
const sims = new Map(); // key -> Sim
const sessionToSim = new Map(); // session id -> sim key
const households = new Map(); // project -> household

const charKey = (project, slot) => `${project}#${slot}`;
const sound = new Sound();
let replaying = false; // true while applying a snapshot: no sounds/toasts for already-known state
let firstSnapshot = true;
const REMIND_AFTER_S = 120;

function ensureLot(household) {
  let lot = lots.get(household.project);
  if (!lot) {
    lot = new Lot(household, lots.size, hashStr(household.project));
    lot.wallMode = settings.walls;
    lots.set(household.project, lot);
    scene.add(lot.group);
    scenery.ensureRows(Math.ceil(lots.size / 3));
  }
  return lot;
}

function applyHousehold(h) {
  households.set(h.project, h);
  const lot = ensureLot(h);
  lot.setName(h.name);
  lot.ensureDesks(h.characters.length);
  for (const c of h.characters) {
    const key = charKey(h.project, c.slot);
    let sim = sims.get(key);
    if (!sim) {
      sim = new Sim({ key, lot, character: c, seed: c.seed });
      sims.set(key, sim);
      sim.setTruth(null);
    } else {
      sim.character = c;
    }
  }
}

function applySession(s) {
  const lot = lots.get(s.project) || ensureLot(households.get(s.project) || { project: s.project, name: s.project.split('/').pop(), characters: [] });
  let key;
  if (s.slot != null) {
    key = charKey(s.project, s.slot);
    if (!sims.has(key)) return; // household update will arrive first; ignore otherwise
  } else {
    key = `visitor:${s.session}`;
    if (!sims.has(key)) {
      const parentKey = sessionToSim.get(s.parent_session);
      const parent = parentKey && sims.get(parentKey);
      if (!parent) return;
      sims.set(key, new Sim({ key, lot, parent, seed: hashStr(s.session) }));
    }
  }
  sessionToSim.set(s.session, key);
  const sim = sims.get(key);
  const before = sim.state;
  sim.setTruth(s);
  if (!replaying && sim.state === 'waiting_for_user' && before !== 'waiting_for_user') {
    sound.play(s.detail?.reason === 'turn_complete' ? 'turn_complete' : 'permission');
    ui.toast(sim);
  }
}

function endSession(sessionId) {
  const key = sessionToSim.get(sessionId);
  sessionToSim.delete(sessionId);
  const sim = key && sims.get(key);
  if (!sim) return;
  if (sim.isVisitor) sim.leave();
  else if (sim.truth?.session === sessionId) sim.setTruth(null);
}

function applySnapshot({ households: hs, sessions }) {
  replaying = true;
  hs.forEach(applyHousehold);
  const live = new Set(sessions.map((s) => s.session));
  for (const id of [...sessionToSim.keys()]) if (!live.has(id)) endSession(id);
  // Primary sessions first so visitors can find their parent.
  [...sessions].sort((a, b) => (a.parent_session ? 1 : 0) - (b.parent_session ? 1 : 0)).forEach(applySession);
  replaying = false;
  // Don't fire "still waiting" reminders for waits that began before we connected.
  for (const sim of sims.values()) if (sim.waitSeconds > REMIND_AFTER_S) sim.reminded = true;

  if (firstSnapshot) {
    firstSnapshot = false;
    // Start at the lot that most needs attention, else the busiest, else the first.
    const all = [...sims.values()];
    const pick = all.find((s) => s.state === 'waiting_for_user') || all.find((s) => s.truth) || all[0];
    if (pick) placeAvatarNear(pick.lot);
    setTimeout(() => {
      ui.hideIntro();
      rig.flyTo(avatar.pos, { distance: 24, duration: 2.4 });
    }, 250);
  }
}

function hashStr(s) {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (Math.imul(h, 31) + s.charCodeAt(i)) | 0;
  return h >>> 0;
}

/** Collision test for the avatar, in world coordinates. */
function blockedAt(x, z) {
  for (const lot of lots.values()) {
    const nav = lot.getNav();
    const lx = x - lot.group.position.x;
    const lz = z - lot.group.position.z;
    if (nav.inBounds(lx, lz)) return !nav.walkable(lx, lz);
  }
  return false;
}

// ---- Bridge connection -----------------------------------------------------------------

function connect() {
  ui.setConnection('connecting');
  const es = new EventSource('/api/stream');
  es.onopen = () => ui.setConnection('live', liveCount());
  es.onerror = () => ui.setConnection('offline');
  es.onmessage = (msg) => {
    const m = JSON.parse(msg.data);
    if (m.type === 'snapshot') {
      ui.setDemo(!!m.demo);
      applySnapshot(m);
    }
    else if (m.type === 'household') applyHousehold(m.household);
    else if (m.type === 'session') applySession(m.session);
    else if (m.type === 'session_end') endSession(m.session);
  };
}
const liveCount = () => [...sims.values()].filter((s) => s.truth).length;

// ---- Player, camera, UI ---------------------------------------------------------------------

const avatar = new Avatar(scene);
const rig = new CameraRig(camera, renderer.domElement);
rig.distance = rig.distanceTarget = 80; // intro starts high; flies in on the first snapshot
rig.pitch = 1.0;
let selected = null;
let hovered = null;

function placeAvatarNear(lot) {
  const p = lot.toWorld(0, 12.2);
  avatar.teleport(p.x, p.z);
  avatar.facing = Math.PI;
}

const ui = new UI({
  onRename: async (sim, name) => {
    await fetch('/api/rename', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ project: sim.lot.project, slot: sim.character.slot, name }),
    });
  },
  onFocus: (key) => focusSim(key),
  onFocusLot: (project) => {
    const lot = lots.get(project);
    if (!lot) return;
    placeAvatarNear(lot);
    rig.flyTo(lot.toWorld(0, 2).setY(0.12), { distance: Math.max(rig.distanceTarget, 30) });
  },
  onClose: () => select(null),
  onSetting: (key, value) => {
    settings[key] = value;
    saveSettings();
    applySettings();
  },
  onAction: (name) => {
    if (name === 'rotate-left') rig.yawTarget -= Math.PI / 4;
    if (name === 'rotate-right') rig.yawTarget += Math.PI / 4;
    if (name === 'sound') sound.toggle();
    applySettings();
  },
});

function applySettings() {
  env.setMode(settings.time);
  if (pipeline.setting !== settings.quality) pipeline.setQuality(settings.quality);
  for (const lot of lots.values()) lot.wallMode = settings.walls;
  document.getElementById('roster').classList.toggle('collapsed', settings.roster === 'collapsed');
  ui.renderDock(settings, sound.enabled, pipeline.level);
}
pipeline.onDowngrade = () => ui.renderDock(settings, sound.enabled, pipeline.level);

let followSelected = false;
function select(sim) {
  if (selected) selected.selected = false;
  selected = sim;
  followSelected = !!sim;
  document.body.classList.toggle('inspecting', !!sim);
  if (sim) {
    sim.selected = true;
    ui.open(sim);
  }
}

/** Shift the rendered view so the focus sits centered in the space between open panels. */
let viewShift = 0;
function updateViewOffset(dt) {
  const w = app.clientWidth;
  const h = app.clientHeight;
  let target = 0;
  if (w > 760) {
    const roster = document.getElementById('roster');
    const left = roster.classList.contains('collapsed') || getComputedStyle(roster).width === '168px' ? 0 : roster.offsetWidth + 16;
    const right = selected ? document.getElementById('inspect').offsetWidth + 16 : 0;
    target = (right - left) / 2;
  }
  viewShift += (target - viewShift) * (1 - Math.exp(-dt * 6));
  if (Math.abs(viewShift) < 0.5 && target === 0) camera.clearViewOffset();
  else camera.setViewOffset(w, h, viewShift, 0, w, h);
}

function focusSim(key) {
  const sim = sims.get(key);
  if (!sim) return;
  // Stand the avatar beside the Sim (to the camera's right, so it doesn't block the view),
  // then glide the camera to frame the Sim.
  const nav = sim.lot.getNav();
  const rx = Math.cos(rig.yawTarget);
  const rz = -Math.sin(rig.yawTarget);
  const [i, j] = nav.nearestFree(...nav.toCell(sim.pos.x + rx * 1.6, sim.pos.y + rz * 1.6)) || nav.toCell(sim.pos.x, sim.pos.y);
  const spot = nav.center(i, j);
  const dest = sim.lot.toWorld(spot.x, spot.z).setY(0.12);
  avatar.teleport(dest.x, dest.z);
  avatar.facing = Math.atan2(sim.pos.x - spot.x, sim.pos.y - spot.z);
  rig.flyTo(dest, { distance: Math.min(rig.distanceTarget, 15) });
  select(sim);
}

const tmpV = new THREE.Vector3();
function nearestSim(maxDist) {
  let best = null;
  let bestD = maxDist;
  for (const sim of sims.values()) {
    const d = sim.worldPosition().distanceTo(tmpV.set(avatar.pos.x, 0, avatar.pos.z));
    if (d < bestD) {
      bestD = d;
      best = sim;
    }
  }
  return best;
}

addEventListener('keydown', (e) => {
  if (e.target.closest?.('input, textarea')) return;
  if (e.key === ' ') {
    e.preventDefault();
    const sim = nearestSim(3);
    if (sim) select(sim);
  }
  if (e.key === 'Escape') {
    ui.closeMenus();
    ui.close();
  }
});

// Hover + click picking.
const raycaster = new THREE.Raycaster();
const pointer = new THREE.Vector2(9, 9);
let pointerDirty = false;
renderer.domElement.addEventListener('pointermove', (e) => {
  const rect = renderer.domElement.getBoundingClientRect();
  pointer.set(((e.clientX - rect.left) / rect.width) * 2 - 1, -((e.clientY - rect.top) / rect.height) * 2 + 1);
  pointerDirty = true;
});
renderer.domElement.addEventListener('pointerleave', () => pointer.set(9, 9));
function pick() {
  raycaster.setFromCamera(pointer, camera);
  const hit = raycaster.intersectObjects([...sims.values()].map((s) => s.root), true)[0];
  return hit ? sims.get(hit.object.userData.simKey) : null;
}
renderer.domElement.addEventListener('click', () => {
  const sim = pick();
  if (sim) select(sim);
  else ui.close();
});
labels.domElement.addEventListener('click', (e) => {
  const b = e.target.closest('.bubble');
  if (b) select(sims.get(b.dataset.simKey));
});

function resize() {
  const w = app.clientWidth;
  const h = app.clientHeight;
  pipeline.setSize(w, h);
  labels.setSize(w, h);
  camera.aspect = w / h;
  camera.updateProjectionMatrix();
}
addEventListener('resize', resize);
pipeline.setting = settings.quality;
pipeline.level = settings.quality === 'auto' ? 'high' : settings.quality;
resize();
applySettings();

// ---- Main loop ----------------------------------------------------------------------------

const clock = new THREE.Clock();
let lastClockLabel = 0;
function frame() {
  const dt = Math.min(clock.getDelta(), 0.1);
  const t = clock.elapsedTime;

  const lookTarget = nearestSim(6);
  avatar.update(dt, t, rig.yaw, blockedAt, lookTarget ? lookTarget.worldPosition() : null);
  // While inspecting, the camera follows the Sim; walking hands it back to the avatar.
  if (avatar.moving) followSelected = false;
  const focus = followSelected && selected ? selected.worldPosition().setY(0.12) : avatar.pos;
  rig.update(dt, focus);
  updateViewOffset(dt);
  env.update(rig.target);
  scenery.update(dt, t, env.night);

  // Hover outline (only when the pointer moved, to keep raycasts cheap).
  if (pointerDirty) {
    pointerDirty = false;
    const h = pick();
    if (h !== hovered) {
      if (hovered) hovered.hovered = false;
      hovered = h;
      if (h) h.hovered = true;
      renderer.domElement.style.cursor = h ? 'pointer' : '';
    }
  }
  pipeline.setOutlined([selected, hovered].filter(Boolean).map((s) => s.root));

  const near = nearestSim(3);
  const camDist = camera.position.distanceTo(rig.target);
  pipeline.setTiltStrength(THREE.MathUtils.smoothstep(camDist, 30, 95) * 0.75);
  const busyLots = new Set();
  let waitingCount = 0;
  for (const [key, sim] of sims) {
    sim.expanded = sim === near;
    sim.labelMode = camDist > 42 ? 'compact' : 'full';
    sim.update(dt, t);
    if (sim.state === 'running') busyLots.add(sim.lot);
    if (sim.state === 'waiting_for_user') {
      waitingCount++;
      if (!sim.reminded && sim.waitSeconds > REMIND_AFTER_S) {
        sim.reminded = true;
        sound.play('reminder');
      }
    }
    if (sim.gone) {
      if (selected === sim) ui.close();
      if (hovered === sim) hovered = null;
      sim.dispose();
      sims.delete(key);
    }
  }
  for (const lot of lots.values()) lot.update(dt, t, { camera, night: env.night, busy: busyLots.has(lot) });
  ui.updatePreview();

  const title = waitingCount ? `(${waitingCount}) Agent World` : 'Agent World';
  if (document.title !== title) document.title = title;
  if (t - lastClockLabel > 1) {
    lastClockLabel = t;
    ui.setClock(env.label(), env.hour, settings.time);
    ui.setNight(env.night > 0.55);
    if (ui.status.dataset.state === 'live') ui.setConnection('live', liveCount());
  }
  ui.setHint(selected ? null : near);
  ui.update({ sims: [...sims.values()], lots: [...lots.values()], camera, width: app.clientWidth, height: app.clientHeight, selected });

  pipeline.render(dt);
  labels.render(scene, camera);
  requestAnimationFrame(frame);
}

// Debug handle for the console.
window.agentWorld = { sims, lots, avatar, rig, sound, env, pipeline, focusSim };

connect();
frame();
