// Show, add, or remove the Agent World hooks in Claude Code's user settings.
//
//   node adapters/claude-code/install.mjs            print the settings snippet (changes nothing)
//   node adapters/claude-code/install.mjs --apply    merge into ~/.claude/settings.json (backup first)
//   node adapters/claude-code/install.mjs --remove   remove Agent World hooks

import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const HOOK = path.join(path.dirname(fileURLToPath(import.meta.url)), 'hook.mjs');
const COMMAND = `node "${HOOK}"`;
const MARK = 'agent-world';
const SETTINGS = path.join(os.homedir(), '.claude', 'settings.json');

const TOOL_EVENTS = ['PreToolUse', 'PostToolUse', 'PostToolUseFailure'];
const OTHER_EVENTS = ['SessionStart', 'SessionEnd', 'UserPromptSubmit', 'Notification', 'Stop'];

function ourHooks() {
  const entry = { type: 'command', command: COMMAND, timeout: 5 };
  const hooks = {};
  for (const e of TOOL_EVENTS) hooks[e] = [{ matcher: '*', hooks: [entry] }];
  for (const e of OTHER_EVENTS) hooks[e] = [{ hooks: [entry] }];
  return hooks;
}

function stripOurs(settings) {
  for (const [event, groups] of Object.entries(settings.hooks || {})) {
    const kept = groups
      .map((g) => ({ ...g, hooks: (g.hooks || []).filter((h) => !String(h.command || '').includes(MARK)) }))
      .filter((g) => g.hooks.length);
    if (kept.length) settings.hooks[event] = kept;
    else delete settings.hooks[event];
  }
  return settings;
}

const mode = process.argv[2];
if (mode !== '--apply' && mode !== '--remove') {
  console.log('Add this to ~/.claude/settings.json (or run with --apply):\n');
  console.log(JSON.stringify({ hooks: ourHooks() }, null, 2));
  process.exit(0);
}

let settings = {};
if (fs.existsSync(SETTINGS)) {
  settings = JSON.parse(fs.readFileSync(SETTINGS, 'utf8'));
  fs.copyFileSync(SETTINGS, `${SETTINGS}.agent-world-backup`);
}
settings.hooks ||= {};
stripOurs(settings);

if (mode === '--apply') {
  for (const [event, groups] of Object.entries(ourHooks())) {
    settings.hooks[event] = [...(settings.hooks[event] || []), ...groups];
  }
}
if (!Object.keys(settings.hooks).length) delete settings.hooks;

fs.mkdirSync(path.dirname(SETTINGS), { recursive: true });
fs.writeFileSync(SETTINGS, JSON.stringify(settings, null, 2) + '\n');
console.log(`${mode === '--apply' ? 'Installed' : 'Removed'} Agent World hooks in ${SETTINGS}`);
