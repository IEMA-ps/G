export const TERMS_VERSION = '2026-11-24.2';
export const TERMS_URL = '/terms.html';

export function requireSignupConsent(document) {
  return document.getElementById('regTerms')?.checked === true;
}

// Only called for a Google UID with no app profile. Existing accounts are unchanged.
export function askGoogleConsent() {
  const dialog = document.getElementById('googleTermsDialog');
  const checkbox = document.getElementById('googleTerms');
  const accept = document.getElementById('googleTermsAccept');
  const cancel = document.getElementById('googleTermsCancel');
  checkbox.checked = false;
  accept.disabled = true;
  return new Promise(resolve => {
    const finish = value => {
      checkbox.onchange = null; accept.onclick = null; cancel.onclick = null;
      dialog.oncancel = null; dialog.close(); resolve(value);
    };
    checkbox.onchange = () => { accept.disabled = !checkbox.checked; };
    accept.onclick = () => { if (checkbox.checked) finish(true); };
    cancel.onclick = () => finish(false);
    dialog.oncancel = event => { event.preventDefault(); finish(false); };
    dialog.showModal();
    checkbox.focus();
  });
}


// Server-side proof of consent (append-only log in Cloudflare D1, see consent-worker/).
// Best effort: a failure never blocks signup. The server decides the time, IP and terms hash.
export const CONSENT_ENDPOINT = '/api/consent';

export async function recordServerConsent(user, method) {
  try {
    if (!user) return false;
    const token = await user.getIdToken();
    const res = await fetch(CONSENT_ENDPOINT, {
      method: 'POST',
      headers: {'content-type': 'application/json', authorization: 'Bearer ' + token},
      body: JSON.stringify({version: TERMS_VERSION, method}),
      keepalive: true
    });
    return res.ok;
  } catch (e) {
    console.warn('Server consent record not saved');
    return false;
  }
}
