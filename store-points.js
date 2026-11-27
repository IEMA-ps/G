// Per-store loyalty points. Pure helpers, no network or database.
// Each merchant sets two numbers: egpPerPoint (spend this much, get 1 point) and pointValue (EGP off per point when redeemed at that store).
export const LIMITS = {maxEgpPerPoint:10000, maxPointValue:1000};
const num = v => { const n = Number(v); return Number.isFinite(n) ? n : 0; };

// Reads the merchant document field. Anything invalid or incomplete means OFF.
export function config(raw){
  const c = raw && typeof raw === 'object' ? raw : {};
  const egpPerPoint = num(c.egpPerPoint), pointValue = num(c.pointValue);
  const valid = egpPerPoint > 0 && egpPerPoint <= LIMITS.maxEgpPerPoint && pointValue > 0 && pointValue <= LIMITS.maxPointValue;
  return {on: c.on === true && valid, egpPerPoint: valid ? egpPerPoint : 0, pointValue: valid ? pointValue : 0};
}

// Points earned on one delivered sub order (whole points only).
export function earned(subtotal, cfg){
  if(!cfg || !cfg.on) return 0;
  return Math.max(0, Math.floor(num(subtotal) / cfg.egpPerPoint));
}

// What the merchant gives back as a share of each order, in percent (for the merchant to see before saving).
export function cashbackPercent(cfg){
  if(!cfg || !(cfg.egpPerPoint > 0)) return 0;
  return Math.round(cfg.pointValue / cfg.egpPerPoint * 1000) / 10;
}

// Reads the merchant form. Returns the object to save, or {error}.
export function fromForm({on, egpPerPoint, pointValue}){
  if(!on) return {value: {on:false, egpPerPoint:num(egpPerPoint), pointValue:num(pointValue)}};
  const c = config({on:true, egpPerPoint, pointValue});
  if(!c.on) return {error:'اكتب قيمتين صحيحتين: كل كام جنيه = نقطة، وقيمة النقطة بالجنيه'};
  return {value:{on:true, egpPerPoint:c.egpPerPoint, pointValue:c.pointValue}};
}

// Redeem at checkout. balance = customer's points in THIS store, goods = what the customer buys from this store (delivery excluded).
// The merchant pays the discount. Never more points than the balance, never a discount above the goods.
export function redeem(balance, cfg, goods){
  if(!cfg || !cfg.on || !(cfg.pointValue > 0)) return {points:0, discount:0};
  const g = Math.max(0, num(goods));
  const points = Math.max(0, Math.min(Math.floor(num(balance)), Math.floor(g / cfg.pointValue + 1e-9)));
  return {points, discount: Math.round(points * cfg.pointValue * 100) / 100};
}
// Several stores in one cart. use = {storeId:true}, balances = {storeId:points}, goodsBy = {storeId:goods}, cfgBy = {storeId:rawStorePointsField}.
export function planCart({use, balances, goodsBy, cfgBy}){
  const byStore = {}; let total = 0;
  for(const id of Object.keys(goodsBy||{})){
    if(!(use && use[id])) continue;
    const r = redeem((balances||{})[id], config((cfgBy||{})[id]), goodsBy[id]);
    if(r.points > 0){ byStore[id] = r; total += r.discount; }
  }
  return {byStore, total: Math.round(total * 100) / 100};
}
