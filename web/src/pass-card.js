import {ConversationModels} from './conversation-models.js';
import { ConnectedUsage } from './usage.js';
import {residentThread,threadBusy,validThread} from '../../shared/pass-conversations.mjs';
import {chatThreads,chatMessages,runThread,chatConversation} from '../../shared/chat.mjs';
import { escapeHtml as esc } from './sim.js';
import { conversationTarget } from '../../shared/conversations.mjs';

export class PassCard {
  constructor({onClose,residentName,onActivity}){
    Object.assign(this,{onClose,residentName,onActivity});
    this.usage=new ConnectedUsage({compact:true});this.models=new ConversationModels(()=>{if(this.dialog.open){this.saveDraft();this.render();}});
    this.data={proposals:[],runs:[]};this.runner={enabled:false};this.connected=false;this.sessions=[];this.conversations=[];this.drafts=new Map();
    this.dialog=document.createElement('dialog');this.dialog.className='pass-card glass';document.body.append(this.dialog);
    this.dialog.addEventListener('close',()=>{this.saveDraft();this.usage.stop();this.models.key='';this.models.controller?.abort();if(this.activityTransition){this.activityTransition=false;return;}onClose?.();});
    this.dialog.addEventListener('input',e=>{if(e.target.name==='instruction'){this.saveDraft();this.resizeInput();this.updateSend();}else if(e.target.name==='chatTitle'&&this.rename)this.rename.title=e.target.value;});
    this.dialog.addEventListener('keydown',e=>{
      if(e.target.name==='chatTitle'&&e.key==='Escape'){e.preventDefault();e.stopPropagation();if(!this.renameSaving)this.cancelRename();return;}
      if(e.target.name==='instruction'&&e.key==='Enter'&&!e.shiftKey&&!e.isComposing){e.preventDefault();if(!this.sending&&!this.busy()&&this.runner.enabled&&e.target.value.trim())e.target.form.requestSubmit();}
    });
    this.dialog.addEventListener('click',async e=>{
      const b=e.target.closest('button');if(!b)return;
      if(b.hasAttribute('data-close'))this.dialog.close();
      else if(b.dataset.renameThread)this.beginRename(b.dataset.renameThread);
      else if(b.hasAttribute('data-cancel-rename')&&!this.renameSaving)this.cancelRename();
      else if(!this.sending&&b.hasAttribute('data-new-chat'))this.switchConversation(true);
      else if(!this.sending&&b.dataset.thread){this.saveDraft();this.newConversation=false;this.selectedThread=b.dataset.thread;this.status='';this.resetScroll=true;this.render();}
      else if(b.hasAttribute('data-activity'))this.showActivity();
      else if(b.dataset.copy){const message=this.messages?.find(m=>m.id===b.dataset.copy);if(message)try{await navigator.clipboard.writeText(message.text);b.textContent='Copied';}catch{this.message('Copy unavailable. Select the message text to copy it.');}}
    });
    this.dialog.addEventListener('submit',e=>{e.preventDefault();if(e.target.hasAttribute('data-prompt'))this.send();else if(e.target.hasAttribute('data-rename-chat'))this.renameChat();});
  }
  beginRename(thread){
    if(this.renameSaving)return;
    const conversation=chatConversation(this.conversations,this.project,thread);if(!conversation)return;
    this.saveDraft();const title=chatThreads(this.data.runs,this.project,this.slot,this.conversations).find(t=>t.id===thread)?.title||'Current Codex conversation';
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
  draftKey(){return JSON.stringify([this.project,this.slot,this.newConversation?'new':this.selectedThread||this.targetThread()||'new']);}
  saveDraft(){const field=this.dialog.querySelector('[name=instruction]');if(field&&this.project)this.drafts.set(this.draftKey(),field.value);}
  resizeInput(){const field=this.dialog.querySelector('[name=instruction]');if(field){field.style.height='auto';field.style.height=Math.max(24,Math.min(field.scrollHeight,180))+'px';}}
  switchConversation(fresh){this.saveDraft();this.newConversation=fresh;this.selectedThread=null;this.status='';this.resetScroll=true;this.render();this.dialog.querySelector('[name=instruction]')?.focus();}
  targetThread(){return this.newConversation?null:validThread(this.selectedThread)?this.selectedThread:['unstarted','pending-new'].includes(this.selectedThread)?null:residentThread(this.data.runs,this.project,this.slot,this.sim?.truth);}
  busy(){return ['approved','running'].includes(this.proposal()?.status)||threadBusy(this.sessions,this.targetThread());}
  proposal(){return this.data.proposals.find(p=>p.project===this.project&&p.slot===this.slot);}
  updateSend(){const button=this.dialog.querySelector('[data-prompt] [type=submit]');const field=this.dialog.querySelector('[name=instruction]');if(button)button.disabled=this.sending||this.busy()||!this.runner.enabled||this.selectedThread==='unstarted'||!field?.value.trim();}
  async post(route,input){const r=await fetch(route,{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify(input)});const d=await r.json();if(!r.ok)throw new Error(d.error);this.setData(await fetch('/api/state').then(r=>r.json()));return d.result;}
  async send(){
    const field=this.dialog.querySelector('[name=instruction]');const instruction=field?.value.trim();
    if(!instruction||this.sending||this.busy()||!this.runner.enabled||this.selectedThread==='unstarted')return;
    this.saveDraft();const draftKey=this.draftKey();const resumeSession=this.targetThread();const project=this.project;const slot=this.slot;
    this.sending=true;this.status='';this.updateSend();
    try{
      const proposal=await this.post('/api/pass-proposal',{project,slot,version:this.proposal()?.version,resumeSession,model:this.models.preference(project,resumeSession),title:instruction.split('\n')[0].slice(0,100),instruction,recordedBy:'Human prompt'});
      await this.post('/api/pass-decision',{id:proposal.id,version:proposal.version,action:'approve',confirmed:true});
      this.drafts.delete(draftKey);
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
      const run=this.data.runs.find(r=>r.proposalId===this.followProposal);
      if(run&&(runThread(run)||['failed','interrupted'].includes(run.status))){
        if(run.project===this.project&&run.slot===this.slot&&this.selectedThread===this.followThread&&!this.newConversation){
          const draft=this.dialog.querySelector('[name=instruction]')?.value||'';
          this.selectedThread=runThread(run)||'unstarted';this.drafts.set(this.draftKey(),draft);
        }
        this.followProposal=null;
      }
    }
    const key=JSON.stringify([this.data,this.runner,this.connected,this.conversations,this.sessions.map(s=>[s.session,s.state,s.detail,s.history,s.lastEventAt])]);
    if(this.dialog.open&&key!==this.renderKey)this.render();this.renderKey=key;
  }
  showActivity(){const run=[...this.data.runs].reverse().find(r=>r.project===this.project&&r.slot===this.slot&&runThread(r)===this.targetThread()&&r.conversationSession);if((!run&&(!this.targetThread()||this.sim?.truth?.session!==this.targetThread()))||!this.onActivity?.(run,this.sim))return this.message('No observed activity is available for this chat yet.');this.saveDraft();this.activityTransition=true;this.dialog.close();}
  open(sim,{observedThread=false}={}){this.saveDraft();this.newConversation=false;this.selectedThread=null;this.status='';this.sim=sim;if(observedThread&&sim.truth?.source==='codex'&&validThread(sim.truth.session))this.selectedThread=sim.truth.session;const linked=this.data.runs.find(r=>r.conversationSession===sim.truth?.session&&r.project===sim.lot.project);this.project=linked?.project||sim.lot.project;this.slot=linked?.slot||(sim.isVisitor?sim.parent?.character?.slot||1:sim.character?.slot||1);this.name=observedThread?sim.name:this.residentName?.(this.project,this.slot)||sim.name;this.render();this.show();}
  openHome(project){this.saveDraft();this.newConversation=false;this.selectedThread=null;this.status='';this.sim=null;this.project=project;this.slot=1;this.name=this.residentName?.(project,1)||'Agent';this.render();this.show();}
  show(){if(!this.dialog.open)this.dialog.showModal();if(this.usage.element.open)this.usage.start();this.resizeInput();const scroller=this.dialog.querySelector('.chat-messages');if(scroller)scroller.scrollTop=scroller.scrollHeight;}
  message(text){this.status=text;const status=this.dialog.querySelector('[data-prompt] [role=status]');if(status)status.textContent=text;}
  render(){
    const field=this.dialog.querySelector('[name=instruction]');const focused=field===document.activeElement;const selection=focused?[field.selectionStart,field.selectionEnd]:null;
    const renameField=this.dialog.querySelector('[name=chatTitle]');const renameFocused=renameField&&renameField===document.activeElement;const renameSelection=renameFocused?[renameField.selectionStart,renameField.selectionEnd]:null;
    const scroller=this.dialog.querySelector('.chat-messages');const scrollTop=scroller?.scrollTop;const atBottom=this.resetScroll||!scroller||scroller.scrollHeight-scroller.scrollTop-scroller.clientHeight<70;
    this.resetScroll=false;
    const runs=this.data.runs.filter(r=>r.project===this.project&&r.slot===this.slot);
    this.dialog.classList.add('chat-card');
    const target=this.targetThread();const threads=chatThreads(this.data.runs,this.project,this.slot,this.conversations);const selected=this.newConversation?null:this.selectedThread||target||'unstarted';
    const row=t=>`<div class="chat-thread-row"><button data-thread="${esc(t.id)}" class="chat-thread ${t.id===selected?'selected':''}" aria-pressed="${t.id===selected}" title="${esc(t.title)}">${esc(t.title.slice(0,70))}<small>${esc(this.models.observed(t.id)||'Model unavailable')}</small></button>${t.conversation?`<button type="button" class="chat-rename" data-rename-thread="${esc(t.id)}" aria-label="Rename ${esc(t.title.slice(0,70))}" ${this.renameSaving?'disabled':''}>Rename</button>`:''}</div>`;
    const observed=chatConversation(this.conversations,this.project,target);
    const renameForm=this.rename?.project===this.project?`<form data-rename-chat class="chat-rename-form"><label for="chat-title">Chat name</label><input id="chat-title" name="chatTitle" value="${esc(this.rename.title)}" maxlength="200" required ${this.renameSaving?'readonly':''}><small>Saved locally in Agent World.</small><div><button type="submit" ${this.renameSaving?'disabled':''}>${this.renameSaving?'Saving…':'Save name'}</button><button type="button" data-cancel-rename ${this.renameSaving?'disabled':''}>Cancel</button></div><p role="status">${esc(this.rename.error)}</p></form>`:'';
    const threadRuns=this.newConversation?[]:runs.filter(r=>selected==='pending-new'?r.proposalId===this.followProposal:(runThread(r)||'unstarted')===selected);
    const proposal=this.proposal();const queued=proposal?.status==='approved'&&((proposal.resumeSession||null)===target)&&!this.newConversation?proposal:null;
    this.messages=chatMessages(threadRuns,queued);
    const chat=conversationTarget({source:'codex',id:target});
    const summaryOpen=new Map([...this.dialog.querySelectorAll('[data-reasoning]')].map(el=>[el.dataset.reasoning,el.open]));
    const draft=this.drafts.get(this.draftKey())||'';
    this.dialog.innerHTML=`<header class="chat-header"><div><h2>${esc(this.name)}</h2><small>Codex · ${esc(this.project.split('/').filter(Boolean).at(-1)||this.project)}</small></div><div><button data-close aria-label="Close chat">×</button></div></header>
      <div class="chat-layout"><div class="chat-account" data-chat-usage></div><aside class="chat-sidebar" aria-label="Conversations"><button data-new-chat class="new-chat">＋ New chat</button><h3>Your chats</h3>${renameForm}${threads.map(row).join('')}${target&&!threads.some(t=>t.id===target)?row({id:target,title:observed?.title||'Current Codex conversation',conversation:observed}):''}<p>Messages sent from Agent World appear here. Earlier app messages aren’t imported.</p></aside>
      <div class="chat-main"><div class="chat-messages" role="log" aria-label="Chat messages" aria-live="polite" aria-relevant="additions text">${this.messages.length?this.messages.map(m=>`<article class="chat-message ${m.role} ${m.failed?'message-failed':''}" aria-label="${m.role==='user'?'You':esc(this.name)}"><div class="message-author">${m.role==='user'?'You':esc(this.name)}</div>${m.role==='assistant'&&(m.pending||m.reasoningSummaries?.length)?`<details class="chat-reasoning" data-reasoning="${esc(m.id)}" ${(summaryOpen.get(m.id)??m.pending)?'open':''}><summary>${m.pending?'<span class="thinking-dot" aria-hidden="true"></span>':''}${m.pending?'Reasoning · live':'Reasoning summary'}</summary><div>${m.reasoningSummaries?.length?m.reasoningSummaries.map(s=>`<p>${esc(s.text)}</p>`).join(''):`<p>${this.connected?'Waiting for Codex’s next summary. Sections appear here as Codex emits them.':'Live summaries disconnected. Reconnecting will load recorded summaries.'}</p>`}</div></details>`:''}<div class="message-content">${esc(m.pending&&!this.connected?'Awaiting a recorded response. Live activity unavailable.':m.text)}</div>${m.pending?`<small class="chat-pending">${this.connected?'In progress':'Last recorded as in progress'}</small>`:`<button class="message-copy" data-copy="${esc(m.id)}" aria-label="Copy ${m.role==='user'?'your message':'response'}">Copy</button>`}</article>`).join(''):`<div class="chat-empty"><h3>${this.newConversation?'Start a new chat':`What can ${esc(this.name)} help with?`}</h3><p>Send a message to begin.</p></div>`}</div>
      <form data-prompt class="chat-composer"><label class="sr-only" for="chat-instruction">Message ${esc(this.name)}</label><div class="composer-box"><textarea id="chat-instruction" name="instruction" required maxlength="4000" rows="1" placeholder="Message ${esc(this.name)}…" ${this.sending?'readonly':''}>${esc(draft)}</textarea><div class="composer-toolbar"><div data-chat-model></div><button class="primary send-message" type="submit" aria-label="Send message">↑</button></div></div><div class="composer-meta"><span>${this.selectedThread==='unstarted'?'Choose New chat to send a message.':!this.runner.enabled?'Runner unavailable':this.busy()?'Working · you can draft your next message':'Enter to send · Shift + Enter for a new line'}</span><button type="button" data-activity>Watch activity</button>${chat?`<a href="${esc(chat.url)}">Open in Codex</a>`:''}</div><p role="status">${esc(this.status||'')}</p></form></div></div>`;
    this.usage.mount(this.dialog.querySelector('[data-chat-usage]'));
    this.models.mount(this.dialog.querySelector('[data-chat-model]'),this.project,target);
    this.models.load(this.project,[...threads.map(t=>validThread(t.id)?t.id:null),target],runs.map(r=>[r.id,r.status,r.finishedAt]));
    this.resizeInput();this.updateSend();
    if(renameFocused){const input=this.dialog.querySelector('[name=chatTitle]');if(input&&!input.readOnly){input.focus();input.setSelectionRange(...renameSelection);}}
    const nextScroller=this.dialog.querySelector('.chat-messages');nextScroller.scrollTop=atBottom?nextScroller.scrollHeight:scrollTop||0;
    const nextField=this.dialog.querySelector('[name=instruction]');if(focused){nextField.focus();nextField.setSelectionRange(...selection);}
  }
}
