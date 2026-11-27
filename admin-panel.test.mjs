import assert from 'node:assert/strict';import {readFileSync} from 'node:fs';import vm from 'node:vm';
import * as panel from './admin-panel.js';
import * as banMod from './member-ban.js';
const esc=x=>String(x).replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('"','&quot;');
const users=[{_id:'m',role:'MARKETER',firstName:'<script>',referralCode:'MK-A'},{_id:'n',role:'MARKETER',firstName:'مسوق ثان'},{_id:'a',role:'CUSTOMER',referredBy:'m'},{_id:'b',role:'CUSTOMER',referredBy:'m'},{_id:'c',role:'MERCHANT',referredBy:'m'},{_id:'d',role:'CUSTOMER',referredBy:'n'}];
let r=panel.customerAcquisition(users,[{id:'b',referrerId:'n'},{id:'b',referrerId:'n'},{id:'deleted',referrerId:'m'},{id:'m',referrerId:'m'}]);
assert.equal(r.find(x=>x.id==='m').total,1);assert.equal(r.find(x=>x.id==='n').total,2);assert.equal(r.find(x=>x.id==='n').recorded,1);
assert.equal(panel.customerAcquisition([]).length,0);assert.equal(panel.customerAcquisition(users.map(u=>u._id==='a'?{...u,role:'MARKETER'}:u)).find(x=>x.id==='m').total,1);
for(const superAdmin of [true,false]){const nav=panel.adminNavigation('a_users',superAdmin);for(const p of panel.adminPages(superAdmin))assert.match(nav,new RegExp(p[0]));assert.match(nav,/aria-current="page"/);assert.match(panel.adminMenu(superAdmin),/a_recurring/);if(!superAdmin)for(const p of ['a_settings','a_audit','a_dbsetup'])assert.ok(!nav.includes(p));}
let html=panel.acquisitionHTML({users,usersReady:true,status:'ready'},esc);assert.ok(!html.includes('<script>'));assert.match(html,/&lt;script>/);assert.match(panel.acquisitionHTML({users,usersReady:false},esc),/جاري تحميل/);assert.match(panel.acquisitionHTML({users,usersReady:true,status:'error'},esc),/ناقص/);assert.match(panel.acquisitionHTML({users,usersReady:true,status:'legacy'},esc),/غير متاح/);assert.match(panel.acquisitionHTML({users,usersReady:true,status:'ready',search:'no matches'},esc),/لا يوجد/);
const source=readFileSync('index.html','utf8'),S={settings:{},role:'admin',user:{uid:'admin'},allUsers:users,allUsersReady:true,aUserView:'codes',adminAttributionStatus:'ready',adminAttributions:[{id:'b',referrerId:'n'}]};const ctx={...panel,...banMod,Services:{servicesEnabled:()=>false,isServiceProvider:m=>m?.activityType==='عيادات'},S,window:{},document:{},isSuperAdmin:()=>true,esc,emptyState:()=>'',mkRate:()=>0};vm.createContext(ctx);vm.runInContext(source.slice(source.indexOf('function renderAdminUsers(){'),source.indexOf('window.openAssignMemberRole =')),ctx);assert.match(ctx.renderAdminUsers(),/كل مسوق جاب كام عميل ومسوق/);S.aUserView='members';assert.match(ctx.renderAdminUsers(),/قائمة الأعضاء/);S.aUserSearch='MK-A';assert.match(ctx.renderAdminUsers(),/MK-A/);assert.ok(!ctx.renderAdminUsers().includes('مسوق ثان'));S.allUsersError='فشل التحميل';assert.match(ctx.renderAdminUsers(),/role="alert"/);
assert.match(source,/S.role==='admin'\) bn.innerHTML=adminNavigation/);assert.match(source,/if\(isSuperAdmin\(\)\) S.unsubs.push\(onSnapshot\(collection\(db,'signupAttributions'\)/);assert.match(source,/S.adminAttributionStatus='error'/);
console.log('PASS admin navigation for both roles, attribution precedence, deduplication, missing accounts, role changes, XSS, loading/error/legacy/search, actual member renderer and subscription guard');

// Direct marketer recruits are current MARKETER accounts, not invitations or second-level teams.
const team=[{id:'owner',role:'MARKETER',firstName:'صاحب الكود',referralCode:'MK-OWNER'},
{id:'fixed',role:'MARKETER',referredBy:'someoneElse'},
{id:'legacy',role:'MARKETER',referredBy:'owner'},
{id:'conflict',role:'MARKETER',referredBy:'owner'},
{id:'customer',role:'CUSTOMER',referredBy:'owner'},
{id:'store',role:'MERCHANT',referredBy:'owner'},
{id:'indirect',role:'MARKETER',referredBy:'legacy'}];
const proof=[{id:'fixed',referrerId:'owner'},{id:'fixed',referrerId:'owner'},{id:'conflict',referrerId:'someoneElse'},{id:'owner',referrerId:'owner'},{id:'deleted',referrerId:'owner'}];
let owner=panel.customerAcquisition(team,proof).find(r=>r.id==='owner');assert.deepEqual([owner.total,owner.marketers,owner.marketersRecorded,owner.marketersLegacy],[1,2,1,1]);
owner=panel.customerAcquisition(team.map(u=>u.id==='customer'?{...u,role:'MARKETER'}:u),proof).find(r=>r.id==='owner');assert.deepEqual([owner.total,owner.marketers],[0,3]);
assert.match(panel.acquisitionHTML({users:team,attributions:proof,status:'ready',usersReady:true},esc),/مسوق آخر/);console.log('PASS direct marketer recruits: fixed/legacy, precedence, dedup, self/deleted/indirect excluded, current-role transition');

{const m=panel.adminMenu(true);assert.match(m,/adminRefreshApp\(\)/);assert.match(m,/تحديث الصفحة/);assert.match(panel.adminMenu(false),/adminRefreshApp\(\)/);console.log('PASS admin menu refresh button');}

{S.allUsersError="";S.allUsersReady=true;S.allUsers=[{_id:'z1',role:'CUSTOMER',firstName:'محظور',banned:true,bannedReason:'سبب الاختبار'},{_id:'z2',role:'CUSTOMER',firstName:'عادي'}];S.aUserView='members';S.aUserSearch='';S.aUserFilter='ALL';
const all=ctx.renderAdminUsers();assert.match(all,/فك الحظر/);assert.match(all,/حظر العضو/);assert.match(all,/سبب الاختبار/);
S.aUserFilter='BANNED';const only=ctx.renderAdminUsers();assert.match(only,/فك الحظر/);assert.ok(!only.includes('عادي'));
console.log('PASS admin ban list: badge, reason, ban/unban buttons, banned tab');}
