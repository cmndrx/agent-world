// Recorded work and observed signals only. No conversation-content summarization.
import { projectBriefing } from './productivity.mjs';

export function briefingCutoff(project, data, now = Date.now()) {
  const plan = (data.plans || []).find(p => p.project === project);
  const known = [plan?.lastSeenAt, plan?.updatedAt, ...(data.tasks || []).filter(t => t.project === project).map(t => t.updatedAt), ...(data.conversations || []).filter(c => c.project === project).map(c => c.lastObservedAt)].map(Date.parse).filter(Number.isFinite);
  return new Date(Math.min(now, Math.max(0, ...known))).toISOString();
}

export function returnBriefing(project, data) {
  const b = projectBriefing(project, data);
  const plan = (data.plans || []).find(p => p.project === project);
  const tasks = (data.tasks || []).filter(t => t.project === project);
  const first = b.attention[0];
  const nextTask = tasks.find(t => t.status === 'in_progress' && !t.blocker) || tasks.find(t => t.status === 'planned' && !t.blocker);
  const next = first ? { origin: first.origin, title: first.title, detail: first.action, task: first.task, session: first.session }
    : plan?.nextAction ? { origin: 'recorded', title: 'Your recorded next action', detail: plan.nextAction }
    : nextTask ? { origin: 'recorded', title: nextTask.title, detail: 'Continue the recorded task.', task: nextTask.id }
    : { origin: 'recorded', title: 'Choose a next action', detail: 'Record a concrete next step for this project.' };
  return { ...b, next,
    changedTasks: [...b.changedTasks].sort((a, z) => Date.parse(z.updatedAt) - Date.parse(a.updatedAt)),
    newConversations: [...b.newConversations].sort((a, z) => Date.parse(z.lastObservedAt) - Date.parse(a.lastObservedAt)),
    reviews: tasks.filter(t => t.status === 'needs_review'),
  };
}

// Only web references become links; local files are copyable paths, never a file-serving API.
export function safeReferenceURL(value) {
  try {
    const u = new URL(value);
    if (u.username || u.password) return null;
    if (u.protocol === 'https:' || (u.protocol === 'http:' && ['localhost', '127.0.0.1', '[::1]'].includes(u.hostname))) return u.href;
  } catch {}
  return null;
}
export function evidenceReferences(text = '') {
  const refs = [];
  // Standalone paths with spaces can be put on their own line or wrapped in backticks.
  const pattern = /https?:\/\/[^\s<>"`]+|`(\/[^`\n]+)`|^(\/[^\n]+)$|(?:\/Users\/|\/tmp\/|\/private\/|\/home\/)[^\s<>"`]+/gm;
  for (const m of String(text).matchAll(pattern)) {
    const value = (m[1] || m[2] || m[0]).trim().replace(/[.,;]+$/, '').replace(/^((?:https?):.*?)[)\]]+$/, '$1');
    const url = safeReferenceURL(value);
    const ref = url ? { kind: 'url', value: url } : value.startsWith('/') ? { kind: 'path', value } : null;
    if (ref && !refs.some(r => r.value === ref.value)) refs.push(ref);
    if (refs.length === 12) break;
  }
  return refs;
}
