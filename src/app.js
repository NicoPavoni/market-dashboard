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
  if (tab === 'alertas')    renderAlerts(watchlist, priceData);
  if (tab === 'config')     renderConfigList(watchlist, removeAsset.toString());
  if (tab === 'macro')      renderMacroPanel(macroData);
  if (tab === 'riesgo')     renderRiskPanel(watchlist, priceData, fundamentalData, macroData);
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
  saveWatchlist();
  await loadSingleAsset(asset);
  fundamentalData[asset.id] = (asset.type === 'stock' || asset.type === 'bond')
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
  saveWatchlist();
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

// ─── Trade mode (ARS / USD direct) ──────────────────────────────────

function setTradeMode(mode) {
  document.querySelectorAll('.trade-mode-btn').forEach(btn => {
    btn.classList.toggle('active', btn.dataset.mode === mode);
  });
  const isUsd = mode === 'usd';
  document.getElementById('trade-ars-fields')?.classList.toggle('hidden', isUsd);
  document.getElementById('trade-result-ars')?.classList.toggle('hidden', isUsd);
  document.getElementById('trade-usd-fields')?.classList.toggle('hidden', !isUsd);

  const hint = document.getElementById('trade-qty-hint');
  if (hint) hint.textContent = isUsd ? 'recomendado — ayuda a calcular el precio unitario' : 'opcional en modo ARS';
}

function getTradeMode() {
  return document.querySelector('.trade-mode-btn.active')?.dataset.mode || 'ars';
}

function updateTradePriceField() {
  const assetId = document.getElementById('trade-asset')?.value;
  if (!assetId) return;
  const d = priceData[assetId];
  if (d?.current) {
    const priceEl = document.getElementById('trade-price');
    if (priceEl) priceEl.value = d.current.toFixed(2);
  }
  updateTradeCalc();
  updateTradeCalcUsd();
}

// Called when the user types in the "Cantidad" field.
// If price + rate are set, back-calculates the ARS amount.
function updateTradeFromQty() {
  const qty   = parseFloat(document.getElementById('trade-qty')?.value)   || 0;
  const price = parseFloat(document.getElementById('trade-price')?.value) || 0;
  const rate  = parseFloat(document.getElementById('trade-rate')?.value)  || 0;

  if (qty > 0 && price > 0 && rate > 0) {
    const arsCalc = qty * price * rate;
    document.getElementById('trade-ars').value = arsCalc.toFixed(2);
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

  // Keep the qty field in sync when editing from ARS side
  const qtyEl = document.getElementById('trade-qty');
  if (qtyEl && document.activeElement !== qtyEl) {
    qtyEl.value = quantity.toFixed(6);
  }

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

// Recalculates the display for USD-direct mode
function updateTradeCalcUsd() {
  const calcEl  = document.getElementById('trade-calc-usd');
  if (!calcEl) return;

  const usd     = parseFloat(document.getElementById('trade-usd-amount')?.value) || 0;
  const qty     = parseFloat(document.getElementById('trade-qty')?.value)         || 0;
  const assetId = document.getElementById('trade-asset')?.value;

  if (!usd || !assetId) {
    calcEl.innerHTML = '<span class="calc-muted">Completá monto USD y activo</span>';
    return;
  }

  const asset     = Object.values(KNOWN_ASSETS).find(a => a.id === assetId);
  const ticker    = asset?.ticker ?? '?';
  const priceUnit = qty > 0 ? usd / qty : (priceData[assetId]?.current || 0);
  const qtyCalc   = qty > 0 ? qty : (priceUnit > 0 ? usd / priceUnit : 0);

  // sync qty field
  const qtyEl = document.getElementById('trade-qty');
  if (qtyEl && document.activeElement !== qtyEl && qty <= 0 && qtyCalc > 0) {
    qtyEl.value = qtyCalc.toFixed(6);
  }

  const priceLabel = priceUnit > 0
    ? ` · precio unitario: ${formatUsd(priceUnit)}`
    : '';

  calcEl.innerHTML = `
    <span class="calc-item">
      <strong>USD invertidos:</strong> ${formatUsd(usd)}
    </span>
    <span class="calc-sep">·</span>
    <span class="calc-item">
      <strong>${ticker} registrados:</strong> ${qtyCalc.toFixed(6)}${priceLabel}
    </span>
  `;
}

async function submitTrade() {
  const msgEl   = document.getElementById('trade-msg');
  const mode    = getTradeMode();
  const assetId = document.getElementById('trade-asset')?.value;
  const dateVal = document.getElementById('trade-date')?.value;
  const qtyVal  = parseFloat(document.getElementById('trade-qty')?.value);

  if (!assetId || !dateVal) {
    msgEl.textContent = '⚠ Seleccioná un activo y una fecha.';
    msgEl.style.color = '#E24B4A';
    return;
  }

  const asset = Object.values(KNOWN_ASSETS).find(a => a.id === assetId);
  if (!asset) {
    msgEl.textContent = '⚠ Activo no reconocido.';
    msgEl.style.color = '#E24B4A';
    return;
  }

  let usdInvested, quantity, priceUsd, arsAmount, arsUsdRate;

  if (mode === 'usd') {
    // ── USD direct mode ──────────────────────────────────────────
    const usdAmountVal = parseFloat(document.getElementById('trade-usd-amount')?.value);
    if (!usdAmountVal || usdAmountVal <= 0) {
      msgEl.textContent = '⚠ Ingresá el monto total en USD.';
      msgEl.style.color = '#E24B4A';
      return;
    }
    usdInvested = usdAmountVal;
    if (qtyVal > 0) {
      // Use the exact quantity provided; infer price from it
      quantity  = qtyVal;
      priceUsd  = usdInvested / quantity;
    } else {
      // No quantity given — use current market price to infer it
      const currentPrice = priceData[assetId]?.current;
      if (!currentPrice) {
        msgEl.textContent = '⚠ Ingresá la cantidad (no hay precio disponible para calcularlo).';
        msgEl.style.color = '#E24B4A';
        return;
      }
      priceUsd  = currentPrice;
      quantity  = usdInvested / priceUsd;
    }
    arsAmount  = 0;
    arsUsdRate = 1;

  } else {
    // ── ARS mode (existing) ──────────────────────────────────────
    let arsVal   = parseFloat(document.getElementById('trade-ars')?.value);
    const rateVal  = parseFloat(document.getElementById('trade-rate')?.value);
    const priceVal = parseFloat(document.getElementById('trade-price')?.value);

    // Back-fill ARS from qty * price * rate if ARS was left blank
    if ((!arsVal || isNaN(arsVal)) && qtyVal > 0 && priceVal > 0 && rateVal > 0) {
      arsVal = qtyVal * priceVal * rateVal;
    }

    if (!rateVal || !priceVal || !arsVal) {
      msgEl.textContent = '⚠ Completá monto ARS, tipo de cambio y precio.';
      msgEl.style.color = '#E24B4A';
      return;
    }
    if ([arsVal, rateVal, priceVal].some(v => isNaN(v) || v <= 0)) {
      msgEl.textContent = '⚠ Los valores deben ser positivos.';
      msgEl.style.color = '#E24B4A';
      return;
    }

    arsAmount   = arsVal;
    arsUsdRate  = rateVal;
    priceUsd    = priceVal;
    usdInvested = arsVal / rateVal;
    quantity    = usdInvested / priceVal;
  }

  addTrade({
    assetId:    asset.id,
    ticker:     asset.ticker,
    assetName:  asset.name,
    assetType:  asset.type,
    date:       dateVal,
    arsAmount,
    arsUsdRate,
    usdInvested,
    priceUsd,
    quantity,
  });

  if (!watchlist.find(w => w.id === asset.id)) {
    watchlist.push({ ...asset });
    saveWatchlist();
    await loadSingleAsset(asset);
    const fData = (asset.type === 'stock' || asset.type === 'bond')
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
  saveWatchlist();
  await loadSingleAsset(asset);
  const fData = (asset.type === 'stock' || asset.type === 'bond')
    ? getStockFundamentals(asset.id)
    : (await fetchAllCryptoFundamentals([asset.id]))[asset.id] ?? null;
  if (fData) fundamentalData[asset.id] = fData;
  computeCompositeScores();
  renderAssetList(watchlist, priceData);
  renderPortfolio(priceData);
}

// ─── Auth handlers ────────────────────────────────────────────────────

function _authMsg(id, text, isError) {
  const el = document.getElementById(id);
  if (!el) return;
  el.textContent = text;
  el.className   = 'auth-msg' + (isError ? ' auth-error' : ' auth-ok');
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
  const nw  = document.getElementById('sec-new-pw')?.value  ?? '';
  const nw2 = document.getElementById('sec-new-pw2')?.value ?? '';
  const msg = document.getElementById('sec-msg');
  const r   = await authChangePassword(nw, nw2);
  if (r.ok) {
    msg.textContent = '✓ Contraseña actualizada.';
    msg.style.color = 'var(--green)';
    ['sec-new-pw', 'sec-new-pw2'].forEach(id => {
      const el = document.getElementById(id);
      if (el) el.value = '';
    });
  } else {
    msg.textContent = '⚠ ' + r.msg;
    msg.style.color = 'var(--red)';
  }
}

// ─── Trade editing ───────────────────────────────────────────────────

function openTradeEdit(id) {
  const t = loadTrades().find(x => x.id === id);
  if (!t) return;
  const row = document.querySelector(`.trade-row[data-trade="${id}"]`);
  if (!row) return;
  row.outerHTML = renderTradeEditForm(t);
}

function syncTradeEditFields(id, changed) {
  const usdEl   = document.getElementById(`tedit-usd-${id}`);
  const priceEl = document.getElementById(`tedit-price-${id}`);
  const qtyEl   = document.getElementById(`tedit-qty-${id}`);
  if (!usdEl || !priceEl || !qtyEl) return;
  const usd   = parseFloat(usdEl.value)   || 0;
  const price = parseFloat(priceEl.value) || 0;
  const qty   = parseFloat(qtyEl.value)   || 0;
  if      (changed === 'usd'   && price > 0) qtyEl.value   = (usd / price).toFixed(6);
  else if (changed === 'price' && usd   > 0) qtyEl.value   = (usd / price).toFixed(6);
  else if (changed === 'qty'   && price > 0) usdEl.value   = (qty * price).toFixed(2);
}

function saveTradeEdit(id) {
  const t = loadTrades().find(x => x.id === id);
  if (!t) return;

  const newDate = document.getElementById(`tedit-date-${id}`)?.value || t.date;
  const newUsd  = parseFloat(document.getElementById(`tedit-usd-${id}`)?.value);

  const updates = {
    date:        newDate,
    usdInvested: isNaN(newUsd) || newUsd <= 0 ? t.usdInvested : newUsd,
  };

  if (t.isInitial) {
    const price = priceData[t.assetId]?.current || t.priceUsd || 1;
    updates.priceUsd = price;
    updates.quantity = updates.usdInvested / price;
  } else {
    const newPrice = parseFloat(document.getElementById(`tedit-price-${id}`)?.value);
    const newQty   = parseFloat(document.getElementById(`tedit-qty-${id}`)?.value);
    if (!isNaN(newPrice) && newPrice > 0) updates.priceUsd = newPrice;
    if (!isNaN(newQty)   && newQty   > 0) updates.quantity = newQty;
    // ensure internal consistency: usd = qty * price
    updates.usdInvested = (updates.quantity ?? t.quantity) * (updates.priceUsd ?? t.priceUsd);
  }

  updateTrade(id, updates);
  renderPortfolio(priceData);
}

function cancelTradeEdit() {
  renderPortfolio(priceData);
}

// ─── Keyboard shortcut ────────────────────────────────────────────────

document.getElementById('new-ticker').addEventListener('keydown', e => {
  if (e.key === 'Enter') addAsset();
});

// ─── Initial balances (first-run seeding) ────────────────────────────

const SEED_KEY = 'mktdash_seed_v1';
const INITIAL_BALANCES = [
  { key: 'sp500',  usd: 154 },
  { key: 'nvidia', usd: 135 },
  { key: 'ym34o',  usd: 354 },
  { key: 'tlcto',  usd: 290 },
];

function _needsSeed() {
  return !localStorage.getItem(SEED_KEY) && loadTrades().length === 0;
}

function seedInitialBalancesPreload() {
  if (!_needsSeed()) return;
  for (const { key } of INITIAL_BALANCES) {
    const asset = KNOWN_ASSETS[key];
    if (asset && !watchlist.find(w => w.id === asset.id)) {
      watchlist.push({ ...asset });
    }
  }
}

async function seedInitialBalances() {
  if (!_needsSeed()) {
    localStorage.setItem(SEED_KEY, '1');
    return;
  }
  const today = new Date().toISOString().slice(0, 10);
  for (const { key, usd } of INITIAL_BALANCES) {
    const asset = KNOWN_ASSETS[key];
    if (!asset) continue;
    const price = priceData[asset.id]?.current || STOCK_BASE_PRICES[asset.id] || 1;
    addTrade({
      assetId:    asset.id,
      ticker:     asset.ticker,
      assetName:  asset.name,
      assetType:  asset.type,
      date:       today,
      arsAmount:  0,
      arsUsdRate: 1,
      usdInvested: usd,
      priceUsd:   price,
      quantity:   usd / price,
      isInitial:  true,
    });
  }
  localStorage.setItem(SEED_KEY, '1');
}

async function addInitialBalance() {
  const assetId = document.getElementById('initial-asset')?.value;
  const usd     = parseFloat(document.getElementById('initial-usd')?.value);
  const msgEl   = document.getElementById('initial-msg');

  if (!assetId) {
    msgEl.textContent = '⚠ Seleccioná un activo.';
    msgEl.style.color = '#E24B4A';
    return;
  }
  if (!usd || usd <= 0) {
    msgEl.textContent = '⚠ Ingresá un monto válido en USD.';
    msgEl.style.color = '#E24B4A';
    return;
  }

  const asset = Object.values(KNOWN_ASSETS).find(a => a.id === assetId);
  if (!asset) return;

  if (!watchlist.find(w => w.id === assetId)) {
    watchlist.push({ ...asset });
    saveWatchlist();
    await loadSingleAsset(asset);
    computeCompositeScores();
  }

  const price = priceData[assetId]?.current || STOCK_BASE_PRICES[assetId] || 1;
  const today = new Date().toISOString().slice(0, 10);

  addTrade({
    assetId:    asset.id,
    ticker:     asset.ticker,
    assetName:  asset.name,
    assetType:  asset.type,
    date:       today,
    arsAmount:  0,
    arsUsdRate: 1,
    usdInvested: usd,
    priceUsd:   price,
    quantity:   usd / price,
    isInitial:  true,
  });

  document.getElementById('initial-usd').value = '';
  msgEl.textContent = `✓ Saldo inicial de ${formatUsd(usd)} registrado.`;
  msgEl.style.color = '#1D9E75';

  renderPortfolio(priceData);
}

// ─── Watchlist persistence ────────────────────────────────────────────

function saveWatchlist() {
  dbSaveWatchlist(watchlist.map(a => a.id));
}

async function syncWatchlistFromCloud() {
  const ids = await dbLoadWatchlist();
  if (!ids || !ids.length) return;
  watchlist = ids
    .map(id => Object.values(KNOWN_ASSETS).find(a => a.id === id))
    .filter(Boolean)
    .map(a => ({ ...a }));
}

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
  // Wait for Firebase to determine auth state (resolves fast — uses cached credentials)
  const user = await waitForAuth();

  const appEl  = document.getElementById('app-container');
  const authEl = document.getElementById('auth-screen');

  if (!user) {
    appEl.style.display  = 'none';
    authEl.style.display = 'flex';
    return;
  }

  appEl.style.display  = 'flex';
  authEl.style.display = 'none';

  await syncWatchlistFromCloud();
  // Sync trades from cloud before seeding to prevent double-seeding on new devices
  const cloudSynced = await syncTradesFromCloud();
  seedInitialBalancesPreload();
  await syncPortfolioAssets();
  await loadAll();
  await seedInitialBalances();
  renderAssetList(watchlist, priceData);

  if (watchlist.length > 0) selectAsset(watchlist[0].id);

  scheduleRefresh();

  if (cloudSynced) {
    const ptab = document.getElementById('tab-portafolio');
    if (ptab && ptab.style.display !== 'none') renderPortfolio(priceData);
  }
})();
