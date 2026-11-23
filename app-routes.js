// Routes identify screens, never permission. Existing role/rules checks still apply.
export const ROLE_TABS={
 customer:['home','browse','cart','checkout','orders','profile','marketerBenefits','addresses','notifications','wishlist','recurringOrders','groupBuys'],
 merchant:['m_dashboard','m_products','m_orders','m_profile','m_reports','m_subscription','m_statement','notifications'],
 delivery:['d_dashboard','d_history','d_profile','notifications'],
 marketer:['mk_dashboard','mk_merchants','mk_earnings','mk_tools','notifications'],
 admin:['a_dashboard','a_new_orders','a_merchants','a_categories','a_products','a_orders','a_recurring','a_users','a_settlements','a_settings','a_agents','a_coupons','a_reports','a_audit','a_marketers','a_dbsetup','a_subscriptions','notifications']
};
const overrides={marketerBenefits:'work-as-marketer',recurringOrders:'weekly-orders',groupBuys:'group-orders',a_new_orders:'new-orders',a_recurring:'weekly-orders',a_dbsetup:'database',mk_tools:'tools'};
export function pathForTab(tab,role){
 if(!(ROLE_TABS[role]||[]).includes(tab))return null;
 const slug=overrides[tab]||tab.replace(/^(?:mk|m|d|a)_/,'').replaceAll('_','-');
 return '/'+role+'/'+slug;
}
export function routeFromLocation(location,role){
 let hash;try{hash=decodeURIComponent((location.hash||'').slice(1));}catch{return null;}
 if(hash&&(ROLE_TABS[role]||[]).includes(hash))return hash;
 const path=(location.pathname||'/').replace(/\/+$/,'')||'/';
 return (ROLE_TABS[role]||[]).find(t=>pathForTab(t,role)===path)||null;
}
export function routeURL(tab,role,search=''){
 const path=pathForTab(tab,role);return path?path+search:null;
}
export function authRoute(location){
 let h='';try{h=decodeURIComponent((location.hash||'').slice(1));}catch{}
 if(h==='register'||location.pathname.replace(/\/+$/,'')==='/register')return 'register';
 return 'login';
}
export function normalizeLegacy(location){
 let h='';try{h=decodeURIComponent((location.hash||'').slice(1));}catch{return null;}
 if(h==='register'||h==='login')return '/'+h+(location.search||'');
 for(const role of Object.keys(ROLE_TABS)){if(h!=='notifications'&&ROLE_TABS[role].includes(h))return routeURL(h,role,location.search||'');}
 return null; // notifications needs the signed-in role.
}
