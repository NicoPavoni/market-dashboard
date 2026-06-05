// ─── Firebase Authentication ──────────────────────────────────────────────────
// Credentials are validated server-side by Firebase.
// No one can bypass auth by inspecting client-side code.
// ─────────────────────────────────────────────────────────────────────────────

// Waits for Firebase to determine the initial auth state, then resolves.
// Returns the Firebase User object if logged in, or null if not.
function waitForAuth() {
  return new Promise(resolve => {
    const unsub = firebase.auth().onAuthStateChanged(user => {
      unsub();
      resolve(user);
    });
  });
}

async function authLogin(password) {
  const email = (typeof AUTH_EMAIL !== 'undefined' ? AUTH_EMAIL : '').trim();

  if (!email || email === 'tu@email.com') {
    return { ok: false, msg: 'Configurá AUTH_EMAIL en firebase-config.js antes de usar la app.' };
  }

  try {
    await firebase.auth().signInWithEmailAndPassword(email, password);
    return { ok: true };
  } catch (e) {
    const MSGS = {
      'auth/wrong-password':         'Contraseña incorrecta.',
      'auth/invalid-credential':     'Contraseña incorrecta.',
      'auth/user-not-found':         'Cuenta no encontrada.',
      'auth/invalid-email':          'Email inválido.',
      'auth/too-many-requests':      'Demasiados intentos. Esperá unos minutos.',
      'auth/network-request-failed': 'Error de red. Verificá tu conexión.',
      'auth/app-not-initialized':    'Firebase no configurado. Completá firebase-config.js.',
    };
    return { ok: false, msg: MSGS[e.code] || 'Error: ' + e.message };
  }
}

async function authLogout() {
  await firebase.auth().signOut();
  location.reload();
}

async function authChangePassword(newPw, confirmPw) {
  if (!newPw || newPw.length < 6) return { ok: false, msg: 'Mínimo 6 caracteres.' };
  if (newPw !== confirmPw)        return { ok: false, msg: 'Las contraseñas no coinciden.' };
  try {
    await firebase.auth().currentUser.updatePassword(newPw);
    return { ok: true };
  } catch (e) {
    if (e.code === 'auth/requires-recent-login') {
      return { ok: false, msg: 'Cerrá sesión y volvé a entrar antes de cambiar la contraseña.' };
    }
    return { ok: false, msg: e.message };
  }
}
