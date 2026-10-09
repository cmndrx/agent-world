import {escapeHtml as esc} from './sim.js';
import {icon} from './icons.js';

export class ComputerUseDialog {
  constructor(){
    this.epoch=0;this.dialog=document.createElement('dialog');this.dialog.className='computer-use-dialog glass';document.body.append(this.dialog);
    this.dialog.addEventListener('submit',e=>{e.preventDefault();this.app=this.dialog.querySelector('[name=app]').value.trim();this.act('start');});
    this.dialog.addEventListener('click',e=>{const b=e.target.closest('button');if(!b)return;if(b.dataset.choice)this.act(b.dataset.choice);if(b.hasAttribute('data-close-connection'))this.dialog.close();});
    this.dialog.addEventListener('close',()=>{this.epoch++;clearTimeout(this.poll);if(['connecting','approval'].includes(this.state?.status))this.request('cancel').catch(()=>{});});
  }
  open(project,slot){this.epoch++;this.project=project;this.slot=slot;this.app='Agent World';this.state=null;this.pending=false;this.error='';this.render();this.dialog.showModal();}
  context(){return {project:this.project,slot:this.slot,app:this.app,id:this.state?.id,approvalId:this.state?.approval?.id};}
  async request(action,context=this.context()){const r=await fetch('/api/computer-use',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({...context,action})});const j=await r.json();if(!r.ok)throw Error(j.error);return j.result;}
  async act(action){clearTimeout(this.poll);this.error='';this.pending=true;const epoch=this.epoch,context=this.context();this.render();try{const state=await this.request(action,context);if(epoch!==this.epoch||!this.dialog.open){if(['connecting','approval'].includes(state.status))await this.request('cancel',{...context,id:state.id});return;}this.state=state;}catch(e){if(epoch===this.epoch)this.error=e.message;}finally{if(epoch===this.epoch){this.pending=false;this.render();this.schedule();}}}
  schedule(){clearTimeout(this.poll);if(this.dialog.open&&['connecting','approval'].includes(this.state?.status)){const epoch=this.epoch,context=this.context();this.poll=setTimeout(async()=>{try{const state=await this.request('read',context);if(epoch!==this.epoch||!this.dialog.open)return;this.state=state;this.render();this.schedule();}catch(e){if(epoch===this.epoch){this.error=e.message;this.render();}}},1000);}}
  render(){
    const s=this.state,a=s?.approval,working=['connecting','approval'].includes(s?.status);
    const tone=this.error||s?.status==='unavailable'||s?.status==='cancelled'?'bad':s?.status==='verified'?'good':working?'busy':'';
    const statusText=this.error||s?.message||(working?(a?'Waiting for your decision.':'Connecting to Codex…'):'Choose the app you want Codex to use.');
    const appName=this.app||'App';
    const initial=esc((appName.match(/[A-Za-z0-9]/)?.[0]||'A').toUpperCase());
    const link=tone==='good'?icon('check'):tone==='bad'?icon('x'):icon('plug');
    this.dialog.innerHTML=`<header class="panel-head"><span class="panel-icon">${icon('plug')}</span><div><h2>Connect an app</h2><small>Let Codex use an app through its interface</small></div><button type="button" class="icon-btn" data-close-connection aria-label="Close app connection">${icon('x')}</button></header>`+
      `<div class="cu-hero ${tone}" aria-hidden="true"><div class="cu-tile codex">${icon('terminal')}<span>Codex</span></div><div class="cu-link"><i></i><b>${link}</b><i></i></div><div class="cu-tile app"><em>${initial}</em><span>${esc(appName.slice(0,18))}</span></div></div>`+
      (!s||!working?`<form class="cu-form"><label class="cu-field">Application name or bundle ID<span class="cu-input"><em aria-hidden="true">${initial}</em><input name="app" maxlength="200" required value="${esc(this.app)}" placeholder="App name or bundle ID" autocomplete="off"></span></label><div class="cu-suggest" role="group" aria-label="Suggestions">${['Agent World','Finder','Safari','Notes','Xcode'].map(n=>`<button type="button" data-suggest="${esc(n)}" aria-pressed="${n===this.app}">${esc(n)}</button>`).join('')}</div><button type="submit" class="primary cu-submit" ${this.pending?'disabled':''}>${icon(s?'rotateCw':'plug')} ${s?'Test again':'Request app access'}</button></form>`:'')+
      (a?`<section class="app-approval" role="alert"><h3>${esc(a.message)}</h3><dl><dt>App</dt><dd>${esc(a.app)}</dd>${a.subtitle?`<dt>Details</dt><dd>${esc(a.subtitle)}</dd>`:''}${a.risk?`<dt>Risk</dt><dd><span class="cu-risk ${esc(String(a.risk).toLowerCase())}">${esc(a.risk)}</span></dd>`:''}</dl><div class="cu-choices">${a.persist.includes('always')?'<button type="button" class="primary" data-choice="always">Always allow</button>':''}${a.persist.includes('session')?'<button type="button" data-choice="session">Allow once</button>':''}<button type="button" class="cu-deny" data-choice="deny">Deny</button></div><p class="cu-note">Always allow saves permission for future Codex runs; Allow once covers only this test. Revoke any time in ChatGPT → Settings → Computer use.</p></section>`:'')+
      `<p role="status" class="cu-status ${tone}">${icon(tone==='good'?'circleCheck':tone==='bad'?'circleAlert':tone==='busy'?'hourglass':'info')}<span>${esc(statusText)}</span></p>`+
      (s?.status==='verified'?`<p class="cu-note">${s.choice==='always'?'You chose Always allow. Access was verified in this setup connection; a normal prompt is the next check.':'Access was verified for this test. Future game prompts may still require saved approval.'}</p>`:'')+
      `<footer class="cu-foot">${working?'<button type="button" data-choice="cancel">Cancel connection</button>':'<small>Reads the app only · no model turn is started</small>'}</footer>`;
    this.dialog.querySelectorAll('[data-suggest]').forEach(b=>b.addEventListener('click',()=>{this.app=b.dataset.suggest;this.render();this.dialog.querySelector('[name=app]')?.focus();}));
    this.dialog.querySelector('[name=app]')?.addEventListener('input',e=>{this.app=e.target.value;const t=(e.target.value.match(/[A-Za-z0-9]/)?.[0]||'A').toUpperCase();this.dialog.querySelectorAll('.cu-field em, .cu-tile.app em').forEach(el=>el.textContent=t);const n=this.dialog.querySelector('.cu-tile.app span');if(n)n.textContent=(e.target.value||'App').slice(0,18);this.dialog.querySelectorAll('[data-suggest]').forEach(b=>b.setAttribute('aria-pressed',b.dataset.suggest===e.target.value));});
    this.dialog.querySelectorAll('[data-choice]').forEach(b=>b.disabled=this.pending);
  }
}
