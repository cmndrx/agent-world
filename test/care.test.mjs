import test from 'node:test';
import assert from 'node:assert/strict';
import {initializeCare,applyCare,CARE_INTERESTS} from '../shared/care.mjs';
test('care initialization remains deterministic and preserves existing catalog preferences',()=>{
 const a={id:'resident-1'},b={id:'resident-1'};initializeCare(a,1000);initializeCare(b,1000);assert.deepEqual(a,b);assert.equal(a.happiness,50);assert.equal(a.interestIds.length,2);assert.equal(initializeCare(a),false);
 const saved={id:'saved',interestIds:['dog_companionship'],happiness:120};initializeCare(saved,0);assert.equal(saved.happiness,100);assert.deepEqual(saved.interestIds,['dog_companionship']);assert.equal(CARE_INTERESTS.length,68);
});
test('invalid interest edits and receipt reuse cannot partially mutate metadata',()=>{
 const c={id:'resident-1'};initializeCare(c,1000);const before=structuredClone(c);
 for(const ids of [[],['missing'],['sweets','sweets'],['sweets','takeout','reading','praise']])assert.throws(()=>applyCare(c,{id:'edit-invalid',action:'interests',revision:1,interestIds:ids}));
 assert.throws(()=>applyCare(c,{id:'bad-action-id',action:'__proto__',revision:1}),/supported/);assert.deepEqual(c,before);
 const input={id:'edit-valid-id',action:'interests',revision:1,interestIds:['sweets']};const changed=applyCare(c,input).character;assert.equal(applyCare(changed,input).duplicate,true);assert.throws(()=>applyCare(changed,{...input,interestIds:['reading']}),/already used/);assert.equal(changed.happiness,50);
});
