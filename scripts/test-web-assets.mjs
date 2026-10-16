// Node 24 test-only equivalent of Vite's ?raw asset import; no application substitution.
import {registerHooks} from 'node:module';
import fs from 'node:fs';
registerHooks({load(url,context,next){if(url.endsWith('?raw'))return {format:'module',source:`export default ${JSON.stringify(fs.readFileSync(new URL(url),'utf8'))}`,shortCircuit:true};return next(url,context);}});
