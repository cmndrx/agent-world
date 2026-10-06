import test from 'node:test';
import assert from 'node:assert/strict';
import { World } from '../bridge/world.mjs';
import { Catalog } from '../bridge/catalog.mjs';
import { normalizeEvent } from '../shared/schema.mjs';
import { conversationKey, conversationURL, appProjectID } from '../shared/conversations.mjs';

const event = (session, kind = 'session_start', extra = {}) => normalizeEvent({ kind, session, project: '/project', source: 'codex', provider: 'openai', ts: '2026-10-05T12:00:00Z', ...extra }).event;

test('residents pick up new conversations and the shelf keeps earlier chats', () => {
  const w = new World();
  w.apply(event('first')); const first = w.snapshot(Date.parse('2026-10-05T12:00:00Z')).sessions[0];
  w.apply(event('first', 'session_end'));
  w.apply(event('second', 'session_start', { ts: '2026-10-05T12:01:00Z' }));
  const s = w.snapshot(Date.parse('2026-10-05T12:02:00Z'));
  assert.equal(s.sessions[0].slot, first.slot);
  assert.equal(s.households[0].characters.length, 1);
  assert.deepEqual(s.conversations.map(c => c.id), ['first', 'second']);
  assert.equal(s.sessions[0].conversation.id, 'second');
  const restored = new World({ households: w.households, catalog: w.catalog.snapshot() });
  assert.equal(restored.snapshot().conversations.length, 2);
  assert.equal(restored.snapshot().sessions.length, 0);
});

test('saved chats do not create residents, sessions or needs-you states', () => {
  const w = new World();
  const c = w.catalog.registerConversation({ source: 'chatgpt', url: 'https://chatgpt.com/c/one' });
  w.household(c.project);
  const s = w.snapshot();
  assert.equal(s.sessions.length, 0);
  assert.equal(s.households[0].characters.length, 0);
  assert.equal(s.conversations[0].lastObservedAt, undefined);
  assert.equal(s.conversations[0].project, 'chatgpt:unsorted');
});

test('explicit links share a home but matching project names do not', () => {
  const w = new World(); w.household('/project');
  const p = w.catalog.registerProject({ source: 'chatgpt', externalId: 'p1', name: 'Project', home: '/project' }, w.households);
  const other = w.catalog.registerProject({ source: 'claude', externalId: 'p1', name: 'Project' }, w.households);
  assert.notEqual(p.home, other.home);
  w.apply(event('chat', 'state', { project: p.id, source: 'chatgpt', app: 'ChatGPT', state: 'thinking', conversation: { id: 'c1' } }));
  const s = w.snapshot(Date.parse('2026-10-05T12:02:00Z')).sessions[0];
  assert.equal(s.project, '/project'); assert.equal(s.sourceProject, p.id);
  assert.equal(s.conversation.sourceProject, p.id);
});

test('titles require consent and links cannot point outside the source app', () => {
  const c = new Catalog();
  assert.equal(appProjectID('https://chatgpt.com/g/g-p-example/project', 'chatgpt'), 'g-p-example');
  assert.equal(appProjectID('https://claude.ai/project/example', 'claude'), 'example');
  assert.equal(appProjectID('https://evil.test/project/example', 'claude'), null);
  assert.throws(() => c.registerConversation({ source: 'claude', title: 'Private title', url: 'https://claude.ai/chat/a' }), /Allow saving/);
  assert.throws(() => c.registerConversation({ source: 'claude', url: 'https://chatgpt.com/c/a' }), /direct Claude/);
  for (const url of ['javascript:alert(1)', 'https://claude.ai.evil.test/chat/a', 'https://user:pass@claude.ai/chat/a', 'https://claude.ai/projects/a']) assert.equal(conversationURL(url, 'claude'), null);
  assert.equal(conversationURL('https://claude.ai/chat/a?private=secret#fragment', 'claude'), 'https://claude.ai/chat/a');
  assert.equal(c.registerConversation({ source: 'claude', title: '<b>Hello</b>', allowTitle: true, url: 'https://claude.ai/chat/a' }).title, '<b>Hello</b>');
});

test('conversation IDs are namespaced, helpers stay visitors, user titles survive replay', () => {
  const w = new World();
  w.apply(event('main'));
  const c = w.catalog.conversations.get(conversationKey('codex', 'main')); c.title = 'My title'; c.titleOrigin = 'user';
  w.apply(event('main', 'state', { state: 'reading', conversation: { id: 'main', title: 'Incoming app title' } }));
  w.apply(event('helper', 'state', { parent_session: 'main', state: 'thinking' }));
  assert.equal(w.catalog.conversations.size, 1);
  assert.equal(w.sessions.get('helper').conversation.key, c.key);
  assert.equal(w.catalog.conversations.get(c.key).title, 'My title');
  assert.notEqual(conversationKey('claude', 'main'), c.key);
});


test('source navigation constructs only existing Codex UUID chats and validated web routes',async()=>{
  const {conversationTarget}=await import('../shared/conversations.mjs');
  const id='01a10c07-5065-7023-8c40-bd848f749617';
  assert.equal(conversationTarget({source:'codex',id}).url,`codex://threads/${id}`);
  for(const id of ['new','../settings','uuid?prompt=secret','javascript:alert(1)']) assert.equal(conversationTarget({source:'codex',id}),null);
  assert.equal(conversationTarget({source:'claude-code',id}),null);
  assert.equal(conversationTarget({source:'codex',id:'bad',url:'codex://new?prompt=secret'}),null);
  assert.equal(conversationTarget({source:'claude',url:'https://claude.ai/chat/one?secret=x'}).url,'https://claude.ai/chat/one');
});
