// Multi-store orders: one delivery trip, one discounted fee, courier pickup/delivery stops.
export const MAX_STORES_PER_ORDER = 3;
export const DEFAULT_MULTI_STORE_DISCOUNT = 30;
const round2 = n => Math.round((Number(n) || 0) * 100) / 100;

export function discountPercent(setting) {
  const n = Number(setting);
  if (setting === undefined || setting === null || setting === '' || !Number.isFinite(n)) return DEFAULT_MULTI_STORE_DISCOUNT;
  return Math.min(100, Math.max(0, n));
}

// Fee = sum of per-store fees, minus the discount percent when the order has 2+ stores.
export function deliveryQuote(storeCount, baseFee, discountSetting) {
  const n = Math.max(0, Math.floor(Number(storeCount) || 0));
  const base = Math.max(0, Number(baseFee) || 0);
  const gross = round2(base * n);
  const percent = n >= 2 ? discountPercent(discountSetting) : 0;
  const discount = round2(gross * percent / 100);
  return { storeCount: n, baseFee: base, gross, percent, discount, net: round2(gross - discount) };
}

// May this store be added to the cart? Existing stores are always fine.
export function canAddStore(cartMerchantIds, merchantId) {
  const ids = new Set(cartMerchantIds);
  return ids.has(merchantId) || ids.size < MAX_STORES_PER_ORDER;
}

const needsPickup = s => s.batchFlow === true && !s.pickedUpAt;

// Group a courier's sub-orders into one trip view: pickups by store, drop-offs by customer order.
export function courierTrip(subs) {
  const active = (subs || []).filter(s => s.status === 'OUT_FOR_DELIVERY');
  const pickupMap = new Map();
  active.filter(needsPickup).forEach(s => {
    const g = pickupMap.get(s.merchantId) || { merchantId: s.merchantId, merchantName: s.merchantName || '', merchantAddress: s.merchantAddress || '', merchantMapUrl: s.merchantMapUrl || '', merchantWhatsapp: s.merchantWhatsapp || '', parts: [] };
    g.parts.push(s); pickupMap.set(s.merchantId, g);
  });
  const orderMap = new Map();
  active.forEach(s => {
    const o = orderMap.get(s.parentOrderId) || { orderId: s.parentOrderId, parts: [], customerName: s.customerName || '', customerPhone: s.customerPhone || '', address: s.deliveryAddress || '' };
    o.parts.push(s); orderMap.set(s.parentOrderId, o);
  });
  const deliveries = [...orderMap.values()].map(o => {
    const goods = round2(o.parts.reduce((a, s) => a + (s.subtotal || 0), 0));
    const first = o.parts[0];
    const fee = Number(first.orderDeliveryFee) || 0;
    const discount = Number(first.orderDiscount) || 0;
    const pending = o.parts.filter(needsPickup).length;
    const expected = Number(first.orderStoreCount) || o.parts.length;
    return { ...o, goods, fee, discount, collect: Math.max(0, round2(goods + fee - discount)), pendingPickups: pending, ready: pending === 0, missingParts: Math.max(0, expected - o.parts.length) };
  });
  return { pickups: [...pickupMap.values()], deliveries, stopCount: pickupMap.size + deliveries.length };
}
