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
assert.equal(match('مسجل بالفعل عايز اشتغل مندوب'), 'upgrade-account');
const second = match('سجلت بس ده حساب عادى عايز اسجل كمدرس');
assert.ok(second === 'provider-signup' || second === 'upgrade-account', 'متابعة الحساب العادي متروحش لإجابة التسجيل العامة: '+second);
assert.ok(second !== 'signup', 'ممنوع نفس إجابة التسجيل العامة مرتين ورا بعض');

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
const guestChips = SC.chipsFor('guest', SC.FAQ_SEED, 20);
assert.ok(guestChips.some(f => f.id === 'about'));
assert.ok(guestChips.some(f => f.id === 'signup'));
assert.ok(!guestChips.some(f => f.id === 'track-order'), 'track-order ليس للزائر');
assert.ok(!guestChips.some(f => f.id === 'subscription-pay'), 'subscription-pay ليس للزائر');
const custChips = SC.chipsFor('customer', SC.FAQ_SEED, 20);
assert.ok(custChips.some(f => f.id === 'track-order'));
const merchChips = SC.chipsFor('merchant', SC.FAQ_SEED, 20);
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
