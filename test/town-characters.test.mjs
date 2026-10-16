import {test} from 'node:test';
import '../scripts/test-web-assets.mjs';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import {BirdFlock} from '../web/src/birds.js';
import {CIVIC_KINDS,civicTransform} from '../shared/town.mjs';
import {ClickReaction,clickKind} from '../web/src/click-reaction.js';
import {buildPerson,lookFromSeed} from '../web/src/models.js';
const {CivicStaff,CIVIC_STAFF}=await import('../web/src/civic-staff.js');
const {CivicBuildings}=await import('../web/src/civic.js');

globalThis.Element=class {};
globalThis.document={createElement:()=>({style:{setProperty(){}},setAttribute(){},remove(){},getContext:()=>({createRadialGradient:()=>({addColorStop(){}}),fillRect(){}})})};
test('bird silhouette budget, shared geometry, hinged motion, glide, reduced motion and teardown',()=>{
  const f=new BirdFlock(),b=f.birds[0];let tris=0;const geos=new Set(),mats=new Set();
  b.root.traverse(o=>{if(o.geometry){tris+=(o.geometry.index?.count??o.geometry.attributes.position.count)/3;geos.add(o.geometry);mats.add(o.material);}});
  assert.ok(tris<=160,`triangles ${tris}`);assert.equal(f.birds.length,9);assert.ok(mats.size<=4);
  const from=new THREE.Vector3(0,25,0),dir=new THREE.Vector3(1,0,0);
  f.update(.1,from,dir);const a=b.wings[0].shoulder.rotation.x;f.update(.4,from,dir);assert.notEqual(a,b.wings[0].shoulder.rotation.x);
  f.update(2.7,from,dir);assert.ok(Math.abs(b.wings[0].shoulder.rotation.x-.12)<.001);
  for(const bird of f.birds)bird.root.traverse(o=>{if(o.geometry)assert.ok(f.geometries.includes(o.geometry));});
  f.update(3,from,dir,true);assert.equal(f.root.visible,false);
  let disposed=0;f.geometries.forEach(g=>g.addEventListener('dispose',()=>disposed++));f.dispose();assert.equal(disposed,f.geometries.length);
});
test('all civic kinds, four rotations, idempotence, move/remove/rebuild and cutaway own exactly one staff',()=>{
  assert.deepEqual(Object.keys(CIVIC_STAFF).sort(),[...CIVIC_KINDS].sort());
  const scene=new THREE.Scene(),c=new CivicBuildings(scene);
  for(let rot=0;rot<4;rot++) {
    const town={civic:CIVIC_KINDS.map((kind,i)=>({kind,i:i*5,j:0,rot}))};c.setTown(town);assert.equal(c.items.size,8);
    const before=[...c.items.values()];c.setTown(town);assert.deepEqual([...c.items.values()],before);
    for(const [kind,it] of c.items){
      assert.equal(it.staff.root.parent,it.root);assert.equal(it.staff.root.userData.simKey,undefined);
      const d=CIVIC_STAFF[kind],p=it.staff.root.getWorldPosition(new THREE.Vector3()),t=civicTransform(town.civic.find(v=>v.kind===kind));
      const local=new THREE.Vector3(...d.at).applyAxisAngle(new THREE.Vector3(0,1,0),t.yaw).add(new THREE.Vector3(t.x,0,t.z));assert.ok(p.distanceTo(local)<1e-6);
      for(const age of [0,3,4,6,8,11])it.staff.update(age);it.staff.update(1,true);const q=it.staff.parts.head.rotation.clone();it.staff.update(100,true);assert.equal(q.y,it.staff.parts.head.rotation.y);
    }
    const camera=new THREE.PerspectiveCamera();camera.position.set(0,20,30);c.wallMode='down';for(let i=0;i<180;i++)c.update(1/60,i/60,{camera});
    assert.ok([...c.items.values()].every(it=>!it.roof.visible&&it.staff.root.visible));
    c.wallMode='cutaway';camera.position.set(500,500,500);for(let i=0;i<180;i++)c.update(1/60,i/60,{camera});assert.ok([...c.items.values()].every(it=>it.roof.visible));
    c.setTown({civic:town.civic.map(v=>({...v,i:v.i+1,rot:(v.rot+1)%4}))});assert.ok(before.every(it=>!it.root.parent&&!it.staff.root.parent));assert.equal(c.items.size,8);
    c.setTown({civic:[]});assert.equal(c.items.size,0);assert.ok(before.every(it=>!it.root.parent&&!it.staff.root.parent));
  }
});
function rig(){const parts=buildPerson(lookFromSeed(42)),parent=new THREE.Group();parent.rotation.y=Math.PI/2;parent.position.y=12;parent.add(parts.root);return {parts,root:parts.root,truth:null,state:'off_duty',observationConnected:true,seated:false};}
const target=()=>({headX:0,headY:0,twist:0,lean:0,armRx:0,armRz:0,elbowR:0,armLx:0,armLz:0,elbowL:0});
test('click classification, coalescing, truth interruption, urgency and bounded cooldown',()=>{
  const s=rig(),r=new ClickReaction(),camera=new THREE.PerspectiveCamera();camera.position.set(6,18,8);
  assert.ok(r.start(s,camera));const active=r.active;for(let i=0;i<50;i++)assert.equal(r.start(s,camera),false);assert.equal(r.active,active);
  r.tick(.1,s);r.compose(s,target(),.1);assert.ok(s.parts.root.rotation.y!==0);
  s.truth={state:'editing'};s.state='editing';r.tick(.01,s);assert.equal(r.active,null);
  for(const state of ['thinking','reading','editing','running','searching','delegating']){s.state=state;assert.equal(clickKind(s),'busy');}
  for(const state of ['waiting_for_user','error']){s.state=state;assert.equal(clickKind(s),null);}
  s.state='editing';s.observationConnected=false;assert.equal(clickKind(s),'friendly');s.observationConnected=undefined;assert.equal(clickKind(s),'friendly');
  s.observationConnected=true;r.tick(.31,s);assert.ok(r.start(s,camera));const yaw=s.root.rotation.y,T=target();r.tick(.25,s);r.compose(s,T,.25);assert.equal(s.root.rotation.y,yaw);assert.ok(T.armRz<-.5);r.tick(1,s);assert.equal(r.active,null);assert.equal(r.start(s,camera),false);
});
test('supported contacts, held hands, upper-floor parent camera frame and reduced motion',()=>{
  const s=rig(),r=new ClickReaction(),camera=new THREE.PerspectiveCamera();camera.position.set(10,25,0);
  const prop=new THREE.Group();s.parts.elbowR.add(prop);s.homeScene={held:[prop]};s.seated=true;
  const metadata=JSON.stringify(s.truth);assert.ok(r.start(s,camera,true));r.tick(.2,s);const T=target();r.compose(s,T,.2);
  assert.equal(T.armRz,0);assert.ok(T.armLz>1);assert.equal(s.root.rotation.y,0);assert.ok(T.headX<0);assert.ok(Math.abs(T.headY)<.01);assert.equal(JSON.stringify(s.truth),metadata);
  const prop2=new THREE.Group();s.parts.elbowL.add(prop2);s.homeScene.held.push(prop2);const U=target();r.compose(s,U,.1);assert.equal(U.armLz,0);assert.equal(U.armRz,0);r.tick(.5,s);assert.equal(r.active,null);
});
test('staff removal preserves shared character materials',()=>{
  const a=new CivicStaff('library'),b=new CivicStaff('library');let sharedDisposed=0;
  a.parts.torso.material.addEventListener('dispose',()=>sharedDisposed++);a.dispose();assert.equal(sharedDisposed,0);assert.ok(b.root.children.length);b.dispose();
});
