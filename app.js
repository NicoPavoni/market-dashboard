/**
 * app.js — Main application controller
 *
 * Initialises the dashboard, wires up event handlers,
 * and manages the auto-refresh cycle.
 */

// ─── State ───────────────────────────────────────────────────────────
let watchlist  = DEFAULT_WATCHLIST.map(a => ({ ...a }));
let priceData  = {};
let refreshTimer = null;

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

async function loadAll() {
  setStatus('Actualizando precios…');
  await Promise.all(watchlist.map(a => loadSingleAsset(a)));
  setStatus('Datos actualizados — próxima actualización automática en 30 min');
}

// ─── Auto-refresh ─────────────────────────────────────────────────────

function scheduleRefresh() {
  if (refreshTimer) clearInterval(refreshTimer);
  const sel = document.getElementById('refresh-interval');
  const mins = sel
    ? parseInt(sel.value.match(/\d+/)?.[0] || '30', 10)
    : 30;
  if (isNaN(mins)) return; // "Manual" selected
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
  });
}

function switchTab(tab) {
  switchTabUI(tab);
  if (tab === 'alertas') renderAlerts(watchlist, priceData);
  if (tab === 'config')  renderConfigList(watchlist, removeAsset.toString());
}

function setTF(tf, btn) {
  setTFUI(tf, btn, selectedAssetId, priceData);
}

function selectAsset(id) {
  // selectAsset is defined in ui.js but needs closure over app state
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
  const input  = document.getElementById('new-ticker');
  const msgEl  = document.getElementById('add-msg');
  const val    = input.value.trim().toLowerCase();

  if (!val) return;

  const asset = KNOWN_ASSETS[val];
  if (!asset) {
    msgEl.textContent  = '⚠ Activo no reconocido. Prueba: BTC, ETH, SOL, AAPL, NVDA, TSLA, MSFT…';
    msgEl.style.color  = '#E24B4A';
    return;
  }
  if (watchlist.find(x => x.id === asset.id)) {
    msgEl.textContent  = 'Este activo ya está en tu watchlist.';
    msgEl.style.color  = '#BA7517';
    return;
  }

  msgEl.textContent  = `Cargando datos de ${asset.name}…`;
  msgEl.style.color  = 'var(--text-secondary)';

  watchlist.push({ ...asset });
  await loadSingleAsset(asset);

  renderAssetList(watchlist, priceData);
  renderConfigList(watchlist, removeAsset.toString());
  renderAlerts(watchlist, priceData);

  input.value        = '';
  msgEl.textContent  = `✓ ${asset.name} agregado correctamente.`;
  msgEl.style.color  = '#1D9E75';
}

function removeAsset(index) {
  const removed = watchlist.splice(index, 1)[0];
  delete priceData[removed.id];
  if (selectedAssetId === removed.id) {
    selectedAssetId = null;
    document.getElementById('chart-area').style.display = 'none';
  }
  renderAssetList(watchlist, priceData);
  renderConfigList(watchlist, removeAsset.toString());
  renderAlerts(watchlist, priceData);
}

// ─── Keyboard shortcut for add-input ─────────────────────────────────

document.getElementById('new-ticker').addEventListener('keydown', e => {
  if (e.key === 'Enter') addAsset();
});

// ─── Bootstrap ───────────────────────────────────────────────────────

(async () => {
  await loadAll();
  renderAssetList(watchlist, priceData);

  // Auto-select first asset to show chart immediately
  if (watchlist.length > 0) {
    selectAsset(watchlist[0].id);
  }

  scheduleRefresh();
})();
