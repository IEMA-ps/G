// Native browser install prompt where supported, manual iPhone instructions otherwise.
let deferred;
const standalone=()=>window.matchMedia('(display-mode: standalone)').matches||navigator.standalone===true;
const button=document.createElement('button');button.id='pwaInstallBtn';button.type='button';button.textContent='ثبّت على بابك على موبايلك';button.style.cssText='max-width:260px;border:1px solid #EAB94F;border-radius:16px;padding:12px 18px;background:#CC3D1B;color:white;font:700 13px "IBM Plex Sans Arabic",sans-serif;box-shadow:0 4px 16px #0003;cursor:pointer';
const KEY='pwaInstallDismissed';let dismissed=false;try{dismissed=localStorage.getItem(KEY)==='1';}catch(e){}
let typing=false;
const wrap=document.createElement('div');wrap.id='pwaInstallWrap';wrap.style.cssText='position:fixed;bottom:150px;left:max(16px, calc((100vw - 480px)/2 + 16px));z-index:40;max-width:260px';
function refresh(){wrap.hidden=standalone()||dismissed||typing;}
const closeBtn=document.createElement('button');closeBtn.id='pwaInstallClose';closeBtn.type='button';closeBtn.setAttribute('aria-label','إغلاق');closeBtn.textContent='×';closeBtn.style.cssText='position:absolute;top:-10px;right:-10px;z-index:1;width:26px;height:26px;border-radius:50%;border:1px solid #EAB94F;background:#fff;color:#30251F;font:700 16px/1 sans-serif;padding:0;cursor:pointer';
closeBtn.addEventListener('click',e=>{e.stopPropagation();dismissed=true;try{localStorage.setItem(KEY,'1');}catch(e){}refresh();});
const isField=t=>t&&/^(INPUT|TEXTAREA|SELECT)$/.test(t.tagName);
document.addEventListener('focusin',e=>{if(isField(e.target)){typing=true;refresh();}});
document.addEventListener('focusout',()=>{typing=false;refresh();});
button.addEventListener('click',async()=>{
 if(deferred){const prompt=deferred;deferred=null;await prompt.prompt();await prompt.userChoice;refresh();return;}
 const ios=/iPad|iPhone|iPod/.test(navigator.userAgent)||(navigator.platform==='MacIntel'&&navigator.maxTouchPoints>1);
 const panel=document.createElement('dialog');panel.dir='rtl';panel.style.cssText='border:1px solid #EDDFCF;border-radius:20px;padding:24px;max-width:340px;width:calc(100% - 40px);font-family:"IBM Plex Sans Arabic",sans-serif;color:#30251F;background:#FFF8EE';
 const title=document.createElement('h3');title.textContent='تثبيت على بابك';
 const text=document.createElement('p');text.style.cssText='line-height:2;font-size:14px';text.textContent=ios?'افتح الموقع في Safari، اضغط زر المشاركة، وبعدها «إضافة إلى الشاشة الرئيسية»، ثم «إضافة». التطبيق هيفتح من الأيقونة في نافذة مستقلة.':'من قائمة المتصفح اختار «تثبيت التطبيق» أو «إضافة إلى الشاشة الرئيسية». لو الخيار مش ظاهر، افتح الموقع في Chrome أو Edge وانتظر اكتمال التحميل. ظهور اختيار التثبيت بيعتمد على المتصفح اللي بتستخدمه.';
 const note=document.createElement('p');note.style.cssText='font-size:12px;line-height:1.8';note.textContent='ده تطبيق ويب، مش ملف APK ولا تنزيل من المتجر. الطلبات وتسجيل الدخول محتاجين إنترنت.';
 const close=document.createElement('button');close.type='button';close.textContent='تمام';close.className='btn btn-primary';close.onclick=()=>panel.close();panel.append(title,text,note,close);document.body.append(panel);panel.addEventListener('close',()=>panel.remove());panel.showModal();
});
window.addEventListener('beforeinstallprompt',e=>{e.preventDefault();deferred=e;refresh();});
window.addEventListener('appinstalled',()=>{deferred=null;wrap.hidden=true;});
wrap.append(button,closeBtn);document.body.append(wrap);refresh();
