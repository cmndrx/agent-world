import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import { visibleResidents } from '../shared/gameplay.mjs';
import { connectionView } from '../shared/connections.mjs';

// Execute the actual merged entry point with scene/UI doubles. Syntax/build checks
// alone missed these runtime errors in the committed conflict resolution.
function snapshotFixture(linked) {
  const source = fs.readFileSync(new URL('../web/src/main.js', import.meta.url), 'utf8');
  const calls = { households: [], sessions: [], ended: [] };
  const context = vm.createContext({
    gameplay: { connection: linked ? { provider: 'codex' } : null }, visibleResidents,
    selectedProjects: null, emptyLot: {}, replaying: false, firstSnapshot: false,
    sessionToSim: new Map([['old', 'old-key']]), sims: new Map(), REMIND_AFTER_S: 120,
    passCard: { setData: data => { calls.card = data; } },
    work: { setData: data => { calls.work = data; } },
    library: { setData: data => { calls.library = data; } },
    levels: { setData: runs => { calls.levels = runs; } },
    applyHousehold: h => calls.households.push(h),
    applySession: s => calls.sessions.push(s),
    endSession: id => calls.ended.push(id), syncLibrarySessions() {},
  });
  vm.runInContext(source.slice(source.indexOf('function applySnapshot('), source.indexOf('\nfunction hashStr(')), context);
  return { calls, apply: data => context.applySnapshot(data) };
}

const snapshot = {
  selectedProjects: ['/chosen'],
  households: [{ project: '/chosen' }, { project: '/hidden' }],
  sessions: [
    { session: 'visitor', project: '/chosen', parent_session: 'primary' },
    { session: 'primary', project: '/chosen' },
    { session: 'hidden', project: '/hidden' },
  ],
  projects: [{ home: '/chosen' }, { home: '/hidden' }],
  conversations: [{ project: '/chosen' }, { project: '/hidden' }],
  plans: [{ project: '/chosen' }, { project: '/hidden' }],
  tasks: [{ project: '/chosen' }, { project: '/hidden' }],
  passes: { runs: [{ id: 'completed-response', project: '/chosen', slot: 1, status: 'completed', result: { summary: 'Reported response' } }] },
};

test('merged snapshot keeps project selection and gates observed residents until mayor linking', () => {
  const unlinked = snapshotFixture(false);
  unlinked.apply(snapshot);
  assert.equal(unlinked.calls.households.length, 0);
  assert.equal(unlinked.calls.sessions.length, 0);
  assert.equal(unlinked.calls.card.sessions.length, 0);
  assert.deepEqual(unlinked.calls.work.households, [snapshot.households[0]], 'selected planning stays available');
  assert.deepEqual(unlinked.calls.library.projects, [snapshot.projects[0]]);
  assert.deepEqual(unlinked.calls.levels, snapshot.passes.runs, 'participation history remains separate from resident visibility');

  const linked = snapshotFixture(true);
  linked.apply(snapshot);
  assert.deepEqual(linked.calls.households, [snapshot.households[0]]);
  assert.deepEqual(linked.calls.sessions.map(s => s.session), ['primary', 'visitor']);
  assert.deepEqual(linked.calls.card.tasks, [snapshot.tasks[0]]);
  assert.deepEqual(linked.calls.levels, snapshot.passes.runs, 'newer participation XP survives the merged snapshot');
  assert.deepEqual(linked.calls.ended, ['old']);
  linked.apply({ ...snapshot, selectedProjects: [] });
  assert.equal(linked.calls.card.sessions.length, 0);
  assert.equal(linked.calls.work.households.length, 0);
  linked.apply({ ...snapshot, selectedProjects: null });
  assert.equal(linked.calls.card.sessions.length, 3, 'legacy snapshots retain their full selection');
  linked.apply({ ...snapshot, passes: undefined });
  assert.deepEqual(Array.from(linked.calls.levels), [], 'legacy snapshots without run history remain supported');
});

function uiFixture() {
  const elements = { '#roster-count': {}, '#intro .intro-status .text': {} };
  const context = vm.createContext({ connectionView, document: { querySelector: s => elements[s] } });
  const source = fs.readFileSync(new URL('../web/src/ui.js', import.meta.url), 'utf8')
    .replace(/^import .*;\r?\n/gm, '').replace(/export /g, '');
  vm.runInContext(source + '\nglobalThis.UI = UI;', context);
  const ui = Object.create(context.UI.prototype);
  const text = {};
  ui.status = { dataset: {}, querySelector: () => text, setAttribute: (key, value) => { ui.status[key] = value; } };
  ui.html = {};
  ui.rosterBody = {};
  ui.rosterView = 'agents';
  vm.runInContext('patchList = (container, items, options) => { for (const item of items) options.html(item); };', context);
  return { ui, text, elements };
}

test('provider health display survives mayor linking, expiry, disconnect and reconnect', () => {
  const { ui, text } = uiFixture();
  const now = 100000;
  const health = { capturedAt: now, providers: { codex: { status: 'connected', expiresAt: now + 20000 } } };
  ui.setConnection('live', connectionView(health, true, now));
  assert.equal(text.textContent, 'Live · 1 provider');
  assert.match(ui.status.title, /Town not linked/);
  ui.setGameLinked(true);
  assert.equal(text.textContent, 'Live · 1 provider');
  assert.doesNotMatch(ui.status.title, /Town not linked/);
  assert.match(ui.status['aria-label'], /fresh local activity-observer contact/);
  ui.setConnection('live', connectionView(health, true, now + 10000));
  assert.equal(text.textContent, 'Live · unavailable');
  ui.setConnection('offline', connectionView(health, false, now));
  ui.setGameLinked(false);
  assert.equal(text.textContent, 'Live · unavailable');
  ui.setConnection('live', connectionView(health, true, now));
  assert.equal(text.textContent, 'Live · 1 provider');
});

test('merged roster preserves project view, onboarding and stale observed state', () => {
  const { ui, elements } = uiFixture();
  ui.rosterView = 'projects';
  elements['#roster-count'].textContent = '2 projects';
  ui.renderRoster([], [], null);
  assert.equal(elements['#roster-count'].textContent, '2 projects');
  ui.rosterView = 'agents';
  ui.renderRoster([], [], null);
  assert.match(ui.rosterBody.innerHTML, /Mayor Martin/);
  ui.setGameLinked(true);
  ui.renderRoster([], [], null);
  assert.match(ui.rosterBody.innerHTML, /Build a home/);
  const sim = { key: 'chosen#1', name: 'Otto', state: 'idle', truth: {} };
  const staleValues = [];
  ui.rosterRow = (s, stale) => { staleValues.push(stale); return s.name; };
  ui.connectionState = 'offline';
  ui.renderRoster([sim], [{}], null);
  assert.match(elements['#roster-count'].textContent, /last known sessions/);
  ui.connectionState = 'live';
  ui.renderRoster([sim], [{}], null);
  assert.deepEqual(staleValues, [true, false]);
});
