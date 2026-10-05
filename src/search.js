/**
 * search.js — Asset search box (Configurar → Agregar activo)
 *
 * Searches the curated catalog (KNOWN_ASSETS, incl. cryptos) plus every
 * instrument data912 quotes: US stocks/ADRs, CEDEARs, Argentine stocks,
 * sovereign bonds and ONs. The index is built on first use (~1 MB download).
 */

const SEARCH_LIMIT = 12;
let _searchIndex   = null;   // Promise<Array<{ market, ticker, liveSymbol }>>
let _searchResults = [];

/** Symbols that are just the CCL (C) / MEP (D) version of another symbol. */
function isCurrencyVariant(sym, set) {
  return /[CD]$/.test(sym) && set.has(sym.slice(0, -1));
}

async function buildSearchIndex() {
  const [usStocks, usAdrs, cedears, argStocks, bonds, corp] = await Promise.all(
    ['usa_stocks', 'usa_adrs', 'arg_cedears', 'arg_stocks', 'arg_bonds', 'arg_corp'].map(fetchLivePanel)
  );
  const out = [];

  new Set([...Object.keys(usStocks), ...Object.keys(usAdrs)])
    .forEach(t => out.push({ market: 'us', ticker: t, liveSymbol: t }));

  // CEDEARs and bonds: prefer the USD (MEP) symbol, else the ARS one
  [['cedear', cedears], ['arg_bond', bonds]].forEach(([market, panel]) => {
    const set = new Set(Object.keys(panel));
    set.forEach(t => {
      if (isCurrencyVariant(t, set)) return;
      out.push({ market, ticker: t, liveSymbol: set.has(`${t}D`) ? `${t}D` : t });
    });
  });

  // Argentine stocks: always the ARS symbol (most liquid), converted with MEP
  const stockSet = new Set(Object.keys(argStocks));
  stockSet.forEach(t => {
    if (!isCurrencyVariant(t, stockSet)) out.push({ market: 'arg_stock', ticker: t, liveSymbol: t });
  });

  // ONs: known by their ARS ticker (…O), priced with the MEP one (…D)
  const corpSet = new Set(Object.keys(corp));
  corpSet.forEach(t => {
    if (!t.endsWith('D')) return;
    const stem = t.slice(0, -1);
    out.push({ market: 'corp', ticker: corpSet.has(`${stem}O`) ? `${stem}O` : t, liveSymbol: t });
  });

  if (!out.length) throw new Error('data912 no disponible');
  return out;
}

function getSearchIndex() {
  if (!_searchIndex) {
    _searchIndex = buildSearchIndex().catch(err => {
      _searchIndex = null; // retry on next search
      throw err;
    });
  }
  return _searchIndex;
}

/** Catalog asset equivalent to a data912 instrument, if any (avoids duplicates). */
function findCatalogMatch(market, ticker) {
  return Object.values(KNOWN_ASSETS).find(a =>
    a.type !== 'crypto' && (a.market || 'us') === market && a.ticker === ticker);
}

async function searchAssets(query) {
  const q = query.trim().toUpperCase();
  if (!q) return [];

  // 0 = exact ticker, 1 = ticker prefix, 2 = name / ticker contains
  const rank = (ticker, name = '') =>
    ticker === q ? 0 : ticker.startsWith(q) ? 1
    : (ticker.includes(q) || name.toUpperCase().includes(q)) ? 2 : -1;

  const results = new Map();
  const add = (asset, r) => {
    const prev = results.get(asset.id);
    if (!prev || r < prev.rank) results.set(asset.id, { asset, rank: r });
  };

  Object.values(KNOWN_ASSETS).forEach(a => {
    const r = rank(a.ticker, a.name);
    if (r >= 0) add(a, r);
  });

  let index = [];
  try { index = await getSearchIndex(); } catch (e) { console.warn('Search index:', e.message); }

  index.forEach(x => {
    const r = rank(x.ticker);
    if (r < 0) return;
    add(findCatalogMatch(x.market, x.ticker) || makeDynamicAsset(x.market, x.ticker, x.liveSymbol), r);
  });

  return [...results.values()]
    .sort((a, b) => a.rank - b.rank
      || a.asset.ticker.length - b.asset.ticker.length
      || a.asset.ticker.localeCompare(b.asset.ticker))
    .slice(0, SEARCH_LIMIT)
    .map(x => x.asset);
}

function assetKindLabel(asset) {
  if (asset.type === 'crypto') return 'Cripto';
  return MARKET_INFO[asset.market || 'us'].label;
}

/** Secondary text for a result: the asset name, or where its price comes from. */
function assetSearchHint(asset) {
  if (!asset.id.startsWith('dyn~')) return asset.name;
  if (asset.market === 'us') return 'NYSE / NASDAQ';
  return asset.ars ? 'BYMA · en pesos, convertido a USD MEP' : 'BYMA · USD MEP';
}

// ─── Search box UI ───────────────────────────────────────────────────────────

let _searchSeq = 0;

async function onAssetSearchInput() {
  const input = document.getElementById('new-ticker');
  const box   = document.getElementById('search-results');
  const seq   = ++_searchSeq;

  if (!input.value.trim()) {
    _searchResults = [];
    box.classList.add('hidden');
    return;
  }

  if (!_searchIndex) {
    box.innerHTML = '<div class="search-empty">Cargando instrumentos de BYMA y EE.UU.…</div>';
    box.classList.remove('hidden');
  }

  const results = await searchAssets(input.value);
  if (seq !== _searchSeq) return; // a newer keystroke is in flight
  _searchResults = results;

  box.innerHTML = results.length
    ? results.map((a, i) => {
        const inList = watchlist.some(w => w.id === a.id);
        return `<button type="button" class="search-item" onclick="addAssetFromSearch(${i})" ${inList ? 'disabled' : ''}>
          <span class="search-ticker">${a.ticker}</span>
          <span class="search-name">${assetSearchHint(a)}</span>
          <span class="search-kind">${inList ? 'En watchlist' : assetKindLabel(a)}</span>
        </button>`;
      }).join('')
    : '<div class="search-empty">Sin resultados. Probá con el ticker, ej: GGAL, AL30, KO.</div>';
  box.classList.remove('hidden');
}

function onAssetSearchKey(event) {
  if (event.key === 'Enter') {
    event.preventDefault();
    document.getElementById('search-results').classList.add('hidden');
    addAsset();
  } else if (event.key === 'Escape') {
    document.getElementById('search-results').classList.add('hidden');
  }
}

function addAssetFromSearch(i) {
  const asset = _searchResults[i];
  if (!asset) return;
  if (asset.id.startsWith('dyn~')) findAsset(asset.id); // register it in KNOWN_ASSETS
  document.getElementById('search-results').classList.add('hidden');
  _searchResults = [];
  addAssetToWatchlist(asset);
}

// Close the results when clicking elsewhere
document.addEventListener('click', e => {
  if (!e.target.closest('.search-wrap')) {
    document.getElementById('search-results')?.classList.add('hidden');
  }
});
