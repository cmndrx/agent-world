import assert from 'node:assert/strict';
import { test } from 'node:test';
import { commandKind, commandTarget } from '../shared/commands.mjs';

test('commandTarget keeps program + subcommand, drops arguments and secrets', () => {
  const cases = {
    'npm test -- --watch': 'npm test',
    'npm run build': 'npm run build',
    'cd web && pnpm run dev --port 3000': 'pnpm run dev',
    'git commit -m "secret plans"': 'git commit',
    'git push origin main': 'git push',
    'python -m pytest tests/ -x': 'python -m pytest',
    'API_KEY=abc123 node scripts/build.js': 'node build.js',
    'pytest -q': 'pytest',
    'curl -H "Authorization: Bearer x" https://api.example.com': 'curl',
    'docker compose up -d': 'docker compose',
    'cargo test --release': 'cargo test',
    'ls -la src': 'ls',
    'sudo apt-get install -y jq': 'apt-get install',
    'npx vitest run': 'npx vitest',
  };
  for (const [cmd, want] of Object.entries(cases)) assert.equal(commandTarget(cmd), want, cmd);
});

test('commandKind classifies labels', () => {
  const cases = {
    'npm test': 'test', 'npm run test': 'test', 'python -m pytest': 'test', 'cargo test': 'test', 'npx vitest': 'test',
    'npm install': 'install', 'pip install': 'install', 'yarn add': 'install',
    'npm run build': 'build', 'tsc': 'build', 'make': 'build',
    'npm run dev': 'server', 'git commit': 'git', 'git push': 'deploy', 'docker compose': 'docker',
    'npm run lint': 'lint', 'curl': 'network', 'mkdir': 'files', 'node': 'generic',
  };
  for (const [label, want] of Object.entries(cases)) assert.equal(commandKind(label), want, label);
});
