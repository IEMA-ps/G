// Customer requests stay local until the customer sends the prepared WhatsApp message.
export function requestMessage(kind, data, account) {
  if(!['merchant','delivery','marketer'].includes(kind)) throw new Error('نوع طلب غير صالح');
  const clean = (key, max=120) => String(data[key] || '').trim().replace(/[\r\n\u0000-\u001f]/g,' ').slice(0,max);
  const name=clean('name'),phone=clean('phone',30),area=clean('area',200);
  if(!name || !/^\+?[\d\s()-]{7,25}$/.test(phone) || !area) throw new Error('كمّل الاسم ورقم هاتف صحيح والمنطقة أو العنوان.');
  const lines=[kind==='merchant'?'طلب تسجيل متجر':kind==='marketer'?'طلب الانضمام كمسوّق':'طلب الانضمام كمندوب توصيل',`الاسم: ${name}`,`الهاتف: ${phone}`,`معرّف الحساب: ${account.uid}`,`بريد الحساب: ${account.email || 'غير مضاف'}`];
  if(kind==='merchant'){
    const business=clean('business'),activity=clean('activity');
    if(!business || !activity) throw new Error('كمّل اسم المتجر ونوع النشاط.');
    lines.push(`اسم المتجر: ${business}`,`النشاط: ${activity}`,`العنوان: ${area}`);
    const code=clean('marketerCode',64);if(code) lines.push(`كود المسوّق للمراجعة: ${code}`);
  }else if(kind==='marketer'){
    lines.push(`منطقة العمل: ${area}`);
    const experience=clean('experience',200);if(experience) lines.push(`خبرة سابقة: ${experience}`);
  }else{
    const vehicle=clean('vehicle',50);if(!vehicle) throw new Error('اكتب وسيلة التوصيل.');
    lines.push(`وسيلة التوصيل: ${vehicle}`,`منطقة العمل: ${area}`);
  }
  const notes=clean('notes',400);if(notes) lines.push(`ملاحظات: ${notes}`);
  lines.push('أرغب في متابعة طلبي مع الدعم. حسابي يظل عميلًا حتى مراجعة الإدارة.');
  return lines.join('\n');
}
export function requestForm(kind, profile, available, esc,locationHTML='',typeHTML='') {
  const merchant=kind==='merchant';
  return `<div class="modal-head"><h3>${merchant?'طلب تسجيل متجر':kind==='marketer'?'طلب الانضمام كمسوّق':'طلب الانضمام كمندوب'}</h3><button class="modal-close" onclick="UI.closeModal()" aria-label="إغلاق">×</button></div>
  <p style="font-size:13px;line-height:1.8;margin-bottom:14px">حسابك هيفضل عميل. راجع بياناتك، وبعدها افتح واتساب واضغط إرسال بنفسك. الطلب مش بيتحفظ في التطبيق.</p>
  ${!available?'<div class="hint-box" role="status" style="margin-bottom:12px">الدعم غير متاح حاليًا. رقم الدعم لم يُضبط أو غير صحيح. تقدر تراجع البيانات هنا، لكن فتح واتساب غير متاح.</div>':''}
  <form oninput="document.getElementById('requestPreview').classList.add('hidden')" onsubmit="prepareSupportRequest(event, '${kind}')">
  <div class="field"><label for="rqName">الاسم</label><input id="rqName" name="name" required maxlength="120" autocomplete="name" value="${esc(((profile.firstName||'')+' '+(profile.lastName||'')).trim())}"></div>
  <div class="field"><label for="rqPhone">رقم الهاتف</label><input id="rqPhone" name="phone" required maxlength="30" type="tel" autocomplete="tel" value="${esc(profile.phone||'')}"></div>
  ${merchant?'<div class="field"><label for="rqBusiness">اسم المتجر</label><input id="rqBusiness" name="business" required maxlength="120"></div>'+(typeHTML||'<div class="field"><label for="rqActivity">نوع النشاط</label><input id="rqActivity" name="activity" required maxlength="120"></div>')+'':kind==='marketer'?'<div class="field"><label for="rqExperience">خبرة سابقة في التسويق (اختياري)</label><input id="rqExperience" name="experience" maxlength="200" placeholder="اشتغلت مع إيه قبل كده؟"></div>':'<div class="field"><label for="rqVehicle">وسيلة التوصيل</label><input id="rqVehicle" name="vehicle" required maxlength="50" placeholder="موتوسيكل، دراجة، سيارة..."></div>'}
  ${locationHTML}
  <div class="field"><label for="rqArea">${merchant?'عنوان المتجر التفصيلي':kind==='marketer'?'منطقة العمل':'تفاصيل منطقة العمل'}</label><input id="rqArea" name="area" required maxlength="200"></div>
  ${merchant?`<div class="field"><label for="rqMarketer">كود المسوّق (اختياري)</label><input id="rqMarketer" name="marketerCode" maxlength="64" value="${esc(profile.marketerCode||'')}"></div>`:''}
  <div class="field"><label for="rqNotes">ملاحظات (اختياري)</label><textarea id="rqNotes" name="notes" maxlength="400"></textarea></div>
  <p style="font-size:12px;line-height:1.8;margin-bottom:12px">الرسالة فيها رقم حسابك وبريدك عشان الدعم يقدر يتابع طلبك. ما تكتبش كلمة مرور أو بيانات دفع.</p>
  <p id="requestError" role="alert" style="color:var(--danger)"></p>
  <button class="btn btn-primary" type="submit" ${available?'':'disabled'}>مراجعة الطلب قبل واتساب</button>
  <div id="requestPreview" class="hidden" style="margin-top:16px" aria-live="polite"><h4>الرسالة الجاهزة</h4><pre id="requestText" style="white-space:pre-wrap;overflow-wrap:anywhere;font:inherit;font-size:13px;line-height:1.8;margin:12px 0"></pre><a id="requestWhatsApp" class="btn btn-primary" target="_blank" rel="noopener noreferrer">فتح واتساب لإرسال الطلب</a><p style="font-size:12px;margin-top:8px">واتساب هيفتح بالرسالة جاهزة، بس الطلب مش هيتبعت غير لما تضغط «إرسال» هناك.</p></div>
  </form>`;
}
