import assert from 'node:assert/strict';
import * as R from './referral-codes.js';
const store=new Map();
const api={doc:(db,c,id)=>c+'/'+id,getDoc:async r=>({exists:()=>store.has(r),data:()=>store.get(r)}),setDoc:async(r,d)=>store.set(r,d),
  writeBatch:()=>{const ops=[];return {set:(r,d)=>ops.push([r,d]),commit:async()=>ops.forEach(([r,d])=>store.set(r,d))};}};
assert.equal(R.codeFor('abC1'),'MK-ABC1');assert.equal(R.validCode(' mk-abc1 '),true);assert.equal(R.validCode('a b'),false);assert.equal(R.validCode(''),false);
assert.equal(await R.lookup(api,null,'mk-x1'),null);
assert.equal(await R.ensureMine(api,null,'x1',{referralCode:'MK-X1'}),true);
assert.equal(await R.lookup(api,null,' mk-x1 '),'x1');
assert.equal(await R.ensureMine(api,null,'x1',{referralCode:'MK-X1'}),false,'already there, no write');
assert.equal(await R.ensureMine(api,null,'x2',{referralCode:'CUSTOM1'}),false,'custom codes are not self-mirrored');
assert.equal(await R.lookup(api,null,'../x'),null);
const n=await R.backfill(api,null,[{_id:'a',referralCode:'MK-A'},{_id:'x1',referralCode:'MK-X1'},{_id:'c',referralCode:'CUSTOM1'},{_id:'d'}],['MK-X1']);
assert.equal(n,2);assert.equal(await R.lookup(api,null,'CUSTOM1'),'c');
console.log('referral-codes ok');
