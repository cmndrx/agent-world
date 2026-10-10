import assert from 'node:assert/strict';
import { test } from 'node:test';
import { Productivity } from '../bridge/productivity.mjs';
import { BRICKS, homeExperience, homeLevel, levelName, lockReason, progress } from '../shared/progression.mjs';
import { applyStyleChange, emptyStyle } from '../shared/style.mjs';

const task = (over) => ({ id: 't1', project: '/p', title: 'Fix login', status: 'accepted', evidence: 'tests pass: npm test', acceptedAt: '2026-10-05T10:00:00Z', ...over });

test('bricks come only from tasks you accepted with review notes, and from reached outcomes', () => {
  const p = progress({
    tasks: [task(), task({ id: 't2', evidence: '' }), task({ id: 't3', status: 'needs_review' })],
    plans: [{ project: '/p', milestones: [{ outcome: 'Ship v1', reachedAt: '2026-10-05T11:00:00Z' }] }],
  });
  assert.equal(p.earned, BRICKS.acceptedTask + BRICKS.outcomeReached);
  assert.equal(p.levels['/p'], 1);
  assert.deepEqual(p.ledger.map((e) => e.kind).sort(), ['outcome', 'task', 'task-no-notes']);
});

test('un-accepting a task removes its bricks', () => {
  assert.equal(progress({ tasks: [task()] }).earned, 10);
  assert.equal(progress({ tasks: [task({ status: 'in_progress', acceptedAt: null })] }).earned, 0);
});

test('levels are capped and named', () => {
  assert.equal(homeLevel({project:'/p',characters:[{slot:1}]}, {'["/p",1]':{xp:9999}}), 5);
  assert.equal(levelName(3), 'Villa');
});

test('homes follow their combined resident XP without requiring a plan or reviewed outcome', () => {
  const home = {project:'/p',characters:[{slot:1},{slot:2},{slot:3}]};
  const runs=Array.from({length:12},(_,i)=>({id:`r${i}`,project:'/p',slot:2,status:'completed',result:{summary:'Returned response'}}));
  const result = progress({households:[home,{project:'/other',characters:[{slot:2}]}], runs});
  assert.equal(result.levels['/p'],2);
  assert.equal(result.levels['/other'],1);
  assert.equal(result.earned,0);
  assert.equal(homeLevel({...home,characters:[]},{'["/p",2]':{level:8}}),1);
  assert.equal(homeLevel(home,{'["/p",99]':{level:8}}),1);
});

test('a failed response cannot upgrade a house; outcome changes only affect gems', () => {
  const home = {project:'/p',characters:[{slot:1}]};
  const runs=Array.from({length:12},(_,i)=>({id:`r${i}`,project:'/p',slot:1,status:'completed',result:{summary:'Returned response'}}));
  const before = progress({households:[home],runs:runs.slice(0,11)});
  assert.equal(before.levels['/p'],1);
  assert.equal(progress({households:[home],runs:[...runs.slice(0,11),{...runs[11],status:'failed'}]}).levels['/p'],1);
  assert.equal(progress({households:[home],runs}).levels['/p'],2);
  const reviewed=progress({households:[home],runs,plans:[{project:'/p',milestones:[{outcome:'Reached',reachedAt:'2026-10-10'}]}]});
  assert.equal(reviewed.levels['/p'],2);
  assert.equal(reviewed.earned,BRICKS.outcomeReached);
});

test('unlocks spend the derived balance; locked and level-gated items are refused', () => {
  const known = { homes: new Set(['/p']), residents: new Set(), earned: 20, levels: { '/p': 1 } };
  assert.equal(lockReason('monstera', {}), 'locked');
  assert.equal(lockReason('fern', {}), null);
  let s = applyStyleChange(emptyStyle(), { kind: 'unlock', key: 'monstera' }, known); // 10 of 20
  assert.deepEqual(s.unlocks, ['monstera']);
  assert.throws(() => applyStyleChange(s, { kind: 'unlock', key: 'bonsai' }, known), /Not enough gems/); // needs 20, has 10
  assert.throws(() => applyStyleChange(s, { kind: 'unlock', key: 'fern' }, known), /free/);
  assert.throws(() => applyStyleChange(s, { kind: 'home', key: '/p', value: { decor: [{ id: 'a', item: 'bonsai', x: 0, z: 0 }] } }, known), /Unlock/);
  s = applyStyleChange(s, { kind: 'home', key: '/p', value: { decor: [{ id: 'a', item: 'monstera', x: 0, z: 0 }] } }, known);
  const rich = { ...known, earned: 200 };
  s = applyStyleChange(s, { kind: 'unlock', key: 'arcade' }, rich);
  assert.throws(() => applyStyleChange(s, { kind: 'home', key: '/p', value: { decor: [{ id: 'b', item: 'arcade', x: 1, z: 1 }] } }, rich), /Villa/);
  const villa = { ...rich, levels: { '/p': 3 } };
  s = applyStyleChange(s, { kind: 'home', key: '/p', value: { decor: [{ id: 'b', item: 'arcade', x: 1, z: 1 }] } }, villa);
  // Dropping back to level 1 never tears down what is already placed; edits still save.
  s = applyStyleChange(s, { kind: 'home', key: '/p', value: { floor: 'slate', decor: s.homes['/p'].decor } }, rich);
  assert.equal(s.homes['/p'].decor.length, 1);
});

test('reaching an outcome needs confirmation and the current version; undo restores it', () => {
  const homes = { '/p': {} };
  const prod = new Productivity();
  const plan = prod.savePlan({ project: '/p', outcome: 'Ship v1', nextAction: 'Write docs' }, homes);
  assert.throws(() => prod.milestone({ project: '/p', version: plan.version, action: 'reach' }, homes), /Confirm/);
  assert.throws(() => prod.milestone({ project: '/p', version: 99, action: 'reach', confirmed: true }, homes), /changed elsewhere/);
  const reached = prod.milestone({ project: '/p', version: plan.version, action: 'reach', confirmed: true }, homes);
  assert.equal(reached.milestones.length, 1);
  assert.equal(reached.outcome, '');
  assert.throws(() => prod.milestone({ project: '/p', version: reached.version, action: 'reach', confirmed: true }, homes), /Set an outcome/);
  const undone = prod.milestone({ project: '/p', version: reached.version, action: 'undo', confirmed: true }, homes);
  assert.equal(undone.milestones.length, 0);
  assert.equal(undone.outcome, 'Ship v1');
});

test('new review credits cap per project and day, preserving legacy credits', () => {
  const daily = (id, over = {}) => task({ id, rewardPolicy: 'daily-v1', rewardDay: '2026-10-05', ...over });
  const p = progress({ tasks: [daily('b'), daily('a'), daily('c', { project: '/other' }), daily('d', { rewardDay: '2026-10-06' }), task({ id: 'legacy' })] });
  assert.equal(p.earned, 40);
  assert.equal(p.counts.tasks, 4);
  assert.equal(p.ledger.find(t => t.id === 'b').capped, true);
  assert.equal(progress({ tasks: [daily('b')] }).earned, 10); // Removing earlier acceptance recalculates the remaining credit.
  assert.equal(progress({ tasks: [daily('a', { evidence: '' }), daily('b')] }).earned, 10);
});

test('server stamps new acceptance policy and ignores client opt-out; old rewards survive edits', () => {
  const prod = new Productivity(); const homes = { '/p': {} };
  const t = prod.saveTask({ project: '/p', title: 'Review', status: 'accepted', acceptedByUser: true, evidence: 'Reviewed', rewardPolicy: 'legacy', rewardDay: 'wrong' }, homes, new Map(), '2026-10-05T12:00:00Z');
  assert.equal(t.rewardPolicy, 'daily-v1');
  assert.match(t.rewardDay, /^2026-10-0[45]$/); // Server-local day, independent of client timezone.
  const legacy = task({ version: 1 }); const saved = new Productivity({ tasks: [legacy] });
  const edited = saved.saveTask({ ...legacy, version: 1, title: 'Reviewed old task' }, homes, new Map());
  assert.equal(edited.rewardPolicy, undefined);
  assert.equal(progress({ tasks: [edited] }).earned, 10);
});

test('structured recorded references qualify for review credit without a duplicate free-text note', () => {
  assert.equal(progress({tasks:[task({evidence:'',references:[{kind:'check',value:'npm test',result:'unknown'}],rewardPolicy:'daily-v1',rewardDay:'2026-10-05'})]}).earned,10);
});

 test('pooled home XP sums current residents once and scales independently of individual levels', () => {
 const home={project:'/p',characters:[{slot:1},{slot:2},{slot:2},{slot:3}]};
 const residents={'["/p",1]':{xp:100},'["/p",2]':{xp:125},'["/p",3]':{xp:75},'["/other",1]':{xp:9999}};
 assert.deepEqual(homeExperience(home,residents),{xp:300,level:2,current:0,required:450,remaining:450,percent:0});
 for(const [xp,level] of [[299,1],[300,2],[749,2],[750,3],[1349,3],[1350,4],[2099,4],[2100,5]])
 assert.equal(homeLevel({project:'/p',characters:[{slot:1}]},{'["/p",1]':{xp}}),level);
 assert.equal(homeExperience(home,{'["/p",1]':{xp:NaN}}).xp,0);
 });
