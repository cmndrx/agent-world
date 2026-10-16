import { CARE_ACTIONS } from '../shared/care.mjs';
import { webcrypto } from 'node:crypto';
import test from 'node:test';
import assert from 'node:assert/strict';
import { CarePanel, CareDialog, careDialogFor, careSummary, careMenuPosition } from '../web/src/care.js';
import { CareFeedback } from '../web/src/care-feedback.js';
import { assignedRole } from '../shared/team.mjs';
import { plumbobFor } from '../shared/schema.mjs';
import fs from 'node:fs';
// Node 18 does not expose browser Web Crypto globally without a flag.
if (!globalThis.crypto) globalThis.crypto = webcrypto;
const source = fs.readFileSync(new URL('../web/src/sim.js', import.meta.url),'utf8');
const start=source.indexOf('  updateLabel() {')+'  updateLabel() {'.length;
const end=source.indexOf('\n  }',start);
const updateLabel = new Function('assignedRole','plumbobFor','escapeHtml','icon','STATE_ICON','canPromptFromStatus', 'return function(){'+source.slice(start,end)+'}') (assignedRole,plumbobFor,s=>String(s),()=>'',{},()=>false);
function panel() {
  const nodes = new Map();
  const root = { querySelector(selector) { if (!nodes.has(selector)) nodes.set(selector, { textContent:'', disabled:false }); return nodes.get(selector); }, set innerHTML(_) { throw Error('Mounted form must survive updates'); } };
  const c = { happiness:50, interestIds:['snacks','reading'], care:{ revision:1, cooldowns:{}, pending:null, history:[] } };
  const p = Object.assign(Object.create(CarePanel.prototype), { root, sim:{ character:c, state:'idle', truth:null, lot:{project:'fixture'} }, options:{}, optionsAt:Infinity, revision:1, orderedInterests:c.interestIds.join(','), sending:false });
  return {p,c,node:s=>root.querySelector(s)};
}
test('summary keeps missing care unknown, simulation explicit, bullet interests and bounded semantic meter', () => {
  assert.match(careSummary(null), /unavailable/);
  const {c}=panel(); const html=careSummary(c);
  assert.match(html,/Happiness &middot; simulated/); assert.match(html,/Snacks &bull; Reading/); assert.match(html,/value="50"/);
});
test('care rows show matching gains, disabled reasons, cap and stable mounted editor', () => {
  const {p,c,node}=panel(); p.render(true);
  assert.equal(node('[data-care-gain="snack"]').textContent,'+5 happiness');
  assert.equal(node('[data-care-reason="snack"]').textContent,'Matches Snacks \u00b7 10 seconds');
  c.happiness=100; c.care.revision++; p.render(true);
  assert.equal(node('[data-care-gain="snack"]').textContent,'Up to +5 happiness');
  assert.equal(node('[data-care-reason="snack"]').textContent,'Already at 100/100');
  c.care.cooldowns.snack=Date.now()+24000; p.render(true);
  assert.match(node('[data-care-reason="snack"]').textContent,/Ready in/);
  assert.equal(node('[data-care-action="snack"]').disabled,true);
  c.interestIds=['snacks']; p.orderedInterests=c.interestIds.join(','); p.render(true);
  assert.equal(node('[data-care-reason="read"]').textContent,'Requires matching interest');
  c.interestIds=['reading']; p.orderedInterests=c.interestIds.join(','); p.sim.truth={}; p.sim.state='running'; p.render(true);
  assert.equal(node('[data-care-reason="read"]').textContent,'Available when agent is idle');
  p.render(false); assert.equal(node('[data-care-reason="read"]').textContent,'Care unavailable while disconnected');
});
test('pending reading disables care, permits cancellation and announces completion only once', () => {
  const {p,c,node}=panel(); c.care.pending={readyAt:Date.now()+7000}; p.render(true);
  assert.equal(node('[data-care-action="praise"]').disabled,true);
  assert.equal(node('[data-care-action=cancel]').hidden,false);
  assert.equal(node('[data-care-action=cancel]').disabled,false);
  assert.match(node('.care-pending').textContent,/remaining/);
  c.care.pending=null; c.care.history=[{action:'read',delta:5}]; p.render(true);
  assert.match(node('.care-message').textContent,/completed/);
  node('.care-message').textContent='retained'; p.render(true); assert.equal(node('.care-message').textContent,'retained');
  p.sending=true;p.render(true);assert.equal(node('[data-care-reason="praise"]').textContent,'Request underway');
});
test('selected label details yield to urgent observed state, far zoom and explicit suppression', () => {
  const sim=Object.assign({updateLabel,statusText(){return this.state},get state(){return this.truth?.state || 'off_duty'},get name(){return this.character.name}}, {character:{name:'Test',assignedRole:'software_developer', happiness:63,care:{}}, truth:null, walking:false, selected:true,labelMode:'full', bubbleEl:{style:{}},labelHtml:'',residentLevel:3});
  sim.updateLabel(); assert.match(sim.labelHtml,/Software Developer/);assert.match(sim.labelHtml,/Lv 3/);assert.match(sim.labelHtml,/simulated/);
  sim.truth={state:'waiting_for_user'};sim.updateLabel();assert.doesNotMatch(sim.labelHtml,/b-resident-detail/);
  sim.truth={state:'error'};sim.updateLabel();assert.doesNotMatch(sim.labelHtml,/b-resident-detail/);
  sim.truth=null;sim.detailSuppressed=true;sim.updateLabel();assert.doesNotMatch(sim.labelHtml,/b-resident-detail/);
  sim.detailSuppressed=false;sim.labelMode='compact';sim.updateLabel();assert.doesNotMatch(sim.labelHtml,/b-resident-detail/);
});

test('row ordering favors available matches and freezes through cooldown ticks', () => {
  const {p,c}=panel(); const order=[];
  const rows=new Map(Object.keys(CARE_ACTIONS).map(id=>[id,{id}]));
  const area={querySelector:selector=>rows.get(selector.match(/"(.*?)"/)[1]),querySelectorAll:()=>[],append:row=>order.push(row.id)};
  p.root.querySelector=()=>area;
  p.orderRows(c);assert.deepEqual(order.filter(id=>c.interestIds.includes(CARE_ACTIONS[id].interest)),['snack','read']);
  order.length=0;c.care.cooldowns.snack=Date.now()+30000;p.orderRows(c);assert.deepEqual(order.filter(id=>c.interestIds.includes(CARE_ACTIONS[id].interest)),['read','snack']);
});
test('care request errors remain inline without changing character or mounted form', async () => {
  const {p,c,node}=panel();p.connected=true;p.sim.lot={project:'isolated-fixture'};c.id='fixture';
  const original=globalThis.fetch;globalThis.fetch=async()=>({ok:false,json:async()=>({error:'Fixture conflict'})});
  try {await p.send('praise');assert.equal(node('.care-message').textContent,'Fixture conflict');assert.equal(c.happiness,50);assert.equal(p.sending,false);}finally{globalThis.fetch=original;}
});
test('scene errors and non-reward endings stay visible; capped completion reports its actual delta',()=>{
  const {p,c,node}=panel();p.sim.careError='Care station is no longer available.';p.render(true);
  assert.match(node('.care-message').textContent,/no longer available/);
  p.sim.careError=null;p.hadPending=true;c.care.history=[{label:'Care interrupted by agent activity',delta:0}];p.render(true);
  assert.match(node('.care-message').textContent,/interrupted/);
  p.hadPending=true;c.happiness=100;c.care.history=[{action:'read',delta:0}];p.render(true);
  assert.match(node('.care-message').textContent,/completed.*\+0 happiness \(100\/100\)/);
});

test('temporary missing care preserves mounted editor and blocks stale actions until data returns', async () => {
  const {p,c,node}=panel();p.root.dataset={};
  p.root.querySelectorAll=()=>[node('[data-care-action="praise"]')];
  p.sim.character={};p.render(true);
  assert.equal(node('[data-care-action="praise"]').disabled,true);
  assert.match(node('.care-message').textContent,/unavailable/);
  const original=globalThis.fetch;globalThis.fetch=()=>{throw Error('No request allowed')};
  try{await p.send('praise');}finally{globalThis.fetch=original;}
  p.sim.character=c;p.render(true);
  assert.equal(node('[data-care-action="praise"]').disabled,true);
  assert.equal(node('.care-message').textContent,'');
});

test('care menu presents only, retains its editor across reopen, and returns to the refreshed trigger', () => {
  const originalDocument=globalThis.document,originalRender=CarePanel.prototype.render;
  const nodes=new Map();let focus,opens=0;
  const events=new Map();
  const node=selector=>{if(!nodes.has(selector))nodes.set(selector,{addEventListener(){},focus(){focus=selector;}});return nodes.get(selector)};
  const dialog={open:false,style:{},offsetWidth:360,offsetHeight:500,setAttribute(k,v){this[k]=v},querySelector:node,addEventListener(k,fn){events.set(k,fn)},matches(){return this.open},showPopover(){this.open=true;opens++},hidePopover(){this.open=false;events.get('toggle')({newState:'closed'});}};
  globalThis.document={createElement:()=>dialog,body:{append(){}}};
  CarePanel.prototype.render=function(connected){this.connected=connected;};
  const sim={name:'Long Resident',lot:{project:'isolated-modal'},character:{id:'modal-resident',happiness:50,interestIds:['reading'],care:{pending:{readyAt:Date.now()+5000}}}};
  let controller;
  try {
    controller=careDialogFor(sim);assert.ok(controller instanceof CareDialog);
    const editor=controller.panel;editor.unsavedFixture='retained';
    const trigger={isConnected:true,setAttribute(){},closest(){return null},getBoundingClientRect(){return {left:900,right:1260,top:300}},focus(){focus='current Care trigger'}};
    globalThis.innerWidth=1280;globalThis.innerHeight=800;
    controller.open(true,()=>trigger);
    assert.equal(opens,1);assert.equal(focus,'[data-care-close]');
    assert.equal(node('h2').textContent,'Care for Long Resident');
    assert.match(node('[data-care-context]').innerHTML,/remaining/);
    controller.update(false);assert.match(node('[data-care-context]').innerHTML,/disconnected/);
    assert.equal(dialog.popover,'auto');assert.equal(dialog['aria-modal'],'false');assert.equal(dialog.style.left,'580px');
    controller.close();assert.equal(focus,'current Care trigger');assert.ok(sim.character.care.pending);
    assert.equal(careDialogFor(sim),controller);
    controller.open(true,()=>trigger);assert.equal(controller.panel,editor);assert.equal(editor.unsavedFixture,'retained');
    controller.close();assert.equal(opens,2);
  } finally {clearInterval(controller?.timer);CarePanel.prototype.render=originalRender;globalThis.document=originalDocument;}
});
test('care menu geometry overlaps the card and stays within narrow and short viewports', () => {
  const desktop=careMenuPosition({left:900,right:1260},{top:320},360,500,1280,800);
  assert.deepEqual(desktop,{left:580,top:288});
  for (const [w,h] of [[367,700],[1280,400],[184,350]]) {
    const mw=Math.min(360,w-24),mh=Math.min(620,h-24);
    const pos=careMenuPosition({left:12,right:w-12},{top:h-30},mw,mh,w,h);
    assert.ok(pos.left>=12 && pos.left+mw<=w-12);assert.ok(pos.top>=12 && pos.top+mh<=h-12);
  }
});
test('only newly confirmed fulfilled care celebrates, including cap, never replay or cancelled reading', () => {
  const record=(id,action,delta=0)=>({id,action,delta});
  const character=history=>({care:{history}});
  const feedback=new CareFeedback(character([record('old','snack')]));
  assert.equal(feedback.receive(character([record('old','snack')])),false);
  assert.equal(feedback.receive(character([record('new','praise',0)])),true);
  assert.equal(feedback.receive(character([record('new','praise',0)])),false);
  assert.equal(feedback.receive({care:{pending:{id:'reading'},history:[]}}),false);
  assert.equal(feedback.receive(character([{id:'reading',label:'Reading interrupted by agent activity',delta:0}])),false);
  assert.equal(feedback.receive(character([record('completed','read',5)])),true);
  assert.equal(feedback.receive(character([record('offline','read',5)]),true),false);
  assert.equal(feedback.receive(character([record('offline','read',5)])),false);
  assert.equal(feedback.receive(character([{id:'edit',label:'Interests changed',delta:0}])),false);
});
test('accepted care closes menu; rejected requests and interest edits leave it open', async () => {
  const {p,c}=panel();p.connected=true;p.sim.lot={project:'isolated-menu'};c.id='fixture';
  let closed=0,received=0;p.onApplied=()=>closed++;p.sim.receiveCare=()=>received++;
  const original=globalThis.fetch;
  try {
    globalThis.fetch=async()=>({ok:true,json:async()=>({character:c})});
    await p.send('snack');assert.equal(closed,1);assert.equal(received,1);
    await p.send('read');assert.equal(closed,2);
    p.orderRows=()=>{};await p.send('interests',['reading']);assert.equal(closed,2);
    await p.send('cancel');assert.equal(closed,2);
    globalThis.fetch=async()=>({ok:false,json:async()=>({error:'Cooldown'})});
    await p.send('praise');assert.equal(closed,2);
  }finally{globalThis.fetch=original;}
});
test('care cheer respects work and reduced motion without changing truth or XP', () => {
  const start=source.indexOf('  receiveCare(character, replay = false) {')+'  receiveCare(character, replay = false) {'.length;
  const end=source.indexOf('\n  }',start);
  let reduced=false;
  const receiveCare=new Function('matchMedia','performance','return function(character,replay=false){'+source.slice(start,end)+'}')(()=>({matches:reduced}),{now:()=>1000});
  const sim={careFeedback:{receive:()=>true},truth:null,state:'off_duty'};
  receiveCare.call(sim,{});assert.equal(sim.careCheerUntil,2.8);assert.equal(sim.popT,0);assert.equal(sim.truth,null);
  const busy={careFeedback:sim.careFeedback,truth:{state:'running'},state:'running'};
  receiveCare.call(busy,{});assert.equal(busy.careCheerUntil,undefined);assert.equal(busy.popT,undefined);
  reduced=true;const calm={careFeedback:sim.careFeedback,truth:null};receiveCare.call(calm,{});assert.equal(calm.careCheerUntil,undefined);assert.equal(calm.careReceivedUntil,2.8);
});
