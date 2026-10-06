#!/usr/bin/env node
// Operate user-managed metadata through the bridge; never forge observed events or accept tasks.
import { attentionItems } from '../../../shared/productivity.mjs';
import { returnBriefing, briefingCutoff } from '../../../shared/work-loop.mjs';

const help = `Agent World local helper (Node 18+)
  state [--base URL]
  briefing --project KEY [--base URL]
  attention [--project KEY] [--base URL]
  propose --project KEY --slot NUMBER --title TEXT --instruction TEXT [--recorder TEXT]
  plan --project KEY [--outcome TEXT] [--next-action TEXT]
  task --project KEY [--id ID] [--title TEXT] [--status STAGE]
       [--notes TEXT] [--blocker TEXT] [--evidence TEXT]
       [--review-summary TEXT] [--limitations TEXT]
       [--conversation KEY ... | --clear-conversations] [--references-json JSON]
  seen --project KEY --through ISO_TIMESTAMP
Only local HTTP bridge URLs. Task stages accepted and accepted-task edits are refused.`;

function parse(argv) {
  const [command = 'help', ...rest] = argv;
  const args = { command, conversations: [] };
  const valued = new Set(['base', 'project', 'outcome', 'next-action', 'id', 'title', 'status', 'notes', 'blocker', 'evidence', 'conversation', 'through', 'references-json', 'review-summary', 'limitations', 'slot', 'instruction', 'recorder']);
  for (let i = 0; i < rest.length; i++) {
    const key = rest[i].replace(/^--/, '');
    if (!rest[i].startsWith('--')) throw new Error(`Unexpected argument: ${rest[i]}`);
    if (key === 'clear-conversations') { args.clearConversations = true; continue; }
    if (!valued.has(key) || i + 1 >= rest.length || rest[i + 1].startsWith('--')) throw new Error(`Invalid or missing option: ${rest[i]}`);
    const value = rest[++i];
    if (key === 'conversation') args.conversations.push(value);
    else if (Object.hasOwn(args, key)) throw new Error(`Repeated option: --${key}`);
    else args[key] = value;
  }
  const allowed = {
    propose:['base','project','slot','title','instruction','recorder'],
    state: ['base'], briefing: ['base', 'project'], attention: ['base', 'project'],
    plan: ['base', 'project', 'outcome', 'next-action'],
    task: ['base', 'project', 'id', 'title', 'status', 'notes', 'blocker', 'evidence', 'clearConversations', 'references-json', 'review-summary', 'limitations'],
    seen: ['base', 'project', 'through'],
  };
  if (!allowed[command]) throw new Error(`Unknown command: ${command}`);
  for (const key of Object.keys(args)) if (!['command', 'conversations'].includes(key) && !allowed[command].includes(key)) throw new Error(`Option ${key} is not supported for ${command}`);
  if (command !== 'task' && args.conversations.length) throw new Error('Conversation links apply only to tasks.');
  if (args.clearConversations && args.conversations.length) throw new Error('Choose conversation links or clear them, not both.');
  return args;
}

async function main() {
  if (!process.argv[2] || ['help', '--help', '-h'].includes(process.argv[2])) { console.log(help); return; }
  const a = parse(process.argv.slice(2));
  const base = new URL(a.base || 'http://127.0.0.1:4777');
  if (base.protocol !== 'http:' || !['127.0.0.1', 'localhost', '[::1]'].includes(base.hostname) || base.username || base.password || base.search || base.hash || base.pathname !== '/') throw new Error('Use a loopback HTTP bridge URL without credentials, path or query.');
  const request = async (route, body) => {
    const controller = new AbortController(); const timer = setTimeout(() => controller.abort(), 5000);
    try {
      const response = await fetch(new URL(route, base), { redirect: 'error', signal: controller.signal,
        ...(body ? { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) } : {}) });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || `Bridge returned ${response.status}`);
      return data;
    } finally { clearTimeout(timer); }
  };
  const state = await request('/api/state');
  for (const key of ['households', 'sessions', 'conversations', 'plans', 'tasks']) if (!Array.isArray(state[key])) throw new Error('This server is not a compatible Agent World bridge.');
  const output = data => console.log(JSON.stringify(data, null, 2));
  if (a.command === 'state') { output(state); return; }
  if (a.command === 'attention') {
    if (a.project && !state.households.some(h => h.project === a.project)) throw new Error('Project key not found. Read state first.');
    output(attentionItems(state).filter(i => !a.project || i.project === a.project)); return;
  }
  if (!a.project || !state.households.some(h => h.project === a.project)) throw new Error('Use an exact --project key from state.');
  if(a.command==='propose'){const slot=Number(a.slot||1);const previous=state.passes?.proposals.find(p=>p.project===a.project&&p.slot===slot);output(await request('/api/pass-proposal',{project:a.project,slot,title:a.title,instruction:a.instruction,recordedBy:a.recorder||'Agent helper',version:previous?.version}));return;}
  const plan = state.plans.find(p => p.project === a.project);
  if (a.command === 'briefing') {
    output({ observedThrough: briefingCutoff(a.project, state), plan: plan || null, tasks: state.tasks.filter(t => t.project === a.project), ...returnBriefing(a.project, state) }); return;
  }
  if (a.command === 'plan') {
    if (!Object.hasOwn(a, 'outcome') && !Object.hasOwn(a, 'next-action')) throw new Error('Supply an outcome or next action.');
    output(await request('/api/plan', { project: a.project, version: plan?.version || 0, outcome: a.outcome ?? plan?.outcome ?? '', nextAction: a['next-action'] ?? plan?.nextAction ?? '' })); return;
  }
  if (a.command === 'seen') {
    if (!a.through) throw new Error('Use --through from the briefing you viewed.');
    output(await request('/api/briefing-seen', { project: a.project, through: a.through })); return;
  }
  if (a.command === 'task') {
    const old = a.id ? state.tasks.find(t => t.id === a.id && t.project === a.project) : null;
    if (a.id && !old) throw new Error('Task ID not found in the selected home.');
    if (a.status === 'accepted' || old?.status === 'accepted') throw new Error('Human acceptance and accepted-task edits belong in the human UI.');
    const input = { project: a.project, ...(old || {}), title: a.title ?? old?.title ?? '', status: a.status ?? old?.status ?? 'planned',
      reviewSummary: a['review-summary'] ?? old?.reviewSummary ?? '', limitations: a.limitations ?? old?.limitations ?? '',
      notes: a.notes ?? old?.notes ?? '', blocker: a.blocker ?? old?.blocker ?? '', evidence: a.evidence ?? old?.evidence ?? '',
      conversationKeys: a.clearConversations ? [] : a.conversations.length ? a.conversations : old?.conversationKeys || [] };
    if (a['references-json']) input.references = JSON.parse(a['references-json']);
    output(await request('/api/task', input));
  }
}
main().catch(error => { console.error(`Agent World: ${error.message}`); process.exitCode = 1; });
