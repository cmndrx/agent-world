import {ClaudeSignIn,CodexSignIn} from './claude-login.js';
import { HomeOverview } from './home-overview.js';
import { connectionView } from '../../shared/connections.mjs';
import {assignedRole} from '../../shared/team.mjs';
import { PassCard } from './pass-card.js';
import { Experience } from './experience.js';
import '@fontsource-variable/nunito';
import * as THREE from 'three';
import { runnerActivity } from '../../shared/runner-activity.mjs';
import { CSS2DObject, CSS2DRenderer } from 'three/addons/renderers/CSS2DRenderer.js';
import { CameraRig } from './camera.js';
import { Player } from './player.js';
import { Environment } from './environment.js';
import { Lot } from './lot.js';
import { Pipeline } from './pipeline.js';
import { Scenery } from './scenery.js';
import { Sim, separateSims } from './sim.js';
import { FloorPicker } from './floor-picker.js';
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
import { MayorOnboarding } from './onboarding.js';
import { mountDevReset } from './dev-reset.js';
import { Levels, xpMarkup } from './levels.js';
import { MayorCharacter } from './mayor-character.js';
import { emptyGameplay, townHallState, visibleResidents } from '../../shared/gameplay.mjs';
import { escapeHtml } from './sim.js';
import { Commons } from './commons.js';
import { Seasons } from './seasons.js';
import { Explore, foundMessage } from './explore.js';
import { TownPlanner } from './town-planner.js';
import { BUILDABLE, eligiblePlots, emptyTown, homeTransform, tilesRect } from '../../shared/town.mjs';
import { WeatherFx, fxUniforms } from './fx.js';
import { Garden } from './garden.js';
import { Album, PhotoMode } from './photo.js';
import { CivicBuildings } from './civic.js';
import { Landscape } from './landscape.js';
import { declutter, declutterSigns } from './declutter.js';
import { HIRE_AFTER_DAYS, emptyCity, helperKey, helperType, residentKey, roleOf, roleWhy, staff } from '../../shared/city.mjs';
import { CROPS } from '../../shared/garden.mjs';
import { DECOR } from '../../shared/style.mjs';

// ---- Settings (per viewer, local only) ---------------------------------------------------

const SETTINGS_KEY = 'agent-world:settings';
const settings = { time: 'auto', walls: 'cutaway', quality: 'auto', roster: 'open', focusProject: '', season: 'auto', weather: 'auto' };
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
// The town layout (shared/town.mjs): streets and plots, from the bridge. Rendering, labels, picking and
// navigation all read this one record.
let town = emptyTown();
const scenery = new Scenery(scene);
scenery.setTown(town);
// Phase 3 (docs/GAMEPLAY.md): town square, seasons and weather (ambience).
const commons = new Commons(scene);
const mayorCharacter = new MayorCharacter(commons);
const seasons = new Seasons(scene, env, scenery);
seasons.set({ season: settings.season, weather: settings.weather });
const weatherFx = new WeatherFx(scene);
// The world around the neighborhood (scenery only): groves, pond, cars, birds, skyline.
const landscape = new Landscape(scene);
landscape.setTown(town);
// Civic buildings the player placed (fire station, hospital, …): shared/town.mjs, unlocked by player level.
const civic = new CivicBuildings(scene);
// The work ledger (play layer): kinds of work per day, which gives residents their roles (shared/city.mjs).
let city = emptyCity();
let demoMode = false;
let bridgeReady = false;

// ---- World state --------------------------------------------------------------------------

const lots = new Map(); // project -> Lot
const sims = new Map(); // key -> Sim
const sessionToSim = new Map(); // session id -> sim key
let selectedProjects=new Set();
let emptyLot=null;
const households = new Map(); // project -> household

const charKey = (project, slot) => `${project}#${slot}`;
// Customization (decor, paint, outfits): simulation layer only. See docs/GAMEPLAY.md.
let style = emptyStyle();
let build = null; // BuildMode, created below
let explore = null; // Explore, created below
let planner = null; // TownPlanner (Plan town), created below
let garden = null; // Garden, created below
let photo = null; // PhotoMode, created below
let album = null; // Album, created below
let photos = []; // photo album (newest first)
// Progression (phase 2): derived from the human's board + style; see shared/progression.mjs.
let board = { tasks: [], plans: [] };
let gameplay = emptyGameplay();
let gameplayLoaded = false;
let prog = progress(board, style, gameplay);
let progressPanel = null; // created below
let mayor = null;
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
  }
  return lot;
}

function applyHousehold(h) {
  if(selectedProjects!==null&&!selectedProjects.has(h.project))return;
  const residents = new Set(h.characters.map(c => charKey(h.project, c.slot)));
  for (const [key, sim] of sims) {
    if (sim.lot.project !== h.project || (sim.isVisitor ? residents.has(sim.parent?.key) : residents.has(key))) continue;
    if (selected === sim) { select(null); ui.close(); }
    sim.dispose();
    sims.delete(key);
    for (const [id, mapped] of sessionToSim) if (mapped === key) sessionToSim.delete(id);
  }
  if(emptyLot){scene.remove(emptyLot);emptyLot.traverse(o=>{if(o.isCSS2DObject)o.element.remove();o.geometry?.dispose();o.material?.dispose();});emptyLot=null;}
  households.set(h.project, h);
  ui.projectsPanel.setHomes([...households.values()]);
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
  lot.residentSlots = new Map(h.characters.map((c,i)=>[c.slot,i+1]));
  lot.ensureDesks(h.characters.length);
  lot.setConstruction(h.construction);
  for (const c of h.characters) {
    const key = charKey(h.project, c.slot);
    let sim = sims.get(key);
    if (!sim) {
      // A resident added to a home that was already here (not first load) has just been recruited: they move in.
      const movingIn = !isNew && !firstSnapshot && !replaying && knownResidents.has(h.project);
      sim = new Sim({ key, lot, character: c, seed: c.seed, arriving: movingIn });
      sims.set(key, sim);
      sim.setTruth(null);
      sim.setLook(style.residents?.[key]);
      if (movingIn) welcomeResident(sim, h);
    } else {
      sim.receiveCare(c, replaying || firstSnapshot);
      sim.character = c;
    }
  }
  knownResidents.add(h.project);
  applyRoles();
  if (!replaying) passCard.setData({households:[...households.values()]});
}

/** Housewarming: confetti at the gate, a welcome toast, and confetti again when they reach their spot. */
const knownResidents = new Set();
function welcomeResident(sim, h) {
  const door = sim.lot.toWorld(sim.lot.stations.entrance.x, sim.lot.stations.entrance.z);
  celebrations.confetti(door.clone().setY(1.6), 70);
  sound.play('reminder');
  cheer(`<b>${escapeHtml(sim.name)}</b> moved in to <b>${escapeHtml(h.name || h.project.split('/').pop())}</b>! Welcome home.`, '🏡');
  sim.onArrive = (s) => { const p = s.worldPosition(); p.y += 2.2; celebrations.confetti(p, 45); };
}

const observedSessions = new Map();
let activityRuns = [];
function syncRunnerActivity() {
  if (!gameplay.connection) return;
  const fallbacks = runnerActivity(activityRuns, [...observedSessions.values()]);
  const live = new Set(fallbacks.map(s => s.session));
  for (const id of [...sessionToSim.keys()]) {
    if (id.startsWith('runner:') && !live.has(id)) {
      renderSessionEnd(id);
      for (const s of observedSessions.values()) renderSession(s);
    }
  }
  for (const s of fallbacks) renderSession(s);
}
function applySession(s) {
  observedSessions.set(s.session, s);
  renderSession(s);
  syncRunnerActivity();
}
function renderSession(s) {
  if(selectedProjects!==null&&!selectedProjects.has(s.project))return;
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
  const previousKey = sessionToSim.get(s.session);
  if (previousKey && previousKey !== key) {
    const previous = sims.get(previousKey);
    if (previous?.truth?.session === s.session) previous.setTruth(null);
  }
  sessionToSim.set(s.session, key);
  const sim = sims.get(key);
  if (sim.truth?.session !== s.session && sim.truth?.lastEventAt > s.lastEventAt && sim.truth?.activityEvidence !== 'game-runner' && s.activityEvidence !== 'game-runner') return;
  const before = sim.state;
  sim.setTruth(s);
  sim.observationConnected = bridgeReady;
  syncLibrarySessions();
  if (bridgeReady && !replaying && allowRoutine(s) && sim.state === 'waiting_for_user' && before !== 'waiting_for_user') {
    sound.play('permission');
    ui.toast(sim);
  }
}

function endSession(sessionId) {
  observedSessions.delete(sessionId);
  renderSessionEnd(sessionId);
  syncRunnerActivity();
}
function renderSessionEnd(sessionId) {
  const key = sessionToSim.get(sessionId);
  sessionToSim.delete(sessionId);
  const sim = key && sims.get(key);
  if (!sim) return;
  if (sim.isVisitor) sim.leave();
  else if (sim.truth?.session === sessionId) sim.setTruth(null);
  syncLibrarySessions();
}

function applySnapshot({ selectedProjects: chosen=null, households: hs, sessions, projects = [], conversations = [], plans = [], tasks = [], passes, runner, town: layout }) {
  if (layout) { town = layout; ui.projectsPanel.setTown(town); }
  observedSessions.clear();
  activityRuns = passes?.runs || [];
  selectedProjects=chosen===null?null:new Set(chosen);
  const visible=p=>selectedProjects===null||selectedProjects.has(p.project);
  hs=hs.filter(visible);sessions=sessions.filter(visible);projects=projects.filter(p=>selectedProjects===null||selectedProjects.has(p.home));conversations=conversations.filter(visible);plans=plans.filter(visible);tasks=tasks.filter(visible);
  const { households: visibleHouseholds, sessions: visibleSessions } = visibleResidents(gameplay, hs, sessions);
  if(!hs.length&&!emptyLot){
    emptyLot=new THREE.Group();
    const plot=new THREE.Mesh(new THREE.BoxGeometry(22,.15,20),new THREE.MeshStandardMaterial({color:0x96b782,roughness:1}));plot.receiveShadow=true;emptyLot.add(plot);
    const button=document.createElement('button');button.className='first-project-lot';button.textContent='Build your first home';button.addEventListener('click',()=>{if(townHallState(gameplay).status!=='built'){mayor.open();return;}planner.openProjects();});
    const label=new CSS2DObject(button);label.position.set(0,1.5,0);emptyLot.add(label);scene.add(emptyLot);
  }
  passCard.setData({passes,runner,tasks,households:visibleHouseholds,sessions:visibleSessions,conversations});
  work.setData({ households:hs, plans, tasks, conversations });
  library.setData({ households:hs, projects, conversations });
  replaying = true;
  visibleHouseholds.forEach(applyHousehold);
  const live = new Set(visibleSessions.map((s) => s.session));
  for (const id of [...sessionToSim.keys()]) if (!live.has(id)) endSession(id);
  // Primary sessions first so visitors can find their parent.
  [...visibleSessions].sort((a, b) => (a.parent_session ? 1 : 0) - (b.parent_session ? 1 : 0)).forEach(applySession);
  replaying = false;
  applyLayout();
  syncRunnerActivity();
  levels.setData(passes?.runs || []);
  syncLibrarySessions();
  // Don't fire "still waiting" reminders for waits that began before we connected.
  for (const sim of sims.values()) if (sim.waitSeconds > REMIND_AFTER_S) sim.reminded = true;

  if (firstSnapshot) {
    firstSnapshot = false;
    // Start at the lot that most needs attention, else the busiest, else the first.
    const all = [...sims.values()];
    const pick = all.find((s) => s.state === 'waiting_for_user') || all.find((s) => s.truth) || all[0];
    if (pick) camFocus.copy(pick.lot.toWorld(0, 2)).setY(0.12);
    setTimeout(() => {
      ui.hideIntro();
      if (mayor?.dialog.open) focusTownHall();
      else lookAt(camFocus, { distance: 24, duration: 2.4 });
    }, 250);
  }
}

function hashStr(s) {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (Math.imul(h, 31) + s.charCodeAt(i)) | 0;
  return h >>> 0;
}

// ---- Bridge connection -----------------------------------------------------------------

let providerConnections = null;
function refreshProviderConnections() {
  const view = connectionView(providerConnections, bridgeReady);
  ui.setConnection(bridgeReady ? 'live' : ui.connectionState || 'connecting', view);
  experience?.setConnections(view);
}
function connect() {
  ui.setConnection('connecting');
  const es = new EventSource('/api/stream');
  es.onopen = () => setBridgeConnection(false, 'connecting');
  es.onerror = () => setBridgeConnection(false, 'offline');
  es.onmessage = (msg) => {
    const m = JSON.parse(msg.data);
    if (m.type === 'game-reset') {
      localStorage.removeItem('agent-world:mayor-martin-seen');
      location.reload();
      return;
    }
    if (m.type === 'snapshot') {
      providerConnections = m.connections || null;
      ui.setDemo(!!m.demo);
      style = m.style || emptyStyle();
      gameplay = m.gameplay || emptyGameplay();
      gameplayLoaded = true;
      photos = m.photos || [];
      city = m.city || emptyCity();
      demoMode = !!m.demo;
      album?.setPhotos(photos);
      board = { tasks: m.tasks || [], plans: m.plans || [] };
      applySnapshot(m);
      setBridgeConnection(true, 'live');
      applyStyleAll();
      refreshProgress();
    }
    else if (m.type === 'connections') { providerConnections = m.connections; refreshProviderConnections(); }
    else if (m.type === 'style') { style = m.style || emptyStyle(); applyStyleAll(); refreshProgress(); if (build.active) build.render(); }
    else if (m.type === 'gameplay') applyGameplay(m.gameplay);
    else if (m.type === 'city') {
      city = m.city || emptyCity();
      if (gameplay.connection) applyRoles();
    }
    else if (m.type === 'photos') { photos = m.photos || []; album?.setPhotos(photos); }
    else if (m.type === 'town') { town = m.town || emptyTown(); applyLayout(); planner?.refresh(); ui.projectsPanel.setTown(town); }
    else if (m.type === 'catalog') { if(selectedProjects!==null){m.projects=m.projects.filter(p=>selectedProjects.has(p.home));m.conversations=m.conversations.filter(p=>selectedProjects.has(p.project));} library.setData({ projects: m.projects, conversations: m.conversations }); work.setData({ conversations: m.conversations }); passCard.setData({conversations:m.conversations}); syncLibrarySessions(); }
    else if (m.type === 'passes') { passCard.setData(m); activityRuns = m.passes?.runs || []; syncRunnerActivity(); levels.setData(m.passes?.runs || []); }
    else if (m.type === 'productivity') {
      passCard.setData({tasks:m.tasks});
      work.setData({ plans: m.plans, tasks: m.tasks });
      const next = { tasks: m.tasks || [], plans: m.plans || [] };
      celebrateChanges(board, next);
      board = next;
      refreshProgress();
    }
    else if(m.type==='selected-projects'){
      const removed=selectedProjects===null?[]:[...selectedProjects].filter(p=>!m.projects.includes(p));selectedProjects=new Set(m.projects);
      for(const project of removed){
        if(selected?.lot.project===project){select(null);ui.close();}
        for(const [key,sim] of sims)if(sim.lot.project===project){sim.dispose();sims.delete(key);for(const [id,k] of sessionToSim)if(k===key)sessionToSim.delete(id);}
        const lot=lots.get(project);if(lot){scene.remove(lot.group);lot.group.traverse(o=>{if(o.isCSS2DObject)o.element.remove();});lots.delete(project);}
        households.delete(project);
      }
      if(removed.length){if(!households.size)camFocus.set(0,.12,0);ui.projectsPanel.setHomes([...households.values()]);applyLayout();explore?.sync();fetch('/api/state').then(r=>r.json()).then(applySnapshot).catch(()=>setBridgeConnection(false,'offline'));}
    }
    else if (m.type === 'household' && gameplay.connection) { applyHousehold(m.household); levels.setData(passCard.data.runs || []); }
    else if (m.type === 'session' && gameplay.connection) applySession(m.session);
    else if (m.type === 'session_end' && gameplay.connection) endSession(m.session);
  };
}
function applyGameplay(next) {
  const wasConnected = !!gameplay.connection;
  gameplay = next || emptyGameplay();
  refreshProgress();
  if (!wasConnected && gameplay.connection) {
    fetch('/api/state').then(response => response.ok ? response.json() : null).then(snapshot => {
      if (snapshot && gameplay.connection) applySnapshot(snapshot);
    }).catch(() => {});
  }
}
function setBridgeConnection(ready, state) {
  bridgeReady = ready;
  document.body.dataset.observation = ready ? 'live' : state;
  ui.setConnection(state, connectionView(providerConnections, ready));
  experience?.setConnections(connectionView(providerConnections, ready)); library.setConnection(ready); work.setConnection(ready);
  passCard.setData({connected:ready});
  for (const sim of sims.values()) sim.observationConnected = ready;
  if (typeof experience !== 'undefined') experience.refreshConnection();
}
setInterval(refreshProviderConnections, 1000);

/** Put every home on its plot from the town layout; streets and street furniture follow the same record. */
function applyLayout() {
  const placed = new Map(town.homes.filter((h) => h.i != null).map((h) => [h.project, h]));
  for (const lot of lots.values()) {
    const h = placed.get(lot.project);
    // A home waiting for a plot (an unresolved migration) stays saved but off the map until you choose one.
    lot.unplaced = !h;
    lot.group.visible = !!h;
    if (h) lot.setPlacement(homeTransform(h));
  }
  scenery.setTown(town);
  landscape.setTown(town);
  civic.setTown(town);
  // Rooms stay dry and snow-free (fx.js); the room spans x −7.25…7.25, z −5.25…5.25 in each lot (turned with it).
  weatherFx.setRooms([...lots.values()].filter((l) => !l.unplaced).map((l) => {
    const p = l.group.position, turned = Math.abs(Math.sin(l.yaw || 0)) > 0.5, [hx, hz] = turned ? [5.25, 7.25] : [7.25, 5.25];
    return [p.x - hx, p.z - hz, p.x + hx, p.z + hz];
  }).concat(civic.rooms()));
  if (emptyLot) {
    const first = eligiblePlots(town, { limit: 1 })[0];
    if (first) { const t = homeTransform(first); emptyLot.position.set(t.x, 0, t.z); emptyLot.rotation.y = t.yaw; }
  }
}

/** Recompute gems and levels, then update houses, the chip and the catalog. */
function refreshProgress() {
  prog = progress(gameplay.connection ? {...board, households:[...households.values()], residentExperience:levels.data.residents} : { tasks: [], plans: [] }, gameplay.connection ? style : emptyStyle(), gameplay);
  ui.setGameLinked(!!gameplay.connection);
  for (const lot of lots.values()) {
    const next = prog.levels[lot.project] || 1, previous = lot.level;
    lot.setLevel(next);
    if (!firstSnapshot && previous >= 1 && next > previous) {
      celebrations.confetti(lot.toWorld(0, 0));
      cheer(`<b>${escapeHtml(households.get(lot.project)?.name || 'Your home')}</b> reached home level ${next} · ${levelName(next)}!`);
    }
  }
  const hallStatus = townHallState(gameplay).status;
  ui.projectsPanel.setTownHallReady(hallStatus === 'built');
  ui.projectsPanel.setGameState(gameplay, prog.balance);
  commons.set(prog.commons, prog.counts.outcomes, hallStatus, gameplay.townhall?.readyAt);
  if (gameplayLoaded) mayorCharacter.setTownHallStatus(hallStatus);
  mayorCharacter.setConnection(gameplay.connection?.provider);
  progressPanel?.setData({ progress: prog, gameplay, households: gameplay.connection ? [...households.values()] : [], found: style.found || {}, harvest: style.harvest || {}, gardens: style.gardens || {}, photos: photos.length, remaining: explore?.remaining ?? 0 });
  mayor?.setData(gameplay, prog.balance, [...households.values()], passCard.data?.runs || []);
  if (build?.active) build.render();
}

/** Celebrate the human's own decisions as they arrive live (never on page load, never for agent activity). */
function celebrateChanges(before, next) {
  const old = new Map(before.tasks.map((t) => [t.id, t]));
  for (const t of next.tasks) {
    if (t.status !== 'accepted' || old.get(t.id)?.status === 'accepted') continue;
    const lot = lots.get(t.project);
    if (lot) celebrations.confetti(lot.toWorld(0, 0.5));
    const reward = progress(next, style, gameplay).ledger.find(e => e.kind === 'task' && e.id === t.id)?.bricks || 0;
    cheer(`You accepted “${escapeHtml(t.title)}”${reward ? ` · <b>+${reward} gems</b>` : ' · acceptance is your review decision, not a score'}`);
  }
  const plans = new Map(before.plans.map((p) => [p.project, p]));
  for (const p of next.plans) {
    if ((p.milestones?.length || 0) <= (plans.get(p.project)?.milestones?.length || 0)) continue;
    const lot = lots.get(p.project);
    if (lot) celebrations.fireworks(lot.toWorld(0, 0));
    cheer(`<b>${escapeHtml(households.get(p.project)?.name || 'Your home')}</b> reached an outcome! · <b>+${BRICKS.outcomeReached} gems</b>`);
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
      const fixed=assignedRole(sim.character.assignedRole);
      if(fixed){sim.setRole({...fixed,workplace:'Project team',why:'Assigned project responsibility, not an inferred activity score.'});continue;}
      const r = roleOf(person);
      sim.setRole(r ? { title: r.title, color: r.color, kind: 'apron', why: roleWhy(person, `${sim.character.name}'s sessions`) } : null);
    } else if (sim.roleName) {
      const st = team.get(helperKey(sim.lot.project, helperType(sim.roleName)));
      if (!st) sim.setRole(null);
      else if (st.hired) {
        sim.setRole({
          title: st.role?.title || 'Staff', staffName: st.name, kind: 'apron', color: st.role?.color ?? 0x5b6cf9,
          why: `Hired after this ${st.type} helper worked here on ${st.days} different days. ${roleWhy(city.people[st.key], 'it')}`,
        });
      } else {
        sim.setRole({ title: 'Intern', intern: true, kind: 'lanyard', color: 0xf2b134, why: `An intern until ${st.type} helpers have worked here on ${HIRE_AFTER_DAYS} different days (${st.days} so far). Days count, never how much they do.` });
      }
    }
  }
}

function applyStyleAll() {
  applyLayout();
  explore?.setStyle(style);
  if (planner?.active) planner.render();
  for (const lot of lots.values()) {
    lot.applyStyle(style.homes?.[lot.project]);
    lot.setGallery(style.gallery?.[lot.project] || []);
  }
  garden?.setStyle(style);
  for (const [key, sim] of sims) if (sim.character && wardrobe?.target?.model !== sim) sim.setLook(style.residents?.[key]);
  if (wardrobe?.target?.model !== player) player.setLook(style.player);
}

async function saveStyle(change) {
  const res = await fetch('/api/style', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(change) });
  if (res.status === 404) throw new Error('Saving needs the updated bridge: restart `npm run dev`.');
  const body = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(body.error || "Couldn't save.");
}

// ---- Player, camera, UI ---------------------------------------------------------------------

// You're a picture in the top bar, not a character in the world: the camera is how you get around.
const player = new Player({ onOpen: () => openWardrobe(null) });
const levels = new Levels(() => [...households.values()], {
  onPlayer: (l) => player.setLevel(l.level),
  onChange: () => { refreshProgress(); if (wardrobe?.target?.change?.kind === 'player') wardrobe.render(); },
});
const camFocus = new THREE.Vector3(0, 0.12, 0); // what the free camera looks at
const rig = new CameraRig(camera, renderer.domElement, {
  // Dragging moves whatever the current mode is looking at; grabbing the map stops following a Sim.
  panTarget: () => {
    if (planner?.active) return mapFocus;
    if (build?.active) return buildFocus;
    if (followSelected) {
      followSelected = false;
      camFocus.copy(rig.target).setY(0.12);
    }
    return camFocus;
  },
});
rig.distance = rig.distanceTarget = 80; // intro starts high; flies in on the first snapshot
rig.pitch = 1.0;
let selected = null;
let hovered = null;

/** Where the camera may pan: homes, the square and civic buildings, plus a little margin. */
const worldBounds = new THREE.Box3();
const planBounds = (() => { const [x0, z0, x1, z1] = tilesRect(BUILDABLE.i0, BUILDABLE.j0 - 4, BUILDABLE.i1, BUILDABLE.j1); return new THREE.Box3(new THREE.Vector3(x0 - 8, 0, z0 - 8), new THREE.Vector3(x1 + 8, 0, z1 + 8)); })();
function updateWorldBounds() {
  worldBounds.makeEmpty();
  for (const g of [...[...lots.values()].map((l) => l.group), commons?.group, civic?.group]) if (g) worldBounds.expandByObject(g);
  if (!worldBounds.isEmpty()) worldBounds.expandByVector(new THREE.Vector3(6, 0, 6));
}

/** Glide the free camera to a point (and stay there). */
function lookAt(point, { distance = rig.distanceTarget, duration } = {}) {
  followSelected = false;
  camFocus.copy(point).setY(0.12);
  rig.flyTo(camFocus, { distance, duration });
}
function focusTownHall() {
  lookAt(commons.hallFocus(), { distance: 34, duration: 1.6 });
}

const ui = new UI({
  xpFor: (sim) => { const xp = sim.character ? levels.resident(sim.lot.project, sim.character.slot) : null; sim.residentLevel = xp?.level; return xp; },
  onRename: async (sim, name) => {
    await fetch('/api/rename', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ project: sim.lot.project, slot: sim.character.slot, name }),
    });
  },
  browserRun: (sim) => (passCard.data?.runs || []).findLast((r) => r.project === sim.lot.project && r.slot === sim.character.slot && ['codex', 'claude'].includes(r.provider || 'codex')),
  onFocus: (key) => focusSim(key),
  onPrompt: (sim) => openAgentChat(sim),
  onFocusLot: (project) => {
    if (planner?.active) return planner.focusHome(project);
    const lot = lots.get(project);
    if (!lot) return;
    lookAt(lot.toWorld(0, 2), { distance: Math.min(Math.max(rig.distanceTarget, 24), 34) });
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
    if (name === 'map') planner.active ? planner.exit() : planner.enter();
    if (name === 'wardrobe') openWardrobe(null);
    if (name === 'photo') photo.enter();
    if (name === 'city') planner.active && planner.tool === 'civic' ? planner.exit() : planner.enter('civic');
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
  commons.wallMode = build?.active ? 'down' : settings.walls;
  civic.wallMode = build?.active ? 'down' : settings.walls;
  document.getElementById('roster').classList.toggle('collapsed', settings.roster === 'collapsed');
  ui.renderDock(settings, sound.enabled, pipeline.level);
}
pipeline.onDowngrade = () => ui.renderDock(settings, sound.enabled, pipeline.level);

let followSelected = false;
/** The home being looked into (followed resident's, else the one in the middle of the screen) and its floor picker. */
let inspectedLot = null;
const floorPicker = new FloorPicker({ onPick: (lot, floor) => lot.setViewFloor(floor) });

function select(sim) {
  if (selected) selected.selected = false;
  // Letting go of a Sim leaves the camera where it is.
  if (!sim && followSelected) camFocus.copy(rig.target).setY(0.12);
  selected = sim;
  followSelected = !!sim;
  document.body.classList.toggle('inspecting', !!sim);
  if (sim) {
    sim.selected = true;
    // In a multi-floor home, show the floor this resident lives on.
    sim.lot.setViewFloor(sim.floor);
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
    // While planning, the open Projects drawer takes the roster's place on the left.
    const ledger = planner?.active && planner.el.classList.contains('ledger-open') ? planner.el.querySelector('.tp-ledger') : null;
    const left = ledger ? ledger.offsetWidth + 16 : roster.classList.contains('collapsed') || getComputedStyle(roster).width === '168px' || !roster.offsetWidth ? 0 : roster.offsetWidth + 16;
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

function focusSim(key) {
  const sim = sims.get(key);
  if (!sim) return;
  rig.flyTo(sim.worldPosition().setY(0.12), { distance: Math.min(rig.distanceTarget, 15) });
  select(sim);
}

const tmpV = new THREE.Vector3();
/** The Sim nearest the middle of the screen, when zoomed in close enough to mean it. */
function nearestSim(maxDist) {
  if (rig.distance > 30 || build.active || planner.active) return null;
  let best = null;
  let bestD = maxDist;
  for (const sim of sims.values()) {
    const d = sim.worldPosition().setY(0).distanceTo(tmpV.set(rig.target.x, 0, rig.target.z));
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
const lastClient = { x: -1, y: -1 };
function setPointer(e) {
  lastClient.x = e.clientX;
  lastClient.y = e.clientY;
  const rect = renderer.domElement.getBoundingClientRect();
  pointer.set(((e.clientX - rect.left) / rect.width) * 2 - 1, -((e.clientY - rect.top) / rect.height) * 2 + 1);
  pointerDirty = true;
}
renderer.domElement.addEventListener('pointermove', setPointer);
renderer.domElement.addEventListener('pointerleave', () => {
  pointer.set(9, 9);
  lastClient.x = -1;
  pointerDirty = true;
});
function pick() {
  raycaster.setFromCamera(pointer, camera);
  // Residents on floors that aren't being inspected are hidden, and the raycaster ignores visibility.
  const hit = raycaster.intersectObjects([...sims.values()].filter((s) => s.root.visible).map((s) => s.root), true)[0];
  return hit ? sims.get(hit.object.userData.simKey) : null;
}
function pickMayor() {
  raycaster.setFromCamera(pointer, camera);
  return raycaster.intersectObject(mayorCharacter.world.root, true).some(hit => hit.object.userData.mayor);
}
function pickFind() {
  raycaster.setFromCamera(pointer, camera);
  return raycaster.intersectObjects(explore.hitTargets(), false)[0]?.object.userData.findId || null;
}
/** Does a home's building stand between the camera and a point (so its upper floors should open)? */
function blocksView(lot, from, to) {
  if (!(lot.roofTop > 6)) return false;
  for (let i = 1; i < 16; i++) {
    const k = i / 16;
    const { x, z } = lot.toLocal(from.x + (to.x - from.x) * k, from.z + (to.z - from.z) * k);
    const y = from.y + (to.y - from.y) * k;
    if (Math.abs(x) < 7.8 && Math.abs(z) < 6 && y < lot.roofTop + 0.5) return true;
  }
  return false;
}
/** The home whose lot is under a screen point, if any. */
function lotAt(clientX, clientY) {
  const p = rig.groundAt(clientX, clientY);
  if (!p) return null;
  for (const lot of lots.values()) if (!lot.unplaced && lot.containsWorld(p.x, p.z)) return lot;
  return null;
}
function pickDecor() {
  if (!build.lot) return null;
  raycaster.setFromCamera(pointer, camera);
  return raycaster.intersectObjects(build.lot.decor.group.children, true)[0]?.object || null;
}
renderer.domElement.addEventListener('click', (e) => {
  if (rig.suppressClick || planner.active) return;
  setPointer(e);
  if (build.active) return build.click(pickDecor());
  if (!photo.active && pickMayor()) { mayor.open(); return; }
  const find = !photo.active && pickFind();
  if (find) return explore.collect(find);
  const sim = pick();
  if (sim) select(sim);
  else ui.close();
});
// Double-click a home to glide in and look inside (the roof lifts as you get close).
renderer.domElement.addEventListener('dblclick', (e) => {
  if (planner.active || build.active || photo.active) return;
  setPointer(e);
  const sim = pick();
  if (sim) return focusSim(sim.key);
  const lot = lotAt(e.clientX, e.clientY);
  if (lot) lookAt(lot.toWorld(0, 1.5), { distance: 22 });
  else {
    const p = rig.groundAt(e.clientX, e.clientY);
    if (commons.containsTownHall(p)) focusTownHall();
    else if (p) lookAt(p, { distance: Math.max(16, rig.distanceTarget * 0.7) });
  }
});
labels.domElement.addEventListener('click', (e) => {
  const street = e.target.closest('[data-street-id]');
  if (street) { if (planner.active) planner.startRename(street.dataset.streetId); else planner.enter('road'); return; }
  if (e.target.closest('[data-home-detail]')) { planner.openProjects(); return; }
  if (e.target.closest('[data-mayor-world], [data-townhall-detail]')) { mayor.open(); return; }
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

  rig.keyPan(dt);
  // Panning stays over the neighborhood instead of drifting off into empty fields.
  // Plan town can pan over all buildable land (that's where new streets and homes go).
  const panBounds = planner.active ? planBounds : worldBounds;
  if (rig.panned && !panBounds.isEmpty()) for (const v of [camFocus, buildFocus, mapFocus]) {
    v.x = THREE.MathUtils.clamp(v.x, panBounds.min.x, panBounds.max.x);
    v.z = THREE.MathUtils.clamp(v.z, panBounds.min.z, panBounds.max.z);
  }
  rig.panned = false;
  const focus = planner.active ? mapFocus : build.active ? buildFocus : followSelected && selected ? selected.worldPosition().setY(0.12) : camFocus;
  // Zoom out far enough to see the tallest home whole; the view rises with it so towers stay in frame.
  if (!planner.active && !build.active) {
    const tallest = Math.max(0, ...[...lots.values()].map((l) => l.roofTop || 0));
    rig.maxDistance = Math.max(70, Math.min(110, tallest * 1.6 + 28));
    rig.distanceTarget = Math.min(rig.distanceTarget, rig.maxDistance);
    // Inspecting an upper floor raises the view to that floor.
    const open = inspectedLot && inspectedLot.roofK <= 0.3 ? inspectedLot : null;
    const floorLift = open ? open.floorY(open.viewFloor) : 0;
    const zoomLift = THREE.MathUtils.smoothstep(rig.distance, 30, rig.maxDistance) * Math.min(18, tallest * 0.45);
    rig.lift += (Math.max(zoomLift, floorLift) - rig.lift) * (1 - Math.exp(-dt * 6));
  } else rig.lift = 0;
  rig.update(dt, focus);
  build.update();
  planner.update(dt, t);
  celebrations.update(dt);
  commons.peek = commons.containsTownHall(rig.target) && !planner.active;
  commons.update(dt, t, env.night, rig.target, camera, rig.maxDistance - 16);
  mayorCharacter.update(t, !!mayor?.dialog.open, dt);
  civic.update(dt, t, { night: env.night, camera, target: rig.target, peekOpen: rig.maxDistance - 16 });
  landscape.update(dt, t, env.night, null);
  if (t - lastRoleCheck > 2) {
    lastRoleCheck = t;
    updateWorldBounds();
    applyRoles(); // helpers learn their type from their first observed step
  }
  seasons.update(dt, t, rig.target);
  if (!planner.active && !build.active) explore.update(dt, t);
  garden.enabled = !planner.active && !build.active && !photo.active;
  garden.update(dt, t, rig.target, rig.distance < 34);
  weatherFx.update(dt, t, seasons.current(), rig.target, null);
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
    // The home under the pointer nudges its roof up (a hint that double-click looks inside).
    const hoverLot = !photo.active && !planner.active && lastClient.x >= 0 ? lotAt(lastClient.x, lastClient.y) : null;
    commons.hovered = !photo.active && !planner.active && lastClient.x >= 0 && commons.containsTownHall(rig.groundAt(lastClient.x, lastClient.y));
    for (const lot of lots.values()) lot.hovered = lot === hoverLot;
    if (h !== hovered) {
      if (hovered) hovered.hovered = false;
      hovered = h;
      if (h) h.hovered = true;
    }
    renderer.domElement.style.cursor = h || (!photo.active && (pickMayor() || pickFind())) ? 'pointer' : '';
  }
  pipeline.setOutlined(build.active ? [build.hoverDecor, build.selectedObject].filter(Boolean) : [selected, hovered].filter(Boolean).map((s) => s.root));

  const near = nearestSim(3);
  const camDist = camera.position.distanceTo(rig.target);
  pipeline.setTiltStrength(photo.active ? (photo.tilt ? 0.85 : 0) : planner.active ? 0.12 : THREE.MathUtils.smoothstep(camDist, 30, 95) * 0.75); // planning keeps the whole map sharp
  const busyLots = new Set();
  let waitingCount = 0;
  separateSims(sims.values(), dt);
  for (const [key, sim] of sims) {
    sim.observationConnected = bridgeReady;
    sim.expanded = sim === near;
    // Full bubbles for what matters now; a name chip (state icon + name) for everyone else; icons when far.
    const important = sim.selected || sim.hovered || sim.expanded || sim.state === 'waiting_for_user' || sim.state === 'error';
    sim.labelMode = important ? 'full' : camDist > 42 ? 'compact' : 'chip';
    sim.detailSuppressed = camDist > 42 || [...sims.values()].some(other => other.lot === sim.lot && ['waiting_for_user','error'].includes(other.state));
    if (sim.character) sim.residentLevel = levels.resident(sim.lot.project, sim.character.slot).level;
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
  // The home you're looking at (middle of the screen) lifts its roof from farther out, so you can peek in.
  const centerLot = planner.active ? null : [...lots.values()].find((l) => !l.unplaced && l.containsWorld(rig.target.x, rig.target.z));
  const nextInspected = build.active || photo.active ? null : followSelected && selected ? selected.lot : centerLot;
  // Moving on from a home returns it to its ground floor.
  if (inspectedLot && nextInspected !== inspectedLot && !(photo.active || build.active)) inspectedLot.setViewFloor(0);
  inspectedLot = nextInspected;
  floorPicker.update(inspectedLot && inspectedLot.roofK <= 0.3 && !inspectedLot.constructing ? inspectedLot : null, sims.values());
  const petFocus = rig.distance < 26 ? rig.target : null;
  const sightTarget = planner.active ? null : followSelected && selected ? selected.worldPosition().add(tmpV.set(0, 1, 0)) : rig.target;
  for (const lot of lots.values()) {
    // Roofs never cover the home you're decorating or inspecting.
    lot.roofAllowed = !build.active && selected?.lot !== lot;
    lot.peek = lot === centerLot;
    if (build.active || planner.active || photo.active) lot.hovered = false;
    const clearView = !!sightTarget && lot !== centerLot && blocksView(lot, camera.position, sightTarget);
    lot.update(dt, t, { camera, night: env.night, busy: busyLots.has(lot), avatar: petFocus, clearView, peekOpen: rig.maxDistance - 16 });
  }
  ui.updatePreview();

  const title = !bridgeReady ? 'Agent World · offline' : waitingCount ? `(${waitingCount}) Agent World` : 'Agent World';
  if (document.title !== title) document.title = title;
  if (t - lastClockLabel > 1) {
    lastClockLabel = t;
    ui.setClock(env.label(), env.hour, settings.time);
    ui.setNight(env.night > 0.55);
    if (ui.status.dataset.state === 'live') refreshProviderConnections();
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
const passCard=new PassCard({onOutfit:sim=>{passCard.activityTransition=true;passCard.dialog.close();openWardrobe(sim);},onActivity:(run,sim)=>{const target=run? sims.get(sessionToSim.get(run.conversationSession)):sim;if(!target)return false;if(selected)selected.selected=false;selected=target;target.selected=true;followSelected=true;document.body.classList.add('inspecting');ui.open(target);return true;},residentName:(project,slot)=>households.get(project)?.characters.find(c=>c.slot===slot)?.name,resident:(project,slot)=>sims.get(charKey(project,slot)),onClose:()=>{if(selected)ui.open(selected);}});
document.body.classList.add('pass-workflow');
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
const homeOverview = new HomeOverview({look: (project, slot) => sims.get(charKey(project, slot))?.look, onChat: (project,slot) => {const sim=sims.get(charKey(project,slot));if(sim)openAgentChat(sim);else passCard.openHome(project);}});
document.addEventListener('click', e => {
  const home = e.target.closest('[data-work-home]');
  if (home) homeOverview.open(home.dataset.workHome);
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
      const d = lot.toWorld(0, 0).distanceTo(rig.target);
      if (d < bestD) [best, bestD] = [lot, d];
    }
    return best;
  },
  onToggle: (active, lot) => {
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
      rig.flyTo(camFocus, { distance: 22 });
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
planner = new TownPlanner({
  scene,
  camera,
  dom: renderer.domElement,
  town: () => town,
  homeName: (project) => households.get(project)?.name || project.split(/[\\/]/).pop(),
  homeHeight: (project) => lots.get(project)?.plan?.height || 7,
  suppressed: () => rig.suppressClick,
  ledger: ui.projectsPanel.host,
  onLedgerOpen: () => ui.projectsPanel.load(),
  save: async (action) => {
    const res = await fetch('/api/town', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(action) });
    const body = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(body.error || 'Couldn’t save the town plan.');
    return body.result;
  },
  onToggle: (active, center, distance) => {
    if (active) {
      if (build.active) build.exit();
      ui.close();
      for (const l of lots.values()) l.wallMode = 'up';
      select(null);
      mapFocus.copy(center);
      mapReturnYaw ??= rig.yawTarget;
      rig.yawTarget = Math.round(rig.yaw / (Math.PI * 2)) * Math.PI * 2; // north up, shortest turn
      rig.flyTo(center, { distance });
      rig.maxDistance = Math.max(60, distance * 1.3);
      env.fogScale = 0.25;
      rig.pitch = 1.0; // tilted, so street previews and home holograms read in 3D
    } else {
      for (const l of lots.values()) l.wallMode = settings.walls;
      rig.pitch = 0.85;
      rig.yawTarget = mapReturnYaw ?? rig.yawTarget;
      mapReturnYaw = null;
      rig.maxDistance = 60;
      env.fogScale = 1;
      rig.flyTo(camFocus, { distance: 22 });
    }
  },
});

ui.projectsPanel.planner = planner;
ui.onProjectCount = (n) => planner.setProjectCount(n);
planner.setProjectCount(ui.projectsPanel.homes.length);

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
      if (planner.active) planner.exit();
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

refreshProgress();

wardrobe = new Wardrobe({ save: saveStyle });
function openWardrobe(sim) {
  if (build.active) build.exit();
  // Swing the camera around to face whoever is being dressed.
  if (sim) {
    const key = charKey(sim.lot.project, sim.character.slot);
    wardrobe.open({ name: sim.name, model: sim, change: { kind: 'resident', key }, saved: style.residents?.[key] || null });
    rig.yawTarget = sim.facing + (sim.lot.yaw || 0); // the resident's facing is lot-local
    rig.distanceTarget = 7;
  } else {
    ui.close();
    wardrobe.open({ name: 'You', model: player, change: { kind: 'player' }, saved: style.player || null, preview: () => player.previewHtml(), mountPreview: (slot) => player.mountPreview(slot), xp: () => xpMarkup(levels.player, { label: 'You' }) });
  }
}

const claudeSignIn=new ClaudeSignIn();
const codexSignIn=new CodexSignIn();
const experience = new Experience({ work, onClaude:()=>claudeSignIn.open(), onCodex:()=>codexSignIn.open(), onConversations: () => library.open(), onMayor: () => mayor.open(), leavePlay: () => { if (build.active) build.exit(); if (planner.active) planner.exit(); if (photo.active) photo.exit(); }, action: name => ui.h.onAction(name), pets: () => { if (!build.active) build.enter(selected?.lot); build.tab = 'pets'; build.render(); } });
mountDevReset();
mayor = new MayorOnboarding({
  character: mayorCharacter,
  onClaude:ready=>claudeSignIn.open(ready),
  onCodex:ready=>codexSignIn.open(ready),
  onConnections: () => experience.open('sources'),
  onFocusTownHall: () => focusTownHall(),
  onBuildHome: () => planner.openProjects(),
  onMeetOwner: home => {
    const owner = home?.characters.find(c => c.id === home.ownerAgentId) || home?.characters[0];
    const sim = owner && sims.get(charKey(home.project, owner.slot));
    if (sim) { focusSim(sim.key); passCard.open(sim); }
  },
  onChange: next => { if (next) applyGameplay(next); else refreshProgress(); },
});

// Debug handle for the console.
window.agentWorld = {
  garden, photo, album, weatherFx, get passCard() { return passCard; }, get levels() { return levels; }, applyHousehold, civic, landscape, city: () => city, sims, lots, player, rig, worldBounds, lookAt, sound, env, pipeline, focusSim, library, work, build, wardrobe, style: () => style, commons, mayorCharacter, seasons, explore, planner, town: () => town };

connect();
frame();
