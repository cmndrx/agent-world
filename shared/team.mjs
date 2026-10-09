// Assigned project responsibilities are planning metadata, never inferred activity.
export const STARTER_ROLES=[
 {id:'assistant',title:'Assistant',description:'Coordinate the request, answer general questions and combine teammates’ results.',color:0x8b7ee8},
 {id:'junior_developer',title:'Junior developer',description:'Implement and verify code, websites and application changes.',color:0x5fbf73},
 {id:'researcher',title:'Researcher',description:'Investigate questions, inspect sources and return evidence and recommendations.',color:0x4f86c6},
];
export const assignedRole=id=>STARTER_ROLES.find(r=>r.id===id)||null;
export function projectTeam(home){return home?.starterTeam?home.characters.filter(c=>assignedRole(c.assignedRole)).map(c=>({slot:c.slot,name:c.name,role:c.assignedRole,title:assignedRole(c.assignedRole).title})):[];}
