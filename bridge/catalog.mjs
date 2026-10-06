import { CHAT_APPS, conversationKey, conversationURL, appProjectID } from '../shared/conversations.mjs';

export class Catalog {
  constructor(saved = {}) {
    this.projects = new Map((saved.projects || []).map(p => [p.id, p]));
    this.conversations = new Map((saved.conversations || []).map(c => [c.key, c]));
  }

  registerProject({ source, externalId, name, home }, homes) {
    if (!CHAT_APPS[source]) throw new Error('Choose ChatGPT or Claude.');
    const projectId = appProjectID(externalId, source);
    if (!projectId) throw new Error('Paste a project link from the selected app.');
    const id = `${source}:${projectId}`;
    const previous = this.projects.get(id);
    const linked = home || previous?.home || id;
    if (home && !homes[home]) throw new Error('Choose an existing home.');
    if (previous && previous.home !== linked) throw new Error('This project already belongs to a home.');
    const p = { id, source, externalId: projectId, name: String(name || '').trim().slice(0, 100) || `${CHAT_APPS[source]} project`, home: linked };
    this.projects.set(id, p);
    return p;
  }

  registerConversation({ source, project, title, url, allowTitle }) {
    if (!CHAT_APPS[source]) throw new Error('Choose ChatGPT or Claude.');
    const link = conversationURL(url, source);
    if (!link) throw new Error(`Enter a direct ${CHAT_APPS[source]} conversation link.`);
    const id = new URL(link).pathname.split('/').filter(Boolean).pop();
    const p = this.projects.get(project);
    if (project && (!p || p.source !== source)) throw new Error('Choose a project from the same app.');
    if (title && allowTitle !== true) throw new Error('Allow saving the conversation title or leave it blank.');
    const key = conversationKey(source, id);
    const c = { ...this.conversations.get(key), key, id, source, app: CHAT_APPS[source], project: p?.home || `${source}:unsorted`, sourceProject: p?.id || `${source}:unsorted`, title: String(title || '').trim().slice(0, 200) || null, url: link, titleOrigin: title ? 'user' : null, provenance: 'user-added' };
    this.conversations.set(key, c);
    return c;
  }

  observe(event) {
    if (event.parent_session) return null;
    const key = conversationKey(event.source, event.conversation.id);
    const old = this.conversations.get(key);
    const at = Date.parse(event.ts);
    if (old?.lastObservedAt && at < Date.parse(old.lastObservedAt)) return old;
    const c = { ...old, ...event.conversation, key, source: event.source, app: event.app || event.source, project: event.project, sourceProject: event.sourceProject || event.project, title: old?.titleOrigin === 'user' ? old.title : event.conversation.title || old?.title || null, titleOrigin: old?.titleOrigin === 'user' ? 'user' : event.conversation.title ? 'observed' : old?.titleOrigin || null, url: event.conversation.url || old?.url || null, provenance: 'observed', lastObservedAt: event.ts };
    this.conversations.set(key, c);
    return c;
  }

  snapshot() { return { projects: [...this.projects.values()], conversations: [...this.conversations.values()] }; }
}
