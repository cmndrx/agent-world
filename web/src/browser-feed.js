import {icon} from './icons.js';

// Screen-only viewer for an agent's task browser. Used in the prompter and the agent drawer.
// Collapsed to its icon button until a real frame arrives, then opens unless the viewer chose otherwise.
// Details live in tooltips, not text.
export class BrowserFeedPanel {
  setHidden(hidden,resume=true){
    this.hidden=hidden;
    const screen=this.host?.querySelector('[data-browser-screen]');
    if(!screen)return;
    screen.hidden=hidden;this.host.classList.toggle('browser-hidden',hidden);
    for(const button of this.host.querySelectorAll('[data-browser-toggle]'))button.setAttribute('aria-expanded',String(!hidden));
    if(hidden){this.pointerEvents?.close();this.pointerEvents=null;this.host.querySelector('.agent-pointer').hidden=true;this.host.querySelector('img').removeAttribute('src');this.pauseViewer?.();}
    else if(resume)this.resume?.();
  }
  stop(){this.pointerEvents?.close();this.pointerEvents=null;this.host?.querySelector('img')?.removeAttribute('src');this.host?.classList.remove('browser-feed-host','has-frame','browser-hidden');this.host?.replaceChildren();this.host=null;this.runId=null;this.pauseViewer=null;this.resume=null;clearTimeout(this.timer);this.controller?.abort();this.generation=(this.generation||0)+1;}
  mount(host,run){
    this.stop();if(!host||!run)return;
    this.host=host;this.runId=run.id;
    const generation=this.generation;
    host.classList.add('browser-feed-host');
    host.innerHTML=`<div data-browser-approval aria-live="polite"></div><div class="browser-screen" data-browser-screen><div class="browser-viewport"><img hidden alt="Agent task browser screen"><span class="agent-pointer" hidden aria-hidden="true"><svg viewBox="0 0 26 30"><path d="M2 2V23L8 17L13 27L18 24L13 15H23Z"/></svg><i></i></span><span class="browser-empty">${icon('globe')}<span>No browser activity yet</span></span><span class="browser-badge" data-browser-status role="status"><i></i><span></span></span><button type="button" class="browser-toggle" data-browser-toggle aria-label="Hide browser" title="Hide browser">${icon('monitorOff')}</button></div></div><button type="button" class="browser-toggle browser-show" data-browser-toggle aria-label="Show browser" title="Show browser">${icon('monitor')}</button>`;
    const screen=host.querySelector('[data-browser-screen]'),img=host.querySelector('img'),pointer=host.querySelector('.agent-pointer'),viewport=host.querySelector('.browser-viewport'),badge=host.querySelector('[data-browser-status]');
    this.setHidden(this.chosen?this.hidden:true,false);for(const button of host.querySelectorAll('[data-browser-toggle]'))button.onclick=()=>{this.chosen=true;this.setHidden(!this.hidden);};
    // Short visible label; the full explanation is the tooltip.
    const setStatus=(label,tone,detail=label)=>{badge.querySelector('span').textContent=label;badge.dataset.tone=tone;badge.title=detail;};
    const query=new URLSearchParams({run:run.id,project:run.project,slot:String(run.slot)});let sequence=0,streaming=false;
    const pointerStart=()=>{if(this.pointerEvents)return;this.pointerEvents=new EventSource('/api/browser-pointer?'+query);this.pointerEvents.onmessage=event=>{if(generation!==this.generation||this.hidden)return;let p;try{p=JSON.parse(event.data);}catch{return;}const w=Math.min(img.clientWidth,img.clientHeight*1100/720),h=w*720/1100;if(!w||!h)return;pointer.hidden=false;pointer.style.left=((viewport.clientWidth-w)/2+p.x/1100*w)+'px';pointer.style.top=((viewport.clientHeight-h)/2+p.y/720*h)+'px';pointer.classList.toggle('pointer-click',p.kind==='click'&&Date.now()-p.at<1000);};};
    let approvalId=null;
    const renderApproval=a=>{const el=host.querySelector('[data-browser-approval]');if(!a){el.replaceChildren();approvalId=null;return;}if(a.id===approvalId)return;approvalId=a.id;el.innerHTML='<section class="browser-action-approval"><strong>Browser action needs your approval</strong><p data-action></p><small data-page></small><p data-target></p><details><summary>Exact action</summary><pre></pre></details><div><button type="button" data-browser-allow>Allow once</button><button type="button" data-browser-deny>Deny</button></div><p data-approval-error role="status"></p></section>';
     el.querySelector('[data-action]').textContent=a.message;el.querySelector('[data-page]').textContent=a.page;el.querySelector('[data-target]').textContent=a.tool==='click'?'Click '+a.targetLabel+' at '+a.args.x+', '+a.args.y:'Enter text in '+a.targetLabel;el.querySelector('pre').textContent=JSON.stringify({action:a.tool,...a.args},null,2);
     for(const [selector,allow] of [['[data-browser-allow]',true],['[data-browser-deny]',false]])el.querySelector(selector).onclick=async()=>{for(const b of el.querySelectorAll('button'))b.disabled=true;try{const response=await fetch('/api/browser-approval',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({run:run.id,project:run.project,slot:run.slot,approval:a.id,allow})});const result=await response.json();if(!response.ok)throw Error(result.error||'Approval unavailable.');el.replaceChildren();approvalId=null;}catch(e){el.querySelector('[data-approval-error]').textContent=e.message;for(const b of el.querySelectorAll('button'))b.disabled=false;}};
    };
    this.pauseViewer=()=>{this.pointerEvents?.close();this.pointerEvents=null;pointer.hidden=true;img.removeAttribute('src');streaming=false;sequence=0;};
    img.onerror=()=>{streaming=false;setStatus('Reconnecting','warn','Video disconnected · reconnecting…');};
    const refresh=async()=>{
      clearTimeout(this.timer);
      if(generation!==this.generation||!host.isConnected)return;
      this.controller=new AbortController();
      try{
        const response=await fetch('/api/browser-feed?'+query,{signal:this.controller.signal,cache:'no-store'});if(!response.ok)throw Error();const state=await response.json();
        if(generation!==this.generation)return;
        const active=state.status==='running';const video=state.video,videoFrame=video?.sequence>0;const videoLive=videoFrame&&active&&['live','paused'].includes(video.status);const selectedSequence=videoFrame?video.sequence:state.sequence;const age=state.capturedAt?Math.max(0,Math.floor((Date.now()-state.capturedAt)/1000)):0;
        host.classList.toggle('has-frame',Boolean(selectedSequence));
        if(!this.chosen&&this.hidden===Boolean(selectedSequence))this.setHidden(!selectedSequence,false);
        const received=state.capturedAt?` · received ${new Date(state.capturedAt).toLocaleTimeString()} (${age}s ago)`:'';
        if(state.capture==='unavailable')setStatus('Unavailable','warn','Capture unavailable: task tab identity changed.');
        else if(active&&age>15&&!videoLive)setStatus('Stale','warn','Last image · may be stale'+received);
        else if(active)setStatus('Live','live',(videoLive?`Live task browser · ${video.fps} frame updates/s · viewport only`:'Receiving screenshots'+received)+' · view only');
        else setStatus('Ended','idle','Run ended · last browser frame'+received);
        if(video?.status==='disconnected')setStatus('Reconnecting','warn','Video disconnected · last image may be stale.');
        if(!selectedSequence&&state.capture!=='unavailable')setStatus('','idle');
        renderApproval(video?.approval);
        if(video?.approval){if(this.hidden)this.setHidden(false,false);setStatus('Approval needed','warn','Waiting for your browser action approval.');}
        if(this.hidden){img.removeAttribute('src');streaming=false;sequence=0;}
        else if(videoLive){pointerStart();img.hidden=false;if(!streaming){img.src='/api/browser-video?'+query;streaming=true;}sequence=selectedSequence;}
        else if(selectedSequence!==sequence||streaming){this.pointerEvents?.close();this.pointerEvents=null;pointer.hidden=true;sequence=selectedSequence;streaming=false;img.hidden=!sequence;if(sequence)img.src='/api/browser-frame?'+query+'&sequence='+sequence;else img.removeAttribute('src');}
        this.timer=setTimeout(refresh,2000);
      }catch(e){if(generation!==this.generation)return;setStatus('Disconnected','warn','Viewer disconnected · displayed image may be stale.');this.timer=setTimeout(refresh,4000);}
    };
    this.resume=()=>{if(generation===this.generation)refresh();};
    refresh();
  }
}
