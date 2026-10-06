// Derived attention and briefings. Activity never changes a user's task status.
export const TASK_STAGES = { planned: 'Planned', in_progress: 'In progress', needs_review: 'Needs review', accepted: 'Accepted' };

export function attentionItems({ sessions = [], tasks = [] }) {
  const items = sessions.filter(s => s.state === 'error' || (!s.parent_session && s.state === 'waiting_for_user')).map(s => {
    const reason = s.state === 'error' ? 'error' : s.detail?.reason || 'input';
    const actions = {
      permission: ['Approval requested', `Approve or deny in ${s.app || s.source}`],
      input: ['Question or reply needed', `Reply in ${s.app || s.source}`],
      turn_complete: ['Response ready', `Read the response in ${s.app || s.source}`],
      interrupted: ['Conversation stopped', `Check the conversation in ${s.app || s.source}`],
      error: ['Observed error', `Inspect the error in ${s.app || s.source}`],
    };
    const [title, action] = actions[reason] || actions.input;
    return { id: `session:${s.session}`, project: s.project, session: s.session, conversationKey: s.conversation?.key, title, action, reason, since: s.since, routine: reason === 'turn_complete', origin: 'observed' };
  });
  for (const t of tasks) {
    if (t.status === 'accepted') continue;
    if (t.blocker) items.push({ id: `blocker:${t.id}`, project: t.project, task: t.id, title: t.title, action: t.blocker, reason: 'blocker', since: t.blockerSince || t.updatedAt, routine: false, origin: 'user' });
    else if (t.status === 'needs_review') items.push({ id: `review:${t.id}`, project: t.project, task: t.id, title: t.title, action: 'Inspect the recorded outputs, then accept or return to work.', reason: 'review', since: t.reviewSince || t.updatedAt, routine: true, origin: 'user' });
  }
  const priority = { error: 0, permission: 1, input: 1, blocker: 2, interrupted: 3, review: 4, turn_complete: 5 };
  return items.sort((a, b) => (priority[a.reason] ?? 1) - (priority[b.reason] ?? 1) || Date.parse(a.since) - Date.parse(b.since));
}

export function projectBriefing(project, { plans = [], tasks = [], conversations = [], sessions = [] }) {
  const plan = plans.find(p => p.project === project);
  const since = plan?.lastSeenAt || null;
  const newConversations = conversations.filter(c => c.project === project && c.lastObservedAt && (!since || Date.parse(c.lastObservedAt) > Date.parse(since)));
  const changedTasks = tasks.filter(t => t.project === project && (!since || Date.parse(t.updatedAt) > Date.parse(since)));
  const attention = attentionItems({ sessions, tasks }).filter(i => i.project === project);
  const here = tasks.filter(t => t.project === project);
  return { since, newConversations, changedTasks, attention, counts: {
    accepted: here.filter(t => t.status === 'accepted').length,
    reviews: here.filter(t => t.status === 'needs_review').length,
    blockers: here.filter(t => t.blocker && t.status !== 'accepted').length,
  } };
}

export function shouldNotify(session, focusProject) {
  return !focusProject || session.project === focusProject || session.state === 'error' || session.detail?.reason !== 'turn_complete';
}
export function focusedAttention(items, focusProject, showAll = false) {
  return items.filter(i => showAll || !focusProject || !i.routine || i.project === focusProject);
}
