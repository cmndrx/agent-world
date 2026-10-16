// No observer, provider, events, queue or personal state. Development visual fixture only.
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { createServer } from 'vite';
const home=fs.mkdtempSync(path.join(os.tmpdir(),'aw-home-activities-'));
process.env.AGENT_WORLD_HOME=home;process.env.CODEX_HOME=path.join(home,'codex');process.env.AGENT_WORLD_RUNNER='0';
const server=await createServer({configFile:false,root:path.resolve('web'),server:{host:'127.0.0.1',port:4796,strictPort:true}});
await server.listen();
console.log(`Isolated AGENT_WORLD_HOME=${home}; http://127.0.0.1:4796/home-activity-fixture.html (no bridge/providers)`);
for(const signal of ['SIGINT','SIGTERM'])process.on(signal,async()=>{await server.close();process.exit(0);});
