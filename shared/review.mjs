import { safeReferenceURL } from './work-loop.mjs';

export function normalizeReferences(input, old = [], now = new Date().toISOString()) {
  if (input === undefined) return old;
  if (!Array.isArray(input) || input.length > 20) throw new Error('Use up to 20 outputs or checks.');
  return input.map(r => {
    if (!r || !['output', 'check'].includes(r.kind)) throw new Error('Choose output or check.');
    const value = typeof r.value === 'string' ? r.value.trim() : '';
    if (!value || value.length > 1000) throw new Error('Give each output or check a reference.');
    if (r.kind === 'output' && !value.startsWith('/') && !safeReferenceURL(value)) throw new Error('Outputs need an absolute path or safe web URL.');
    const result = r.kind === 'check' ? r.result || 'unknown' : 'unknown';
    if (!['unknown', 'passed', 'failed'].includes(result)) throw new Error('Choose a reported check result.');
    const recordedBy = typeof r.recordedBy === 'string' ? r.recordedBy.trim().slice(0,100) : 'Unspecified recorder';
    const label = typeof r.label === 'string' ? r.label.trim().slice(0,200) : '';
    const prior = old.find(o => o.kind === r.kind && o.value === value && o.result === result && (o.label || '') === label && o.recordedBy === recordedBy);
    return { kind: r.kind, value, result, label, recordedBy, recordedAt: prior?.recordedAt || now };
  });
}
