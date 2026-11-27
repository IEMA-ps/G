// A merchant, courier or marketer can shop from the same account in a session-only "customer mode".
// The real role stored on the account never changes. A merchant cannot order from their own store.
export const SHOPPING_ROLES=['merchant','delivery','marketer'];
export const canShop=role=>SHOPPING_ROLES.includes(role);
export const ownStoreBlocked=(realRole,profile,merchantId)=>realRole==='merchant'&&!!merchantId&&profile?.merchantId===merchantId;
export const cartHasOwnStore=(realRole,profile,merchantIds)=>(merchantIds||[]).some(id=>ownStoreBlocked(realRole,profile,id));
export const backLabel=role=>role==='merchant'?'رجوع للوحة التاجر':role==='delivery'?'رجوع للوحة المندوب':'رجوع للوحة المسوّق';
