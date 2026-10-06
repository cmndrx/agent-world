import {escapeHtml as esc} from './sim.js';
export class ConversationModels{
 constructor(onChange){this.onChange=onChange;this.data={models:[],observed:[]};this.preferences=new Map();this.key='';}
 preference(project,thread){return this.preferences.get(JSON.stringify([project,thread||'new']))||null;}
 observed(thread){return this.data.observed?.find(m=>m.thread===thread)?.model||null;}
 async load(project,threads,revision){const ids=[...new Set(threads.filter(Boolean))].sort();const key=JSON.stringify([project,ids,revision]);if(key===this.key)return;this.key=key;this.controller?.abort();const controller=this.controller=new AbortController();this.data={models:[],observed:[]};try{const r=await fetch(`/api/models?project=${encodeURIComponent(project)}&threads=${encodeURIComponent(ids.join(','))}`,{signal:controller.signal});if(!r.ok)throw new Error();const data=await r.json();if(controller.signal.aborted)return;this.data=data;}catch{if(controller.signal.aborted)return;this.data={status:'unavailable',models:[],observed:[]};}this.onChange();}
 mount(host,project,thread){
  const observed=this.observed(thread),preferred=this.preference(project,thread),def=this.data.models?.find(m=>m.isDefault);
  const chosen=this.data.models?.find(m=>m.id===preferred);
  const name=chosen?.name||this.data.models?.find(m=>m.id===observed)?.name||observed||(thread?'Conversation model':def?.name||'Codex default');
  host.innerHTML=`<details class="composer-model" ${this.open?'open':''}><summary aria-label="Model for next message">${esc(name)} <span aria-hidden="true">⌄</span></summary><div class="model-popover"><div class="model-heading">Next message model</div><small>${thread?`Last observed: ${esc(observed||'Unavailable')}`:`Default: ${esc(def?.name||'Unavailable')}`}</small><div class="model-options"><button type="button" data-model="" aria-pressed="${!preferred}">${thread?'Keep conversation model':'Use Codex default'}<span>${!preferred?'✓':''}</span></button>${(this.data.models||[]).map(m=>`<button type="button" data-model="${esc(m.id)}" aria-pressed="${preferred===m.id}">${esc(m.name)}<span>${preferred===m.id?'✓':''}</span></button>`).join('')}</div><small>${this.data.status==='unavailable'?'Model list unavailable.':'Applies to your next message. A running turn keeps its model.'}</small></div></details>`;
  const menu=host.querySelector('details');this.element=menu;
  menu.addEventListener('toggle',()=>{this.open=menu.open;});
  menu.addEventListener('keydown',e=>{if(e.key==='Escape'&&menu.open){e.preventDefault();e.stopPropagation();menu.open=false;this.open=false;menu.querySelector('summary').focus();}});
  host.querySelectorAll('[data-model]').forEach(button=>button.addEventListener('click',()=>{
   this.preferences.set(JSON.stringify([project,thread||'new']),button.dataset.model||null);this.open=false;this.mount(host,project,thread);host.querySelector('summary').focus();
  }));
  if(!this.dismiss){this.dismiss=e=>{if(this.element?.open&&!this.element.contains(e.target)){this.element.open=false;this.open=false;}};document.addEventListener('pointerdown',this.dismiss);}
 }
}
