// Marketer motivational video card. Pure helpers: no network, no database writes.
// Shown only when the admin switch settings.marketerVideoEnabled is true (default OFF).
export const VIDEO_FILES={male:'/motivational-male.mp4',female:'/motivational-female.mp4'};
export function videoEnabled(settings){return settings?.marketerVideoEnabled===true;}
export function videoCardHTML(settings,esc=s=>s){
  if(!videoEnabled(settings)) return '';
  return `<div class="card" id="mkVideoCard" style="margin-bottom:14px">
    <h3 style="margin:0 0 10px;font-size:16px">${esc('ليه تشتغل مع على بابك؟')}</h3>
    <div class="seg" style="margin-bottom:10px" role="group" aria-label="${esc('نسخة الفيديو')}">
      <button type="button" class="active" id="mkVidBtnMale" aria-pressed="true" onclick="pickMarketerVideo('male')">${esc('نسخة مسوقين')}</button>
      <button type="button" id="mkVidBtnFemale" aria-pressed="false" onclick="pickMarketerVideo('female')">${esc('نسخة مسوقات')}</button>
    </div>
    <video id="mkVideoEl" controls playsinline preload="metadata" src="${VIDEO_FILES.male}#t=0.1" style="display:block;width:100%;max-height:52vh;aspect-ratio:9/16;object-fit:contain;border-radius:14px;background:#000"></video>
  </div>`;
}
export function setVersion(doc,which){
  const v=which==='female'?'female':'male';
  const el=doc.getElementById('mkVideoEl'); if(!el) return false;
  el.pause(); el.src=VIDEO_FILES[v]+'#t=0.1'; el.load();
  for(const [k,id] of [['male','mkVidBtnMale'],['female','mkVidBtnFemale']]){
    const b=doc.getElementById(id); if(!b) continue;
    b.classList.toggle('active',k===v); b.setAttribute('aria-pressed',String(k===v));
  }
  return true;
}
