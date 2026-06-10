// ─── Portfolio storage — Firebase Realtime Database ───────────────────────────
// Data is stored at /portfolios/{uid} and only accessible by the authenticated user.
// Security rules in Firebase Console enforce this server-side.
// ─────────────────────────────────────────────────────────────────────────────

function _dbRef() {
  const uid = firebase.auth().currentUser?.uid;
  if (!uid) return null;
  return firebase.database().ref(`/portfolios/${uid}`);
}

async function dbLoadTrades() {
  const ref = _dbRef();
  if (!ref) return null;
  try {
    const snap = await ref.get();
    if (!snap.exists()) return [];
    const val = snap.val();
    return Array.isArray(val) ? val : Object.values(val || {});
  } catch (e) {
    console.warn('[db] load failed:', e.message);
    return null;
  }
}

async function dbSaveTrades(trades) {
  const ref = _dbRef();
  if (!ref) return false;
  try {
    await ref.set(trades);
    return true;
  } catch (e) {
    console.warn('[db] save failed:', e.message);
    return false;
  }
}

function dbIsConfigured() {
  return !!firebase.auth().currentUser;
}

// ─── Watchlist storage ────────────────────────────────────────────────────────

function _dbWatchlistRef() {
  const uid = firebase.auth().currentUser?.uid;
  if (!uid) return null;
  return firebase.database().ref(`/watchlists/${uid}`);
}

async function dbLoadWatchlist() {
  const ref = _dbWatchlistRef();
  if (!ref) return null;
  try {
    const snap = await ref.get();
    if (!snap.exists()) return null;
    const val = snap.val();
    return Array.isArray(val) ? val : Object.values(val || {});
  } catch (e) {
    console.warn('[db] watchlist load failed:', e.message);
    return null;
  }
}

async function dbSaveWatchlist(ids) {
  const ref = _dbWatchlistRef();
  if (!ref) return false;
  try {
    await ref.set(ids);
    return true;
  } catch (e) {
    console.warn('[db] watchlist save failed:', e.message);
    return false;
  }
}

// ─── Portfolio history storage ────────────────────────────────────────────────

function _dbHistoryRef() {
  const uid = firebase.auth().currentUser?.uid;
  if (!uid) return null;
  return firebase.database().ref(`/history/${uid}`);
}

async function dbLoadPfHistory() {
  const ref = _dbHistoryRef();
  if (!ref) return null;
  try {
    const snap = await ref.get();
    if (!snap.exists()) return [];
    const val = snap.val();
    return Array.isArray(val) ? val : Object.values(val || {});
  } catch (e) {
    console.warn('[db] history load failed:', e.message);
    return null;
  }
}

async function dbSavePfHistory(history) {
  const ref = _dbHistoryRef();
  if (!ref) return false;
  try {
    await ref.set(history);
    return true;
  } catch (e) {
    console.warn('[db] history save failed:', e.message);
    return false;
  }
}
