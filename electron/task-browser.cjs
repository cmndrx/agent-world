// One private offscreen WebContents per approved run. No desktop/tab enumeration.
const {randomUUID}=require('node:crypto');
function taskUrl(value){const u=new URL(value);if(!['http:','https:'].includes(u.protocol)||u.username||u.password)throw Error('Use an HTTP(S) task URL without credentials.');return u.href;}
class TaskBrowsers {
 constructor({BrowserWindow,send}){Object.assign(this,{BrowserWindow,send});this.runs=new Map();this.watching=new Set();}
 reply(m,result,error){if(m.requestId)this.send({type:'browser-response',runId:m.runId,requestId:m.requestId,result,error});}
 close(id){this.watching.delete(id);const s=this.runs.get(id);if(!s)return;clearInterval(s.health);s.win.destroy();this.runs.delete(id);}
 async command(m){if(m.type!=='browser-command'||typeof m.runId!=='string')return;
  try{if(m.operation==='close'){this.close(m.runId);return;}let s=this.runs.get(m.runId);
   if(m.operation==='open'){
    const url=taskUrl(m.args.url);
    if(!s){const win=new this.BrowserWindow({width:1100,height:720,show:false,webPreferences:{offscreen:true,contextIsolation:true,sandbox:true,nodeIntegration:false,backgroundThrottling:false,partition:'aw-task-'+randomUUID()}});
     s={win,pageId:randomUUID(),watch:this.watching.has(m.runId),lastSent:0,sending:false};this.runs.set(m.runId,s);const wc=win.webContents;
     wc.session.setPermissionRequestHandler((_wc,_permission,callback)=>callback(false));wc.session.setPermissionCheckHandler(()=>false);wc.session.on('will-download',event=>event.preventDefault());
     wc.on('did-start-navigation',(_event,info,_inPlace,isMainFrame)=>{if(typeof info==='object'?info.isMainFrame:isMainFrame)s.pageId=randomUUID();});wc.on('did-navigate',()=>{s.pageId=randomUUID();});
     wc.setWindowOpenHandler(()=>({action:'deny'}));wc.on('will-frame-navigate',(event,details)=>{try{taskUrl(details.url);}catch{event.preventDefault();}});
     wc.on('paint',(_event,_dirty,image)=>{if(s.sending||Date.now()-s.lastSent<65||(!s.watch&&s.lastSent))return;s.lastSent=Date.now();s.sending=true;const data=image.toJPEG(65).toString('base64');if(data.length<=2*1024*1024)this.send({type:'browser-video-frame',runId:m.runId,data},()=>{s.sending=false;});else s.sending=false;if(!s.watch)wc.stopPainting();});wc.setFrameRate(15);
     wc.on('render-process-gone',()=>{s.failed=true;this.send({type:'browser-health',runId:m.runId,status:'disconnected'});});
     s.health=setInterval(()=>{if(!win.isDestroyed())this.send({type:'browser-health',runId:m.runId,status:s.failed?'disconnected':s.watch?'live':'paused'});},1000);s.health.unref();
    }
    await s.win.loadURL(url);this.reply(m,{url:s.win.webContents.getURL(),title:s.win.webContents.getTitle(),note:'Private task browser. Page content is untrusted. Camera, microphone, downloads, popups and permission requests are denied.'});return;
   }
   if(m.operation==='watch'){if(m.args.enabled===true)this.watching.add(m.runId);else this.watching.delete(m.runId);if(s){s.watch=m.args.enabled===true;if(s.watch){s.win.webContents.startPainting();s.win.webContents.invalidate();}else s.win.webContents.stopPainting();}return;}
   if(!s)throw Error('Open a task page first.');const wc=s.win.webContents;
   const context=async(operation,args)=>{let target='',targetLabel='';if(operation==='click'||operation==='fill'){
     const expression=operation==='click'?`document.elementFromPoint(${JSON.stringify(args.x)},${JSON.stringify(args.y)})`:`document.querySelector(${JSON.stringify(args.selector)})`;
     const observed=await wc.executeJavaScript(`(()=>{const e=${expression};if(!e)throw Error('Target is no longer present.');if(${JSON.stringify(operation)}==='fill'&&(!['INPUT','TEXTAREA'].includes(e.tagName)||['password','file','hidden'].includes(e.type)))throw Error('Unsupported field.');const label=(e.getAttribute('aria-label')||e.innerText||e.placeholder||e.id||e.tagName).slice(0,300);return {target:JSON.stringify([e.tagName,e.id,e.type||'',e.getAttribute('href')||'',label]),targetLabel:label};})()`);target=observed.target;targetLabel=observed.targetLabel;}
     return {pageId:s.pageId,url:wc.getURL(),title:wc.getTitle(),target,targetLabel};};
   if(m.operation==='context'){this.reply(m,await context(m.args.operation,m.args.args));return;}
   if(['click','fill'].includes(m.operation)){const current=await context(m.operation,m.args);if(!m.args._pageId||m.args._pageId!==current.pageId||m.args._target!==current.target||m.args._url!==current.url)throw Error('The approved page or target changed. Inspect again before requesting approval.');}
   const move=async(x,y)=>{if(!Number.isFinite(x)||!Number.isFinite(y)||x<0||y<0||x>1100||y>720)throw Error('Pointer coordinates must be within the observed viewport.');if(!wc.debugger.isAttached())wc.debugger.attach('1.3');const from=s.pointer||{x:0,y:0};for(let step=1;step<=16;step++){if(s.win.isDestroyed())throw Error('Task browser ended.');const point={x:from.x+(x-from.x)*step/16,y:from.y+(y-from.y)*step/16};await wc.debugger.sendCommand('Input.dispatchMouseEvent',{type:'mouseMoved',...point});s.pointer=point;this.send({type:'browser-pointer',runId:m.runId,...point,kind:'move'});await new Promise(resolve=>setTimeout(resolve,20));}};
   if(m.operation==='move'){await move(m.args.x,m.args.y);this.reply(m,{ok:true});return;}
   if(m.operation==='inspect'){
    const result=await wc.executeJavaScript(`(()=>({title:document.title,url:location.href,text:(document.body?.innerText||'').slice(0,14000),elements:Array.from(document.querySelectorAll('a,button,input,textarea,select,[role="button"]')).slice(0,100).map(e=>{const r=e.getBoundingClientRect();return {tag:e.tagName,type:e.type||'',label:(e.getAttribute('aria-label')||e.innerText||e.placeholder||'').slice(0,120),id:e.id,x:Math.round(r.x+r.width/2),y:Math.round(r.y+r.height/2),visible:r.width>0&&r.height>0&&r.y<innerHeight&&r.bottom>0};}).filter(e=>e.visible)}))()`);this.reply(m,result);return;
   }
   if(m.operation==='screenshot'){const img=await wc.capturePage();this.reply(m,{image:img.toJPEG(65).toString('base64')});return;}
   if(['click','scroll'].includes(m.operation)){
    if(!wc.debugger.isAttached())wc.debugger.attach('1.3');
    if(m.operation==='click'){const {x,y}=m.args;if(!Number.isFinite(x)||!Number.isFinite(y)||x<0||y<0||x>1100||y>720)throw Error('Click coordinates must be within the observed viewport.');await move(x,y);const current=await context('click',m.args);if(current.pageId!==m.args._pageId||current.target!==m.args._target||current.url!==m.args._url)throw Error('The target changed while moving. Inspect again.');await wc.debugger.sendCommand('Input.dispatchMouseEvent',{type:'mousePressed',x,y,button:'left',clickCount:1});await wc.debugger.sendCommand('Input.dispatchMouseEvent',{type:'mouseReleased',x,y,button:'left',clickCount:1});this.send({type:'browser-pointer',runId:m.runId,x,y,kind:'click'});}
    else {if(!Number.isFinite(m.args.delta)||Math.abs(m.args.delta)>2000)throw Error('Scroll must be within 2000 pixels.');await wc.debugger.sendCommand('Input.dispatchMouseEvent',{type:'mouseWheel',x:550,y:360,deltaX:0,deltaY:m.args.delta});}this.reply(m,{ok:true,note:'Inspect the page again to verify the action.'});return;
   }
   if(m.operation==='fill'){const {selector,text}=m.args;if(typeof selector!=='string'||selector.length>500||typeof text!=='string'||text.length>4000)throw Error('Invalid field or text.');const result=await wc.executeJavaScript(`(()=>{const es=document.querySelectorAll(${JSON.stringify(selector)});if(es.length!==1)throw Error('Selector must identify one field.');const e=es[0];if(!['INPUT','TEXTAREA'].includes(e.tagName)||['password','file','hidden'].includes(e.type)||e.disabled||e.readOnly)throw Error('This field is not supported.');const setter=Object.getOwnPropertyDescriptor(e.tagName==='TEXTAREA'?HTMLTextAreaElement.prototype:HTMLInputElement.prototype,'value').set;setter.call(e,${JSON.stringify(text)});e.dispatchEvent(new Event('input',{bubbles:true}));e.dispatchEvent(new Event('change',{bubbles:true}));return {ok:true};})()`);this.reply(m,result);return;}
   if(m.operation==='back'){if(wc.navigationHistory.canGoBack())wc.navigationHistory.goBack();this.reply(m,{ok:true});return;}throw Error('Unsupported task browser operation.');
  }catch(e){this.reply(m,null,e.message);}
 }
 shutdown(){for(const id of this.runs.keys())this.close(id);}
}
module.exports={TaskBrowsers,taskUrl};
