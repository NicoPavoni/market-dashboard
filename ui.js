/**
 * ui.js — All DOM rendering functions
 *
 * Depends on: data.js, analysis.js
 * Exports (globals): renderAssetList, renderAlerts, renderConfigList,
 *                    renderChart, renderIndicators, updateSummaryCards
 */

let priceChart = null;
let currentTF  = '7d';
let selectedAssetId = null;

// ─────────────────────────────────────────────
// Formatters
// ─────────────────────────────────────────────

function formatPrice(p) {
  if (p >= 10000) return '$' + p.toLocaleString('es-AR', { maximumFractionDigits: 0 });
  if (p >= 1000)  return '$' + p.toLocaleString('es-AR', { maximumFractionDigits: 0 });
  if (p >= 1)     return '$' + p.toFixed(2);
  return '$' + p.toFixed(5);
}

function formatChange(chg) {
  return (chg >= 0 ? '+' : '') + chg.toFixed(2) + '%';
}

// ─────────────────────────────────────────────
// Signal badge HTML
// ─────────────────────────────────────────────

function signalBadgeHTML(sig) {
  const MAP = {
    buy:     ['sig-buy',     '● Comprar'],
    wait:    ['sig-wait',    '◑ Esperar'],
    sell:    ['sig-sell',    '● Vender'],
    neutral: ['sig-neutral', '○ Neutro'],
  };
  const [cls, label] = MAP[sig] || MAP.neutral;
  return `<span class="signal-badge ${cls}">${label}</span>`;
}

// ─────────────────────────────────────────────
// Summary metric cards
// ─────────────────────────────────────────────

function updateSummaryCards(watchlist, priceData) {
  let buys = 0, waits = 0;
  watchlist.forEach(a => {
    const d = priceData[a.id];
    if (!d) return;
    if (d.signal === 'buy')  buys++;
    if (d.signal === 'wait') waits++;
  });

  document.getElementById('cnt-buy').textContent   = buys;
  document.getElementById('cnt-wait').textContent  = waits;
  document.getElementById('cnt-total').textContent = watchlist.length;

  const now = new Date();
  document.getElementById('last-upd').textContent =
    now.getHours().toString().padStart(2, '0') + ':' +
    now.getMinutes().toString().padStart(2, '0');
}

// ─────────────────────────────────────────────
// Asset list
// ─────────────────────────────────────────────

function renderAssetList(watchlist, priceData) {
  const container = document.getElementById('asset-list');

  if (!watchlist.length) {
    container.innerHTML = '<div class="empty-state">No hay activos. Agrega desde la pestaña Configurar.</div>';
    return;
  }

  container.innerHTML = watchlist.map(a => {
    const d = priceData[a.id];
    if (!d) {
      return `<div class="asset-row">
        <div><div class="asset-name">${a.name}</div><div class="asset-ticker">${a.ticker}</div></div>
        <div style="grid-column:span 4;color:var(--text-secondary);font-size:13px;">Cargando...</div>
      </div>`;
    }

    const chgStr = formatChange(d.change24h);
    const chgCls = d.change24h >= 0 ? 'green' : 'red';
    const rsiCls = d.rsi <= 35 ? 'green' : d.rsi >= 70 ? 'red' : 'amber';
    const selCls = selectedAssetId === a.id ? ' selected' : '';

    return `<div class="asset-row${selCls}" onclick="selectAsset('${a.id}')">
      <div>
        <div class="asset-name">${a.name}</div>
        <div class="asset-ticker">${a.ticker} · ${a.type === 'crypto' ? 'Cripto' : 'Acción'}</div>
      </div>
      <div class="asset-price">${formatPrice(d.current)}</div>
      <div class="asset-change ${chgCls}">${chgStr}</div>
      <div class="asset-change ${rsiCls}" style="text-align:right">${d.rsi}</div>
      <div style="text-align:right">${signalBadgeHTML(d.signal)}</div>
    </div>`;
  }).join('');

  updateSummaryCards(watchlist, priceData);
}

// ─────────────────────────────────────────────
// Price chart
// ─────────────────────────────────────────────

function renderChart(assetId, tf, priceData) {
  const d = priceData[assetId];
  if (!d) return;

  const days    = tf === '7d' ? 7 : tf === '30d' ? 30 : 90;
  const prices  = d.prices.slice(-days);
  const tsList  = d.timestamps.slice(-days);

  const labels = tsList.map(ts => {
    const dt = new Date(ts);
    return (dt.getMonth() + 1) + '/' + dt.getDate();
  });

  const ctx = document.getElementById('priceChart').getContext('2d');
  if (priceChart) priceChart.destroy();

  const isDark     = window.matchMedia('(prefers-color-scheme: dark)').matches;
  const lineColor  = d.change24h >= 0 ? '#1D9E75' : '#E24B4A';
  const fillColor  = d.change24h >= 0 ? 'rgba(29,158,117,0.07)' : 'rgba(226,75,74,0.07)';
  const gridColor  = isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.05)';
  const textColor  = isDark ? '#777' : '#aaa';

  priceChart = new Chart(ctx, {
    type: 'line',
    data: {
      labels,
      datasets: [{
        data: prices,
        borderColor: lineColor,
        backgroundColor: fillColor,
        borderWidth: 1.5,
        fill: true,
        tension: 0.3,
        pointRadius: 0,
        pointHoverRadius: 4,
      }],
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: { display: false },
        tooltip: {
          callbacks: { label: ctx => formatPrice(ctx.raw) },
        },
      },
      scales: {
        x: {
          grid: { color: gridColor },
          ticks: { color: textColor, maxTicksLimit: 6, font: { size: 11 } },
          border: { display: false },
        },
        y: {
          grid: { color: gridColor },
          ticks: { color: textColor, font: { size: 11 }, callback: v => formatPrice(v) },
          border: { display: false },
          position: 'right',
        },
      },
    },
  });
}

// ─────────────────────────────────────────────
// Indicator boxes below chart
// ─────────────────────────────────────────────

function renderIndicators(assetId, priceData) {
  const d = priceData[assetId];
  if (!d) return;

  const rsiCls   = d.rsi <= 35 ? 'green' : d.rsi >= 70 ? 'red' : 'amber';
  const rsiLabel = d.rsi <= 35 ? '· Sobrevendido' : d.rsi >= 70 ? '· Sobrecomprado' : '· Neutro';

  const maSignal = d.ma20 && d.ma50
    ? (d.ma20 > d.ma50
        ? '<span class="green">Alcista ↑</span>'
        : '<span class="red">Bajista ↓</span>')
    : '—';

  const momentum = d.change24h >= 2
    ? '<span class="green">Fuerte ↑</span>'
    : d.change24h <= -2
      ? '<span class="red">Débil ↓</span>'
      : '<span class="amber">Lateral →</span>';

  document.getElementById('indicators-row').innerHTML = `
    <div class="ind-box">
      <div class="ind-label">RSI (14)</div>
      <div class="ind-val ${rsiCls}">${d.rsi} ${rsiLabel}</div>
    </div>
    <div class="ind-box">
      <div class="ind-label">Tendencia MA20/MA50</div>
      <div class="ind-val">${maSignal}</div>
    </div>
    <div class="ind-box">
      <div class="ind-label">Momentum 24h</div>
      <div class="ind-val">${momentum}</div>
    </div>
  `;
}

// ─────────────────────────────────────────────
// Select an asset → show chart
// ─────────────────────────────────────────────

function selectAsset(id, watchlist, priceData) {
  selectedAssetId = id;
  const d = priceData[id];
  const a = watchlist.find(x => x.id === id);
  if (!d || !a) return;

  document.getElementById('chart-area').style.display = 'block';
  document.getElementById('chart-name').textContent = `${a.name} (${a.ticker})`;

  const priceEl = document.getElementById('chart-price');
  priceEl.textContent = formatPrice(d.current);
  priceEl.className   = 'chart-price ' + (d.change24h >= 0 ? 'green' : 'red');

  renderChart(id, currentTF, priceData);
  renderIndicators(id, priceData);
  renderAssetList(watchlist, priceData); // refresh selection highlight
}

// ─────────────────────────────────────────────
// Alerts tab
// ─────────────────────────────────────────────

function renderAlerts(watchlist, priceData) {
  const container = document.getElementById('alerts-list');
  const alerts = [];

  watchlist.forEach(a => {
    const d = priceData[a.id];
    if (!d) return;
    if (d.signal === 'buy' || d.signal === 'wait') {
      alerts.push({ asset: a, data: d });
    }
  });

  if (!alerts.length) {
    container.innerHTML = '<div class="empty-state">No hay señales activas. Los mercados están en zona neutral.</div>';
    return;
  }

  container.innerHTML = alerts.map(({ asset: a, data: d }) => {
    const isBuy = d.signal === 'buy';
    const borderColor = isBuy ? '#1D9E75' : '#BA7517';
    const icon  = isBuy ? 'bell-ringing' : 'clock';
    const iconColor = isBuy ? '#3B6D11' : '#854F0B';
    const iconBg    = isBuy ? 'alert-buy-icon' : 'alert-warn-icon';
    const label     = isBuy ? '🟢 SEÑAL DE COMPRA' : '🟡 EN OBSERVACIÓN';
    const status    = isBuy ? 'Activa' : 'Pendiente';

    let reason = '';
    if (isBuy) {
      reason = d.rsi <= 35
        ? `RSI en ${d.rsi} — zona de sobreventa. Posible rebote técnico.`
        : 'Cruce de medias alcista (Golden Cross) detectado.';
    } else {
      reason = `RSI en ${d.rsi}. Monitorear — cerca de zona de entrada.`;
    }

    const chgStr = formatChange(d.change24h);
    const chgCls = d.change24h >= 0 ? 'green' : 'red';

    return `<div class="alert-item" style="border-left:3px solid ${borderColor};">
      <div class="alert-icon ${iconBg}">
        <i class="ti ti-${icon}" aria-hidden="true" style="color:${iconColor};font-size:15px;"></i>
      </div>
      <div class="alert-content">
        <div class="alert-title">${label}: ${a.name} (${a.ticker})</div>
        <div class="alert-desc">
          ${reason} —
          Precio actual: <strong>${formatPrice(d.current)}</strong>
          <span class="${chgCls}">(${chgStr} hoy)</span>
        </div>
      </div>
      <div class="alert-time">${status}</div>
    </div>`;
  }).join('');
}

// ─────────────────────────────────────────────
// Config tab — asset management list
// ─────────────────────────────────────────────

function renderConfigList(watchlist, onRemove) {
  const container = document.getElementById('config-list');

  if (!watchlist.length) {
    container.innerHTML = '<div class="empty-state">Watchlist vacía.</div>';
    return;
  }

  container.innerHTML = watchlist.map((a, i) => `
    <div class="config-item">
      <div>
        <span class="config-item-name">${a.name}</span>
        <span class="config-item-meta"> ${a.ticker} · ${a.type === 'crypto' ? 'Cripto' : 'Acción'}</span>
      </div>
      <button class="btn-remove" onclick="(${onRemove})(${i})" aria-label="Eliminar ${a.name}">
        <i class="ti ti-trash" aria-hidden="true"></i>
      </button>
    </div>
  `).join('');
}

// ─────────────────────────────────────────────
// Tab switching
// ─────────────────────────────────────────────

function switchTabUI(tab) {
  ['watchlist', 'alertas', 'config'].forEach(t => {
    document.getElementById('tab-' + t).style.display = t === tab ? 'block' : 'none';
  });
  document.querySelectorAll('.tab').forEach((btn, i) => {
    btn.classList.toggle('active', ['watchlist', 'alertas', 'config'][i] === tab);
  });
}

// ─────────────────────────────────────────────
// Timeframe buttons
// ─────────────────────────────────────────────

function setTFUI(tf, btn, selectedId, priceData) {
  currentTF = tf;
  document.querySelectorAll('.tf-btn').forEach(b => b.classList.remove('active'));
  btn.classList.add('active');
  if (selectedId) renderChart(selectedId, tf, priceData);
}
