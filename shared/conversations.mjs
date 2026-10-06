// Conversation metadata is separate from activity. A saved chat never starts a session.
export const CHAT_APPS = { chatgpt: 'ChatGPT', claude: 'Claude' };

export function conversationKey(source, id) {
  return JSON.stringify([source, id]);
}

export function conversationURL(value, source) {
  if (!value) return null;
  try {
    const u = new URL(value);
    const host = source === 'chatgpt' ? 'chatgpt.com' : source === 'claude' ? 'claude.ai' : null;
    if (!host || u.protocol !== 'https:' || u.hostname !== host || u.username || u.password || u.port) return null;
    if (!(source === 'chatgpt' ? /^\/(?:g\/[^/]+\/)?c\/[^/]+\/?$/ : /^\/chat\/[^/]+\/?$/).test(u.pathname)) return null;
    return `${u.origin}${u.pathname}`;
  } catch { return null; }
}

export function normalizeConversation(value, source, fallbackId) {
  const c = value && typeof value === 'object' ? value : {};
  return {
    id: typeof c.id === 'string' && c.id.trim() ? c.id.trim().slice(0, 200) : fallbackId,
    title: typeof c.title === 'string' && c.title.trim() ? c.title.trim().slice(0, 200) : null,
    url: conversationURL(c.url, source),
  };
}

export function conversationLabel(c) {
  return c?.title || `Conversation ${String(c?.id || '').slice(0, 8)}`;
}

/** Accept a copied app project link, or the raw ID used by an observer. */
export function appProjectID(value, source) {
  const text = String(value || '').trim();
  if (!text) return null;
  if (!text.includes('://')) return text.slice(0, 200);
  try {
    const u = new URL(text);
    if (u.protocol !== 'https:' || u.username || u.password || u.port) return null;
    const match = source === 'chatgpt' && u.hostname === 'chatgpt.com'
      ? u.pathname.match(/^\/g\/([^/]+)\/project\/?$/)
      : source === 'claude' && u.hostname === 'claude.ai'
        ? u.pathname.match(/^\/project\/([^/]+)\/?$/) : null;
    return match?.[1]?.slice(0, 200) || null;
  } catch { return null; }
}

// Navigation only: construct the documented existing-chat route from a validated ID.
// Never use a supplied custom-protocol URL or a route that creates/prompts a chat.
export function conversationTarget(c) {
  const web = conversationURL(c?.url, c?.source);
  if (web) return {url:web,label:`Open in ${CHAT_APPS[c.source]}`,native:false};
  if (c?.source==='codex' && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(c.id || '')) {
    return {url:`codex://threads/${c.id}`,label:'Open in Codex',native:true};
  }
  return null;
}
