import { webcrypto } from 'node:crypto';
import test from 'node:test';
import assert from 'node:assert/strict';
import { InterestsDialog, InterestsEditor, interestsDialogFor, interestsSummary, interestStatus, menuPosition } from '../web/src/interests.js';
import { assignedRole } from '../shared/team.mjs';
import { plumbobFor } from '../shared/schema.mjs';
import fs from 'node:fs';
// Node 18 does not expose browser Web Crypto globally without a flag.
if (!globalThis.crypto) globalThis.crypto = webcrypto;
const source = fs.readFileSync(new URL('../web/src/sim.js', import.meta.url),'utf8');
const start=source.indexOf('  updateLabel() {')+'  updateLabel() {'.length;
const end=source.indexOf('\n  }',start);
const updateLabel = new Function('assignedRole','plumbobFor','escapeHtml','icon','STATE_ICON','canPromptFromStatus', 'return function(){'+source.slice(start,end)+'}') (assignedRole,plumbobFor,s=>String(s),()=>'',{},()=>false);

test('selected label details yield to urgent observed state, far zoom and explicit suppression', () => {
  const sim=Object.assign({updateLabel,statusText(){return this.state},get state(){return this.truth?.state || 'off_duty'},get name(){return this.character.name}}, {character:{name:'Test',assignedRole:'software_developer', happiness:63}, truth:null, walking:false, selected:true,labelMode:'full', bubbleEl:{style:{}},labelHtml:'',residentLevel:3});
  sim.updateLabel(); assert.match(sim.labelHtml,/Software Developer/);assert.match(sim.labelHtml,/Lv 3/);
  assert.doesNotMatch(sim.labelHtml,/Happiness|63/, 'retired happiness never shows');
  sim.truth={state:'waiting_for_user'};sim.updateLabel();assert.doesNotMatch(sim.labelHtml,/b-resident-detail/);
  sim.truth={state:'error'};sim.updateLabel();assert.doesNotMatch(sim.labelHtml,/b-resident-detail/);
  sim.truth=null;sim.detailSuppressed=true;sim.updateLabel();assert.doesNotMatch(sim.labelHtml,/b-resident-detail/);
  sim.detailSuppressed=false;sim.labelMode='compact';sim.updateLabel();assert.doesNotMatch(sim.labelHtml,/b-resident-detail/);
});

test('interest status: met or wanted from the home needs, locked venues and home interests explained', () => {
  const c={id:'rosa',name:'Rosa',interestIds:['park_walks','arcade_games','reading']};
  const sat={needs:[{kind:'interest',residentId:'rosa',interest:'park_walks',level:'good',hint:'Rosa enjoys park walks nearby'}]};
  assert.deepEqual(interestStatus(c,'park_walks',sat),{state:'met',text:'Rosa enjoys park walks nearby'});
  assert.equal(interestStatus(c,'arcade_games',sat).state,'locked');
  assert.match(interestStatus(c,'arcade_games',sat).text,/arcade/);
  assert.deepEqual(interestStatus(c,'reading',sat),{state:'home',text:'Enjoyed at home'});
  const wanted={needs:[{kind:'interest',residentId:'rosa',interest:'arcade_games',level:'bad',hint:'Rosa wants an arcade nearby'}]};
  assert.deepEqual(interestStatus(c,'arcade_games',wanted),{state:'wanted',text:'Rosa wants an arcade nearby'});
  // Another resident's need never answers for this one.
  assert.equal(interestStatus({id:'eli'},'park_walks',sat).state,'locked');
});

test('interests summary is labelled as town simulation, escapes labels and handles empty or missing data', () => {
  assert.equal(interestsSummary(null), '');
  assert.match(interestsSummary({id:'a',interestIds:[]}), /No interests yet/);
  const html=interestsSummary({id:'a',interestIds:['reading','<b>x</b>']}, null);
  assert.match(html,/town simulation/);assert.match(html,/data-interest-state="home"/);
  assert.doesNotMatch(html,/<b>x<\/b>/);assert.match(html,/&lt;b&gt;x&lt;\/b&gt;/);
});

test('interest editor saves one to three choices with the preference revision and keeps the form on failure', async () => {
  const nodes=new Map();
  const status={textContent:''},submit={disabled:false};
  const root={addEventListener(){},querySelector(s){return s==='form'?{}:s==='.interests-message'?status:s==='button[type=submit]'?submit:null},querySelectorAll(){return []}};
  const sim={lot:{project:'fixture'},character:{id:'rosa',interestIds:['reading'],interestPreferences:{revision:2}}};
  const editor=Object.assign(Object.create(InterestsEditor.prototype),{root,sim,sending:false,connected:true,syncedFor:JSON.stringify(['reading'])});
  const originalFetch=globalThis.fetch;let sent;
  try {
    globalThis.fetch=async(url,init)=>{sent={url,body:JSON.parse(init.body)};return {ok:true,json:async()=>({character:{...sim.character,interestIds:['movies'],interestPreferences:{revision:3}}})};};
    let saved=0;editor.onSaved=()=>saved++;
    await editor.save(['movies']);
    assert.equal(sent.url,'/api/care-preferences');assert.equal(sent.body.revision,2);assert.deepEqual(sent.body.interestIds,['movies']);assert.equal(sent.body.action,'interests');
    assert.deepEqual(sim.character.interestIds,['movies']);assert.equal(saved,1);assert.equal(status.textContent,'Interests saved.');
    globalThis.fetch=async()=>({ok:false,json:async()=>({error:'Choose one to 3 supported interests.'})});
    await editor.save([]);assert.equal(status.textContent,'Choose one to 3 supported interests.');assert.deepEqual(sim.character.interestIds,['movies']);
  } finally { globalThis.fetch=originalFetch; }
});

test('interests menu presents only, retains its editor across reopen, and returns to the refreshed trigger', () => {
  const originalDocument=globalThis.document,originalRender=InterestsEditor.prototype.render;
  const nodes=new Map();let focus,opens=0;
  const events=new Map();
  const node=selector=>{if(!nodes.has(selector))nodes.set(selector,{addEventListener(){},focus(){focus=selector;}});return nodes.get(selector)};
  const dialog={open:false,style:{},offsetWidth:360,offsetHeight:500,setAttribute(k,v){this[k]=v},querySelector:node,addEventListener(k,fn){events.set(k,fn)},matches(){return this.open},showPopover(){this.open=true;opens++},hidePopover(){this.open=false;events.get('toggle')({newState:'closed'});}};
  globalThis.document={createElement:()=>dialog,body:{append(){}}};
  InterestsEditor.prototype.render=function(connected){this.connected=connected;};
  const sim={name:'Long Resident',lot:{project:'isolated-modal',satisfaction:null},character:{id:'modal-resident',interestIds:['reading']}};
  let controller;
  try {
    controller=interestsDialogFor(sim);assert.ok(controller instanceof InterestsDialog);
    const editor=controller.editor;editor.unsavedFixture='retained';
    const trigger={isConnected:true,setAttribute(){},closest(){return null},getBoundingClientRect(){return {left:900,right:1260,top:300}},focus(){focus='current Interests trigger'}};
    globalThis.innerWidth=1280;globalThis.innerHeight=800;
    controller.open(true,()=>trigger);
    assert.equal(opens,1);assert.equal(focus,'[data-interests-close]');
    assert.equal(node('h2').textContent,'Interests for Long Resident');
    assert.match(node('[data-interests-context]').innerHTML,/Enjoyed at home/);
    controller.update(false);assert.match(node('[data-interests-context]').innerHTML,/disconnected/);
    assert.equal(dialog.popover,'auto');assert.equal(dialog['aria-modal'],'false');assert.equal(dialog.style.left,'580px');
    controller.close();assert.equal(focus,'current Interests trigger');
    assert.equal(interestsDialogFor(sim),controller);
    controller.open(true,()=>trigger);assert.equal(controller.editor,editor);assert.equal(editor.unsavedFixture,'retained');
    controller.close();assert.equal(opens,2);
  } finally {InterestsEditor.prototype.render=originalRender;globalThis.document=originalDocument;}
});

test('interests menu geometry overlaps the card and stays within narrow and short viewports', () => {
  const desktop=menuPosition({left:900,right:1260},{top:320},360,500,1280,800);
  assert.deepEqual(desktop,{left:580,top:288});
  for (const [w,h] of [[367,700],[1280,400],[184,350]]) {
    const mw=Math.min(360,w-24),mh=Math.min(620,h-24);
    const pos=menuPosition({left:12,right:w-12},{top:h-30},mw,mh,w,h);
    assert.ok(pos.left>=12 && pos.left+mw<=w-12);assert.ok(pos.top>=12 && pos.top+mh<=h-12);
  }
});
