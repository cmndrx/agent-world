// Explicit human-entered measurements, separate from agent activity and game rewards.
export const STUDY_METRICS = {
  noticeSeconds: { label: 'Time to notice a request', unit: 'seconds' },
  resumeSeconds: { label: 'Time to resume meaningful work', unit: 'seconds' },
  upkeepMinutes: { label: 'Time maintaining the board', unit: 'minutes' },
  reworkMinutes: { label: 'Time spent on rework', unit: 'minutes' },
  reviewBacklog: { label: 'Deliverables awaiting review at session end', unit: 'items' },
};
export function studyRecord(input, at = new Date().toISOString()) {
  if (!['with', 'without'].includes(input.mode)) throw new Error('Choose with or without Agent World.');
  if (!input.project || !String(input.comparison || '').trim()) throw new Error('Name the matched work slice.');
  const row = { project: String(input.project), comparison: String(input.comparison).trim().slice(0, 200), mode: input.mode, at,
    origin: 'human-entered', notes: String(input.notes || '').trim().slice(0, 1000) };
  for (const key of Object.keys(STUDY_METRICS)) {
    const raw = input[key];
    row[key] = raw == null || String(raw).trim() === '' ? null : Number(raw);
    if (row[key] !== null && (!Number.isFinite(row[key]) || row[key] < 0 || row[key] > 100000 || (key === 'reviewBacklog' && !Number.isInteger(row[key])))) throw new Error(`Enter a valid ${STUDY_METRICS[key].label.toLowerCase()}, or leave it blank.`);
  }
  if (Object.keys(STUDY_METRICS).every(k => row[k] === null)) throw new Error('Record at least one measured value. Blank means unknown.');
  return row;
}
const median = values => {
  if (!values.length) return null;
  const a = [...values].sort((a, b) => a - b), mid = Math.floor(a.length / 2);
  return a.length % 2 ? a[mid] : (a[mid - 1] + a[mid]) / 2;
};
export function compareStudy(rows, project) {
  const selected = rows.filter(r => r.project === project);
  const groups = new Map();
  for (const r of selected) {
    if (!['with', 'without'].includes(r.mode)) continue;
    const g = groups.get(r.comparison) || { with: [], without: [] };
    g[r.mode].push(r); groups.set(r.comparison, g);
  }
  const metrics = Object.entries(STUDY_METRICS).map(([key, info]) => {
    const pairs = [];
    for (const g of groups.values()) {
      // Pair repeated trials in recording order; never reuse one baseline for many sessions.
      const n = Math.min(g.with.length, g.without.length);
      for (let i = 0; i < n; i++) {
        const w = g.with[i][key], b = g.without[i][key];
        if (typeof w === 'number' && Number.isFinite(w) && w >= 0 && typeof b === 'number' && Number.isFinite(b) && b >= 0) pairs.push({ with: w, without: b, delta: w - b });
      }
    }
    return { key, ...info, pairs: pairs.length, with: median(pairs.map(p => p.with)), without: median(pairs.map(p => p.without)), delta: median(pairs.map(p => p.delta)) };
  });
  return { records: selected.length, metrics };
}

// Only explicit start/stop actions provide elapsed values; no agent activity inference.
export function elapsedMeasurement(key, startedAt, stoppedAt) {
  if (!Object.hasOwn(STUDY_METRICS,key) || key==='reviewBacklog' || !Number.isFinite(startedAt) || !Number.isFinite(stoppedAt) || stoppedAt<startedAt) throw new Error('Timer unavailable or clock changed. Enter an observed value manually.');
  return (stoppedAt-startedAt)/(STUDY_METRICS[key].unit==='minutes'?60000:1000);
}
export function pendingStudyPairs(rows,project) {
  const groups=new Map();
  for(const r of rows.filter(r=>r.project===project && ['with','without'].includes(r.mode))) {
    const g=groups.get(r.comparison)||{comparison:r.comparison,with:0,without:0};g[r.mode]++;groups.set(r.comparison,g);
  }
  return [...groups.values()].filter(g=>g.with!==g.without).map(g=>({comparison:g.comparison,mode:g.with>g.without?'without':'with'}));
}
