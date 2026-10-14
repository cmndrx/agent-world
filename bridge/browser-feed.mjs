// Ephemeral frames only: never persist browser pixels into canonical agent events.
export const browserFeedInstruction = `Browser viewing: only if this approved task requires browser work and cua_repl is available, open one dedicated task tab using a standalone call: let awBrowserTab = await cua.createBrowserTab("chrome", "TASK_URL", {sessionName:"Agent World task"}); Use that tab for this task; never assign it another tab or app. After meaningful browser actions, emit a viewport image in a separate tool call containing exactly: await awBrowserTab.getScreenshot(); Do not capture unrelated tabs, native apps, credentials or permission screens. Do not open a browser just to populate the viewer or continuously poll screenshots. The game displays tool-emitted images, not video.`;
export class BrowserFeed {
  constructor(){this.runs=new Map();}
  consume(runId,event,now=Date.now()){
    const item=event.item;
    if(event.type!=='item.completed'||item?.type!=='mcp_tool_call'||item.server!=='cua_repl'||item.tool!=='js')return false;
    const code=item.arguments?.code;
    if(typeof code!=='string')return false;
    let state=this.runs.get(runId);
    if(!state){state={bound:false,blocked:false,sequence:0};this.runs.set(runId,state);while(this.runs.size>8)this.runs.delete(this.runs.keys().next().value);}
    const create=/^\s*(?:let|const|var) awBrowserTab = await cua\.createBrowserTab\("chrome", "https?:\/\/[^"\n]+", \{sessionName:"Agent World task"\}\);?\s*$/;
    if(create.test(code)&&!state.bound&&!state.blocked&&!item.error&&!item.result?.isError){state.bound=true;return false;}
    if(code.includes('awBrowserTab')&&!/^\s*await awBrowserTab\.getScreenshot\(\);?\s*$/.test(code)){
      // Tab operations are fine; rebinding or ambiguous aliasing is not.
      if(/(?:=|getApp|getTab|createBrowserTab|\bfunction\b|=>)/.test(code)){state.blocked=true;state.frame=null;}
      return false;
    }
    if(!state.bound||state.blocked||item.error||item.result?.isError||!/^\s*await awBrowserTab\.getScreenshot\(\);?\s*$/.test(code))return false;
    const images=(item.result?.content||[]).filter(b=>b.type==='image');
    if(images.length!==1)return false;
    const b=images[0];if(!['image/png','image/jpeg','image/webp'].includes(b.mimeType)||typeof b.data!=='string'||b.data.length>2*1024*1024||!/^[A-Za-z0-9+/]+={0,2}$/.test(b.data))return false;
    state.frame={mimeType:b.mimeType,data:b.data,capturedAt:now,sequence:++state.sequence};return true;
  }
  view(run){const state=this.runs.get(run.id),frame=state?.frame;return {runId:run.id,status:run.status,capture:state?.blocked?'unavailable':frame?'available':'waiting',sequence:frame?.sequence||0,capturedAt:frame?.capturedAt||null,source:(run.provider==='claude'?'Claude':'Codex')+' task browser',ephemeral:true};}
  frame(id){return this.runs.get(id)?.frame;}
}
