import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
const html=readFileSync('index.html','utf8');
const policy=await import('data:text/javascript;base64,'+Buffer.from(readFileSync('member-roles.js')).toString('base64'));
const actor={role:'ADMIN',adminRole:'SUPER'}, customer={role:'CUSTOMER',merchantId:null,deliveryAgentId:null},record={id:'r',ownerId:null};
for(const role of ['MERCHANT','DELIVERY']){
 const patch=policy.assignmentPatch(actor,customer,record,role,'r');assert.equal(patch.role,role);assert.equal(patch[policy.assignmentType(role).field],'r');
 for(const bad of [null,{role:'CUSTOMER'},{role:'ADMIN',adminRole:'STAFF'}])assert.throws(()=>policy.assignmentPatch(bad,customer,record,role,'r'),/super-required/);
 for(const bad of [null,{role:'ADMIN'},{role:'MERCHANT'},{...customer,merchantId:'old'},{...customer,deliveryAgentId:'old'}])assert.throws(()=>policy.assignmentPatch(actor,bad,record,role,'r'),/customer-required/);
 for(const bad of [null,{id:'wrong'},{id:'r',ownerId:'other'}])assert.throws(()=>policy.assignmentPatch(actor,customer,bad,role,'r'),/record-unavailable/);
}
let writes=[];const data={'users/admin':actor,'users/customer':customer,'merchants/r':record};
await policy.assignMemberRole({db:{},doc:(db,c,id)=>c+'/'+id,actorId:'admin',userId:'customer',recordId:'r',role:'MERCHANT',runTransaction:async(db,fn)=>fn({get:async ref=>({exists:()=>!!data[ref],data:()=>data[ref]}),update:(ref,patch)=>writes.push([ref,patch])})});
assert.deepEqual(writes,[['users/customer',{role:'MERCHANT',merchantId:'r',deliveryAgentId:null}],['merchants/r',{ownerId:'customer'}]]);
const adminPanel=await import('./admin-panel.js');
const base={...adminPanel,typePicker:()=>'<div>نوع المتجر</div>',StoreTypes:{set:(id,v)=>{const el=elements.get(id);if(el)el.value=v;}},MerchantPlans:{mapField:()=>'<div>خريطة المتجر</div>'},locationPicker:()=>'<section>المحافظة والمنطقة</section>',EgyptLocations:{address:(p,d)=>d},S:{allUsersReady:true,allUsers:[{_id:'customer',firstName:'اسم',role:'CUSTOMER'}],allMerchants:[{id:'r',businessName:'متجر تجربة'}],allDeliveryAgents:[]},esc:s=>String(s),emptyState:()=>'',mkRate:()=>0,isSuperAdmin:()=>true,window:{},assignmentType:policy.assignmentType,memberRecordForm:policy.memberRecordForm,uid:()=>'new'};
let modal='';base.UI={openModal:s=>modal=s,toast(){}};vm.createContext(base);
vm.runInContext(html.slice(html.indexOf('function renderAdminUsers()'),html.indexOf('window.promoteToAdmin =')),base);
assert.match(base.renderAdminUsers(),/تعيين تاجر/);assert.match(base.renderAdminUsers(),/تعيين مندوب/);
base.window.openAssignMemberRole('customer','MERCHANT');assert.match(modal,/اسم المتجر كما في طلب واتساب/);assert.doesNotMatch(modal,/memberRoleRecord/);
base.window.openAssignMemberRole('customer','DELIVERY');assert.match(modal,/وسيلة التوصيل/);assert.match(modal,/memberRoleSave/);
base.isSuperAdmin=()=>false;assert.doesNotMatch(base.renderAdminUsers(),/openAssignMemberRole/);
console.log('PASS role policy, transaction write pair, admin-only UI, picker and empty state; no external requests');

const input={name:'متجر واتساب',phone:'01012345678',activity:'بقالة',address:'عنوان تجربة',vehicle:'دراجة'};
const m=policy.newMemberRecord('MERCHANT',input,{email:'a@example.test'},'u','new',123,true);
assert.equal(m.businessName,'متجر واتساب');assert.equal(m.ownerId,'u');assert.equal(m.status,'PENDING');assert.equal(m.subscriptionModel,'MERCHANT_V2');assert.equal(m.subPlanType,null);assert.equal(m.subEndsAt,undefined);assert.equal(m.whatsappNumber,input.phone);
const courier=policy.newMemberRecord('DELIVERY',input,{},'u','a',123);assert.equal(courier.status,'PENDING');assert.equal(courier.merchantId,undefined);assert.equal(courier.ownerId,'u');
assert.throws(()=>policy.newMemberRecord('MERCHANT',{...input,name:''},{},'u','m',123),/invalid-contact/);
assert.throws(()=>policy.newMemberRecord('MERCHANT',{...input,address:''},{},'u','m',123),/missing-store-details/);
console.log('PASS new record defaults, validation, no subscription and independent courier');
const requests=await import('data:text/javascript;base64,'+Buffer.from(readFileSync('support-requests.js')).toString('base64'));
for(const kind of ['merchant','delivery']){
 const message=requests.requestMessage(kind,{name:'اسم الطلب',phone:'01012345678',business:'متجر طلب واتساب',activity:'بقالة',area:'منطقة الطلب',vehicle:'دراجة'},{uid:'u',email:'u@example.test'});
 const parsed=policy.parseMemberRequest(message,kind==='merchant'?'MERCHANT':'DELIVERY');
 assert.equal(parsed.accountId,'u');assert.equal(parsed.fields.name,kind==='merchant'?'متجر طلب واتساب':'اسم الطلب');assert.equal(parsed.fields.phone,'01012345678');assert.equal(parsed.fields.address,'منطقة الطلب');
}
assert.deepEqual(policy.parseMemberRequest('نص غير معروف\nrole: ADMIN\nstatus: ACTIVE','MERCHANT').fields,{});
assert.deepEqual(policy.parseMemberRequest(' اسم المتجر ： محل معدل \nالهاتف: 01012345678','MERCHANT').fields,{name:'محل معدل',phone:'01012345678',whatsapp:'01012345678'});
assert.equal(policy.parseMemberRequest('الاسم: اسم فقط','MERCHANT').fields.name,undefined);
console.log('PASS app WhatsApp formats, edited separators, partial messages, unknown labels ignored');
const elements=new Map();for(const id of ['memberRequestPaste','memberPasteNotice','memberRecordName','memberRecordManager','memberRecordPhone','memberRecordWhatsapp','memberRecordActivity','memberRecordVehicle','memberRecordAddress'])elements.set(id,{value:'',textContent:'',style:{}});
base.document={getElementById:id=>elements.get(id)};base.window._memberRecordDraft={userId:'customer',role:'MERCHANT'};base.parseMemberRequest=policy.parseMemberRequest;
vm.runInContext(html.slice(html.indexOf('window.fillMemberRecordFromRequest ='),html.indexOf('window.saveMemberRole =')),base);
elements.get('memberRequestPaste').value='اسم المتجر: متجر من الرسالة\nالهاتف: 01098765432\nمعرّف الحساب: wrong';base.window.fillMemberRecordFromRequest('MERCHANT');assert.equal(elements.get('memberRecordName').value,'متجر من الرسالة');assert.match(elements.get('memberPasteNotice').textContent,/مختلف/);elements.get('memberRecordName').value='تعديل يدوي';assert.equal(elements.get('memberRecordName').value,'تعديل يدوي');
console.log('PASS actual paste handler fills editable values, warns account mismatch, never submits');
