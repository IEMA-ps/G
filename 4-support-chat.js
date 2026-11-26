// مساعد على بابك — دعم ذكي بردود تلقائية جوه الموقع.
// الميزة مقفولة وراء مفتاح smartSupportEnabled في «مميزات جديدة».
// الردود من قاعدة أسئلة وأجوبة (الأسئلة المزروعة هنا + اللي الأدمن بيضيفه في supportFaq).
// مفيش ذكاء اصطناعي خارجي ولا تكلفة: مطابقة كلمات مفتاحية عربية على جهاز المستخدم.

export const SMART_SUPPORT_FLAG = 'smartSupportEnabled';

/* ---------- تطبيع النص العربي والمطابقة ---------- */
export function normalizeArabic(s){
  return (s==null?'':String(s)).toLowerCase()
    .replace(/[ً-ْٰـ]/g,'')           // تشكيل وتطويل
    .replace(/[أإآٱ]/g,'ا')
    .replace(/ة/g,'ه')
    .replace(/ى/g,'ي')
    .replace(/ؤ/g,'و')
    .replace(/ئ/g,'ي')
    .replace(/[^ء-ي٠-٩a-z0-9\s]/g,' ')
    .replace(/\s+/g,' ')
    .trim();
}

// وزن السؤال: أطول كلمة مفتاحية مطابقة، ثم عدد المطابقات، ثم مجموع أطوالها (للتعادل).
export function scoreFaq(faq, normalizedQuestion){
  const r = {longest:0, hits:0, total:0};
  if(!normalizedQuestion) return r;
  for(const k of (faq.keys||[])){
    const nk = normalizeArabic(k);
    if(nk && normalizedQuestion.includes(nk)){ r.hits++; r.total += nk.length; if(nk.length > r.longest) r.longest = nk.length; }
  }
  return r;
}

export const MATCH_THRESHOLD = 4;

// يرجع أفضل سؤال مطابق أو null لو مفيش مطابقة كافية.
export function matchFaq(question, faqs){
  const nq = normalizeArabic(question);
  let best = null, bestScore = {longest:0, hits:0, total:0};
  for(const f of (faqs||[])){
    const sc = scoreFaq(f, nq);
    const better = sc.longest > bestScore.longest
      || (sc.longest === bestScore.longest && sc.hits > bestScore.hits)
      || (sc.longest === bestScore.longest && sc.hits === bestScore.hits && sc.total > bestScore.total);
    if(better){ best = f; bestScore = sc; }
  }
  return bestScore.longest >= MATCH_THRESHOLD ? best : null;
}

// دمج الأسئلة المزروعة مع اللي الأدمن ضافه (المضاف يكسب عند التعادل لأنه أحدث).
export function mergeFaqs(seed, remote){
  const out = [...(seed||[])];
  for(const r of (remote||[])){
    if(r && r.q && r.answer && Array.isArray(r.keys) && r.keys.length) out.push(r);
  }
  return out;
}

// أسئلة جاهزة كأزرار حسب الدور. role: customer | merchant | delivery | marketer | admin | guest
export function chipsFor(role, faqs, max = 6){
  const r = role || 'guest';
  const ok = (faqs||[]).filter(f => !f.roles || f.roles.includes(r) || (r!=='guest' && f.roles.includes('user')));
  const roleSpecific = ok.filter(f => f.roles && (f.roles.includes(r) || f.roles.includes('user')));
  const general = ok.filter(f => !f.roles);
  return [...roleSpecific, ...general].slice(0, max);
}

/* ---------- بوابة الزائر (اسم + رقم) ---------- */
export const LEAD_NAME_MIN = 2, LEAD_NAME_MAX = 100, LEAD_Q_MAX = 300;
// رقم مصري: 01xxxxxxxxx مع أو بدون مفتاح 20 / +20 (الصيغة الدولية بدون صفر البداية مقبولة)
export const LEAD_PHONE_RE = /^\+?(20)?0?1[0-9]{9}$/;

// يرجع الرقم بصيغة موحدة 2010xxxxxxxx (بيستخدم كـ id لسجل الزائر) أو null.
export function normalizeLeadPhone(p){
  const d = (p==null?'':String(p)).replace(/[\s-]/g,'');
  const m = d.match(/^\+?(?:20)?0?(1[0-9]{9})$/);
  return m ? ('20' + m[1]) : null;
}

export function validateLead(name, phone){
  const n = (name==null?'':String(name)).trim();
  if(n.length < LEAD_NAME_MIN || n.length > LEAD_NAME_MAX) return {ok:false, error:'اكتب اسمك (من حرفين لـ 100 حرف).'};
  const ph = normalizeLeadPhone(phone);
  if(!ph) return {ok:false, error:'اكتب رقم موبايل مصري صحيح، مثال: 01012345678'};
  return {ok:true, name:n, phone:ph};
}

// حمولات Firestore — createdAt بيتمرر من index.html كـ serverTimestamp().
export function leadPayload({name, phone, createdAt}){
  return {name: String(name).slice(0, LEAD_NAME_MAX), phone, createdAt};
}
export function unansweredPayload({question, role, uid, leadPhone, createdAt}){
  const d = {question: String(question||'').slice(0, LEAD_Q_MAX), role: String(role||'guest').slice(0,20), createdAt};
  if(uid) d.uid = uid;
  if(leadPhone) d.leadPhone = leadPhone;
  return d;
}
// سجل الأسئلة المضافة من الأدمن
export function faqPayload({q, keys, answer, goLabel, goHref, roles, createdAt}){
  const d = {q: String(q||'').trim().slice(0,140), keys: (keys||[]).map(k=>String(k).trim()).filter(Boolean).slice(0,20), answer: String(answer||'').trim().slice(0,600), createdAt};
  if(goLabel && goHref){ d.goLabel = String(goLabel).slice(0,60); d.goHref = String(goHref).slice(0,200); }
  if(Array.isArray(roles) && roles.length) d.roles = roles;
  return d;
}
export function validFaqInput({q, keys, answer}){
  if(!q || String(q).trim().length < 3) return {ok:false, error:'اكتب السؤال (3 أحرف على الأقل).'};
  if(!answer || String(answer).trim().length < 3) return {ok:false, error:'اكتب الإجابة (3 أحرف على الأقل).'};
  const ks = (keys||[]).map(k=>String(k).trim()).filter(Boolean);
  if(!ks.length) return {ok:false, error:'اكتب كلمة مفتاحية واحدة على الأقل عشان المساعد يلاقي السؤال.'};
  return {ok:true, keys: ks};
}

/* ---------- واجهة الشات (HTML builders نقية للاختبار والمعاينة) ---------- */
export function greeting(role, guest, name){
  const hi = name ? `أهلًا ${name} 👋` : 'أهلًا بيك 👋';
  const who = guest ? 'زائرنا الكريم' : ({customer:'عميلنا الكريم', merchant:'تاجرنا الكريم', delivery:'مندوبنا الكريم', marketer:'مسوّقنا الكريم', admin:'يا مسؤول'})[role] || 'بيك';
  return `${hi} أنا مساعد على بابك، ${who}. اسألني عن الطلبات والتسجيل والاشتراكات وأي حاجة عن المنصة، ولو معرفتش الإجابة هحوّلك للدعم على طول.`;
}
export const MISS_TEXT = 'معلش، مش لاقي إجابة دقيقة لسؤالك لسه. سجّلته عند إدارة الموقع، وتقدر كمان تكلم الدعم على واتساب وسؤالك هيتكتب جاهز في الرسالة.';

function msgHTML(esc, m){
  const cls = m.from === 'user' ? 'sc-msg sc-user' : 'sc-msg sc-bot';
  const go = m.go ? `<a class="sc-go" href="javascript:void(0)" onclick="supportGo('${esc(m.go.href)}')">${esc(m.go.label)} <i class="fa-solid fa-arrow-left"></i></a>` : '';
  const wa = m.wa ? `<button class="sc-wa" onclick="supportWa(this.dataset.q)" data-q="${esc(m.wa)}"><i class="fa-brands fa-whatsapp"></i> كلم الدعم على واتساب</button>` : '';
  return `<div class="${cls}"><div class="sc-bubble">${esc(m.text)}${go}${wa}</div></div>`;
}

// نافذة الشات كاملة (بتترندر جوه modalSheet)
export function panelHTML({esc, guest, needLead, msgs, busy, chips, waAvailable, leadError}){
  if(needLead){
    return `<div class="sc-panel" dir="rtl">
      <div class="sc-head"><b><i class="fa-solid fa-headset"></i> مساعد على بابك</b><button class="sc-close" onclick="UI.closeModal()" aria-label="قفل">✕</button></div>
      <div class="sc-body">
        <div class="sc-msg sc-bot"><div class="sc-bubble">أهلًا بيك في على بابك 👋 قبل ما نبدأ، اكتب اسمك ورقم موبايلك عشان لو احتجت مساعدة أكبر، إدارة الموقع تقدر تتواصل معاك.</div></div>
        ${leadError?`<div class="sc-err">${esc(leadError)}</div>`:''}
        <div class="field" style="margin-top:10px"><label>الاسم</label><input id="slName" type="text" maxlength="100" placeholder="اسمك الكريم"></div>
        <div class="field"><label>رقم الموبايل</label><input id="slPhone" type="tel" inputmode="tel" dir="ltr" maxlength="13" placeholder="01xxxxxxxxx"></div>
        <button class="btn btn-primary" onclick="supportLeadSubmit()">ابدأ المحادثة</button>
        <p class="sc-note">رقمك بيتسجل عند إدارة الموقع بس، ومش بيظهر لأي حد تاني.</p>
      </div>
    </div>`;
  }
  const msgsHtml = (msgs||[]).map(m => msgHTML(esc, m)).join('');
  const chipsHtml = (chips||[]).map(c => `<button class="sc-chip" onclick="supportChipAsk('${esc(c.id)}')">${esc(c.q)}</button>`).join('');
  const typing = busy ? `<div class="sc-msg sc-bot"><div class="sc-bubble sc-typing"><span></span><span></span><span></span></div></div>` : '';
  return `<div class="sc-panel" dir="rtl">
    <div class="sc-head"><b><i class="fa-solid fa-headset"></i> مساعد على بابك</b><button class="sc-close" onclick="UI.closeModal()" aria-label="قفل">✕</button></div>
    <div class="sc-body" id="scBody">${msgsHtml}${typing}</div>
    ${chipsHtml?`<div class="sc-chips">${chipsHtml}</div>`:''}
    <div class="sc-input">
      <input id="scInput" type="text" maxlength="300" placeholder="اكتب سؤالك هنا..." onkeydown="if(event.key==='Enter')supportSend()">
      <button class="sc-send" onclick="supportSend()" aria-label="إرسال"><i class="fa-solid fa-paper-plane"></i></button>
    </div>
    ${waAvailable?`<div class="sc-foot"><a href="javascript:void(0)" onclick="supportWa('مرحبًا، أحتاج مساعدة')"><i class="fa-brands fa-whatsapp"></i> تفضل تكلم دعم بشري؟ واتساب</a></div>`:''}
  </div>`;
}

/* ---------- كارت الأدمن (إدارة الأسئلة + المجهولة + الزوار) ---------- */
export function adminCardHTML({esc, faqs, unanswered, leads, waPhone, fmtDay}){
  const fd = fmtDay || (t => t ? new Date(t).toLocaleString('ar-EG') : '—');
  const faqRows = (faqs||[]).map(f => `<div class="sc-admin-row">
      <div><b>${esc(f.q)}</b><div class="sc-admin-sub">${esc((f.keys||[]).join('، '))}</div></div>
      <button class="btn btn-danger btn-sm" style="width:auto" onclick="supportFaqDelete('${esc(f._id)}')"><i class="fa-solid fa-trash"></i></button>
    </div>`).join('') || '<p class="sc-note">لسه مضفتش أسئلة خاصة بيك. المساعد شغال بالفعل بالأسئلة الجاهزة اللي متبرمجة فيه.</p>';
  const grouped = {};
  for(const u of (unanswered||[])){
    const k = normalizeArabic(u.question); if(!k) continue;
    grouped[k] = grouped[k] || {question: u.question, count: 0, ids: [], last: null, who: []};
    grouped[k].count++; grouped[k].ids.push(u._id);
    const who = u.uid ? 'مستخدم مسجّل' : (u.leadPhone ? 'زائر: ' + u.leadPhone : 'زائر');
    if(!grouped[k].who.includes(who)) grouped[k].who.push(who);
  }
  const missRows = Object.values(grouped).sort((a,b)=>b.count-a.count).slice(0,30).map(g => `<div class="sc-admin-row">
      <div><b>${esc(g.question)}</b>${g.count>1?` <span class="badge-chip">×${g.count}</span>`:''}<div class="sc-admin-sub">${esc(g.who.join(' · '))}</div></div>
      <div style="display:flex;gap:6px">
        <button class="btn btn-ghost btn-sm" style="width:auto" onclick="supportAnswerPrefill('${esc(g.question)}')">أضف إجابة</button>
        <button class="btn btn-danger btn-sm" style="width:auto" onclick="supportMissClear('${g.ids.join(',')}')"><i class="fa-solid fa-trash"></i></button>
      </div>
    </div>`).join('') || '<p class="sc-note">مفيش أسئلة مجهولة — كل اللي سأل لاقى إجابة 🎉</p>';
  const leadRows = (leads||[]).map(l => `<div class="sc-admin-row">
      <div><b>${esc(l.name)}</b><div class="sc-admin-sub" dir="ltr">${esc(l.phone)} · ${fd(l.createdAt && l.createdAt.toMillis ? l.createdAt.toMillis() : null)}</div></div>
      ${waPhone?`<a class="btn btn-ghost btn-sm" style="width:auto" target="_blank" rel="noopener" href="https://wa.me/${esc(l.phone)}"><i class="fa-brands fa-whatsapp"></i></a>`:''}
    </div>`).join('') || '<p class="sc-note">لسه مفيش زوار سجّلوا من صفحة البداية.</p>';
  return `<div class="card" style="margin-bottom:16px">
    <h3 style="margin:0 0 10px;font-size:15px"><i class="fa-solid fa-headset" style="color:var(--teal)"></i> مساعد على بابك (الدعم الذكي)</h3>
    <p style="font-size:12.5px;color:var(--ink-soft);line-height:1.8;margin:0 0 12px">المساعد بيرد من الأسئلة الجاهزة المبرمجة فيه + اللي تضيفه هنا. ضيف سؤال بكلماته المفتاحية وإجابته، وهو هيرد بيه على طول. التشغيل من كارت «مميزات جديدة».</p>
    <details style="margin-bottom:14px"><summary style="font-weight:700;font-size:13.5px;cursor:pointer">إضافة سؤال وجواب</summary>
      <div class="field" style="margin-top:10px"><label>السؤال (زي ما هيتعرض)</label><input id="sfQ" type="text" maxlength="140" placeholder="مثال: إزاي أتابع طلبي؟"></div>
      <div class="field"><label>كلمات مفتاحية (افصل بينها بفاصلة)</label><input id="sfKeys" type="text" maxlength="200" placeholder="مثال: أتابع، فين طلبي، حالة الطلب"></div>
      <div class="field"><label>الإجابة</label><textarea id="sfAnswer" rows="3" maxlength="600" placeholder="الرد اللي هيوصل للمستخدم..."></textarea></div>
      <div class="field"><label>زرار يوصل لصفحة (اختياري)</label><input id="sfGo" type="text" maxlength="200" placeholder="مثال: طلباتي|/customer/orders" dir="ltr"></div>
      <button class="btn btn-primary" onclick="supportFaqAdd()">إضافة السؤال</button>
    </details>
    <b style="font-size:13.5px">أسئلة ضفتها (${(faqs||[]).length})</b>
    <div style="margin:8px 0 16px">${faqRows}</div>
    <b style="font-size:13.5px">أسئلة ملهاش إجابة</b>
    <div style="margin:8px 0 16px">${missRows}</div>
    <b style="font-size:13.5px">زوار سجّلوا من صفحة البداية (${(leads||[]).length})</b>
    <div style="margin-top:8px">${leadRows}</div>
  </div>`;
}

/* ---------- الأسئلة الجاهزة ---------- */
// roles: من غيرها = للكل (حتى الزائر). 'user' = أي مسجّل مهما كان دوره.
export const FAQ_SEED = [
  {id:'about', q:'إيه هو على بابك؟', keys:['ايه هو','عن التطبيق','عن الموقع','على بابك ايه','ايه على بابك','ايه المنصه','ايه البرنامج','فكرته','فكره الموقع','بيعمل ايه'],
   answer:'على بابك برنامج بيطلب بيه الناس احتياجات البيت من محلات منطقتهم، والمندوب بيوصّلها لحد الباب. فيه متاجر، خدمات بحجز ميعاد (عيادات، مدرسين، صيانة)، مناديب توصيل، ومسوّقين بيكسبوا معانا.'},
  {id:'signup', q:'إزاي أسجّل حساب؟', keys:['اسجل','تسجيل','حساب جديد','اعمل حساب','انشاء حساب','افتح حساب','الاشتراك في الموقع','ادخل ازاي','سجلني'],
   answer:'من صفحة البداية اختار «حساب جديد»، اكتب اسمك ورقمك وبريدك وكلمة مرور، واختار منطقتك. هيوصلك إيميل تفعيل، افتحه ودوس الرابط وبعدها ادخل عادي. تقدر كمان تسجّل بجوجل.'},
  {id:'signup-cost', q:'التسجيل بفلوس؟', keys:['بفلوس','مجاني','ببلاش','سعر الاشتراك','تكلفه التسجيل','التسجيل مجانا'],
   answer:'التسجيل والطلب للعملاء مجاني تمامًا، بتدفع بس ثمن طلبك كاش عند الاستلام. الاشتراكات المدفوعة خاصة بالتجار ومقدمي الخدمة بس.'},
  {id:'forgot-pass', q:'نسيت كلمة المرور', keys:['نسيت','كلمه المرور','كلمه السر','الباسورد','استعاده','مش فاكر الباسورد','غيار كلمه','اقدرش ادخل'],
   answer:'من صفحة الدخول دوس «نسيت كلمة المرور؟» واكتب بريدك، هيوصلك رابط تعيين كلمة جديدة على إيميلك. لو الإيميل مش بيوصل، بص على الرسائل المزعجة (Spam).'},
  {id:'verify-email', q:'مش بيوصلني إيميل التفعيل', keys:['ايميل التفعيل','تفعيل','التحقق','رساله التاكيد','تأكيد البريد','مبيوصلنيش ايميل','كود التفعيل'],
   answer:'بص الأول على الرسائل المزعجة (Spam) أو التحديثات في إيميلك. لو مش موجود، من شاشة التفعيل دوس «إرسال رابط جديد» بعد دقيقة من آخر محاولة. لازم بريدك يتفعّل قبل الدخول.'},
  {id:'install-app', q:'إزاي أثبّت التطبيق على موبايلي؟', keys:['اثبت','تثبيت','تنزيل','حمل التطبيق','الابليكيشن','علي الموبايل','علي الشاشه','شاشه رئيسيه'],
   answer:'افتح 3alababk.com من المتصفح: في أندرويد من قائمة النقط اختار «تثبيت التطبيق» أو «إضافة إلى الشاشة الرئيسية». في الآيفون من Safari دوس مشاركة وبعدين «إضافة إلى الشاشة الرئيسية»، وهيفتح كأيقونة عندك.'},
  {id:'work-with-us', q:'عايز أشتغل معاكم (تاجر / مندوب / مسوّق)', keys:['اشتغل معاكم','وظيفه','اريد العمل','انضم ليكم','تعاقد','عايز اشتغل معاكم'],
   answer:'سجّل حساب عادي الأول، وبعد الدخول افتح «حسابي»: هتلاقي طلب انضمام كتاجر أو مقدم خدمة، أو مندوب، وطلب الانضمام كمسوّق. اكتب بياناتك وإدارة الموقع بتراجع الطلب وترد عليك.'},
  {id:'human-support', q:'عايز أكلم حد من الدعم', keys:['اكلم حد','بشري','انسان','رقم الدعم','خدمه العملاء','اتصل','اتكلم مع حد','حد يرد عليا'],
   answer:'من تحت دوس «كلم الدعم على واتساب» وهيتفتح شات برسالة جاهزة. الدعم بيرد عليك من هناك.'},
  {id:'payment', q:'الدفع بيتم إزاي؟', keys:['الدفع','ادفع','كاش','فيزا','فلوس الطلب','طريقه الدفع','بطاقه'],
   answer:'الدفع على الطلبات كاش عند الاستلام بس — بتدفع للتاجر أو المندوب لما يوصلك طلبك. مفيش دفع إلكتروني على الطلبات لسه.'},
  {id:'delivery-fee', q:'رسوم التوصيل كام؟', keys:['التوصيل','رسوم','الديليفري','سعر التوصيل','شحن','توصيل بكام'],
   answer:'رسوم التوصيل بتظهرلك بوضوح قبل ما تأكد الطلب، وبتتحسب لكل محل في الطلب. ولو طلبت من أكتر من محل في نفس الطلب بييجي مندوب واحد وبتاخد خصم على رسوم التوصيل.'},
  {id:'coverage', q:'بتشتغلوا في مناطق إيه؟', keys:['المناطق','منطقتي','بتشتغلوا فين','التوصيل عندي','محافظه','بلدي','قريه','مدينه'],
   answer:'بنغطي كل المحافظات ومناطقها — لما تسجّل بتختار محافظتك ومنطقتك، وبيظهرلك المتاجر المسجّلة في منطقتك. لو ملقتش محلات لسه في منطقتك، ده معناه إننا لسه بنكبر هناك.'},
  {id:'change-area', q:'إزاي أغيّر منطقتي؟', keys:['اغير منطقتي','تغيير المنطقه','منطقه غلط','غلطت في المنطقه','عدل منطقتي'], roles:['customer'],
   answer:'من «حسابي» تقدر تعدّل منطقتك. بعد التغيير هتظهرلك متاجر المنطقة الجديدة.'},
  {id:'how-order', q:'إزاي أطلب؟', keys:['اطلب','اعمل طلب','اطلب ازاي','عايز اطلب','ازاي اطلب','طلب جديد','اضيف للسله','السله'], roles:['customer','guest'],
   answer:'من الرئيسية دوس «متاجر» واختار محل من منطقتك، ضيف منتجاتك للسلة، وبعدين راجع السلة وأكد الطلب. هتشوف كل التفاصيل والرسوم قبل التأكيد، والدفع كاش عند الاستلام.'},
  {id:'multi-store', q:'أقدر أطلب من أكتر من محل؟', keys:['اكتر من محل','محلين','محلات كتير','من محلين','تلات محلات','طلب مجمع'], roles:['customer'],
   answer:'أيوه، تقدر تطلب من حتى 3 محلات في نفس الطلب. بيتجمّعوا في سلة واحدة، ومندوب واحد بييجيبهم كلهم، وبتحصل على خصم من رسوم التوصيل.'},
  {id:'track-order', q:'فين طلبي؟ أتابعه إزاي؟', keys:['فين طلبي','اتابع','حاله الطلب','طلبي وصل','الطلب فين','تتبع'], roles:['customer'], go:{label:'طلباتي', href:'/customer/orders'},
   answer:'من صفحة «طلباتي» هتلاقي كل طلب وحالته أول بأول: التاجر قبل، الطلب اتجهّز، المندوب استلم، وهو في الطريق ليك. لو الطلب متأخر كتير كلم الدعم.'},
  {id:'cancel-order', q:'إزاي ألغي طلب؟', keys:['الغي','الغاء','امسح الطلب','مش عايز الطلب','الغاء طلب'], roles:['customer'],
   answer:'تقدر تلغي الطلب من صفحة «طلباتي» طول ما التاجر لسه مقبلوش. لو التاجر قبل بالفعل، كلم الدعم على واتساب وهما يظبطوها مع التاجر. عند الإلغاء المخزون والنقاط والكوبون بيرجعوا تلقائي.'},
  {id:'coupons', q:'إزاي أستخدم كوبون؟', keys:['كوبون','كود خصم','الكوبون مش شغال','كوبون مش شغال'], roles:['customer'],
   answer:'في السلة هتلاقي خانة الكوبون، اكتب الكود ودوس تطبيق، والخصم هيتحسب فورًا على الإجمالي لو الكوبون شغال ومناسب لطلبك.'},
  {id:'points', q:'إيه نقاط الولاء؟', keys:['النقاط','نقاط','الولاء','استبدل نقاط','نقطه'], roles:['customer'],
   answer:'كل طلب بيتسلّم بيكسبك نقاط على قيمته، وتقدر تستبدل النقاط بخصم على طلباتك اللي جاية من السلة. رصيدك بيظهر في «حسابي».'},
  {id:'invite-friend', q:'عايز أدعو صاحبي', keys:['ادعو','دعوه صديق','كود الدعوه','ادعي','صاحبي'], roles:['customer'],
   answer:'من «حسابي» هتلاقي كود الدعوة الخاص بيك، ابعته لصاحبك يسجّل بيه. أول ما يكمّل أول طلب، تاخدوا انتوا الاتنين نقاط هدية.'},
  {id:'weekly-orders', q:'إيه الطلبات الثابتة؟', keys:['الطلبات الثابته','طلب اسبوعي','ثابت','تتكرر','كل اسبوع'], roles:['customer'],
   answer:'لو بتطلب نفس الحاجات كل أسبوع (زي العيش والخضار)، تعملها طلب ثابت من حسابك، ويفكرك التطبيق بيها وقتها، وبتأكدها بضغطة واحدة بدل ما تجمع السلة من الأول.'},
  {id:'group-buy', q:'إيه الشراء الجماعي؟', keys:['الجماعي','شراء جماعي','جماعيه','شارك في شراء'], roles:['customer'],
   answer:'الشراء الجماعي بيخليك تشارك مع ناس تانية في طلب واحد كبير بسعر أقل. بتشوف العروض المتاحة وتنضم، ولما العدد يكمل الطلب بينفذ.'},
  {id:'book-service', q:'إزاي أحجز خدمة (عيادة / مدرس / صيانة)؟', keys:['احجز','حجز','ميعاد','عياده','دكتور','مدرس','صيانه','سباك','كهربائي'], roles:['customer','guest'],
   answer:'من الرئيسية دوس «خدمات» واختار مقدم الخدمة المناسب، هتلاقي مواعيده المتاحة، اختار الميعاد اللي يناسبك وأكد الحجز. في خدمات بتدعم حجز أسبوعي متكرر كمان.'},
  {id:'merchant-signup', q:'إزاي أسجّل محلي؟', keys:['اسجل محلي','اسجل محل','محل عندي','عندي محل','عندي متجر','اسجل متجري','اسجل متجر','افتح متجر','بيع علي الموقع','ابيع في الموقع'], roles:['guest','customer'],
   answer:'سجّل حساب عادي، ومن «حسابي» قدّم طلب انضمام كتاجر واكتب بيانات محلك ونوعه ومكانه. إدارة الموقع بتراجع الطلب، وبعد الموافقة تختار الباقة اللي تناسبك وتبدأ تضيف منتجاتك.'},
  {id:'plans', q:'باقات التجار وأسعارها', keys:['الباقات','الاسعار','باقه','سعر الباقه','اشتراك التاجر','رسوم الاشتراك','الاشتراك بكام','باقه تعريفيه','باقه طلبات'],
   answer:'في نوعين: باقات تعريفية (200 / 400 / 600 جنيه) بتعرض محلك ومنتجاتك من غير طلبات، وباقات طلبات (400 / 800 / 1200 جنيه) بتستقبل بيها طلبات + عمولة 2% للمنصة على الطلب. المدد 3 أو 6 أو 12 شهر، والتفاصيل بتظهر في صفحة الاشتراك من لوحتك.'},
  {id:'subscription-pay', q:'إزاي أدفع اشتراكي؟', keys:['ادفع الاشتراك','فودافون كاش','رقم التحويل','حواله','ادفع باقتي','اشحن الاشتراك'], roles:['merchant'],
   answer:'الاشتراك بيتحوّل فودافون كاش. اطلب رقم التحويل من الدعم على واتساب (من الزرار تحت)، حوّل المبلغ، وبعدين اكتب رقم العملية في صفحة الاشتراك من لوحتك، وإدارة الموقع بتراجع وفعّل اشتراكك.'},
  {id:'add-products', q:'إزاي أضيف منتجاتي؟', keys:['اضيف منتجات','منتجاتي','اضافه منتج','منتج جديد','ارفع منتجات','الاصناف','صور المنتجات'], roles:['merchant'],
   answer:'من لوحة التاجر افتح «منتجاتي»: تقدر تفعّل منتجات جاهزة من الكتالوج المشترك وتحدد سعرك، أو تضيف منتج خاص بيك، أو ترفع شيت إكسل بالأصناف كلها مرة واحدة. الصور اختيارية مش إجبارية.'},
  {id:'store-link', q:'لينك وQR محلي', keys:['لينك محلي','رابط المحل','كيو ار','qr','باركود','اشارك محلي'], roles:['merchant'],
   answer:'من لوحة التاجر هتلاقي زرار «صفحة متجري» وفيه لينك قصير لمحلك + رمز QR جاهز للطباعة، تعلّقه في المحل وخليك على راحتك.'},
  {id:'merchant-notify', q:'إزاي توصلني إشعارات الطلبات؟', keys:['اشعارات الطلبات','اشعار طلب','تليجرام','الاشعارات','يوصلني اشعار','تنبيه'], roles:['merchant','delivery','user'],
   answer:'من زرار «إشعارات الطلبات على تليجرام» في لوحتك: تقدم تربط تليجرام، أو تفعّل «الإشعارات الفورية» على موبايلك من غير حساب تليجرام خالص. على الآيفون لازم تثبّت التطبيق على الشاشة الرئيسية الأول.'},
  {id:'commission', q:'العمولة كام؟', keys:['العموله','عموله','نسبه الموقع','٢٪','2%','عموله الطلب'], roles:['merchant'],
   answer:'عمولة المنصة 2% من قيمة الطلب على باقات الطلبات بس، بتحسبها من أرباحك. الباقات التعريفية ملهاش عمولة لأنها عرض فقط من غير طلبات.'},
  {id:'store-hours', q:'إزاي أحدد مواعيد شغل محلي؟', keys:['مواعيد الشغل','اوقات العمل','وقت الفتح','يقفل امتي','مواعيد العمل'], roles:['merchant'],
   answer:'من لوحتك افتح إعدادات المواعيد وحدد أيام وساعات الشغل. العميل مش هيقدر يطلب برة مواعيدك، وده بيريحك من طلبات وقت الراحة.'},
  {id:'courier-join', q:'إزاي أشتغل مندوب توصيل؟', keys:['اشتغل مندوب','اشتغل في التوصيل','مندوب توصيل','ديليفري','كابتن','ركشه','موتوسيكل'], roles:['guest','customer'],
   answer:'سجّل حساب عادي، ومن «حسابي» قدّم طلب انضمام كمندوب واكتب بياناتك ومنطقتك. إدارة الموقع بتراجع، وبعد الموافقة بتوصلك الطلبات على لوحتك وتبدأ شغل.'},
  {id:'courier-work', q:'إزاي بتوصلني الطلبات كمندوب؟', keys:['طلبات المندوب','استلم طلب','اوصل طلب','حاله التوصيل','فلوس التوصيل'], roles:['delivery'],
   answer:'الطلبات الجديدة في منطقتك بتظهر في لوحتك أول بأول، ولو فعّلت إشعارات تليجرام أو الإشعارات الفورية هيوصلك تنبيه فوري. بتستلم الطلب من المحل وتوصّله، ورسوم التوصيل ليك حسب اتفاقك مع الإدارة.'},
  {id:'marketer-join', q:'إزاي أشتغل مسوّق؟', keys:['اشتغل مسوق','اشتغل مسوقه','مسوق','مسوقه','تسويق','كود المسوق','اكسب فلوس'], roles:['guest','customer'],
   answer:'سجّل حساب عادي، ومن «حسابي» افتح «طلب الانضمام كمسوّق» وهتلاقي شرح المكاسب. قدّم طلبك وإدارة الموقع بتراجعه، وبعد الموافقة يكون ليك كود خاص تسجّل بيه المحلات وتكسب عمولة عن اشتراكاتها.'},
  {id:'marketer-earn', q:'المسوّق بيكسب إزاي؟', keys:['عموله المسوق','اكسب كام','مكسب المسوق','المستويات','برونزي','فضي','ذهبي','نسبه المسوق'], roles:['marketer','guest','customer'],
   answer:'مكسبك على قد تعبك: كل محل يسجّل بكودك ويدفع اشتراك بتحسبلك عمولة نسبتها بتظهر في لوحتك. وليك مستويات (برونزي، فضي، ذهبي) كل ما محلاتك النشطة تزيد نسبتك تعلا. التفاصيل كلها في لوحة المسوّق.'},
  {id:'marketer-withdraw', q:'إزاي أسحب أرباحي كمسوّق؟', keys:['اسحب','السحب','ارباحي','فلوسي','حواله المسوق'], roles:['marketer'],
   answer:'من لوحة المسوّق تقدر تطلب سحب أرباحك لما توصل للحد الأدنى المكتوب في اللوحة، وإدارة الموقع بتراجع الطلب وتوصّلك فلوسك.'},
  {id:'provider-schedule', q:'إزاي أضيف مواعيدي كمقدم خدمة؟', keys:['مواعيدي','اضيف ميعاد','جدول المواعيد','مواعيد العياده','الحجوزات'], roles:['merchant'],
   answer:'من لوحتك افتح قسم المواعيد وحدد أيام ومواعيد شغلك، والعملاء بيشوفوها ويحجزوا فيها. بيوصلك تنبيه بكل حجز جديد، وبتأكد أو تعتذر من اللوحة.'},
  {id:'account-delete', q:'عايز أحذف حسابي', keys:['احذف حسابي','حذف الحساب','امسح حسابي','الغاء الحساب'],
   answer:'كلم الدعم على واتساب من الزرار تحت وهما يساعدوك في حذف الحساب نهائيًا بعد التأكد من هويتك.'},
  {id:'app-problem', q:'حاجة مش شغالة في التطبيق', keys:['مش شغال','مشكله','عطل','بيهنج','مش بيفتح','خطا','مش راضي يفتح','بطيء'],
   answer:'جرب الأول تقفل التطبيق وتفتحه تاني، أو حدّث الصفحة — ساعات الموبايل بيمسك نسخة قديمة. لو المشكلة مستمرة، ابعت للدعم على واتساب صورة أو وصف للمشكلة ونوع موبايلك وهما يتابعوها معاك.'},
  {id:'push-help', q:'إزاي أفعل الإشعارات على موبايلي؟', keys:['افعل الاشعارات','الاشعارات الفوريه','اشعارات الموبايل','مش بتوصلني اشعارات'],
   answer:'من زرار «إشعارات الطلبات على تليجرام» في صفحتك هتلاقي «تفعيل الإشعارات الفورية»، دوسها ووافق على إذن الإشعارات. التفعيل بيتم لكل جهاز لوحده، وعلى الآيفون لازم تضيف الموقع للشاشة الرئيسية الأول من Safari.'}
];
