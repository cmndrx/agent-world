import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import {projectTeam,assignedRole} from '../shared/team.mjs';
import {mentionSuggestions} from '../shared/mentions.mjs';
const source=fs.readFileSync(new URL('../web/src/pass-card.js',import.meta.url),'utf8');
const doc={activeElement:null};
const Card=vm.runInNewContext(source.replace(/^import .*;\r?\n/gm,'').replace('export class PassCard','class PassCard')+'\nPassCard',{
  document:doc,projectTeam,assignedRole,mentionSuggestions,esc:s=>String(s),icon:()=>'',
  chatArchived:()=>false,chatThreads:()=>[],chatMessages:()=>[],chatConversation:()=>null,conversationTarget:()=>null,
  experience:()=>({residents:{}}),residentKey:()=>'',xpMarkup:()=>'',careSummary:()=>'',validThread:()=>false,
});
const home={project:'/fixture',ownerAgentId:'rosa',residentAgentIds:['rosa','olive','tyler'],characters:[
  {id:'rosa',slot:1,name:'Rosa',assignedRole:'personal_assistant'},
  {id:'olive',slot:4,name:'Olive',assignedRole:'software_developer'},
  {id:'tyler',slot:5,name:'Tyler',assignedRole:'graphic_design_assistant'},
  {id:'saved',slot:6,name:'Saved',assignedRole:'researcher'},
]};
function fixture(){
  const field={value:'Please @',selectionStart:8,selectionEnd:8,readOnly:false,focus(){doc.activeElement=this},setSelectionRange(a,b){this.selectionStart=a;this.selectionEnd=b},setRangeText(text,start,end){this.value=this.value.slice(0,start)+text+this.value.slice(end);this.selectionStart=this.selectionEnd=start+text.length}};
  const box={innerHTML:''},scroller={scrollHeight:500,scrollTop:400,clientHeight:100};
  const dialog={open:true,classList:{add(){}},querySelectorAll:()=>[],querySelector:q=>q==='[name=instruction]'?field:q==='[data-mentions]'?box:q==='.chat-messages'?scroller:null,
    set innerHTML(html){this.html=html;field.value=html.match(/<textarea[^>]*>(.*?)<\/textarea>/s)[1];box.innerHTML='';},get innerHTML(){return this.html||''}};
  const card=Object.assign(Object.create(Card.prototype),{dialog,project:'/fixture',slot:1,name:'Rosa',households:[],
    data:{runs:[],proposals:[]},runner:{enabled:false},sessions:[],conversations:[],connected:true,
    scheduled:{open:false},models:{mount(){},load(){}},voice:{mount(){},active:()=>false},usage:{mount(){}},
    drafts:new Map([['fixture',field.value]]),searchQuery:'',newConversation:true,providerChoice:'codex',
    targetThread:()=>null,draftKey:()=> 'fixture',scheduledPending:()=>false,providerReady:()=>false,
    draftAttachments:()=>[],handoffPanel:()=>'',busy:()=>false,resizeInput(){},updateSend(){},
    saveDraft(){this.drafts.set('fixture',field.value)},post(){throw Error('This check must never send work')},
  });doc.activeElement=field;return {card,field,box,dialog};
}
test('household update supplies only active same-home teammates, and refreshed menus preserve unsent drafts/caret',()=>{
  const {card,field,box}=fixture();card.updateMentions();assert.equal(card.mention.members.length,0);
  card.setData({households:[home,{...home,project:'/other'}]});
  assert.deepEqual(Array.from(card.mention.members,m=>m.name),['Olive','Tyler']);assert.match(box.innerHTML,/@Olive/);assert.match(box.innerHTML,/@Tyler/);
  const before=field.value,caret=field.selectionStart;card.render();assert.equal(field.value,before);assert.equal(field.selectionStart,caret);assert.match(box.innerHTML,/@Tyler/);
  card.insertMention(1);assert.equal(field.value,'Please @Tyler ');assert.equal(card.drafts.get('fixture'),'Please @Tyler ');assert.equal(box.innerHTML,'');
  card.render();assert.equal(box.innerHTML,'');assert.equal(field.value,'Please @Tyler ');
});
test('recruitment/rename roster updates refresh suggestions without inventing or sending work',()=>{
  const {card,field,box}=fixture();card.households=[home];card.updateMentions();
  const changed={...home,residentAgentIds:['rosa','olive'],characters:home.characters.map(c=>c.id==='olive'?{...c,name:'June'}:c)};
  card.setData({households:[changed]});assert.match(box.innerHTML,/@June/);assert.doesNotMatch(box.innerHTML,/@Olive|@Tyler|@Saved/);
  field.value='mail@June';field.selectionStart=9;card.updateMentions();assert.equal(card.mention,null);assert.equal(box.innerHTML,'');
});
test('mention keyboard selection inserts a name without submitting, and Escape dismisses it',()=>{
  const start=source.indexOf("this.dialog.addEventListener('keydown',e=>{")+"this.dialog.addEventListener('keydown',e=>{".length;
  const end=source.indexOf('\n    });',start);const keydown=new Function('e',source.slice(start,end));
  const {card,field,box}=fixture();field.name='instruction';card.households=[home];card.updateMentions();
  const key=key=>({target:field,key,preventDefault(){this.prevented=true},stopPropagation(){this.stopped=true}});
  keydown.call(card,key('ArrowDown'));assert.equal(card.mentionIndex,1);
  card.render();assert.equal(card.mentionIndex,1);assert.match(box.innerHTML,/class="selected">@Tyler/);
  const enter=key('Enter');keydown.call(card,enter);assert.equal(field.value,'Please @Tyler ');assert.equal(enter.prevented,true);
  field.value='Then @';field.selectionStart=6;card.updateMentions();keydown.call(card,key('Escape'));assert.equal(card.mention,null);assert.equal(box.innerHTML,'');card.render();assert.equal(box.innerHTML,'');
});
