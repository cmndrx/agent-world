import {escapeHtml as esc} from './sim.js';
import {icon} from './icons.js';
import { homeBuildState, homeCompletionCost, TOWN_HALL } from '../../shared/gameplay.mjs';
import { projectAllowance, xpForLevel } from '../../shared/town.mjs';

// Projects view. Each active project has exactly one home, and your player level sets how many projects can be
// active (permits, shared/town.mjs). Add project: check capacity → choose an existing local Codex project or
// prepare a new one → choose a plot beside a connected street in Plan town → confirm. Nothing is created or
// activated before that confirmation, and the bridge checks capacity and the plot again before activating.
export class ProjectsPanel{
 constructor(host,{focus,onCount}){this.host=host;this.focus=focus;this.onCount=onCount;this.homes=[];this.available=[];this.importing=false;this.parent='';this.message='';this.busy=false;this.form=false;this.requestKey=null;this.draft={name:'',folder:'',createFolder:true};this.town=null;this.replace='';this.confirmRemove=null;this.keep=new Set();this.planner=null;
 host.addEventListener('click',e=>{const b=e.target.closest('button');if(!b||this.busy)return;
  if(b.hasAttribute('data-build-home')||b.hasAttribute('data-back-choice')){this.choosing=true;this.form=false;this.importing=false;this.render();}
  else if(b.hasAttribute('data-add-project')){this.choosing=false;this.form=true;this.importing=false;this.requestKey=crypto.randomUUID();this.render();host.querySelector('[name=name]')?.focus();}
  else if(b.hasAttribute('data-import-projects')){this.choosing=false;this.importing=true;this.form=false;this.load();}
  else if(b.dataset.removeProject){this.confirmRemove=b.dataset.removeProject;this.render();}
  else if(b.dataset.confirmRemove)this.removeProject(b.dataset.confirmRemove);
  else if(b.hasAttribute('data-cancel-remove')){this.confirmRemove=null;this.render();}
  else if(b.dataset.keepProject)this.keepProject(b.dataset.keepProject);
  else if(b.dataset.movePlot){this.planner?.moveHome(b.dataset.movePlot);}
  else if(b.dataset.importId)this.importProject(b.dataset.importId);
  else if(b.hasAttribute('data-cancel-project')){this.choosing=false;this.form=false;this.importing=false;this.render();}
  else if(b.hasAttribute('data-refresh-projects'))this.load();
  else if(b.hasAttribute('data-choose-active'))this.chooseActive();
  else if(b.dataset.projectFolder)this.focus(b.dataset.projectFolder);});
 host.addEventListener('change',e=>{if(e.target.name==='replace'){this.replace=e.target.value;this.render();}else if(e.target.name==='keep'){e.target.checked?this.keep.add(e.target.value):this.keep.delete(e.target.value);this.render();}});
 host.addEventListener('input',e=>{if(['name','folder','createFolder'].includes(e.target.name))this.requestKey=crypto.randomUUID();if(e.target.name==='name'){const old=this.parent+'/'+this.slug(this.draft.name);this.draft.name=e.target.value;if(!this.draft.folder||this.draft.folder===old){this.draft.folder=this.parent+'/'+this.slug(this.draft.name);const field=host.querySelector('[name=folder]');if(field)field.value=this.draft.folder;}}else if(e.target.name==='folder')this.draft.folder=e.target.value;else if(e.target.name==='createFolder')this.draft.createFolder=e.target.checked;});
 host.addEventListener('submit',e=>{e.preventDefault();if(!this.busy)this.create();});
 host.addEventListener('click', e => { const b = e.target.closest('[data-home-speed]'); if (b && !this.busy) this.finishHome(b.dataset.homeSpeed); });
 this.timer = setInterval(() => this.updateConstruction(), 1000);
 }
 setGameState(gameplay, balance){this.gameplay=gameplay;this.balance=balance;this.updateConstruction();}
 /** The town layout and permit status from the bridge (snapshot and `town` messages). */
 setTown(town){const wasOver=this.town?.permits?.overCapacity;this.town=town;if(this.replace&&!this.homes.some(h=>h.project===this.replace))this.replace='';
  // An over-capacity save: show the chooser (once per load) so the player decides who stays.
  if(town?.permits?.overCapacity&&!wasOver&&!this.shownChooser){this.shownChooser=true;setTimeout(()=>this.planner?.openProjects(),400);}
  if(!(this.form&&this.host.contains(document.activeElement)))this.render();}
 get permits(){return this.town?.permits||null;}
 updateConstruction(){
  for(const el of this.host.querySelectorAll('[data-home-build]')){
   const project=el.dataset.homeBuild,state=homeBuildState(this.gameplay,project),cost=homeCompletionCost(this.gameplay,project);
   el.hidden=state.status!=='building';
   el.querySelector('[data-home-time]').textContent=`${Math.ceil(state.remainingMs/60000)} min remaining`;
   el.querySelector('progress').value=TOWN_HALL.durationMs-state.remainingMs;
   const button=el.querySelector('[data-home-speed]');button.disabled=this.busy||this.balance<cost;
   button.querySelector('[data-home-cost]').textContent=`${cost} gems total`;
  }
 }
 constructionMarkup(home){
  if(homeBuildState(this.gameplay,home.project).status!=='building')return '';
  return `<div class="home-build-controls" data-home-build="${esc(home.project)}"><span data-home-time></span><progress max="${TOWN_HALL.durationMs}" aria-label="Home construction progress"></progress><button type="button" data-home-speed="${esc(home.project)}">${icon('zap')} Speed up build <span data-home-cost></span>${icon('gem')}</button></div>`;
 }
 async finishHome(project){this.busy=true;this.message='Finishing home construction…';this.render();try{
  const r=await fetch('/api/gameplay',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({action:'expedite-home',project})});const data=await r.json();if(!r.ok)throw Error(data.error||'Construction failed.');this.gameplay=data.gameplay;this.message='Your home is ready. Your Personal Assistant can move in.';
 }catch(e){this.message=e.message;}finally{this.busy=false;this.render();}}
 slug(name){return name.trim().toLowerCase().replace(/[^a-z0-9_-]+/g,'-').replace(/^-|-$/g,'')||'new-project';}
 setHomes(homes){this.homes=homes.filter(h=>/^(\/|[A-Za-z]:[\\/])/.test(h.project));if(!this.form)this.render();}
 setTownHallReady(ready){if(this.townHallReady===ready)return;this.townHallReady=ready;this.render();}
 async post(input){const r=await fetch('/api/codex-projects',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify(input)});const body=await r.json();if(!r.ok)throw Error(body.error||'Project request failed.');return body.result;}
 async load(){if(this.busy)return;this.busy=true;this.message=this.importing?'Loading local Codex projects…':'';this.render();try{const r=await this.post({action:'list'});this.parent=r.defaultParent;this.available=r.projects;if(r.town)this.town=r.town;if(this.importing)this.message=r.skipped?`${r.skipped} projects have unavailable local folders.`:'';this.setHomes(r.homes);}catch(e){this.message=e.message;}finally{this.busy=false;this.render();}}
 /** Can another project be added now (or one replaced)? */
 canAdd(){const p=this.permits;if(!this.townHallReady)return false;if(!p)return true;if(p.overCapacity)return false;return !p.atCapacity||!!this.replace;}
 /** Step 4–5: choose a plot in Plan town; `run(placement, revision)` creates or imports, registers and starts building. */
 choosePlot(label,run){
  if(!this.planner){this.message='Plan town is unavailable.';return this.render();}
  const replacing=this.replace||null;
  this.message=`Choose a plot for ${label} in Plan town. Nothing is created until you confirm.`;this.render();
  this.planner.choosePlot({label,replacing,
   onConfirm:async(placement,revision)=>{this.busy=true;try{const r=await run(placement,revision,replacing);this.afterAdd(r);}finally{this.busy=false;this.render();}},
   onCancel:()=>{this.message='Cancelled. Nothing was created and no permit was used.';this.render();}});
 }
 afterAdd(r){this.homes=this.homes.filter(h=>h.project!==r.home.project&&h.project!==this.replace).concat(r.home);this.message=r.existing?'That project already has a home in your town.':'Home construction started. Your Personal Assistant moves in when it is ready.';this.importing=false;this.form=false;this.choosing=false;this.replace='';this.draft={name:'',folder:'',createFolder:true};this.focus(r.home.project);setTimeout(()=>this.focus(r.home.project),500);}
 importProject(id){const p=this.available.find(x=>x.id===id);if(!p||!this.canAdd())return;this.choosePlot(p.name,(placement,revision,replace)=>this.post({action:'import',id,placement,revision,...(replace?{replace}:{})}));}
 create(){if(!this.canAdd())return;const d={...this.draft};if(!d.name.trim()||!d.folder.trim()){this.message='Enter a home name and a project folder.';return this.render();}const key=this.requestKey;this.choosePlot(d.name.trim(),(placement,revision,replace)=>this.post({action:'create',...d,idempotencyKey:key,placement,revision,...(replace?{replace}:{})}));}
 async removeProject(project){this.busy=true;this.confirmRemove=null;this.message='Removing project from your town…';this.render();try{const r=await this.post({action:'remove',project});if(r.pending){this.message=`It leaves town when its running work finishes: ${r.waitingFor.map(w=>w.title).join(', ')}. Queued prompts were cancelled and schedules paused; nothing new starts there.`;}else{this.homes=this.homes.filter(h=>h.project!==project);this.message='Project and home removed from your town. Its permit is free. Files, chats and history are preserved for re-adding.';}}catch(e){this.message=e.message;}finally{this.busy=false;this.render();}}
 async keepProject(project){this.busy=true;this.render();try{await this.post({action:'keep',project});this.message='Kept in your town. Resume any paused schedules from its resident’s Scheduled list.';}catch(e){this.message=e.message;}finally{this.busy=false;this.render();}}
 async chooseActive(){this.busy=true;this.render();try{const r=await fetch('/api/town',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({action:'choose-active',projects:[...this.keep]})});const body=await r.json();if(!r.ok)throw Error(body.error||'Couldn’t save your choice.');const waiting=body.result.leaving.filter(x=>x.pending).length;this.message=`Saved. ${body.result.kept.length} project${body.result.kept.length===1?' stays':'s stay'} active.${waiting?` ${waiting} leave${waiting===1?'s':''} once running work finishes.`:''} Everything else is preserved for re-adding.`;this.keep.clear();}catch(e){this.message=e.message;}finally{this.busy=false;this.render();}}
 /** The permit meter: one slot per permit (filled, leaving, free), the next locked slot and XP toward it. */
 permitMeter(p){
  const leaving=p.active-p.counted,used=Math.min(p.counted,p.allowed);
  let from=p.level;while(from>1&&projectAllowance(from-1)===p.allowed)from--;
  const lo=xpForLevel(from),hi=xpForLevel(p.nextLevel),pct=Math.max(2,Math.min(100,(p.xp-lo)/Math.max(1,hi-lo)*100));
  const shown=Math.min(p.allowed,10);
  const slot=(cls,ic,title)=>`<span class="permit-slot ${cls}" title="${esc(title)}">${icon(ic)}</span>`;
  const slots=[...Array(shown)].map((_,n)=>n<used?slot('used','house','Active project'):n<used+leaving?slot('leaving','hourglass','Leaving after running work'):slot('free','plus','Free permit')).join('')+(p.allowed>shown?`<span class="permit-more">+${p.allowed-shown}</span>`:'')+slot('locked','lock',`Unlocks at player level ${p.nextLevel}`);
  return `<div class="permit-card${p.atCapacity?' full':''}${p.overCapacity?' over':''}" role="status">
   <div class="permit-top"><span class="permit-label">${icon('house')} Project permits</span><span class="permit-count"><b>${p.overCapacity?p.active:p.counted}</b>/${p.allowed}</span></div>
   <div class="permit-slots">${slots}</div>
   <div class="permit-xp"><span class="permit-lv">Lv ${p.level}</span><div class="permit-bar-track" role="progressbar" aria-valuemin="0" aria-valuemax="100" aria-valuenow="${Math.round(pct)}" aria-label="XP toward the next permit"><i style="width:${pct.toFixed(1)}%"></i></div><span class="permit-lv next">${icon('lock')} Lv ${p.nextLevel}</span></div>
   <small class="permit-next">${p.xpToNext.toLocaleString('en-US')} XP to the next permit${leaving&&!p.overCapacity?` · ${leaving} leaving`:''}</small></div>`;
 }
 permitMarkup(){const p=this.permits;if(!p)return '';
  const head=this.permitMeter(p);
  if(p.overCapacity){const homes=this.homes.filter(h=>!this.town?.pendingRemoval?.[h.project]);const n=this.keep.size;return head+`<div class="permit-choose"><div class="permit-callout-head">${icon('triangleAlert')}<b>Choose who stays active</b><span class="permit-pick-count${n&&n<=p.allowed?' ok':''}">${n}/${p.allowed}</span></div><p>Your town has ${p.counted} active projects; player level ${p.level} allows ${p.allowed}. Nothing is deleted: the others leave with files, chats, residents and history saved, and anything running finishes first. Until you choose, no project starts new work.</p><div class="permit-picks">${homes.map(h=>`<label class="permit-pick${this.keep.has(h.project)?' on':''}"><input type="checkbox" name="keep" value="${esc(h.project)}" ${this.keep.has(h.project)?'checked':''} ${this.busy||(!this.keep.has(h.project)&&n>=p.allowed)?'disabled':''}><span class="project-tile">${icon('house')}</span><b>${esc(h.name||h.project.split('/').pop())}</b><i>${icon(this.keep.has(h.project)?'check':'plus')}</i></label>`).join('')}</div><button type="button" class="pa-new permit-go" data-choose-active ${n&&n<=p.allowed&&!this.busy?'':'disabled'}>${icon('check')} Keep ${n||''} active</button></div>`;}
  if(!p.atCapacity)return head;
  const options=this.homes.filter(h=>!this.town?.pendingRemoval?.[h.project]).map(h=>`<option value="${esc(h.project)}" ${this.replace===h.project?'selected':''}>${esc(h.name||h.project.split('/').pop())}</option>`).join('');
  return head+`<div class="permit-locked"><div class="permit-callout-head">${icon('lock')}<b>All permits in use</b></div><p>Reach player level ${p.nextLevel} for another permit, remove a project, or replace one.</p><label class="permit-replace"><span>${icon('rotateCcw')} Replace</span><select name="replace" ${this.busy?'disabled':''}><option value="">Choose a project…</option>${options}</select></label>${this.replace?`<small>The replaced project leaves town (files, chats and history kept) only when the new home is confirmed.</small>`:''}</div>`;
 }
 cardStatus(h){const town=this.town;const pending=town?.pendingRemoval?.[h.project];const home=town?.homes?.find(x=>x.project===h.project);
  if(pending){const waiting=town.waitingFor?.[h.project]||[];return `<div class="project-pending">${icon('hourglass')}<span><b>Leaving town</b> after ${waiting.length?waiting.map(w=>esc(w.title)).join(', '):'running work settles'}. No new work starts.</span>${(this.permits?.counted??0)<(this.permits?.allowed??0)?`<button type="button" data-keep-project="${esc(h.project)}" ${this.busy?'disabled':''}>Keep</button>`:''}</div>`;}
  if(home&&home.i==null)return `<div class="project-pending repair">${icon('triangleAlert')}<span><b>Needs a plot</b> ${esc(home.repair||'Choose where this home stands.')}</span><button type="button" data-move-plot="${esc(h.project)}">Choose plot</button></div>`;
  return '';}
 render(){const homes=[...this.homes].sort((a,b)=>(a.name||a.project).localeCompare(b.name||b.project));this.onCount(homes.length);
 const busy=this.busy?'disabled':'';const buildDisabled=this.busy||!this.canAdd()?'disabled':'';const added=p=>this.homes.some(h=>h.project===p.path);const replacing=this.replace?this.homes.find(h=>h.project===this.replace):null;
 const open=this.choosing||this.form||this.importing;
 const actions=open?'':`<div class="project-list-actions"><button type="button" class="pa-new pa-build" data-build-home ${buildDisabled}>${icon('house')} ${replacing?`Build a home to replace ${esc(replacing.name||'a project')}`:'Build a home'}</button><button type="button" class="icon-btn pa-refresh" data-refresh-projects aria-label="Refresh Codex projects" title="Refresh" ${busy}>${icon('rotateCcw')}</button></div>`;
 // Step 2 of Build a home: import a project that already exists on this computer, or start a new one.
 const choice=this.choosing?`<div class="project-choice"><div class="project-sub-head"><b>${replacing?`Build a home to replace ${esc(replacing.name||'a project')}`:'Build a home'}</b><button type="button" class="icon-btn" data-cancel-project aria-label="Close">${icon('x')}</button></div><p class="project-choice-lead">Every home is a real project. Which one moves in?</p><div class="project-choice-grid"><button type="button" class="project-choice-card import" data-import-projects ${buildDisabled}><span class="pc-icon">${icon('folderInput')}</span><b>Import existing project</b><small>Give a home to a Codex project already on this computer.</small><em>Choose project ${icon('chevronRight')}</em></button><button type="button" class="project-choice-card create" data-add-project ${buildDisabled}><span class="pc-icon">${icon('folderPlus')}</span><b>Create new project</b><small>Start a fresh project folder and Codex project.</small><em>Name it ${icon('chevronRight')}</em></button></div><small class="project-form-note">Next you pick a plot in town. Nothing is created until you confirm it.</small></div>`:'';
 const back=`<button type="button" class="icon-btn" data-back-choice aria-label="Back to Build a home" title="Back">${icon('arrowLeft')}</button>`;
 const importList=this.importing?`<div class="project-import-list"><div class="project-sub-head">${back}<b>${replacing?`Replace ${esc(replacing.name||'a project')} with an existing project`:'Import existing project'}</b><button type="button" class="icon-btn" data-cancel-project aria-label="Close import">${icon('x')}</button></div>${this.available.map(p=>`<button type="button" class="local-project-row import-row" data-import-id="${esc(p.id)}" title="${esc(p.name)}
${esc(p.path)}" ${this.busy||!this.canAdd()||added(p)?'disabled':''}><span class="project-tile">${icon('folderInput')}</span><span><b>${esc(p.name)}</b><small>${esc(p.path)}</small></span><em>${added(p)?'In town':'Choose plot'}</em></button>`).join('')||'<p class="project-empty-note">No other Codex projects found.</p>'}</div>`:'';
 const form=this.form?`<form class="local-project-form"><div class="project-sub-head">${back}<b>${replacing?`New project replacing ${esc(replacing.name||'a project')}`:'Create new project'}</b><button type="button" class="icon-btn" data-cancel-project aria-label="Cancel new home">${icon('x')}</button></div><label>Home name<input name="name" maxlength="100" required placeholder="My home" value="${esc(this.draft.name)}" ${busy}></label><label>Project folder<input name="folder" required placeholder="${esc(this.parent)}/my-project" value="${esc(this.draft.folder)}" ${busy}></label><label class="project-folder-choice"><input type="checkbox" name="createFolder" ${this.draft.createFolder?'checked':''} ${busy}> Create the folder if it's missing</label><small class="project-form-note">Next you choose a plot. The folder and project are created only when you confirm it.</small><div class="project-form-actions"><button type="submit" class="pa-new" ${buildDisabled}>${this.busy?'Working…':`${icon('map')} Choose plot`}</button><button type="button" class="pa-ghost" data-cancel-project ${busy}>Cancel</button></div></form>`:'';
 const card=h=>{const name=esc(h.name||h.project.split('/').pop());const confirming=this.confirmRemove===h.project;return `<div class="project-card"><button type="button" class="local-project-row" data-project-folder="${esc(h.project)}" title="${esc(h.project)}"><span class="project-tile">${icon('house')}</span><span><b>${name}</b><small>${h.codexProjectId?'Codex project':'Observed folder'} · ${h.characters.length} resident${h.characters.length===1?'':'s'}</small><small class="project-path">${esc(h.project)}</small></span></button>${this.constructionMarkup(h)}${this.cardStatus(h)}${confirming?`<div class="project-confirm-remove">${icon('trash')}<span><b>Remove ${name} from town?</b> Frees its permit. Files, Codex entry, chats, residents and history stay saved for re-adding. Running work finishes first; queued prompts are cancelled.</span><button type="button" class="danger" data-confirm-remove="${esc(h.project)}" ${busy}>Remove</button><button type="button" data-cancel-remove ${busy}>Cancel</button></div>`:''}<div class="project-card-tools"><button type="button" class="icon-btn" data-move-plot="${esc(h.project)}" aria-label="Move ${name}" title="Move or turn this home in Plan town" ${busy}>${icon('move')}</button><button type="button" class="project-remove" data-remove-project="${esc(h.project)}" aria-label="Remove ${name} from Agent World" title="Remove this home from your town. Files and chats are preserved." ${busy||this.town?.pendingRemoval?.[h.project]?'disabled':''}>${icon('trash')}</button></div></div>`;};
 this.host.innerHTML=`${this.permitMarkup()}${actions}${choice}${importList}${form}${this.message?`<p role="status" class="project-status">${icon('info')}<span>${esc(this.message)}</span></p>`:'<p role="status" class="project-status" hidden></p>'}<div class="local-project-list">${homes.map(card).join('')||`<div class="empty">${this.townHallReady?'Build your first home. Choose an existing project or create a new one, then pick its plot.':'Meet Mayor Martin and build the Town Hall first.'}</div>`}</div><small class="project-local-note">Local to this computer · one home per active project; your player level sets how many are active.</small>`;
 this.updateConstruction();
 }
}
