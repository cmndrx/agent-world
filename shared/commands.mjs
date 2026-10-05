// Shell command helpers shared by adapters and the client.
//
// commandTarget() reduces a command line to a privacy-safe label: the program plus, for well-known
// tools, its subcommand ("npm test", "git commit", "python -m pytest"). Arguments, paths, messages
// and secrets are dropped. commandKind() classifies a label for the visualization.

const SUBCOMMAND_TOOLS = new Set([
  'npm', 'pnpm', 'yarn', 'bun', 'npx', 'bunx', 'pnpx', 'git', 'gh', 'cargo', 'go', 'docker', 'docker-compose',
  'kubectl', 'helm', 'terraform', 'pip', 'pip3', 'poetry', 'uv', 'pipenv', 'python', 'python3', 'make', 'brew',
  'deno', 'rails', 'bundle', 'mix', 'dotnet', 'swift', 'gradle', 'gradlew', 'mvn', 'apt', 'apt-get', 'composer',
  'php', 'flutter', 'dart', 'rustup', 'nx', 'turbo', 'vercel', 'netlify', 'fly', 'firebase', 'supabase', 'prisma',
]);
const RUNNERS = new Set(['run', 'exec', 'x', 'dlx', '-m']);
const NOISE = /^(cd|export|set|source|\.|pwd|echo|printf|true|sleep|clear)$/;
const SAFE_WORD = /^[a-z@][\w:.@/-]{0,40}$/i;

/** First meaningful segment of a compound command (skips `cd x &&`, env assignments, sudo, time). */
function mainSegment(cmd) {
  const segments = String(cmd || '')
    .split(/&&|\|\||;|\|/)
    .map((s) => s.trim())
    .filter(Boolean);
  for (const seg of segments) {
    const words = seg.replace(/^(\w+=\S+\s+)+/, '').replace(/^(sudo|time|nohup|env)\s+/, '').split(/\s+/);
    if (words[0] && !NOISE.test(words[0])) return words;
  }
  return (segments[0] || '').split(/\s+/);
}

export function commandTarget(cmd) {
  const words = mainSegment(cmd);
  const program = (words[0] || '').split('/').pop().replace(/^\.\//, '');
  if (!program) return undefined;
  const out = [program];
  if (SUBCOMMAND_TOOLS.has(program)) {
    // Keep the subcommand; for runners ("npm run", "python -m") keep the script/module too.
    for (let i = 1; out.length < 3 && words[i]; i++) {
      const w = words[i];
      if (w.startsWith('-') && !RUNNERS.has(w)) break;
      if (!RUNNERS.has(w) && (!SAFE_WORD.test(w) || (w.includes('/') && !w.startsWith('@')))) break;
      out.push(w);
      if (!RUNNERS.has(w)) break;
    }
  } else if (/^(node|python3?|ruby|bash|sh|zsh|tsx|ts-node|deno)$/.test(program) && /\.\w+$/.test(words[1] || '')) {
    out.push(words[1].split('/').pop()); // a script file name, e.g. "node build.js"
  }
  return out.join(' ');
}

const KINDS = [
  ['test', /\b(test|tests|jest|vitest|pytest|mocha|rspec|phpunit|ava|playwright|cypress|karma|unittest)\b/],
  ['install', /\b(install|add|ci|sync|i|update|upgrade|restore|get)\b|^(pip3?|brew|apt(-get)?|poetry|uv|pipenv) /],
  ['lint', /\b(lint|eslint|prettier|ruff|flake8|black|clippy|fmt|format|stylelint|biome|check|typecheck)\b/],
  ['build', /\b(build|tsc|webpack|rollup|esbuild|compile|bundle|package|assemble|make|xcodebuild|archive)\b/],
  ['docker', /^(docker|docker-compose|kubectl|helm)\b/],
  ['server', /\b(dev|start|serve|server|runserver|preview|watch|up)\b/],
  ['deploy', /\b(deploy|publish|release|push|apply)\b|^(vercel|netlify|fly|firebase)\b/],
  ['git', /^(git|gh)\b/],
  ['db', /\b(psql|mysql|sqlite3|mongosh|redis-cli|prisma|migrate|migration|seed)\b/],
  ['network', /^(curl|wget|http|https|ping|ssh|scp|rsync)\b/],
  ['files', /^(mkdir|rm|mv|cp|chmod|chown|touch|ln|tar|zip|unzip)\b/],
];

/** Classify a command label ("npm test", "git commit", "pytest") for the terminal visuals. */
export function commandKind(label) {
  const s = String(label || '').toLowerCase();
  if (!s) return 'generic';
  if (/^git\b/.test(s)) return /\b(push)\b/.test(s) ? 'deploy' : 'git';
  for (const [kind, re] of KINDS) if (re.test(s)) return kind;
  return 'generic';
}

export const COMMAND_KIND_LABELS = {
  test: 'Running tests',
  install: 'Installing dependencies',
  lint: 'Checking code',
  build: 'Building',
  server: 'Running a server',
  deploy: 'Shipping',
  git: 'Using git',
  docker: 'Managing containers',
  db: 'Working with the database',
  network: 'Making a network request',
  files: 'Moving files around',
  generic: 'Running a command',
};
