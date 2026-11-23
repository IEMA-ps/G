// Role changes keep the user and owned operational record in sync.
export const assignmentType = role => role==='MERCHANT'
  ? {collection:'merchants',field:'merchantId',label:'تاجر',recordLabel:'المتجر'}
  : role==='DELIVERY' ? {collection:'deliveryAgents',field:'deliveryAgentId',label:'مندوب توصيل',recordLabel:'المندوب'} : null;

export function assignmentPatch(actor,user,record,role,id){
  if(actor?.role!=='ADMIN' || actor.adminRole==='STAFF') throw Error('super-required');
  if(!user || user.role!=='CUSTOMER' || user.merchantId || user.deliveryAgentId) throw Error('customer-required');
  if(!assignmentType(role) || !record || record.id!==id || record.ownerId) throw Error('record-unavailable');
  return {role,merchantId:role==='MERCHANT'?id:null,deliveryAgentId:role==='DELIVERY'?id:null};
}

export async function assignMemberRole({db,doc,runTransaction,actorId,userId,recordId,role}){
  const type=assignmentType(role);
  if(!type || !actorId || !userId || !recordId) throw Error('invalid-assignment');
  return runTransaction(db,async tx=>{
    const actorRef=doc(db,'users',actorId),userRef=doc(db,'users',userId),recordRef=doc(db,type.collection,recordId);
    const actor=await tx.get(actorRef),user=await tx.get(userRef),record=await tx.get(recordRef);
    const patch=assignmentPatch(actor.exists()?actor.data():null,user.exists()?user.data():null,record.exists()?record.data():null,role,recordId);
    tx.update(userRef,patch);
    tx.update(recordRef,{ownerId:userId});
  });
}
