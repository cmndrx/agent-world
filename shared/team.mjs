import { residentCharacters } from './foundation.mjs';
// Assigned project responsibilities are planning metadata, never inferred activity.
export const STARTER_ROLES=[
 {id:'assistant',title:'Assistant',description:'Coordinate the request, answer general questions and combine teammates’ results.',color:0x8b7ee8},
 {id:'junior_developer',title:'Junior developer',description:'Implement and verify code, websites and application changes.',color:0x5fbf73},
 {id:'researcher',title:'Researcher',description:'Investigate questions, inspect sources and return evidence and recommendations.',color:0x4f86c6},
];
export const assignedRole=id=>id==='personal_assistant'?{...STARTER_ROLES[0],id,title:'Personal Assistant'}:STARTER_ROLES.find(r=>r.id===id)||null;
export function projectTeam(home){return home?.starterTeam||home?.ownerAgentId?residentCharacters(home).filter(c=>assignedRole(c.assignedRole)).map(c=>({agentId:c.id,slot:c.slot,name:c.name,role:c.assignedRole==='personal_assistant'?'assistant':c.assignedRole,title:assignedRole(c.assignedRole).title})):[];}
