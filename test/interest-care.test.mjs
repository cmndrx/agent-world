import test from 'node:test';
import assert from 'node:assert/strict';
import {validateTelevisions} from '../bridge/care-resources.mjs';
import {resourceReason,INTEREST_CARE} from '../shared/interest-care.mjs';
import {buildingPlanFor} from '../web/src/home-floors.js';
import {tvMounts} from '../shared/tv-mounts.mjs';
import {sanitizeHome} from '../shared/style.mjs';
test('68 reviewed policies; 15 home interests and explicit reasons for venues and missing resources',()=>{
  assert.equal(Object.keys(INTEREST_CARE).length,68);assert.equal(Object.values(INTEREST_CARE).filter(p=>!p.unsupported).length,15);
  assert.match(resourceReason('cat_companionship',{pet:'bunny'}),/cat/);
  assert.match(resourceReason('cat_companionship',{pet:'cat'}),/not implemented/);
  assert.match(resourceReason('dog_companionship',{pet:'dog'}),/venue/);
  assert.match(resourceReason('aquatic_pets',{items:[{kind:'aquarium'}]}),/not implemented/);
  for(const p of Object.values(INTEREST_CARE))assert.ok(p.activityId);
  for(const id of ['television','bubble_baths','naps','sleeping_in','snacks','reading'])assert.ok(resourceReason(id));
  assert.equal(resourceReason('television',{items:[{kind:'tv',floor:0}],floor:0}),null);
  assert.ok(resourceReason('television',{items:[{kind:'tv',floor:1}],floor:0}));
});
test('TV placement and fireplace anchor round-trip; forged mounts, overlap and floor violations reject',()=>{
  const f=buildingPlanFor('cottage').floors[0],m=tvMounts(f.items)[0];assert.ok(m);
  const d={id:'tvfixture',item:'fireplace_tv',x:m.x,z:m.z,rot:m.rot,anchor:m.anchor};
  const clean=sanitizeHome({decor:[d]});assert.deepEqual(JSON.parse(JSON.stringify(clean)).decor[0],d);
  validateTelevisions(clean,null,1);
  assert.throws(()=>validateTelevisions({decor:[{...d,anchor:'fireplace:0:0:s'}]},null,1),/mount/);
  assert.throws(()=>validateTelevisions({decor:[d,{...d,id:'tvsecond'}]},null,1),/already/);
  assert.throws(()=>validateTelevisions({decor:[{id:'tvbad',item:'television',x:99,z:0,rot:0}]},null,1),/inside/);
  const bed=f.items.find(i=>i.kind==='bed');assert.throws(()=>validateTelevisions({decor:[{id:'tvbad',item:'television',x:bed.x,z:bed.z,rot:0}]},null,1),/overlaps/);
});
