// Connection is transport state. Event age is history, never proof an agent stopped.
export function observationTime(value) {
  const raw = value?.lastEventAt ?? value?.lastObservedAt ?? value?.history?.at(-1)?.ts ?? value?.since;
  const n = typeof raw === 'number' ? raw : Date.parse(raw);
  return Number.isFinite(n) ? n : null;
}
export function observedLabel(value, now = Date.now()) {
  const at = observationTime(value);
  if (at === null) return 'No observation received';
  const seconds = Math.max(0, Math.floor((now-at)/1000));
  const age = seconds < 60 ? 'just now' : seconds < 3600 ? `${Math.floor(seconds/60)}m ago` : seconds < 86400 ? `${Math.floor(seconds/3600)}h ago` : `${Math.floor(seconds/86400)}d ago`;
  return `Last observed ${age}`;
}
export function focusState(project, homes = []) {
  const home = homes.find(h=>h.project===project);
  return { effective: home?.project || '', label: home ? `Focus: ${home.name}` : project ? 'Saved focus unavailable' : 'All homes', saved: !!project };
}
