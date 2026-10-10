import {ScheduledView} from './schedules.js';
import {AvatarPortrait} from './avatar-portrait.js';
import {experience, residentKey} from '../../shared/experience.mjs';
import {xpMarkup} from './levels.js';
import {VoiceChat} from './voice.js';
import {ComputerUseDialog} from './computer-use.js';
import {executionLabel} from '../../shared/execution.mjs';
import {ConversationModels} from './conversation-models.js';
import { ConnectedUsage } from './usage.js';
import { icon } from './icons.js';
import {residentThread,threadBusy,validThread,ownsThread,promptResident,residentBusy} from '../../shared/pass-conversations.mjs';
import {chatThreads,chatMessages,runThread,chatConversation,chatArchived} from '../../shared/chat.mjs';
import { escapeHtml as esc } from './sim.js';
import { conversationTarget } from '../../shared/conversations.mjs';

export class PassCard {
  constructor({onClose,residentName,onActivity,resident}){
    Object.assign(this,{onClose,residentName,onActivity,resident});
    // Waist-up 3D avatar of the agent you're prompting, beside the prompter (a popover so it sits above the modal).
    this.avatar=document.createElement('div');this.avatar.className='prompter-avatar';this.avatar.setAttribute('popover','manual');this.avatar.setAttribute('aria-hidden','true');
    this.avatarPortrait=new AvatarPortrait({mode:'waist',persistent:true,look:()=>this.resident?.(this.project,this.slot)?.look,role:()=>this.resident?.(this.project,this.slot)?.roleInfo,thinking:()=>{const on=this.promptRunning();this.avatar.classList.toggle('thinking',on);return on;}});
    this.avatar.innerHTML='<div class="pa-glow"></div><div class="pa-think" aria-hidden="true"><i></i><i></i><i></i></div><span class="pa-name"></span>';this.avatar.prepend(this.avatarPortrait.canvas);document.body.append(this.avatar);
    this.usage=new ConnectedUsage({compact:true});this.models=new ConversationModels(()=>{if(this.dialog.open){this.saveDraft();this.render();}});
    this.voice=new VoiceChat(()=>{if(this.voice.state.thread&&this.voice.active()&&this.voice.context?.project===this.project&&this.voice.context?.slot===this.slot){this.newConversation=false;this.selectedThread=this.voice.state.thread;fetch('/api/state').then(r=>r.json()).then(s=>this.setData(s)).catch(()=>{});}if(this.dialog.open){this.saveDraft();this.render();}});this.computerUse=new ComputerUseDialog();this.providerChoice='codex';this.data={proposals:[],runs:[]};this.runner={enabled:false};this.connected=false;this.sessions=[];this.conversations=[];this.drafts=new Map();
    this.attachmentDrafts=new Map();this.searchQuery='';this.showArchived=false;
    this.scheduled=new ScheduledView(this);
    this.dialog=document.createElement('dialog');this.dialog.className='pass-card glass';document.body.append(this.dialog);
    this.dialog.addEventListener('close',()=>{if(this.avatar.matches(':popover-open'))this.avatar.hidePopover();if(this.voice.active())this.voice.stop();this.saveDraft();this.usage.stop();this.models.key='';this.models.controller?.abort();if(this.activityTransition){this.activityTransition=false;return;}onClose?.();});
    this.dialog.addEventListener('change',e=>{if(e.target.name==='provider')this.setProvider(e.target.value);});
    this.dialog.addEventListener('change',e=>{if(e.target.name==='attachments')this.addAttachments([...e.target.files]);});
    this.dialog.addEventListener('input',e=>{if(e.target.name==='chatSearch'){this.saveDraft();this.searchQuery=e.target.value;this.render();}});
    this.dialog.addEventListener('input',e=>{if(e.target.name==='instruction'){this.saveDraft();this.resizeInput();this.updateSend();}else if(e.target.name==='chatTitle'&&this.rename)this.rename.title=e.target.value;});
    this.dialog.addEventListener('keydown',e=>{
      if(e.target.name==='chatTitle'&&e.key==='Escape'){e.preventDefault();e.stopPropagation();if(!this.renameSaving)this.cancelRename();return;}
      if(e.target.name==='instruction'&&e.key==='Enter'&&!e.shiftKey&&!e.isComposing){e.preventDefault();if(!this.sending&&this.providerReady()&&e.target.value.trim())e.target.form.requestSubmit();}
    });
    this.dialog.addEventListener('click',async e=>{
      const b=e.target.closest('button');if(!b)return;
      if(b.hasAttribute('data-scheduled')){this.saveDraft();this.scheduled.open=true;this.render();}
      else if(b.hasAttribute('data-back-chats')){this.scheduled.open=false;this.render();}
      else if(b.hasAttribute('data-new-schedule')){this.saveDraft();this.scheduled.create();}
      else if(b.dataset.editSchedule)this.scheduled.create(this.scheduled.items().find(s=>s.id===b.dataset.editSchedule));
      else if(b.dataset.scheduleAction)this.scheduled.action(b.dataset.scheduleId,b.dataset.scheduleAction);
      else if(b.dataset.scheduleChat)this.scheduled.chat(b.dataset.scheduleChat);
      else if(b.hasAttribute('data-voice'))this.voice.start({project:this.project,slot:this.slot,thread:this.targetThread(),model:this.models.preference(this.project,this.targetThread())});
      else if(b.hasAttribute('data-connect-app'))this.computerUse.open(this.project,this.slot);
      else if(b.hasAttribute('data-close'))this.dialog.close();
      else if(b.hasAttribute('data-attach'))this.dialog.querySelector('[name=attachments]').click();
      else if(b.dataset.removeAttachment){this.attachmentDrafts.set(this.draftKey(),this.draftAttachments().filter(a=>a.id!==b.dataset.removeAttachment));this.saveDraft();this.render();}
      else if(b.dataset.handoffChat)this.openHandoff(b.dataset.handoffChat);
      else if(b.dataset.stopRun)this.stopRun(b.dataset.stopRun);
      else if(b.dataset.archiveThread)this.archiveChat(b.dataset.archiveThread,b.dataset.action);
      else if(b.hasAttribute('data-show-archived')){this.saveDraft();this.showArchived=!this.showArchived;this.render();}
      else if(b.dataset.renameThread)this.beginRename(b.dataset.renameThread);
      else if(b.hasAttribute('data-cancel-rename')&&!this.renameSaving)this.cancelRename();
      else if(!this.sending&&!this.voice.active()&&b.hasAttribute('data-new-chat'))this.switchConversation(true);
      else if(!this.sending&&!this.voice.active()&&b.dataset.thread){this.saveDraft();this.newConversation=false;this.selectedThread=b.dataset.thread;this.status='';this.resetScroll=true;this.render();}
      else if(b.hasAttribute('data-activity'))this.showActivity();
      else if(b.dataset.copy){const message=this.messages?.find(m=>m.id===b.dataset.copy);if(message)try{await navigator.clipboard.writeText(message.text+(message.findings?.length?'\n\n'+message.findings.map(f=>`${f.priority} · ${f.title}\n${f.file}:${f.line}\n${f.body}`).join('\n\n'):''));b.textContent='Copied';}catch{this.message('Copy unavailable. Select the message text to copy it.');}}
    });
    this.dialog.addEventListener('submit',e=>{e.preventDefault();if(e.target.hasAttribute('data-prompt'))this.send();else if(e.target.hasAttribute('data-rename-chat'))this.renameChat();});
  }
  provider(){return this.providerChoice||'codex';}
  /** Switch between Codex and Claude Code for a new chat, carrying the unsent draft and files across. */
  setProvider(value){if(this.voice?.active())return;if(!['codex','claude'].includes(value)||value===this.provider())return;const draft=this.dialog.querySelector('[name=instruction]')?.value||'';const files=this.draftAttachments();this.saveDraft();this.providerChoice=value;this.newConversation=true;this.selectedThread=null;this.status='';this.resetScroll=true;this.drafts.set(this.draftKey(),draft);this.attachmentDrafts.set(this.draftKey(),files);this.render();}
  archived(thread){return chatArchived(this.data.chatSettings,this.project,this.slot,this.provider(),thread);}
  draftAttachments(){return this.attachmentDrafts.get(this.draftKey())||[];}
  async addAttachments(files){
    const key=this.draftKey(),project=this.project,slot=this.slot;const selected=[...(this.attachmentDrafts.get(key)||[])];
    if(selected.length+files.length>4)return this.message('Attach up to four files.');
    this.saveDraft();this.uploading=true;this.status='Adding attachments…';this.render();
    try{for(const file of files){if(file.size>5*1024*1024)throw new Error('Each attachment must be 5 MB or smaller.');const data=await new Promise((resolve,reject)=>{const reader=new FileReader();reader.onload=()=>resolve(String(reader.result).split(',')[1]);reader.onerror=()=>reject(new Error('Could not read attachment.'));reader.readAsDataURL(file);});selected.push(await this.post('/api/pass-attachment',{project,slot,name:file.name,data}));this.attachmentDrafts.set(key,[...selected]);}this.status='Attachments ready. They are sent only with your next message.';}
    catch(e){this.status=e.message;}finally{this.uploading=false;this.saveDraft();this.render();}
  }
  async stopRun(id){try{await this.post('/api/pass-cancel',{project:this.project,slot:this.slot,id});this.message('Stop requested. Changes already made remain for review.');}catch(e){this.message(e.message);}}
  async archiveChat(thread,action){try{this.saveDraft();await this.post('/api/pass-chat',{project:this.project,slot:this.slot,provider:this.provider(),thread,action});if(action==='archive'&&this.targetThread()===thread)this.switchConversation(true);else this.render();}catch(e){this.message(e.message);}}
  providerReady(){return this.runner.enabled&&(this.provider()==='claude'?this.runner.providers?.claude?.installed===true:this.runner.providers?.codex?.installed!==false);}
  beginRename(thread){
    if(this.renameSaving||!ownsThread(this.data.runs,this.conversations,this.project,this.slot,thread,this.provider()))return;
    const conversation=chatConversation(this.conversations,this.project,thread,this.provider());if(!conversation)return;
    this.saveDraft();const title=chatThreads(this.data.runs,this.project,this.slot,this.conversations,this.provider()).find(t=>t.id===thread)?.title||'Current conversation';
    this.rename={key:conversation.key,project:this.project,thread,title:conversation.title||title.slice(0,200),error:''};this.render();
    const input=this.dialog.querySelector('[name=chatTitle]');input?.focus();input?.select();
  }
  cancelRename(){const thread=this.rename?.thread;this.saveDraft();this.rename=null;this.render();this.dialog.querySelector(`[data-rename-thread="${thread}"]`)?.focus();}
  async renameChat(){
    const edit=this.rename;if(!edit||this.renameSaving)return;
    const title=edit.title.trim();if(!title){edit.error='Enter a chat name.';this.saveDraft();this.render();return;}
    this.saveDraft();this.renameSaving=true;edit.error='';this.render();
    try{
      await this.post('/api/conversation-title',{key:edit.key,title,allowTitle:true});
      if(this.rename===edit){this.rename=null;this.status='Chat name saved locally.';}
    }catch(err){if(this.rename===edit)edit.error=err.message||'Could not rename chat.';}
    finally{this.renameSaving=false;this.saveDraft();this.render();}
  }
  draftKey(){return JSON.stringify([this.project,this.slot,this.provider(),this.newConversation?'new':this.selectedThread||this.targetThread()||'new']);}
  saveDraft(){const field=this.dialog.querySelector('[name=instruction]');if(field&&this.project)this.drafts.set(this.draftKey(),field.value);}
  resizeInput(){const field=this.dialog.querySelector('[name=instruction]');if(field){field.style.height='auto';field.style.height=Math.max(24,Math.min(field.scrollHeight,180))+'px';}}
  switchConversation(fresh){this.saveDraft();this.newConversation=fresh;this.selectedThread=null;this.status='';this.resetScroll=true;this.render();this.dialog.querySelector('[name=instruction]')?.focus();}
  scheduledPending(){return (this.selectedThread?.startsWith('scheduled:')||this.selectedThread?.startsWith('handoff:'))&&!this.targetThread();}
  openHandoff(id){const p=this.data.proposals.find(p=>p.id===id),r=this.data.runs.find(r=>r.proposalId===id);if(!p&&!r)return;const item=p||r,sim=this.resident?.(item.project,item.slot);if(!sim)return;this.open(sim);this.providerChoice=item.provider||'codex';this.selectedThread=runThread(r||{})||p?.resumeSession||'handoff:'+id;this.newConversation=false;this.resetScroll=true;this.render();}
  teamRoots(){const thread=this.targetThread();return this.data.runs.filter(r=>r.project===this.project&&r.slot===this.slot&&!r.teamRoot&&r.teamDelegated&&(r.provider||'codex')===this.provider()&&runThread(r)===thread);}
  handoffPanel(){return this.teamRoots().map(root=>`<section class="team-handoffs" aria-label="Team handoffs"><strong>Project team · ${root.teamStopped?'Stopped':this.data.proposals.some(p=>p.teamRoot===root.id&&['approved','running'].includes(p.status))?'In progress':'Reports ready'}</strong>${this.data.proposals.filter(p=>p.teamRoot===root.id&&!p.teamFinal).map(p=>{const r=this.data.runs.find(r=>r.proposalId===p.id),member=root.team.find(m=>m.slot===p.slot),from=root.team.find(m=>m.slot===(this.data.runs.find(r=>r.id===p.teamParent)?.slot||root.slot));return `<article><span>${esc(from?.name||'Teammate')} → ${esc(member?.name||'Teammate')} · ${esc(member?.title||'')}</span><b>${esc(p.title)}</b><small>${esc((r?.status||p.status)==='approved'?'Queued':r?.status||p.status)}${p.teamDependencies?.length?' · waiting for prerequisite':''}</small>${r?.result?`<p>${esc(r.result.summary)}</p>`:''}${r?.error||p.error?`<p>${esc(r?.error||p.error)}</p>`:''}<button type="button" data-handoff-chat="${esc(p.id)}">Open ${esc(member?.name||'agent')}’s chat</button></article>`;}).join('')}</section>`).join('');}
  targetThread(){
    if(this.selectedThread?.startsWith('handoff:')){const id=this.selectedThread.slice(8),r=this.data.runs.find(r=>r.proposalId===id&&r.project===this.project&&r.slot===this.slot);return ownsThread(this.data.runs,this.conversations,this.project,this.slot,runThread(r||{}),this.provider())?runThread(r):null;}
    if(this.selectedThread?.startsWith('scheduled:')){const id=this.selectedThread.slice(10),s=this.data.schedules?.find(s=>s.id===id&&s.project===this.project&&s.slot===this.slot&&s.provider===this.provider());const thread=s?.thread||this.data.runs.find(r=>r.scheduleId===id&&validThread(r.conversationSession))?.conversationSession;return ownsThread(this.data.runs,this.conversations,this.project,this.slot,thread,this.provider())?thread:null;}
    if(this.newConversation||['unstarted','pending-new'].includes(this.selectedThread))return null;
    let thread=validThread(this.selectedThread)?this.selectedThread:residentThread(this.data.runs,this.project,this.slot,this.sim?.truth,this.provider());
    if(!this.selectedThread&&this.archived(thread))thread=chatThreads(this.data.runs,this.project,this.slot,this.conversations,this.provider()).find(t=>validThread(t.id)&&!this.archived(t.id))?.id;
    return ownsThread(this.data.runs,this.conversations,this.project,this.slot,thread,this.provider())?thread:null;
  }
  busy(){return !!this.activePrompt()||['approved','running'].includes(this.proposal()?.status)||threadBusy(this.sessions,this.targetThread())||residentBusy(this.sessions,this.project,this.slot);}
  proposal(){return [...this.data.proposals].reverse().find(p=>p.project===this.project&&p.slot===this.slot);}
  pendingProposalIds(){
    const ids=new Set();let id=this.followProposal;
    while(id&&!ids.has(id)){ids.add(id);id=this.data.proposals.find(p=>p.id===id)?.afterProposal;}
    return ids;
  }
  activePrompt(){
    if(this.newConversation)return null;
    const thread=this.targetThread();const pending=this.pendingProposalIds();
    const matches=p=>p.project===this.project&&p.slot===this.slot&&(p.provider||'codex')===this.provider()&&(this.selectedThread?.startsWith('handoff:')?(p.proposalId||p.id)===this.selectedThread.slice(8):this.selectedThread?.startsWith('scheduled:')?p.scheduleId===this.selectedThread.slice(10):thread?runThread(p)===thread:this.selectedThread==='pending-new'&&pending.has(p.proposalId||p.id));
    const ids=new Set(this.teamRoots().map(r=>r.id));const teamMatch=p=>ids.has(p.teamRoot);
    return this.data.runs.find(r=>r.status==='running'&&(matches(r)||teamMatch(r)))||this.data.proposals.find(p=>p.status==='approved'&&(matches(p)||teamMatch(p)));
  }
  updateSend(){
    const button=this.dialog.querySelector('.send-message');const field=this.dialog.querySelector('[name=instruction]');if(!button)return;
    const active=this.activePrompt();const stop=!field?.value.trim()&&active;
    button.type=stop?'button':'submit';button.dataset.stopRun=stop?active.id:'';
    button.dataset.mode=stop?'stop':'send';button.setAttribute('aria-label',stop?'Stop run':'Send message');button.title=stop?'Stop run':'Send message';button.innerHTML=icon(stop?'square':'arrowUp');
    button.disabled=!!(this.sending||this.uploading||this.voice?.active()||(stop?active.stopRequestedAt:this.scheduledPending()||this.archived(this.targetThread())||!this.providerReady()||this.selectedThread==='unstarted'||(validThread(this.selectedThread)&&!this.targetThread())||!field?.value.trim()));
  }
  async post(route,input){const r=await fetch(route,{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify(input)});const d=await r.json();if(!r.ok)throw new Error(d.error);this.setData(await fetch('/api/state').then(r=>r.json()));return d.result;}
  async send(){
    const field=this.dialog.querySelector('[name=instruction]');const instruction=field?.value.trim();
    if(this.voice.active())return;
    if(!instruction||this.sending||this.uploading||this.scheduledPending()||this.archived(this.targetThread())||!this.providerReady()||this.selectedThread==='unstarted'||(validThread(this.selectedThread)&&!this.targetThread()))return;
    this.saveDraft();const draftKey=this.draftKey();const resumeSession=this.targetThread();const project=this.project;const slot=this.slot;
    this.sending=true;this.status='';this.updateSend();
    try{
      const proposal=await this.post('/api/pass-proposal',{project,slot,teamWork:true,provider:this.provider(),version:this.proposal()?.version,enqueue:true,afterProposal:this.selectedThread==='pending-new'?this.followProposal:null,resumeSession,attachments:this.draftAttachments().map(a=>a.id),model:this.models.preference(project,resumeSession,this.provider()),effort:this.models.effortPreference(project,resumeSession,this.provider()),title:instruction.split('\n')[0].slice(0,100),instruction,recordedBy:'Human prompt'});
      await this.post('/api/pass-decision',{id:proposal.id,version:proposal.version,action:'approve',confirmed:true});
      this.drafts.delete(draftKey);
      this.attachmentDrafts.delete(draftKey);
      this.followProposal=proposal.id;this.followThread=resumeSession||'pending-new';
      if(this.project===project&&this.slot===slot){this.newConversation=false;this.selectedThread=resumeSession||'pending-new';this.drafts.delete(this.draftKey());}
    }catch(err){this.status=err.message;}
    finally{this.sending=false;this.render();}
  }
  setData(state){
    this.saveDraft();
    if(typeof state.connected==='boolean')this.connected=state.connected;
    if(state.conversations)this.conversations=state.conversations;
    if(state.sessions)this.sessions=state.sessions;if(state.passes)this.data=state.passes;if(state.runner)this.runner=state.runner;
    if(this.followProposal){
      let id=this.followProposal;const seen=new Set();
      while(id&&!seen.has(id)){seen.add(id);const next=this.data.proposals.find(p=>p.id===id)?.afterProposal;if(!next)break;id=next;}
      const run=this.data.runs.find(r=>r.proposalId===this.followProposal)||this.data.runs.find(r=>r.proposalId===id);
      if(run&&(runThread(run)||['failed','interrupted','cancelled'].includes(run.status))){
        if(run.project===this.project&&run.slot===this.slot&&this.selectedThread===this.followThread&&!this.newConversation){
          const draft=this.dialog.querySelector('[name=instruction]')?.value||'';
          this.selectedThread=runThread(run)||'unstarted';this.drafts.set(this.draftKey(),draft);
        }
        if(run.proposalId===this.followProposal)this.followProposal=null;else this.followThread=this.selectedThread;
      }
    }
    const key=JSON.stringify([this.data,this.runner,this.connected,this.conversations,this.sessions.map(s=>[s.session,s.state,s.detail,s.history,s.lastEventAt])]);
    if(this.dialog.open&&key!==this.renderKey)this.render();this.renderKey=key;
  }
  showActivity(){const run=[...this.data.runs].reverse().find(r=>r.project===this.project&&r.slot===this.slot&&(r.provider||'codex')===this.provider()&&runThread(r)===this.targetThread()&&r.conversationSession);if((!run&&(!this.targetThread()||this.sim?.truth?.session!==this.targetThread()))||!this.onActivity?.(run,this.sim))return this.message('No observed activity is available for this chat yet.');this.saveDraft();this.activityTransition=true;this.dialog.close();}
  open(sim,{observedThread=false}={}){
    this.saveDraft();this.newConversation=false;this.selectedThread=null;this.rename=null;this.status='';
    this.searchQuery='';this.showArchived=false;this.scheduled.open=false;
    const resident=sim.isVisitor?sim.parent:sim;this.sim=resident;
    Object.assign(this,promptResident(sim));this.providerChoice=resident.truth?.source==='claude-code'?'claude':'codex';
    if(observedThread&&ownsThread(this.data.runs,this.conversations,this.project,this.slot,resident.truth?.session,this.provider()))this.selectedThread=resident.truth.session;
    this.render();this.show();
  }
  openHome(project){this.scheduled.open=false;this.saveDraft();this.newConversation=false;this.selectedThread=null;this.status='';this.rename=null;this.sim=null;this.providerChoice='codex';this.project=project;this.slot=1;this.name=this.residentName?.(project,1)||'Agent';this.render();this.show();}
  /** A prompt from this game is running for the resident right now (drives the avatar's thinking pose). */
  promptRunning(){return (this.data?.runs||[]).some(r=>r.status==='running'&&r.project===this.project&&r.slot===this.slot);}
  showAvatar(){const has=!!this.resident?.(this.project,this.slot)?.look;this.dialog.classList.toggle('with-avatar',has);if(!has){if(this.avatar.matches(':popover-open'))this.avatar.hidePopover();return;}this.avatar.querySelector('.pa-name').textContent=this.name||'';if(this.avatar.matches(':popover-open'))this.avatar.hidePopover();this.avatar.showPopover();}
  show(){if(!this.dialog.open)this.dialog.showModal();this.showAvatar();if(this.usage.element.open)this.usage.start();this.resizeInput();const scroller=this.dialog.querySelector('.chat-messages');if(scroller)scroller.scrollTop=scroller.scrollHeight;}
  message(text){this.status=text;const status=this.dialog.querySelector('[data-prompt] [role=status]');if(status)status.textContent=text;}
  render(){
    if(this.scheduled.open){this.dialog.classList.add('chat-card');this.dialog.innerHTML=this.scheduled.render();return;}
    if(this.models?.dragging){this.models.renderPending=true;return;} // don't rebuild under a slider being dragged
    const field=this.dialog.querySelector('[name=instruction]');const focused=field===document.activeElement;const selection=focused?[field.selectionStart,field.selectionEnd]:null;
    const renameField=this.dialog.querySelector('[name=chatTitle]');const renameFocused=renameField&&renameField===document.activeElement;const renameSelection=renameFocused?[renameField.selectionStart,renameField.selectionEnd]:null;
    const searchField=this.dialog.querySelector('[name=chatSearch]');const searchFocused=searchField===document.activeElement;const searchPosition=searchField?.selectionStart;
    const scroller=this.dialog.querySelector('.chat-messages');const scrollTop=scroller?.scrollTop;const atBottom=this.resetScroll||!scroller||scroller.scrollHeight-scroller.scrollTop-scroller.clientHeight<70;
    this.resetScroll=false;
    const runs=this.data.runs.filter(r=>r.project===this.project&&r.slot===this.slot&&(r.provider||'codex')===this.provider());
    this.dialog.classList.add('chat-card');
    const target=this.targetThread();const allThreads=chatThreads(this.data.runs,this.project,this.slot,this.conversations,this.provider(),this.data.schedules||[],this.data.proposals);const threads=allThreads.filter(t=>this.archived(t.id)===this.showArchived&&t.title.toLowerCase().includes(this.searchQuery.toLowerCase()));const selected=this.newConversation?null:target||(['unstarted','pending-new'].includes(this.selectedThread)||(this.selectedThread?.startsWith('scheduled:')||this.selectedThread?.startsWith('handoff:'))?this.selectedThread:'unstarted');
    const row=t=>`<div class="chat-thread-row"><button data-thread="${esc(t.id)}" class="chat-thread ${t.id===selected?'selected':''}" aria-pressed="${t.id===selected}" title="${esc(t.title)}">${esc(t.title.slice(0,70))}</button>${t.conversation?`<button type="button" class="chat-rename" data-rename-thread="${esc(t.id)}" aria-label="Rename ${esc(t.title.slice(0,70))}" title="Rename" ${this.renameSaving?'disabled':''}>${icon('pencil')}</button>`:''}${validThread(t.id)?`<button type="button" class="chat-archive" data-archive-thread="${esc(t.id)}" data-action="${this.archived(t.id)?'restore':'archive'}" aria-label="${this.archived(t.id)?'Restore':'Archive'} ${esc(t.title.slice(0,70))}" title="${this.archived(t.id)?'Restore chat':'Archive locally'}">${icon(this.archived(t.id)?'archiveRestore':'archive')}</button>`:''}</div>`;
    const observed=chatConversation(this.conversations,this.project,target,this.provider());
    const renameForm=this.rename?.project===this.project?`<form data-rename-chat class="chat-rename-form"><label for="chat-title">Chat name</label><input id="chat-title" name="chatTitle" value="${esc(this.rename.title)}" maxlength="200" required ${this.renameSaving?'readonly':''}><small>Saved locally in Agent World.</small><div><button type="submit" ${this.renameSaving?'disabled':''}>${this.renameSaving?'Saving…':'Save name'}</button><button type="button" data-cancel-rename ${this.renameSaving?'disabled':''}>Cancel</button></div><p role="status">${esc(this.rename.error)}</p></form>`:'';
    const threadRuns=this.newConversation?[]:runs.filter(r=>this.selectedThread?.startsWith('handoff:')?r.proposalId===this.selectedThread.slice(8):selected==='pending-new'?this.pendingProposalIds().has(r.proposalId):(this.selectedThread?.startsWith('scheduled:')?r.scheduleId===this.selectedThread.slice(10):(runThread(r)||'unstarted')===selected));
    const queued=this.data.proposals.filter(p=>p.project===this.project&&p.slot===this.slot&&p.status==='approved'&&(p.provider||'codex')===this.provider()&&(this.selectedThread?.startsWith('handoff:')?p.id===this.selectedThread.slice(8):target?p.resumeSession===target:(this.selectedThread?.startsWith('handoff:')?(p.proposalId||p.id)===this.selectedThread.slice(8):this.selectedThread?.startsWith('scheduled:')?p.scheduleId===this.selectedThread.slice(10):this.selectedThread==='pending-new'&&this.pendingProposalIds().has(p.id)))&&!this.newConversation);
    this.messages=chatMessages(threadRuns,queued);
    const chat=conversationTarget({source:this.provider()==='claude'?'claude-code':'codex',id:target});
    const summaryOpen=new Map([...this.dialog.querySelectorAll('[data-reasoning]')].map(el=>[el.dataset.reasoning,el.open]));
    const draft=this.drafts.get(this.draftKey())||'';
    this.dialog.innerHTML=`<header class="chat-header"><span class="panel-icon">${icon('messageCircle')}</span><div><h2>${esc(this.name)}</h2><div class="chat-xp">${xpMarkup(experience(this.data.runs).residents[residentKey(this.project,this.slot)],{compact:true})}</div><small>${this.sim?.character?.assignedRole?esc(this.sim.roleInfo?.title||this.sim.character.assignedRole)+' · ':''}${this.provider()==='claude'?'Claude Code':'Codex'} · ${esc(this.project.split('/').filter(Boolean).at(-1)||this.project)}</small></div><button class="icon-btn" data-close aria-label="Close chat">${icon('x')}</button></header>
      <div class="chat-layout"><div class="chat-account" data-chat-usage></div><aside class="chat-sidebar" aria-label="Conversations"><div class="sidebar-head"><h3>${esc(this.name)}’s chats</h3><button type="button" data-scheduled class="side-icon" aria-label="Scheduled tasks" title="Scheduled tasks">${icon('calendarClock')}</button><button type="button" data-new-chat class="side-icon primary" aria-label="New chat" title="New chat">${icon('squarePen')}</button></div><label class="chat-search-wrap">${icon('search')}<input class="chat-search" name="chatSearch" aria-label="Search chats" placeholder="Search chats…" value="${esc(this.searchQuery)}"></label><button type="button" data-show-archived class="archive-toggle">${icon(this.showArchived?'arrowLeft':'archive')}${this.showArchived?'Back to chats':'Archived chats'}</button>${renameForm}${threads.map(row).join('')}${!threads.length?`<small class="chat-list-empty">${this.searchQuery?'No matching chats.':this.showArchived?'No archived chats.':'No chats yet.'}</small>`:''}</aside>
      <div class="chat-main"><div class="chat-messages" role="log" aria-label="Chat messages" aria-live="polite" aria-relevant="additions text">${this.messages.length?this.messages.map(m=>`<article class="chat-message ${m.role} ${m.failed?'message-failed':''}" aria-label="${m.role==='user'?esc(m.author||'You'):esc(this.name)}"><div class="message-author">${m.role==='user'?esc(m.author||'You'):esc(this.name)}</div>${m.role==='assistant'&&m.provider!=='claude'&&((m.pending&&!m.queued)||m.reasoningSummaries?.length)?`<details class="chat-reasoning" data-reasoning="${esc(m.id)}" ${(summaryOpen.get(m.id)??m.pending)?'open':''}><summary>${m.pending?'<span class="thinking-dot" aria-hidden="true"></span>':''}${m.pending?'Reasoning · live':'Reasoning summary'}</summary><div>${m.reasoningSummaries?.length?m.reasoningSummaries.map(s=>`<p>${esc(s.text)}</p>`).join(''):`<p>${this.connected?'Waiting for Codex’s next summary. Sections appear here as Codex emits them.':'Live summaries disconnected. Reconnecting will load recorded summaries.'}</p>`}</div></details>`:''}${m.execution?`<div class="execution-report">${esc(executionLabel(m.execution,this.provider()))}${m.reviewScope?`<small>Reviewed ${esc(m.reviewScope.head.slice(0,12))}${m.reviewScope.ref?' against '+esc(m.reviewScope.ref.slice(0,12)):''}</small>`:''}</div>`:''}${m.attachments?.length?`<div class="message-attachments">${m.attachments.map(a=>`<span>${esc(a.name)}</span>`).join('')}</div>`:''}${m.workspace?`<div class="workspace-report"><strong>Isolated worktree</strong><span>${esc(m.workspace.branch)}</span><code>${esc(m.workspace.path)}</code><a href="vscode://file${esc(m.workspace.path.split('/').map(encodeURIComponent).join('/'))}">Open in VS Code</a><small>Changes remain here for review; they are not merged into your project.</small></div>`:''}${m.findings?`<div class="review-findings"><strong>${m.findings.length?m.findings.length+' reported finding'+(m.findings.length===1?'':'s'):'No actionable findings reported'}</strong>${m.findings.map(f=>`<article><strong>${esc(f.priority)} · ${esc(f.title)}</strong><code>${esc(f.file)}:${f.line}</code><p>${esc(f.body)}</p></article>`).join('')}<small>Agent report · inspect the evidence before accepting work.</small></div>`:''}<div class="message-content">${esc(m.pending&&!this.connected?'Awaiting a recorded response. Live activity unavailable.':m.text)}</div>${m.pending?`<small class="chat-pending">${m.queued?'Waiting to run':this.connected?'In progress':'Last recorded as in progress'}</small>`:`<button class="message-copy" data-copy="${esc(m.id)}" aria-label="Copy ${m.role==='user'?'your message':'response'}">${icon('copy')} Copy</button>`}</article>`).join(''):`<div class="chat-empty"><h3>${this.scheduledPending()?(this.selectedThread?.startsWith('handoff:')?'Team handoff':'Scheduled conversation'):this.newConversation?'Start a new chat':`What can ${esc(this.name)} help with?`}</h3><p>${this.scheduledPending()?(this.selectedThread?.startsWith('handoff:')?'The delegated task and its response will appear here when the agent runs.':'The scheduled prompt and response will appear here when the task runs.'):'Send a message to begin.'}</p></div>`}${this.handoffPanel()}</div>
      <form data-prompt class="chat-composer"><label class="sr-only" for="chat-instruction">Message ${esc(this.name)}</label><div class="composer-box"><textarea id="chat-instruction" name="instruction" required maxlength="4000" rows="1" placeholder="Message ${esc(this.name)}…" ${this.sending?'readonly':''}>${esc(draft)}</textarea><div class="composer-attachments">${this.draftAttachments().map(a=>`<span>${esc(a.name)}<button type="button" data-remove-attachment="${esc(a.id)}" aria-label="Remove ${esc(a.name)}">×</button></span>`).join('')}</div><div class="composer-toolbar"><button type="button" class="attach-message" data-attach aria-label="Attach files" title="Images and text files" ${this.sending||this.uploading?'disabled':''}>${icon('plus')}</button><input type="file" name="attachments" class="sr-only" multiple accept=".png,.jpg,.jpeg,.webp,.txt,.md,.csv,.json,.log,.js,.mjs,.ts,.py,.html,.css,.yaml,.yml"><div data-chat-model></div>${this.provider()==='codex'?`<button type="button" class="voice-message" data-voice aria-label="Start voice chat" title="Talk to ${esc(this.name)}">${icon('mic')}</button>`:''}<button class="primary send-message" type="submit" aria-label="Send message">${icon('arrowUp')}</button></div></div><div data-voice-panel class="voice-panel"></div><div class="workspace-choice">${this.archived(target)?'<span>Archived chat · restore it to send a message.</span>':''}</div><div class="composer-meta"><span>${this.scheduledPending()?this.selectedThread?.startsWith('handoff:')?'This handoff conversation starts when its turn runs.':'This scheduled conversation starts on its first run.':this.selectedThread==='unstarted'?'Choose New chat to send a message.':!this.providerReady()?(this.provider()==='claude'?'Install Claude Code CLI and sign in to send.':this.runner.enabled?'Codex CLI executable unavailable. Check installation and restart the bridge.':'Runner unavailable'):this.busy()?'Working · send a follow-up to queue it':this.sim?.character?.assignedRole?'Send allows scoped handoffs to your project team':'Enter to send · Shift + Enter for a new line'}</span>${this.provider()==='codex'?'<button type="button" data-connect-app>Connect an app</button>':''}${chat?`<a href="${esc(chat.url)}">${esc(chat.label)}</a>`:''}</div><p role="status">${esc(this.status||'')}</p></form></div></div>`;
    if(this.provider()==='codex')this.usage.mount(this.dialog.querySelector('[data-chat-usage]'));else{this.usage.stop();this.dialog.querySelector('[data-chat-usage]').innerHTML=`<details class="connected-usage usage-account"><summary aria-label="Claude usage" title="Claude usage">${icon('gauge')}</summary><div class="usage-content">Claude Code usage is unavailable. No remaining amount is assumed.</div></details>`;}
    this.voice.mount(this.dialog.querySelector('[data-voice-panel]'));
    const voiceButton=this.dialog.querySelector('[data-voice]');if(voiceButton)voiceButton.disabled=this.voice.active()||this.busy()||this.sending||this.uploading||!this.providerReady()||this.archived(target)||this.selectedThread==='unstarted'||this.scheduledPending();
    this.models.mount(this.dialog.querySelector('[data-chat-model]'),this.project,target,{provider:this.provider(),providerLocked:!!(this.sending||this.uploading||this.busy()||this.voice.active()),onProvider:v=>this.setProvider(v)});
    this.models.load(this.project,[...threads.map(t=>validThread(t.id)?t.id:null),target],runs.map(r=>[r.id,r.status,r.finishedAt,r.observedModel]),this.provider());
    this.resizeInput();this.updateSend();
    if(searchFocused){const input=this.dialog.querySelector('[name=chatSearch]');input.focus();input.setSelectionRange(searchPosition,searchPosition);}
    if(renameFocused){const input=this.dialog.querySelector('[name=chatTitle]');if(input&&!input.readOnly){input.focus();input.setSelectionRange(...renameSelection);}}
    const nextScroller=this.dialog.querySelector('.chat-messages');nextScroller.scrollTop=atBottom?nextScroller.scrollHeight:scrollTop||0;
    const nextField=this.dialog.querySelector('[name=instruction]');if(focused){nextField.focus();nextField.setSelectionRange(...selection);}
  }
}
