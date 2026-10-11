// Game identity and planning metadata. None of these records establish observed activity.
export const FOUNDATION_VERSION = 1;
export const BUILDING_TYPES = Object.freeze(['residential', 'recreational', 'infrastructure', 'work']);
export const ZONES = Object.freeze(['residential', 'commercial', 'industrial', 'mixed']);
export const homeId = project => `home:${encodeURIComponent(project)}`;
export const legacyAgentId = (project, slot) => `agent:${encodeURIComponent(project)}:${slot}`;

export function initializeHousehold(home) {
  home.id ||= homeId(home.project);
  home.foundationVersion = FOUNDATION_VERSION;
  for (const character of home.characters) {
    character.id ||= legacyAgentId(home.project, character.slot);
    character.homeId = home.id;
    character.professionId ??= character.assignedRole === 'assistant' ? 'personal_assistant' : character.assignedRole || null;
    character.workplaceId ??= null;
    character.interestIds ??= [];
    character.personality ??= null;
    character.happiness ??= null;
  }
  const owner = home.characters.find(c => c.id === home.ownerAgentId)
    || home.characters.find(c => ['assistant', 'personal_assistant'].includes(c.assignedRole))
    || [...home.characters].sort((a, b) => a.slot - b.slot)[0];
  home.ownerAgentId = owner?.id || null;
  return home;
}

export function agentForRecord(households, record) {
  const homes = Array.isArray(households) ? households : Object.values(households);
  if (record.agentId) return homes.flatMap(h => h.characters).find(c => c.id === record.agentId) || null;
  return homes.find(h => h.project === record.project)?.characters.find(c => c.slot === record.slot) || null;
}

export const ownerForHome = home => home?.characters.find(c => c.id === home.ownerAgentId) || null;

// Saved observed identities are not automatically recruited household members.
export const residentCharacters = home => home?.characters.filter(c =>
  !Array.isArray(home.residentAgentIds) || home.residentAgentIds.includes(c.id)) || [];
export const residentHousehold = home => ({ ...home, characters: residentCharacters(home) });

export function foundationSnapshot(households, gameplay = {}) {
  const homes = Array.isArray(households) ? households : Object.values(households);
  return {
    version: FOUNDATION_VERSION,
    agents: homes.flatMap(h => residentCharacters(h).map(c => ({ ...c, project: h.project, isOwner: c.id === h.ownerAgentId }))),
    buildings: [
      ...homes.map(h => ({ id: h.id, type: 'residential', kind: 'home', project: h.project, ownerAgentId: h.ownerAgentId, zone: 'residential' })),
      ...(gameplay.townhall ? [{ id: 'townhall', type: 'infrastructure', kind: 'townhall', zone: null }] : []),
    ],
  };
}
