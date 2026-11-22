// Native browser install prompt where supported, manual iPhone instructions otherwise.
let deferred;
const standalone=()=>window.matchMedia('(display-mode: standalone)').matches||navigator.standalone===true;
const button=document.createElement('button');button.type='button';button.textContent='ثبّت على بابك على موبايلك';button.style.cssText='position:fixed;bottom:92px;left:max(16px, calc((100vw - 480px)/2 + 16px));z-index:80;max-width:260px;border:1px solid #CF9A3E;border-radius:16px;padding:12px 18px;background:#154C43;color:white;font:700 13px Cairo,sans-serif;box-shadow:0 4px 16px #0003;cursor:pointer';
function refresh(){button.hidden=standalone();}
button.addEventListener('click',async()=>{
 if(deferred){const prompt=deferred;deferred=null;await prompt.prompt();await prompt.userChoice;refresh();return;}
 const ios=/iPad|iPhone|iPod/.test(navigator.userAgent)||(navigator.platform==='MacIntel'&&navigator.maxTouchPoints>1);
 const panel=document.createElement('dialog');panel.dir='rtl';panel.style.cssText='border:1px solid #E8E1D3;border-radius:20px;padding:24px;max-width:340px;width:calc(100% - 40px);font-family:Cairo,sans-serif;color:#211E1A;background:#FBF7EF';
 const title=document.createElement('h3');title.textContent='تثبيت على بابك';
 const text=document.createElement('p');text.style.cssText='line-height:2;font-size:14px';text.textContent=ios?'افتح الموقع في Safari، اضغط زر المشاركة، وبعدها «إضافة إلى الشاشة الرئيسية»، ثم «إضافة». التطبيق هيفتح من الأيقونة في نافذة مستقلة.':'من قائمة المتصفح اختار «تثبيت التطبيق» أو «إضافة إلى الشاشة الرئيسية». لو الخيار مش ظاهر، افتح الموقع في Chrome أو Edge وانتظر اكتمال التحميل. التثبيت متاح حسب دعم المتصفح.';
 const note=document.createElement('p');note.style.cssText='font-size:12px;line-height:1.8';note.textContent='ده تطبيق ويب، مش ملف APK ولا تنزيل من المتجر. الطلبات وتسجيل الدخول محتاجين إنترنت.';
 const close=document.createElement('button');close.type='button';close.textContent='تمام';close.className='btn btn-primary';close.onclick=()=>panel.close();panel.append(title,text,note,close);document.body.append(panel);panel.addEventListener('close',()=>panel.remove());panel.showModal();
});
window.addEventListener('beforeinstallprompt',e=>{e.preventDefault();deferred=e;refresh();});
window.addEventListener('appinstalled',()=>{deferred=null;button.hidden=true;});
document.body.append(button);refresh();
