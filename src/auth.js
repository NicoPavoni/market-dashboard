const _AUTH_PASS_KEY = 'mktdash_pass';
const _AUTH_SESS_KEY = 'mktdash_auth';

async function _sha256(str) {
  const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(str));
  return Array.from(new Uint8Array(buf)).map(b => b.toString(16).padStart(2, '0')).join('');
}

function authIsAuthenticated() {
  return sessionStorage.getItem(_AUTH_SESS_KEY) === '1';
}

function authHasPassword() {
  return !!localStorage.getItem(_AUTH_PASS_KEY);
}

async function authSetupPassword(password) {
  if (!password || password.length < 4) return { ok: false, msg: 'Mínimo 4 caracteres.' };
  const hash = await _sha256(password);
  localStorage.setItem(_AUTH_PASS_KEY, hash);
  sessionStorage.setItem(_AUTH_SESS_KEY, '1');
  return { ok: true };
}

async function authLogin(password) {
  const stored = localStorage.getItem(_AUTH_PASS_KEY);
  if (!stored) return { ok: false, msg: 'Sin contraseña configurada.' };
  const hash = await _sha256(password);
  if (hash === stored) {
    sessionStorage.setItem(_AUTH_SESS_KEY, '1');
    return { ok: true };
  }
  return { ok: false, msg: 'Contraseña incorrecta.' };
}

async function authChangePassword(currentPw, newPw, confirmPw) {
  if (!newPw || newPw.length < 4) return { ok: false, msg: 'Mínimo 4 caracteres.' };
  if (newPw !== confirmPw)        return { ok: false, msg: 'Las contraseñas no coinciden.' };
  const stored = localStorage.getItem(_AUTH_PASS_KEY);
  if (stored) {
    const hash = await _sha256(currentPw);
    if (hash !== stored) return { ok: false, msg: 'Contraseña actual incorrecta.' };
  }
  const newHash = await _sha256(newPw);
  localStorage.setItem(_AUTH_PASS_KEY, newHash);
  return { ok: true };
}

function authLogout() {
  sessionStorage.removeItem(_AUTH_SESS_KEY);
  location.reload();
}

// Called once at bootstrap. Returns true → show app. Returns false → show login.
function initAuthGate() {
  const appEl  = document.getElementById('app-container');
  const authEl = document.getElementById('auth-screen');

  if (authIsAuthenticated()) {
    appEl.style.display  = 'flex';
    authEl.style.display = 'none';
    return true;
  }

  appEl.style.display  = 'none';
  authEl.style.display = 'flex';

  const hasPass = authHasPassword();
  document.getElementById('auth-panel-setup').style.display = hasPass ? 'none'  : 'block';
  document.getElementById('auth-panel-login').style.display = hasPass ? 'block' : 'none';

  return false;
}
