import { normalizeReferences } from '../shared/review.mjs';
import { randomUUID } from 'node:crypto';
import { TASK_STAGES } from '../shared/productivity.mjs';
import { dayKey } from '../shared/collectibles.mjs';

const text = (v, limit) => typeof v === 'string' ? v.trim().slice(0, limit) : '';
export class Productivity {
  constructor(saved = {}) {
    this.plans = new Map((saved.plans || []).map(p => [p.project, p]));
    this.tasks = new Map((saved.tasks || []).map(t => [t.id, t]));
  }
  savePlan(input, homes, now = new Date().toISOString()) {
    if (typeof input.project !== 'string' || !Object.hasOwn(homes, input.project)) throw new Error('Choose an existing home.');
    const old = this.plans.get(input.project);
    if (old && input.version !== old.version) throw new Error('This plan changed elsewhere. Reopen it before saving.');
    const p = { ...old, project: input.project, outcome: text(input.outcome, 500), nextAction: text(input.nextAction, 500), version: (old?.version || 0) + 1, updatedAt: now };
    this.plans.set(p.project, p); return p;
  }
  saveTask(input, homes, conversations, now = new Date().toISOString()) {
    if (typeof input.project !== 'string' || !Object.hasOwn(homes, input.project)) throw new Error('Choose an existing home.');
    const old = input.id ? this.tasks.get(input.id) : null;
    if (input.id && !old) throw new Error('Task not found.');
    if (old && (old.project !== input.project || input.version !== old.version)) throw new Error('This task changed elsewhere. Reopen it before saving.');
    const title = text(input.title, 200);
    if (!title) throw new Error('Give the task a title.');
    if (!Object.hasOwn(TASK_STAGES, input.status)) throw new Error('Choose a task stage.');
    if (input.status === 'accepted' && old?.status !== 'accepted' && input.acceptedByUser !== true) throw new Error('Confirm that you reviewed and accepted this task.');
    const keys = [...new Set(Array.isArray(input.conversationKeys) ? input.conversationKeys : [])];
    if (keys.length > 100 || keys.some(k => !conversations.has(k) || conversations.get(k).project !== input.project)) throw new Error('Link conversations from this home only.');
    const t = { id: old?.id || randomUUID(), project: input.project, title, status: input.status,
      notes: text(input.notes, 2000), blocker: text(input.blocker, 500), evidence: text(input.evidence, 2000),
      reviewSummary: text(input.reviewSummary === undefined ? old?.reviewSummary : input.reviewSummary, 500),
      limitations: text(input.limitations === undefined ? old?.limitations : input.limitations, 1000),
      references: normalizeReferences(input.references, old?.references || [], now), reviews: old?.reviews || [],
      conversationKeys: keys, createdAt: old?.createdAt || now, updatedAt: now,
      blockerSince: text(input.blocker, 500) ? old?.blocker === text(input.blocker, 500) ? old.blockerSince || old.updatedAt : now : null,
      reviewSince: input.status === 'needs_review' ? old?.status === 'needs_review' ? old.reviewSince || old.updatedAt : now : null,
      acceptedAt: input.status === 'accepted' ? old?.acceptedAt || now : null,
      // Existing accepted rewards retain their policy. Clients cannot opt out of the new ceiling.
      rewardPolicy: input.status === 'accepted' && old?.status !== 'accepted' ? 'daily-v1' : old?.rewardPolicy,
      rewardDay: input.status === 'accepted' && old?.status !== 'accepted' ? dayKey(new Date(now)) : old?.rewardDay,
      version: (old?.version || 0) + 1 };
    this.tasks.set(t.id, t); return t;
  }
  review(input, homes, conversations, now = new Date().toISOString()) {
    const old = this.tasks.get(input.id);
    if (!old || old.project !== input.project || old.version !== input.version) throw new Error('This task changed elsewhere. Reopen the review before saving.');
    if (old.status !== 'needs_review') throw new Error('Only work awaiting review can be reviewed.');
    if (!['accept', 'return'].includes(input.decision)) throw new Error('Choose accept or return.');
    const feedback = text(input.feedback, 2000);
    if (input.decision === 'return' && !feedback) throw new Error('Describe what needs changing.');
    const result = this.saveTask({ ...old, status: input.decision === 'accept' ? 'accepted' : 'in_progress', acceptedByUser: input.acceptedByUser }, homes, conversations, now);
    result.reviews = [...(old.reviews || []), { decision: input.decision, feedback, recordedAt: now, origin: 'human-ui' }].slice(-20);
    return result;
  }
  /**
   * Mark the current outcome reached (or undo the last one). A human decision, like task acceptance:
   * it requires explicit confirmation and is never inferred from agent activity. Raises the home's level.
   */
  milestone({ project, version, action, confirmed }, homes, now = new Date().toISOString()) {
    if (typeof project !== 'string' || !Object.hasOwn(homes, project)) throw new Error('Choose an existing home.');
    const old = this.plans.get(project);
    if (!old) throw new Error('Set an outcome for this home first.');
    if (version !== old.version) throw new Error('This plan changed elsewhere. Reopen it before saving.');
    if (confirmed !== true) throw new Error('Confirm that you decided this outcome is reached.');
    const milestones = [...(old.milestones || [])];
    let outcome = old.outcome;
    if (action === 'reach') {
      if (!old.outcome?.trim()) throw new Error('Set an outcome before marking it reached.');
      milestones.push({ outcome: old.outcome, reachedAt: now });
      outcome = '';
    } else if (action === 'undo') {
      const last = milestones.pop();
      if (!last) throw new Error('No reached outcome to undo.');
      if (!outcome) outcome = last.outcome;
    } else {
      throw new Error('Unknown milestone action.');
    }
    const p = { ...old, outcome, milestones, version: old.version + 1, updatedAt: now };
    this.plans.set(project, p); return p;
  }
  markSeen({ project, through }, homes, now = new Date().toISOString()) {
    if (typeof project !== 'string' || !Object.hasOwn(homes, project)) throw new Error('Choose an existing home.');
    const cutoff = Date.parse(through);
    if (!Number.isFinite(cutoff) || cutoff > Date.parse(now)) throw new Error('Invalid briefing timestamp.');
    const old = this.plans.get(project) || { project, outcome: '', nextAction: '', version: 0 };
    const p = { ...old, lastSeenAt: new Date(Math.max(cutoff, Date.parse(old.lastSeenAt || '1970-01-01'))).toISOString() };
    this.plans.set(project, p); return p;
  }
  snapshot() { return { plans: [...this.plans.values()], tasks: [...this.tasks.values()] }; }
}
