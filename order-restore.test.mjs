import test from 'node:test';
import assert from 'node:assert/strict';
import {planRestore} from './order-tx.js';
test('planRestore gives stock back once and discounts after the last part', ()=>{
  const A={id:'A',status:'SENT_TO_MERCHANT',items:[{productId:'p1',quantity:2}]};
  const B={id:'B',status:'SENT_TO_MERCHANT',items:[{productId:'p2',quantity:3}]};
  const order={couponCode:'SAVE',pointsRedeemed:40};
  let r=planRestore(A,[A,B],order);
  assert.deepEqual(r.stock,[{productId:'p1',qty:2}]); assert.equal(r.restoreDiscount,false);
  r=planRestore(B,[{...A,status:'CANCELLED'},B],order);
  assert.equal(r.restoreDiscount,true); assert.equal(r.coupon,'SAVE'); assert.equal(r.points,40);
  assert.deepEqual(planRestore({...A,restocked:true},[A],order).stock,[]);
  assert.deepEqual(planRestore({...A,status:'DELIVERED'},[A],order).stock,[]);
  assert.equal(planRestore(B,[{...A,status:'CANCELLED',discountRestored:true},B],order).restoreDiscount,false);
});
