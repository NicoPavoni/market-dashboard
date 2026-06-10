let priceChart  = null;
let equityChart = null;
let currentTF   = '7d';
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

function formatBillion(n) {
  if (n >= 1e12) return '$' + (n / 1e12).toFixed(2) + 'T';
  if (n >= 1e9)  return '$' + (n / 1e9).toFixed(1) + 'B';
  return '$' + n.toLocaleString();
}

// ─────────────────────────────────────────────
// Signal badge
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
    const sig = d.compositeSignal || d.signal;
    if (sig === 'buy')  buys++;
    if (sig === 'wait') waits++;
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

    const chgStr  = formatChange(d.change24h);
    const chgCls  = d.change24h >= 0 ? 'green' : 'red';
    const rsiCls  = d.rsi <= 35 ? 'green' : d.rsi >= 70 ? 'red' : 'amber';
    const selCls  = selectedAssetId === a.id ? ' selected' : '';
    const sig     = d.compositeSignal || d.signal;

    const typeLabel = a.type === 'crypto' ? 'Cripto' : a.type === 'bond' ? 'Bono' : 'Acción';
    const srcBadge  = d.simulated
      ? '<span class="price-sim-badge" title="Precio simulado — Yahoo Finance no disponible">sim</span>'
      : '';

    return `<div class="asset-row${selCls}" onclick="selectAsset('${a.id}')">
      <div>
        <div class="asset-name">${a.name}</div>
        <div class="asset-ticker">${a.ticker} · ${typeLabel} ${srcBadge}</div>
      </div>
      <div class="asset-price">${formatPrice(d.current)}</div>
      <div class="asset-change ${chgCls}">${chgStr}</div>
      <div class="asset-change ${rsiCls}" style="text-align:right">${d.rsi}</div>
      <div style="text-align:right">${signalBadgeHTML(sig)}</div>
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

  const days   = tf === '7d' ? 7 : tf === '30d' ? 30 : 90;
  const prices = d.prices.slice(-days);
  const tsList = d.timestamps.slice(-days);

  const labels = tsList.map(ts => {
    const dt = new Date(ts);
    return (dt.getMonth() + 1) + '/' + dt.getDate();
  });

  const ctx = document.getElementById('priceChart').getContext('2d');
  if (priceChart) priceChart.destroy();

  const isDark    = window.matchMedia('(prefers-color-scheme: dark)').matches;
  const lineColor = d.change24h >= 0 ? '#1D9E75' : '#E24B4A';
  const fillColor = d.change24h >= 0 ? 'rgba(29,158,117,0.07)' : 'rgba(226,75,74,0.07)';
  const gridColor = isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.05)';
  const textColor = isDark ? '#777' : '#aaa';

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
        tooltip: { callbacks: { label: ctx => formatPrice(ctx.raw) } },
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
// Indicator boxes (below chart)
// ─────────────────────────────────────────────

function renderIndicators(assetId, priceData) {
  const d = priceData[assetId];
  if (!d) return;

  const rsiCls   = d.rsi <= 35 ? 'green' : d.rsi >= 70 ? 'red' : 'amber';
  const rsiLabel = d.rsi <= 35 ? '· Sobrevendido' : d.rsi >= 70 ? '· Sobrecomprado' : '· Neutro';

  const maSignal = d.ma20 && d.ma50
    ? (d.ma20 > d.ma50 ? '<span class="green">Alcista ↑</span>' : '<span class="red">Bajista ↓</span>')
    : '—';

  const momentum = d.change24h >= 2
    ? '<span class="green">Fuerte ↑</span>'
    : d.change24h <= -2
      ? '<span class="red">Débil ↓</span>'
      : '<span class="amber">Lateral →</span>';

  let fundBox = '';
  if (d.fundamentalScore !== null && d.fundamentalScore !== undefined) {
    const fCls = d.fundamentalScore >= 70 ? 'green' : d.fundamentalScore >= 50 ? 'amber' : 'red';
    const tierTxt = d.fundamentalTier ? `<span style="font-size:11px;font-weight:400;margin-left:3px;">${d.fundamentalTier}</span>` : '';
    fundBox = `<div class="ind-box">
      <div class="ind-label">Score Fundamental</div>
      <div class="ind-val ${fCls}">${d.fundamentalScore}${tierTxt}</div>
    </div>`;
  }

  let compBox = '';
  if (d.compositeScore !== null && d.compositeScore !== undefined) {
    const cSig = d.compositeSignal || 'neutral';
    const cCls = cSig === 'buy' ? 'green' : cSig === 'sell' ? 'red' : 'amber';
    compBox = `<div class="ind-box ind-composite">
      <div class="ind-label">Score Compuesto</div>
      <div class="ind-val ${cCls}">${d.compositeScore}<span style="font-size:11px;font-weight:400;margin-left:3px;">/ 100</span></div>
    </div>`;
  }

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
    ${fundBox}
    ${compBox}
  `;
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
    const sig = d.compositeSignal || d.signal;
    if (sig === 'buy' || sig === 'wait') alerts.push({ asset: a, data: d });
  });

  if (!alerts.length) {
    container.innerHTML = '<div class="empty-state">No hay señales activas. Los mercados están en zona neutral.</div>';
    return;
  }

  container.innerHTML = alerts.map(({ asset: a, data: d }) => {
    const sig     = d.compositeSignal || d.signal;
    const isBuy   = sig === 'buy';
    const border  = isBuy ? '#1D9E75' : '#BA7517';
    const iconBg  = isBuy ? 'alert-buy-icon' : 'alert-warn-icon';
    const icon    = isBuy ? 'bell-ringing' : 'clock';
    const label   = isBuy ? '🟢 SEÑAL DE COMPRA' : '🟡 EN OBSERVACIÓN';
    const status  = isBuy ? 'Activa' : 'Pendiente';

    let reason = '';
    if (isBuy) {
      reason = d.rsi <= 35
        ? `RSI en ${d.rsi} — sobreventa. Posible rebote técnico.`
        : 'Cruce de medias alcista (Golden Cross) detectado.';
    } else {
      reason = `RSI en ${d.rsi}. Cerca de zona de entrada.`;
    }

    const chgStr  = formatChange(d.change24h);
    const chgCls  = d.change24h >= 0 ? 'green' : 'red';
    const sector  = d.fundamentalSector ? `· ${d.fundamentalSector}` : '';

    const scoreRow = (d.compositeScore !== null && d.compositeScore !== undefined)
      ? `<div class="alert-scores">
          <span class="score-pill score-tech">Técnico: ${d.techScore}</span>
          <span class="score-pill score-fund">Fund: ${d.fundamentalScore ?? '—'}</span>
          <span class="score-pill score-comp">Compuesto: ${d.compositeScore}/100</span>
         </div>`
      : '';

    return `<div class="alert-item" style="border-left:3px solid ${border};">
      <div class="alert-icon ${iconBg}">
        <i class="ti ti-${icon}" aria-hidden="true" style="font-size:15px;"></i>
      </div>
      <div class="alert-content">
        <div class="alert-title">${label}: ${a.name} (${a.ticker}) ${sector}</div>
        <div class="alert-desc">
          ${reason} —
          Precio: <strong>${formatPrice(d.current)}</strong>
          <span class="${chgCls}">(${chgStr} hoy)</span>
        </div>
        ${scoreRow}
      </div>
      <div class="alert-time">${status}</div>
    </div>`;
  }).join('');
}

// ─────────────────────────────────────────────
// Macro tab
// ─────────────────────────────────────────────

function translateFGLabel(label) {
  const MAP = {
    'Extreme Fear': 'Miedo Extremo',
    'Fear':         'Miedo',
    'Neutral':      'Neutral',
    'Greed':        'Codicia',
    'Extreme Greed':'Codicia Extrema',
  };
  return MAP[label] || label;
}

function renderMacroPanel(macroData) {
  const container = document.getElementById('macro-content');
  if (!container) return;

  if (!macroData) {
    container.innerHTML = '<div class="empty-state">No se pudo cargar el contexto macro. Intente actualizar.</div>';
    return;
  }

  const fg = macroData.fearGreed;
  const g  = macroData.global;

  const fgColor =
    fg.value <= 25 ? '#E24B4A' :
    fg.value <= 45 ? '#BA7517' :
    fg.value <= 55 ? '#888884' :
    fg.value <= 75 ? '#7AB648' : '#1D9E75';

  const mcapChange = g?.mcapChange24h ?? 0;
  const mcapChgStr = (mcapChange >= 0 ? '+' : '') + mcapChange.toFixed(2) + '%';
  const mcapChgCls = mcapChange >= 0 ? 'green' : 'red';

  const mcapStr = g ? formatBillion(g.totalMcap) : '—';
  const volStr  = g ? formatBillion(g.totalVol)  : '—';
  const btcDom  = g ? g.btcDom.toFixed(1) + '%'  : '—';
  const ethDom  = g ? g.ethDom.toFixed(1) + '%'  : '—';

  container.innerHTML = `
    <div class="macro-grid">
      <div class="macro-card">
        <div class="section-title">Índice de Miedo y Codicia (Cripto)</div>
        <div class="fg-display">
          <div class="fg-value" style="color:${fgColor}">${fg.value}</div>
          <div class="fg-label-text">${translateFGLabel(fg.label)}</div>
        </div>
        <div class="fg-track-wrap">
          <div class="fg-track">
            <div class="fg-pointer" style="left:${fg.value}%;border-color:${fgColor}"></div>
          </div>
          <div class="fg-bar-labels">
            <span>Miedo</span><span>Neutral</span><span>Codicia</span>
          </div>
        </div>
        <div class="fg-note">Miedo extremo (&lt;25) = oportunidad de compra histórica</div>
      </div>

      <div class="macro-card">
        <div class="section-title">Mercado Global Cripto</div>
        <div class="macro-stats-grid">
          <div class="macro-stat">
            <div class="macro-stat-label">Cap. Total</div>
            <div class="macro-stat-val">${mcapStr}</div>
            <div class="macro-stat-sub ${mcapChgCls}">${mcapChgStr} hoy</div>
          </div>
          <div class="macro-stat">
            <div class="macro-stat-label">Volumen 24h</div>
            <div class="macro-stat-val">${volStr}</div>
          </div>
          <div class="macro-stat">
            <div class="macro-stat-label">Dominancia BTC</div>
            <div class="macro-stat-val">${btcDom}</div>
          </div>
          <div class="macro-stat">
            <div class="macro-stat-label">Dominancia ETH</div>
            <div class="macro-stat-val">${ethDom}</div>
          </div>
        </div>
      </div>
    </div>

    <div class="macro-card macro-signal-card">
      <div class="section-title">Señal Macro para Compradores</div>
      <div class="macro-signal-row">
        ${signalBadgeHTML(macroData.signal)}
        <span class="macro-signal-desc">${macroData.signalDesc}</span>
        <span class="macro-score-pill">Score macro: ${macroData.macroScore}/100</span>
      </div>
      <div class="macro-note">
        El score macro representa el 20% de la señal compuesta. Un mercado con miedo extremo favorece entradas con horizonte de 2+ años (estrategia contrarian).
      </div>
    </div>
  `;
}

// ─────────────────────────────────────────────
// Risk tab
// ─────────────────────────────────────────────

function renderRiskPanel(watchlist, priceData, fundamentalData, macroData) {
  const container = document.getElementById('riesgo-content');
  if (!container) return;

  if (!watchlist.length) {
    container.innerHTML = '<div class="empty-state">Agrega activos a tu watchlist para ver el análisis de riesgo.</div>';
    return;
  }

  const risk  = analyzePortfolioRisk(watchlist, priceData);
  const alloc = suggestAllocation(watchlist, priceData, fundamentalData, macroData);

  const divStars = Array.from({ length: 5 }, (_, i) => {
    const filled = i < Math.round(risk.divScore / 20);
    return `<span class="div-dot${filled ? ' filled' : ''}"></span>`;
  }).join('');

  const n = risk.assets.length;
  let matrixHTML = '';
  if (n >= 2) {
    const headers = risk.assets.map(a => `<th title="${a.name}">${a.ticker}</th>`).join('');
    const rows    = risk.assets.map((a, i) => {
      const cells = risk.assets.map((b, j) => {
        if (i === j) return '<td class="corr-self">—</td>';
        const r   = risk.matrix[i][j];
        const lbl = corrLabel(r);
        return `<td class="${lbl.cls}">${lbl.text}</td>`;
      }).join('');
      return `<tr><th>${a.ticker}</th>${cells}</tr>`;
    }).join('');
    matrixHTML = `
      <div class="section-title" style="margin-top:1.25rem">Correlación entre activos</div>
      <div class="corr-matrix-wrap">
        <table class="corr-matrix">
          <thead><tr><th></th>${headers}</tr></thead>
          <tbody>${rows}</tbody>
        </table>
      </div>
      <div class="corr-note">Alta correlación = se mueven juntos → menor diversificación efectiva.</div>
    `;
  }

  let allocHTML = '';
  if (alloc.length) {
    allocHTML = alloc.map(x => {
      const sector = x.fund?.sector ?? (x.asset.type === 'crypto' ? 'Criptomoneda' : 'Acción');
      return `<div class="alloc-item">
        <div class="alloc-info">
          <span class="alloc-name">${x.asset.name} <span class="alloc-ticker">${x.asset.ticker}</span></span>
          <span class="alloc-meta">${sector} · ${x.riskLabel}</span>
        </div>
        <div class="alloc-right">
          <div class="alloc-bar-wrap">
            <div class="alloc-bar-fill" style="width:${x.weight}%"></div>
          </div>
          <span class="alloc-pct">${x.weight}%</span>
        </div>
      </div>`;
    }).join('');
  }

  container.innerHTML = `
    <div class="risk-top-grid">
      <div class="macro-card">
        <div class="section-title">Diversificación del portafolio</div>
        <div class="div-score-row">
          <div class="div-dots">${divStars}</div>
          <span class="div-label">${risk.divLabel}</span>
        </div>
        <div class="div-stats">
          <span>${risk.cryptos} cripto${risk.cryptos !== 1 ? 's' : ''}</span>
          <span>·</span>
          <span>${risk.stocks} acción${risk.stocks !== 1 ? 'es' : ''}</span>
          <span>·</span>
          <span>Corr. promedio: ${(risk.avgCorr * 100).toFixed(0)}%</span>
        </div>
      </div>

      <div class="macro-card">
        <div class="section-title">Asignación sugerida (máx. 4 activos)</div>
        <div class="alloc-list">${allocHTML || '<div class="empty-state" style="padding:1rem">Sin datos suficientes.</div>'}</div>
        <div class="alloc-note">Ponderación: técnico 45% · fundamental 40% · macro 15%</div>
      </div>
    </div>
    ${matrixHTML}
  `;
}

// ─────────────────────────────────────────────
// Config tab — asset list
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
// Help / Glossary panel
// ─────────────────────────────────────────────

function renderHelpPanel() {
  const container = document.getElementById('ayuda-content');
  if (!container) return;

  const concepts = [
    {
      icon: 'ti-activity', title: 'RSI', fullName: 'Índice de Fuerza Relativa',
      desc: 'Mide si un activo fue comprado o vendido en exceso. Compara la magnitud de las ganancias recientes con las pérdidas recientes en los últimos 14 días.',
      key: '&lt;35 = sobrevendido (posible rebote) · &gt;70 = sobrecomprado (posible corrección)',
      type: 'technical',
    },
    {
      icon: 'ti-chart-line', title: 'MA20 y MA50', fullName: 'Medias Móviles',
      desc: 'Promedio del precio de los últimos 20 o 50 días. Suavizan la volatilidad diaria para mostrar la tendencia real. La MA20 reacciona rápido; la MA50 muestra el largo plazo.',
      key: 'MA20 &gt; MA50 = tendencia alcista (el corto plazo supera al largo)',
      type: 'technical',
    },
    {
      icon: 'ti-arrows-cross', title: 'Golden Cross', fullName: 'Cruce Dorado',
      desc: 'Ocurre cuando la MA20 cruza por arriba de la MA50. Es una de las señales más famosas del análisis técnico, históricamente asociada con inicios de tendencias alcistas de mediano plazo.',
      key: 'Señal más confiable cuando va acompañada de volumen de compra creciente',
      type: 'technical',
    },
    {
      icon: 'ti-trending-up', title: 'Momentum', fullName: 'Velocidad del precio (24h)',
      desc: 'Mide qué tan fuerte fue el movimiento del precio en las últimas 24 horas. Ayuda a confirmar si una señal está ganando fuerza o perdiendo impulso.',
      key: '+2% o más = fuerte ↑ · entre ±2% = lateral → · -2% o menos = débil ↓',
      type: 'technical',
    },
    {
      icon: 'ti-calculator', title: 'Score Compuesto', fullName: 'Señal integrada 0–100',
      desc: 'El corazón de la app. Combina análisis técnico, fundamental y macro en un único número. Una señal respaldada por múltiples perspectivas es mucho más confiable que una sola.',
      key: '≥68 Comprar · ≥50 Esperar · ≥32 Neutro · &lt;32 Vender',
      type: 'composite',
    },
    {
      icon: 'ti-building-bank', title: 'Score Fundamental', fullName: 'Solidez del activo',
      desc: 'Para criptos: ranking de market cap, liquidez (volumen/mcap), distancia del ATH y momentum de 30 días. Para acciones: sector, capitalización de mercado y estabilidad histórica.',
      key: 'Score &gt;70 = activo establecido con fundamentos robustos',
      type: 'fundamental',
    },
    {
      icon: 'ti-hearts', title: 'Miedo y Codicia', fullName: 'Fear &amp; Greed Index',
      desc: 'Mide el sentimiento general del mercado cripto en escala 0-100. El miedo extremo históricamente marca los mejores momentos de compra, porque el pánico genera precios baratos (estrategia contrarian).',
      key: '0-25 Miedo extremo · 25-45 Miedo · 45-55 Neutral · 55-75 Codicia · 75-100 Codicia extrema',
      type: 'macro',
    },
    {
      icon: 'ti-world', title: 'Score Macro', fullName: 'Contexto del mercado global',
      desc: 'Derivado del índice de miedo/codicia y la capitalización total del mercado. Mide si el "ambiente" general del mercado favorece o no las compras.',
      key: 'Miedo extremo = score macro alto = el mercado te ofrece descuentos',
      type: 'macro',
    },
    {
      icon: 'ti-git-branch', title: 'Correlación', fullName: 'Movimiento conjunto de activos',
      desc: 'Mide cómo se mueven dos activos entre sí (-1 a +1). Alta correlación positiva significa que si uno cae, el otro también cae. Para diversificar bien, buscás activos con baja correlación.',
      key: 'BTC y ETH suelen tener correlación muy alta (&gt;0.85). BTC y AAPL, baja.',
      type: 'risk',
    },
    {
      icon: 'ti-coin', title: 'ATH', fullName: 'All-Time High (máximo histórico)',
      desc: 'El precio más alto que alcanzó un activo en toda su historia. La distancia al ATH indica cuánto espacio de recuperación tiene. Muy lejos del ATH = más potencial upside, pero también más riesgo.',
      key: '-60% del ATH = potencialmente puede doblar su precio para volver al máximo',
      type: 'fundamental',
    },
    {
      icon: 'ti-repeat', title: 'DCA', fullName: 'Dollar Cost Averaging',
      desc: 'Estrategia de comprar una cantidad fija de forma regular (semanal o mensual) sin importar el precio del momento. Elimina el riesgo de "entrar en el peor momento". Con 2 años de horizonte, supera históricamente al market timing.',
      key: 'Tip: cuando la app muestra RSI &lt;35, comprá un poco más que la cuota habitual',
      type: 'strategy',
    },
    {
      icon: 'ti-shield-check', title: 'Diversificación', fullName: 'Distribución del riesgo',
      desc: 'Invertir en activos de distintos tipos (criptos + acciones) y con baja correlación entre sí. Si un activo cae -50%, los demás no se ven afectados de la misma manera. La app sugiere 2-4 activos óptimos.',
      key: 'Mezclar criptos y acciones mejora la diversificación porque tienen correlación baja',
      type: 'risk',
    },
  ];

  const TYPES = {
    technical:   { bg: '#EAF3DE', color: '#3B6D11', label: 'Técnico' },
    composite:   { bg: '#E8F0FF', color: '#185FA5', label: 'Compuesto' },
    fundamental: { bg: '#FFF4E5', color: '#854F0B', label: 'Fundamental' },
    macro:       { bg: '#F0F0FF', color: '#4B4FA6', label: 'Macro' },
    risk:        { bg: '#FFE8EC', color: '#A32D2D', label: 'Riesgo' },
    strategy:    { bg: '#E8FAF5', color: '#1D7A58', label: 'Estrategia' },
  };

  const cards = concepts.map(c => {
    const t = TYPES[c.type] || TYPES.technical;
    return `<div class="help-card">
      <div class="help-card-header">
        <div class="help-icon" style="background:${t.bg};color:${t.color}">
          <i class="ti ${c.icon}" aria-hidden="true"></i>
        </div>
        <span class="help-type-badge" style="background:${t.bg};color:${t.color}">${t.label}</span>
      </div>
      <div class="help-title">${c.title}</div>
      <div class="help-fullname">${c.fullName}</div>
      <div class="help-desc">${c.desc}</div>
      <div class="help-key">
        <i class="ti ti-key" aria-hidden="true" style="font-size:12px;flex-shrink:0;margin-top:1px;"></i>
        <span>${c.key}</span>
      </div>
    </div>`;
  }).join('');

  container.innerHTML = `
    <div class="help-intro">
      <i class="ti ti-info-circle" aria-hidden="true"></i>
      Esta guía explica todos los indicadores que usa la app. Entender qué está mirando la herramienta te ayuda a tomar mejores decisiones de inversión. Recordá que ningún indicador es infalible.
    </div>
    <div class="help-grid">${cards}</div>
  `;
}

// ─────────────────────────────────────────────
// Tab switching
// ─────────────────────────────────────────────

const TAB_ORDER = ['watchlist', 'alertas', 'macro', 'riesgo', 'portafolio', 'ayuda', 'config'];

function switchTabUI(tab) {
  TAB_ORDER.forEach(t => {
    document.getElementById('tab-' + t).style.display = t === tab ? 'block' : 'none';
  });
  document.querySelectorAll('.nav-item').forEach((btn, i) => {
    btn.classList.toggle('active', TAB_ORDER[i] === tab);
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

// ─────────────────────────────────────────────
// Portfolio tab
// ─────────────────────────────────────────────

function formatTradeDate(dateStr) {
  const d = new Date(dateStr + 'T12:00:00');
  return d.toLocaleDateString('es-AR', { day: 'numeric', month: 'short', year: 'numeric' });
}

function formatUsd(n) {
  return '$' + n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function renderAddTradeFormHTML() {
  const assets = getUniqueAssetOptions();
  const cryptoOpts = assets
    .filter(a => a.type === 'crypto')
    .map(a => `<option value="${a.id}" data-ticker="${a.ticker}">${a.ticker} — ${a.name}</option>`)
    .join('');
  const stockOpts = assets
    .filter(a => a.type === 'stock')
    .map(a => `<option value="${a.id}" data-ticker="${a.ticker}">${a.ticker} — ${a.name}</option>`)
    .join('');
  const bondOpts = assets
    .filter(a => a.type === 'bond')
    .map(a => `<option value="${a.id}" data-ticker="${a.ticker}">${a.ticker} — ${a.name}</option>`)
    .join('');

  const today = new Date().toISOString().split('T')[0];
  const blueRate = (typeof arsRates !== 'undefined' && arsRates?.blue)
    ? Math.round(arsRates.blue)
    : null;
  const rateDefault = blueRate || 1200;
  const rateBadge = blueRate
    ? `<span class="ars-rate-badge"><i class="ti ti-refresh" style="font-size:10px;vertical-align:middle"></i> Dólar blue: $${blueRate.toLocaleString('es-AR')}</span>`
    : '';

  return `<div class="add-trade-card">

    <!-- Mode tabs -->
    <div class="trade-mode-tabs">
      <button class="trade-mode-btn active" data-mode="ars" onclick="setTradeMode('ars')">
        <i class="ti ti-currency-peso" aria-hidden="true"></i> En pesos ARS
      </button>
      <button class="trade-mode-btn" data-mode="usd" onclick="setTradeMode('usd')">
        <i class="ti ti-currency-dollar" aria-hidden="true"></i> En dólares USD
        <span class="trade-mode-hint">para registrar posiciones existentes</span>
      </button>
    </div>

    <!-- Common fields (always visible) -->
    <div class="trade-form-grid">
      <div class="form-group">
        <label class="config-label">Activo</label>
        <select id="trade-asset" onchange="updateTradePriceField()">
          <option value="">Seleccionar activo...</option>
          <optgroup label="Criptomonedas">${cryptoOpts}</optgroup>
          <optgroup label="Acciones / CEDEARs">${stockOpts}</optgroup>
          <optgroup label="Bonos / Obligaciones Negociables">${bondOpts}</optgroup>
        </select>
      </div>
      <div class="form-group">
        <label class="config-label">Fecha de compra</label>
        <input type="date" class="add-input" id="trade-date" value="${today}" />
      </div>
      <div class="form-group">
        <label class="config-label">
          Cantidad (unidades)
          <span class="form-hint" id="trade-qty-hint">opcional en modo ARS</span>
        </label>
        <input type="number" class="add-input" id="trade-qty"
          placeholder="0.01650022" min="0" step="any" oninput="updateTradeFromQty()" />
      </div>
    </div>

    <!-- ARS mode fields -->
    <div class="trade-form-grid" id="trade-ars-fields">
      <div class="form-group">
        <label class="config-label">Monto en pesos ARS $</label>
        <input type="number" class="add-input" id="trade-ars"
          placeholder="200000" min="0" oninput="updateTradeCalc()" />
      </div>
      <div class="form-group">
        <label class="config-label">
          Tipo de cambio ARS/USD ${rateBadge}
          <span class="form-hint">dólar MEP/CCL/cripto</span>
        </label>
        <input type="number" class="add-input" id="trade-rate"
          placeholder="${rateDefault}" value="${rateDefault}" min="1" oninput="updateTradeCalc()" />
      </div>
      <div class="form-group">
        <label class="config-label">
          Precio de compra (USD)
          <span class="form-hint">se completa automáticamente</span>
        </label>
        <input type="number" class="add-input" id="trade-price"
          placeholder="62400" min="0" step="any" oninput="updateTradeCalc()" />
      </div>
    </div>

    <!-- USD direct mode fields -->
    <div class="trade-form-grid hidden" id="trade-usd-fields">
      <div class="form-group">
        <label class="config-label">
          Total invertido (USD)
          <span class="form-hint">costo base de tu posición</span>
        </label>
        <input type="number" class="add-input" id="trade-usd-amount"
          placeholder="1036.65" min="0" step="any" oninput="updateTradeCalcUsd()" />
      </div>
      <div class="form-group">
        <label class="config-label">Resultado calculado</label>
        <div class="trade-calc" id="trade-calc-usd">
          <span class="calc-muted">Completá los campos para calcular</span>
        </div>
      </div>
    </div>

    <!-- Shared result display (ARS mode) -->
    <div class="trade-form-grid" id="trade-result-ars">
      <div class="form-group">
        <label class="config-label">Resultado calculado</label>
        <div class="trade-calc" id="trade-calc">
          <span class="calc-muted">Completá los campos para calcular</span>
        </div>
      </div>
    </div>

    <div id="trade-msg" class="add-msg"></div>
    <button class="btn-primary" onclick="submitTrade()">
      <i class="ti ti-plus" aria-hidden="true"></i> Registrar compra
    </button>
  </div>`;
}

function renderAddInitialBalanceFormHTML() {
  const assets = getUniqueAssetOptions();
  const cryptoOpts = assets
    .filter(a => a.type === 'crypto')
    .map(a => `<option value="${a.id}">${a.ticker} — ${a.name}</option>`)
    .join('');
  const stockOpts = assets
    .filter(a => a.type === 'stock')
    .map(a => `<option value="${a.id}">${a.ticker} — ${a.name}</option>`)
    .join('');
  const bondOpts = assets
    .filter(a => a.type === 'bond')
    .map(a => `<option value="${a.id}">${a.ticker} — ${a.name}</option>`)
    .join('');

  return `<div class="add-trade-card">
    <p class="form-info-text">
      <i class="ti ti-info-circle" aria-hidden="true"></i>
      Registrá tenencias previas ingresando solo el monto en USD. La cantidad de unidades se calcula automáticamente al precio actual y sirve como base para trackear el rendimiento futuro.
    </p>
    <div class="trade-form-grid">
      <div class="form-group">
        <label class="config-label">Activo</label>
        <select id="initial-asset">
          <option value="">Seleccionar activo...</option>
          <optgroup label="Criptomonedas">${cryptoOpts}</optgroup>
          <optgroup label="Acciones / CEDEARs">${stockOpts}</optgroup>
          <optgroup label="Bonos / Obligaciones Negociables">${bondOpts}</optgroup>
        </select>
      </div>
      <div class="form-group">
        <label class="config-label">Valor actual en USD</label>
        <input type="number" class="add-input" id="initial-usd"
          placeholder="154.00" min="0" step="0.01" />
      </div>
    </div>
    <div id="initial-msg" class="add-msg"></div>
    <button class="btn-primary" onclick="addInitialBalance()">
      <i class="ti ti-database-import" aria-hidden="true"></i> Registrar saldo inicial
    </button>
  </div>`;
}

function renderTradeEditForm(t) {
  const baseFields = `
    <div class="trade-edit-group">
      <label>Fecha</label>
      <input type="date" id="tedit-date-${t.id}" value="${t.date}" class="add-input" />
    </div>
    <div class="trade-edit-group">
      <label>Total USD</label>
      <input type="number" id="tedit-usd-${t.id}" value="${t.usdInvested.toFixed(2)}"
        min="0" step="0.01" class="add-input"
        ${t.isInitial ? '' : `oninput="syncTradeEditFields('${t.id}','usd')"`} />
    </div>`;

  const tradeFields = t.isInitial ? '' : `
    <div class="trade-edit-group">
      <label>Precio USD/u</label>
      <input type="number" id="tedit-price-${t.id}" value="${t.priceUsd.toFixed(4)}"
        min="0" step="any" class="add-input"
        oninput="syncTradeEditFields('${t.id}','price')" />
    </div>
    <div class="trade-edit-group">
      <label>Cantidad</label>
      <input type="number" id="tedit-qty-${t.id}" value="${t.quantity.toFixed(6)}"
        min="0" step="any" class="add-input"
        oninput="syncTradeEditFields('${t.id}','qty')" />
    </div>`;

  return `<div class="trade-edit-wrap" data-trade="${t.id}">
    <div class="trade-edit-fields">${baseFields}${tradeFields}</div>
    <div class="trade-edit-actions">
      <button class="btn-primary btn-sm" onclick="saveTradeEdit('${t.id}')">
        <i class="ti ti-check" aria-hidden="true"></i> Guardar
      </button>
      <button class="btn-ghost btn-sm" onclick="cancelTradeEdit()">Cancelar</button>
    </div>
  </div>`;
}

const expandedPositions = new Set();

function togglePosition(assetId) {
  const card   = document.querySelector(`.position-card[data-asset="${assetId}"]`);
  if (!card) return;
  const body    = card.querySelector('.position-body');
  const chevron = card.querySelector('.pos-chevron');
  if (expandedPositions.has(assetId)) {
    expandedPositions.delete(assetId);
    body.style.display       = 'none';
    chevron.style.transform  = 'rotate(0deg)';
  } else {
    expandedPositions.add(assetId);
    body.style.display       = '';
    chevron.style.transform  = 'rotate(180deg)';
  }
}

function renderPositionCard(pos) {
  const hasInitial = pos.trades.some(t => t.isInitial);
  const pnlSign  = pos.pnlUsd >= 0 ? '+' : '';
  const pnlCls   = pos.hasNewTrades ? (pos.pnlUsd >= 0 ? 'green' : 'red') : '';
  const pnlBarW  = pos.hasNewTrades ? Math.min(100, Math.abs(pos.pnlPct) * 2) : 0;
  const barColor = pos.pnlUsd >= 0 ? 'var(--green)' : 'var(--red)';
  const isExpanded = expandedPositions.has(pos.assetId);

  const pnlHeaderHtml = pos.hasNewTrades
    ? `<div class="position-pnl-val ${pnlCls}">${pnlSign}${formatUsd(pos.pnlUsd)}</div>
       <div class="position-pnl-pct ${pnlCls}">${pnlSign}${pos.pnlPct.toFixed(2)}%</div>`
    : `<div class="pnl-initial-only">Solo saldo inicial</div>`;

  const noPriceWarning = !pos.hasPrice
    ? `<div class="pos-no-price">
        <i class="ti ti-alert-triangle" aria-hidden="true"></i>
        Este activo no está en tu watchlist. <button class="link-btn" onclick="addAssetToWatchlistFromPortfolio('${pos.assetId}')">Agregar</button> para ver el precio actual.
       </div>`
    : '';

  const tradesHTML = pos.trades.map(t => {
    if (t.isInitial) {
      return `<div class="trade-row" data-trade="${t.id}">
        <div class="trade-row-left">
          <span class="trade-date">${formatTradeDate(t.date)}</span>
          <span class="trade-detail"><span class="badge-initial">Saldo inicial</span></span>
        </div>
        <div class="trade-row-right">
          <span class="trade-usd">${formatUsd(t.usdInvested)}</span>
          <button class="btn-edit" onclick="openTradeEdit('${t.id}')" aria-label="Editar saldo inicial">
            <i class="ti ti-pencil" aria-hidden="true"></i>
          </button>
          <button class="btn-remove" onclick="deleteTrade('${t.id}')" aria-label="Eliminar saldo inicial">
            <i class="ti ti-trash" aria-hidden="true"></i>
          </button>
        </div>
      </div>`;
    }
    const arsStr = t.arsAmount
      ? `$${t.arsAmount.toLocaleString('es-AR')} ARS (1 USD = $${t.arsUsdRate.toLocaleString('es-AR')})`
      : '';
    return `<div class="trade-row" data-trade="${t.id}">
      <div class="trade-row-left">
        <span class="trade-date">${formatTradeDate(t.date)}</span>
        <span class="trade-detail">
          ${arsStr ? arsStr + ' · ' : ''}
          ${t.quantity.toFixed(6)} ${t.ticker} a ${formatUsd(t.priceUsd)}
        </span>
      </div>
      <div class="trade-row-right">
        <span class="trade-usd">${formatUsd(t.usdInvested)}</span>
        <button class="btn-edit" onclick="openTradeEdit('${t.id}')" aria-label="Editar compra">
          <i class="ti ti-pencil" aria-hidden="true"></i>
        </button>
        <button class="btn-remove" onclick="deleteTrade('${t.id}')" aria-label="Eliminar compra">
          <i class="ti ti-trash" aria-hidden="true"></i>
        </button>
      </div>
    </div>`;
  }).join('');

  return `<div class="position-card" data-asset="${pos.assetId}">
    <div class="position-header position-header--toggle" onclick="togglePosition('${pos.assetId}')">
      <div class="position-info">
        <div class="position-name">${pos.assetName} <span class="position-ticker">${pos.ticker}</span></div>
        <div class="position-qty">${pos.totalQuantity.toFixed(6)} ${pos.ticker} en total</div>
      </div>
      <div class="position-header-right">
        <div class="position-pnl">${pnlHeaderHtml}</div>
        <i class="ti ti-chevron-down pos-chevron" style="transform:rotate(${isExpanded ? '180' : '0'}deg)" aria-hidden="true"></i>
      </div>
    </div>

    <div class="position-body" style="${isExpanded ? '' : 'display:none'}">
      ${noPriceWarning}

      <div class="position-stats">
        <div class="pos-stat">
          <div class="pos-stat-label">Precio prom. compra</div>
          <div class="pos-stat-val">${pos.hasNewTrades ? formatPrice(pos.avgBuyPrice) : '—'}</div>
        </div>
        <div class="pos-stat">
          <div class="pos-stat-label">Precio actual</div>
          <div class="pos-stat-val ${pnlCls}">${pos.hasPrice ? formatPrice(pos.currentPrice) : '—'}</div>
        </div>
        <div class="pos-stat">
          <div class="pos-stat-label">${pos.hasNewTrades && hasInitial ? 'Invertido <span class="stat-note">(excl. saldo ini.)</span>' : 'Invertido'}</div>
          <div class="pos-stat-val">${pos.hasNewTrades ? formatUsd(pos.pnlInvested) + ' USD' : formatUsd(pos.totalUsdInvested) + ' USD'}</div>
        </div>
        <div class="pos-stat">
          <div class="pos-stat-label">${pos.hasNewTrades ? 'Valor actual' : 'Valor actual (total)'}</div>
          <div class="pos-stat-val ${pnlCls}">${pos.hasPrice ? formatUsd(pos.hasNewTrades ? pos.pnlCurrVal : pos.currentValue) + ' USD' : '—'}</div>
        </div>
      </div>

      <div class="pnl-bar-track">
        <div class="pnl-bar-fill" style="width:${pnlBarW}%; background:${barColor}"></div>
      </div>

      <div class="trade-list-label">Movimientos registrados</div>
      <div class="trade-list">${tradesHTML}</div>
    </div>
  </div>`;
}

const TYPE_META = {
  crypto: { label: 'Criptomonedas', icon: 'ti-currency-bitcoin' },
  stock:  { label: 'Acciones',      icon: 'ti-chart-candle'     },
  bond:   { label: 'Bonos / ONs',   icon: 'ti-file-certificate' },
};

function renderPortfolioOverview(pf) {
  const pnlSign = pf.totalPnlUsd >= 0 ? '+' : '';
  const pnlCls  = pf.totalPnlUsd >= 0 ? 'green' : 'red';
  const pnlAccent = pf.totalPnlUsd >= 0 ? 'metric-buy' : 'metric-sell';

  // Per-type breakdown rows (only show types that have positions)
  const typeOrder = ['crypto', 'stock', 'bond'];
  const breakdownRows = typeOrder
    .filter(t => pf.byType[t])
    .map(t => {
      const d    = pf.byType[t];
      const meta = TYPE_META[t] || { label: t, icon: 'ti-circle' };
      // If the category has real (non-initial) trades, show P&L; otherwise show holdings
      const hasNew = d.invested > 0;
      const displayInvested = hasNew ? d.invested  : d.totalHeld;
      const displayValue    = hasNew ? d.value      : d.totalHeld;
      const pnl     = hasNew ? d.value - d.invested : 0;
      const pnlPct  = hasNew && d.invested > 0 ? (pnl / d.invested) * 100 : 0;
      const sign    = pnl >= 0 ? '+' : '';
      const cls     = pnl >= 0 ? 'green' : 'red';
      const pnlStr  = hasNew
        ? `<span class="pf-type-pnl ${cls}">${sign}${formatUsd(pnl)} (${sign}${pnlPct.toFixed(1)}%)</span>`
        : `<span class="pf-type-pnl muted">solo saldo inicial</span>`;
      return `
        <div class="pf-type-row">
          <span class="pf-type-icon"><i class="ti ${meta.icon}" aria-hidden="true"></i></span>
          <span class="pf-type-name">${meta.label}</span>
          <span class="pf-type-invested">${formatUsd(displayInvested)}</span>
          <span class="pf-type-arrow"><i class="ti ti-arrow-right" aria-hidden="true"></i></span>
          <span class="pf-type-value">${formatUsd(displayValue)}</span>
          ${pnlStr}
        </div>`;
    }).join('');

  return `
    <div class="pf-overview">
      <div class="pf-overview-title">
        <i class="ti ti-wallet" aria-hidden="true"></i> Resumen de inversiones
      </div>
      <div class="portfolio-summary pf-totals">
        <div class="metric">
          <div class="metric-label">Total invertido</div>
          <div class="metric-val">${formatUsd(pf.totalUsdInvested)}</div>
          <div class="metric-sub muted">USD acumulados</div>
        </div>
        <div class="metric">
          <div class="metric-label">Valor actual</div>
          <div class="metric-val">${formatUsd(pf.totalCurrentValue)}</div>
          <div class="metric-sub muted">al precio de hoy</div>
        </div>
        <div class="metric ${pnlAccent}">
          <div class="metric-label">Resultado neto</div>
          <div class="metric-val ${pnlCls}">${pnlSign}${formatUsd(pf.totalPnlUsd)}</div>
          <div class="metric-sub ${pnlCls}">${pnlSign}${pf.totalPnlPct.toFixed(2)}%</div>
        </div>
      </div>
      ${breakdownRows ? `
        <div class="pf-divider"></div>
        <div class="pf-breakdown-title">Por categoría</div>
        <div class="pf-breakdown">${breakdownRows}</div>` : ''}
    </div>`;
}

// ─────────────────────────────────────────────
// Equity curve (portfolio value over time)
// ─────────────────────────────────────────────

function renderEquityCurve(hasData, range) {
  const rangeButtons = ['30d', '90d', '1y'].map(r => {
    const label = r === '1y' ? '1A' : r.toUpperCase();
    const cls   = r === range ? ' active' : '';
    return `<button class="equity-range-btn${cls}" data-range="${r}" onclick="setEquityRange('${r}')">${label}</button>`;
  }).join('');

  const chartArea = hasData
    ? `<div style="position:relative;width:100%;height:180px;margin-top:12px;">
        <canvas id="equity-chart" role="img" aria-label="Curva de valor del portafolio"></canvas>
       </div>`
    : `<div class="equity-empty">
        <i class="ti ti-chart-line" aria-hidden="true"></i>
        La curva se construye con el tiempo. Cada vez que abras el panel se guarda un punto. Volvé mañana para ver el primer segmento.
       </div>`;

  return `<div class="equity-curve-card">
    <div class="equity-curve-header">
      <div class="section-title" style="margin:0">Evolución del portafolio</div>
      <div class="equity-range-btns">${rangeButtons}</div>
    </div>
    ${chartArea}
  </div>`;
}

function renderEquityCurveChart(history, range) {
  const canvas = document.getElementById('equity-chart');
  if (!canvas) return;

  const days     = range === '90d' ? 90 : range === '1y' ? 365 : 30;
  const filtered = history.slice(-days);

  if (equityChart) { equityChart.destroy(); equityChart = null; }
  if (!filtered.length) return;

  const labels = filtered.map(h => {
    const d = new Date(h.date + 'T12:00:00');
    return (d.getMonth() + 1) + '/' + d.getDate();
  });

  const isDark    = window.matchMedia('(prefers-color-scheme: dark)').matches;
  const gridColor = isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.05)';
  const textColor = isDark ? '#777' : '#aaa';

  equityChart = new Chart(canvas.getContext('2d'), {
    type: 'line',
    data: {
      labels,
      datasets: [
        {
          label: 'Valor actual',
          data:  filtered.map(h => h.value),
          borderColor:     '#1D9E75',
          backgroundColor: 'rgba(29,158,117,0.07)',
          borderWidth: 2,
          fill: true,
          tension: 0.3,
          pointRadius:      filtered.length <= 14 ? 3 : 0,
          pointHoverRadius: 4,
        },
        {
          label: 'Capital invertido',
          data:  filtered.map(h => h.invested),
          borderColor:     '#185FA5',
          backgroundColor: 'transparent',
          borderWidth: 1.5,
          borderDash: [5, 3],
          fill: false,
          tension: 0.3,
          pointRadius: 0,
          pointHoverRadius: 4,
        },
      ],
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      interaction: { mode: 'index', intersect: false },
      plugins: {
        legend: {
          display: true,
          labels: { color: textColor, font: { size: 11 }, boxWidth: 12, padding: 12 },
        },
        tooltip: {
          callbacks: {
            label: ctx => `${ctx.dataset.label}: ${formatUsd(ctx.raw)}`,
          },
        },
      },
      scales: {
        x: {
          grid:  { color: gridColor },
          ticks: { color: textColor, maxTicksLimit: 6, font: { size: 10 } },
          border:{ display: false },
        },
        y: {
          grid:  { color: gridColor },
          ticks: { color: textColor, font: { size: 10 }, callback: v => formatUsd(v) },
          border:{ display: false },
          position: 'right',
        },
      },
    },
  });
}

// ─────────────────────────────────────────────
// Notifications section (config tab)
// ─────────────────────────────────────────────

function renderNotificationsSection() {
  if (!('Notification' in window)) {
    return `<div class="notif-box notif-unsupported">
      <i class="ti ti-bell-off" aria-hidden="true"></i>
      Tu navegador no soporta notificaciones push.
    </div>`;
  }

  const perm = Notification.permission;

  if (perm === 'granted') {
    return `<div class="section-title">Notificaciones push</div>
    <div class="notif-box notif-granted">
      <div class="notif-status-row">
        <span class="notif-dot notif-dot--on"></span>
        <strong>Notificaciones activadas</strong>
      </div>
      <p class="notif-desc">Recibirás alertas del navegador cuando un activo genere señal de compra, RSI sobrevendido (≤umbral) o RSI sobrecomprado (≥75). Máximo 1 alerta por activo cada 4 horas.</p>
    </div>`;
  }

  if (perm === 'denied') {
    return `<div class="section-title">Notificaciones push</div>
    <div class="notif-box notif-denied">
      <div class="notif-status-row">
        <span class="notif-dot notif-dot--off"></span>
        <strong>Notificaciones bloqueadas</strong>
      </div>
      <p class="notif-desc">El navegador tiene las notificaciones bloqueadas para este sitio. Para activarlas, hacé clic en el ícono de candado en la barra de dirección → Permisos del sitio → Notificaciones → Permitir.</p>
    </div>`;
  }

  return `<div class="section-title">Notificaciones push</div>
  <div class="notif-box">
    <div class="notif-status-row">
      <span class="notif-dot"></span>
      <strong>Alertas en tu computadora</strong>
    </div>
    <p class="notif-desc">Activá las notificaciones del navegador para recibir alertas en tiempo real cuando un activo genere una señal de compra o llegue a niveles extremos de RSI, incluso con el panel en segundo plano.</p>
    <button class="btn-primary" onclick="requestNotifications()">
      <i class="ti ti-bell" aria-hidden="true"></i> Activar notificaciones
    </button>
  </div>`;
}

function renderPortfolio(priceData) {
  const container = document.getElementById('portfolio-content');
  if (!container) return;

  const pf      = computePortfolio(priceData);
  const history = loadPfHistory();
  const range   = typeof equityRangeCurrent !== 'undefined' ? equityRangeCurrent : '30d';

  const summaryHTML = renderPortfolioOverview(pf);
  const equityHTML  = `<div style="margin-top:1rem">${renderEquityCurve(history.length > 0, range)}</div>`;

  const positionsHTML = pf.positions.length
    ? `<div class="section-title" style="margin-top:1.5rem">Mis posiciones</div>
       <div class="positions-list">${pf.positions.map(renderPositionCard).join('')}</div>`
    : `<div class="empty-state" style="margin-bottom:1.5rem">
         <i class="ti ti-wallet" style="font-size:32px;display:block;margin-bottom:10px;opacity:0.35;"></i>
         Todavía no registraste ninguna compra. Usá el formulario para empezar.
       </div>`;

  container.innerHTML = `
    ${summaryHTML}
    ${equityHTML}
    ${positionsHTML}
    <div class="section-title" style="margin-top:1.5rem">Registrar nueva compra</div>
    ${renderAddTradeFormHTML()}
    <div class="section-title" style="margin-top:1.5rem">Registrar saldo inicial</div>
    ${renderAddInitialBalanceFormHTML()}
  `;

  if (history.length > 0) {
    renderEquityCurveChart(history, range);
  }
}
