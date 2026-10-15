// Mentions describe intended recipients; they never authorize or enqueue work.
export const namedTarget = value => typeof value === 'string' && /^@[\p{L}\p{N}_-]+$/u.test(value);
export function handoffMember(team, target) {
  const matches = team.filter(m => namedTarget(target)
    ? m.name.toLocaleLowerCase() === target.slice(1).toLocaleLowerCase()
    : m.role === target);
  if (matches.length !== 1) throw Error('Hand off only to another assigned resident: choose one available @name; unknown or ambiguous recipients cannot receive work.');
  return matches[0];
}
export function mentionSuggestions(text, caret, team) {
  const match = text.slice(0, caret).match(/(?:^|\s)@([\p{L}\p{N}_-]*)$/u);
  if (!match) return null;
  const query = match[1].toLocaleLowerCase();
  return {start: caret - query.length - 1, end: caret,
    members: team.filter(m => namedTarget('@' + m.name) && m.name.toLocaleLowerCase().startsWith(query))};
}
