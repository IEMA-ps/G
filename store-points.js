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
