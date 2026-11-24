import assert from 'node:assert/strict';
const {requestMessage:rm,requestForm:rf}=await import('./support-requests.js');
const ok={name:'منى',phone:'01012345678',area:'الهرم',business:'عيادة',activity:'عيادات'},acc={uid:'u1',email:'a@b.c'};
const t=rm('service',ok,acc);
assert.match(t,/^طلب الانضمام كمقدم خدمة/);assert.match(t,/نوع الخدمة: عيادات/);assert.match(t,/اسم الخدمة: عيادة/);assert.match(t,/معرّف الحساب: u1/);
assert.throws(()=>rm('service',{...ok,business:''},acc));assert.throws(()=>rm('service',{...ok,activity:''},acc));assert.throws(()=>rm('bogus',ok,acc));
assert.match(rm('merchant',ok,acc),/^طلب تسجيل متجر/);
assert.match(rf('service',{},true,s=>s),/طلب الانضمام كمقدم خدمة/);
console.log('PASS service join request message and form');
