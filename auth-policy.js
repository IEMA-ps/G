// Set only during an approved release. Null deliberately keeps this review build inactive.
export const EMAIL_VERIFICATION_START = null;
export const INTERNAL_EMAIL = /@users\.alababak\.app$/i;
export function needsEmailVerification(user, start = EMAIL_VERIFICATION_START) {
  if (!user || user.emailVerified || INTERNAL_EMAIL.test(user.email || '') || !start) return false;
  const created = Date.parse(user.metadata?.creationTime || '');
  const cutoff = Date.parse(start);
  // Missing/invalid metadata must not silently bypass an active new-account policy.
  return !Number.isFinite(created) || !Number.isFinite(cutoff) || created >= cutoff;
}
export function googleProfile(user, defaults, createdAt) {
  const names = (user.displayName || 'مستخدم').trim().split(/\s+/);
  return {id:user.uid, firstName:names.shift(), lastName:names.join(' '), phone:'',
    email:user.email || '', role:'CUSTOMER', merchantId:null, deliveryAgentId:null,
    ...defaults, createdAt};
}
export function googleError(code) {
  const messages = {
    'auth/popup-closed-by-user':'تم إغلاق نافذة Google. تقدر تحاول تاني أو تدخل ببريدك وكلمة المرور.',
    'auth/cancelled-popup-request':'فيه محاولة دخول مفتوحة بالفعل. كمّلها الأول.',
    'auth/popup-blocked':'المتصفح منع نافذة Google. اسمح بالنوافذ المنبثقة للموقع وحاول تاني.',
    'auth/account-exists-with-different-credential':'البريد مرتبط بطريقة دخول تانية. ادخل بالطريقة الأصلية. ماتعملش حساب جديد؛ كلّم الإدارة لو محتاج تربط Google.',
    'auth/operation-not-allowed':'دخول Google غير متاح حاليًا. ادخل ببريدك وكلمة المرور أو تواصل مع الإدارة.',
    'auth/unauthorized-domain':'دخول Google غير مفعّل لعنوان الموقع ده. تواصل مع الإدارة.',
    'auth/network-request-failed':'تعذّر الاتصال. راجع الإنترنت وحاول تاني.'
  };
  return messages[code] || 'تعذّر الدخول بجوجل. حاول تاني أو استخدم البريد وكلمة المرور.';
}

export function accountLoadError(error) {
  const code=String(error?.code || (error?.message==='profile-needs-admin-repair'?'profile-needs-admin-repair':'')).replace(/^firestore\//,'');
  const stage=['profile-read','profile-create','profile-read-back','profile-prepare','app-open'].includes(error?.bootStage)?error.bootStage:'unknown';
  const labels={'profile-read':'قراءة الحساب','profile-create':'إنشاء بيانات الحساب','profile-read-back':'تأكيد حفظ الحساب','profile-prepare':'تجهيز الحساب','app-open':'فتح التطبيق',unknown:'تحميل الحساب'};
  const known=['permission-denied','unavailable','deadline-exceeded','unauthenticated','failed-precondition','resource-exhausted','profile-needs-admin-repair'];
  const safeCode=known.includes(code)?code:'unexpected';
  const reason=code==='permission-denied'?'مش قادرين نوصل لبيانات حسابك بالصلاحيات الحالية. كلّم الدعم، وماتعملش حساب جديد.':code==='unauthenticated'?'جلسة دخولك محتاجة تتحدث. اخرج من الحساب وادخل تاني.':['unavailable','deadline-exceeded'].includes(code)?'مش قادرين نتصل بخدمة البيانات. راجع الإنترنت وجرب تاني.':code==='profile-needs-admin-repair'?'بيانات تسجيلك لسه مش كاملة. كلّم الإدارة، وماتعملش حساب جديد.':'دخلت بحسابك، بس مش قادرين نكمل فتحه. جرب تاني، ولو المشكلة اتكررت ابعت كود التشخيص للدعم.';
  return {code:safeCode,stage,message:reason+' ('+labels[stage]+' / '+safeCode+')'};
}
