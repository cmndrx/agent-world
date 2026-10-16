// Explicit visual QA entry; never imported by the production application.
import * as THREE from 'three';
import { Lot } from './lot.js';
import { Sim } from './sim.js';
import { HOME_ACTIVITIES, planHomeActivity } from './home-activities.js';
const report=document.querySelector('#report');
const params=new URLSearchParams(location.search),level=Number(params.get('level')||1),slot=Number(params.get('slot')||1);
const id=params.get('activity')||'read_a_book';
const scene=new THREE.Scene();scene.background=new THREE.Color(0xeee6d8);
scene.add(new THREE.HemisphereLight(0xffffff,0x918875,3));
const sun=new THREE.DirectionalLight(0xffffff,3);sun.position.set(-5,12,8);scene.add(sun);
const renderer=new THREE.WebGLRenderer({antialias:true,preserveDrawingBuffer:true});renderer.setSize(innerWidth,innerHeight);renderer.setPixelRatio(devicePixelRatio);document.body.append(renderer.domElement);
const camera=new THREE.PerspectiveCamera(40,innerWidth/innerHeight,.1,200);
const characters=Array.from({length:slot},(_,i)=>({slot:i+1,name:'Activity Tester · simulated',seed:42+i,assignedRole:'software_developer'}));
const character=characters[slot-1];
const lot=new Lot({project:'isolated-home-activity-fixture',name:'Simulated home',characters},0,42);
lot.setLevel(level);lot.ensureDesks(slot);lot.roofAllowed=false;lot.roofK=0;scene.add(lot.group);
const sim=new Sim({key:'fixture-resident',lot,character,seed:42});
lot.setViewFloor(sim.floor);lot.wallMode='down';
// Walk each mapping in the actual lot, then interrupt it with observed fixture work.
const results=[];
const metadata=JSON.stringify(character);
let interrupted=0;
for(const a of HOME_ACTIVITIES){
  sim.stopHomeActivity();sim.release();sim.truth=null;sim.placed=false;
  const ok=sim.startHomeActivity(a.id);
  if(ok){for(let i=0;i<1200&&!sim.homeScene;i++)sim.update(1/60,i/60);for(let i=0;i<240;i++)sim.update(1/60,i/60);}
  results.push(`${a.mode}:${ok&&!!sim.homeScene?'rendered':'unavailable'}`);
  const oldScene=sim.homeScene;
  sim.setTruth({state:['editing','waiting_for_user','error','thinking','running'][interrupted++%5],since:new Date().toISOString(),detail:{tool:'Edit',target:'fixture.js'}});
  if(sim.homeScene || lot.homeActivityClaims?.has(sim))throw Error(`Interruption leaked: ${a.id}`);
  if(oldScene && (oldScene.group.parent || oldScene.held.some(g=>g.parent)))throw Error(`Prop leaked: ${a.id}`);
  if(JSON.stringify(character)!==metadata)throw Error('Simulation mutated resident metadata');
}
sim.setTruth(null);sim.stopHomeActivity();sim.release();sim.placed=false;
const ok=sim.startHomeActivity(id);
if(!ok){sim.activity={spot:{x:sim.pos.x,z:sim.pos.y,face:0},pose:'stand',flavor:false};sim.path=[];}
if(ok)for(let i=0;i<1200&&!sim.homeScene;i++)sim.update(1/60,i/60);
const c=sim.homePlan?.center||{x:sim.pos.x,z:sim.pos.y};const y=lot.floorY(sim.floor);
const face=sim.homePlan?.face || 0;
camera.position.set(c.x+3.6*Math.cos(face)+5*Math.sin(face),y+3.6,c.z-3.6*Math.sin(face)+5*Math.cos(face));camera.lookAt(c.x,y+1,c.z);
report.textContent=`Isolated simulation · level ${level}, floor ${sim.floor}, slot ${slot}\n${id}: ${ok?'active':'unavailable due to space'}\n${results.join(' · ')}\nObserved-work/approval/error interruption + prop cleanup: passed\nResident metadata unchanged: passed`;
if(!ok){const f=lot.building.floors[sim.floor],nav=lot.getNav(sim.floor,sim),protectedSpots=lot.desks.filter(d=>d.floor===sim.floor).flatMap(d=>[d.chair,d.wait,d.visitorWait,...d.guests,d.entrance]);report.textContent+=`\nPlacement diagnostic: ${JSON.stringify({entry:sim.desk().entrance,chair:sim.desk().chair,rooms:f.rooms,bounds:nav.b,protectedSpots,fromChair:planHomeActivity({id,floor:f,nav,from:sim.desk().chair,protectedSpots})?.center,fromEntry:planHomeActivity({id,floor:f,nav,from:sim.desk().entrance,protectedSpots})?.center})}`;}
let t=0;renderer.setAnimationLoop(()=>{t+=1/60;sim.flavorUntil=Infinity;lot.update(1/60,t,{camera,night:0,busy:false});sim.update(1/60,t);renderer.render(scene,camera);});
