// Disposable town for the town simulation (docs/TOWN_SIM_PLAN.md): one home and a few placed public buildings so
// home satisfaction, sign markers and the Town needs breakdown are visible. Never uses real gameplay, events or
// provider state; provider execution is disabled.
// Usage: node scripts/town-sim-fixture.mjs [port] [scenario]. Scenarios: `basic` (default) and `tier-up` (three
// residents and every tier-2 building but the library: place the library beside the home to watch a live tier-up)
// and `street` (a fire station right behind the home that faces a back street joined far east: 25 street tiles away,
// so it gives no cover; add a street from i 6, j 1 to i 6, j 4 to connect it).
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawn } from 'node:child_process';
import { addRoad, emptyTown, placeCivic, placeHome } from '../shared/town.mjs';

const scenario = process.argv[3] || 'basic';
const home = fs.mkdtempSync(path.join(os.tmpdir(), 'aw-town-sim-'));
const project = path.join(home, 'town-sim-test');
fs.mkdirSync(project);
fs.writeFileSync(path.join(home, 'selected-projects.json'), JSON.stringify([project]));
fs.writeFileSync(path.join(home, 'gameplay.json'), JSON.stringify({ version:1, connection:{provider:'fixture'}, townhall:{ readyAt:'2020-01-01T00:00:00Z' } }));
// In tier-up, Rosa only likes park walks: an arcade interest would be a red need at tier 2 and block the climb.
const people = [{ id:'town-sim-resident', slot:1, seed:42, name:'Rosa', assignedRole:'personal_assistant', interestIds:scenario === 'tier-up' ? ['park_walks'] : ['park_walks','arcade_games'] }];
if (scenario === 'tier-up') people.push({ id:'town-sim-eli', slot:2, seed:7, name:'Eli', assignedRole:'researcher', interestIds:['park_walks'] }, { id:'town-sim-mia', slot:3, seed:11, name:'Mia', assignedRole:'designer', interestIds:['jogging'] });
fs.writeFileSync(path.join(home, 'households.json'), JSON.stringify({ [project]: {
  project, name:'Town sim · simulated', ownerAgentId:'town-sim-resident', residentAgentIds:people.map((p) => p.id), characters:people,
} }));
let town = placeHome(emptyTown(), project, { i:2, j:-2, rot:0 });
// basic: placed buildings count even above the town's tier (and set its starting tier): a near park, a distant fire
// station and a dump close by. tier-up: tier 2 with everything but the library; its best plot is east of the home,
// facing the short side street (i 6, j −2, turned west).
const placed = scenario === 'tier-up'
  ? [['park', { i:2, j:2, rot:2 }], ['fire_station', { i:-1, j:2, rot:2 }], ['police', { i:6, j:2, rot:2 }]]
  : scenario === 'street' ? [['fire_station', { i:2, j:2, rot:0 }]]
  : [['park', { i:6, j:2, rot:2 }], ['fire_station', { i:13, j:2, rot:2 }], ['city_dump', { i:-1, j:2, rot:2 }]];
if (scenario === 'tier-up') town = addRoad(town, { i:5, j:1 }, { i:5, j:-2 });
if (scenario === 'street') town = addRoad(town, { i:14, j:1 }, { i:0, j:4 }, { bend:'z' });
for (const [kind, at] of placed) town = placeCivic(town, kind, at, { tier:Infinity });
fs.writeFileSync(path.join(home, 'town.json'), JSON.stringify(town));
console.log(`Isolated town simulation fixture (${scenario}): ${home}. Provider execution disabled.`);
const child = spawn(process.execPath, ['bridge/server.mjs','--port',process.argv[2] || '4793','--serve','dist'], {
  env:{ ...process.env, AGENT_WORLD_HOME:home, CODEX_HOME:path.join(home,'codex'), AGENT_WORLD_RUNNER:'0' }, stdio:'inherit',
});
for (const signal of ['SIGINT','SIGTERM']) process.on(signal, () => child.kill());
child.on('exit', code => { process.exitCode = code || 0; });
