// Web Push client. No Firebase Messaging: the Worker holds the keys and sends the pushes.
// Pure helpers plus small flows with every browser/network dependency passed in, so they can be tested.
export function b64ToBytes(s){
  const pad = '='.repeat((4 - String(s).length % 4) % 4);
  const raw = atob((String(s) + pad).replace(/-/g, '+').replace(/_/g, '/'));
  return Uint8Array.from(raw, c => c.charCodeAt(0));
}
// 'unsupported' | 'needs-install' (iPhone/iPad outside the home-screen app) | 'denied' | 'ready' | 'on'
export function pushState({hasSW, hasPush, hasNotification, permission, isIOS, standalone, subscribed}){
  if(isIOS && !standalone) return 'needs-install';
  if(!hasSW || !hasPush || !hasNotification) return 'unsupported';
  if(permission === 'denied') return 'denied';
  return subscribed ? 'on' : 'ready';
}
async function call(fetchImpl, workerUrl, path, {method = 'GET', token, appSecret, body} = {}){
  const headers = {};
  if(token) headers.authorization = 'Bearer ' + token;
  if(body) headers['content-type'] = 'application/json';
  const res = await fetchImpl(workerUrl + path, {method, headers, body: body ? JSON.stringify(body) : undefined});
  if(!res.ok) throw new Error('push worker http ' + res.status);
  return res.json();
}
// Asks permission, subscribes this browser and registers it with the Worker. Returns 'on' or a reason string.
export async function enable({reg, token, workerUrl, appSecret, fetchImpl, requestPermission, keys = []}){
  const perm = await requestPermission();
  if(perm !== 'granted') return 'denied';
  const k = await call(fetchImpl, workerUrl, '/push/key', {appSecret});
  const pub = k && (typeof k.key === 'string' ? k.key : k.publicKey);
  if(typeof pub !== 'string' || !pub) return 'unavailable';
  const sub = await reg.pushManager.subscribe({userVisibleOnly: true, applicationServerKey: b64ToBytes(pub)});
  await call(fetchImpl, workerUrl, '/push/subscribe', {method: 'POST', token, appSecret, body: {subscription: sub.toJSON(), keys}});
  return 'on';
}
export async function disable({reg, token, workerUrl, appSecret, fetchImpl}){
  const sub = await reg.pushManager.getSubscription();
  if(!sub) return 'ready';
  const endpoint = sub.endpoint;
  await sub.unsubscribe();
  try{ await call(fetchImpl, workerUrl, '/push/unsubscribe', {method: 'POST', token, appSecret, body: {endpoint}}); }catch(e){}
  return 'ready';
}
export function modalHTML(state){
  const body = {
    'needs-install': 'على الآيفون الإشعارات الفورية بتشتغل بس لما تضيف التطبيق لشاشة الموبايل: افتح الموقع في Safari، اضغط زر المشاركة، وبعدين «إضافة إلى الشاشة الرئيسية». افتحه من الأيقونة وارجع هنا.',
    unsupported: 'المتصفح ده مش بيدعم الإشعارات الفورية. جرّب Chrome على الأندرويد أو Safari بعد إضافة التطبيق للشاشة الرئيسية.',
    denied: 'الإشعارات متقفلة للموقع ده في إعدادات المتصفح. افتح إعدادات الموقع وسمح بالإشعارات وارجع جرّب تاني.',
    ready: 'فعّل الإشعارات الفورية وهيوصلك تنبيه على الموبايل لحظة حصول أي طلب أو حجز جديد يخصك، حتى لو التطبيق مقفول.',
    on: 'الإشعارات الفورية شغّالة على الجهاز ده ✅',
    unavailable: 'خدمة الإشعارات الفورية لسه بتتجهز. جرّب تاني بعد شوية.',
    loading: 'جاري التحميل…'
  }[state] || '';
  const btn = state === 'ready' ? '<button class="btn btn-primary" onclick="enablePush()"><i class="fa-solid fa-bell"></i> تفعيل الإشعارات الفورية</button>'
    : state === 'on' ? '<button class="btn btn-danger" onclick="disablePush()"><i class="fa-solid fa-bell-slash"></i> إيقاف على الجهاز ده</button>' : '';
  return `<p class="hint-box" style="padding:12px;margin:0 0 14px;line-height:1.9">${body}</p>${btn}`;
}
