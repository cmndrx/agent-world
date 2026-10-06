// Account quota is separate from observed work, token counts and human planning.
export function usageSnapshot(result, capturedAt = new Date().toISOString()) {
  const map = result?.rateLimitsByLimitId;
  const raw = map && typeof map === 'object' && Object.keys(map).length ? Object.entries(map) : result?.rateLimits ? [[result.rateLimits.limitId || 'codex', result.rateLimits]] : [];
  const buckets = raw.slice(0, 20).map(([id, b]) => ({
    id: String(id).slice(0, 100), name: String(b?.limitName || id).slice(0, 100),
    windows: ['primary', 'secondary'].flatMap(key => {
      const w = b?.[key];
      if (!w || typeof w.usedPercent !== 'number' || !Number.isFinite(w.usedPercent) || w.usedPercent < 0 || w.usedPercent > 100) return [];
      return [{ key, remainingPercent: 100 - w.usedPercent,
        minutes: Number.isFinite(w.windowDurationMins) && w.windowDurationMins > 0 ? w.windowDurationMins : null,
        resetsAt: Number.isFinite(w.resetsAt) && w.resetsAt > 0 ? w.resetsAt : null }];
    }),
  })).filter(b => b.windows.length);
  return { status: buckets.length ? 'available' : 'unavailable', capturedAt, buckets };
}

export function usageWindow(window, now = Date.now()) {
  const mins = window.minutes;
  const label = mins === 10080 ? 'Weekly' : mins && mins % 1440 === 0 ? `${mins / 1440}-day` : mins && mins % 60 === 0 ? `${mins / 60}-hour` : mins ? `${mins}-minute` : window.key === 'primary' ? 'Primary window' : 'Secondary window';
  const expired = window.resetsAt != null && window.resetsAt * 1000 <= now;
  return { label, expired, remaining: expired ? null : Math.round(window.remainingPercent * 10) / 10 };
}
