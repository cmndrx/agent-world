// Setup follows recorded metadata, never animated activity or completion of an agent turn.
export function projectSetup(project, data) {
  const plan = (data.plans || []).find(p=>p.project===project);
  const tasks = (data.tasks || []).filter(t=>t.project===project);
  const reviewed = tasks.some(t=>t.status==='accepted' || (t.reviews || []).length);
  const steps = [
    {id:'outcome',label:'Set an outcome',done:!!plan?.outcome?.trim() || !!plan?.milestones?.length},
    {id:'task',label:'Add a task',done:tasks.length>0},
    {id:'review',label:'Review a deliverable',done:reviewed},
  ];
  const linked = tasks.some(t=>(t.conversationKeys || []).some(k=>(data.conversations || []).some(c=>c.project===project && c.key===k)));
  return {steps,done:steps.filter(s=>s.done).length,next:steps.find(s=>!s.done)?.id || null,linked,
    reviewTask:tasks.find(t=>t.status==='needs_review'),
    currentTask:tasks.find(t=>t.status==='in_progress') || tasks.find(t=>t.status==='planned') || tasks.find(t=>t.status==='needs_review'),
  };
}

export function taskHandoff(task, data) {
  const home = (data.households || []).find(h=>h.project===task?.project);
  if (!home) throw new Error('Choose a task from an existing home.');
  const plan = (data.plans || []).find(p=>p.project===task.project);
  const latestReview = task.reviews?.at(-1);
  const chats = (task.conversationKeys || []).map(k=>(data.conversations || []).find(c=>c.key===k && c.project===task.project)).filter(Boolean);
  return [
    `Project: ${home.name}\nProject key: ${task.project}\nTask: ${task.title}\nTask ID: ${task.id}\nRecorded version: ${task.version ?? 'unknown'}\nLast task update: ${task.updatedAt || 'unknown'}\nRecorded stage: ${task.status}`,
    `Recorded outcome: ${plan?.outcome || 'Not set'}\nRecorded next step: ${plan?.nextAction || 'Not set'}`,
    task.reviewSummary && `Recorded deliverable summary:\n${task.reviewSummary}`,
    task.limitations && `Recorded limitations:\n${task.limitations}`,
    task.notes && `Recorded task notes:\n${task.notes}`,
    task.blocker && `Recorded blocker:\n${task.blocker}`,
    latestReview && `Latest recorded review (${latestReview.decision}, ${latestReview.recordedAt}):\n${latestReview.feedback || 'No feedback recorded'}`,
    task.evidence && `Recorded evidence (claims, not independent verification):\n${task.evidence}`,
    task.references?.length && `Recorded outputs/checks:\n${task.references.map(r=>`${r.kind}: ${r.label ? r.label+' · ' : ''}${r.value}${r.kind==='check' ? ` · reported ${r.result}` : ''} · recorder ${r.recordedBy} · ${r.recordedAt}`).join('\n')}`,
    chats.length && `Linked conversations (saved links do not imply activity):\n${chats.map(c=>`${c.app || c.source} · ${c.url || `conversation ID: ${c.id}`}`).join('\n')}`,
    task.status==='accepted' && 'This task is already accepted. Inspect its records only unless the human explicitly reopens or authorizes further work.',
    'Continue only within the work I have authorized. Read the existing files and latest task record before changing them; reconcile newer edits instead of overwriting them. Use the Agent World skill when available to record authorized task updates. Inspect return feedback and address it. Perform actual work in your normal tools; Agent World does not run or control agents. Record outputs, checks actually performed and unresolved limits, then leave reviewable work in Needs review. Do not accept your own work, mark outcomes reached, spend rewards or send messages to other conversations. A finished agent turn is not proof of success.',
  ].filter(Boolean).join('\n\n');
}
