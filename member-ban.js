// Ban / unban a member. A ban is a flag on users/{uid}. Admins are never banned and nobody bans themselves.
// The flag blocks sign-in in the app. For it to hold against a user editing his own profile, the Firebase rules must also stop
// users from changing these four fields (see firestore.member-ban.rules.fragment).
export const BAN_FIELDS=['banned','bannedAt','bannedBy','bannedReason'];
export const isBanned=p=>!!p&&p.banned===true&&String(p.role||'').toUpperCase()!=='ADMIN';
export function canBan(actorIsSuper,target,actorUid){
  if(!actorIsSuper||!target)return false;
  const id=target._id||target.id;
  if(!id||id===actorUid)return false;
  return String(target.role||'').toUpperCase()!=='ADMIN';
}
export const cleanReason=v=>String(v??'').replace(/\s+/g,' ').trim().slice(0,200);
export const banPatch=(actorUid,reason,now)=>({banned:true,bannedAt:now,bannedBy:actorUid,bannedReason:cleanReason(reason)});
export const unbanPatch=()=>({banned:false,bannedAt:null,bannedBy:null,bannedReason:''});
export const BANNED_MESSAGE='الحساب ده محظور من على بابك. لو شايف إن ده غلط كلّم الدعم الفني.';
