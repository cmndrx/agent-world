// Observer contact is separate from session history, CLI installation and account authentication.
export const CONNECTION_TTL = { codex: 20000, claude: 30000 };
export const CONNECTION_MEANING = 'Connected means fresh local activity-observer contact, not account authentication or cloud availability. Codex sends a heartbeat every 5 seconds; Claude Code hooks count for 30 seconds after contact and may expire while idle.';
export function connectionView(snapshot, bridgeConnected, now = Date.now()) {
  const fresh = bridgeConnected && Number.isFinite(snapshot?.capturedAt) && now >= snapshot.capturedAt && now - snapshot.capturedAt < 10000;
  const providers = ['codex', 'claude'].map(id => {
    const p = snapshot?.providers?.[id];
    const valid = fresh && p?.status === 'connected' && Number.isFinite(p.expiresAt) && now < p.expiresAt;
    return { id, label: id === 'codex' ? 'Codex' : 'Claude Code', status: valid ? 'connected' : fresh && p?.status === 'disconnected' ? 'disconnected' : 'unavailable' };
  });
  const count = providers.filter(p => p.status === 'connected').length;
  return { count, providers, text: !bridgeConnected ? 'Live · unavailable' : !fresh ? 'Live · unavailable' : `Live · ${count} provider${count === 1 ? '' : 's'}`, detail: `${providers.map(p => `${p.label}: ${p.status}`).join(' · ')}. ${CONNECTION_MEANING}` };
}
