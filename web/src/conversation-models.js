import {escapeHtml as esc} from './sim.js';
import {icon} from './icons.js';

// Model picker for the prompter: a pill ("GPT-6.1 Sol  Medium ⌄") that opens a popover with the
// provider toggle, the reasoning-effort slider and a model list. Choices apply to the next message only.

const EFFORT_LABELS={none:'None',minimal:'Minimal',low:'Low',medium:'Medium',high:'High',xhigh:'Extra high',max:'Max',ultra:'Ultra'};
const effortLabel=e=>EFFORT_LABELS[e]||e||'';
/** "GPT-6.1-Sol" → "GPT-6.1 Sol" (hyphens before words become spaces; version hyphens stay). */
const prettyName=n=>String(n||'').replace(/-(?=[A-Za-z])/g,' ');

export class ConversationModels{
 constructor(onChange){this.onChange=onChange;this.data={models:[],observed:[]};this.preferences=new Map();try{this.preferences=new Map(JSON.parse(localStorage.getItem('agent-world-model-preferences')||'[]'));}catch{}this.efforts=new Map();try{this.efforts=new Map(JSON.parse(localStorage.getItem('agent-world-effort-preferences')||'[]'));}catch{}this.key='';this.view='main';}
 prefKey(project,thread,provider='codex'){return JSON.stringify([provider,project,thread||'new']);}
 savePreferences(){try{localStorage.setItem('agent-world-model-preferences',JSON.stringify([...this.preferences]));localStorage.setItem('agent-world-effort-preferences',JSON.stringify([...this.efforts]));}catch{}}
 preference(project,thread,provider='codex'){const key=this.prefKey(project,thread,provider);if(this.preferences.has(key))return this.preferences.get(key)||null;return provider==='claude'&&this.data.provider==='claude'?this.data.observed?.find(m=>m.thread===thread)?.requestedModel||null:null;}
 effortPreference(project,thread,provider='codex'){const key=this.prefKey(project,thread,provider);if(this.efforts.has(key))return this.efforts.get(key)||null;return provider==='claude'&&this.data.provider==='claude'?this.data.observed?.find(m=>m.thread===thread)?.requestedEffort||null:null;}
 /** The prompter holds live re-renders while the slider is dragged; release them when it's let go. */
 endDrag(){if(!this.dragging)return;this.dragging=false;if(this.renderPending){this.renderPending=false;setTimeout(()=>this.onChange?.(),0);}}
 observed(thread){return this.data.observed?.find(m=>m.thread===thread)?.model||null;}
 async load(project,threads,revision,provider='codex'){const ids=[...new Set(threads.filter(Boolean))].sort();const key=JSON.stringify([provider,project,ids,revision]);if(key===this.key)return;this.key=key;this.controller?.abort();const controller=this.controller=new AbortController();this.data={models:[],observed:[]};try{const r=await fetch(`/api/models?provider=${provider}&project=${encodeURIComponent(project)}&threads=${encodeURIComponent(ids.join(','))}`,{signal:controller.signal});if(!r.ok)throw new Error();const data=await r.json();if(controller.signal.aborted)return;this.data=data;}catch{if(controller.signal.aborted)return;this.data={status:'unavailable',models:[],observed:[]};}this.onChange();}

 /**
  * @param {HTMLElement} host
  * @param {{provider:'codex'|'claude', providerLocked?:boolean, onProvider?:(p:string)=>void}} o
  */
 mount(host,project,thread,{provider='codex',providerLocked=false,onProvider}={}){
  const claude=provider==='claude';const models=this.data.provider===provider||!claude&&!this.data.provider?this.data.models||[]:[];
  const observed=this.observed(thread),preferred=this.preference(project,thread,provider),def=models.find(m=>m.isDefault);
  const model=models.find(m=>m.id===preferred)||models.find(m=>m.id===observed)||(thread&&observed?null:def)||null;
  const name=prettyName(claude?(preferred?model?.name||preferred:'Claude configured default'):model?.name||observed||(thread?'Conversation model':'Codex default'));
  const chosenEffort=this.effortPreference(project,thread,provider);
  const efforts=claude?[{id:null,description:'Uses your configured Claude effort.'},...(model?.efforts||this.data.provider==='claude'&&this.data.efforts||[])]:model?.efforts||[];
  // Show an effort only when it's known: chosen, or the default for a model this message will start fresh with.
  const effort=chosenEffort||(!thread||preferred?model?.defaultEffort:null)||null;
  const pill=`${esc(name)}${effort?` <em>${esc(effortLabel(effort))}</em>`:''}`;
  const index=Math.max(0,efforts.findIndex(e=>e.id===effort));
  const pct=efforts.length>1?index/(efforts.length-1):0;
  const providerToggle=`<div class="provider-toggle" role="radiogroup" aria-label="Provider">${[['codex','Codex'],['claude','Claude Code']].map(([id,label])=>`<button type="button" role="radio" data-provider="${id}" aria-checked="${provider===id}" ${providerLocked&&provider!==id?'disabled':''}>${label}</button>`).join('')}</div>${providerLocked?'<small class="mp-locked">Provider can’t change while a message is running.</small>':''}`;
  const main=`${providerToggle}<div class="mp-head"><span class="mp-side" aria-hidden="true">${icon(claude?'terminal':'brain')}</span><div class="mp-title"><b>${esc(effort?effortLabel(effort):'Default effort')}</b><button type="button" class="mp-model" data-view="models">${esc(name)} ${icon('chevronRight')}</button></div><button type="button" class="mp-side mp-reset" data-reset aria-label="${claude?'Reset effort':'Reset to defaults'}" title="${claude?'Reset effort':'Reset to defaults'}" ${!chosenEffort&&(claude||!preferred)?'disabled':''}>${icon('rotateCcw')}</button></div>`+
    (efforts.length> (claude?1:0)?`<div class="effort-slider" style="--p:${pct}"><div class="effort-track" aria-hidden="true"><i class="effort-fill"></i>${efforts.map((e,i)=>`<i class="effort-dot ${i<index?'on':''}" style="left:calc(15px + (100% - 30px) * ${efforts.length>1?i/(efforts.length-1):0})"></i>`).join('')}</div><input type="range" class="effort-range" min="0" max="${efforts.length-1}" step="1" value="${index}" aria-label="Reasoning effort" aria-valuetext="${esc(effortLabel(efforts[index]?.id)||'Default effort')}"></div><small class="mp-caption">${esc(efforts[index]?.description||'')}</small>`
     :`<small class="mp-caption">${this.data.status==='unavailable'?'Model list unavailable.':thread&&!preferred?'Keeps this conversation’s effort.':'No effort levels for this model.'}</small>`)+
    (claude?`<small>Requested effort · Claude applies model and account limits.</small>${observed?`<small>Last reported model: ${esc(observed)}</small>`:''}`:'');
  const list=`<div class="mp-list-head"><button type="button" class="mp-back" data-view="main" aria-label="Back">${icon('arrowLeft')}</button><b>Model</b></div><div class="model-options"><button type="button" data-model="" aria-pressed="${!preferred}"><span><b>${claude?'Use configured default':thread?'Keep conversation model':'Codex default'}</b><small>${esc(prettyName(claude?'Claude CLI settings':thread?observed||'As recorded':def?.name||'Unavailable'))}</small></span>${!preferred?icon('check'):''}</button>${models.map(m=>`<button type="button" data-model="${esc(m.id)}" aria-pressed="${preferred===m.id}"><span><b>${esc(prettyName(m.name))}</b></span>${preferred===m.id?icon('check'):''}</button>`).join('')}</div>${this.data.status==='unavailable'?'<small class="mp-caption">Model list unavailable.</small>':''}`;
  host.innerHTML=`<details class="composer-model" ${this.open?'open':''}><summary aria-label="Model and effort for next message">${pill}${icon('chevronDown')}</summary><div class="model-popover">${this.view==='models'?list:main}<small class="mp-foot">Applies to your next message.</small></div></details>`;
  const menu=host.querySelector('details');this.element=menu;
  menu.addEventListener('toggle',()=>{this.open=menu.open;if(!menu.open)this.view='main';});
  menu.addEventListener('keydown',e=>{if(e.key==='Escape'&&menu.open){e.preventDefault();e.stopPropagation();menu.open=false;this.open=false;menu.querySelector('summary').focus();}});
  const again=()=>{this.mount(host,project,thread,{provider,providerLocked,onProvider});};
  host.querySelectorAll('[data-view]').forEach(b=>b.addEventListener('click',()=>{this.view=b.dataset.view;again();host.querySelector(this.view==='models'?'.mp-back':'.mp-model')?.focus();}));
  host.querySelectorAll('[data-model]').forEach(b=>b.addEventListener('click',()=>{
   const key=this.prefKey(project,thread,provider);this.preferences.set(key,b.dataset.model||null);this.savePreferences();
   // Keep the chosen effort only if the new model supports it.
   const next=models.find(m=>m.id===b.dataset.model);if(next&&!next.efforts?.some(e=>e.id===this.efforts.get(key)))this.efforts.delete(key);this.savePreferences();
   this.view='main';again();host.querySelector('.mp-model')?.focus();
  }));
  host.querySelector('[data-reset]')?.addEventListener('click',()=>{const key=this.prefKey(project,thread,provider);if(!claude)this.preferences.delete(key);this.efforts.set(key,null);this.savePreferences();again();});
  host.querySelectorAll('[data-provider]').forEach(b=>b.addEventListener('click',()=>{if(b.dataset.provider!==provider){this.open=true;this.view='main';onProvider?.(b.dataset.provider);}}));
  const range=host.querySelector('.effort-range');
  if(range){
   const preview=()=>{const e=efforts[+range.value];const slider=range.parentElement;slider.style.setProperty('--p',efforts.length>1?range.value/(efforts.length-1):0);slider.querySelectorAll('.effort-dot').forEach((d,i)=>d.classList.toggle('on',i<+range.value));menu.querySelector('.mp-title b').textContent=effortLabel(e?.id)||'Default effort';menu.querySelector('.mp-caption').textContent=e?.description||'';range.setAttribute('aria-valuetext',effortLabel(e?.id)||'Default effort');};
   range.addEventListener('pointerdown',()=>{this.dragging=true;});
   range.addEventListener('input',preview);
   range.addEventListener('change',()=>{const e=efforts[+range.value];const key=this.prefKey(project,thread,provider);this.efforts.set(key,e.id);if(!claude&&!this.preferences.get(key)&&model)this.preferences.set(key,model.id);this.savePreferences();this.endDrag();again();host.querySelector('.effort-range')?.focus();});
  }
  if(!this.dragEnd){this.dragEnd=()=>this.endDrag();addEventListener('pointerup',this.dragEnd);addEventListener('pointercancel',this.dragEnd);}
  if(!this.dismiss){this.dismiss=e=>{if(this.element?.open&&!this.element.contains(e.target)){this.element.open=false;this.open=false;this.view='main';}};document.addEventListener('pointerdown',this.dismiss);}
 }
}
