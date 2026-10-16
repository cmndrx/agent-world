// Vite only: no bridge, observer, provider, events, queue or personal state.
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {createServer} from 'vite';
const home=fs.mkdtempSync(path.join(os.tmpdir(),'aw-town-characters-'));
process.env.AGENT_WORLD_HOME=home;process.env.CODEX_HOME=path.join(home,'codex');process.env.AGENT_WORLD_RUNNER='0';
const server=await createServer({configFile:false,root:path.resolve('web'),server:{host:'127.0.0.1',port:4797,strictPort:true}});
await server.listen();console.log(`Isolated AGENT_WORLD_HOME=${home}; http://127.0.0.1:4797/town-character-fixture.html (no bridge/providers)`);
for(const signal of ['SIGINT','SIGTERM'])process.on(signal,async()=>{await server.close();process.exit(0);});
