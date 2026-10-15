// A running game-owned process is evidence of work even without a log observer.
// This projection never writes canonical events, sessions, rewards or task state.
export function runnerActivity(runs = [], sessions = []) {
  return runs.filter(r => r.status === 'running').flatMap(r => {
    const observed = sessions.filter(s => s.project === r.project && s.slot === r.slot && !s.parent_session);
    if (observed.some(s => !['idle', 'done'].includes(s.state))) return [];
    const at = Date.parse(r.startedAt || r.createdAt);
    return [{session: `runner:${r.id}`, project: r.project, slot: r.slot,
      parent_session: null, source: r.provider === 'claude' ? 'claude-code' : 'codex',
      provider: r.provider === 'claude' ? 'anthropic' : 'openai',
      app: r.provider === 'claude' ? 'Claude Code CLI' : 'Codex CLI',
      state: 'running', startedAt: r.startedAt || r.createdAt, since: r.startedAt || r.createdAt,
      lastEventAt: Number.isFinite(at) ? at : 0, stateSince: Number.isFinite(at) ? at : 0,
      detail: {summary: 'Game-approved pass running'}, history: [],
      activityEvidence: 'game-runner'}];
  });
}
