// Marketer launch offer: pure helpers. No network, no database writes.
import {OFFER2_ID,OFFER2_DEFAULTS,offer2Config} from './merchant-plans.js?v=offer2-1';
export {OFFER2_ID,OFFER2_DEFAULTS,offer2Config};
const money=n=>Math.round((Number(n)||0)*100)/100;
// A store counts once, on its first approved subscription that used the new offer. Renewals never count again.
export function paidOfferStores(subs,marketerId){
  const first=new Map();
  for(const x of subs||[]){
    if(x?.status!=='APPROVED'||x.offerId!==OFFER2_ID||x.marketerId!==marketerId||!x.merchantId) continue;
    const prev=first.get(x.merchantId);
    if(!prev||(Number(x.approvedAt)||0)<(Number(prev.approvedAt)||0)) first.set(x.merchantId,x);
  }
  return [...first.values()];
}
export function bonusState(subs,marketerId,settings){
  const cfg=offer2Config(settings),stores=paidOfferStores(subs,marketerId);
  const credited=(subs||[]).some(x=>x?.status==='APPROVED'&&x.marketerId===marketerId&&Number(x.marketerBonus)>0);
  return {cfg,count:stores.length,target:cfg.target,reached:stores.length>=cfg.target,credited,flat:cfg.flat,bonus:cfg.bonus};
}
// Amounts for the subscription being approved now. `subs` are the approved subscriptions BEFORE this one.
export function approvalAmounts({offerId,marketerId,merchantId,subs,settings}){
  if(!marketerId) return null;
  const cfg=offer2Config(settings);
  const ok=(subs||[]).filter(x=>x?.status==='APPROVED'&&x.marketerId===marketerId);
  if(offerId!==OFFER2_ID) return null;
  const had=paidOfferStores(subs,marketerId);
  const isNewStore=!had.some(x=>x.merchantId===merchantId);
  const reachesNow=isNewStore&&had.length+1===cfg.target;
  const alreadyCredited=ok.some(x=>Number(x.marketerBonus)>0);
  return {marketerAmount:cfg.flat,marketerPercent:0,marketerBonus:reachesNow&&!alreadyCredited?cfg.bonus:0};
}
export function bonusCardHTML(state,esc=x=>String(x)){
  const {count,target,reached,credited,flat,bonus}=state,pct=Math.min(100,Math.round(count/target*100));
  const status=credited?'تمت إضافة المكافأة لرصيدك':reached?'تحققت المكافأة، بتتضاف لما الإدارة تؤكد الدفع':'مقفولة لحد '+target+' متاجر';
  return `<section class="card mk-bonus ${reached||credited?'mk-bonus-on':'mk-bonus-locked'}" aria-label="مكافأة ${target} متاجر"><div class="row-between"><b>${target} متاجر = مكافأة ${bonus} ج</b><span class="badge-chip">${credited?'مفعّلة':reached?'متحققة':'مقفولة'}</span></div><p>${esc(status)}</p><b style="display:block">${count} من ${target}</b><progress max="${target}" value="${Math.min(count,target)}" style="width:100%" aria-label="${count} من ${target}"></progress><p class="mk-bonus-note">عن كل متجر دفع اشتراك العرض وأكدته الإدارة: ${flat} ج. المكافأة مرة واحدة، والتجديدات مش بتتحسب في الـ ${target}.</p></section>`;
}
