// Fixed platform execution policy. Recorded settings are configuration, not observed activity.
export const defaultExecution=provider=>({mode:'prompt',review:{scope:'changes',ref:''},permission:provider==='claude'?'configured':'workspace-write',web:'live',shell:true,network:true,external:'inherit',servers:[],plugins:[],connections:[]});
export function executionOptions(value,provider='codex'){
 if(value==null)return defaultExecution(provider);
 if(!value||typeof value!=='object'||Array.isArray(value))throw new Error('Choose valid execution settings.');
 const d={...defaultExecution(provider),...value};
 if(!['prompt','review'].includes(d.mode)||!['inherit','disabled','cached','live'].includes(d.web)||!['inherit','off','selected'].includes(d.external)||typeof d.shell!=='boolean'||typeof d.network!=='boolean')throw new Error('Choose valid execution settings.');
 if(!(provider==='claude'?['configured','accept-edits','read-only']:['workspace-write','read-only']).includes(d.permission))throw new Error('Unsupported permission profile.');
 if(provider==='claude'&&d.web==='cached')throw new Error('Claude Code does not offer cached search.');
 const names=values=>{if(!Array.isArray(values)||values.length>64||values.some(n=>typeof n!=='string'||!n||n.length>200||/[\x00-\x1f]/.test(n)))throw new Error('Choose valid tools or plugins.');return [...new Set(values)];};
 d.servers=names(d.servers);d.plugins=names(d.plugins);
 if(!Array.isArray(d.connections)||d.connections.length>4)throw new Error('Connect up to four MCP services.');
 d.connections=d.connections.map(c=>{if(!c||typeof c.name!=='string'||!/^aw_[a-zA-Z0-9_-]{1,60}$/.test(c.name))throw new Error('Connection name must start with aw_ and use letters, numbers or underscores.');let url;try{url=new URL(c.url);}catch{throw new Error('Enter an HTTPS MCP endpoint.');}if(url.protocol!=='https:'||url.username||url.password||url.search||url.hash)throw new Error('Use an HTTPS MCP endpoint without credentials, query or fragment.');if(provider==='claude'&&c.tools?.length)throw new Error('Per-service tool allow lists are supported for Codex only.');return {name:c.name,url:url.href,tools:names(c.tools||[])};});
 if(d.external==='off'&&d.connections.length&&d.mode!=='review')throw new Error('Choose selected integrations before adding a connection.');
 if(new Set(d.connections.map(c=>c.name)).size!==d.connections.length)throw new Error('Use unique connection names.');
 const review=d.review||{};if(!['changes','base','commit'].includes(review.scope)||typeof review.ref!=='string'||review.ref.length>200||review.ref&&(!/^[a-zA-Z0-9][a-zA-Z0-9_./-]*$/.test(review.ref)||review.ref.includes('..')))throw new Error('Choose a valid review scope and Git reference.');
 if(d.mode==='review'&&review.scope!=='changes'&&!review.ref)throw new Error('Enter the branch or commit to review.');d.review={scope:review.scope,ref:review.ref};
 if(d.mode==='review'){d.permission='read-only';d.external='off';d.connections=[];d.servers=[];d.plugins=[];d.network=false;if(provider==='claude')d.shell=false;}
 if(d.permission==='read-only'){d.network=false;d.external='off';d.connections=[];d.servers=[];d.plugins=[];if(provider==='claude')d.shell=false;}
 return {mode:d.mode,review:d.review,permission:d.permission,web:d.web,shell:d.shell,network:d.network,external:d.external,servers:d.servers,plugins:d.plugins,connections:d.connections};
}
export function executionLabel(e,provider='codex'){if(!e)return '';return `${e.mode==='review'?'Code review · '+e.review.scope:'Prompt'} · ${e.permission==='read-only'?(provider==='claude'?'Read tools only':'Read-only sandbox'):provider==='claude'?(e.permission==='accept-edits'?'Approve file edits':'Configured permissions'):'Workspace writes'} · search ${e.web} · tools ${e.external}`;}

export function fixedExecution(value,provider='codex'){const policy=defaultExecution(provider);if(value!=null&&JSON.stringify(executionOptions(value,provider))!==JSON.stringify(policy))throw new Error('Execution settings are fixed by Agent World and cannot be changed per message.');return policy;}
