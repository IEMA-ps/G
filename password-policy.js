// Shared app policy for NEW passwords only. Existing-password login is intentionally untouched.
export const PASSWORD_HINT='8 أحرف على الأقل، وفيها حرف إنجليزي كبير (A-Z) وحرف صغير (a-z) ورقم (0-9). الرموز مسموحة ومش إلزامية.';
export function passwordChecks(value){
  const p=typeof value==='string'?value:'';
  return [{id:'length',ok:p.length>=8,label:'8 أحرف على الأقل'},{id:'upper',ok:/[A-Z]/.test(p),label:'حرف إنجليزي كبير (A-Z)'},{id:'lower',ok:/[a-z]/.test(p),label:'حرف إنجليزي صغير (a-z)'},{id:'digit',ok:/[0-9]/.test(p),label:'رقم (0-9)'}];
}
export function passwordError(value){
  const missing=passwordChecks(value).filter(x=>!x.ok).map(x=>x.label);
  return missing.length?'كلمة المرور محتاجة: '+missing.join('، ')+'.':'';
}
export function passwordChecklist(value){
  return `<ul class="password-checks" aria-label="شروط كلمة المرور">${passwordChecks(value).map(x=>`<li class="${x.ok?'met':'missing'}"><span aria-hidden="true">${x.ok?'✓':'○'}</span> ${x.label}<span class="sr-only">: ${x.ok?'متحقق':'غير متحقق'}</span></li>`).join('')}</ul>`;
}
// Used only by the app's existing admin-created-account form. Never logs or stores a password.
export function generateAccountPassword(){
  const alphabet='ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789';
  for(let attempt=0;attempt<100;attempt++){
    const bytes=crypto.getRandomValues(new Uint8Array(24));let result='';
    const limit=Math.floor(256/alphabet.length)*alphabet.length;
    for(const n of bytes){if(n<limit)result+=alphabet[n%alphabet.length];if(result.length===12)break;}
    if(!passwordError(result))return result;
  }
  throw Error('تعذّر اقتراح كلمة مرور. اكتبها يدويًا بالشروط الموضّحة.');
}
