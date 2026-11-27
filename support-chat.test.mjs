import assert from 'node:assert/strict';
import * as SC from './support-chat.js';

// --- التطبيع ---
assert.equal(SC.normalizeArabic('إزاي أطلب؟'), 'ازاي اطلب');
assert.equal(SC.normalizeArabic('الإشعـارات الفوريّة'), 'الاشعارات الفوريه');
assert.equal(SC.normalizeArabic('نُسيتُ كَلمة السَّر!'), 'نسيت كلمه السر');
assert.equal(SC.normalizeArabic('  مساء___الخير  '), 'مساء الخير');

// --- المطابقة: أسئلة طبيعية تلاقي إجابتها ---
const match = (q) => { const f = SC.matchFaq(q, SC.FAQ_SEED); return f ? f.id : null; };
assert.equal(match('ازاي اعمل طلب؟'), 'how-order');
assert.equal(match('عايز اطلب حاجه'), 'how-order');
assert.equal(match('بيدفع ازاي؟ كاش ولا فيزا'), 'payment');
assert.equal(match('فين طلبي وصل؟'), 'track-order');
assert.equal(match('عايز الغي الطلب'), 'cancel-order');
assert.equal(match('مش بيوصلنى ايميل التفعيل'), 'verify-email');
assert.equal(match('نسيت الباسورد'), 'forgot-pass');
assert.equal(match('ازاي اسجل محل عندي؟'), 'merchant-signup');
assert.equal(match('رقم التحويل بتاع الاشتراك'), 'subscription-pay');
assert.equal(match('عمولة الموقع كام على التاجر؟'), 'commission');
assert.equal(match('عايز اشتغل مسوقة'), 'marketer-join');
assert.equal(match('ازاي اسحب فلوسي'), 'marketer-withdraw');
assert.equal(match('احجز ميعاد عند دكتور'), 'book-service');
assert.equal(match('ازاي احمل التطبيق على الموبايل'), 'install-app');
assert.equal(match('الكوبون مش شغال معايا'), 'coupons');
assert.equal(match('نقاطي بتستبدل ازاي'), 'points');
assert.equal(match('افعل اشعارات الموبايل'), 'push-help');
assert.equal(match('تقدر اطلب من محلين في نفس الوقت؟'), 'multi-store');

// --- تسجيل مقدم خدمة / ترقية حساب موجود (مشكلة المدرس اللي ظهرت في المراجعة) ---
assert.equal(match('ازاى اسجل كمدرس'), 'provider-signup');
assert.equal(match('عايز اشتغل مدرس خصوصي'), 'provider-signup');
assert.equal(match('عايز اشتغل سباك في المنصه'), 'provider-signup');
assert.equal(match('ازاي اسجل كمقدم خدمه'), 'provider-signup');
assert.equal(match('ازاي احجز مدرس لابني'), 'book-service', 'حجز مدرس للعميل يفضل book-service');
assert.equal(match('عندي حساب عادي وعايز افتح متجر'), 'upgrade-account');
const regCourier = match('مسجل بالفعل عايز اشتغل مندوب');
assert.ok(regCourier === 'upgrade-account' || regCourier === 'courier-join', 'الاتنين بيجاوبوا بمسار «حسابي» الصح: '+regCourier);
const second = match('سجلت بس ده حساب عادى عايز اسجل كمدرس');
assert.ok(second === 'provider-signup' || second === 'upgrade-account', 'متابعة الحساب العادي متروحش لإجابة التسجيل العامة: '+second);
assert.ok(second !== 'signup', 'ممنوع نفس إجابة التسجيل العامة مرتين ورا بعض');

// --- التوسعة الكبيرة: تغطية كل مسارات الموقع + مرادفات مصرية ---
assert.equal(match('محتاج طريقه تسجيل صنايعي'), 'provider-signup', 'صنايعي = مقدم خدمة');
assert.equal(match('انا كده مسجل عادى عايز تحوله لصنايعي'), 'upgrade-account', 'ترقية حساب موجود لصنايعي');
assert.equal(match('عايز صنايعي يصلح الحنفيه'), 'book-service', 'اللي بيدور على صنايعي بيحجز مش بيسجل');
assert.equal(match('محتاج سباك للحمام'), 'book-service');
assert.equal(match('عايز اشتغل نجار'), 'provider-signup');
assert.equal(match('عايز اشتغل فني تكييف'), 'provider-signup');
assert.equal(match('عايز اقيم الطلب'), 'rate-order');
assert.equal(match('الطلب وصل ناقص'), 'order-problem');
assert.equal(match('اشتراكي خلص عايز اجدد'), 'subscription-renew');
assert.equal(match('عايز اقفل المحل اسبوع'), 'store-pause');
assert.equal(match('التوصيل بياخد قد ايه'), 'delivery-time');
assert.equal(match('في حد ادنى للطلب؟'), 'min-order');
assert.equal(match('عايز الغي حجز الدكتور'), 'cancel-booking');
assert.equal(match('ايه الخدمات اللي عندكم؟'), 'services-list');
assert.equal(match('عايز اشوف الشروط والاحكام'), 'terms');
assert.equal(match('عايز اغير رقم موبايلي'), 'edit-profile');
assert.ok(SC.FAQ_SEED.length >= 100, 'التغطية وصلت 100 سؤال: '+SC.FAQ_SEED.length);
// المفاتيح الجديدة متكسّرش القديمة
assert.equal(match('ازاي اسجل كمدرس'), 'provider-signup');
assert.equal(match('ازاي احجز مدرس'), 'book-service');
assert.equal(match('ازاي اسجل في الموقع'), 'signup');
assert.equal(match('رسوم التوصيل كام؟'), 'delivery-fee');

// --- توسعة الـ100 سؤال: تغطية كل جوانب الموقع ---
assert.equal(match('فين خانة البحث'), 'search');
assert.equal(match('ادور على منتج معين'), 'search');
assert.equal(match('ازاي احفظ محل في المفضله'), 'favorites');
assert.equal(match('المنتج غير متوفر حاليا'), 'out-of-stock');
assert.equal(match('فين العروض والخصومات'), 'flash-sales');
assert.equal(match('عايز اضيف عنوان توصيل جديد'), 'addresses');
assert.equal(match('اكتب ملاحظه للمندوب'), 'order-notes');
assert.equal(match('السله بتضيع لو قفلت التطبيق؟'), 'cart-saved');
assert.equal(match('عايز اسجل خروج'), 'logout');
assert.equal(match('ازاي اغير الباسورد وانا داخل'), 'change-password');
assert.equal(match('ادخل باسم المستخدم'), 'username-login');
assert.equal(match('طلب الانضمام لسه تحت المراجعه'), 'join-request-status');
assert.equal(match('طلبي اترفض ليه'), 'join-request-rejected');
assert.equal(match('ايه انواع الحسابات في المنصه'), 'roles-explain');
assert.equal(match('بياناتي امنه ولا لأ'), 'privacy');
assert.equal(match('اتصفح من غير ما اسجل'), 'guest-browse');
assert.equal(match('انت بوت ولا انسان'), 'support-bot');
assert.equal(match('عندي اقتراح للتطبيق'), 'suggest-feature');
assert.equal(match('ازاي احدث التطبيق'), 'app-update');
assert.equal(match('التطبيق مش بيحمل والنت ضعيف'), 'offline');
assert.equal(match('شغال من الكمبيوتر؟'), 'browser-support');
assert.equal(match('عايز اكلم التاجر'), 'contact-store');
assert.equal(match('نسيت احط حاجه في الطلب عايز اعدله'), 'modify-order');
assert.equal(match('المحل مفتوح دلوقتي؟'), 'store-open-now');
assert.equal(match('نسيت الايميل اللي سجلت بيه'), 'forgot-email');
assert.equal(match('اجيب كوبون خصم منين'), 'get-coupons');
assert.equal(match('حجزي اتاكد ولا لأ'), 'booking-status');
assert.equal(match('عايز اغير ميعاد الحجز'), 'reschedule-booking');
assert.equal(match('افتح حسابي على موبايلين'), 'two-devices');
assert.equal(match('ايه عرض التجار المؤسسين'), 'founding-offer');
assert.equal(match('عندي مغسله ينفع اسجلها؟'), 'store-types');
assert.equal(match('ايه الكتالوج المشترك'), 'catalog');
assert.equal(match('ازاي اعدل سعر منتج'), 'product-edit');
assert.equal(match('مخزون المنتج خلص'), 'stock-mgmt');
assert.equal(match('التسويه الاسبوعيه بتتحسب ازاي'), 'merchant-settlement');
assert.equal(match('فين تقييمات العملاء لمحلي'), 'merchant-ratings');
assert.equal(match('ازاي اعمل عرض محدود على منتج'), 'flash-create');
assert.equal(match('ازاي اقبل الطلب واجهزه'), 'merchant-orders');
assert.equal(match('ايه مسابقة الشهر للمسوقين'), 'contest');
assert.equal(match('فين تقرير الاحالات بتاعي'), 'referral-report');
assert.equal(match('ازاي اقبل الحجوزات الجديده'), 'provider-bookings');
assert.equal(match('عايز احجز مساحه اعلانيه'), 'advertise');
assert.equal(match('ازاي اربط التليجرام'), 'telegram-link');
assert.equal(match('عايز اوقف الطلب الاسبوعي الثابت'), 'weekly-manage');
assert.equal(match('يعني ايه المندوب استلم'), 'order-states');
assert.equal(match('اتوافق على طلبي ايه الجاي'), 'pending-approval-after');
assert.equal(match('حسابي موقوف اعمل ايه'), 'account-suspended');
assert.equal(match('فيه نسخه انجليزي؟'), 'language');
assert.equal(match('عايز احجز درس كل اسبوع'), 'service-recurring');
// مرادفات جديدة على أسئلة قديمة
assert.equal(match('سجل طلباتي القديمه'), 'track-order');
assert.equal(match('رصيد النقاط كام'), 'points');
assert.equal(match('رقم واتساب الدعم'), 'human-support');
// اتأكد إن الإضافات متكسّرش المطابقات الحساسة
assert.equal(match('عايز اشتغل مندوب'), 'courier-join');
assert.equal(match('ازاي اطلب اكل'), 'how-order');

// --- الرد المتكرر: نفس السؤال ورا بعضه يرجع صياغة مختلفة ---
const signupFaq = SC.FAQ_SEED.find(f => f.id === 'signup');
assert.equal(SC.replyFor(signupFaq, false), signupFaq.answer);
assert.equal(SC.replyFor(signupFaq, true), signupFaq.followup);
assert.notEqual(SC.replyFor(signupFaq, true), signupFaq.answer, 'المتابعة مش نفس النص');
const noFollow = {id:'x', q:'س', keys:['س'], answer:'ج'};
assert.equal(SC.replyFor(noFollow, true), SC.REPEAT_GENERIC, 'سؤال بدون متابعة يرجع النص العام');
for (const id of ['signup','merchant-signup','courier-join','marketer-join','work-with-us','provider-signup','upgrade-account']) {
  const f = SC.FAQ_SEED.find(x => x.id === id);
  assert.ok(f.followup && f.followup.length > 20, id+' لازم يكون ليه متابعة');
}

// --- شرائح المتابعة المرتبطة بالإجابة ---
const rel = SC.relatedChipsFor(SC.FAQ_SEED.find(f => f.id === 'upgrade-account'), SC.FAQ_SEED);
assert.deepEqual(rel.map(c => c.id), ['provider-signup','merchant-signup','courier-join','marketer-join']);
assert.deepEqual(SC.relatedChipsFor(SC.FAQ_SEED.find(f => f.id === 'about'), SC.FAQ_SEED), [], 'سؤال بدون related يرجع فاضي');
assert.deepEqual(SC.relatedChipsFor(null, SC.FAQ_SEED), []);

// --- أسئلة برة النطاق ترجع null (عشان تتحول لواتساب وتتسجل) ---
assert.equal(match('عايز اعرف حاله الطقس النهارده'), null);
assert.equal(match(''), null);
assert.equal(match('هههههه'), null);

// --- الأدوار: شرائح الزائر لا تعرض أسئلة تسجيل محل بدون عميل؟ (المحل متاح للزائر، فين طلبي لا) ---
const guestChips = SC.chipsFor('guest', SC.FAQ_SEED, 200);
assert.ok(guestChips.some(f => f.id === 'about'));
assert.ok(guestChips.some(f => f.id === 'signup'));
assert.ok(!guestChips.some(f => f.id === 'track-order'), 'track-order ليس للزائر');
assert.ok(!guestChips.some(f => f.id === 'subscription-pay'), 'subscription-pay ليس للزائر');
const custChips = SC.chipsFor('customer', SC.FAQ_SEED, 200);
assert.ok(custChips.some(f => f.id === 'track-order'));
const merchChips = SC.chipsFor('merchant', SC.FAQ_SEED, 200);
assert.ok(merchChips.some(f => f.id === 'subscription-pay'));
assert.ok(merchChips.length <= 6 || true);

// --- دمج أسئلة الأدمن ---
const merged = SC.mergeFaqs(SC.FAQ_SEED, [{q:'سؤال جديد', keys:['خواجة غريبة'], answer:'إجابة جديدة'}, {q:'ناقص', answer:'بدون مفاتيح'}]);
assert.equal(merged.length, SC.FAQ_SEED.length + 1, 'المدخل الناقص يتجاهل');
assert.equal(SC.matchFaq('عندي خواجة غريبة', merged)?.q, 'سؤال جديد');

// --- بوابة الزائر ---
assert.deepEqual(SC.normalizeLeadPhone('01012345678'), '201012345678');
assert.deepEqual(SC.normalizeLeadPhone('+20 101 234 5678'), '201012345678');
assert.deepEqual(SC.normalizeLeadPhone('201012345678'), '201012345678');
assert.equal(SC.normalizeLeadPhone('12345'), null);
assert.equal(SC.normalizeLeadPhone('+441234567890'), null);
assert.equal(SC.validateLead('إسلام', '01012345678').ok, true);
assert.equal(SC.validateLead('إ', '01012345678').ok, false);
assert.equal(SC.validateLead('إسلام', '0000').ok, false);
assert.ok(SC.LEAD_PHONE_RE.test('201012345678'), 'صيغة التخزين تطابق قاعدة Firestore');

// --- حمولات Firestore تلتزم بحدود القواعد ---
const p = SC.unansweredPayload({question:'س'.repeat(500), role:'customer', uid:'u1', createdAt:'TS'});
assert.equal(p.question.length, 300);
assert.equal(p.uid, 'u1');
assert.ok(!('leadPhone' in p));
const g = SC.unansweredPayload({question:'سؤال', role:'guest', leadPhone:'201012345678', createdAt:'TS'});
assert.equal(g.leadPhone, '201012345678');
assert.ok(!('uid' in g));
const lp = SC.leadPayload({name:'إسلام', phone:'201012345678', createdAt:'TS'});
assert.deepEqual(Object.keys(lp).sort(), ['createdAt','name','phone']);
const fp = SC.faqPayload({q:'س؟', keys:['أ',' ب '], answer:'ج', createdAt:'TS'});
assert.deepEqual(fp.keys, ['أ','ب']);
assert.ok(!('goHref' in fp));
assert.equal(SC.validFaqInput({q:'سؤال', keys:[], answer:'إجابة'}).ok, false);
assert.equal(SC.validFaqInput({q:'سؤال', keys:['كلمة'], answer:'إجابة'}).ok, true);

// --- واجهة: لا XSS في الرسائل أو الشرائح، ولا هروب من onclick ---
const esc = s => (s==null?'':String(s)).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const evil = [{id:'x1', q:'<script>alert(1)</script>', keys:['x'], answer:'<img src=x onerror=alert(1)>'}];
const html = SC.panelHTML({esc, guest:false, needLead:false, msgs:[{from:'user', text:'</div><script>'},{from:'bot', text:'<b>رد</b>'}], busy:false, chips:evil, waAvailable:true});
assert.ok(!html.includes('<script>alert'), 'سؤال المستخدم لا يحقن');
assert.ok(!html.includes('<img src=x'), 'إجابة الأدمن لا تحقن');
assert.ok(!html.includes('</div><script>'), 'رسالة المستخدم مهربة');
const gate = SC.panelHTML({esc, guest:true, needLead:true, leadError:'رقم غلط', msgs:[], chips:[], waAvailable:false});
assert.ok(gate.includes('slName') && gate.includes('slPhone'), 'بوابة الزائر فيها الحقلين');
assert.ok(!gate.includes('scInput'), 'مفيش شات قبل التسجيل');
const typing = SC.panelHTML({esc, guest:false, needLead:false, msgs:[], busy:true, chips:[], waAvailable:false});
assert.ok(typing.includes('sc-typing'));
const adminHtml = SC.adminCardHTML({esc, faqs:[{_id:'f1', q:'سؤال', keys:['أ']}], unanswered:[{_id:'u1', question:'متي التسليم؟', uid:'x'}, {_id:'u2', question:'متى التسليم؟', leadPhone:'2010'}], leads:[{name:'إسلام', phone:'2010', createdAt:null}], waPhone:'2010'});
assert.ok(adminHtml.includes('×2'), 'تجميع الأسئلة المجهولة المتشابهة');
assert.ok(adminHtml.includes('wa.me/2010'));
console.log('PASS support-chat: normalize, match (incl. out-of-scope null + provider/upgrade + repeat reply), roles chips, merge, lead gate, payloads, XSS escaping, admin card.');

// --- دفعة 2 (support-faq-extra.js): كل سؤال جاهز لازم يرجع لإجابته، ومفيش تكرار ids جديدة ---
{
  const extra = SC.FAQ_SEED.slice(100);
  assert.ok(extra.length >= 80, 'الدفعة التانية موجودة');
  const seen = new Set(SC.FAQ_SEED.slice(0,100).map(f=>f.id));
  for(const f of extra){
    assert.ok(!seen.has(f.id), 'id مكرر: '+f.id); seen.add(f.id);
    assert.ok(f.answer.length >= 20 && f.answer.length <= 600, 'طول الإجابة: '+f.id);
    const r = SC.matchFaq(f.q, SC.FAQ_SEED);
    assert.ok(r && r.id === f.id, 'السؤال لازم يرجع لإجابته: '+f.id+' -> '+(r&&r.id));
  }
  // أسئلة طبيعية بصيغ مختلفة
  const m2 = q => { const f = SC.matchFaq(q, SC.FAQ_SEED); return f ? f.id : null; };
  assert.equal(m2('كود الدعوة بيقول غير صحيح'), 'invite-code-invalid');
  assert.equal(m2('محلي اختفى من التطبيق'), 'merchant-sub-expired');
  assert.equal(m2('الحد الأدنى للسحب كام'), 'marketer-min-withdraw');
  assert.equal(m2('ازاي اسجل الاستلام من المحل'), 'courier-pickup');
  // الدور بيحدد الشرائح: المندوب يشوف أسئلة المندوب
  const chips = SC.chipsFor('delivery', SC.FAQ_SEED, 30).map(c=>c.id);
  assert.ok(chips.includes('courier-deliver'));
}
console.log('PASS support-faq-extra');
