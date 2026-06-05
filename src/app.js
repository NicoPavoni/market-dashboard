// ─── State ───────────────────────────────────────────────────────────
let watchlist       = DEFAULT_WATCHLIST.map(a => ({ ...a }));
let priceData       = {};
let fundamentalData = {};
let macroData       = null;
let refreshTimer    = null;

// ─── Helpers ─────────────────────────────────────────────────────────

function getRsiThreshold() {
  return parseInt(document.getElementById('rsi-thresh').value, 10);
}

function setStatus(msg) {
  document.getElementById('status-txt').textContent = msg;
}

// ─── Data loading ─────────────────────────────────────────────────────

async function loadSingleAsset(asset) {
  const threshold = getRsiThreshold();
  priceData[asset.id] = await loadAssetData(asset, threshold);
}

async function loadFundamentals() {
  fundamentalData = await loadAllFundamentals(watchlist);
}

async function loadMacro() {
  macroData = await loadMacroData();
}

function computeCompositeScores() {
  const threshold = getRsiThreshold();
  watchlist.forEach(a => {
    const d    = priceData[a.id];
    const fund = fundamentalData[a.id];
    if (!d) return;
    const result = getCompositeScore(
      d.rsi, d.ma20, d.ma50, d.change24h,
      threshold, fund?.score, macroData?.macroScore
    );
    d.techScore         = result.techScore;
    d.compositeScore    = result.composite;
    d.compositeSignal   = result.compositeSignal;
    d.fundamentalScore  = fund?.score  ?? null;
    d.fundamentalTier   = fund?.tier   ?? null;
    d.fundamentalSector = fund?.sector ?? null;
  });
}

async function loadAll() {
  setStatus('Actualizando precios…');
  await Promise.all([
    Promise.all(watchlist.map(a => loadSingleAsset(a))),
    loadFundamentals(),
    loadMacro(),
  ]);
  computeCompositeScores();
  setStatus('Datos actualizados — próxima actualización automática en 30 min');
}

// ─── Auto-refresh ─────────────────────────────────────────────────────

function scheduleRefresh() {
  if (refreshTimer) clearInterval(refreshTimer);
  const sel  = document.getElementById('refresh-interval');
  const mins = sel
    ? parseInt(sel.value.match(/\d+/)?.[0] || '30', 10)
    : 30;
  if (isNaN(mins)) return;
  refreshTimer = setInterval(refreshAll, mins * 60 * 1000);
}

// ─── Public actions (called from HTML onclick) ────────────────────────

function refreshAll() {
  loadAll().then(() => {
    renderAssetList(watchlist, priceData);
    renderAlerts(watchlist, priceData);
    if (selectedAssetId && priceData[selectedAssetId]) {
      renderChart(selectedAssetId, currentTF, priceData);
      renderIndicators(selectedAssetId, priceData);
    }
    const macroTab  = document.getElementById('tab-macro');
    const riesgoTab = document.getElementById('tab-riesgo');
    if (macroTab  && macroTab.style.display  !== 'none') renderMacroPanel(macroData);
    if (riesgoTab && riesgoTab.style.display !== 'none') renderRiskPanel(watchlist, priceData, fundamentalData, macroData);
  });
}

function switchTab(tab) {
  switchTabUI(tab);
  if (tab === 'alertas') renderAlerts(watchlist, priceData);
  if (tab === 'config')  { renderConfigList(watchlist, removeAsset.toString()); updateDbStatusUI(); }
  if (tab === 'macro')   renderMacroPanel(macroData);
  if (tab === 'riesgo')  renderRiskPanel(watchlist, priceData, fundamentalData, macroData);
  if (tab === 'ayuda')      renderHelpPanel();
  if (tab === 'portafolio') renderPortfolio(priceData);
}

function setTF(tf, btn) {
  setTFUI(tf, btn, selectedAssetId, priceData);
}

function selectAsset(id) {
  selectedAssetId = id;
  const d = priceData[id];
  const a = watchlist.find(x => x.id === id);
  if (!d || !a) return;

  document.getElementById('chart-area').style.display = 'block';

  const nameEl  = document.getElementById('chart-name');
  const priceEl = document.getElementById('chart-price');
  nameEl.textContent  = `${a.name} (${a.ticker})`;
  priceEl.textContent = formatPrice(d.current);
  priceEl.className   = 'chart-price ' + (d.change24h >= 0 ? 'green' : 'red');

  renderChart(id, currentTF, priceData);
  renderIndicators(id, priceData);
  renderAssetList(watchlist, priceData);
}

async function addAsset() {
  const input = document.getElementById('new-ticker');
  const msgEl = document.getElementById('add-msg');
  const val   = input.value.trim().toLowerCase();

  if (!val) return;

  const asset = KNOWN_ASSETS[val];
  if (!asset) {
    msgEl.textContent = '⚠ Activo no reconocido. Prueba: BTC, ETH, SOL, AAPL, NVDA, TSLA, MSFT…';
    msgEl.style.color = '#E24B4A';
    return;
  }
  if (watchlist.find(x => x.id === asset.id)) {
    msgEl.textContent = 'Este activo ya está en tu watchlist.';
    msgEl.style.color = '#BA7517';
    return;
  }

  msgEl.textContent = `Cargando datos de ${asset.name}…`;
  msgEl.style.color = 'var(--text-secondary)';

  watchlist.push({ ...asset });
  await loadSingleAsset(asset);
  fundamentalData[asset.id] = asset.type === 'stock'
    ? getStockFundamentals(asset.id)
    : (await fetchAllCryptoFundamentals([asset.id]))[asset.id] ?? null;
  computeCompositeScores();

  renderAssetList(watchlist, priceData);
  renderConfigList(watchlist, removeAsset.toString());
  renderAlerts(watchlist, priceData);

  input.value       = '';
  msgEl.textContent = `✓ ${asset.name} agregado correctamente.`;
  msgEl.style.color = '#1D9E75';
}

function removeAsset(index) {
  const removed = watchlist.splice(index, 1)[0];
  delete priceData[removed.id];
  delete fundamentalData[removed.id];
  if (selectedAssetId === removed.id) {
    selectedAssetId = null;
    document.getElementById('chart-area').style.display = 'none';
  }
  renderAssetList(watchlist, priceData);
  renderConfigList(watchlist, removeAsset.toString());
  renderAlerts(watchlist, priceData);
}

// ─── Portfolio handlers ────────────────────────────────────────────────

function updateTradePriceField() {
  const assetId = document.getElementById('trade-asset')?.value;
  if (!assetId) return;
  const d = priceData[assetId];
  if (d?.current) {
    document.getElementById('trade-price').value = d.current.toFixed(2);
  }
  updateTradeCalc();
}

function updateTradeCalc() {
  const calcEl = document.getElementById('trade-calc');
  if (!calcEl) return;

  const ars     = parseFloat(document.getElementById('trade-ars')?.value)   || 0;
  const rate    = parseFloat(document.getElementById('trade-rate')?.value)  || 0;
  const price   = parseFloat(document.getElementById('trade-price')?.value) || 0;
  const assetId = document.getElementById('trade-asset')?.value;

  if (!ars || !rate || !price || !assetId) {
    calcEl.innerHTML = '<span class="calc-muted">Completá los campos para calcular</span>';
    return;
  }

  const asset       = Object.values(KNOWN_ASSETS).find(a => a.id === assetId);
  const usdInvested = ars / rate;
  const quantity    = usdInvested / price;

  calcEl.innerHTML = `
    <span class="calc-item">
      <strong>USD invertidos:</strong> ${formatUsd(usdInvested)}
    </span>
    <span class="calc-sep">·</span>
    <span class="calc-item">
      <strong>${asset?.ticker ?? '?'} comprados:</strong> ${quantity.toFixed(6)}
    </span>
  `;
}

async function submitTrade() {
  const msgEl   = document.getElementById('trade-msg');
  const assetId = document.getElementById('trade-asset')?.value;
  const dateVal = document.getElementById('trade-date')?.value;
  const arsVal  = parseFloat(document.getElementById('trade-ars')?.value);
  const rateVal = parseFloat(document.getElementById('trade-rate')?.value);
  const priceVal = parseFloat(document.getElementById('trade-price')?.value);

  if (!assetId || !dateVal || !arsVal || !rateVal || !priceVal) {
    msgEl.textContent = '⚠ Completá todos los campos.';
    msgEl.style.color = '#E24B4A';
    return;
  }
  if ([arsVal, rateVal, priceVal].some(v => isNaN(v) || v <= 0)) {
    msgEl.textContent = '⚠ Los valores deben ser positivos.';
    msgEl.style.color = '#E24B4A';
    return;
  }

  const asset = Object.values(KNOWN_ASSETS).find(a => a.id === assetId);
  if (!asset) {
    msgEl.textContent = '⚠ Activo no reconocido.';
    msgEl.style.color = '#E24B4A';
    return;
  }

  const usdInvested = arsVal / rateVal;
  const quantity    = usdInvested / priceVal;

  addTrade({
    assetId:    asset.id,
    ticker:     asset.ticker,
    assetName:  asset.name,
    assetType:  asset.type,
    date:       dateVal,
    arsAmount:  arsVal,
    arsUsdRate: rateVal,
    usdInvested,
    priceUsd:   priceVal,
    quantity,
  });

  // Auto-add asset to watchlist if not present
  if (!watchlist.find(w => w.id === asset.id)) {
    watchlist.push({ ...asset });
    await loadSingleAsset(asset);
    const fData = asset.type === 'stock'
      ? getStockFundamentals(asset.id)
      : (await fetchAllCryptoFundamentals([asset.id]))[asset.id] ?? null;
    if (fData) fundamentalData[asset.id] = fData;
    computeCompositeScores();
    renderAssetList(watchlist, priceData);
  }

  renderPortfolio(priceData);
}

function deleteTrade(id) {
  if (!confirm('¿Eliminar esta compra?')) return;
  removeTrade(id);
  renderPortfolio(priceData);
}

async function addAssetToWatchlistFromPortfolio(assetId) {
  const asset = Object.values(KNOWN_ASSETS).find(a => a.id === assetId);
  if (!asset || watchlist.find(w => w.id === assetId)) return;
  watchlist.push({ ...asset });
  await loadSingleAsset(asset);
  const fData = asset.type === 'stock'
    ? getStockFundamentals(asset.id)
    : (await fetchAllCryptoFundamentals([asset.id]))[asset.id] ?? null;
  if (fData) fundamentalData[asset.id] = fData;
  computeCompositeScores();
  renderAssetList(watchlist, priceData);
  renderPortfolio(priceData);
}

// ─── Cloud sync handlers ──────────────────────────────────────────────

async function doDbConnect() {
  const token = document.getElementById('db-token-input')?.value ?? '';
  const msgEl = document.getElementById('db-connect-msg');
  msgEl.textContent = 'Conectando con GitHub...';
  msgEl.style.color = 'var(--text-secondary)';

  const r = await dbConnect(token);
  if (r.ok) {
    updateDbStatusUI();
    msgEl.textContent = '';
    // Push existing local trades to the cloud, then pull (cloud may have more)
    const local = loadTrades();
    if (local.length > 0) await dbSaveTrades(local);
    const synced = await syncTradesFromCloud();
    if (synced) renderPortfolio(priceData);
  } else {
    msgEl.textContent = '⚠ ' + r.msg;
    msgEl.style.color = 'var(--red)';
  }
}

function doDbDisconnect() {
  if (!confirm('¿Desconectar la sincronización? Los datos locales se mantienen.')) return;
  dbDisconnect();
  updateDbStatusUI();
}

async function doDbSync() {
  const btn = document.querySelector('[onclick="doDbSync()"]');
  if (btn) { btn.disabled = true; btn.textContent = 'Sincronizando...'; }
  const synced = await syncTradesFromCloud();
  if (synced) renderPortfolio(priceData);
  if (btn) { btn.disabled = false; btn.innerHTML = '<i class="ti ti-refresh"></i> Sincronizar ahora'; }
}

function updateDbStatusUI() {
  const configured = dbIsConfigured();
  const dot        = document.getElementById('db-status-dot');
  const txt        = document.getElementById('db-status-text');
  const formSetup  = document.getElementById('db-form-setup');
  const formConn   = document.getElementById('db-form-connected');
  if (!dot) return;
  dot.className    = 'db-status-dot' + (configured ? ' connected' : '');
  txt.textContent  = configured
    ? '✓ Conectado — datos sincronizados con GitHub Gist'
    : 'No configurado — los datos se guardan solo en este dispositivo';
  formSetup.style.display = configured ? 'none'  : 'block';
  formConn.style.display  = configured ? 'block' : 'none';
  const inp = document.getElementById('db-token-input');
  if (inp) inp.value = '';
}

// ─── Auth UI handlers ─────────────────────────────────────────────────

function _authMsg(id, text, isError) {
  const el = document.getElementById(id);
  if (!el) return;
  el.textContent = text;
  el.className   = 'auth-msg' + (isError ? ' auth-error' : ' auth-ok');
}

async function doAuthSetup() {
  const pw1 = document.getElementById('auth-new-pw')?.value ?? '';
  const pw2 = document.getElementById('auth-new-pw2')?.value ?? '';
  if (pw1 !== pw2) { _authMsg('auth-setup-msg', 'Las contraseñas no coinciden.', true); return; }
  const r = await authSetupPassword(pw1);
  r.ok ? location.reload() : _authMsg('auth-setup-msg', r.msg, true);
}

async function doAuthLogin() {
  const inp = document.getElementById('auth-pw');
  const r   = await authLogin(inp?.value ?? '');
  if (r.ok) { location.reload(); return; }
  _authMsg('auth-login-msg', r.msg, true);
  if (inp) {
    inp.value = '';
    inp.classList.add('auth-shake');
    setTimeout(() => inp.classList.remove('auth-shake'), 450);
  }
}

async function doAuthChangePassword() {
  const cur = document.getElementById('sec-cur-pw')?.value ?? '';
  const nw  = document.getElementById('sec-new-pw')?.value ?? '';
  const nw2 = document.getElementById('sec-new-pw2')?.value ?? '';
  const r   = await authChangePassword(cur, nw, nw2);
  if (r.ok) {
    document.getElementById('sec-msg').textContent = '✓ Contraseña actualizada.';
    document.getElementById('sec-msg').style.color = 'var(--green)';
    ['sec-cur-pw','sec-new-pw','sec-new-pw2'].forEach(id => {
      const el = document.getElementById(id);
      if (el) el.value = '';
    });
  } else {
    document.getElementById('sec-msg').textContent = '⚠ ' + r.msg;
    document.getElementById('sec-msg').style.color = 'var(--red)';
  }
}

// ─── Keyboard shortcut ────────────────────────────────────────────────

document.getElementById('new-ticker').addEventListener('keydown', e => {
  if (e.key === 'Enter') addAsset();
});

// ─── Bootstrap ───────────────────────────────────────────────────────

async function syncPortfolioAssets() {
  const trades = loadTrades();
  const missingIds = [...new Set(trades.map(t => t.assetId))]
    .filter(id => !watchlist.find(a => a.id === id));

  for (const id of missingIds) {
    const asset = Object.values(KNOWN_ASSETS).find(a => a.id === id);
    if (asset) watchlist.push({ ...asset });
  }
}

(async () => {
  if (!initAuthGate()) return;

  await syncPortfolioAssets();
  await loadAll();
  renderAssetList(watchlist, priceData);

  if (watchlist.length > 0) {
    selectAsset(watchlist[0].id);
  }

  scheduleRefresh();

  // Background: sync portfolio from cloud (non-blocking)
  syncTradesFromCloud().then(synced => {
    if (!synced) return;
    const ptab = document.getElementById('tab-portafolio');
    if (ptab && ptab.style.display !== 'none') renderPortfolio(priceData);
  });
})();
