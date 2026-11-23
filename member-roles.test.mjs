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
const base={S:{allUsers:[{_id:'customer',firstName:'اسم',role:'CUSTOMER'}],allMerchants:[{id:'r',businessName:'متجر تجربة'}],allDeliveryAgents:[]},esc:s=>String(s),emptyState:()=>'',mkRate:()=>0,isSuperAdmin:()=>true,window:{},assignmentType:policy.assignmentType};
let modal='';base.UI={openModal:s=>modal=s,toast(){}};vm.createContext(base);
vm.runInContext(html.slice(html.indexOf('function renderAdminUsers()'),html.indexOf('window.promoteToAdmin =')),base);
assert.match(base.renderAdminUsers(),/تعيين تاجر/);assert.match(base.renderAdminUsers(),/تعيين مندوب/);
base.window.openAssignMemberRole('customer','MERCHANT');assert.match(modal,/تأكيد تعيين تاجر/);assert.match(modal,/متجر تجربة/);
base.window.openAssignMemberRole('customer','DELIVERY');assert.match(modal,/لا يوجد سجل/);assert.doesNotMatch(modal,/memberRoleSave/);
base.isSuperAdmin=()=>false;assert.doesNotMatch(base.renderAdminUsers(),/openAssignMemberRole/);
console.log('PASS role policy, transaction write pair, admin-only UI, picker and empty state; no external requests');
