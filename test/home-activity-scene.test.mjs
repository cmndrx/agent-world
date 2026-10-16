import assert from 'node:assert/strict';
import {test} from 'node:test';
import * as THREE from 'three';
import {HomeActivityScene} from '../web/src/home-activity-scene.js';
import {HOME_ACTIVITIES} from '../web/src/home-activities.js';
import {buildPerson,lookFromSeed} from '../web/src/models.js';
import {buildPet} from '../web/src/pets.js';
// Only contact-shadow canvas operations; rendering itself is verified in the browser fixture.
globalThis.document={createElement:()=>({getContext:()=>({createRadialGradient:()=>({addColorStop(){}}),fillRect(){}})})};

test('all scene rigs support varied builds, time-based contact targets, reduced motion and complete teardown',()=>{
  for(const build of [.85,1,1.2])for(const def of HOME_ACTIVITIES){
    const look={...lookFromSeed(42),build},parts=buildPerson(look);
    const sim={parts,root:parts.root,lot:{},floor:1};
    const scene=new HomeActivityScene(sim,{def,seated:!['cat','bunny','fish','celebrate','praise'].includes(def.mode),existing:false});
    let samples=0;
    for(const t of [0,.5,2,4,8]){
      const T={bodyY:0,lean:0,twist:0,headX:0,headY:0};
      scene.pose(T,t,(_pose,side,target)=>{assert.equal(target.length,3);assert.ok(target.every(Number.isFinite));assert.ok(side===1||side===-1);samples++;},build);
      assert.ok(Object.values(T).every(Number.isFinite));scene.update(.1,t===8);
    }
    assert.equal(samples,10);
    const geometries=new Set(),materials=[...scene.materials];let disposed=0,disposedMaterials=0;
    for(const g of [scene.group,...scene.held])g.traverse(o=>{if(o.geometry)geometries.add(o.geometry);});
    for(const g of geometries)g.addEventListener('dispose',()=>disposed++);
    for(const m of materials)m.addEventListener('dispose',()=>disposedMaterials++);
    scene.dispose();
    assert.equal(disposed,geometries.size,def.id);assert.equal(disposedMaterials,materials.length);
    assert.equal(scene.group.parent,null);assert.ok(scene.held.every(g=>!g.parent));
    assert.equal(parts.body.rotation.x,0);assert.equal(parts.body.position.z,0);assert.ok(parts.legL.visible&&parts.legR.visible);assert.equal(parts.eyes.scale.y,1);
  }
});

test('pet scene construction never creates or relocates a replacement animal',()=>{
 const parent=new THREE.Group(),pet=buildPet('cat',42);parent.add(pet.root);pet.root.position.set(2,.12,3);
 const ambient={kind:'cat',root:pet.root,parts:pet};const parts=buildPerson(lookFromSeed(42));
 const sim={parts,root:parts.root,lot:{pet:ambient},floor:0};const def=HOME_ACTIVITIES.find(a=>a.mode==='cat');
 const scene=new HomeActivityScene(sim,{def,seated:false,existing:false});assert.equal(scene.pet,undefined);assert.equal(pet.root.parent,parent);assert.deepEqual(pet.root.position.toArray(),[2,.12,3]);scene.dispose();
});
