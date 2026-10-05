// Activity resolver: agent truth (state + tool + target) → what the Sim is visibly doing, and how
// to say it in plain words.
//
// Pure (no Three.js) so it can be unit-tested. `label` is a short human sentence ("Committing
// changes"); `detail` is the exact thing from the agent (a command, file or domain) shown smaller.
// Both come straight from observed events. The screen renderer draws those as real text and
// everything else (code, output, page content) as abstract shapes.

import { commandKind } from '../../shared/commands.mjs';

const LANGS = [
  [/\.(ts|tsx|mts|cts)$/i, 'TypeScript', '#3178c6'],
  [/\.(js|jsx|mjs|cjs)$/i, 'JavaScript', '#e8c547'],
  [/\.py$/i, 'Python', '#4b8bbe'],
  [/\.go$/i, 'Go', '#00add8'],
  [/\.rs$/i, 'Rust', '#de6d3a'],
  [/\.rb$/i, 'Ruby', '#cc342d'],
  [/\.(java|kt|kts|scala)$/i, 'JVM', '#b07219'],
  [/\.swift$/i, 'Swift', '#f05138'],
  [/\.(c|h|cc|cpp|hpp|m|mm)$/i, 'C/C++', '#6e8bc4'],
  [/\.cs$/i, 'C#', '#68217a'],
  [/\.php$/i, 'PHP', '#777bb4'],
  [/\.(md|mdx|txt|rst)$/i, 'Docs', '#8a94a6'],
  [/\.(json|ya?ml|toml|ini|env|lock)$/i, 'Config', '#c9a227'],
  [/\.(css|scss|sass|less)$/i, 'Styles', '#c76494'],
  [/\.(html|vue|svelte|astro)$/i, 'Markup', '#e34c26'],
  [/\.sql$/i, 'SQL', '#e38c00'],
  [/\.(sh|bash|zsh|fish)$/i, 'Shell', '#4eaa25'],
  [/(^|\/)Dockerfile$/i, 'Docker', '#2496ed'],
  [/\.ipynb$/i, 'Notebook', '#f37626'],
  [/\.(png|jpe?g|gif|svg|webp)$/i, 'Image', '#9b7ede'],
];

export function languageOf(file) {
  for (const [re, name, color] of LANGS) if (re.test(file || '')) return { name, color };
  return { name: 'Text', color: '#8a94a6' };
}

const base = (p) => String(p || '').split('/').pop();
const SHELL_TOOLS = /^(Bash|exec_command|exec|shell|local_shell|write_stdin|wait)$/;

// ---- Tool names → words --------------------------------------------------------------------

/** Split an MCP tool name into a friendly app name and action ("mcp__github__create_pr" → GitHub, "create pr"). */
export function mcpParts(tool) {
  const t = String(tool || '');
  let server = '';
  let action = '';
  if (t.startsWith('mcp__')) [, server = '', action = ''] = t.split('__');
  else if (t.includes('.')) [server, action] = [t.slice(0, t.lastIndexOf('.')), t.slice(t.lastIndexOf('.') + 1)];
  server = server.replace(/^mcp__/, '');
  const known = [
    [/browser|chrome|playwright|puppeteer/i, 'the browser'],
    [/github/i, 'GitHub'],
    [/gitlab/i, 'GitLab'],
    [/slack/i, 'Slack'],
    [/linear/i, 'Linear'],
    [/notion/i, 'Notion'],
    [/figma/i, 'Figma'],
    [/google_?drive|gdrive/i, 'Google Drive'],
    [/gmail/i, 'Gmail'],
    [/calendar/i, 'Calendar'],
    [/jira|atlassian/i, 'Jira'],
    [/sentry/i, 'Sentry'],
    [/postgres|supabase|sqlite|mysql|database|db/i, 'the database'],
    [/cua|computer/i, 'the computer'],
    [/node_repl/i, 'a Node.js console'],
    [/unreal/i, 'Unreal Engine'],
    [/^ccd_|claude|docs/i, 'the Claude app'],
  ];
  const name = known.find(([re]) => re.test(server))?.[1] || server.replace(/[_-]+/g, ' ').trim() || 'a tool';
  return { app: name, action: action.replace(/[_-]+/g, ' ').trim() };
}

const BROWSER_ACTIONS = [
  [/navigate|open|goto|preview_start/i, 'Opening a web page'],
  [/click|hover|drag/i, 'Clicking around a web page'],
  [/type|form|fill|input|key/i, 'Filling in a form'],
  [/screenshot|zoom/i, 'Taking a screenshot'],
  [/read_page|page_text|find|snapshot|get_/i, 'Reading a web page'],
  [/javascript|eval|exec/i, 'Running code in the browser'],
  [/tab/i, 'Switching browser tabs'],
  [/console|network|logs/i, 'Checking the browser for errors'],
  [/resize/i, 'Resizing the browser'],
];

/** Plain-words label for a shell command label ("git commit" → "Committing changes"). */
export function commandPhrase(command) {
  const c = String(command || '').toLowerCase();
  const sub = c.split(/\s+/)[1] || '';
  if (/^git\b/.test(c)) {
    return {
      commit: 'Committing changes', add: 'Staging changes', push: 'Pushing changes', pull: 'Pulling the latest changes',
      fetch: 'Fetching the latest changes', status: 'Checking what changed', diff: 'Checking what changed',
      log: 'Looking at git history', show: 'Looking at git history', blame: 'Looking at git history',
      checkout: 'Switching branches', switch: 'Switching branches', branch: 'Managing branches', merge: 'Merging changes',
      rebase: 'Rebasing changes', stash: 'Stashing changes', clone: 'Cloning a repository', reset: 'Undoing changes',
      restore: 'Undoing changes', init: 'Setting up a git repository', tag: 'Tagging a release', worktree: 'Setting up a workspace',
    }[sub] || 'Using git';
  }
  if (/^gh\b/.test(c)) return sub === 'pr' ? 'Working on a pull request' : sub === 'issue' ? 'Working on an issue' : 'Using GitHub';
  const script = /^(node|python3?|ruby|bash|sh|zsh|tsx|ts-node|deno)\s+([\w.-]+\.\w+)$/.exec(c);
  if (script) return `Running ${script[2]}`;
  return {
    test: 'Running tests',
    install: 'Installing packages',
    lint: 'Checking code quality',
    build: 'Building the project',
    server: 'Starting the app',
    deploy: 'Deploying',
    docker: 'Working with Docker',
    db: 'Working with the database',
    network: 'Calling a web service',
    files: 'Organizing files',
    git: 'Using git',
  }[commandKind(c)] || 'Running a command';
}

/** What the agent is thinking about, given the tool it just finished (Claude/Codex report this). */
function afterTool(tool) {
  if (!tool) return 'Thinking';
  if (/^(Edit|MultiEdit|Write|apply_patch|NotebookEdit)$/.test(tool)) return 'Checking its changes';
  if (/^(Read|NotebookRead|view_image)$/.test(tool)) return 'Thinking about what it read';
  if (/^(Grep|Glob|LS)$/.test(tool)) return 'Going through what it found';
  if (SHELL_TOOLS.test(tool)) return 'Looking at the command output';
  if (/Web|web|search/.test(tool)) return 'Reading what it found online';
  if (/^(Task|Agent)$|agent/i.test(tool)) return "Reviewing the helper's report";
  return 'Thinking';
}

const PERMISSION = [
  [SHELL_TOOLS, 'Needs your OK to run a command'],
  [/^(Edit|MultiEdit|Write|NotebookEdit|apply_patch)$/, 'Needs your OK to change files'],
  [/^(WebFetch|WebSearch)$/, 'Needs your OK to go online'],
  [/browser|chrome/i, 'Needs your OK to use the browser'],
];

const HELPERS = {
  explore: 'Sending a helper to explore the code',
  plan: 'Asking a helper to make a plan',
  'general-purpose': 'Starting a helper agent',
  'claude-code-guide': 'Asking a helper to look up docs',
};

// ---- Resolver ------------------------------------------------------------------------------

/**
 * @param {object|null} truth  session from the bridge (null = no agent attached)
 * @returns {{app:string, title:string, label:string, detail?:string, pose:string, lead?:{pose:string,dur:number}, at:'desk'|'wait'|'away', [k:string]:any}}
 */
export function resolveActivity(truth) {
  if (!truth) return { app: 'off', title: '', label: 'Off duty', detail: 'No session open', prose: true, pose: 'doze', at: 'away' };

  const { state } = truth;
  const d = truth.detail || {};
  const tool = d.tool || '';
  const target = d.target || '';
  const summary = d.summary || '';

  switch (state) {
    case 'idle':
      return { app: 'idle', title: 'Locked', label: 'Idle', detail: 'Nothing to do right now', prose: true, pose: 'stand', at: 'away' };

    case 'thinking':
      if (/^(TodoWrite|TaskCreate|TaskUpdate)$/i.test(tool)) return { app: 'plan', title: 'To-do list', label: 'Updating its to-do list', pose: 'plan', tool, at: 'desk' };
      if (/^(update_plan|ExitPlanMode)$/i.test(tool)) return { app: 'plan', title: 'Plan', label: 'Writing up a plan', pose: 'plan', tool, at: 'desk' };
      if (truth.parent_session && target && !tool) return { app: 'chat', title: 'Thinking', label: 'Getting started', pose: 'think', at: 'desk' };
      return { app: 'chat', title: 'Thinking', label: afterTool(tool), tool, pose: 'think', at: 'desk' };

    case 'reading': {
      if (/^(Grep|Glob|search|grep_search|file_search)$/i.test(tool) || /^(rg|grep|ag|ack|git grep)\b/.test(target)) {
        const glob = tool === 'Glob';
        const q = /^(Grep|Glob)$/.test(tool) ? target : summary || '';
        return {
          app: 'search', title: 'Search', label: glob ? 'Looking for files' : 'Searching the code',
          detail: q ? `“${q}”` : target, query: q, tool, pose: 'read', lead: { pose: 'type', dur: 0.9 }, at: 'desk',
        };
      }
      if (/^view_image$/i.test(tool) || languageOf(target).name === 'Image') {
        return { app: 'image', title: base(target) || 'Image', label: 'Looking at an image', detail: target, file: target, pose: 'read', at: 'desk' };
      }
      if (/^(ls|tree|find|fd)\b/.test(target) || tool === 'LS') {
        return { app: 'files', title: 'Files', label: 'Looking around the project', detail: target, pose: 'mouse', tool, at: 'desk' };
      }
      if (SHELL_TOOLS.test(tool)) {
        const label = /^git\b/.test(target) ? commandPhrase(target) : /^(cat|head|tail|sed|less|more|nl|wc)\b/.test(target) ? 'Reading a file' : 'Inspecting the project';
        return { app: 'terminal', title: target || 'Terminal', label, detail: target, command: target, kind: 'read', pose: 'read', lead: { pose: 'type', dur: 0.8 }, at: 'desk' };
      }
      const file = target;
      return { app: 'reader', title: base(file) || 'Reading', label: file ? `Reading ${base(file)}` : 'Reading', detail: file, file, lang: languageOf(file), tool, pose: 'read', at: 'desk' };
    }

    case 'editing': {
      const file = target;
      const fresh = /^Write$/i.test(tool);
      if (/Notebook/i.test(tool)) {
        return { app: 'notebook', title: base(file) || 'Notebook', label: `Editing ${base(file) || 'a notebook'}`, detail: file, file, tool, pose: 'type', at: 'desk' };
      }
      return {
        app: 'editor',
        mode: fresh ? 'new' : 'diff',
        title: base(file) || 'Editor',
        label: file ? `${fresh ? 'Writing' : 'Editing'} ${base(file)}` : 'Editing code',
        detail: file,
        file,
        lang: languageOf(file),
        tool,
        pose: 'type',
        at: 'desk',
      };
    }

    case 'running': {
      if (/^(write_stdin|wait)$/.test(tool)) {
        return { app: 'terminal', title: 'Terminal', label: 'Waiting on a running command', command: target, kind: 'generic', tool, pose: 'watch', at: 'desk' };
      }
      if (!SHELL_TOOLS.test(tool) && (tool.startsWith('mcp__') || tool.includes('.'))) {
        const { app, action } = mcpParts(tool);
        return { app: 'tool', title: app, label: `Using ${app}`, detail: action || target, tool, pose: 'mouse', at: 'desk' };
      }
      const command = target;
      const kind = commandKind(command);
      const watch = kind === 'server' ? 'lounge' : kind === 'test' || kind === 'build' ? 'watch_close' : 'watch';
      return {
        app: 'terminal',
        title: command || 'Terminal',
        label: commandPhrase(command),
        detail: command,
        command,
        kind,
        tool,
        pose: watch,
        lead: { pose: 'type', dur: 1.2 },
        at: 'desk',
      };
    }

    case 'searching': {
      if (/WebSearch|web_search|search_query/i.test(tool) || (!target && !tool.includes('__'))) {
        return { app: 'websearch', title: 'Web search', label: 'Searching the web', detail: summary ? `“${summary}”` : '', query: summary, tool, pose: 'mouse', lead: { pose: 'type', dur: 1.2 }, at: 'desk' };
      }
      const domain = /^[\w.-]+\.[a-z]{2,}$/i.test(target) ? target : '';
      if (domain) {
        return { app: 'browser', title: domain, label: `Reading ${domain}`, detail: '', domain, tool, pose: 'mouse', lead: { pose: 'type', dur: 0.8 }, at: 'desk' };
      }
      const action = mcpParts(tool).action || target;
      const label = BROWSER_ACTIONS.find(([re]) => re.test(action))?.[1] || 'Using the browser';
      return { app: 'browser', title: 'Browser', label, detail: action, domain: '', action, tool, pose: 'mouse', lead: { pose: 'type', dur: 0.8 }, at: 'desk' };
    }

    case 'delegating': {
      const role = target;
      const codexVerb = /wait_agent/.test(tool) ? 'Waiting for a helper' : /send_message|followup/.test(tool) ? 'Messaging a helper' : null;
      const label = codexVerb || HELPERS[role.toLowerCase()] || (role ? `Starting a ${role} helper` : 'Starting a helper agent');
      return { app: 'delegate', title: 'Helper', label, detail: role ? `${role} helper` : '', role, tool, pose: 'talk', lead: { pose: 'type', dur: 0.9 }, at: 'desk' };
    }

    case 'waiting_for_user': {
      const reason = d.reason;
      const where = appName(truth) || 'your agent app';
      if (reason === 'permission') {
        const friendly = tool.startsWith('mcp__') ? mcpParts(tool).app : tool;
        const label = PERMISSION.find(([re]) => re.test(tool))?.[1] || (tool ? `Needs your OK to use ${friendly}` : 'Needs your approval');
        return { app: 'dialog', title: 'Approval needed', label, detail: `Approve or deny it in ${where}`, prose: true, tool, pose: 'wave', at: 'wait' };
      }
      if (reason === 'input') return { app: 'question', title: 'Question', label: 'Has a question for you', detail: `Answer it in ${where}`, prose: true, pose: 'wave', at: 'wait' };
      if (reason === 'interrupted') return { app: 'interrupted', title: 'Stopped', label: 'Stopped, waiting for you', detail: `Reply in ${where} to continue`, prose: true, pose: 'wave', at: 'wait' };
      return { app: 'yourturn', title: 'Your turn', label: 'Done, your turn', detail: `Reply in ${where} to keep it going`, prose: true, pose: 'wave', at: 'wait' };
    }

    case 'error': {
      const label = SHELL_TOOLS.test(tool) ? 'A command failed' : /^(Edit|MultiEdit|Write)$/.test(tool) ? "An edit didn't go through" : 'Something went wrong';
      return { app: 'error', title: 'Error', label, detail: tool, tool, pose: 'facepalm', at: 'desk' };
    }

    case 'done':
      return { app: 'yourturn', title: 'Done', label: 'Done', pose: 'cheer', at: 'wait' };

    default:
      return { app: 'chat', title: state, label: 'Working', pose: 'think', at: 'desk' };
  }
}

/** A stable key: when it changes, the screen restarts its animation and the Sim replays its lead-in. */
export function activityKey(a) {
  return [a.app, a.title, a.command, a.file, a.domain, a.query, a.action].join('|');
}

// ---- App names -------------------------------------------------------------------------------

/** Which app a session is running in, in plain words. */
export function appName(session) {
  if (!session) return '';
  if (session.app) return session.app;
  if (session.source === 'claude-code') return 'Claude Code';
  if (session.source === 'codex') return 'Codex';
  return session.source || 'Agent';
}

/** Short brand for compact places (chips, badges). */
export function brandOf(session) {
  if (!session) return '';
  if (session.provider === 'anthropic' || session.source === 'claude-code') return 'Claude';
  if (session.provider === 'openai' || session.source === 'codex') return 'Codex';
  return appName(session);
}
