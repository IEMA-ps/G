import {initializeTestEnvironment,assertSucceeds,assertFails} from '@firebase/rules-unit-testing';
import {doc,getDoc,setDoc,addDoc,deleteDoc,collection,serverTimestamp} from 'firebase/firestore';
import {readFileSync} from 'node:fs';
const env=await initializeTestEnvironment({projectId:'demo-support-chat',firestore:{host:'127.0.0.1',port:8088,rules:readFileSync(new URL('../../firestore.support-chat.proposed.rules',import.meta.url),'utf8')}});
const LEAD={name:'إسلام',phone:'201012345678',createdAt:null};
const miss=(over)=>Object.assign({question:'سؤال ملوش إجابة',role:'guest',createdAt:serverTimestamp()},over);
try{
  await env.withSecurityRulesDisabled(async ctx=>{
    const db=ctx.firestore();
    await setDoc(doc(db,'users','customer1'),{role:'CUSTOMER',firstName:'عميل'});
    await setDoc(doc(db,'users','staff1'),{role:'ADMIN',adminRole:'STAFF',firstName:'موظف'});
    await setDoc(doc(db,'users','super1'),{role:'ADMIN',firstName:'مدير'});
  });
  const guest=env.unauthenticatedContext().firestore();
  const customer=env.authenticatedContext('customer1').firestore();
  const staff=env.authenticatedContext('staff1').firestore();
  const superA=env.authenticatedContext('super1').firestore();

  // أسئلة المساعد: قراءة عامة، كتابة سوبر بس
  await assertSucceeds(getDoc(doc(guest,'supportFaq','f1')));console.log('PASS faq public read');
  await assertFails(setDoc(doc(guest,'supportFaq','f1'),{q:'س',keys:['س'],answer:'ج',createdAt:serverTimestamp()}));console.log('PASS faq guest write blocked');
  await assertFails(setDoc(doc(customer,'supportFaq','f1'),{q:'س',keys:['س'],answer:'ج',createdAt:serverTimestamp()}));console.log('PASS faq customer write blocked');
  await assertFails(setDoc(doc(staff,'supportFaq','f1'),{q:'س',keys:['س'],answer:'ج',createdAt:serverTimestamp()}));console.log('PASS faq staff-admin write blocked');
  await assertSucceeds(setDoc(doc(superA,'supportFaq','f1'),{q:'س',keys:['س'],answer:'ج',createdAt:serverTimestamp()}));console.log('PASS faq super write');

  // بوابة الزائر
  await assertSucceeds(setDoc(doc(guest,'supportGuestLeads','201012345678'),{name:'إسلام',phone:'201012345678',createdAt:serverTimestamp()}));console.log('PASS lead create');
  await assertFails(setDoc(doc(guest,'supportGuestLeads','201012345678'),{name:'إسلام',phone:'201012345678',createdAt:serverTimestamp()}));console.log('PASS lead second create (update) blocked — الرقم مرة واحدة');
  await assertFails(setDoc(doc(guest,'supportGuestLeads','20999'),{name:'إسلام',phone:'123',createdAt:serverTimestamp()}));console.log('PASS lead bad phone blocked');
  await assertFails(setDoc(doc(guest,'supportGuestLeads','201012345679'),{name:'إسلام',phone:'201012345678',createdAt:serverTimestamp()}));console.log('PASS lead id/phone mismatch blocked');
  await assertFails(setDoc(doc(guest,'supportGuestLeads','201123456780'),{name:'إسلام',phone:'201123456780',createdAt:serverTimestamp(),extra:'x'}));console.log('PASS lead extra field blocked');
  await assertFails(getDoc(doc(guest,'supportGuestLeads','201012345678')));console.log('PASS lead guest read blocked');
  await assertSucceeds(getDoc(doc(superA,'supportGuestLeads','201012345678')));console.log('PASS lead admin read');

  // الأسئلة المجهولة
  await assertSucceeds(addDoc(collection(guest,'supportUnanswered'),miss({leadPhone:'201012345678'})));console.log('PASS guest miss with lead');
  await assertFails(addDoc(collection(guest,'supportUnanswered'),miss({leadPhone:'201999999999'})));console.log('PASS guest miss without lead blocked');
  await assertFails(addDoc(collection(guest,'supportUnanswered'),miss({})));console.log('PASS guest miss no lead blocked');
  await assertSucceeds(addDoc(collection(customer,'supportUnanswered'),miss({uid:'customer1',role:'customer'})));console.log('PASS user miss own uid');
  await assertFails(addDoc(collection(customer,'supportUnanswered'),miss({uid:'someoneElse',role:'customer'})));console.log('PASS user miss foreign uid blocked');
  await assertFails(addDoc(collection(customer,'supportUnanswered'),miss({uid:'customer1',role:'customer',question:'س'.repeat(301)})));console.log('PASS miss over 300 chars blocked');
  await assertFails(getDoc(doc(customer,'supportUnanswered','m1')));console.log('PASS miss customer read blocked');
  await assertSucceeds(getDoc(doc(staff,'supportUnanswered','m1')));console.log('PASS miss staff read');
  await assertSucceeds(deleteDoc(doc(staff,'supportUnanswered',(await addDoc(collection(customer,'supportUnanswered'),miss({uid:'customer1',role:'customer'}))).id)));console.log('PASS miss staff delete');
}finally{await env.cleanup()}
console.log('ALL support-chat rules PASS');
