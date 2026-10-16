// Explicit QA entry, never imported by production. All state below is in-memory simulation.
import * as THREE from 'three';
import {CivicBuildings} from './civic.js';
import {CIVIC_STAFF} from './civic-staff.js';
import {BirdFlock} from './birds.js';
import {Lot} from './lot.js';
import {Sim} from './sim.js';
import {MayorCharacter} from './mayor-character.js';
import {buildTownHall} from './town-hall.js';
const q=new URLSearchParams(location.search),report=document.querySelector('#report'),labels=document.querySelector('#labels');
const assert=(ok,msg)=>{if(!ok)throw Error(msg);};
const reduced=q.get('reduced')==='1',view=q.get('view')||'staff';
if(reduced){const media=globalThis.matchMedia.bind(globalThis);globalThis.matchMedia=query=>query==='(prefers-reduced-motion: reduce)'?{matches:true,media:query,addEventListener(){},removeEventListener(){}}:media(query);}
const renderer=new THREE.WebGLRenderer({antialias:true,preserveDrawingBuffer:true});renderer.setSize(innerWidth,innerHeight);renderer.setPixelRatio(1);document.body.append(renderer.domElement);
const light=scene=>{scene.background=new THREE.Color(0xeee6d8);scene.add(new THREE.HemisphereLight(0xffffff,0x918875,3));const sun=new THREE.DirectionalLight(0xffffff,3);sun.position.set(-5,12,8);scene.add(sun);};
const scene=new THREE.Scene();light(scene);const camera=new THREE.PerspectiveCamera(40,innerWidth/innerHeight,.1,1000);
const character={slot:1,name:'Fixture resident · simulated',seed:42,assignedRole:'software_developer'};
const level=Number(q.get('level')||1),slot=Number(q.get('slot')||1);character.slot=slot;
const characters=Array.from({length:slot},(_,i)=>i===slot-1?character:{slot:i+1,name:`Fixture ${i+1}`,seed:i+1});
const lot=new Lot({project:'isolated-town-character-fixture',name:'Simulated home',characters},0,42);lot.setLevel(level);lot.ensureDesks(slot);scene.add(lot.group);lot.group.rotation.y=Number(q.get('yaw')||0);lot.wallMode='down';lot.roofAllowed=false;
const sim=new Sim({key:'fixture-resident',lot,character,seed:42});sim.observationConnected=true;lot.setViewFloor(sim.floor);
camera.position.set(6,lot.floorY(sim.floor)+6,8);camera.lookAt(0,lot.floorY(sim.floor)+1,0);
const metadata=JSON.stringify(character),results=[];
const run=(n=120)=>{for(let i=0;i<n;i++){sim.flavorUntil=Infinity;sim.update(1/60,i/60);}};
try {
  const commons={group:new THREE.Group()},coexist=new THREE.Scene();coexist.add(commons.group);buildTownHall(commons.group);
  const mayor=new MayorCharacter(commons),civics=new CivicBuildings(coexist),mayorRoot=mayor.world.root;
  civics.setTown({civic:Object.keys(CIVIC_STAFF).map((kind,i)=>({kind,i:i*5,j:5,rot:i%4}))});
  assert(civics.items.size===8&&mayorRoot.parent===commons.group&&mayor.label.element.textContent==='Mayor Martin','Town Hall coexistence');
  civics.setTown({civic:[]});assert(mayorRoot.parent===commons.group,'civic removal affected Martin');mayor.renderer.dispose();mayor.renderer.forceContextLoss();results.push('eight civics coexist with original Mayor Martin/Town Hall');
  for(const state of ['thinking','reading','editing','running','searching','delegating']) {
    sim.setTruth({state,since:new Date().toISOString(),detail:{tool:'fixture'}});run(350);
    const path=JSON.stringify(sim.path),activity=sim.activity,truth=sim.truth;
    sim.clickReaction.cooldown=0;assert(sim.clickReaction.start(sim,camera,reduced),'busy start');assert(sim.clickReaction.active.kind==='busy',state);
    run(10);assert(sim.activity===activity&&sim.truth===truth,'reaction changed truth/activity');assert(JSON.stringify(sim.path)===path,'reaction changed station route');run(90);assert(!sim.clickReaction.active,'busy bounded');
  }
  results.push('six working states + unchanged workstation/truth');
  for(const state of ['waiting_for_user','error']){sim.setTruth({state,since:new Date().toISOString(),detail:{}});sim.clickReaction.cooldown=0;assert(!sim.clickReaction.start(sim,camera,reduced),'urgent masked');}
  results.push('waiting/error priority');
  sim.setTruth(null);run();sim.clickReaction.cooldown=0;sim.clickReaction.start(sim,camera,reduced);const active=sim.clickReaction.active;for(let i=0;i<20;i++)sim.clickReaction.start(sim,camera,reduced);assert(sim.clickReaction.active===active,'repeat queued');
  sim.setTruth({state:'editing',since:new Date().toISOString(),detail:{}});run(1);assert(!sim.clickReaction.active,'new work must win');
  results.push('coalescing + immediate work interruption');
  for(const id of ['read_a_book','take_a_bubble_bath','sleep_in','paint_a_picture','play_with_a_cat']){
    sim.setTruth(null);sim.stopHomeActivity();sim.release();sim.placed=false;
    if(!sim.startHomeActivity(id)){results.push(`${id}: space unavailable`);continue;}
    for(let i=0;i<1200&&!sim.homeScene;i++)run(1);run(1);
    const home=sim.homeScene,age=home.age,claim=lot.homeActivityClaims.get(sim),bodyX=sim.parts.body.rotation.x,bodyZ=sim.parts.body.position.z,bodyY=sim.parts.body.position.y;sim.clickReaction.cooldown=0;sim.clickReaction.start(sim,camera,reduced);run(10);
    assert(home===sim.homeScene&&home.age===age,'support/choreography not frozen');assert(lot.homeActivityClaims.get(sim)===claim,'reservation lost');
    if(home.mode==='sleep'){assert(sim.parts.body.rotation.x===bodyX&&sim.parts.body.position.z===bodyZ&&sim.parts.body.position.y===bodyY,'lying support changed');}
    sim.setTruth({state:'running',since:new Date().toISOString(),detail:{}});run(1);assert(!sim.homeScene&&!lot.homeActivityClaims.has(sim),'home leak');assert(home.held.every(g=>!g.parent),'held prop leak');
  }
  assert(JSON.stringify(character)===metadata,'metadata changed');results.push('home support/props/reservations + metadata unchanged');
  sim.setTruth(null);character.care={pending:{id:'isolated-care-receipt',startedAt:Date.now(),completesAt:Date.now()+10000}};sim.decide();run(1000);
  const care=JSON.stringify(character.care);sim.clickReaction.cooldown=0;sim.clickReaction.start(sim,camera,reduced);run(20);assert(JSON.stringify(character.care)===care,'click changed care receipt/timer');run(120);assert(JSON.stringify(character.care)===care,'click completed care');delete character.care;
  results.push('pending care timer/receipt unchanged');
  sim.setTruth({state:'editing',since:new Date().toISOString(),detail:{}});sim.observationConnected=false;sim.clickReaction.cooldown=0;sim.clickReaction.start(sim,camera,reduced);assert(sim.clickReaction.active.kind==='friendly','disconnected busy');run(120);assert(!sim.clickReaction.active,'disconnected bounded');sim.observationConnected=true;
  results.push('disconnected friendly');
}catch(error){report.textContent=`FAIL: ${error.stack}`;throw error;}
sim.setTruth(null);sim.stopHomeActivity();sim.release();sim.placed=false;
let draw;
if(view==='staff'){
  scene.remove(lot.group);labels.style.display=q.has('kind')?'none':'grid';
  const kinds=q.has('kind')?[q.get('kind')]:Object.keys(CIVIC_STAFF),panels=[];
  for(const kind of kinds){const s=new THREE.Scene();light(s);const civic=new CivicBuildings(s);civic.setTown({civic:[{kind,i:0,j:0,rot:Number(q.get('rot')||0)}]});civic.wallMode=q.get('closed')==='1'?'up':'down';const it=civic.items.get(kind),c=new THREE.PerspectiveCamera(40,1,.05,400);it.root.updateWorldMatrix(true,true);const at=it.staff.root.getWorldPosition(new THREE.Vector3());
    const offset=(kind==='power_plant'?new THREE.Vector3(1.4,3,1.1):new THREE.Vector3(2.7,3,4.3)).applyAxisAngle(new THREE.Vector3(0,1,0),it.yaw);c.position.copy(at).add(offset);c.lookAt(at.clone().add(new THREE.Vector3(0,.9,0)));
    if(q.get('closed')==='1'){c.position.copy(it.root.position).add(new THREE.Vector3(32,38,48));c.lookAt(it.root.position);}
    panels.push({s,c,civic});const span=document.createElement('span');span.textContent=`${kind} · simulated`;labels.append(span);
  }
  draw=t=>{renderer.setScissorTest(true);panels.forEach(({s,c,civic},i)=>{const cols=panels.length===1?1:4,rows=panels.length===1?1:2,w=innerWidth/cols,h=(innerHeight-90)/rows,x=i%cols*w,y=(rows-1-Math.floor(i/cols))*h;c.aspect=w/h;c.updateProjectionMatrix();civic.update(1/60,reduced?1:t,{camera:c,target:new THREE.Vector3()});renderer.setViewport(x,y,w,h);renderer.setScissor(x,y,w,h);renderer.render(s,c);});};
}else if(view==='birds'){
  scene.remove(lot.group);labels.remove();const flock=new BirdFlock();scene.add(flock.root);const from=new THREE.Vector3(0,0,0),dir=new THREE.Vector3(1,0,0);
  // Baseline geometry copied exactly from the previous implementation for visual comparison.
  const geo=new THREE.BufferGeometry();geo.setAttribute('position',new THREE.Float32BufferAttribute([0,0,0,-.5,0,.55,.15,0,.05,0,0,0,-.5,0,-.55,.15,0,-.05],3));const legacy=new THREE.Mesh(geo,new THREE.MeshBasicMaterial({color:0x2a2f3c,side:THREE.DoubleSide}));legacy.scale.setScalar(1.4);scene.add(legacy);
  const zoom=q.get('zoom')==='town'?24:5;const angle=q.get('angle')||'three';camera.position.set(angle==='side'?0:zoom,angle==='top'?zoom*2:angle==='side'?.2:zoom*.65,angle==='top'?.01:zoom);camera.lookAt(0,0,0);
  draw=t=>{const phase=Number(q.get('phase')||t%3.8);flock.update(phase,from,dir,reduced);flock.root.visible=!reduced&&q.get('night')!=='1';for(let i=1;i<9;i++)flock.birds[i].root.visible=false;flock.birds[0].root.position.set(1.1,0,0);legacy.position.set(-1.1,0,0);renderer.render(scene,camera);};
}else{
  labels.remove();const activity=q.get('activity');if(activity)sim.startHomeActivity(activity);else sim.setTruth(q.get('state')?{state:q.get('state'),since:new Date().toISOString(),detail:{}}:null);
  run(1000);const world=sim.root.getWorldPosition(new THREE.Vector3());camera.position.copy(world).add(new THREE.Vector3(3.2,3.3,5));camera.lookAt(world.clone().add(new THREE.Vector3(0,1,0)));let clickAt=-10;
  const pointer=new THREE.Vector2(),ray=new THREE.Raycaster();
  renderer.domElement.addEventListener('click',e=>{pointer.set(e.clientX/innerWidth*2-1,-e.clientY/innerHeight*2+1);ray.setFromCamera(pointer,camera);if(ray.intersectObject(sim.root,true).length){const started=sim.clickReaction.start(sim,camera,reduced);report.textContent+=`\nActual fixture resident hit: ${started?'started':'coalesced/cooldown'} ${sim.clickReaction.active?.kind||'reaction'}`;}});
  if(q.has('poseTime')){sim.clickReaction.cooldown=0;sim.clickReaction.start(sim,camera,reduced);run(Math.ceil(Number(q.get('poseTime'))*60));for(let i=0;i<180;i++)lot.update(1/60,i/60,{camera,night:0,busy:false});}
  draw=t=>{if(!q.has('poseTime')){if(!q.has('manual')&&t-clickAt>3){sim.clickReaction.start(sim,camera,reduced);clickAt=t;}sim.flavorUntil=Infinity;lot.update(1/60,t,{camera,night:0,busy:false});sim.update(1/60,t);}renderer.render(scene,camera);};
}
report.textContent=`PASS · Isolated in-memory simulation (no bridge/providers/queue)\n${results.join(' · ')}\nView ${view}; reduced=${reduced}; birds baseline LEFT / new RIGHT. Actual fixture canvas clicks trigger acknowledgment.`;
let t=0;renderer.setAnimationLoop(()=>{t+=1/60;draw(t);});
