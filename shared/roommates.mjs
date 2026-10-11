import {PROFESSIONS, PROFESSION_BY_ID, NAMES} from './catalogs/index.js';
import {residentCharacters, ownerForHome} from './foundation.mjs';
import {experience, residentKey, xpLevel} from './experience.mjs';
import {homeExperience, HOME_XP_THRESHOLDS, MAX_LEVEL} from './progression.mjs';
export const roommateRoles = value => {
  if (!Array.isArray(value) || value.length > 3 || value.some(r => !Object.hasOwn(PROFESSION_BY_ID,r?.roleId) || r.roleId === 'personal_assistant' || typeof r.reason !== 'string' || !r.reason.trim() || r.reason.length > 1000) || new Set(value.map(r=>r.roleId)).size !== value.length) throw Error('Return up to three distinct catalog roles with explanations.');
  return value.map(r=>({roleId:r.roleId,reason:r.reason.trim()}));
};
const seedFor = text => {let h=2166136261;for(const c of text)h=Math.imul(h^c.charCodeAt(0),16777619);return h>>>0;};
export function roommateView(home, runs=[], allCharacters=[]) {
  const totals=experience(runs),xp=homeExperience(home,totals.residents), residents=residentCharacters(home).map(c=>({...c,experience:totals.residents[residentKey(home.project,c.slot)]||xpLevel(0)}));
  const records=runs.filter(r=>r.project===home.project&&r.kind==='roommate_inspection').sort((a,b)=>String(a.startedAt||a.createdAt).localeCompare(String(b.startedAt||b.createdAt)));
  const latest=records.at(-1), report=[...records].reverse().find(r=>r.status==='completed'&&r.result?.roommateRoles);
  const capacity=xp.level;
  const used=new Set([...allCharacters,...home.characters].filter(c=>!c.id?.startsWith(`candidate:${report?.id}:`)).map(c=>c.name));
  const candidates=(report?.result.roommateRoles||[]).map((role,index)=>{
    const id=`candidate:${report.id}:${role.roleId}:0`,seed=seedFor(id);
    const name=Array.from({length:NAMES.length},(_,n)=>NAMES[(seed+n)%NAMES.length].label).find(n=>!used.has(n))||`${NAMES[seed%NAMES.length].label} ${seed}`;used.add(name);
    return {id,seed,name,rank:index+1,roleId:role.roleId,role:PROFESSION_BY_ID[role.roleId].label,reason:role.reason};
  });
  return {project:home.project,name:home.name,xp,testing:home.homeXpAdjustment||null,residents,owner:ownerForHome(home),capacity,
    slots:Array.from({length:MAX_LEVEL},(_,i)=>i+1).map((n)=>({number:n,resident:residents[n-1]||null,locked:n>capacity,requirement:`Home level ${n} · ${HOME_XP_THRESHOLDS[n-1]} pooled XP`})),
    candidates,report:report?.result||null,inspection:latest?{id:latest.id,status:latest.status,error:latest.error||''}:null};
}
export function recruitCandidate(home,view,id) {
  const candidate=view.candidates.find(c=>c.id===id);if(!candidate)throw Error('Candidate is no longer available. Refresh suggestions.');
  const current=residentCharacters(home);
  if(view.xp.level<2)throw Error(`Requires home level 2 · ${HOME_XP_THRESHOLDS[1]} pooled XP.`);
  if(current.length>=view.capacity)throw Error(view.capacity<MAX_LEVEL?`No open household slot. Slot ${view.capacity+1} unlocks at home level ${view.capacity+1} · ${HOME_XP_THRESHOLDS[view.capacity]} pooled XP.`:`All ${MAX_LEVEL} household slots are full.`);
  if(current.some(c=>c.professionId===candidate.roleId))throw Error('This role is already represented in the home.');
  const existing=home.characters.find(c=>c.id===candidate.id);
  if(existing){home.residentAgentIds=[...current.map(c=>c.id),existing.id];return existing;}
  const slot=Math.max(0,...home.characters.map(c=>c.slot))+1;
  const character={id:candidate.id,homeId:home.id,slot,seed:candidate.seed,name:candidate.name,assignedRole:candidate.roleId,professionId:candidate.roleId,workplaceId:null,interestIds:[],personality:null,happiness:null};
  home.characters.push(character);home.residentAgentIds=[...current.map(c=>c.id),character.id];
  return character;
}
export const inspectionInstruction = () => `Read-only project inspection only. Inspect the project's README, instructions and at most ten relevant files to understand its purpose. Do not edit files, run builds or tests, recruit residents, delegate work, create schedules or execute follow-up work. Recommend up to three useful teammate roles from these catalog IDs: ${PROFESSIONS.filter(r=>r.id!=='personal_assistant').map(r=>r.id).join(', ')}. Return each role only once in roommateRoles, ordered from most helpful to least helpful for this project. Use roleId and reason explaining the observed project need and why that role has this priority. Rank by the inspected project needs, not catalog order; do not invent competence scores. Report inspected evidence in checks and uncertainties in limitations; next must be null. No recommendation implies proven competence or completed project work.`;
