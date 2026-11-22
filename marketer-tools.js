/* Marketer tools. Sharing opens a composer; nothing is posted automatically. */
export function createMarketerTools({state, ui, escape, callBackend}){
  const e=escape;
  let data=null, loading=false, loadError=false;
  const code=()=>state().profile?.referralCode||'';
  const link=()=>{const u=new URL('https://3ala-babk.vercel.app/');u.searchParams.set('marketer',code());u.hash='register';return u.href;};
  const pitch=()=>`أهلًا! تطبيق على بابك بيساعد العملاء يطلبوا من محلات منطقتهم. لو حابب تنضم كتاجر، سجّل بيانات محلك من الرابط ده عشان الإدارة تراجعها وتتواصل معاك:\n${link()}\nكود المسوّق: ${code()}`;
  const templates=()=>[
    {title:'أول تواصل',text:pitch()},
    {title:'متابعة بعد التعارف',text:`أهلًا، بتابع مع حضرتك بخصوص الانضمام لتطبيق على بابك. لو محتاج مساعدة في تسجيل بيانات المحل أنا موجود. ده رابط التسجيل للمراجعة:\n${link()}`},
    {title:'بعد إرسال التسجيل',text:'شكرًا لتسجيل بيانات محلك على بابك. التسجيل لسه قيد مراجعة الإدارة، وهيتم التواصل معاك بخصوص الخطوات والباقات المتاحة. لو في أي بيانات ناقصة ابعتهالي.'}
  ];
  const btn=(action,label,primary=false)=>`<button class="btn ${primary?'btn-primary':'btn-ghost'}" style="margin-top:8px" onclick="MarketerTools.${action}">${label}</button>`;
  function qrSvg(size=240){
    if(!code() || !window.qrcode) return '';
    const qr=window.qrcode(0,'M');qr.addData(link());qr.make();
    return qr.createSvgTag({cellSize:4,margin:16,scalable:true}).replace('<svg ',`<svg role="img" aria-label="رمز تسجيل المحل" width="${size}" height="${size}" `);
  }
  async function copy(text){
    try{await navigator.clipboard.writeText(text);ui.toast('تم النسخ');}
    catch{ui.openModal(`<div class="modal-head"><h3>انسخ الرسالة</h3><button class="modal-close" onclick="UI.closeModal()">×</button></div><textarea readonly style="width:100%;height:230px" onclick="this.select()">${e(text)}</textarea>`);}
  }
  const open=url=>window.open(url,'_blank','noopener,noreferrer');
  function share(channel){
    if(!code()) return ui.toast('كودك غير متاح، تواصل مع الإدارة');
    if(channel==='whatsapp') open('https://wa.me/?text='+encodeURIComponent(pitch()));
    else if(channel==='facebook') open('https://www.facebook.com/sharer/sharer.php?u='+encodeURIComponent(link()));
    else if(navigator.share) navigator.share({title:'انضم لتطبيق على بابك',text:pitch(),url:link()}).catch(err=>{if(err.name!=='AbortError') copy(pitch());});
    else copy(pitch());
  }
  function render(){
    const ready=!!code();
    return `<div class="section-head"><h3>أدواتك التسويقية</h3></div>
      <p style="font-size:13px;color:var(--ink-soft)">رابطك، رسائلك، وتصميمات جاهزة باسم التطبيق. اختار اللي يناسب المحل وراجعه قبل الإرسال.</p>
      ${!ready?'<div class="hint-box">الكود غير متاح. اطلب من الإدارة إصلاح حقول الحساب قبل المشاركة.</div>':''}
      <div class="card" style="margin-top:14px"><h3>شارك رابط التسجيل</h3>
        <label for="marketerLink">رابطك الخاص</label><input id="marketerLink" readonly dir="ltr" value="${ready?e(link()):''}" style="width:100%;font-size:12px;padding:12px;box-sizing:border-box" onclick="this.select()">
        ${ready?btn("share('whatsapp')",'مشاركة على واتساب',true)+btn("share('facebook')",'مشاركة على فيسبوك')+btn('copyLink()','نسخ الرابط')+btn("share('native')",'مشاركة بطرق أخرى'):''}
        <p style="font-size:11px;color:var(--ink-soft)">المشاركة بتفتح رسالة أو منشور تراجعه بنفسك. مفيش إرسال تلقائي.</p>
      </div>
      <div class="card" style="margin-top:14px"><h3>رسائل جاهزة للتجار</h3>
        ${templates().map((t,i)=>`<details style="padding:12px 0;border-bottom:1px solid var(--line)"><summary style="cursor:pointer;font-weight:700">${t.title}</summary><p style="font-size:13px;white-space:pre-line;line-height:1.9">${e(ready?t.text:'فعّل كودك أولًا')}</p>${ready?btn(`copyTemplate(${i})`,'نسخ الرسالة')+btn(`sendTemplate(${i})`,'فتح في واتساب'):''}</details>`).join('')}
        <p style="font-size:11px;color:var(--ink-soft)">ابعت للتجار المهتمين فقط. لو حد رفض التواصل، احترم طلبه.</p>
      </div>
      <div class="card" style="margin-top:14px;text-align:center"><h3>رمز تسجيل المحل</h3>
        <div style="width:240px;max-width:100%;margin:auto">${ready?qrSvg():''}</div>
        <p style="font-size:12px">التاجر يمسح الرمز، يفتح التسجيل ويلاقي كودك مكتوب.</p>
        ${ready?btn('downloadQr()','تنزيل QR للطباعة'):''}
      </div>
      <div class="card" style="margin-top:14px"><h3>صور ومنشورات جاهزة</h3><p style="font-size:13px;line-height:1.9">تصميم بشعار على بابك وكودك ورمز التسجيل. التنزيل بصيغة PNG، مناسب للنشر أو الطباعة.</p>
        ${ready?btn("previewMaterial('post')",'معاينة بوست مربع 1080 × 1080')+btn("previewMaterial('story')",'معاينة ستوري 1080 × 1920'):''}
      </div>
      ${renderBackend()}`;
  }
  function renderBackend(){
    if(!state().settings.marketerToolsBackend) return `<div class="hint-box" style="margin-top:14px"><b>إشعارات الإنجاز والترتيب وإحصائيات الزيارات</b><p style="font-size:12px">الأدوات دي محتاجة تفعيل خدمة الإحصائيات الآمنة من الإدارة. لحد التفعيل، مش هنعرض أرقام تقديرية كأنها حقيقية. عدد المحلات وحالاتها متاح في «محلاتي».</p></div>`;
    return `<div class="card" style="margin-top:14px"><h3>أداء رابطك</h3>${btn('refresh()','تحديث الإحصائيات')}
      ${loading?'<p>جاري التحميل...</p>':loadError?'<p>تعذّر تحميل البيانات. حاول التحديث.</p>':data?`<div class="stat-grid"><div class="stat-card"><div class="num">${data.metrics.visits||0}</div><div class="lbl">زيارات متصفح تقريبية</div></div><div class="stat-card"><div class="num">${data.metrics.linkedStores||0}</div><div class="lbl">محلات مسجّلة بكودك</div></div></div><p style="font-size:11px">الزيارات مش عدد أشخاص مؤكد، ومش أساس لحساب أي عمولة. مفيش نسب تحويل قبل توافر تتبع كامل.</p>
      <h3>آخر الإنجازات</h3>${data.notifications.length?data.notifications.map(n=>`<p style="padding:10px;background:var(--teal-tint);border-radius:10px"><b>${e(n.title)}</b><br><span style="font-size:12px">${e(n.body)}</span></p>`).join(''):'<p>لسه مفيش إشعارات جديدة.</p>'}
      <h3>لوحة الصدارة</h3><p style="font-size:12px">بالاشتراك الاختياري فقط، الترتيب بعدد المحلات النشطة. لا نعرض أرباح أو بيانات تواصل.</p>
      <label style="display:flex;gap:8px"><input type="checkbox" ${data.optIn?'checked':''} onchange="MarketerTools.setVisibility(this.checked)"> إظهار اسمي المستعار ضمن ترتيب المسوّقين</label>
      ${data.leaderboard.length?`<ol>${data.leaderboard.map(r=>`<li style="padding:10px">${e(r.alias)} <b>(${r.activeStores} محل نشط)</b></li>`).join('')}</ol>`:'<p>مفيش مشاركين في الترتيب حاليًا.</p>'}`:'<p>اضغط تحديث لعرض البيانات.</p>'}</div>`;
  }
  function download(blob,name){const url=URL.createObjectURL(blob);const a=document.createElement('a');a.href=url;a.download=name;document.body.append(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),60000);}
  const image=src=>new Promise((resolve,reject)=>{const im=new Image();im.onload=()=>resolve(im);im.onerror=reject;im.src=src;});
  async function material(kind){
    if(!code()) throw new Error('missing-code');
    await document.fonts.load('700 64px "IBM Plex Sans Arabic"');
    await document.fonts.ready;
    const c=document.createElement('canvas');c.width=1080;c.height=kind==='story'?1920:1080;
    const x=c.getContext('2d');const story=kind==='story';
    x.fillStyle='#FFF8EE';x.fillRect(0,0,c.width,c.height);
    x.fillStyle='#CC3D1B';x.fillRect(0,0,1080,story?560:300);
    const logo=await image('/logo-reverse.svg');x.drawImage(logo,story?420:450,story?100:42,story?240:180,story?240:180);
    x.direction='rtl';x.textAlign='center';
    function text(t,y,size=48,color='#CC3D1B'){x.fillStyle=color;x.font=`700 ${size}px "IBM Plex Sans Arabic", sans-serif`;x.fillText(t,540,y,920);}
    text('على بابك',story?440:266,64,'#FFF8EE');
    text('محلك أقرب لعملاء منطقتك',story?720:410,54);
    text('انضم كتاجر وعرّف الناس بمنتجاتك',story?825:490,35);
    text('سجّل بيانات محلك لمراجعة الإدارة',story?900:550,30,'#7B6A5B');
    const svg=qrSvg();const qr=await image('data:image/svg+xml;charset=utf-8,'+encodeURIComponent(svg));
    const qrSize=story?420:250,qrY=story?1050:580;
    x.fillStyle='#FFFFFF';x.fillRect((1080-qrSize)/2-12,qrY-12,qrSize+24,qrSize+24);x.drawImage(qr,(1080-qrSize)/2,qrY,qrSize,qrSize);
    text('امسح الرمز وسجّل محلك',qrY+qrSize+68,32);
    text('كود المسوّق',qrY+qrSize+123,24,'#7B6A5B');
    text(code(),qrY+qrSize+170,Math.min(34,850/code().length*1.7));
    x.fillStyle='#EAB94F';x.fillRect(0,c.height-20,1080,20);
    return c;
  }
  async function previewMaterial(kind){
    try{const c=await material(kind);const src=c.toDataURL('image/png');ui.openModal(`<div class="modal-head"><h3>معاينة ${kind==='story'?'الستوري':'البوست'}</h3><button class="modal-close" onclick="UI.closeModal()">×</button></div><img src="${src}" alt="تصميم تسويقي بشعار على بابك وكودك" style="width:100%;border-radius:14px">${btn(`downloadMaterial('${kind}')`,'تنزيل الصورة',true)}`);}
    catch{ui.toast('تعذّر تجهيز الصورة. تأكد من اتصالك وحاول مرة تانية');}
  }
  async function refresh(){
    if(loading || !state().settings.marketerToolsBackend) return;
    const uid=state().user?.uid;loading=true;loadError=false;window.renderMain();
    try{const result=await callBackend('getMarketerToolsData',{});if(state().user?.uid===uid) data=result;}
    catch{loadError=true;}
    finally{loading=false;if(state().user?.uid===uid) window.renderMain();}
  }
  return {render,share,link,pitch,qrSvg,material,previewMaterial,refresh,
    reset(){data=null;loading=false;loadError=false;},
    copyLink:()=>copy(link()),copyTemplate:i=>copy(templates()[i]?.text||''),
    sendTemplate:i=>open('https://wa.me/?text='+encodeURIComponent(templates()[i]?.text||'')),
    downloadQr:()=>download(new Blob([qrSvg(600)],{type:'image/svg+xml'}),'3ala-babk-qr.svg'),
    async downloadMaterial(kind){try{const c=await material(kind);c.toBlob(b=>{if(b) download(b,`3ala-babk-${kind}.png`);},'image/png');}catch{ui.toast('تعذّر تنزيل الصورة');}},
    async setVisibility(visible){try{await callBackend('setMarketerLeaderboardVisibility',{visible});await refresh();}catch{ui.toast('تعذّر تغيير إعداد الظهور');}}
  };
}
