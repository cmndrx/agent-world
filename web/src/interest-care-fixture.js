import * as THREE from 'three';
import {Lot} from './lot.js';
import {Sim} from './sim.js';
import {CarePanel} from './care.js';
window.addEventListener('error',e=>{document.querySelector('#report').textContent='Fixture error: '+e.message;document.querySelector('#report').dataset.error='true';});
const params=new URLSearchParams(location.search);
let data=await (await fetch('/api/fixture'+(params.has('mount')?'?mount=1':''))).json();
const scene=new THREE.Scene();scene.background=new THREE.Color(0xeee6d8);
scene.add(new THREE.HemisphereLight(0xffffff,0x918875,3));
const sun=new THREE.DirectionalLight(0xffffff,3);sun.position.set(-5,12,8);scene.add(sun);
const renderer=new THREE.WebGLRenderer({antialias:true,preserveDrawingBuffer:true});renderer.setSize(innerWidth,innerHeight);renderer.setPixelRatio(devicePixelRatio);document.body.append(renderer.domElement);
const camera=new THREE.PerspectiveCamera(40,innerWidth/innerHeight,.1,200);
const lot=new Lot(data.home,0,42);lot.residentSlots=new Map([[1,1]]);lot.setLevel(1);lot.applyStyle(data.style.homes[data.home.project]);lot.roofAllowed=false;lot.roofK=0;lot.wallMode='up';scene.add(lot.group);
const sim=new Sim({key:'fixture-resident',lot,character:data.character,seed:42});
// Deterministic first generic routine for read-only visual QA, with unchanged
// sweets/TV/bath interests. This never invokes player care or earns happiness.
if(['coffee','globe'].includes(params.get('ambient'))) {
  sim.preferInterest=true;sim.ambientCursor=params.get('ambient')==='coffee'?0:5;
  document.querySelector('#care').hidden=true;
}
const panel=new CarePanel(document.querySelector('#care'),sim);
let t=0;renderer.setAnimationLoop(()=>{
  t+=1/60;lot.update(1/60,t,{camera,night:0,busy:false});sim.update(1/60,t);
  const c=params.has('mount')?{x:-5.2,z:2.2}:sim.homePlan?.center || {x:sim.pos.x,z:sim.pos.y};camera.position.set(c.x+5,5,c.z+5);camera.lookAt(c.x,1,c.z);
  renderer.render(scene,camera);
});
setInterval(async()=>{
  data=await(await fetch('/api/fixture')).json();sim.receiveCare(data.character);sim.character=data.character;panel.render(true);
  if(!document.querySelector('#report').dataset.error) document.querySelector('#report').textContent=`Isolated fixture · happiness ${sim.character.happiness}/100 · ${sim.activity?.homeId || sim.activity?.kind || 'idle'} · ${sim.homeScene?'visible scene':sim.arrived?'at station':'approaching/unavailable'} · no providers/real state`;
},500);
panel.render(true);
