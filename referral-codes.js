// Referral code lookup without reading other people's user documents.
// referralCodes/{CODE} = {uid}. A user can only create the mirror of their own code. Lookups read ONE doc by code.
export const codeFor=uid=>'MK-'+String(uid||'').toUpperCase();
export const clean=c=>String(c||'').trim().toUpperCase();
export const validCode=c=>/^[A-Z0-9-]{4,64}$/.test(clean(c));
// Returns the uid that owns a code, or null.
export async function lookup(api,db,code){
  const c=clean(code);if(!validCode(c)) return null;
  const s=await api.getDoc(api.doc(db,'referralCodes',c));
  return s.exists()&&typeof s.data().uid==='string'?s.data().uid:null;
}
// Own code, created once per session if missing (self-heal for users created before this existed).
export async function ensureMine(api,db,uid,profile){
  const code=profile&&profile.referralCode?clean(profile.referralCode):codeFor(uid);
  if(code!==codeFor(uid)) return false; // custom codes are mirrored by an admin only
  const ref=api.doc(db,'referralCodes',code);
  const s=await api.getDoc(ref);if(s.exists()) return false;
  await api.setDoc(ref,{uid});return true;
}
// Super admin: mirror every user whose code is missing. Returns how many were written.
export async function backfill(api,db,users,existingIds){
  const have=new Set(existingIds);let n=0,batch=api.writeBatch(db),inBatch=0;
  for(const u of users){
    const id=u._id||u.id;const code=clean(u.referralCode||'');
    if(!id||!validCode(code)||have.has(code)) continue;
    batch.set(api.doc(db,'referralCodes',code),{uid:id});n++;inBatch++;have.add(code);
    if(inBatch>=400){await batch.commit();batch=api.writeBatch(db);inBatch=0;}
  }
  if(inBatch) await batch.commit();
  return n;
}
