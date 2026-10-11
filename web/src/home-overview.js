import {escapeHtml as esc} from './sim.js';
import {levelName, HOME_XP_THRESHOLDS, MAX_LEVEL, BUILDING_UNLOCK_LEVELS} from '../../shared/progression.mjs';
import {assignedRole} from '../../shared/team.mjs';
import {icon} from './icons.js';
import {PROFESSION_BY_ID} from '../../shared/catalogs/index.js';
import {AvatarPortrait} from './avatar-portrait.js';
import {lookFromSeed} from './models.js';
import {xpMarkup} from './levels.js';

const CATEGORY_ICON={technology:'code',design:'penTool',data:'chartLine',science:'flaskConical',business:'briefcase',finance:'banknote',marketing:'megaphone',writing:'pencil',legal:'scale',health:'heartPulse',education:'graduationCap',entertainment:'music',organization:'clipboardList',relationships:'heartHandshake',civic:'landmark'};
const roleIcon=id=>icon(CATEGORY_ICON[PROFESSION_BY_ID[id]?.category]||'sparkles');
export class HomeOverview {
  constructor({onChat,look}) {
    this.onChat=onChat;this.look=look;this.avatars=new Map();this.dialog=document.createElement('dialog');this.dialog.className='home-overview glass';document.body.append(this.dialog);
    this.dialog.addEventListener('close',()=>{clearInterval(this.timer);for(const p of this.avatars.values())p.dispose();this.avatars.clear();});
    this.dialog.addEventListener('change',e=>{if(e.target.matches('[data-test-level]'))this.testLevel=e.target.value;});
    this.dialog.addEventListener('click',async e=>{
      const b=e.target.closest('button');if(!b)return;
      if(b.hasAttribute('data-close'))return this.dialog.close();
      if(b.hasAttribute('data-apply-level')) {
        if(this.busy)return;
        const value=this.dialog.querySelector('[data-test-level]').value;
        this.busy=true;this.error='';this.render();
        try {
          const response=await fetch('/api/home-level',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({project:this.project,level:value==='earned'?null:Number(value)})});
          const data=await response.json();if(!response.ok)throw Error(data.error||'Could not change home level.');
          this.testLevel=null;
        }catch(error){this.error=error.message;}
        finally{this.busy=false;await this.load();this.render();}
        return;
      }
      if(!b.hasAttribute('data-suggest')&&!b.hasAttribute('data-recruit'))return;
      if(this.busy||b.disabled)return;
      const provider=this.dialog.querySelector('[aria-label="Inspection provider"]')?.value;
      const recruiting=b.hasAttribute('data-recruit')?this.data?.candidates.find(c=>c.id===b.dataset.recruit):null;
      this.busy=true;this.error='';this.render();
      try {
        const response=await fetch('/api/roommates',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({project:this.project,action:b.hasAttribute('data-suggest')?'suggest':'recruit',provider,candidateId:b.dataset.recruit})});
        const data=await response.json();if(!response.ok)throw Error(data.error||'Request failed.');
        if(recruiting)this.celebrate(recruiting);
      } catch(error){this.error=error.message;}
      finally{this.busy=false;await this.load();this.render();}
    });
  }
  open(project){this.project=project;this.testLevel=null;this.data=null;this.error='';this.dialog.innerHTML='<p>Loading home…</p>';if(!this.dialog.open)this.dialog.showModal();clearInterval(this.timer);this.load();this.timer=setInterval(()=>{if(!this.busy)this.load();},2500);}
  async load(){const project=this.project;try {const response=await fetch('/api/roommates?'+new URLSearchParams({project}));const data=await response.json();if(project!==this.project)return;if(!response.ok)throw Error(data.error||'Home unavailable.');const changed=JSON.stringify(data)!==JSON.stringify(this.data);this.data=data;if(changed)this.render();}catch(e){this.error=e.message;this.render();}}
  /** Welcome card over the panel when a roommate is recruited: their bust pops in with a burst and confetti. */
  celebrate(c){
    this.welcome={...c,until:Date.now()+4200};clearTimeout(this.welcomeTimer);
    this.welcomeTimer=setTimeout(()=>{this.welcome=null;this.newResident=c.name;this.render();setTimeout(()=>{this.newResident=null;},2500);},4200);
  }
  /** A live 3D bust for a resident or candidate, reused across re-renders so it never flickers. */
  avatar(key,look){let p=this.avatars.get(key);if(!p){p=new AvatarPortrait({look:()=>p.lookNow,mode:'bust',persistent:true});this.avatars.set(key,p);}p.lookNow=look;return p.canvas;}
  mountAvatars(){for(const el of this.dialog.querySelectorAll('[data-av]')){const [key,seed,slot]=JSON.parse(el.dataset.av);el.append(this.avatar(key,(slot&&this.look?.(this.project,slot))||lookFromSeed(seed)));}}
  render(){
    const d=this.data;if(!d){this.dialog.innerHTML=`<div class="ho-loading">${this.error?`<p role="alert">${esc(this.error)}</p><button class="ho-btn" data-close>Close</button>`:'<span class="ho-spinner"></span><p>Loading home…</p>'}</div>`;return;}
    const {xp}=d,inspecting=['approved','queued','running'].includes(d.inspection?.status);
    const open=d.capacity-d.residents.length,locked=xp.level<2||!d.built;
    const provider=this.dialog.querySelector('[aria-label="Inspection provider"]')?.value||(['codex','claude'].find(p=>d.runner.providers[p].installed)||'codex');
    const av=(key,seed,slot)=>`<span class="ho-avatar" data-av='${esc(JSON.stringify([key,seed,slot||null]))}'></span>`;
    const slot=s=>s.resident
      ?`<article class="ho-slot filled">${av('r:'+s.resident.id,s.resident.seed,s.resident.slot)}<div class="ho-slot-body"><b>${esc(s.resident.name)}</b><small>${roleIcon(s.resident.professionId)} ${esc(assignedRole(s.resident.assignedRole)?.title||'Resident')}</small><div class="ho-mini-xp"><span class="lvl-pill">Lv ${s.resident.experience.level}</span><span class="xp-track"><span style="width:${Math.max(4,s.resident.experience.percent)}%"></span></span></div></div></article>`
      :`<article class="ho-slot ${s.locked?'locked':'open'}"><span class="ho-slot-icon">${icon(s.locked?'lockKeyhole':'userRoundPlus')}</span><div class="ho-slot-body"><b>${s.locked?'Locked':'Open room'}</b><small>${s.locked?esc(s.requirement):'Recruit a suggested roommate'}</small></div></article>`;
    const cand=c=>{const represented=d.residents.some(r=>r.professionId===c.roleId);const can=!(this.busy||open<=0||represented||locked);
      return `<article class="ho-cand${c.rank===1?' top':''}">${av('c:'+c.id,c.seed)}<div class="ho-cand-body"><div class="ho-cand-head"><b>${esc(c.name)}</b>${c.rank===1?'<span class="ho-pick">Top pick</span>':`<span class="ho-rank">#${c.rank}</span>`}</div><span class="ho-role">${roleIcon(c.roleId)} ${esc(c.role)}</span><p>${esc(PROFESSION_BY_ID[c.roleId]?.description||'Helps with tasks in this role.')}</p></div><button class="ho-btn ${can?'primary':''}" data-recruit="${esc(c.id)}" ${can?'':'disabled'}>${represented?`${icon('check')} In home`:open<=0?'No open room':`${icon('userRoundPlus')} Recruit`}</button></article>`;};
    const notes=[
      locked?`<p class="ho-note lock">${icon('lockKeyhole')}<span>${!d.built?'Finish home construction first.':`Unlocks at home level 2 · ${Math.max(0,HOME_XP_THRESHOLDS[1]-xp.xp)} XP to go`}</span></p>`:'',
      d.inspection&&d.inspection.status!=='completed'?`<p class="ho-note ${d.inspection.status==='failed'?'bad':''}" role="status">${icon(inspecting?'hourglass':d.inspection.status==='failed'?'circleAlert':'info')}<span>${inspecting?'Inspecting your project…':`Inspection ${esc(d.inspection.status)}`}${d.inspection.error?` · ${esc(d.inspection.error)}`:''}</span></p>`:'',
      this.error?`<p class="ho-note bad" role="alert">${icon('circleAlert')}<span>${esc(this.error)}</span></p>`:'',
      open<=0&&xp.level>=2?`<p class="ho-note">${icon('info')}<span>${d.capacity<MAX_LEVEL?`Every available room is full. Slot ${d.capacity+1} unlocks at home level ${d.capacity+1} · ${HOME_XP_THRESHOLDS[d.capacity]} pooled XP.`:`All ${MAX_LEVEL} rooms are full.`} You can still ask for suggestions.</span></p>`:''].join('');
    this.dialog.innerHTML=`<header class="panel-head ho-head"><span class="panel-icon ho-house">${icon('house')}</span><div><h2>${esc(d.name)}</h2><small>${esc(levelName(xp.level))} · ${d.residents.length} of ${d.capacity} rooms filled</small></div><button class="icon-btn" data-close aria-label="Close">${icon('x')}</button></header>
      <section class="ho-xp">${xpMarkup(xp,{label:'Home'})}<small class="ho-xp-note">${xp.level===MAX_LEVEL?'Maximum home level reached.':`Next building: ${esc(levelName(BUILDING_UNLOCK_LEVELS.find(level=>level>xp.level)))} at home level ${BUILDING_UNLOCK_LEVELS.find(level=>level>xp.level)}. One room unlocks every level.`}</small></section>
      <section class="ho-testing"><h3>Home level · Testing</h3><p>Change the building and unlocked rooms. Agent and player XP stay unchanged. Existing residents stay when you lower the level.</p>
        <div class="ho-actions"><select class="ho-select" data-test-level aria-label="Test home level" ${this.busy||!d.built?'disabled':''}>${['earned',...Array.from({length:MAX_LEVEL},(_,i)=>String(i+1))].map(value=>`<option value="${value}" ${value===(this.testLevel??(d.testing?String(xp.level):'earned'))?'selected':''}>${value==='earned'?'Use earned XP':`Level ${value} · ${esc(levelName(Number(value)))}`}</option>`).join('')}</select><button class="ho-btn" data-apply-level ${this.busy||!d.built?'disabled':''}>${this.busy?'Saving…':'Apply'}</button></div>
        <small>${d.testing?`Testing adjustment: ${d.testing.xp>=0?'+':''}${d.testing.xp} home XP. Future earned XP still counts.`:'Using earned resident XP.'}</small>
      </section>
      <h3 class="ho-sec">${icon('users')} Residents</h3><div class="ho-slots">${d.slots.map(slot).join('')}</div>
      <section class="ho-suggest"><div class="ho-suggest-head"><span class="ho-suggest-icon">${icon('sparkles')}</span><div><h3>Suggested roommates</h3><p>Your Personal Assistant looks over this project once and recommends helpful roles. Nobody moves in until you recruit them.</p></div></div>
        <div class="ho-actions"><select class="ho-select" aria-label="Inspection provider">${['codex','claude'].map(p=>`<option value="${p}" ${p===provider?'selected':''} ${!d.runner.providers[p].installed?'disabled':''}>${p==='codex'?'Codex':'Claude Code'}</option>`).join('')}</select><button class="ho-btn primary" data-suggest ${locked||inspecting||this.busy?'disabled':''}>${icon(inspecting?'hourglass':'sparkles')} ${inspecting?'Inspecting…':d.candidates.length?'Suggest again':'Suggest roommates'}</button></div>
        ${notes}
        ${d.candidates.length?`<div class="ho-cands">${d.candidates.map(cand).join('')}</div>`:`<div class="ho-empty">${icon('userRoundPlus')}<span>No suggestions yet.</span></div>`}
      </section>`;
    if(this.welcome){
      const w=this.welcome,colors=['#f2c14e','#ef6f8f','#5b6cf9','#3fb7b0','#8b5cf6','#f08a3c'];
      const bits=Array.from({length:28},(_,i)=>`<i style="--x:${Math.round(Math.cos(i*2.4)*(140+i%5*30))}px;--y:${Math.round(Math.sin(i*2.4)*(100+i%4*28)-60)}px;--r:${i*47%360}deg;--d:${(i%7)*40}ms;background:${colors[i%colors.length]}"></i>`).join('');
      if(this.welcomeEl?.dataset.id===w.id){this.dialog.append(this.welcomeEl);this.mountAvatars();return;} // keep it (and its animation) across refreshes
      const el=document.createElement('div');el.className='ho-welcome';el.setAttribute('role','status');el.dataset.id=w.id;this.welcomeEl=el;
      el.innerHTML=`<div class="ho-welcome-card"><div class="ho-burst">${bits}</div><span class="ho-welcome-rays"></span><span class="ho-avatar big" data-av='${esc(JSON.stringify(['c:'+w.id,w.seed,null]))}'></span><small>${icon('house')} New roommate</small><h3>Welcome home, ${esc(w.name)}!</h3><span class="ho-role">${roleIcon(w.roleId)} ${esc(w.role)}</span><p>${esc(w.name)} is moving in now.</p><button class="ho-btn primary" data-dismiss-welcome>${icon('check')} Nice!</button></div>`;
      el.addEventListener('click',e=>{if(e.target.closest('[data-dismiss-welcome]')||e.target===el){clearTimeout(this.welcomeTimer);this.welcome=null;this.newResident=w.name;this.render();setTimeout(()=>{this.newResident=null;},2500);}});
      this.dialog.append(el);
    }
    if(this.newResident)for(const card of this.dialog.querySelectorAll('.ho-slot.filled'))if(card.querySelector('b')?.textContent===this.newResident)card.classList.add('just-joined');
    this.mountAvatars();
  }
}
