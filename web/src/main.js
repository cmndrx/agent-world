import { PassCard } from './pass-card.js';
import { focusState } from '../../shared/freshness.mjs';
import { Experience } from './experience.js';
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
import { ConversationLibrary } from './conversations.js';
import { shouldNotify } from '../../shared/productivity.mjs';
import { WorkCenter } from './work-center.js';
import { UI } from './ui.js';
import { BuildMode } from './build.js';
import { Wardrobe } from './wardrobe.js';
import { emptyStyle } from '../../shared/style.mjs';
import { setLightPools } from './models.js';
import { BRICKS, homeLevel, levelName, progress } from '../../shared/progression.mjs';
import { Celebrations } from './celebrate.js';
import { ProgressPanel } from './progress.js';
import { escapeHtml } from './sim.js';
import { Commons } from './commons.js';
import { Seasons } from './seasons.js';
import { Explore, foundMessage } from './explore.js';
import { MapMode } from './mapmode.js';
import { WeatherFx, fxUniforms } from './fx.js';
import { Garden } from './garden.js';
import { Album, PhotoMode } from './photo.js';
import { DOWNTOWN_X, Downtown } from './downtown.js';
import { Census } from './census.js';
import { StreetLife } from './streetlife.js';
import { Landscape } from './landscape.js';
import { declutter, declutterSigns } from './declutter.js';
import { BUSINESSES, HIRE_AFTER_DAYS, SIGNALS, TIERS, businessName, businessStage, businessTier, emptyCity, helperKey, helperType, residentKey, roleOf, roleWhy, staff } from '../../shared/city.mjs';
import { CROPS } from '../../shared/garden.mjs';
import { DECOR } from '../../shared/style.mjs';

// ---- Settings (per viewer, local only) ---------------------------------------------------

const SETTINGS_KEY = 'agent-world:settings';
const settings = { time: 'auto', walls: 'cutaway', quality: 'auto', roster: 'open', focusProject: '', season: 'auto', weather: 'auto', streetLife: 'on' };
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
// Shadows are redrawn every other frame (the frame loop sets needsUpdate): half the shadow cost, no visible lag.
renderer.shadowMap.autoUpdate = false;
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
// Phase 3 (docs/GAMEPLAY.md): town square, seasons and weather (ambience).
const commons = new Commons(scene);
const seasons = new Seasons(scene, env, scenery);
seasons.set({ season: settings.season, weather: settings.weather });
const weatherFx = new WeatherFx(scene);
// The world around the neighborhood (scenery only): groves, pond, cars, birds, skyline.
const landscape = new Landscape(scene);
landscape.ensureRows(1);
// Downtown (play layer): grows from the kinds of work agents do, once per day per kind (shared/city.mjs).
const downtown = new Downtown(scene);
let city = emptyCity();
let demoMode = false;
let bridgeReady = false;
// Street life (made up): off-duty residents sometimes walk to their workplace downtown and back.
const streetLife = new StreetLife(scene, { downtown });

// ---- World state --------------------------------------------------------------------------

const lots = new Map(); // project -> Lot
const sims = new Map(); // key -> Sim
const sessionToSim = new Map(); // session id -> sim key
const households = new Map(); // project -> household

const charKey = (project, slot) => `${project}#${slot}`;
// Customization (decor, paint, outfits): simulation layer only. See docs/GAMEPLAY.md.
let style = emptyStyle();
let build = null; // BuildMode, created below
let explore = null; // Explore, created below
let mapMode = null; // MapMode, created below
let garden = null; // Garden, created below
let photo = null; // PhotoMode, created below
let album = null; // Album, created below
let census = null; // Census, created below
let photos = []; // photo album (newest first)
// Progression (phase 2): derived from the human's board + style; see shared/progression.mjs.
let board = { tasks: [], plans: [] };
let prog = progress(board, style);
let progressPanel = null; // created below
const celebrations = new Celebrations(scene);
let wardrobe = null; // Wardrobe, created below
const sound = new Sound();
let replaying = false; // true while applying a snapshot: no sounds/toasts for already-known state
let firstSnapshot = true;
const REMIND_AFTER_S = 120;

function ensureLot(household) {
  let lot = lots.get(household.project);
  if (!lot) {
    lot = new Lot(household, lots.size, hashStr(household.project));
    lot.wallMode = build?.active ? 'down' : settings.walls;
    lot.applyStyle(style.homes?.[household.project]);
    lots.set(household.project, lot);
    scene.add(lot.group);
    scenery.ensureRows(Math.ceil(lots.size / 3));
  landscape.ensureRows(Math.ceil(lots.size / 3));
  }
  return lot;
}

function applyHousehold(h) {
  households.set(h.project, h);
  const isNew = !lots.has(h.project);
  const lot = ensureLot(h);
  lot.setLevel(prog.levels[h.project] || 1);
  if (isNew) {
    applyLayout();
    explore?.sync();
  }
  lot.setName(h.name);
  library.setData({ households: [...households.values()] });
  work.setData({ households: [...households.values()] });
  lot.setConversationCount(library.data.conversations.filter(c => c.project === h.project).length);
  lot.ensureDesks(h.characters.length);
  for (const c of h.characters) {
    const key = charKey(h.project, c.slot);
    let sim = sims.get(key);
    if (!sim) {
      sim = new Sim({ key, lot, character: c, seed: c.seed });
      sims.set(key, sim);
      sim.setTruth(null);
      sim.setLook(style.residents?.[key]);
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
  sim.observationConnected = bridgeReady;
  syncLibrarySessions();
  if (bridgeReady && !replaying && allowRoutine(s) && sim.state === 'waiting_for_user' && before !== 'waiting_for_user') {
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
  syncLibrarySessions();
}

function applySnapshot({ households: hs, sessions, projects = [], conversations = [], plans = [], tasks = [], passes, runner }) {
  passCard.setData({passes,runner,tasks,sessions,conversations});
  work.setData({ plans, tasks, conversations });
  library.setData({ projects, conversations });
  replaying = true;
  hs.forEach(applyHousehold);
  const live = new Set(sessions.map((s) => s.session));
  for (const id of [...sessionToSim.keys()]) if (!live.has(id)) endSession(id);
  // Primary sessions first so visitors can find their parent.
  [...sessions].sort((a, b) => (a.parent_session ? 1 : 0) - (b.parent_session ? 1 : 0)).forEach(applySession);
  replaying = false;
  syncLibrarySessions();
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
  const square = commons.blockedAt(x, z);
  if (square !== null) return square;
  const town = downtown.blockedAt(x, z);
  if (town !== null) return town;
  if (landscape.blockedAt(x, z)) return true;
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
  es.onopen = () => setBridgeConnection(false, 'connecting');
  es.onerror = () => setBridgeConnection(false, 'offline');
  es.onmessage = (msg) => {
    const m = JSON.parse(msg.data);
    if (m.type === 'snapshot') {
      ui.setDemo(!!m.demo);
      style = m.style || emptyStyle();
      photos = m.photos || [];
      city = m.city || emptyCity();
      demoMode = !!m.demo;
      downtown.set(city);
      census?.setCity(city, demoMode && city.demo);
      album?.setPhotos(photos);
      board = { tasks: m.tasks || [], plans: m.plans || [] };
      applySnapshot(m);
      setBridgeConnection(true, 'live');
      applyStyleAll();
      refreshProgress();
    }
    else if (m.type === 'style') { style = m.style || emptyStyle(); applyStyleAll(); refreshProgress(); if (build.active) build.render(); }
    else if (m.type === 'city') {
      const before = city;
      city = m.city || emptyCity();
      downtown.set(city);
      census?.setCity(city, demoMode && city.demo);
      applyRoles();
      celebrateCity(before, city);
    }
    else if (m.type === 'photos') { photos = m.photos || []; album?.setPhotos(photos); }
    else if (m.type === 'catalog') { library.setData({ projects: m.projects, conversations: m.conversations }); work.setData({ conversations: m.conversations }); passCard.setData({conversations:m.conversations}); syncLibrarySessions(); }
    else if (m.type === 'passes') passCard.setData(m);
    else if (m.type === 'productivity') {
      passCard.setData({tasks:m.tasks});
      work.setData({ plans: m.plans, tasks: m.tasks });
      const next = { tasks: m.tasks || [], plans: m.plans || [] };
      celebrateChanges(board, next);
      board = next;
      refreshProgress();
    }
    else if (m.type === 'household') applyHousehold(m.household);
    else if (m.type === 'session') applySession(m.session);
    else if (m.type === 'session_end') endSession(m.session);
  };
}
function setBridgeConnection(ready, state) {
  bridgeReady = ready;
  document.body.dataset.observation = ready ? 'live' : state;
  ui.setConnection(state, liveCount()); library.setConnection(ready); work.setConnection(ready);
  passCard.setData({connected:ready});
  for (const sim of sims.values()) sim.observationConnected = ready;
  if (typeof experience !== 'undefined') experience.refreshConnection();
}
const liveCount = () => [...sims.values()].filter((s) => s.truth).length;

/** Plot order: the saved layout first, then any new homes in the first free plots. */
function computePlots() {
  const plots = (style.layout || []).map((p) => (lots.has(p) ? p : null));
  for (const project of lots.keys()) {
    if (plots.includes(project)) continue;
    const free = plots.indexOf(null);
    if (free >= 0) plots[free] = project;
    else plots.push(project);
  }
  return plots;
}

function applyLayout() {
  const plots = computePlots();
  plots.forEach((p, i) => p && lots.get(p).setIndex(i));
  scenery.ensureRows(Math.max(1, Math.ceil(plots.length / 3)));
  landscape.ensureRows(Math.max(1, Math.ceil(plots.length / 3)));
  scenery.setStreetNames(style.streets || {});
  // Rooms stay dry and snow-free (fx.js); the room spans x −7.25…7.25, z −5.25…5.25 in each lot.
  weatherFx.setRooms([...lots.values()].map(({ group: { position: p } }) => [p.x - 7.25, p.z - 5.25, p.x + 7.25, p.z + 5.25]));
}

/** Recompute bricks and levels, then update houses, the chip and the catalog. */
function refreshProgress() {
  prog = progress(board, style);
  for (const lot of lots.values()) lot.setLevel(prog.levels[lot.project] || 1);
  commons.set(prog.commons, prog.counts.outcomes);
  progressPanel?.setData({ progress: prog, households: [...households.values()], found: style.found || {}, harvest: style.harvest || {}, gardens: style.gardens || {}, photos: photos.length, remaining: explore?.remaining ?? 0 });
  if (build?.active) build.render();
}

/** Celebrate the human's own decisions as they arrive live (never on page load, never for agent activity). */
function celebrateChanges(before, next) {
  const old = new Map(before.tasks.map((t) => [t.id, t]));
  for (const t of next.tasks) {
    if (t.status !== 'accepted' || old.get(t.id)?.status === 'accepted') continue;
    const lot = lots.get(t.project);
    if (lot) celebrations.confetti(lot.toWorld(0, 0.5));
    const reward = progress(next, style).ledger.find(e => e.kind === 'task' && e.id === t.id)?.bricks || 0;
    cheer(`You accepted “${escapeHtml(t.title)}”${reward ? ` · <b>+${reward} bricks</b>` : ' · acceptance is your review decision, not a score'}`);
  }
  const plans = new Map(before.plans.map((p) => [p.project, p]));
  for (const p of next.plans) {
    if ((p.milestones?.length || 0) <= (plans.get(p.project)?.milestones?.length || 0)) continue;
    const lot = lots.get(p.project);
    if (lot) celebrations.fireworks(lot.toWorld(0, 0));
    cheer(`<b>${escapeHtml(households.get(p.project)?.name || 'Your home')}</b> grew into a ${levelName(homeLevel(p))}! · <b>+${BRICKS.outcomeReached} bricks</b>`);
  }
}

function cheer(html, badge = '🎉') {
  const el = document.createElement('div');
  el.className = 'toast glass cheer';
  el.innerHTML = `<span class="go">${badge}</span><div class="msg">${html}</div>`;
  document.getElementById('toasts').appendChild(el);
  setTimeout(() => {
    el.classList.add('out');
    setTimeout(() => el.remove(), 350);
  }, 6000);
}

/** A business opened or upgraded while you were watching (live only, never on page load). Quiet: no sound. */
function celebrateCity(before, next) {
  for (const id of Object.keys(BUSINESSES)) {
    const was = businessTier(before, id);
    const now = businessTier(next, id);
    if (now <= was) continue;
    const at = downtown.positionOf(id);
    if (at) celebrations.confetti(at.setY(4), now >= TIERS.length ? 90 : 50);
    const days = next.signals[BUSINESSES[id].signal].count;
    const what = now === 1 ? `opened downtown` : now >= TIERS.length ? `became the ${businessName(id, now)}` : now === 2 ? 'expanded' : 'became a flagship';
    cheer(`<b>${escapeHtml(businessName(id, now === TIERS.length ? 1 : now))}</b> ${what} · <span>your agents ${escapeHtml(SIGNALS[BUSINESSES[id].signal].phrase)} on ${days} different days</span>`, '🏙️');
  }
}

/** "QA lab", or "QA lab (being built)" while it isn't open yet. */
function workplace(business) {
  const stage = businessStage(city, business);
  return `${BUSINESSES[business].name}${stage === 3 ? '' : stage ? ' (being built)' : ' (not started yet)'}`;
}

/**
 * Work roles (play layer, shared/city.mjs): residents get a role and an apron from the kind of work their
 * sessions did most (counted once per day). Helper types are interns with a lanyard until they've worked
 * HIRE_AFTER_DAYS different days in this home, then they're hired with a name.
 */
function applyRoles() {
  const team = new Map(staff(city).map((s) => [s.key, s]));
  for (const sim of sims.values()) {
    if (sim.character) {
      const person = city.people?.[residentKey(sim.lot.project, sim.character.slot)];
      const r = roleOf(person);
      sim.setRole(r ? { title: r.title, business: r.business, color: BUSINESSES[r.business].color, kind: 'apron', workplace: workplace(r.business), why: roleWhy(person, `${sim.character.name}'s sessions`) } : null);
    } else if (sim.roleName) {
      const st = team.get(helperKey(sim.lot.project, helperType(sim.roleName)));
      if (!st) sim.setRole(null);
      else if (st.hired) {
        sim.setRole({
          title: st.role?.title || 'Staff', staffName: st.name, kind: 'apron', color: st.role ? BUSINESSES[st.role.business].color : 0x5b6cf9,
          workplace: st.role ? workplace(st.role.business) : '',
          why: `Hired after this ${st.type} helper worked here on ${st.days} different days. ${roleWhy(city.people[st.key], 'it')}`,
        });
      } else {
        sim.setRole({ title: 'Intern', intern: true, kind: 'lanyard', color: 0xf2b134, why: `An intern until ${st.type} helpers have worked here on ${HIRE_AFTER_DAYS} different days (${st.days} so far). Days count, never how much they do.` });
      }
    }
  }
}

/** Everyone with a job, for the census. */
function cityPeople() {
  const out = [];
  for (const h of households.values()) {
    for (const c of h.characters) {
      const r = roleOf(city.people?.[residentKey(h.project, c.slot)]);
      if (r) out.push({ name: c.name, home: h.name, title: r.title, workplace: workplace(r.business), days: r.days, kind: 'resident' });
    }
  }
  for (const st of staff(city).sort((a, b) => Number(b.hired) - Number(a.hired))) {
    const home = households.get(st.project)?.name || st.project.split('/').pop();
    out.push(st.hired
      ? { name: `${st.name} (${st.type} helper)`, home, title: st.role?.title || 'Staff', workplace: st.role ? workplace(st.role.business) : '', days: st.days, kind: 'staff' }
      : { name: `${st.type} helper`, home, title: 'Intern', workplace: `${st.days} of ${HIRE_AFTER_DAYS} days to get hired`, days: st.days, kind: 'intern' });
  }
  return out;
}

function applyStyleAll() {
  applyLayout();
  explore?.setStyle(style);
  if (mapMode?.active) mapMode.render();
  for (const lot of lots.values()) {
    lot.applyStyle(style.homes?.[lot.project]);
    lot.setGallery(style.gallery?.[lot.project] || []);
  }
  garden?.setStyle(style);
  for (const [key, sim] of sims) if (sim.character && wardrobe?.target?.model !== sim) sim.setLook(style.residents?.[key]);
  if (wardrobe?.target?.model !== avatar) avatar.setLook(style.player);
}

async function saveStyle(change) {
  const res = await fetch('/api/style', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(change) });
  if (res.status === 404) throw new Error('Saving needs the updated bridge: restart `npm run dev`.');
  const body = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(body.error || "Couldn't save.");
}

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
  onPrompt: (sim) => openAgentChat(sim),
  onPromptKey: (key) => {focusSim(key);openAgentChat(sims.get(key));},
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
  onOutfit: (sim) => openWardrobe(sim),
  onAction: (name) => {
    if (name === 'build') build.active ? build.exit() : build.enter(selected?.lot);
    if (name === 'map') mapMode.active ? mapMode.exit() : mapMode.enter();
    if (name === 'wardrobe') openWardrobe(null);
    if (name === 'photo') photo.enter();
    if (name === 'city') census.open();
    if (name === 'rotate-left') rig.yawTarget -= Math.PI / 4;
    if (name === 'rotate-right') rig.yawTarget += Math.PI / 4;
    if (name === 'sound') sound.toggle();
    applySettings();
  },
});

function applySettings() {
  env.setMode(settings.time);
  seasons.set({ season: settings.season, weather: settings.weather });
  if (pipeline.setting !== settings.quality) pipeline.setQuality(settings.quality);
  for (const lot of lots.values()) lot.wallMode = build?.active ? 'down' : settings.walls;
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
let viewShiftY = 0;
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
  // On narrow screens, bottom sheets (wardrobe, build) cover the lower half: lift the scene above them.
  const sheet = w <= 760 && (document.body.classList.contains('dressing') || document.body.classList.contains('building'));
  const targetY = sheet ? h * 0.27 : 0;
  viewShift += (target - viewShift) * (1 - Math.exp(-dt * 6));
  viewShiftY += (targetY - viewShiftY) * (1 - Math.exp(-dt * 6));
  if (Math.abs(viewShift) < 0.5 && Math.abs(viewShiftY) < 0.5 && target === 0 && targetY === 0) camera.clearViewOffset();
  else camera.setViewOffset(w, h, viewShift, viewShiftY, w, h);
}

/** Stand the avatar beside a Sim, to the camera's right for `yaw`, so it doesn't block the view. */
function placeAvatarBeside(sim, yaw) {
  const nav = sim.lot.getNav();
  const rx = Math.cos(yaw);
  const rz = -Math.sin(yaw);
  const [i, j] = nav.nearestFree(...nav.toCell(sim.pos.x + rx * 1.6, sim.pos.y + rz * 1.6)) || nav.toCell(sim.pos.x, sim.pos.y);
  const spot = nav.center(i, j);
  const dest = sim.lot.toWorld(spot.x, spot.z).setY(0.12);
  avatar.teleport(dest.x, dest.z);
  avatar.facing = Math.atan2(sim.pos.x - spot.x, sim.pos.y - spot.z);
  return dest;
}

function focusSim(key) {
  const sim = sims.get(key);
  if (!sim) return;
  const dest = placeAvatarBeside(sim, rig.yawTarget);
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
  if (e.target.closest?.('input, textarea, select, dialog')) return;
  if (e.key === ' ' && !build.active && !photo.active) {
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
function pickDecor() {
  if (!build.lot) return null;
  raycaster.setFromCamera(pointer, camera);
  return raycaster.intersectObjects(build.lot.decor.group.children, true)[0]?.object || null;
}
renderer.domElement.addEventListener('click', () => {
  if (mapMode.active) return;
  if (build.active) return build.click(pickDecor());
  const sim = pick();
  if (sim) select(sim);
  else ui.close();
});
labels.domElement.addEventListener('click', (e) => {
  const b = e.target.closest('.bubble');
  if(b){const sim=sims.get(b.dataset.simKey);select(sim);if(e.target.closest('[data-prompt-sim]'))openAgentChat(sim);}
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
let lastRoleCheck = -10;
let frameCount = 0;
function frame() {
  const dt = Math.min(clock.getDelta(), 0.1);
  const t = clock.elapsedTime;

  const lookTarget = nearestSim(6);
  avatar.update(dt, t, rig.yaw, blockedAt, lookTarget ? lookTarget.worldPosition() : null);
  // While inspecting, the camera follows the Sim; walking hands it back to the avatar.
  if (avatar.moving) followSelected = false;
  if (build.active) panBuildFocus(dt);
  if (mapMode.active) panMapFocus(dt);
  const focus = mapMode.active ? mapFocus : build.active ? buildFocus : followSelected && selected ? selected.worldPosition().setY(0.12) : avatar.pos;
  rig.update(dt, focus);
  build.update();
  celebrations.update(dt);
  commons.update(dt, t, env.night, rig.target);
  downtown.update(dt, t, env.night, rig.target);
  landscape.update(dt, t, env.night, avatar.pos);
  streetLife.enabled = settings.streetLife !== 'off' && !mapMode.active && !build.active;
  streetLife.update(dt, t, sims.values(), city, rig.target);
  if (t - lastRoleCheck > 2) {
    lastRoleCheck = t;
    applyRoles(); // helpers learn their type from their first observed step
  }
  seasons.update(dt, t, rig.target);
  if (!mapMode.active && !build.active) explore.update(dt, t, avatar.pos);
  garden.enabled = !mapMode.active && !build.active && !photo.active;
  garden.update(dt, t, avatar.pos);
  weatherFx.update(dt, t, seasons.current(), rig.target, avatar);
  if (mapMode.active) mapMode.place();
  updateViewOffset(dt);
  env.update(rig.target);
  setLightPools(env.night);
  // Cloud shadows by day under clear skies; a rim light on characters tinted by the sky.
  fxUniforms.uCloud.value = (1 - env.night) * (1 - (env.overcast || 0));
  fxUniforms.uRimColor.value.copy(env.hemi.color).lerp(env.sun.color, 0.35);
  fxUniforms.uRimStrength.value = 0.28 + env.night * 0.3;
  scenery.update(dt, t, env.night);

  // Hover outline (only when the pointer moved, to keep raycasts cheap).
  if (pointerDirty && build.active) {
    pointerDirty = false;
    const hit = build.holding ? null : pickDecor();
    const it = hit && build.lot.decorAt(hit);
    build.hoverDecor = it?.object || null;
    renderer.domElement.style.cursor = build.holding ? 'crosshair' : it ? 'pointer' : '';
  } else if (pointerDirty) {
    pointerDirty = false;
    const h = pick();
    if (h !== hovered) {
      if (hovered) hovered.hovered = false;
      hovered = h;
      if (h) h.hovered = true;
      renderer.domElement.style.cursor = h ? 'pointer' : '';
    }
  }
  pipeline.setOutlined(build.active ? [build.hoverDecor, build.selectedObject].filter(Boolean) : [selected, hovered].filter(Boolean).map((s) => s.root));

  const near = nearestSim(3);
  const camDist = camera.position.distanceTo(rig.target);
  pipeline.setTiltStrength(photo.active ? (photo.tilt ? 0.85 : 0) : THREE.MathUtils.smoothstep(camDist, 30, 95) * 0.75);
  const busyLots = new Set();
  let waitingCount = 0;
  for (const [key, sim] of sims) {
    sim.observationConnected = bridgeReady;
    sim.expanded = sim === near;
    // Full bubbles for what matters now; a name chip (state icon + name) for everyone else; icons when far.
    const important = sim.selected || sim.hovered || sim.expanded || sim.state === 'waiting_for_user' || sim.state === 'error';
    sim.labelMode = important ? 'full' : camDist > 42 ? 'compact' : 'chip';
    sim.update(dt, t);
    if (bridgeReady && sim.state === 'running') busyLots.add(sim.lot);
    if (sim.state === 'waiting_for_user') {
      waitingCount++;
      if (bridgeReady && !sim.reminded && sim.waitSeconds > REMIND_AFTER_S) {
        sim.reminded = true;
        if (allowRoutine(sim.truth)) sound.play('reminder');
      }
    }
    if (sim.gone) {
      if (selected === sim) ui.close();
      if (hovered === sim) hovered = null;
      sim.dispose();
      sims.delete(key);
    }
  }
  for (const lot of lots.values()) {
    // Roofs never cover the home you're decorating or inspecting.
    lot.roofAllowed = !build.active && selected?.lot !== lot;
    lot.update(dt, t, { camera, night: env.night, busy: busyLots.has(lot), avatar: avatar.pos });
  }
  ui.updatePreview();

  const title = !bridgeReady ? 'Agent World · offline' : waitingCount ? `(${waitingCount}) Agent World` : 'Agent World';
  if (document.title !== title) document.title = title;
  if (t - lastClockLabel > 1) {
    lastClockLabel = t;
    ui.setClock(env.label(), env.hour, settings.time);
    ui.setNight(env.night > 0.55);
    refreshFocusChip();
    if (ui.status.dataset.state === 'live') ui.setConnection('live', liveCount());
  }
  declutter(sims.values(), camera, app.clientWidth, app.clientHeight);
  ui.setHint(selected ? null : near);
  ui.update({ sims: [...sims.values()], lots: [...lots.values()], camera, width: app.clientWidth, height: app.clientHeight, selected });

  renderer.shadowMap.needsUpdate = frameCount % 2 === 0 || build.active || photo.wantsCapture;
  pipeline.render(dt);
  if (photo.wantsCapture) photo.capture(renderer.domElement);
  labels.render(scene, camera);
  if ((frameCount = (frameCount + 1) % 4) === 0) declutterSigns(labels.domElement);
  requestAnimationFrame(frame);
}


const library = new ConversationLibrary({
  onFocus: session => { const key = sessionToSim.get(session); if (key) focusSim(key); },
  onFocusLot: project => ui.h.onFocusLot(project),
});
const work = new WorkCenter({
  onSession: session => { const key = sessionToSim.get(session); if (key) focusSim(key); },
  onHome: project => ui.h.onFocusLot(project),
  onConversations: project => library.open(project),
  focus: settings.focusProject,
  onFocus: project => { settings.focusProject = project; saveSettings(); },
});
function openAgentChat(sim){if(sim){select(sim);passCard.open(sim,{observedThread:true});}}
const passCard=new PassCard({onActivity:(run,sim)=>{const target=run? sims.get(sessionToSim.get(run.conversationSession)):sim;if(!target)return false;if(selected)selected.selected=false;selected=target;target.selected=true;followSelected=true;document.body.classList.add('inspecting');ui.open(target);return true;},residentName:(project,slot)=>households.get(project)?.characters.find(c=>c.slot===slot)?.name,onClose:()=>{if(selected)ui.open(selected);}});
document.body.classList.add('pass-workflow');
const passOpen=document.createElement('button');passOpen.className='chip glass';passOpen.id='pass-open';passOpen.textContent='Prompt agent';document.getElementById('work-open').after(passOpen);
passOpen.addEventListener('click',()=>{const sim=selected || [...sims.values()].find(s=>!s.isVisitor);if(sim)passCard.open(sim);else {const home=[...households.keys()][0];if(home)passCard.openHome(home);}});
function refreshFocusChip() {
  const f = focusState(settings.focusProject, [...households.values()]);
  document.getElementById('focus-home').textContent = f.label;
  document.getElementById('focus-status').title = f.effective ? 'Routine pings from other homes are quiet. Questions, approvals and errors still show.' : f.saved ? 'Saved home is unavailable. Notifications are not filtered.' : 'No project focus; notifications from all homes.';
  document.getElementById('focus-clear').hidden = !f.saved;
}
document.getElementById('focus-home').addEventListener('click', () => passOpen.click());
document.getElementById('focus-clear').addEventListener('click', () => { work.setFocus(''); refreshFocusChip(); });
function allowRoutine(session) {
  return shouldNotify(session, households.has(settings.focusProject) ? settings.focusProject : '');
}
function syncLibrarySessions() {
  const sessions = [...sims.values()].filter(s => s.truth).map(s => s.truth);
  library.setData({ sessions });
  work.setData({ sessions });
  passCard.setData({sessions});
  for (const lot of lots.values()) {
    const count = library.data.conversations.filter(c => c.project === lot.project).length;
    lot.setConversationCount(count);
  }
}
document.addEventListener('click', e => {
  const home = e.target.closest('[data-work-home]');
  if (home) passCard.openHome(home.dataset.workHome);
  const shelf = e.target.closest('[data-conversation-home]');
  if (shelf) library.open(shelf.dataset.conversationHome);
});

// ---- Build mode + wardrobe (customization, just for fun) --------------------------------------

const buildFocus = new THREE.Vector3();
build = new BuildMode({
  lots: () => lots,
  style: () => style,
  save: saveStyle,
  scene,
  camera,
  dom: renderer.domElement,
  pickNearest: () => {
    let best = null;
    let bestD = Infinity;
    for (const lot of lots.values()) {
      const d = lot.toWorld(0, 0).distanceTo(avatar.pos);
      if (d < bestD) [best, bestD] = [lot, d];
    }
    return best;
  },
  onToggle: (active, lot) => {
    avatar.enabled = !active;
    if (active) {
      ui.close();
      for (const l of lots.values()) l.wallMode = 'down';
      buildFocus.copy(lot.toWorld(0, 1.5)).setY(0.12);
      rig.flyTo(buildFocus, { distance: 26 });
      rig.pitch = 1.0;
    } else {
      for (const l of lots.values()) l.wallMode = settings.walls;
      rig.pitch = 0.85;
      rig.yawTarget = mapReturnYaw ?? rig.yawTarget;
      mapReturnYaw = null;
      rig.maxDistance = 60;
      env.fogScale = 1;
      rig.flyTo(avatar.pos, { distance: 22 });
    }
  },
});
build.onSelect = (object) => (build.selectedObject = object);
build.balance = () => prog.balance;

explore = new Explore({
  save: saveStyle,
  lots: () => lots,
  onFound: (kind, firstTime, count, at) => {
    celebrations.confetti(at, firstTime ? 70 : 30);
    cheer(foundMessage(kind, firstTime, count));
    refreshProgress();
  },
});

const mapFocus = new THREE.Vector3();
let mapReturnYaw = null; // set while map mode is open
mapMode = new MapMode({
  lots: () => lots,
  plots: computePlots,
  style: () => style,
  save: saveStyle,
  camera,
  onToggle: (active, center, distance) => {
    avatar.enabled = !active;
    if (active) {
      if (build.active) build.exit();
      ui.close();
      for (const l of lots.values()) l.wallMode = 'up';
      mapFocus.copy(center);
      mapReturnYaw ??= rig.yawTarget;
      rig.yawTarget = Math.round(rig.yaw / (Math.PI * 2)) * Math.PI * 2; // north up, shortest turn
      rig.flyTo(center, { distance });
      rig.maxDistance = Math.max(60, distance * 1.3);
      env.fogScale = 0.25;
      rig.pitch = 1.38;
    } else {
      for (const l of lots.values()) l.wallMode = settings.walls;
      rig.pitch = 0.85;
      rig.yawTarget = mapReturnYaw ?? rig.yawTarget;
      mapReturnYaw = null;
      rig.maxDistance = 60;
      env.fogScale = 1;
      rig.flyTo(avatar.pos, { distance: 22 });
    }
  },
});

function panMapFocus(dt) {
  const k = avatar.keys;
  let fx = 0;
  let fz = 0;
  if (k.has('w') || k.has('arrowup')) fz -= 1;
  if (k.has('s') || k.has('arrowdown')) fz += 1;
  if (k.has('a') || k.has('arrowleft')) fx -= 1;
  if (k.has('d') || k.has('arrowright')) fx += 1;
  if (!fx && !fz) return;
  const sin = Math.sin(rig.yaw);
  const cos = Math.cos(rig.yaw);
  mapFocus.x += (fx * cos + fz * sin) * 30 * dt;
  mapFocus.z += (-fx * sin + fz * cos) * 30 * dt;
}

progressPanel = new ProgressPanel({
  onPlan: (project) => work.open(project),
  onBuild: () => build.enter(),
  onAlbum: () => album.open(),
});

// Gardens and photos (play layer; docs/GAMEPLAY.md). Neither reacts to agent activity.
garden = new Garden({
  lots: () => lots,
  save: saveStyle,
  onPlant: (crop) => cheer(`Planted <b>${escapeHtml(CROPS[crop].label.toLowerCase())}</b> · ready in about ${CROPS[crop].growHours >= 24 ? `${CROPS[crop].growHours / 24} days` : `${CROPS[crop].growHours} hours`}. Nothing wilts, so harvest whenever you like.`, '🌱'),
  onHarvest: (crop, firstTime, count, at) => {
    celebrations.confetti(at, firstTime ? 70 : 30);
    const item = DECOR[CROPS[crop].unlocks].label.toLowerCase();
    cheer(firstTime
      ? `Harvested <b>${escapeHtml(CROPS[crop].label.toLowerCase())}</b>! The ${escapeHtml(item)} is now in your catalog (Harvest).`
      : `Harvested <b>${escapeHtml(CROPS[crop].label.toLowerCase())}</b> · ${count} so far`);
    refreshProgress();
  },
  onError: (message) => cheer(escapeHtml(message), '!'),
});
garden.setStyle(style);

album = new Album({
  style: () => style,
  homes: () => [...households.values()].map((h) => ({ project: h.project, name: h.name })),
  save: saveStyle,
});
album.setPhotos(photos);
photo = new PhotoMode({
  pipeline,
  onToggle: (active) => {
    if (active) {
      if (build.active) build.exit();
      if (mapMode.active) mapMode.exit();
      ui.closeMenus();
      select(null);
    }
  },
  onShutter: () => sound.play('shutter', { force: true }),
  onSaved: () => {
    const n = photos.length + 1;
    cheer(`Photo saved · <b>${n} in your album</b> · <span>hang it on a wall from the album</span>`, '📷');
  },
  openAlbum: () => album.open(),
});
photo.onError = (message) => cheer(escapeHtml(message), '!');

census = new Census({
  people: cityPeople,
  onVisit: () => {
    // Stand on main street's sidewalk; the camera follows the avatar.
    avatar.teleport(DOWNTOWN_X - 4, 8.6);
    avatar.facing = Math.PI;
    rig.flyTo(avatar.pos, { distance: 34 });
  },
});
census.setCity(city, demoMode && city.demo);
refreshProgress();

function panBuildFocus(dt) {
  const k = avatar.keys;
  let fx = 0;
  let fz = 0;
  if (k.has('w') || k.has('arrowup')) fz -= 1;
  if (k.has('s') || k.has('arrowdown')) fz += 1;
  if (k.has('a') || k.has('arrowleft')) fx -= 1;
  if (k.has('d') || k.has('arrowright')) fx += 1;
  if (!fx && !fz) return;
  const sin = Math.sin(rig.yaw);
  const cos = Math.cos(rig.yaw);
  const speed = 12 * dt;
  buildFocus.x += (fx * cos + fz * sin) * speed;
  buildFocus.z += (-fx * sin + fz * cos) * speed;
}

wardrobe = new Wardrobe({ save: saveStyle });
function openWardrobe(sim) {
  if (build.active) build.exit();
  // Swing the camera around to face whoever is being dressed.
  if (sim) {
    const key = charKey(sim.lot.project, sim.character.slot);
    wardrobe.open({ name: sim.name, model: sim, change: { kind: 'resident', key }, saved: style.residents?.[key] || null });
    rig.yawTarget = sim.facing;
    rig.distanceTarget = 7;
    placeAvatarBeside(sim, sim.facing);
  } else {
    ui.close();
    wardrobe.open({ name: 'You', model: avatar, change: { kind: 'player' }, saved: style.player || null });
    rig.yawTarget = avatar.facing;
    rig.flyTo(avatar.pos, { distance: 6 });
  }
}

const experience = new Experience({ work, leavePlay: () => { if (build.active) build.exit(); if (mapMode.active) mapMode.exit(); if (photo.active) photo.exit(); }, action: name => ui.h.onAction(name), pets: () => { if (!build.active) build.enter(selected?.lot); build.tab = 'pets'; build.render(); } });

// Debug handle for the console.
window.agentWorld = {
  garden, photo, album, weatherFx, downtown, census, streetLife, landscape, city: () => city, sims, lots, avatar, rig, sound, env, pipeline, focusSim, library, work, build, wardrobe, style: () => style, commons, seasons, explore, mapMode };

connect();
frame();
