// The city (play layer): downtown grows from the *kinds* of work your agents actually do.
//
// Rules (docs/GAMEPLAY.md, "City"):
// - Variety, not volume. Each kind of work counts at most once per day. How much, how long, or how many
//   tokens never matters, so there is nothing to gain from making agents busier.
// - Descriptive, never evaluative. Nothing decays, there are no streaks, and quiet days never shrink the city.
// - Observed events only. Synthetic events (the fake demo agents) never count outside demo mode.
// - Privacy: only activity categories are kept (no file names, paths or commands). File-type signals need
//   the "targets" privacy level; at "state" the city simply gets fewer signals.
//
// The ledger is a projection of the event log, kept in ~/.agent-world/city.json so deleting old event
// files never takes buildings away. It is shared by the bridge (recording) and the client (display).

import { commandKind } from './commands.mjs';
import { dayKey } from './collectibles.mjs';

/** Kinds of observed work. `phrase` completes "your agents …". */
export const SIGNALS = {
  tests: { label: 'Testing', phrase: 'ran tests' },
  git: { label: 'Version control', phrase: 'used git' },
  ship: { label: 'Shipping', phrase: 'pushed, deployed or ran containers' },
  search: { label: 'Web research', phrase: 'searched the web' },
  frontend: { label: 'Frontend', phrase: 'edited frontend files (styles, pages, components)', needsTargets: true },
  docs: { label: 'Writing docs', phrase: 'edited docs', needsTargets: true },
  data: { label: 'Data work', phrase: 'worked with data (notebooks, CSV, SQL or a database)', needsTargets: true },
  delegate: { label: 'Teamwork', phrase: 'started helper agents' },
};

/** Downtown businesses: one per kind of work. Each opens after its work shows up on DAYS_TO_OPEN days. */
export const BUSINESSES = {
  qa_lab: { name: 'QA lab', landmark: 'Testing tower', signal: 'tests', color: 0x5fbf73, prop: 'lens' },
  post_office: { name: 'Post office', landmark: 'Clock tower post office', signal: 'git', color: 0x4f86c6, prop: 'envelope' },
  shipping: { name: 'Shipping depot', landmark: 'Freight terminal', signal: 'ship', color: 0xd9886a, prop: 'crates' },
  library: { name: 'Library', landmark: 'Grand library', signal: 'search', color: 0x9b7ede, prop: 'books' },
  studio: { name: 'Design studio', landmark: 'Art gallery', signal: 'frontend', color: 0xe56b8a, prop: 'palette' },
  print_shop: { name: 'Print shop', landmark: 'Newspaper building', signal: 'docs', color: 0xe6c84f, prop: 'paper' },
  research_lab: { name: 'Research lab', landmark: 'Observatory', signal: 'data', color: 0x3fb7b0, prop: 'dome' },
  coworking: { name: 'Coworking space', landmark: 'Innovation hub', signal: 'delegate', color: 0xef8354, prop: 'chairs' },
};

/**
 * Upgrades by use: the more different days a business's kind of work happens, the bigger it gets.
 * Usage is counted in days (once per day), never volume, so an agent looping all afternoon adds nothing.
 */
export const TIERS = [
  { name: 'Open', days: 2 },
  { name: 'Expanded', days: 7 },
  { name: 'Flagship', days: 14 },
  { name: 'Landmark', days: 30 },
];

/** 0 = not open yet; 1 Open … 4 Landmark. */
export function businessTier(city, id) {
  const days = city?.signals?.[BUSINESSES[id].signal]?.count || 0;
  let tier = 0;
  TIERS.forEach((t, i) => days >= t.days && (tier = i + 1));
  return tier;
}

/** The business's display name at a tier (landmarks get their own). */
export const businessName = (id, tier = 1) => (tier >= TIERS.length ? BUSINESSES[id].landmark : BUSINESSES[id].name);

/** { days, tier, next: { name, days } | null } for progress displays. */
export function businessProgress(city, id) {
  const days = city?.signals?.[BUSINESSES[id].signal]?.count || 0;
  const tier = businessTier(city, id);
  const next = TIERS[tier] || null;
  return { days, tier, next };
}

// Pacing: construction starts the first day a kind of work is seen, and the business opens on its second.
export const DAYS_TO_OPEN = 2;
export const STAGE_NAMES = ['Not started', 'Lot surveyed', 'Under construction', 'Open'];
const MAX_PROJECTS = 20;
const MAX_PEOPLE = 400;

/** Roles: a resident's (or hired helper's) most common kind of work, and where that work happens downtown. */
export const ROLES = {
  tests: { title: 'Tester', business: 'qa_lab' },
  git: { title: 'Clerk', business: 'post_office' },
  ship: { title: 'Shipper', business: 'shipping' },
  search: { title: 'Researcher', business: 'library' },
  frontend: { title: 'Designer', business: 'studio' },
  docs: { title: 'Writer', business: 'print_shop' },
  data: { title: 'Analyst', business: 'research_lab' },
  delegate: { title: 'Manager', business: 'coworking' },
};
/** A helper type (e.g. "Explore") that worked on this many different days in a project is hired. */
export const HIRE_AFTER_DAYS = 3;
const STAFF_NAMES = ['Ari', 'Bea', 'Cy', 'Dot', 'Eli', 'Fern', 'Gil', 'Hal', 'Ivy', 'Jay', 'Kai', 'Lux', 'Mae', 'Ned', 'Ola', 'Pax', 'Rue', 'Sky', 'Tam', 'Uma', 'Viv', 'Wes', 'Zia', 'Bo', 'Cal', 'Dee'];

const addDay = (list, day) => {
  if (list.includes(day)) return false;
  list.push(day);
  list.sort();
  return true;
};

const FRONTEND = /\.(css|scss|sass|less|html?|jsx|tsx|vue|svelte|astro)$/i;
const DOCS = /\.(md|mdx|rst|adoc)$/i;
const DATA = /\.(ipynb|csv|tsv|sql|parquet|xlsx?|jsonl|r|jl)$/i;

/** Synthetic events (fake demo agents) are flagged by the emitter; older ones are recognized by session id. */
export const isSynthetic = (e) => e?.x_synthetic === true || /^fake-/.test(e?.session || '');

/** Kinds of work an observed event shows (usually zero or one). Only categories, never the target itself. */
export function signalsOf(e) {
  if (!e) return [];
  const out = new Set();
  if (e.kind === 'session_start' && e.parent_session) out.add('delegate');
  if (e.kind !== 'state') return [...out];
  const target = e.detail?.target || '';
  if (e.state === 'delegating') out.add('delegate');
  if (e.state === 'searching') out.add('search');
  if (e.state === 'running' && target) {
    const kind = commandKind(target);
    if (kind === 'test') out.add('tests');
    else if (kind === 'git') out.add('git');
    else if (kind === 'deploy' || kind === 'docker') out.add('ship');
    else if (kind === 'db') out.add('data');
    if (/^git\b/i.test(target)) out.add('git'); // "git push" is both version control and shipping
  }
  if (e.state === 'editing' && target) {
    const file = target.split(/[?#]/)[0];
    if (FRONTEND.test(file)) out.add('frontend');
    if (DOCS.test(file)) out.add('docs');
    if (DATA.test(file)) out.add('data');
  }
  return [...out];
}

export function emptyCity() {
  return { version: 2, signals: {}, days: [], people: {}, demo: false };
}

/** Ledger keys for people: residents by home and desk slot, helpers by home and helper type. */
export const residentKey = (project, slot) => `r:${project}#${slot}`;
export const helperKey = (project, type) => `h:${project}|${type}`;

/** A helper type in plain words, safe to store ("Explore", "reviewer"). */
export function helperType(raw) {
  const t = String(raw || '').replace(/[\u0000-\u001f]/g, '').trim().slice(0, 40);
  return t || 'helper';
}

/**
 * Fold one event into the ledger (mutates it). Returns true when something new was learned
 * (a new day for a kind of work, a new project doing it, or a new working day for a person).
 * Replaying the same events is harmless: everything is a set of days.
 * @param {{ key: string, kind: 'resident'|'helper', project: string, slot?: number, type?: string }|null} [person]
 *   who did the work (from the bridge's session model)
 */
export function recordEvent(city, e, { allowSynthetic = false, person = null } = {}) {
  const synthetic = isSynthetic(e);
  if (synthetic && !allowSynthetic) return false;
  const at = Date.parse(e?.ts);
  if (!Number.isFinite(at)) return false;
  const day = dayKey(new Date(at));
  const kinds = signalsOf(e);
  let changed = false;
  city.people ??= {};
  if (person && (city.people[person.key] || Object.keys(city.people).length < MAX_PEOPLE)) {
    const p = (city.people[person.key] ??= { kind: person.kind, project: person.project, ...(person.slot != null ? { slot: person.slot } : {}), ...(person.type ? { type: person.type } : {}), days: [], signals: {} });
    // Helpers "work a day" by showing up; residents' days come from their kinds of work.
    if (person.kind === 'helper' || kinds.length) changed = addDay(p.days, day) || changed;
    for (const kind of kinds) changed = addDay((p.signals[kind] ??= []), day) || changed;
  }
  if (!kinds.length) {
    if (changed && synthetic && !city.demo) city.demo = true;
    return changed;
  }
  for (const kind of kinds) {
    const s = (city.signals[kind] ??= { count: 0, days: [], projects: [], first: e.ts, last: e.ts });
    if (addDay(s.days, day)) changed = true;
    s.count = s.days.length;
    if (e.project && !s.projects.includes(e.project) && s.projects.length < MAX_PROJECTS) {
      s.projects.push(e.project);
      changed = true;
    }
    if (e.ts < s.first) s.first = e.ts;
    if (e.ts > s.last) s.last = e.ts;
  }
  if (addDay(city.days, day)) changed = true;
  if (synthetic && !city.demo) {
    city.demo = true;
    changed = true;
  }
  return changed;
}

/** Merge a saved ledger with one rebuilt from events (union; nothing is ever lost). */
export function mergeCity(a, b) {
  const out = emptyCity();
  out.demo = !!(a?.demo || b?.demo);
  out.days = [...new Set([...(a?.days || []), ...(b?.days || [])])].sort();
  for (const key of new Set([...Object.keys(a?.people || {}), ...Object.keys(b?.people || {})])) {
    const x = a?.people?.[key];
    const y = b?.people?.[key];
    const base = structuredClone(x || y);
    if (x && y) {
      base.days = [...new Set([...x.days, ...y.days])].sort();
      for (const k of new Set([...Object.keys(x.signals), ...Object.keys(y.signals)])) base.signals[k] = [...new Set([...(x.signals[k] || []), ...(y.signals[k] || [])])].sort();
    }
    out.people[key] = base;
  }
  for (const kind of new Set([...Object.keys(a?.signals || {}), ...Object.keys(b?.signals || {})])) {
    const x = a?.signals?.[kind];
    const y = b?.signals?.[kind];
    if (!x || !y) {
      out.signals[kind] = structuredClone(x || y);
      continue;
    }
    const days = [...new Set([...x.days, ...y.days])].sort();
    out.signals[kind] = {
      count: days.length,
      days,
      projects: [...new Set([...x.projects, ...y.projects])].slice(0, MAX_PROJECTS),
      first: x.first < y.first ? x.first : y.first,
      last: x.last > y.last ? x.last : y.last,
    };
  }
  return out;
}

/** Stage of a business: 0 not started, 1 surveyed, 2 under construction, 3 open. */
export function businessStage(city, id) {
  const days = city?.signals?.[BUSINESSES[id].signal]?.count || 0;
  return days >= DAYS_TO_OPEN ? 3 : days ? 2 : 0; // 0 not started · 2 under construction · 3 open
}

/**
 * Downtown plots in the order work first showed up, so every player's main street is different.
 * Returns [{ id, stage, since }] for businesses that have started.
 */
export function downtown(city) {
  return Object.keys(BUSINESSES)
    .map((id) => ({ id, stage: businessStage(city, id), tier: businessTier(city, id), since: city?.signals?.[BUSINESSES[id].signal]?.first }))
    .filter((b) => b.stage > 0)
    .sort((a, b) => (a.since < b.since ? -1 : a.since > b.since ? 1 : a.id < b.id ? -1 : 1));
}

const fmtDay = (iso) => new Date(iso).toLocaleDateString(undefined, { month: 'short', day: 'numeric' });

/** "Opened because your agents ran tests on 3 different days (first Oct 2, latest Oct 5) across 2 projects." */
export function whyText(city, id) {
  const b = BUSINESSES[id];
  const s = city?.signals?.[b.signal];
  const sig = SIGNALS[b.signal];
  if (!s?.count) return `Opens when your agents ${sig.phrase} on ${DAYS_TO_OPEN} different days.`;
  const span = s.count > 1 ? ` (first ${fmtDay(s.first)}, latest ${fmtDay(s.last)})` : ` (${fmtDay(s.first)})`;
  const where = s.projects.length > 1 ? ` across ${s.projects.length} projects` : '';
  const days = `${s.count} different day${s.count === 1 ? '' : 's'}`;
  if (s.count >= DAYS_TO_OPEN) {
    const { tier, next } = businessProgress(city, id);
    const now = ['Opened', 'Opened', 'Expanded', 'Became a flagship', 'Became a landmark'][tier];
    const upcoming = next ? ` Next: ${next.name.toLowerCase()} at ${next.days} days.` : ' Fully grown.';
    return `${now} because your agents ${sig.phrase} on ${days}${span}${where}.${upcoming}`;
  }
  return `Your agents ${sig.phrase} on ${days}${span}${where}. It opens on day ${DAYS_TO_OPEN}; any later day counts, and nothing is lost by waiting.`;
}

/**
 * A person's role: their most common kind of work by days (ties go to the most recent, then catalog order).
 * Returns { signal, title, business, days } or null before any kind of work was observed.
 */
export function roleOf(person) {
  let best = null;
  for (const signal of Object.keys(ROLES)) {
    const days = person?.signals?.[signal];
    if (!days?.length) continue;
    const last = days[days.length - 1];
    if (!best || days.length > best.days || (days.length === best.days && last > best.last)) best = { signal, days: days.length, last };
  }
  return best && { signal: best.signal, days: best.days, ...ROLES[best.signal] };
}

/** Helpers by home and type: interns until they've worked HIRE_AFTER_DAYS different days, then hired staff with a name. */
export function staff(city) {
  const people = Object.entries(city?.people || {}).filter(([, p]) => p.kind === 'helper').sort(([a], [b]) => (a < b ? -1 : 1));
  const used = new Set();
  return people.map(([key, p]) => {
    const hired = p.days.length >= HIRE_AFTER_DAYS;
    let name = null;
    if (hired) {
      let h = 2166136261;
      for (const c of key) h = Math.imul(h ^ c.charCodeAt(0), 16777619);
      for (let i = 0; i < STAFF_NAMES.length && !name; i++) {
        const n = STAFF_NAMES[((h >>> 0) + i) % STAFF_NAMES.length];
        if (!used.has(n)) name = n;
      }
      name ??= `${STAFF_NAMES[(h >>> 0) % STAFF_NAMES.length]} ${used.size + 1}`;
      used.add(name);
    }
    return { key, project: p.project, type: p.type, days: p.days.length, hired, name, role: roleOf(p) };
  });
}

/** "Tester · tests on 4 days" style explanation for a role. */
export function roleWhy(person, who = 'their sessions') {
  const r = roleOf(person);
  if (!r) return `No role yet: a role comes from the kind of work ${who} do most, counted once per day.`;
  return `${r.title} because the kind of work ${who} did most was ${SIGNALS[r.signal].label.toLowerCase()} (${r.days} day${r.days === 1 ? '' : 's'}). Counted once per day, never by amount.`;
}
