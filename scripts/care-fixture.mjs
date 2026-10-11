// Disposable care town: never uses real gameplay, events or provider state.
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawn } from 'node:child_process';
const home = fs.mkdtempSync(path.join(os.tmpdir(), 'aw-care-preview-'));
const project = path.join(home, 'care-test');
fs.mkdirSync(project);
fs.writeFileSync(path.join(home, 'selected-projects.json'), JSON.stringify([project]));
fs.writeFileSync(path.join(home, 'gameplay.json'), JSON.stringify({ version:1, connection:{provider:'fixture'}, townhall:{ readyAt:'2020-01-01T00:00:00Z' } }));
fs.writeFileSync(path.join(home, 'households.json'), JSON.stringify({ [project]: {
  project, name:'Care test · simulated', ownerAgentId:'care-fixture-resident', residentAgentIds:['care-fixture-resident'],
  characters:[{ id:'care-fixture-resident', slot:1, seed:42, name:'Care Tester', assignedRole:'personal_assistant', interestIds:['snacks','reading'] }],
} }));
console.log(`Isolated simulated care fixture: ${home}. Provider execution disabled.`);
const child = spawn(process.execPath, ['bridge/server.mjs','--port',process.argv[2] || '4793','--serve','dist'], {
  env:{ ...process.env, AGENT_WORLD_HOME:home, CODEX_HOME:path.join(home,'codex'), AGENT_WORLD_RUNNER:'0' }, stdio:'inherit',
});
for (const signal of ['SIGINT','SIGTERM']) process.on(signal, () => child.kill());
child.on('exit', code => { process.exitCode = code || 0; });
