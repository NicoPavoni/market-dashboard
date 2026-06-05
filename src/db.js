// ─── GitHub Gist cloud sync ───────────────────────────────────────────────────
// Setup: github.com/settings/tokens → Fine-grained token → scope "Gists: Read & Write"
// ─────────────────────────────────────────────────────────────────────────────

const _DB_TOKEN_KEY = 'mktdash_gh_token';
const _DB_GIST_KEY  = 'mktdash_gh_gist';
const _DB_FILE      = 'market_portfolio.json';
const _GIST_API     = 'https://api.github.com/gists';

function dbGetToken()     { return localStorage.getItem(_DB_TOKEN_KEY) || ''; }
function dbGetGistId()    { return localStorage.getItem(_DB_GIST_KEY)  || ''; }
function dbIsConfigured() { return !!(dbGetToken() && dbGetGistId());          }

function _dbHeaders(token) {
  return {
    'Authorization':        `Bearer ${token || dbGetToken()}`,
    'Accept':               'application/vnd.github+json',
    'Content-Type':         'application/json',
    'X-GitHub-Api-Version': '2022-11-28',
  };
}

async function dbLoadTrades() {
  if (!dbIsConfigured()) return null;
  try {
    const res  = await fetch(`${_GIST_API}/${dbGetGistId()}`, { headers: _dbHeaders() });
    if (!res.ok) return null;
    const gist = await res.json();
    const raw  = gist.files?.[_DB_FILE]?.content;
    return raw ? JSON.parse(raw) : [];
  } catch (e) {
    console.warn('[cloud] load failed:', e.message);
    return null;
  }
}

async function dbSaveTrades(trades) {
  if (!dbIsConfigured()) return false;
  try {
    const res = await fetch(`${_GIST_API}/${dbGetGistId()}`, {
      method:  'PATCH',
      headers: _dbHeaders(),
      body:    JSON.stringify({
        files: { [_DB_FILE]: { content: JSON.stringify(trades, null, 2) } },
      }),
    });
    return res.ok;
  } catch (e) {
    console.warn('[cloud] save failed:', e.message);
    return false;
  }
}

async function dbConnect(rawToken) {
  const token = (rawToken || '').trim();
  if (!token || token.length < 20) return { ok: false, msg: 'Token demasiado corto.' };

  const headers = _dbHeaders(token);

  // Try to find existing portfolio gist in the first 100 gists
  let gistId = '';
  try {
    const listRes = await fetch(`${_GIST_API}?per_page=100`, { headers });
    if (!listRes.ok) {
      if (listRes.status === 401) return { ok: false, msg: 'Token inválido o expirado.' };
      return { ok: false, msg: `Error ${listRes.status} al conectar con GitHub.` };
    }
    const gists    = await listRes.json();
    const existing = Array.isArray(gists) ? gists.find(g => g.files?.[_DB_FILE]) : null;
    if (existing) gistId = existing.id;
  } catch (e) {
    return { ok: false, msg: 'Error de red: ' + e.message };
  }

  // Create a new private gist if none was found
  if (!gistId) {
    try {
      const createRes = await fetch(_GIST_API, {
        method:  'POST',
        headers,
        body: JSON.stringify({
          description: 'Market Panel — Portfolio',
          public:      false,
          files:       { [_DB_FILE]: { content: '[]' } },
        }),
      });
      if (!createRes.ok) return { ok: false, msg: 'No se pudo crear el Gist. Verificá el scope del token.' };
      const created = await createRes.json();
      gistId = created.id;
    } catch (e) {
      return { ok: false, msg: 'Error al crear el Gist: ' + e.message };
    }
  }

  localStorage.setItem(_DB_TOKEN_KEY, token);
  localStorage.setItem(_DB_GIST_KEY, gistId);
  return { ok: true };
}

function dbDisconnect() {
  localStorage.removeItem(_DB_TOKEN_KEY);
  localStorage.removeItem(_DB_GIST_KEY);
}
