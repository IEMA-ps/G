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

export function newMemberRecord(role,input,user,userId,recordId,now,plansV2=false){
  const clean=(k,max=120)=>String(input[k]||'').trim().replace(/[\r\n\u0000-\u001f]/g,' ').slice(0,max);
  const phone=clean('phone',30),whatsapp=clean('whatsapp',30)||phone,name=clean('name');
  if(!name || !/^\+?[\d\s()-]{7,25}$/.test(phone) || !/^\+?[\d\s()-]{7,25}$/.test(whatsapp)) throw Error('invalid-contact');
  const common={id:recordId,phone,ownerId:userId,registeredAt:now,status:'PENDING'};
  if(role==='MERCHANT'){
    const activityType=clean('activity'),address=clean('address',200);
    if(!activityType || !address) throw Error('missing-store-details');
    const map=input.mapLocation||{},location={};for(const k of ['googleMapsUrl','latitude','longitude'])if(map[k]!==undefined)location[k]=map[k];
    return {...common,...location,businessName:name,managerName:clean('manager'),whatsappNumber:whatsapp,email:user.email||'',activityType,address,categoryIds:'',description:clean('description',400),logoUrl:'',coverUrl:'',rating:4.8,totalOrdersCount:0,commissionPercent:null,...(plansV2?{subscriptionModel:'MERCHANT_V2',subPlanType:null}:{})};
  }
  if(role==='DELIVERY'){
    const vehicleType=clean('vehicle',50),area=clean('address',200);
    if(!vehicleType || !area) throw Error('missing-courier-details');
    return {...common,name,whatsapp,vehicleType,area,rating:5,ratingCount:0,ratingSum:0};
  }
  throw Error('invalid-assignment');
}

export async function createMemberRecord({db,doc,runTransaction,actorId,userId,recordId,role,input,now}){
  const type=assignmentType(role);
  if(!type || !actorId || !userId || !recordId) throw Error('invalid-assignment');
  return runTransaction(db,async tx=>{
    const actorRef=doc(db,'users',actorId),userRef=doc(db,'users',userId),recordRef=doc(db,type.collection,recordId);
    const actor=await tx.get(actorRef),user=await tx.get(userRef),record=await tx.get(recordRef);
    const settings=role==='MERCHANT'?await tx.get(doc(db,'settings','app')):null;
    if(record.exists()) throw Error('record-already-exists');
    const patch=assignmentPatch(actor.exists()?actor.data():null,user.exists()?user.data():null,{id:recordId},role,recordId);
    const data=newMemberRecord(role,input,user.data(),userId,recordId,now,settings?.exists() && settings.data().merchantPlansV2===true);
    if(role==='MERCHANT' && input.marketerCode){
      if(!input.marketerId) throw Error('marketer-unavailable');
      const mk=await tx.get(doc(db,'users',input.marketerId));
      const marketer=mk.exists()?mk.data():null;
      if(!marketer || marketer.role!=='MARKETER' || marketer.referralCode!==input.marketerCode) throw Error('marketer-unavailable');
      data.marketerId=input.marketerId;data.marketerName=((marketer.firstName||'')+' '+(marketer.lastName||'')).trim();data.marketerSince=now;
    }
    tx.set(recordRef,data);tx.update(userRef,patch);
  });
}

export function memberRecordForm(user,role,esc,locationHTML='',mapHTML='',typeHTML=''){
  const merchant=role==='MERCHANT',type=assignmentType(role),person=((user.firstName||'')+' '+(user.lastName||'')).trim();
  const field=(id,label,value='',attrs='')=>`<div class="field"><label for="${id}">${label}</label><input id="${id}" value="${esc(value)}" ${attrs}></div>`;
  return `<div class="modal-head"><h3>إنشاء ${merchant?'متجر':'سجل مندوب'} وتعيين العضو</h3><button class="modal-close" onclick="UI.closeModal()" aria-label="إغلاق">×</button></div>
  <p style="font-size:13px;line-height:1.8;margin-bottom:12px">حساب العضو: <b>${esc(person||user.email||'')}</b>. انقل بيانات طلب واتساب هنا، فالطلب لا يُحفظ داخل التطبيق.</p>
  <div class="field"><label for="memberRequestPaste">الصق رسالة طلب واتساب (اختياري)</label><textarea id="memberRequestPaste" maxlength="12000" rows="4" oninput="fillMemberRecordFromRequest('${role}')" placeholder="طلب تسجيل متجر أو طلب الانضمام كمندوب..."></textarea></div>
  <p id="memberPasteNotice" role="status" style="font-size:12px;line-height:1.8;margin-bottom:12px">تُملأ الحقول المعروفة فقط. راجعها وعدّلها قبل الإنشاء. لا يتم إرسال الرسالة أو حفظها.</p>
  ${field('memberRecordName',merchant?'اسم المتجر كما في طلب واتساب':'اسم المندوب',merchant?'':person,'required maxlength="120"')}
  ${merchant?field('memberRecordManager','اسم المسؤول',person,'maxlength="120"'):''}
  ${field('memberRecordPhone','رقم الهاتف',user.phone||'','required type="tel" maxlength="30"')}
  ${field('memberRecordWhatsapp','واتساب (اختياري، يستخدم الهاتف إذا تُرك فارغًا)',user.phone||'','type="tel" maxlength="30"')}
  ${merchant?(typeHTML||field('memberRecordActivity','نوع النشاط','','required maxlength="120"')):field('memberRecordVehicle','وسيلة التوصيل','','required maxlength="50"')}
  ${locationHTML}
  ${mapHTML}
  ${field('memberRecordAddress',merchant?'عنوان المتجر':'منطقة العمل','','required maxlength="200"')}
  ${merchant?field('memberRecordMarketer','كود المسوّق للمراجعة (اختياري)','','maxlength="64" autocomplete="off"'):''}
  ${merchant?field('memberRecordDescription','وصف المتجر (اختياري)','','maxlength="400"'):''}
  <div class="hint-box" style="font-size:12px;line-height:1.8;margin-bottom:12px">السجل الجديد قيد المراجعة، وليس نشطًا. لا اشتراك أو تحصيل تلقائي. سيدخل العضو بنفس حسابه كـ${type.label}.</div>
  <p id="memberRecordError" role="alert" style="color:var(--danger);font-size:13px"></p>
  <button id="memberRoleSave" class="btn btn-primary" onclick="saveMemberRole('${esc(user._id)}','${role}')">إنشاء ${merchant?'المتجر':'سجل المندوب'} وربط العضو</button>`;
}

// Parse only the app's known request labels. The pasted text is never executable.
export function parseMemberRequest(text,role){
  const labels={'كود المسوّق للمراجعة':'marketerCode','الاسم':'person','الهاتف':'phone','اسم المتجر':'business','النشاط':'activity','العنوان':'address','وسيلة التوصيل':'vehicle','منطقة العمل':'address','ملاحظات':'notes','معرّف الحساب':'accountId','بريد الحساب':'accountEmail'};
  const parsed={};
  for(const line of String(text||'').slice(0,12000).split(/\r?\n/)){
    const match=line.match(/^\s*([^:：]+)\s*[:：]\s*(.*?)\s*$/);if(!match) continue;
    const key=labels[match[1].trim()];if(key && match[2])parsed[key]=match[2].replace(/[\u0000-\u001f]/g,' ').slice(0,key==='notes'?400:200);
  }
  const fields={};
  if(role==='MERCHANT'){if(parsed.business)fields.name=parsed.business;if(parsed.person)fields.manager=parsed.person;if(parsed.activity)fields.activity=parsed.activity;if(parsed.marketerCode)fields.marketerCode=parsed.marketerCode.toUpperCase();}
  if(role==='DELIVERY'){if(parsed.person)fields.name=parsed.person;if(parsed.vehicle)fields.vehicle=parsed.vehicle;}
  if(parsed.phone){fields.phone=parsed.phone;fields.whatsapp=parsed.phone;}
  if(parsed.address)fields.address=parsed.address;
  return {fields,accountId:parsed.accountId||'',accountEmail:parsed.accountEmail||''};
}
